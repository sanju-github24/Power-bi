// App.jsx — All features: Auto-Analyst, Anomalies, Voice, Pin, PNG, TL;DR,
//           Keyboard shortcuts, Presentation, KPI Trend, PDF Export, Share URL,
//           Why Panel, Confidence Score, Query Speed, Smart Alert Thresholds
import React, { useState, useCallback, useRef, useEffect } from 'react'
import Topbar             from './components/Topbar.jsx'
import UploadZone         from './components/UploadZone.jsx'
import ColumnPills        from './components/ColumnPills.jsx'
import ChatHistory        from './components/ChatHistory.jsx'
import InputBar           from './components/InputBar.jsx'
import Dashboard          from './components/Dashboard.jsx'
import ErrorToast         from './components/ErrorToast.jsx'
import AutoAnalystPanel   from './components/AutoAnalystPanel.jsx'
import AnomalyPanel       from './components/AnomalyPanel.jsx'
import PinnedDashboards   from './components/PinnedDashboards.jsx'
import PresentationMode   from './components/PresentationMode.jsx'
import AlertThresholds    from './components/AlertThresholds.jsx'
import SuggestedQuestions from './components/SuggestedQuestions.jsx'
import { useShareableUrl } from './hooks/useShareableUrl.js'
import {
  apiHealth, apiUpload, apiAsk,
  apiAutoAnalyze, apiAnomalies, apiClearHistory,
  RateLimitError,
} from './hooks/useApi.js'

const SESSION_ID = 's_' + Math.random().toString(36).slice(2, 9)

export default function App() {
  const [serverStatus,  setServerStatus]  = useState('connecting')
  const [rowCount,      setRowCount]      = useState(0)
  const [csvInfo,       setCsvInfo]       = useState(null)
  const [columns,       setColumns]       = useState([])

  const [chatHistory,   setChatHistory]   = useState([])
  const [questionLog,   setQuestionLog]   = useState([])
  const [activeTurnIdx, setActiveTurnIdx] = useState(null)

  const [dashResult,    setDashResult]    = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)
  const [queryMs,       setQueryMs]       = useState(null)

  const [autoInsights,  setAutoInsights]  = useState([])
  const [autoLoading,   setAutoLoading]   = useState(false)
  const insightsDismissed = useRef(false)   // once dismissed, never restore from poll
  const [anomalies,     setAnomalies]     = useState([])
  const [anomLoading,   setAnomLoading]   = useState(false)
  const [pins,          setPins]          = useState([])
  const [presenting,    setPresenting]    = useState(false)
  const [toast,         setToast]         = useState(null)

  const alertRef = useRef(null)

  // ── Shareable URL (restores dashboard from URL hash on load) ────────────────
  const { copyLink } = useShareableUrl(dashResult, setDashResult)

  // ── Health polling ──────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    try {
      const d = await apiHealth()
      setServerStatus('online')
      setRowCount(d.row_count || 0)

      // CSV already loaded (default Nykaa on backend start)
      if (d.csv_loaded && d.filename) {
        if (!csvInfo) {
          setCsvInfo({ filename: d.filename, rowCount: d.row_count, colCount: (d.columns||[]).length })
          setColumns(d.columns || [])
        }
        // Load cached insights + anomalies from health response
        if (d.cache_ready) {
          if (d.insights?.length > 0 && autoInsights.length === 0 && !insightsDismissed.current)
            setAutoInsights(d.insights)
          if (d.anomalies?.length > 0 && anomalies.length === 0) {
            setAnomalies(d.anomalies)
            window.__pulseAnomalies = d.anomalies
          }
          setAutoLoading(false)
          setAnomLoading(false)
        } else if (d.csv_loaded && autoInsights.length === 0) {
          // Still computing — show loading spinners
          setAutoLoading(true)
          setAnomLoading(true)
        }
      }
    } catch { setServerStatus('error') }
  }, [csvInfo, autoInsights.length, anomalies.length])

  useEffect(() => {
    poll()
    // Poll every 3s until insights load, then slow to 15s
    const t = setInterval(() => {
      poll()
    }, autoInsights.length === 0 ? 3000 : 15000)
    return () => clearInterval(t)
  }, [poll, autoInsights.length])

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file, setProgress) => {
    try {
      const d = await apiUpload(file)
      setProgress(true)
      setCsvInfo({ filename: file.name, rowCount: d.row_count, colCount: d.columns.length })
      setColumns(d.columns)
      setChatHistory([]); setQuestionLog([]); setActiveTurnIdx(null)
      setDashResult(null); setAutoInsights([]); setAnomalies([]); setQueryMs(null)
      insightsDismissed.current = false   // reset for new CSV
      poll()

      // Fire both background tasks simultaneously
      setAutoLoading(true)
      setAnomLoading(true)

      apiAutoAnalyze()
        .then(r => setAutoInsights(r.insights || []))
        .catch(() => {})
        .finally(() => setAutoLoading(false))

      apiAnomalies()
        .then(r => {
          setAnomalies(r.anomalies || [])
          // Expose to PDF export
          window.__pulseAnomalies = r.anomalies || []
        })
        .catch(() => {})
        .finally(() => setAnomLoading(false))

    } catch (err) {
      setProgress(false)
      setError({ title: 'Upload failed', message: err.message })
    }
  }, [poll])

  // ── Ask ─────────────────────────────────────────────────────────────────────
  const handleAsk = useCallback(async (question) => {
    setAutoInsights([])   // dismiss auto-analyst on first question
    insightsDismissed.current = true
    setLoading(true)
    setServerStatus('busy')
    setQueryMs(null)
    const t0 = Date.now()
    setChatHistory(prev => [...prev, { role: 'user', content: question }])

    try {
      const d = await apiAsk(question, SESSION_ID)
      const ms = Date.now() - t0
      setQueryMs(ms)

      if (d.cannot_answer) {
        setDashResult({ cannot_answer: true, cannot_answer_reason: d.cannot_answer_reason })
        setChatHistory(prev => [...prev, {
          role: 'ai', content: '⚠ ' + (d.cannot_answer_reason || 'Cannot answer'), isFollowup: false,
        }])
        setQuestionLog(prev => [...prev, { question, response: null }])
      } else {
        setDashResult(d)
        setChatHistory(prev => [...prev, {
          role: 'ai', content: '📊 ' + d.dashboard_title, isFollowup: d.is_followup,
        }])
        const newLog = [...questionLog, { question, response: d }]
        setQuestionLog(newLog)
        setActiveTurnIdx(newLog.length - 1)

        // Check smart alert thresholds against new data
        if (AlertThresholds.check) AlertThresholds.check(d.panels || [])
      }
    } catch (err) {
      setChatHistory(prev => prev.slice(0, -1))
      if (err instanceof RateLimitError)
        setError({ title: 'Rate limit hit', message: 'Gemini quota reached. Wait ~60s and retry.' })
      else if (err.name === 'TimeoutError')
        setError({ title: 'Timed out', message: 'No response in 90s. Is the backend running?' })
      else if (err.name === 'TypeError')
        setError({ title: 'Cannot connect', message: 'Run: uvicorn main:app --reload --port 8000' })
      else
        setError({ title: 'Error', message: err.message })
    } finally {
      setLoading(false)
      poll()
    }
  }, [questionLog, poll])

  // ── Load auto-insight as dashboard ──────────────────────────────────────────
  const handleLoadAutoInsight = useCallback((item) => {
    setDashResult(item.result)
    const newLog = [...questionLog, { question: item.question, response: item.result }]
    setQuestionLog(newLog)
    setActiveTurnIdx(newLog.length - 1)
    setChatHistory(prev => [
      ...prev,
      { role: 'user', content: item.question },
      { role: 'ai',   content: '📊 ' + item.result.dashboard_title, isFollowup: false },
    ])
  }, [questionLog])

  // ── Replay history turn ──────────────────────────────────────────────────────
  const handleReplay = useCallback((idx) => {
    const item = questionLog[idx]
    if (!item?.response) return
    setDashResult(item.response)
    setActiveTurnIdx(idx)
  }, [questionLog])

  // ── Pin dashboard ────────────────────────────────────────────────────────────
  const handlePin = useCallback(() => {
    if (!dashResult || dashResult.cannot_answer) return
    const pin = {
      id:         Date.now(),
      title:      dashResult.dashboard_title || 'Dashboard',
      panelCount: (dashResult.panels || []).length,
      time:       new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      result:     dashResult,
    }
    setPins(prev => [pin, ...prev].slice(0, 8))
    showToast('📌 Dashboard pinned')
  }, [dashResult])

  // ── Share dashboard link ─────────────────────────────────────────────────────
  const handleShare = useCallback(() => {
    copyLink()
    showToast('🔗 Link copied to clipboard!')
  }, [copyLink])

  // ── Toast helper ─────────────────────────────────────────────────────────────
  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

  // ── Clear session ────────────────────────────────────────────────────────────
  const handleClear = useCallback(async () => {
    await apiClearHistory(SESSION_ID)
    setChatHistory([]); setQuestionLog([]); setActiveTurnIdx(null)
    setDashResult(null); setQueryMs(null)
  }, [])

  return (
    <div style={s.root}>
      <Topbar
        status={loading ? 'busy' : serverStatus}
        rowCount={rowCount}
        filename={csvInfo?.filename}
      />

      <div style={s.layout}>
        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside style={s.sidebar}>
          <UploadZone onFile={handleFile} csvInfo={csvInfo} />
          <ColumnPills columns={columns} />

          {/* Section: Smart Alerts */}
          <div style={s.sideSection}>
            <div style={s.sideSectionLabel}>🔔 SMART ALERTS</div>
            <AlertThresholds onAskAlert={q => handleAsk(q)} />
          </div>

          {/* Section: Anomaly Detection */}
          {(anomalies.length > 0 || anomLoading) && (
            <div style={s.sideSection}>
              <div style={s.sideSectionLabel}>🔍 ANOMALY DETECTION</div>
              <AnomalyPanel
                anomalies={anomalies}
                loading={anomLoading}
                onAskAnomaly={q => handleAsk(q)}
              />
            </div>
          )}

          {/* Section: Pinned Dashboards */}
          {pins.length > 0 && (
            <div style={s.sideSection}>
              <div style={s.sideSectionLabel}>📌 PINNED DASHBOARDS</div>
              <PinnedDashboards
                pins={pins}
                onLoad={p => setDashResult(p.result)}
                onDelete={id => setPins(prev => prev.filter(p => p.id !== id))}
              />
            </div>
          )}

          {/* Section: Chat History */}
          <div style={s.sideSection}>
            <div style={s.sideSectionLabel}>💬 CHAT HISTORY</div>
            <ChatHistory
              history={chatHistory}
              activeTurnIdx={activeTurnIdx}
              onReplay={handleReplay}
              onClear={handleClear}
            />
          </div>
        </aside>

        {/* ── Main ─────────────────────────────────────────────────────── */}
        <main style={s.main}>
          <InputBar
            onAsk={handleAsk}
            onPin={handlePin}
            onTyping={() => { setAutoInsights([]); insightsDismissed.current = true }}
            loading={loading}
            columns={columns}
            hasDashboard={!!dashResult && !dashResult.cannot_answer}
          />
          <div style={s.dashScroll}>
            {(autoInsights.length > 0 || autoLoading) && (
              <AutoAnalystPanel
                insights={autoInsights}
                loading={autoLoading}
                onLoadDashboard={handleLoadAutoInsight}
              />
            )}
            <Dashboard
              result={dashResult}
              onPresent={() => setPresenting(true)}
              onShare={handleShare}
              csvInfo={csvInfo}
              queryMs={queryMs}
              sessionId={SESSION_ID}
            />
            <SuggestedQuestions
              result={dashResult}
              onAsk={q => { insightsDismissed.current = true; handleAsk(q) }}
              loading={loading}
            />
          </div>
        </main>
      </div>

      {presenting && (
        <PresentationMode
          result={dashResult}
          onExit={() => setPresenting(false)}
        />
      )}

      {/* Inline toast (separate from error) */}
      {toast && (
        <div style={s.toast}>{toast}</div>
      )}

      <ErrorToast error={error} onClose={() => setError(null)} />
    </div>
  )
}

const s = {
  root:      { height:'100%', display:'flex', flexDirection:'column', position:'relative', zIndex:1 },
  layout:    { display:'flex', flex:1, overflow:'hidden' },
  sidebar:   { width:285, flexShrink:0, background:'var(--s1)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', overflow:'hidden', overflowY:'auto' },
  main:      { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
  dashScroll:{ flex:1, overflowY:'auto', padding:'1.1rem' },
  sideSection: { borderTop:'1px solid var(--border)' },
  sideSectionLabel: {
    fontSize:'.62rem', fontFamily:"'JetBrains Mono',monospace",
    fontWeight:700, letterSpacing:'.1em',
    color:'var(--muted2)', padding:'.5rem .85rem .2rem',
    opacity:.7,
  },
  toast: {
    position:'fixed', bottom:'5.5rem', left:'50%', transform:'translateX(-50%)',
    background:'var(--s2)', border:'1px solid var(--border)',
    borderRadius:999, padding:'.45rem 1.1rem',
    fontSize:'.75rem', fontFamily:"'Syne',sans-serif", fontWeight:600,
    color:'var(--text)', zIndex:9998,
    boxShadow:'0 4px 24px rgba(0,0,0,.4)',
    animation:'fadeUp .3s ease both',
  },
}