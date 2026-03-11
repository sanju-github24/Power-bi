"""
main.py — FastAPI
Bonus 20pts : POST /upload  — any CSV, instant schema detection, no hardcoded path
Bonus 10pts : /ask stores rich SQL context per session for follow-up questions
"""
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd, uvicorn, io, os, json, asyncio

import database as db
from database import engine
from ai_engine import get_ai_dashboard
from agent import is_agentic_query, run_agentic_workflow

app = FastAPI(title="Pulse BI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

DEFAULT_CSV = os.getenv("CSV_PATH", "/Users/sanjays/Downloads/data-insight-api/Nykaa_Digital_Marketing.csv")

# session_id → list[{role, content}]
# Assistant messages include the generated SQL so Gemini can reference it in follow-ups
chat_histories: dict[str, list[dict]] = {}


# ── Startup cache — persists insights + anomalies across page reloads ─────────
startup_cache: dict = {
    "insights":  [],
    "anomalies": [],
    "ready":     False,
}

# ── Startup: auto-load default CSV + run insights + anomalies ─────────────────
@app.on_event("startup")
async def startup():
    if os.path.exists(DEFAULT_CSV):
        cols = db.load_csv_to_db(DEFAULT_CSV)
        if cols:
            print(f"[startup] ✓ Auto-loaded '{DEFAULT_CSV}' — {db.get_row_count():,} rows, {len(cols)} cols.")
            # Fire background task to pre-compute insights and anomalies
            asyncio.create_task(_precompute_startup_cache())
        else:
            print(f"[startup] ✗ Failed to parse default CSV: '{DEFAULT_CSV}'")
    else:
        print(f"[startup] No default CSV at '{DEFAULT_CSV}'. Waiting for upload.")


async def _precompute_startup_cache():
    """Runs in background after startup — computes insights + anomalies once and caches them."""
    global startup_cache
    print("[startup] Computing anomalies + auto-insights in background…")

    # ── Anomalies first (pure math, fast, no API) ──────────────────────────────
    try:
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
                    if len(nums) < 10: continue
                    arr = np.array(nums)
                    q1, q3 = np.percentile(arr, 25), np.percentile(arr, 75)
                    iqr = q3 - q1
                    if iqr == 0: continue
                    lo, hi = q1 - 3.0 * iqr, q3 + 3.0 * iqr
                    outliers = [v for v in nums if v < lo or v > hi]
                    if not outliers: continue
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
                except Exception: continue
        results.sort(key=lambda x: ({"critical":0,"warning":1,"info":2}[x["severity"]], -x["outlier_pct"]))
        startup_cache["anomalies"] = results[:10]
        print(f"[startup] ✓ Anomalies ready — {len(results)} columns flagged")
    except Exception as e:
        print(f"[startup] Anomaly scan failed: {e}")

    # ── Auto-insights (Gemini — waits for rate limiter) ────────────────────────
    try:
        from ai_engine import get_auto_analysis
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
                    panel["insight"]   = _real_insight(df_p, panel)
                except Exception as e:
                    panel["data"] = []; panel["error"] = str(e)
                panels_out.append(panel)
            result["panels"] = panels_out
            out.append({"question": item["question"], "result": result})
        startup_cache["insights"] = out
        startup_cache["ready"]    = True
        print(f"[startup] ✓ Auto-insights ready — {len(out)} insights cached")
    except Exception as e:
        startup_cache["ready"] = True   # mark ready even if insights fail
        print(f"[startup] Auto-insights failed: {e}")


# ── Health — now includes cached insights + anomalies ─────────────────────────
@app.get("/health")
async def health():
    return {
        "status":      "ok",
        "csv_loaded":  bool(db.current_columns),
        "filename":    db.current_filename,
        "columns":     db.current_columns,
        "row_count":   db.get_row_count(),
        "cache_ready": startup_cache["ready"],
        "insights":    startup_cache["insights"],
        "anomalies":   startup_cache["anomalies"],
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

    # Reset startup cache and recompute for new CSV
    startup_cache["insights"]  = []
    startup_cache["anomalies"] = []
    startup_cache["ready"]     = False
    asyncio.create_task(_precompute_startup_cache())

    return {
        "message":   f"✓ '{file.filename}' loaded — {len(df):,} rows, {len(cols)} columns.",
        "filename":  file.filename,
        "columns":   cols,
        "row_count": len(df),
        "schema":    db.current_schema,
        "sample":    df.head(3).fillna("").to_dict(orient="records"),
    }


def _clean_col(col: str) -> str:
    """Turn raw column name or SQL alias into a human readable label."""
    import re
    # First replace underscores with spaces
    s = col.replace("_", " ")
    # Split camelCase and lowercase run-ons e.g. "averageroi" → "average roi"
    s = re.sub(r'([a-z])([A-Z])', r'\1 \2', s)          # camelCase
    s = re.sub(r'(avg|average|total|sum|count|max|min)',  # common SQL prefixes
               lambda m: m.group(0) + ' ', s, flags=re.IGNORECASE)
    # Known abbreviations → proper labels
    s = re.sub(r'\broi\b', 'ROI', s, flags=re.IGNORECASE)
    s = re.sub(r'\bkpi\b', 'KPI', s, flags=re.IGNORECASE)
    s = re.sub(r'\bctr\b', 'CTR', s, flags=re.IGNORECASE)
    # Clean up double spaces and title case
    s = ' '.join(s.split()).strip().title()
    # Fix title-cased abbreviations back to upper
    s = re.sub(r'\bRoi\b', 'ROI', s)
    s = re.sub(r'\bKpi\b', 'KPI', s)
    s = re.sub(r'\bCtr\b', 'CTR', s)
    return s


def _real_insight(df: pd.DataFrame, panel: dict) -> str:
    """Generate a factually accurate, human-sounding insight from actual query results."""
    try:
        if df.empty:
            return "No data matched this query — try broadening your filters."

        cols     = df.columns.tolist()
        num_cols = [c for c in cols if pd.api.types.is_numeric_dtype(df[c])]
        cat_cols = [c for c in cols if not pd.api.types.is_numeric_dtype(df[c])]
        ct       = (panel.get("chart_type") or "bar").lower()

        # Resolve x and y columns — prefer exact match then fallback
        x_col = panel.get("x_axis", "")
        y_col = panel.get("y_axis", "")
        if x_col not in df.columns: x_col = cat_cols[0] if cat_cols else cols[0]
        if y_col not in df.columns: y_col = num_cols[0] if num_cols else cols[-1]

        metric = _clean_col(y_col)

        # ── KPI ───────────────────────────────────────────────────────────────
        if ct == "kpi" or (len(df) == 1 and len(num_cols) >= 1):
            val = df[y_col].iloc[0] if y_col in df.columns else df.iloc[0, -1]
            return f"The total {metric.lower()} stands at {_fmt(val)}."

        # ── Bar / Pie / Doughnut / HBar — ranking insight ─────────────────────
        if ct in ("bar", "pie", "doughnut", "horizontalbar", "hbar") or (cat_cols and num_cols):
            if x_col in df.columns and y_col in df.columns:
                sorted_df = df.dropna(subset=[y_col]).copy()
                sorted_df[y_col] = pd.to_numeric(sorted_df[y_col], errors="coerce")
                sorted_df = sorted_df.dropna(subset=[y_col])
                sorted_df = sorted_df.sort_values(y_col, ascending=False)
                if len(sorted_df) == 0:
                    return "No numeric data available for this query."

                top  = sorted_df.iloc[0]
                top_name = str(top[x_col])
                # Truncate long combo names like "Facebook, Email, WhatsApp"
                if len(top_name) > 20:
                    top_name = top_name[:18] + "…"

                top_v = float(top[y_col])

                # Compare against 2nd place (more meaningful than last place)
                if len(sorted_df) >= 2:
                    second     = sorted_df.iloc[1]
                    sec_name   = str(second[x_col])
                    if len(sec_name) > 20: sec_name = sec_name[:18] + "…"
                    sec_v      = float(second[y_col])
                    if sec_v != 0:
                        gap_pct = ((top_v - sec_v) / abs(sec_v)) * 100
                        # Only show % if it's a reasonable number
                        if gap_pct < 200:
                            gap_str = f", {gap_pct:.0f}% ahead of {sec_name} ({_fmt(sec_v)})"
                        else:
                            gap_str = f", well ahead of {sec_name} at {_fmt(sec_v)}"
                    else:
                        gap_str = f", followed by {sec_name}"
                else:
                    gap_str = ""

                return f"{top_name} leads with {_fmt(top_v)} in {metric.lower()}{gap_str}."

        # ── Line / Area — trend insight ───────────────────────────────────────
        if ct in ("line", "area") and num_cols:
            series = pd.to_numeric(df[y_col], errors="coerce").dropna()
            if len(series) >= 2:
                first, last = series.iloc[0], series.iloc[-1]
                peak_idx = series.idxmax()
                peak_val = _fmt(series.max())
                pct   = ((last - first) / abs(first) * 100) if first != 0 else 0
                trend = "grew" if last > first else "declined"
                # Include peak if x_col available
                if x_col in df.columns:
                    peak_label = str(df[x_col].iloc[peak_idx])
                    return (f"{metric} {trend} by {abs(pct):.1f}% overall, "
                            f"peaking at {peak_val} in {peak_label}.")
                return (f"{metric} {trend} by {abs(pct):.1f}% "
                        f"from {_fmt(first)} to {_fmt(last)}.")

        # ── Scatter — correlation insight ─────────────────────────────────────
        if ct == "scatter" and len(num_cols) >= 2:
            corr = df[num_cols[0]].corr(df[num_cols[1]])
            if not pd.isna(corr):
                strength  = "strong" if abs(corr) > 0.7 else "moderate" if abs(corr) > 0.4 else "weak"
                direction = "positive" if corr > 0 else "negative"
                col_a = _clean_col(num_cols[0])
                col_b = _clean_col(num_cols[1])
                return (f"There's a {strength} {direction} relationship (r={corr:.2f}) "
                        f"between {col_a} and {col_b}.")

        # ── Table ─────────────────────────────────────────────────────────────
        return f"Showing {len(df):,} records across {len(cols)} columns."

    except Exception:
        return panel.get("insight", "")   # fallback to Gemini's original


def _fmt(val) -> str:
    """Format a number cleanly — rupee-aware, no floating point noise."""
    try:
        n = float(val)
        # Crore range (10M+)
        if n >= 10_000_000: return f"₹{n/10_000_000:.2f}Cr"
        # Lakh range (100K+)
        if n >= 100_000:    return f"₹{n/100_000:.2f}L"
        # Thousands
        if n >= 1_000:      return f"₹{n:,.0f}"
        # Small whole number
        if n == int(n):     return str(int(n))
        # Small decimal — strip trailing zeros
        return f"{n:.2f}".rstrip('0').rstrip('.')
    except Exception:
        return str(val)


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
        # ── Detect if this needs agentic multi-step reasoning ─────────────────
        if is_agentic_query(body.question):
            print(f"[ask] 🤖 Agentic query detected: '{body.question[:50]}'")
            from ai_engine import client, WORKING_MODEL, _bucket
            result = await run_agentic_workflow(
                question   = body.question,
                columns    = db.current_columns,
                schema     = db.current_schema,
                history    = history,
                client     = client,
                model      = WORKING_MODEL,
                bucket     = _bucket,
                execute_fn = get_ai_dashboard,
            )
        else:
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
                # Confidence heuristic
                conf = 90
                if len(df) == 0:              conf -= 40
                if len(df) < 3:               conf -= 15
                if "SELECT *" in sql.upper(): conf -= 10
                if "LIKE"     in sql.upper(): conf -= 5
                panel["confidence"] = max(10, min(99, conf))
                # ── Override Gemini's guessed insight with real data insight ──
                panel["insight"] = _real_insight(df, panel)
            except Exception as e:
                panel["data"] = []; panel["error"] = f"SQL error: {e}"
                panel["confidence"] = 0
            panels_out.append(panel)

        # ── Build real summary from actual data (prevents contradiction) ─────
        real_insights = [p.get("insight","") for p in panels_out if p.get("insight")]
        if real_insights:
            real_summary = real_insights[0]  # use top panel's real insight as summary
        else:
            real_summary = result.get("summary", "")

        return {
            "question":             body.question,
            "dashboard_title":      result.get("dashboard_title", "Dashboard"),
            "summary":              real_summary,
            "is_followup":          result.get("is_followup", False),
            "is_agentic":           result.get("is_agentic", False),
            "sub_questions":        result.get("sub_questions", []),
            "panels":               panels_out,
            "tldr":                 result.get("tldr", []),
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