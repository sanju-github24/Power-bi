"""
main.py — FastAPI
Bonus 20pts : POST /upload  — any CSV, instant schema detection, no hardcoded path
Bonus 10pts : /ask stores rich SQL context per session for follow-up questions
"""
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd, uvicorn, io, os, json

import database as db
from database import engine
from ai_engine import get_ai_dashboard

app = FastAPI(title="Pulse BI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

DEFAULT_CSV = os.getenv("CSV_PATH", "/Users/sanjays/Downloads/data-insight-api/Nykaa_Digital_Marketing.csv")

# session_id → list[{role, content}]
# Assistant messages include the generated SQL so Gemini can reference it in follow-ups
chat_histories: dict[str, list[dict]] = {}


# ── Startup: auto-load default CSV if it exists ───────────────────────────────
@app.on_event("startup")
async def startup():
    if os.path.exists(DEFAULT_CSV):
        cols = db.load_csv_to_db(DEFAULT_CSV)
        if cols:
            print(f"[startup] ✓ Auto-loaded '{DEFAULT_CSV}' — {db.get_row_count():,} rows, {len(cols)} cols.")
        else:
            print(f"[startup] ✗ Failed to parse default CSV: '{DEFAULT_CSV}'")
    else:
        print(f"[startup] No default CSV at '{DEFAULT_CSV}'. Waiting for upload.")


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status":     "ok",
        "csv_loaded": bool(db.current_columns),
        "filename":   db.current_filename,
        "columns":    db.current_columns,
        "row_count":  db.get_row_count(),
    }


# ── Schema ────────────────────────────────────────────────────────────────────
@app.get("/schema")
async def schema():
    if not db.current_columns:
        raise HTTPException(400, "No data loaded.")
    return {
        "filename":  db.current_filename,
        "columns":   db.current_columns,
        "row_count": db.get_row_count(),
        "schema":    db.current_schema,
    }


# ── Upload CSV — Bonus: Data Format Agnostic ─────────────────────────────────
@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    """
    Accept any CSV file. Parses it, loads into SQLite, returns schema.
    Clears all chat histories (new data = old context invalid).
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only .csv files are supported.")

    raw = await file.read()
    if not raw:
        raise HTTPException(400, "File is empty.")

    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as e:
        raise HTTPException(400, f"Cannot parse CSV: {e}")

    if df.empty:
        raise HTTPException(400, "CSV has no data rows.")
    if len(df.columns) < 2:
        raise HTTPException(400, "CSV must have at least 2 columns.")

    cols = db.load_dataframe_to_db(df, filename=file.filename)
    if not cols:
        raise HTTPException(500, "Failed to load CSV into database.")

    # New dataset → wipe all session histories (old SQL context is now wrong)
    chat_histories.clear()

    return {
        "message":   f"✓ '{file.filename}' loaded — {len(df):,} rows, {len(cols)} columns.",
        "filename":  file.filename,
        "columns":   cols,
        "row_count": len(df),
        "schema":    db.current_schema,
        "sample":    df.head(3).fillna("").to_dict(orient="records"),
    }


# ── Ask — Bonus: Follow-up Questions ─────────────────────────────────────────
class AskBody(BaseModel):
    question:   str
    session_id: str = "default"


@app.post("/ask")
async def ask(body: AskBody):
    if not body.question.strip():
        raise HTTPException(400, "Question is empty.")
    if not db.current_columns:
        raise HTTPException(400, "No data loaded. Upload a CSV first.")

    history = chat_histories.setdefault(body.session_id, [])

    try:
        result = await get_ai_dashboard(
            body.question,
            db.current_columns,
            db.current_schema,
            history,
        )

        # ── Store rich SQL context for follow-ups ─────────────────────────────
        # We save the actual SQL queries so the next follow-up question can
        # say "filter the previous query" and Gemini sees the real SQL.
        sql_context = [
            {"title": p.get("title",""), "sql": p.get("sql",""), "chart_type": p.get("chart_type","")}
            for p in result.get("panels", [])
        ]
        history.append({"role": "user",     "content": body.question})
        history.append({"role": "assistant", "content": f"Panels: {json.dumps(sql_context)}"})
        chat_histories[body.session_id] = history[-20:]   # keep last 10 turns

        # Hallucination guard
        if result.get("cannot_answer"):
            return {
                "question":             body.question,
                "dashboard_title":      "",
                "summary":              "",
                "is_followup":          False,
                "panels":               [],
                "cannot_answer":        True,
                "cannot_answer_reason": result.get("cannot_answer_reason", ""),
            }

        # ── Execute SQL locally (no API calls) ────────────────────────────────
        panels_out = []
        for panel in result.get("panels", []):
            sql = panel.get("sql", "").strip()
            if not sql:
                panel["data"] = []; panel["error"] = "No SQL."; panels_out.append(panel); continue
            try:
                df = pd.read_sql(sql, engine)
                panel["data"]      = df.fillna("").to_dict(orient="records")
                panel["row_count"] = len(df)
                panel["columns"]   = df.columns.tolist()
                # Confidence heuristic: penalise empty results, complex joins, wildcards
                conf = 90
                if len(df) == 0:           conf -= 40
                if len(df) < 3:            conf -= 15
                if "SELECT *" in sql.upper(): conf -= 10
                if "LIKE" in sql.upper():  conf -= 5
                panel["confidence"] = max(10, min(99, conf))
            except Exception as e:
                panel["data"] = []; panel["error"] = f"SQL error: {e}"
                panel["confidence"] = 0
            panels_out.append(panel)

        return {
            "question":             body.question,
            "dashboard_title":      result.get("dashboard_title", "Dashboard"),
            "summary":              result.get("summary", ""),
            "is_followup":          result.get("is_followup", False),
            "panels":               panels_out,
            "cannot_answer":        False,
            "cannot_answer_reason": "",
        }

    except HTTPException: raise
    except Exception as e:
        err = str(e)
        if "429" in err or "quota" in err.lower():
            raise HTTPException(429, "Rate limit hit. Wait ~60s and retry.")
        raise HTTPException(500, f"Error: {err}")


# ── History endpoints ─────────────────────────────────────────────────────────
@app.get("/history/{session_id}")
async def get_history(session_id: str):
    h = chat_histories.get(session_id, [])
    return {"session_id": session_id, "turns": sum(1 for m in h if m["role"]=="user"), "messages": h}

@app.delete("/history/{session_id}")
async def clear_history(session_id: str):
    chat_histories.pop(session_id, None)
    return {"message": "Cleared."}


# ── Auto-Analyst ──────────────────────────────────────────────────────────────
@app.get("/auto-analyze")
async def auto_analyze():
    """Proactively runs 3 smart questions after CSV upload and returns dashboards."""
    if not db.current_columns:
        raise HTTPException(400, "No data loaded.")
    from ai_engine import get_auto_analysis
    try:
        insights = await get_auto_analysis(db.current_columns, db.current_schema)
        out = []
        for item in insights:
            result = item.get("result", {})
            panels_out = []
            for panel in result.get("panels", []):
                sql = panel.get("sql", "").strip()
                if not sql:
                    panel["data"] = []; panel["error"] = "No SQL."; panels_out.append(panel); continue
                try:
                    df_p = pd.read_sql(sql, engine)
                    panel["data"]      = df_p.fillna("").to_dict(orient="records")
                    panel["row_count"] = len(df_p)
                except Exception as e:
                    panel["data"] = []; panel["error"] = str(e)
                panels_out.append(panel)
            result["panels"] = panels_out
            out.append({"question": item["question"], "result": result})
        return {"insights": out}
    except Exception as e:
        raise HTTPException(500, f"Auto-analysis failed: {e}")


# ── Anomaly Detection ─────────────────────────────────────────────────────────
@app.get("/anomalies")
async def anomalies():
    """IQR-based outlier scan across all numeric columns."""
    if not db.current_columns:
        raise HTTPException(400, "No data loaded.")
    import numpy as np
    from sqlalchemy import text
    results = []
    with engine.connect() as conn:
        for col in db.current_columns:
            try:
                rows = conn.execute(
                    text(f'SELECT "{col}" FROM data_table WHERE "{col}" IS NOT NULL LIMIT 5000')
                ).fetchall()
                nums = []
                for r in rows:
                    try: nums.append(float(r[0]))
                    except: pass
                if len(nums) < 10:
                    continue
                arr = np.array(nums)
                q1, q3 = np.percentile(arr, 25), np.percentile(arr, 75)
                iqr = q3 - q1
                if iqr == 0:
                    continue
                lo, hi = q1 - 3.0 * iqr, q3 + 3.0 * iqr
                outliers = [v for v in nums if v < lo or v > hi]
                if not outliers:
                    continue
                mean = float(np.mean(arr))
                std  = float(np.std(arr))
                pct  = round(len(outliers) / len(nums) * 100, 1)
                spikes = [v for v in outliers if v > mean + 3*std]
                drops  = [v for v in outliers if v < mean - 3*std]
                severity = "critical" if pct > 5 else "warning" if pct > 2 else "info"
                results.append({
                    "column": col, "severity": severity,
                    "outlier_count": len(outliers), "total_count": len(nums),
                    "outlier_pct": pct, "mean": round(mean,2), "std": round(std,2),
                    "lower_fence": round(lo,2), "upper_fence": round(hi,2),
                    "spike_count": len(spikes), "drop_count": len(drops),
                    "max_spike": round(max(spikes),2) if spikes else None,
                    "max_drop":  round(min(drops),2)  if drops  else None,
                    "type": "spike" if spikes and not drops else "drop" if drops and not spikes else "mixed",
                    "sample_outliers": sorted(set(round(v,2) for v in outliers))[:5],
                })
            except Exception:
                continue
    results.sort(key=lambda x: ({"critical":0,"warning":1,"info":2}[x["severity"]], -x["outlier_pct"]))
    return {"anomalies": results[:10], "columns_scanned": len(db.current_columns)}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


# ── Why did this happen? ──────────────────────────────────────────────────────
class WhyBody(BaseModel):
    panel_title:  str = ""
    chart_type:   str = ""
    sql:          str = ""
    insight:      str = ""
    data_sample:  list = []
    session_id:   str  = "default"

@app.post("/why")
async def why(body: WhyBody):
    if not db.current_columns:
        raise HTTPException(400, "No data loaded.")
    from ai_engine import get_why_explanation
    try:
        explanation = await get_why_explanation(
            panel_title  = body.panel_title,
            chart_type   = body.chart_type,
            sql          = body.sql,
            insight      = body.insight,
            data_sample  = body.data_sample,
            schema       = db.current_schema,
        )
        return {"explanation": explanation}
    except Exception as e:
        raise HTTPException(500, f"Why explanation failed: {e}")
