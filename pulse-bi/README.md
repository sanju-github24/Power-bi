# Pulse BI — React Frontend

Conversational BI dashboard. React + Vite frontend talking to FastAPI + Gemini backend.

## Project Structure

```
pulse-bi/               ← React frontend (this folder)
  src/
    App.jsx             ← Root component, all state lives here
    main.jsx            ← ReactDOM entry point
    index.css           ← CSS variables + keyframes
    hooks/
      useApi.js         ← All fetch() calls to FastAPI
    components/
      Topbar.jsx        ← Brand + server status pill
      UploadZone.jsx    ← Drag-and-drop CSV upload
      ColumnPills.jsx   ← Detected column type pills
      ChatHistory.jsx   ← Clickable turn replay sidebar
      InputBar.jsx      ← Question input + chips
      ChartPanel.jsx    ← All chart types (Bar/Line/Pie/KPI/Scatter/Table/Area)
      Dashboard.jsx     ← Grid layout of panels
      ErrorToast.jsx    ← Bottom-right error notification

main.py                 ← FastAPI backend
ai_engine.py            ← Gemini API calls
database.py             ← SQLite loader
```

## Prerequisites

- Node.js 18+
- Python 3.10+
- A Gemini API key in `.env`

## 1. Start the FastAPI backend

```bash
# In the root folder (where main.py lives)
pip install fastapi uvicorn pandas sqlalchemy google-genai python-dotenv python-multipart

# Create .env
echo "GEMINI_API_KEY=your_key_here" > .env

uvicorn main:app --reload --port 8000
```

## 2. Install and run the React frontend

```bash
cd pulse-bi
npm install
npm run dev
```

Open **http://localhost:5173**

The Vite dev server proxies `/api/*` → `http://127.0.0.1:8000/*` automatically,
so no CORS issues and no hardcoded ports in components.

## 3. Build for production

```bash
npm run build
# Outputs to pulse-bi/dist/
# Serve dist/ with any static host or: npm run preview
```

## How the proxy works

`vite.config.js` proxies all `/api` requests to FastAPI:

```js
proxy: {
  '/api': {
    target: 'http://127.0.0.1:8000',
    rewrite: path => path.replace(/^\/api/, '')
  }
}
```

So `fetch('/api/ask')` in React → `http://127.0.0.1:8000/ask` in FastAPI.

## Key differences from the HTML version

| Feature | HTML (`index.html`) | React (`pulse-bi/`) |
|---------|---------------------|---------------------|
| State management | Global `let` variables | `useState` / `useCallback` |
| Component split | Single 860-line file | 8 focused components |
| API calls | Inline `fetch()` | Centralized `useApi.js` |
| Chart cleanup | Manual `chart.destroy()` | `useEffect` return cleanup |
| Proxy | Hardcoded `http://127.0.0.1:8000` | Vite proxy (`/api`) |
| Hot reload | Manual refresh | HMR instant |
