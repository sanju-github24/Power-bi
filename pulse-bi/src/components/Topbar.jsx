// src/components/Topbar.jsx
import React from 'react'

export default function Topbar({ status, rowCount, filename }) {
  const dotClass = status === 'online' ? 'on' : status === 'busy' ? 'busy' : status === 'error' ? 'err' : ''

  const statusText =
    status === 'busy'  ? 'thinking…' :
    status === 'error' ? 'offline' :
    rowCount           ? `online · ${Number(rowCount).toLocaleString()} rows` :
                         'online · no data'

  return (
    <header style={styles.bar}>
      <div style={styles.brand}>Pulse BI</div>
      <div style={styles.right}>
        {filename && (
          <div style={styles.pill}>
            <span>📄</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '.68rem', color: 'var(--muted2)' }}>
              {filename}
            </span>
          </div>
        )}
        <div style={styles.pill}>
          <div style={{ ...styles.dot, ...(dotClass === 'on' ? styles.dotOn : dotClass === 'err' ? styles.dotErr : dotClass === 'busy' ? styles.dotBusy : {}) }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '.68rem', color: 'var(--muted2)' }}>
            {statusText}
          </span>
        </div>
      </div>
    </header>
  )
}

const styles = {
  bar: {
    height: 50, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 1.25rem',
    background: 'var(--s1)', borderBottom: '1px solid var(--border)', zIndex: 10,
  },
  brand: {
    fontFamily: "'Syne', sans-serif", fontSize: '1.05rem', fontWeight: 800,
    letterSpacing: '-.02em',
    background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  },
  right: { display: 'flex', alignItems: 'center', gap: '.6rem' },
  pill: {
    display: 'flex', alignItems: 'center', gap: '.35rem',
    background: 'var(--s2)', border: '1px solid var(--border)',
    borderRadius: 999, padding: '.25rem .7rem',
  },
  dot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--muted)', transition: 'all .3s' },
  dotOn:   { background: 'var(--success)', boxShadow: '0 0 5px var(--success)' },
  dotErr:  { background: 'var(--accent3)' },
  dotBusy: { background: 'var(--accent)', animation: 'blink 1s infinite' },
}
