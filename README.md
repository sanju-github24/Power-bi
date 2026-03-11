# Pulse BI ⚡

> **Conversational AI for Instant Business Intelligence Dashboards**

Pulse BI lets non-technical users generate fully interactive data dashboards using plain English. No SQL. No BI configuration. Just ask a question and get a dashboard in seconds.

Built for the **Conversational AI Hackathon** — powered by Google Gemini, RAG, and an Agentic Workflow pipeline.

---

## 🎥 Demo

> Ask: *"Give me a complete marketing performance analysis"*
> → AI plans 4 sub-queries → executes each → synthesizes a full dashboard automatically

---

## ✨ Features

### Core
- 💬 **Natural Language → Dashboard** — type any business question, get charts instantly
- 📊 **8 Smart Chart Types** — Bar, Line, Pie, Scatter, KPI, Area, Table, HorizontalBar with auto-selection
- ↩ **Follow-up Conversations** — chat with your dashboard ("now filter to only Paid Ads")
- 📁 **Upload Any CSV** — drag and drop any CSV file and start querying immediately

### AI Innovation
- 🧠 **RAG (Retrieval-Augmented Generation)** — retrieves exact column values from the database before generating SQL, eliminating wrong filters and hallucinated values
- 🤖 **Agentic Workflow** — for complex questions, AI plans multiple sub-queries, executes each independently, and synthesizes a multi-panel dashboard automatically
- 🎯 **Confidence Score** — every panel shows a reliability score (green/yellow/red)
- ❓ **Why Did This Happen?** — one-click AI root cause explanation per chart
- ✦ **AI Auto-Analyst** — proactive insights generated on startup before you type anything

### UX & Interactivity
- 🎤 **Voice Input** — speak your question using Web Speech API
- 💬 **Suggested Follow-up Questions** — 3 context-aware question pills after every answer
- 🔍 **Anomaly Detection** — IQR-based outlier scanning on all numeric columns
- 🔔 **Smart Alert Thresholds** — set plain English rules ("alert if ROI drops below 3")
- ⚡ **Query Speed Indicator** — response time shown on every dashboard
- 📈 **KPI Trend Indicators** — shows % change vs previous query

### Export & Share
- 📄 **PDF Export** — branded A4 report with charts and AI summary
- 🔗 **Shareable URL** — encode entire dashboard state as a URL hash
- 📌 **Pin & Compare** — save dashboard snapshots and compare across queries
- 🖥 **Presentation Mode** — fullscreen mode for projector demos
- 🖼 **PNG Chart Download** — download any individual chart

---

## 🏗 Architecture

```
User Question
      │
      ▼
┌─────────────────┐
│  Agentic Check  │  ← complex query? agent.py plans sub-questions
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   RAG Module    │  ← rag.py fetches exact column values from SQLite
│   (rag.py)      │    injects into Gemini prompt for accurate SQL
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Gemini AI API  │  ← schema + RAG context + history + question
│  Flash Lite     │    returns dashboard JSON with SQL queries
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SQL Execution  │  ← SQLite executes queries on uploaded CSV data
│  + Real Insight │    real insights generated from actual results
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  React Frontend │  ← Chart.js renders interactive dashboards
│  (Vite)         │    with zoom, tooltips, badges, voice, PDF
└─────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Charts | Chart.js + chartjs-plugin-zoom |
| Backend | Python FastAPI |
| AI | Google Gemini API (`gemini-2.5-flash-lite`) |
| Database | SQLite via SQLAlchemy |
| PDF Export | jsPDF + html2canvas |
| Voice | Web Speech API (browser native) |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- Google Gemini API key(s) — get free at [Google AI Studio](https://aistudio.google.com)

### 1. Clone the repo
```bash
git clone https://github.com/sanju-github24/Power-bi.git
cd Power-bi
```

### 2. Backend setup
```bash
# Install Python dependencies
pip install fastapi uvicorn sqlalchemy pandas python-dotenv google-genai

# Create .env file
cp .env.example .env
# Add your Gemini API key(s) to .env
```

### 3. Configure environment
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_API_KEY_2=your_second_key_here        # optional — enables 2x speed
CSV_PATH=/path/to/your/default.csv           # optional default dataset
```

### 4. Start the backend
```bash
uvicorn main:app --reload --port 8000
```

### 5. Frontend setup
```bash
cd pulse-bi
npm install
npm run dev
```

### 6. Open the app
```
http://localhost:5173
```

---

## 📂 Project Structure

```
Power-bi/
├── main.py              # FastAPI app — all endpoints
├── ai_engine.py         # Gemini API calls, caching, rate limiting, dual key rotation
├── rag.py               # RAG module — retrieves exact column values for accurate SQL
├── agent.py             # Agentic workflow — plan → execute → synthesize
├── database.py          # CSV loader, SQLite, schema builder
├── .env.example         # Environment variable template
└── pulse-bi/            # React frontend
    └── src/
        ├── App.jsx
        ├── components/
        │   ├── Dashboard.jsx
        │   ├── ChartPanel.jsx
        │   ├── InputBar.jsx
        │   ├── AutoAnalystPanel.jsx
        │   ├── AnomalyPanel.jsx
        │   ├── SuggestedQuestions.jsx
        │   ├── VoiceInput.jsx
        │   ├── WhyPanel.jsx
        │   ├── AlertThresholds.jsx
        │   ├── PresentationMode.jsx
        │   ├── PinnedDashboards.jsx
        │   └── PDFExport.jsx
        └── hooks/
            ├── useApi.js
            └── useShareableUrl.js
```

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Status + pre-computed insights + anomalies |
| `/upload` | POST | Upload any CSV file |
| `/ask` | POST | Natural language → dashboard JSON |
| `/auto-analyze` | GET | Generate 3 proactive AI insights |
| `/anomalies` | GET | IQR-based anomaly detection |
| `/why` | POST | Root cause explanation for a chart |
| `/schema` | GET | Current dataset schema |
| `/history/{id}` | GET/DELETE | Session chat history |

---

## 💡 Demo Queries to Try

**Simple:**
```
Show total revenue by campaign type
```

**Medium:**
```
Compare average ROI across languages and channels
```

**Complex (triggers Agentic Workflow):**
```
Give me a complete marketing performance analysis
```

**Follow-up:**
```
Now filter to only Paid Ads campaigns
```

**Anomaly investigation:**
```
Show me campaigns where ROI is greater than 10
```

---

## 🧠 How RAG Works

Without RAG, Gemini guesses column values:
```sql
WHERE Language = 'hindi'  -- wrong case → 0 rows returned
```

With RAG, Pulse BI retrieves exact values first:
```
Language → exact values: ["Hindi", "Tamil", "English", "Bengali"]
```
Gemini then writes:
```sql
WHERE Language = 'Hindi'  -- correct → real data returned
```

---

## 🤖 How Agentic Workflow Works

For complex questions like *"Give me a complete marketing performance analysis"*:

1. **PLAN** — Gemini breaks it into focused sub-questions
2. **EXECUTE** — each sub-question runs through RAG + SQL pipeline
3. **SYNTHESIZE** — all panels merged into one cohesive dashboard

```
[agent] plan: 4 sub-questions
  → "Show revenue by campaign type"
  → "Which channel has the highest ROI?"
  → "Monthly revenue trend over 2025"
  → "Top 10 campaigns by conversions"
[agent] ✓ synthesized 4 panels
```

---

## 📊 Evaluation Criteria Coverage

| Criteria | Points | Implementation |
|---|---|---|
| Data Retrieval Accuracy | 40 | RAG + exact SQL generation |
| Chart Selection | 40 | 8 types + decision tree prompt |
| Error Handling | 40 | cannot_answer flag + confidence score |
| Design & Aesthetics | 30 | Dark theme, Syne font, animations |
| Interactivity | 30 | Zoom, tooltips, voice, keyboard shortcuts |
| User Flow | 30 | Loading states, suggested questions |
| Architecture | 30 | React → FastAPI → Gemini → SQLite pipeline |
| Prompt Engineering + RAG | 30 | RAG module + decision tree |
| Agentic Workflow | 30 | agent.py plan → execute → synthesize |
| Follow-up Questions | +10 | Chat history with SQL context |
| Data Format Agnostic | +20 | Upload any CSV instantly |

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | Primary Gemini API key |
| `GEMINI_API_KEY_2` | Optional | Second key for 2x speed via rotation |
| `CSV_PATH` | Optional | Path to default CSV loaded on startup |

---

## 📄 License

MIT License — built for hackathon demonstration purposes.

---

<div align="center">
  Built with ❤️ using Google Gemini · FastAPI · React · Chart.js
</div>
