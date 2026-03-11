"""
rag.py — Retrieval-Augmented Generation for Pulse BI

For every user question, this module:
1. Identifies which columns are relevant to the question
2. Retrieves actual sample values + statistics from those columns
3. Builds a compact RAG context block injected into the Gemini prompt

This prevents hallucinated column values (e.g. 'hindi' vs 'Hindi'),
wrong filters, and incorrect aggregations — directly boosting accuracy.
"""

import re
import json
from sqlalchemy import text
from database import engine, current_columns, current_schema


# ── Keyword → column relevance mapping ───────────────────────────────────────
# Maps common question words to likely column names (case-insensitive partial match)
_KEYWORD_HINTS = [
    (["revenue", "sales", "income", "earning"],            ["revenue"]),
    (["roi", "return"],                                    ["roi"]),
    (["cost", "acquisition", "spend", "budget"],           ["acquisition_cost"]),
    (["conversion", "convert", "purchase", "buy"],         ["conversions"]),
    (["click", "ctr"],                                     ["clicks"]),
    (["impression", "reach", "view"],                      ["impressions"]),
    (["lead"],                                             ["leads"]),
    (["engagement", "score", "engage"],                    ["engagement_score"]),
    (["channel", "platform", "instagram", "youtube",
      "facebook", "google", "whatsapp", "email"],          ["channel_used"]),
    (["campaign type", "type", "influencer", "paid",
      "social media", "seo"],                              ["campaign_type"]),
    (["audience", "target", "segment", "customer",
      "women", "student", "youth", "tier"],                ["target_audience", "customer_segment"]),
    (["language", "hindi", "tamil", "english", "bengali"], ["language"]),
    (["date", "month", "monthly", "year", "trend",
      "time", "quarter", "weekly", "daily", "when"],       ["date"]),
    (["duration", "length", "days", "long"],               ["duration"]),
]


def _relevant_columns(question: str, all_columns: list[str]) -> list[str]:
    """Return columns most relevant to the question."""
    q = question.lower()
    relevant = set()

    # Keyword-based matching
    for keywords, col_hints in _KEYWORD_HINTS:
        if any(kw in q for kw in keywords):
            for hint in col_hints:
                for col in all_columns:
                    if hint.lower() in col.lower():
                        relevant.add(col)

    # Direct column name mention in question
    for col in all_columns:
        col_clean = col.lower().replace("_", " ")
        if col_clean in q or col.lower() in q:
            relevant.add(col)

    # Always include at least the first numeric and first text column as fallback
    if not relevant:
        relevant.update(all_columns[:4])

    return list(relevant)


def _get_column_context(col: str, max_values: int = 12) -> dict:
    """Fetch actual distinct values + stats for a column from SQLite."""
    try:
        with engine.connect() as conn:
            # Try to detect if numeric
            sample_row = conn.execute(
                text(f'SELECT "{col}" FROM data_table WHERE "{col}" IS NOT NULL LIMIT 1')
            ).fetchone()

            if sample_row is None:
                return {"column": col, "type": "empty", "values": []}

            val = sample_row[0]
            is_numeric = isinstance(val, (int, float))

            if is_numeric:
                row = conn.execute(text(
                    f'SELECT MIN("{col}"), MAX("{col}"), ROUND(AVG("{col}"),2), COUNT(DISTINCT "{col}") '
                    f'FROM data_table WHERE "{col}" IS NOT NULL'
                )).fetchone()
                return {
                    "column": col,
                    "type": "numeric",
                    "min": row[0], "max": row[1], "avg": row[2],
                    "distinct_count": row[3]
                }
            else:
                rows = conn.execute(text(
                    f'SELECT DISTINCT "{col}" FROM data_table '
                    f'WHERE "{col}" IS NOT NULL AND "{col}" != "" '
                    f'ORDER BY "{col}" LIMIT {max_values}'
                )).fetchall()
                count_row = conn.execute(text(
                    f'SELECT COUNT(DISTINCT "{col}") FROM data_table'
                )).fetchone()
                values = [str(r[0]) for r in rows]
                return {
                    "column": col,
                    "type": "categorical",
                    "distinct_count": count_row[0],
                    "values": values,
                    "has_more": count_row[0] > max_values
                }
    except Exception as e:
        return {"column": col, "type": "error", "error": str(e)}


def _get_sample_rows(question: str, relevant_cols: list[str], n: int = 3) -> list[dict]:
    """Fetch a few representative rows for context."""
    try:
        cols_sql = ", ".join(f'"{c}"' for c in relevant_cols[:6])
        with engine.connect() as conn:
            rows = conn.execute(text(
                f'SELECT {cols_sql} FROM data_table LIMIT {n}'
            )).fetchall()
        return [dict(zip(relevant_cols[:6], row)) for row in rows]
    except Exception:
        return []


def build_rag_context(question: str, columns: list[str]) -> str:
    """
    Main RAG function — returns a context block to inject into the Gemini prompt.
    Contains: relevant column values, stats, and sample rows.
    """
    if not columns or not engine:
        return ""

    relevant = _relevant_columns(question, columns)

    lines = ["━━━ RAG CONTEXT (retrieved from actual data) ━━━"]
    lines.append("Use these EXACT values in your SQL filters and aggregations:\n")

    # Per-column context
    for col in relevant:
        ctx = _get_column_context(col)
        if ctx["type"] == "categorical":
            vals = ctx["values"]
            more = f" (+ {ctx['distinct_count'] - len(vals)} more)" if ctx.get("has_more") else ""
            lines.append(f'  {col} → exact values: {json.dumps(vals)}{more}')
        elif ctx["type"] == "numeric":
            lines.append(
                f'  {col} → min={ctx["min"]}, max={ctx["max"]}, avg={ctx["avg"]}'
            )

    # Sample rows for extra grounding
    sample_rows = _get_sample_rows(question, relevant)
    if sample_rows:
        lines.append(f"\nSample rows (for reference):")
        for row in sample_rows:
            # Truncate long values
            clean = {k: (str(v)[:40] if v else v) for k, v in row.items()}
            lines.append(f"  {json.dumps(clean)}")

    lines.append("\n⚠ IMPORTANT: Use ONLY the exact column values shown above in WHERE clauses.")
    lines.append("━━━ END RAG CONTEXT ━━━")

    return "\n".join(lines)