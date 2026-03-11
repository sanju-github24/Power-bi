"""
ai_engine.py
Model  : gemini-2.5-flash-lite
Extras : persistent disk cache · dual API key rotation · non-blocking token-bucket · follow-up SQL patching
"""
import os, time, json, re, hashlib, asyncio, threading, itertools
from pathlib import Path
from google import genai
from google.genai import errors
from dotenv import load_dotenv

load_dotenv()

# ── Dual API key rotation ─────────────────────────────────────────────────────
# Load both keys — effectively doubles RPM from 3 → 6
_key1 = os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY_1")
_key2 = os.getenv("GEMINI_API_KEY_2")

if not _key1:
    raise EnvironmentError("GEMINI_API_KEY not set in .env")

# Build client pool — 2 clients if both keys exist, else 1
_clients = [genai.Client(api_key=_key1)]
if _key2 and _key2 != _key1:
    _clients.append(genai.Client(api_key=_key2))
    print(f"[ai_engine] ✓ Dual API key rotation enabled — {len(_clients)} keys loaded")
else:
    print(f"[ai_engine] ℹ Single API key mode — add GEMINI_API_KEY_2 to .env for 2x speed")

# Round-robin iterator — alternates between key1 and key2 on every call
_client_cycle = itertools.cycle(_clients)
_client_lock  = threading.Lock()

def _next_client():
    """Get next client in round-robin rotation."""
    with _client_lock:
        return next(_client_cycle)

# Expose a single `client` for agent.py compatibility (uses key1)
client        = _clients[0]
WORKING_MODEL = "gemini-2.5-flash-lite"
FALLBACK_MODEL= "gemini-2.5-flash-lite"
FORBIDDEN_SQL = ("INSERT","UPDATE","DELETE","DROP","ALTER","CREATE","ATTACH","PRAGMA")

# ── Persistent cache ──────────────────────────────────────────────────────────
CACHE_FILE = Path("./gemini_cache.json")
_cache: dict = {}
_lock = threading.Lock()

def _load_cache():
    global _cache
    if CACHE_FILE.exists():
        try:
            _cache = json.loads(CACHE_FILE.read_text())
            print(f"[cache] {len(_cache)} entries loaded.")
        except Exception:
            _cache = {}

def _save_cache():
    try: CACHE_FILE.write_text(json.dumps(_cache, indent=2))
    except Exception as e: print(f"[cache] save failed: {e}")

def _cache_key(question: str, cols: list[str], hist_sig: str) -> str:
    raw = question.strip().lower() + "|" + ",".join(sorted(cols)) + "|" + hist_sig
    return hashlib.md5(raw.encode()).hexdigest()

def _hist_sig(history: list[dict]) -> str:
    """Short fingerprint of last 2 user turns so follow-ups get unique cache keys."""
    msgs = [m["content"] for m in history if m["role"] == "user"][-2:]
    return hashlib.md5("|".join(str(m)[:80] for m in msgs).encode()).hexdigest()[:8]

_load_cache()

# ── Non-blocking token-bucket rate limiter ────────────────────────────────────
class _Bucket:
    def __init__(self, rpm: int = 13):
        self._tokens = float(rpm); self._max = float(rpm)
        self._rate   = rpm / 60.0; self._last = time.monotonic()
        self._lock   = asyncio.Lock()

    async def acquire(self):
        async with self._lock:
            while True:
                now = time.monotonic()
                self._tokens = min(self._max, self._tokens + (now - self._last) * self._rate)
                self._last = now
                if self._tokens >= 1:
                    self._tokens -= 1; return
                wait = (1 - self._tokens) / self._rate
                print(f"[limiter] waiting {wait:.1f}s …")
                await asyncio.sleep(wait)

_bucket = _Bucket(rpm=10 if len(_clients) > 1 else 5)   # be more aggressive — retry handles 429s

# ── Prompt ────────────────────────────────────────────────────────────────────
_PROMPT = """\
You are a senior BI analyst embedded in a conversational dashboard.
SQLite table: data_table

Schema:
{schema}

{rag_block}

{history_block}
━━━ CURRENT QUESTION ━━━
"{question}"

━━━ FOLLOW-UP RULES ━━━
If conversation history exists AND the question is a follow-up (contains words like:
filter, only, exclude, now, instead, change, top N, bottom N, region/area names,
specific values visible in prior SQL), THEN:
  • Re-use the same chart type(s) unless user asks to change it.
  • Modify the prior SQL by adding/changing WHERE, LIMIT, GROUP BY, ORDER BY.
  • Set "is_followup": true in output.
  • Usually return just 1 panel (the updated one), unless user asks for more.

━━━ SQL RULES ━━━
  • SELECT only — never INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/ATTACH/PRAGMA.
  • Column names must EXACTLY match schema (case-sensitive).
  • GROUP BY every aggregation. LIMIT 50 for TABLE panels.
  • ROUND(x,2) for floats. COALESCE(col,0) for nullable numerics.
  • Filters: WHERE col = 'value'  or  WHERE col IN ('a','b','c').
  • Date filters: WHERE strftime('%Y',date_col) = '2023'.
  • If required column is not in schema → set cannot_answer: true.

━━━ VISUALIZATION DECISION TREE ━━━
Step 1 — User names chart explicitly → use exactly that.
Step 2 — Look at SQL output shape:
  date/time column + numeric        →  Line
  cumulative / running total        →  Area
  text categories + numeric, ≤8    →  Pie
  text categories + numeric, >8    →  Bar
  two numeric columns               →  Scatter
  single aggregate (no GROUP BY)    →  KPI
  3+ columns or raw records         →  Table
  ORDER BY … DESC LIMIT N           →  Bar
Step 3 — Keyword overrides:
  trend / over time / monthly       →  Line or Area
  compare / vs / versus             →  Bar
  breakdown / share / distribution  →  Pie (≤8) else Bar
  top N / ranking / best / worst    →  Bar
  list / show all / all records     →  Table
  correlation / relationship        →  Scatter
Step 4 — Hard guards (always apply):
  Pie only if ≤ 8 slices, else Bar.
  Line only for time-series data.
  Scatter only if ≥ 10 data points.

━━━ PANEL COUNT ━━━
  Simple (1 metric or dimension)   → 1 panel
  Medium (compare 2 things)        → 2 panels
  Complex / "full overview"        → 3 panels max
  Follow-up question               → 1 panel (the changed chart)

━━━ TONE & LANGUAGE RULES ━━━
Write like a sharp, friendly senior analyst talking to a CEO — not like a robot describing a chart.
  • chart_reasoning: 1 short sentence explaining WHY this chart helps the user understand THEIR data.
    BAD:  "A bar chart is suitable for comparing the revenue of individual campaigns."
    GOOD: "Bar makes it easy to spot which campaigns are pulling ahead at a glance."
    BAD:  "Line chart is appropriate for time-series data."
    GOOD: "Line shows you exactly where revenue spiked or dipped across the year."
  • insight: 1 punchy sentence with a real number from the data — a finding, not a description.
    BAD:  "The chart shows revenue by campaign type."
    GOOD: "Paid Ads is driving 38% more revenue than any other campaign type."
  • summary: 1 sentence telling the user what the dashboard reveals — make it feel like a discovery.
    BAD:  "This dashboard shows revenue broken down by various dimensions."
    GOOD: "Instagram campaigns are your top revenue driver — but Email has the highest ROI per rupee spent."
  • dashboard_title: punchy, specific, 4-6 words. Not generic.
    BAD:  "Revenue Analysis Dashboard"
    GOOD: "Which Channels Drive the Most?"

━━━ OUTPUT — raw JSON only, no markdown ━━━
{
  "dashboard_title": "max 7 words",
  "summary": "one sentence",
  "is_followup": false,
  "cannot_answer": false,
  "cannot_answer_reason": "",
  "panels": [
    {
      "title": "Panel title",
      "chart_type": "Bar",
      "chart_reasoning": "why this chart fits",
      "sql": "SELECT … FROM data_table …",
      "x_axis": "col_name",
      "y_axis": "col_name",
      "insight": "one-sentence observation"
    }
  ]
}\
"""


async def get_ai_dashboard(
    question: str,
    columns:  list[str],
    schema:   str,
    history:  list[dict],
) -> dict:

    if not columns:
        raise ValueError("No data loaded — upload a CSV first.")

    key = _cache_key(question, columns, _hist_sig(history))
    with _lock:
        if key in _cache:
            print(f"[cache] HIT: '{question[:55]}'")
            return _cache[key]

    # ── RAG: retrieve actual column values from DB ─────────────────────────────
    try:
        from rag import build_rag_context
        rag_block = build_rag_context(question, columns)
        print(f"[rag] context built for: '{question[:50]}'")
    except Exception as e:
        rag_block = ""
        print(f"[rag] skipped: {e}")

    # Build history block — include last 6 messages (3 turns) with SQL context
    history_block = ""
    if history:
        history_block = "━━━ CONVERSATION HISTORY (use for follow-up context) ━━━\n"
        for m in history[-6:]:
            role    = "User" if m["role"] == "user" else "Assistant"
            content = str(m["content"])[:350]
            history_block += f"{role}: {content}\n"
        history_block += "━━━ END HISTORY ━━━\n"

    # Use replace() — schema/history may contain { } braces that break .format()
    prompt = _PROMPT \
        .replace("{schema}",        schema) \
        .replace("{rag_block}",     rag_block) \
        .replace("{history_block}", history_block) \
        .replace("{question}",      question)

    await _bucket.acquire()

    model    = WORKING_MODEL
    last_err = None

    for attempt in range(3):
        try:
            # Round-robin between API keys on every attempt
            active_client = _next_client()
            key_idx = _clients.index(active_client) + 1
            print(f"[gemini] key{key_idx} · {model} · attempt {attempt+1} — '{question[:50]}'")

            response = await asyncio.to_thread(
                active_client.models.generate_content,
                model=model,
                contents=prompt,
            )

            raw   = response.text.strip()
            clean = re.sub(r"```(?:json)?|```", "", raw).strip()

            m = re.search(r'\{.*\}', clean, re.DOTALL)
            if not m:
                raise ValueError(f"No JSON in response: {raw[:200]}")

            parsed = json.loads(m.group())

            # Hallucination guard
            if parsed.get("cannot_answer"):
                return {
                    "dashboard_title": "", "summary": "", "panels": [],
                    "is_followup": False,
                    "cannot_answer": True,
                    "cannot_answer_reason": parsed.get("cannot_answer_reason", "Data not available."),
                }

            if "panels" not in parsed or not isinstance(parsed["panels"], list):
                raise ValueError(f"Missing panels key: {list(parsed.keys())}")

            parsed["panels"] = parsed["panels"][:3]

            for i, p in enumerate(parsed["panels"]):
                p.setdefault("chart_type",     "Bar")
                p.setdefault("chart_reasoning","")
                p.setdefault("insight",        "")
                sql = p.get("sql", "").strip()
                if not sql or not sql.upper().lstrip().startswith("SELECT"):
                    raise ValueError(f"Panel {i} has no valid SELECT.")
                for f in FORBIDDEN_SQL:
                    if re.search(rf'\b{f}\b', sql.upper()):
                        raise ValueError(f"Panel {i} contains forbidden keyword: {f}")

            parsed.setdefault("cannot_answer", False)
            parsed.setdefault("cannot_answer_reason", "")
            parsed.setdefault("is_followup", False)
            # Build TL;DR bullets from panel insights
            tldr = []
            emojis = ["📊","💡","🎯","📈","⚡"]
            for idx_p, p in enumerate(parsed["panels"]):
                if p.get("insight"):
                    tldr.append({"emoji": emojis[idx_p % len(emojis)], "text": p["insight"]})
            parsed["tldr"] = tldr

            with _lock:
                _cache[key] = parsed
                _save_cache()
            print(f"[cache] SAVED: '{question[:55]}'")
            return parsed

        except errors.ClientError as e:
            last_err = e
            msg = str(e)
            if ("404" in msg or "not found" in msg.lower()) and model != FALLBACK_MODEL:
                print(f"[gemini] switching to {FALLBACK_MODEL}")
                model = FALLBACK_MODEL; continue
            if "429" in msg and attempt < 2:
                # Switch to other key immediately on 429 instead of waiting 65s
                if len(_clients) > 1:
                    print(f"[gemini] 429 on key{_clients.index(active_client)+1} — switching key immediately")
                    await asyncio.sleep(3)   # tiny pause then retry with other key
                else:
                    wait = 20 * (attempt + 1)   # shorter wait: 20s, 40s
                    print(f"[gemini] 429 — waiting {wait}s …")
                    await asyncio.sleep(wait)
                await _bucket.acquire(); continue
            raise

        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON from Gemini: {e}\nRaw: {raw[:300]!r}")

    raise last_err or RuntimeError("All retries exhausted.")


# ── Auto-Analysis ─────────────────────────────────────────────────────────────
_AUTO_PROMPT = """\
You are a senior data analyst. A new CSV was just uploaded with this schema:
{schema}
Columns: {columns}

Generate exactly 3 smart, distinct, business-relevant questions that reveal the most
interesting patterns: e.g. one trend, one ranking, one breakdown.
Answer each question yourself using the VISUALIZATION DECISION TREE rules below.

RULES:
- Questions must only use available columns.
- Keep questions under 12 words, natural language.
- Each result must have exactly 1 panel.
- SQL: SELECT only from data_table, use exact column names, ROUND floats, LIMIT 20.
- Chart types: Bar | Line | Pie | KPI | Scatter | Table | Area | HorizontalBar

Respond ONLY with raw JSON (no markdown fences):
{
  "insights": [
    {
      "question": "short natural question",
      "result": {
        "dashboard_title": "short title",
        "summary": "one sentence",
        "is_followup": false,
        "cannot_answer": false,
        "cannot_answer_reason": "",
        "panels": [{
          "title": "panel title",
          "chart_type": "Bar",
          "chart_reasoning": "why this chart",
          "sql": "SELECT ... FROM data_table ...",
          "x_axis": "col",
          "y_axis": "col",
          "insight": "one observation"
        }]
      }
    }
  ]
}\
"""

async def get_auto_analysis(columns: list[str], schema: str) -> list[dict]:
    """Called once after upload — returns 3 proactive insight dashboards."""
    await asyncio.sleep(20)  # wait so user's first /ask always gets priority over auto-analyze
    # Use replace() — schema may contain { } braces that break .format()
    prompt = _AUTO_PROMPT \
        .replace("{schema}",  schema) \
        .replace("{columns}", ", ".join(columns))
    await _bucket.acquire()
    model = WORKING_MODEL
    for attempt in range(3):
        try:
            print(f"[auto-analysis] {model} attempt {attempt+1}")
            response = await asyncio.to_thread(
                client.models.generate_content, model=model, contents=prompt,
            )
            raw   = response.text.strip()
            clean = re.sub(r"```(?:json)?|```", "", raw).strip()
            m = re.search(r'\{.*\}', clean, re.DOTALL)
            if not m:
                raise ValueError(f"No JSON in auto-analysis response")
            parsed = json.loads(m.group())
            insights = parsed.get("insights", [])
            # Validate each insight has panels with real SQL
            valid = []
            for item in insights:
                result = item.get("result", {})
                panels = result.get("panels", [])
                if panels and panels[0].get("sql", "").upper().startswith("SELECT"):
                    valid.append(item)
            return valid[:3]
        except errors.ClientError as e:
            msg = str(e)
            if "429" in msg:
                print(f"[auto-analysis] rate limited — skipping, user can still ask questions")
                return []   # silently skip, don't retry, don't block
            if ("404" in msg or "not found" in msg.lower()) and model != FALLBACK_MODEL:
                model = FALLBACK_MODEL; continue
            raise
        except Exception as e:
            print(f"[auto-analysis] error: {e}")
            if attempt == 2: return []
            await asyncio.sleep(2)
    return []


# ── Why did this happen? ──────────────────────────────────────────────────────
_WHY_PROMPT = """\
You are a senior business analyst explaining data to an executive.

A dashboard panel titled "{panel_title}" ({chart_type} chart) was just generated.
SQL used: {sql}
AI insight on it: {insight}

Here is a sample of the data it returned:
{data_sample}

Dataset schema for context:
{schema}

In 3-5 sentences of clear, confident business language, explain:
1. WHY this pattern exists (root cause)
2. WHAT business factors likely drove it
3. WHAT action a business might take in response

Be specific, not generic. Use the actual column names and values from the data sample.
Do NOT start with "Based on the data" or similar. Just give the direct explanation.
"""

async def get_why_explanation(
    panel_title: str,
    chart_type:  str,
    sql:         str,
    insight:     str,
    data_sample: list,
    schema:      str,
) -> str:
    import json as _json
    sample_str = _json.dumps(data_sample[:8], indent=2)

    # Use replace() instead of .format() — schema may contain { } braces that break format
    prompt = _WHY_PROMPT \
        .replace("{panel_title}", panel_title or "Chart") \
        .replace("{chart_type}",  chart_type  or "Bar") \
        .replace("{sql}",         sql         or "(none)") \
        .replace("{insight}",     insight     or "(none)") \
        .replace("{data_sample}", sample_str) \
        .replace("{schema}",      schema      or "(none)")
    await _bucket.acquire()
    model = WORKING_MODEL
    for attempt in range(3):
        try:
            response = await asyncio.to_thread(
                client.models.generate_content, model=model, contents=prompt,
            )
            return response.text.strip()
        except errors.ClientError as e:
            msg = str(e)
            if ("404" in msg or "not found" in msg.lower()) and model != FALLBACK_MODEL:
                model = FALLBACK_MODEL; continue
            if "429" in msg and attempt < 2:
                await asyncio.sleep(30 * (attempt + 1))
                await _bucket.acquire(); continue
            raise
        except Exception as e:
            if attempt == 2:
                return "Could not generate explanation at this time."
            await asyncio.sleep(2)
    return "Could not generate explanation at this time."