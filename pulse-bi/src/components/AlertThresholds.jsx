// AlertThresholds.jsx — Plain-english alert rules stored + checked on every query
import React, { useState } from 'react'

const BellIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function AlertThresholds({ onAskAlert }) {
  const [alerts,  setAlerts]  = useState([])
  const [input,   setInput]   = useState('')
  const [open,    setOpen]    = useState(false)

  function addAlert() {
    const t = input.trim()
    if (!t) return
    const parsed = parseAlert(t)
    if (!parsed) {
      alert('Try: "Alert me if ROI drops below 3" or "Warn when Revenue exceeds 500000"')
      return
    }
    setAlerts(prev => [...prev, { id: Date.now(), raw: t, ...parsed, triggered: false }])
    setInput('')
  }

  // Check alerts against new dashboard data
  function checkAlerts(panels) {
    setAlerts(prev => prev.map(alert => {
      for (const panel of panels) {
        for (const row of (panel.data || [])) {
          const keys = Object.keys(row)
          for (const k of keys) {
            if (k.toLowerCase().includes(alert.metric.toLowerCase())) {
              const val = Number(row[k])
              if (!isNaN(val)) {
                const triggered =
                  (alert.op === '<'  && val < alert.threshold) ||
                  (alert.op === '>'  && val > alert.threshold) ||
                  (alert.op === '<=' && val <= alert.threshold) ||
                  (alert.op === '>=' && val >= alert.threshold)
                if (triggered) return { ...alert, triggered: true, triggerVal: val }
              }
            }
          }
        }
      }
      return { ...alert, triggered: false }
    }))
  }

  // Expose checkAlerts so parent can call it
  AlertThresholds.check = checkAlerts

  const triggered = alerts.filter(a => a.triggered)

  return (
    <div style={s.wrap}>
      <div style={s.header} onClick={() => setOpen(o => !o)}>
        <div style={s.label}>
          <BellIcon />
          <span>Alert Rules</span>
          {triggered.length > 0 && (
            <span style={s.trigBadge}>{triggered.length} triggered</span>
          )}
        </div>
        <span style={s.chevron}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Triggered alerts — always visible */}
      {triggered.map(a => (
        <div key={a.id} style={s.triggered}>
          🔔 <strong>{a.metric}</strong> is <strong>{a.triggerVal?.toLocaleString()}</strong>
          &nbsp;({a.op} {a.threshold})
          <button style={s.investigateBtn}
            onClick={() => onAskAlert(`Show detailed breakdown of ${a.metric} values`)}>
            Investigate →
          </button>
        </div>
      ))}

      {open && (
        <div style={s.body}>
          {/* Input row */}
          <div style={s.inputRow}>
            <input
              style={s.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAlert()}
              placeholder='e.g. "Alert if ROI drops below 3"'
            />
            <button style={s.addBtn} onClick={addAlert}>+</button>
          </div>
          <div style={s.hint}>Supports: drops below / exceeds / above / less than</div>

          {/* Alert list */}
          {alerts.map(a => (
            <div key={a.id} style={{ ...s.alertItem, ...(a.triggered ? s.alertTriggered : {}) }}>
              <span style={s.alertText}>{a.raw}</span>
              <button style={s.delBtn} onClick={() => setAlerts(p => p.filter(x => x.id !== a.id))}>✕</button>
            </div>
          ))}
          {!alerts.length && <div style={s.empty}>No alert rules yet</div>}
        </div>
      )}
    </div>
  )
}

// Parse plain English into {metric, op, threshold}
function parseAlert(text) {
  const t = text.toLowerCase()
  const patterns = [
    { re: /(\w[\w\s]+?)\s+(?:drops?|falls?|goes?|is)\s+below\s+([\d.]+)/i,      op: '<'  },
    { re: /(\w[\w\s]+?)\s+(?:less than|under)\s+([\d.]+)/i,                      op: '<'  },
    { re: /(\w[\w\s]+?)\s+(?:exceeds?|above|over|greater than|more than)\s+([\d.]+)/i, op: '>' },
    { re: /(?:alert|warn)\s+(?:me\s+)?(?:if|when)\s+(\w[\w\s]+?)\s+(?:is\s+)?(?:below|under)\s+([\d.]+)/i, op: '<' },
    { re: /(?:alert|warn)\s+(?:me\s+)?(?:if|when)\s+(\w[\w\s]+?)\s+(?:is\s+)?(?:above|over)\s+([\d.]+)/i,  op: '>' },
  ]
  for (const { re, op } of patterns) {
    const m = text.match(re)
    if (m) {
      const metric    = m[1].trim().replace(/\bif\b|\bwhen\b|\bme\b/g,'').trim()
      const threshold = parseFloat(m[2])
      if (!isNaN(threshold)) return { metric, op, threshold }
    }
  }
  return null
}

const s = {
  wrap:     { borderBottom: '1px solid var(--border)', flexShrink: 0 },
  header:   { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'.76rem .9rem', cursor:'pointer' },
  label:    { display:'flex', alignItems:'center', gap:'.4rem', fontSize:'.72rem', fontFamily:"'JetBrains Mono',monospace", textTransform:'uppercase', letterSpacing:'.13em', color:'var(--muted2)' },
  chevron:  { fontSize:'.72rem', color:'var(--muted2)' },
  trigBadge:{ background:'rgba(255,107,107,.18)', color:'#ff8a8a', fontSize:'.72rem', borderRadius:999, padding:'.05rem .35rem', fontWeight:700 },
  triggered:{ margin:'.0 .75rem .4rem', padding:'.45rem .75rem', background:'rgba(255,107,107,.07)', border:'1px solid rgba(255,107,107,.25)', borderRadius:7, fontSize:'.72rem', color:'#ff9a9a', display:'flex', alignItems:'center', gap:'.4rem', flexWrap:'wrap' },
  investigateBtn:{ marginLeft:'auto', background:'none', border:'1px solid rgba(255,107,107,.3)', borderRadius:5, color:'#ff8a8a', fontSize:'.75rem', padding:'.15rem .45rem', cursor:'pointer', fontFamily:"'JetBrains Mono',monospace", whiteSpace:'nowrap' },
  body:     { padding:'.0 .75rem .76rem' },
  inputRow: { display:'flex', gap:'.35rem', marginBottom:'.3rem' },
  input:    { flex:1, background:'var(--s3)', border:'1px solid var(--border2)', borderRadius:6, color:'var(--text)', fontFamily:"'Figtree',sans-serif", fontSize:'.72rem', padding:'.3rem .72rem', outline:'none' },
  addBtn:   { background:'var(--accent)', color:'#000', border:'none', borderRadius:6, width:28, fontWeight:700, fontSize:'.9rem', cursor:'pointer' },
  hint:     { fontSize:'.75rem', color:'var(--muted2)', fontFamily:"'JetBrains Mono',monospace", marginBottom:'.5rem', fontStyle:'italic' },
  alertItem:{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'.3rem .45rem', background:'var(--s3)', border:'1px solid var(--border)', borderRadius:6, marginBottom:'.25rem' },
  alertTriggered:{ borderColor:'rgba(255,107,107,.4)', background:'rgba(255,107,107,.06)' },
  alertText:{ fontSize:'.78rem', color:'var(--muted2)', fontFamily:"'JetBrains Mono',monospace" },
  delBtn:   { background:'none', border:'none', color:'var(--muted2)', fontSize:'.7rem', cursor:'pointer', padding:'.1rem .2rem' },
  empty:    { fontSize:'.76rem', color:'var(--muted2)', fontStyle:'italic', textAlign:'center', padding:'.4rem 0' },
}
