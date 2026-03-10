// AnomalyPanel.jsx — Anomaly detection alerts sidebar section
import React, { useState } from 'react'

const SEV = {
  critical: { color: '#ff6b6b', bg: 'rgba(255,107,107,.08)', border: 'rgba(255,107,107,.25)', icon: '🔴' },
  warning:  { color: '#fbbf24', bg: 'rgba(251,191,36,.06)',  border: 'rgba(251,191,36,.22)',  icon: '🟡' },
  info:     { color: '#00d4ff', bg: 'rgba(0,212,255,.05)',   border: 'rgba(0,212,255,.2)',    icon: '🔵' },
}

export default function AnomalyPanel({ anomalies, loading, onAskAnomaly }) {
  const [open, setOpen] = useState(true)
  const [expanded, setExpanded] = useState(null)

  if (loading) return (
    <div style={s.section}>
      <div style={s.sectionLabel}>⚡ Anomaly Scan</div>
      <div style={{ fontSize: '.68rem', color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace" }}>
        scanning columns…
      </div>
    </div>
  )

  if (!anomalies?.length) return (
    <div style={s.section}>
      <div style={s.sectionLabel}>⚡ Anomaly Scan</div>
      <div style={s.clean}>✓ No anomalies detected</div>
    </div>
  )

  const critCount = anomalies.filter(a => a.severity === 'critical').length
  const warnCount = anomalies.filter(a => a.severity === 'warning').length

  return (
    <div style={s.section}>
      <div style={s.header} onClick={() => setOpen(o => !o)}>
        <div style={s.sectionLabel}>⚡ Anomaly Scan</div>
        <div style={s.badges}>
          {critCount > 0 && <span style={{...s.badge, background: 'rgba(255,107,107,.15)', color: '#ff8a8a'}}>{critCount} critical</span>}
          {warnCount > 0 && <span style={{...s.badge, background: 'rgba(251,191,36,.12)', color: '#fbbf24'}}>{warnCount} warn</span>}
          <span style={s.chevron}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div style={s.list}>
          {anomalies.map((a, i) => {
            const sev     = SEV[a.severity] || SEV.info
            const isOpen  = expanded === i
            const typeLabel = a.type === 'spike' ? `↑ spike × ${a.spike_count}` :
                              a.type === 'drop'  ? `↓ drop × ${a.drop_count}` :
                              `mixed × ${a.outlier_count}`
            return (
              <div key={i} style={{...s.card, background: sev.bg, borderColor: sev.border}}>
                <div style={s.cardTop} onClick={() => setExpanded(isOpen ? null : i)}>
                  <span style={s.sevIcon}>{sev.icon}</span>
                  <div style={s.cardInfo}>
                    <div style={s.colName}>{a.column}</div>
                    <div style={{...s.typeLabel, color: sev.color}}>{typeLabel} · {a.outlier_pct}% of data</div>
                  </div>
                  <span style={s.chevron}>{isOpen ? '▲' : '▼'}</span>
                </div>

                {isOpen && (
                  <div style={s.detail}>
                    <div style={s.statRow}>
                      <Stat label="Mean"   value={a.mean.toLocaleString()} />
                      <Stat label="Std Dev" value={a.std.toLocaleString()} />
                      <Stat label="Outliers" value={`${a.outlier_count}/${a.total_count}`} />
                    </div>
                    {a.max_spike && <div style={s.flag}>🔺 Max spike: <strong>{a.max_spike.toLocaleString()}</strong> (fence: {a.upper_fence.toLocaleString()})</div>}
                    {a.max_drop  && <div style={s.flag}>🔻 Max drop: <strong>{a.max_drop.toLocaleString()}</strong> (fence: {a.lower_fence.toLocaleString()})</div>}
                    <div style={s.sampleLabel}>Sample outliers:</div>
                    <div style={s.samples}>{a.sample_outliers.map((v,j) => <span key={j} style={{...s.sampleVal, color: sev.color}}>{v.toLocaleString()}</span>)}</div>
                    <button style={{...s.askBtn, borderColor: sev.border, color: sev.color}}
                      onClick={() => onAskAnomaly(`Investigate anomalies in ${a.column} — show distribution and outlier values`)}>
                      Investigate in dashboard →
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '.6rem', color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
      <div style={{ fontSize: '.72rem', color: 'var(--text)', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{value}</div>
    </div>
  )
}

const s = {
  section:    { padding: '.75rem .9rem', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '.55rem' },
  sectionLabel:{ fontSize: '.59rem', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '.13em', color: 'var(--muted)' },
  badges:     { display: 'flex', alignItems: 'center', gap: '.3rem' },
  badge:      { fontSize: '.58rem', fontFamily: "'JetBrains Mono',monospace", borderRadius: 999, padding: '.1rem .38rem', fontWeight: 600 },
  chevron:    { fontSize: '.58rem', color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace" },
  clean:      { fontSize: '.68rem', color: 'var(--success)', fontFamily: "'JetBrains Mono',monospace" },
  list:       { display: 'flex', flexDirection: 'column', gap: '.35rem' },
  card:       { border: '1px solid', borderRadius: 8, overflow: 'hidden', transition: 'all .2s' },
  cardTop:    { display: 'flex', alignItems: 'center', gap: '.45rem', padding: '.45rem .6rem', cursor: 'pointer' },
  sevIcon:    { fontSize: '.75rem', flexShrink: 0 },
  cardInfo:   { flex: 1 },
  colName:    { fontSize: '.72rem', fontFamily: "'JetBrains Mono',monospace", color: 'var(--text)', fontWeight: 600 },
  typeLabel:  { fontSize: '.62rem', fontFamily: "'JetBrains Mono',monospace", marginTop: '.08rem' },
  detail:     { padding: '.45rem .6rem .55rem', borderTop: '1px solid rgba(255,255,255,.05)', display: 'flex', flexDirection: 'column', gap: '.35rem' },
  statRow:    { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.3rem', background: 'rgba(0,0,0,.2)', borderRadius: 6, padding: '.4rem' },
  flag:       { fontSize: '.67rem', fontFamily: "'JetBrains Mono',monospace", color: 'var(--muted2)' },
  sampleLabel:{ fontSize: '.58rem', color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '.1em' },
  samples:    { display: 'flex', flexWrap: 'wrap', gap: '.25rem' },
  sampleVal:  { fontSize: '.65rem', fontFamily: "'JetBrains Mono',monospace", background: 'rgba(0,0,0,.3)', borderRadius: 4, padding: '.1rem .35rem' },
  askBtn:     { background: 'none', border: '1px solid', borderRadius: 6, padding: '.35rem .6rem', fontSize: '.65rem', fontFamily: "'JetBrains Mono',monospace", cursor: 'pointer', width: '100%', marginTop: '.1rem', textAlign: 'left', transition: 'background .15s' },
}
