// AutoAnalystPanel.jsx — Proactive AI insights shown after CSV upload
import React, { useState } from 'react'

export default function AutoAnalystPanel({ insights, onLoadDashboard, loading }) {
  const [expanded, setExpanded] = useState(null)

  if (loading) return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.sparkle}>✦</span>
        <span style={s.title}>AI Analyst is scanning your data…</span>
        <div style={s.shimmer} />
      </div>
      {[0,1,2].map(i => <div key={i} style={{...s.skeleton, animationDelay:`${i*0.15}s`}} />)}
    </div>
  )

  if (!insights?.length) return null

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.sparkle}>✦</span>
        <div>
          <div style={s.title}>AI found {insights.length} insights in your data</div>
          <div style={s.sub}>Click any to load the dashboard instantly</div>
        </div>
      </div>
      <div style={s.grid}>
        {insights.map((item, i) => {
          const panel  = item.result?.panels?.[0]
          const isOpen = expanded === i
          return (
            <div key={i} style={{...s.card, ...(isOpen ? s.cardOpen : {})}}>
              <div style={s.cardTop} onClick={() => setExpanded(isOpen ? null : i)}>
                <div style={s.cardLeft}>
                  <div style={{...s.num, background: COLORS[i%COLORS.length]}}>{i+1}</div>
                  <div>
                    <div style={s.question}>{item.question}</div>
                    {panel?.insight && <div style={s.insight}>💡 {panel.insight}</div>}
                  </div>
                </div>
                <div style={s.cardRight}>
                  <span style={s.typeTag}>{panel?.chart_type || 'Chart'}</span>
                  <span style={s.chevron}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>
              {isOpen && (
                <div style={s.cardBody}>
                  <div style={s.sqlBox}>
                    <span style={s.sqlLabel}>SQL</span>
                    <code style={s.sqlCode}>{panel?.sql}</code>
                  </div>
                  {panel?.chart_reasoning && (
                    <div style={s.reasoning}>🧠 {panel.chart_reasoning}</div>
                  )}
                </div>
              )}
              <button style={s.loadBtn} onClick={() => onLoadDashboard(item)}>
                Load Dashboard →
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const COLORS = ['rgba(232,255,71,.8)', 'rgba(0,212,255,.8)', 'rgba(180,142,255,.8)']

const s = {
  wrap:     { marginBottom: '1.2rem', animation: 'fadeUp .5s ease both' },
  header:   { display: 'flex', alignItems: 'flex-start', gap: '.6rem', marginBottom: '.85rem' },
  sparkle:  { fontSize: '1.1rem', color: 'var(--accent)', flexShrink: 0, marginTop: '.1rem' },
  title:    { fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '.88rem', color: 'var(--text)' },
  sub:      { fontSize: '.69rem', color: 'var(--muted2)', marginTop: '.1rem' },
  shimmer:  { height: 2, background: 'linear-gradient(90deg,var(--accent),var(--accent2),var(--accent4),var(--accent))', backgroundSize: '300%', animation: 'sweep 1.4s linear infinite', borderRadius: 1, marginTop: '.4rem', width: 180 },
  skeleton: { height: 60, background: 'var(--s2)', borderRadius: 10, marginBottom: '.5rem', border: '1px solid var(--border)', animation: 'blink 1.2s ease infinite' },
  grid:     { display: 'flex', flexDirection: 'column', gap: '.55rem' },
  card:     { background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 11, overflow: 'hidden', transition: 'border-color .2s' },
  cardOpen: { borderColor: 'rgba(232,255,71,.35)' },
  cardTop:  { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '.7rem .85rem', cursor: 'pointer', gap: '.5rem' },
  cardLeft: { display: 'flex', alignItems: 'flex-start', gap: '.55rem', flex: 1 },
  num:      { width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.65rem', fontWeight: 700, color: '#000', flexShrink: 0, marginTop: '.1rem' },
  question: { fontSize: '.78rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 },
  insight:  { fontSize: '.67rem', color: 'var(--muted2)', marginTop: '.18rem', fontStyle: 'italic' },
  cardRight:{ display: 'flex', alignItems: 'center', gap: '.5rem', flexShrink: 0 },
  typeTag:  { fontSize: '.58rem', fontFamily: "'JetBrains Mono',monospace", background: 'rgba(232,255,71,.07)', color: 'var(--accent)', border: '1px solid rgba(232,255,71,.18)', borderRadius: 4, padding: '.1rem .38rem' },
  chevron:  { fontSize: '.6rem', color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace" },
  cardBody: { padding: '.0 .85rem .65rem', display: 'flex', flexDirection: 'column', gap: '.4rem' },
  sqlBox:   { background: 'var(--s3)', border: '1px solid var(--border2)', borderRadius: 7, padding: '.45rem .65rem' },
  sqlLabel: { fontSize: '.55rem', fontFamily: "'JetBrains Mono',monospace", color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: '.25rem' },
  sqlCode:  { fontSize: '.67rem', fontFamily: "'JetBrains Mono',monospace", color: 'var(--accent2)', wordBreak: 'break-all', lineHeight: 1.5 },
  reasoning:{ fontSize: '.67rem', color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace", fontStyle: 'italic' },
  loadBtn:  { width: '100%', background: 'rgba(232,255,71,.06)', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--accent)', fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '.72rem', letterSpacing: '.06em', padding: '.5rem', cursor: 'pointer', transition: 'background .15s' },
}
