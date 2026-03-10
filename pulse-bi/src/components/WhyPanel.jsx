// WhyPanel.jsx — Root cause explanation via Gemini
import React, { useState } from 'react'

const SparkleIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"
      fill="currentColor"/>
  </svg>
)

export default function WhyPanel({ panel, sessionId }) {
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [answer,  setAnswer]  = useState(null)

  async function fetchWhy() {
    if (answer) { setOpen(o => !o); return }
    setOpen(true)
    setLoading(true)
    try {
      const r = await fetch('/api/why', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panel_title:  panel.title,
          chart_type:   panel.chart_type,
          sql:          panel.sql,
          insight:      panel.insight,
          data_sample:  (panel.data || []).slice(0, 10),
          session_id:   sessionId,
        }),
        signal: AbortSignal.timeout(45000),
      })
      const d = await r.json()
      setAnswer(d.explanation || 'No explanation available.')
    } catch (e) {
      setAnswer('Could not generate explanation. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.wrap}>
      <button style={s.trigger} onClick={fetchWhy}>
        <SparkleIcon />
        <span>Why did this happen?</span>
        <span style={s.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={s.panel}>
          {loading ? (
            <div style={s.loading}>
              <div style={s.shimmer} />
              <div style={{...s.shimmer, width:'75%'}} />
              <div style={{...s.shimmer, width:'60%'}} />
            </div>
          ) : (
            <div style={s.text}>{answer}</div>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  wrap:    { borderTop: '1px solid rgba(255,255,255,.05)' },
  trigger: {
    width: '100%', display: 'flex', alignItems: 'center', gap: '.4rem',
    background: 'none', border: 'none',
    padding: '.45rem .95rem',
    color: 'rgba(180,142,255,.8)',
    fontSize: '.78rem', fontFamily: "'JetBrains Mono', monospace",
    cursor: 'pointer',
    transition: 'background .15s',
  },
  chevron: { marginLeft: 'auto', fontSize: '.72rem', color: 'var(--muted)' },
  panel:   {
    padding: '.75rem .95rem .75rem',
    background: 'rgba(180,142,255,.04)',
    borderTop: '1px solid rgba(180,142,255,.1)',
  },
  loading: { display: 'flex', flexDirection: 'column', gap: '.45rem' },
  shimmer: {
    height: 10, borderRadius: 5,
    background: 'linear-gradient(90deg,var(--s3) 25%,var(--s2) 50%,var(--s3) 75%)',
    backgroundSize: '200%',
    animation: 'sweep 1.2s linear infinite',
    width: '90%',
  },
  text: {
    fontSize: '.77rem', color: '#b8c8dc',
    lineHeight: 1.7, fontFamily: "'Figtree', sans-serif",
  },
}
