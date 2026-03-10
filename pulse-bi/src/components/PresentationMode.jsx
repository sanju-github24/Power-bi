// PresentationMode.jsx — Full screen dashboard overlay for demo day
import React, { useEffect } from 'react'
import ChartPanel from './ChartPanel.jsx'

export default function PresentationMode({ result, onExit }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape' || e.key === 'F5') onExit()
    }
    window.addEventListener('keydown', handleKey)
    // Try native fullscreen
    document.documentElement.requestFullscreen?.().catch(() => {})
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.exitFullscreen?.().catch(() => {})
    }
  }, [onExit])

  if (!result?.panels?.length) return null
  const n = result.panels.length

  return (
    <div style={s.overlay}>
      {/* Header bar */}
      <div style={s.bar}>
        <div style={s.brand}>Pulse BI</div>
        <div style={s.pTitle}>{result.dashboard_title}</div>
        <button style={s.exitBtn} onClick={onExit}>✕ Exit  <kbd style={s.kbd}>Esc</kbd></button>
      </div>

      {/* Summary */}
      {result.summary && (
        <div style={s.summary}>{result.summary}</div>
      )}

      {/* Panels grid — bigger in presentation mode */}
      <div style={{ ...s.grid, gridTemplateColumns: n >= 3 ? '1fr 1fr 1fr' : n === 2 ? '1fr 1fr' : '1fr' }}>
        {result.panels.map((panel, i) => (
          <div key={i} style={s.panelWrap}>
            <ChartPanel panel={panel} idx={i} isFollowup={false} />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={s.footer}>
        <span style={s.footerText}>Press Esc to exit · Pulse BI</span>
      </div>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg)', display: 'flex', flexDirection: 'column', padding: '1.5rem 2rem', overflow: 'auto' },
  bar:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.75rem', flexShrink: 0 },
  brand:   { fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1rem', background: 'linear-gradient(90deg,var(--accent),var(--accent2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' },
  pTitle:  { fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1.3rem', color: 'var(--text)' },
  exitBtn: { background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted2)', fontSize: '.75rem', fontFamily: "'JetBrains Mono',monospace", padding: '.35rem .75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.4rem' },
  kbd:     { background: 'var(--s3)', border: '1px solid var(--border2)', borderRadius: 3, padding: '.05rem .3rem', fontSize: '.76rem' },
  summary: { fontSize: '.85rem', color: 'var(--muted2)', marginBottom: '1rem', lineHeight: 1.6, flexShrink: 0 },
  grid:    { display: 'grid', gap: '1.1rem', flex: 1 },
  panelWrap:{ transform: 'scale(1)', transformOrigin: 'top left' },
  footer:  { marginTop: '1rem', textAlign: 'center', flexShrink: 0 },
  footerText:{ fontSize: '.76rem', fontFamily: "'JetBrains Mono',monospace", color: 'var(--muted)' },
}
