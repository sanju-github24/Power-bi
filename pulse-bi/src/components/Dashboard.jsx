// Dashboard.jsx — full grid with PDF export, share link, TL;DR, speed
import React from 'react'
import ChartPanel  from './ChartPanel.jsx'
import PDFExport   from './PDFExport.jsx'

const ShareIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.8"/>
    <circle cx="6"  cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
    <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

export default function Dashboard({ result, onPresent, onShare, csvInfo, queryMs, sessionId }) {
  if (!result) {
    return (
      <div style={s.empty}>
        <div style={s.emptyIcon}>📊</div>
        <h3 style={s.emptyTitle}>Upload a CSV to begin</h3>
        <p style={s.emptyText}>Drag any CSV onto the sidebar, then ask questions in plain English to build your dashboard.</p>
      </div>
    )
  }

  if (result.cannot_answer) {
    return (
      <div style={s.cannotAnswer}>
        <span style={{fontSize:'1.1rem'}}>🤔</span>
        <div>
          <div style={s.caTitle}>Cannot answer with available data</div>
          <div style={s.caReason}>{result.cannot_answer_reason}</div>
        </div>
      </div>
    )
  }

  const panels = result.panels || []
  const n      = panels.length
  const tldr   = result.tldr || []

  const cols = n >= 3 ? '1fr 1fr 1fr' : n === 2 ? '1fr 1fr' : '1fr'

  return (
    <div style={s.wrap}>

      {/* Follow-up pill */}
      {result.is_followup && (
        <div style={s.fuBanner}>↩ follow-up — dashboard updated</div>
      )}

      {/* Header */}
      <div style={s.headerRow}>
        <div style={s.headerText}>
          <div style={s.title}>{result.dashboard_title}</div>
          {result.summary && <div style={s.summary}>{result.summary}</div>}
          {queryMs != null && (
            <div style={s.querySpeed}>⚡ answered in {queryMs < 1000 ? `${queryMs}ms` : `${(queryMs/1000).toFixed(1)}s`}</div>
          )}
        </div>
        <div style={s.headerActions}>
          <PDFExport result={result} csvInfo={csvInfo} />
          <button style={s.shareBtn} onClick={onShare} title="Copy shareable link">
            <ShareIcon />
            <span>Share</span>
          </button>
          <button style={s.presentBtn} onClick={onPresent} title="Presentation mode (Esc to exit)">
            ⛶ Present
          </button>
        </div>
      </div>

      {/* TL;DR summary */}
      {tldr.length > 0 && <TLDRCard items={tldr} />}

      {/* Chart grid */}
      <div style={{ ...s.grid, gridTemplateColumns: cols }}>
        {panels.map((panel, i) => (
          <ChartPanel
            key={i}
            panel={panel}
            idx={i}
            isFollowup={result.is_followup}
            queryMs={i === 0 ? queryMs : null}
            sessionId={sessionId}
          />
        ))}
      </div>
    </div>
  )
}

function TLDRCard({ items }) {
  return (
    <div style={s.tldr}>
      <div style={s.tldrHead}>
        <span style={s.tldrIcon}>✦</span>
        <span style={s.tldrLabel}>AI Analyst Summary</span>
      </div>
      <div style={s.tldrItems}>
        {items.map((item, i) => (
          <div key={i} style={s.tldrItem}>
            <span style={s.tldrBullet}>{item.emoji || '•'}</span>
            <span style={s.tldrText}>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const s = {
  empty:        { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:'.7rem', color:'var(--muted2)', textAlign:'center', padding:'2rem' },
  emptyIcon:    { fontSize:'2.8rem', opacity:.2 },
  emptyTitle:   { fontFamily:"'Syne',sans-serif", color:'var(--muted2)', fontSize:'.95rem' },
  emptyText:    { fontSize:'.78rem', lineHeight:1.65, maxWidth:280 },
  cannotAnswer: { display:'flex', alignItems:'flex-start', gap:'.76rem', padding:'1.1rem', margin:'1.1rem', background:'rgba(255,107,107,.05)', border:'1px solid rgba(255,107,107,.18)', borderRadius:11 },
  caTitle:      { fontFamily:"'Syne',sans-serif", fontWeight:700, color:'var(--accent3)', marginBottom:'.25rem' },
  caReason:     { fontSize:'.78rem', color:'var(--muted2)', lineHeight:1.55 },
  fuBanner:     { display:'inline-flex', alignItems:'center', gap:'.45rem', marginBottom:'.8rem', fontSize:'.78rem', fontFamily:"'JetBrains Mono',monospace", background:'rgba(180,142,255,.07)', color:'var(--accent4)', border:'1px solid rgba(180,142,255,.18)', borderRadius:999, padding:'.26rem .72rem' },
  wrap:         { animation:'fadeUp .4s ease both' },
  headerRow:    { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'1rem', gap:'1rem', flexWrap:'wrap' },
  headerText:   { flex:1, minWidth:0 },
  title:        { fontFamily:"'Syne',sans-serif", fontSize:'1.2rem', fontWeight:800, letterSpacing:'-.025em', marginBottom:'.3rem', color:'var(--text)', lineHeight:1.25 },
  summary:      { fontSize:'.78rem', color:'#8896b0', lineHeight:1.6, maxWidth:600, marginBottom:'.3rem' },
  querySpeed:   { fontSize:'.75rem', fontFamily:"'JetBrains Mono',monospace", color:'rgba(74,222,128,.7)' },
  headerActions:{ display:'flex', alignItems:'center', gap:'.5rem', flexShrink:0, flexWrap:'wrap' },
  shareBtn:     { display:'flex', alignItems:'center', gap:'.35rem', background:'rgba(0,212,255,.07)', border:'1px solid rgba(0,212,255,.2)', borderRadius:8, color:'rgba(0,212,255,.8)', fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'.7rem', padding:'.38rem .8rem', cursor:'pointer', letterSpacing:'.04em' },
  presentBtn:   { background:'var(--s2)', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, color:'rgba(232,255,71,.8)', fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'.7rem', padding:'.38rem .8rem', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, letterSpacing:'.04em' },
  grid:         { display:'grid', gap:'1rem' },
  tldr:         { background:'rgba(232,255,71,.04)', border:'1px solid rgba(232,255,71,.12)', borderRadius:12, padding:'.8rem 1.05rem', marginBottom:'1rem' },
  tldrHead:     { display:'flex', alignItems:'center', gap:'.4rem', marginBottom:'.72rem' },
  tldrIcon:     { fontSize:'.85rem', color:'var(--accent)' },
  tldrLabel:    { fontSize:'.75rem', fontFamily:"'JetBrains Mono',monospace", textTransform:'uppercase', letterSpacing:'.14em', color:'rgba(232,255,71,.7)' },
  tldrItems:    { display:'flex', flexDirection:'column', gap:'.35rem' },
  tldrItem:     { display:'flex', alignItems:'flex-start', gap:'.72rem' },
  tldrBullet:   { fontSize:'.75rem', flexShrink:0, marginTop:'.06rem' },
  tldrText:     { fontSize:'.77rem', color:'#b0bdd0', lineHeight:1.55 },
}
