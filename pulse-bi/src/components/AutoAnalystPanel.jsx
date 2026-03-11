// AutoAnalystPanel.jsx — Proactive AI insights shown after CSV upload (compact strip)
import React, { useState } from 'react'

export default function AutoAnalystPanel({ insights, onLoadDashboard, loading }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  if (loading) return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.sparkle}>✦</span>
        <span style={s.title}>AI Analyst is scanning your data…</span>
        <div style={s.shimmer} />
      </div>
      <div style={s.row}>
        {[0,1,2].map(i => <div key={i} style={{...s.skeleton, animationDelay:`${i*0.15}s`}} />)}
      </div>
    </div>
  )

  if (!insights?.length) return null

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.sparkle}>✦</span>
          <div>
            <span style={s.title}>AI found {insights.length} insights</span>
            <span style={s.sub}> — click any to load instantly</span>
          </div>
        </div>
        <button style={s.dismissBtn} onClick={() => setDismissed(true)} title="Dismiss">✕</button>
      </div>

      {/* Compact horizontal cards */}
      <div style={s.row}>
        {insights.map((item, i) => {
          const panel = item.result?.panels?.[0]
          return (
            <div
              key={i}
              style={{...s.card, borderColor: COLORS[i % COLORS.length].border}}
              onClick={() => onLoadDashboard(item)}
            >
              <div style={s.cardNum(i)}>{i + 1}</div>
              <div style={s.cardContent}>
                <div style={s.question}>{item.question}</div>
                <div style={s.cardMeta}>
                  <span style={{...s.typeTag, color: COLORS[i%COLORS.length].text, borderColor: COLORS[i%COLORS.length].border}}>
                    {panel?.chart_type || 'Chart'}
                  </span>
                  <span style={s.loadHint}>Load →</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const COLORS = [
  { text:'#e8ff47', border:'rgba(232,255,71,.25)' },
  { text:'#00d4ff', border:'rgba(0,212,255,.25)' },
  { text:'#b48eff', border:'rgba(180,142,255,.25)' },
]

const s = {
  wrap:       { marginBottom: '1rem', animation: 'fadeUp .5s ease both' },
  header:     { display: 'flex', alignItems: 'center', justifyContent:'space-between', gap: '.75rem', marginBottom: '.6rem' },
  headerLeft: { display:'flex', alignItems:'center', gap:'.5rem' },
  sparkle:    { fontSize: '.95rem', color: 'var(--accent)', flexShrink: 0 },
  title:      { fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '.82rem', color: 'var(--text)' },
  sub:        { fontSize: '.78rem', color: 'var(--muted2)' },
  shimmer:    { height: 2, background: 'linear-gradient(90deg,var(--accent),var(--accent2),var(--accent4),var(--accent))', backgroundSize: '300%', animation: 'sweep 1.4s linear infinite', borderRadius: 1, marginTop: '.4rem', width: 140 },
  dismissBtn: { background:'transparent', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'.8rem', padding:'.2rem .4rem', borderRadius:4, flexShrink:0 },

  // Horizontal row of compact cards
  row:        { display: 'flex', gap: '.6rem' },
  skeleton:   { flex:1, height: 70, background: 'var(--s2)', borderRadius: 8, border: '1px solid var(--border)', animation: 'blink 1.2s ease infinite' },

  card: {
    flex: 1,
    background: 'var(--s2)',
    border: '1px solid',
    borderRadius: 9,
    padding: '.65rem .75rem',
    cursor: 'pointer',
    transition: 'all .18s',
    display:'flex', flexDirection:'column', gap:'.4rem',
    minWidth: 0,
  },
  cardNum:    (i) => ({
    width: 20, height: 20, borderRadius: '50%',
    background: [
      'rgba(232,255,71,.15)',
      'rgba(0,212,255,.15)',
      'rgba(180,142,255,.15)',
    ][i],
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:'.7rem', fontWeight:700,
    color: ['#e8ff47','#00d4ff','#b48eff'][i],
    flexShrink:0,
  }),
  cardContent:{ display:'flex', flexDirection:'column', gap:'.35rem', minWidth:0 },
  question:   { fontSize: '.74rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.35, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' },
  cardMeta:   { display:'flex', alignItems:'center', justifyContent:'space-between', gap:'.3rem' },
  typeTag:    { fontSize: '.65rem', fontFamily: "'JetBrains Mono',monospace", border: '1px solid', borderRadius: 3, padding: '.08rem .32rem' },
  loadHint:   { fontSize:'.68rem', fontFamily:"'JetBrains Mono',monospace", color:'var(--muted)', opacity:.7 },
}