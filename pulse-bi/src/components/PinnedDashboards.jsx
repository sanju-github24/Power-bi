// PinnedDashboards.jsx — Save & compare dashboard snapshots
import React, { useState } from 'react'

export default function PinnedDashboards({ pins, onLoad, onDelete }) {
  if (!pins?.length) return null

  return (
    <div style={s.section}>
      <div style={s.label}>📌 Pinned ({pins.length})</div>
      <div style={s.list}>
        {pins.map((pin, i) => (
          <div key={pin.id} style={s.pin}>
            <div style={s.pinInfo} onClick={() => onLoad(pin)}>
              <div style={s.pinTitle}>{pin.title}</div>
              <div style={s.pinMeta}>{pin.panelCount} panel{pin.panelCount !== 1 ? 's' : ''} · {pin.time}</div>
            </div>
            <button style={s.del} onClick={() => onDelete(pin.id)} title="Remove pin">✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

const s = {
  section: { padding: '.75rem .85rem', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  label:   { fontSize: '.72rem', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '.13em', color: 'var(--muted)', marginBottom: '.45rem' },
  list:    { display: 'flex', flexDirection: 'column', gap: '.28rem' },
  pin:     { display: 'flex', alignItems: 'center', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden', transition: 'border-color .15s', cursor: 'pointer' },
  pinInfo: { flex: 1, padding: '.38rem .72rem' },
  pinTitle:{ fontSize: '.71rem', color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  pinMeta: { fontSize: '.75rem', color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace", marginTop: '.08rem' },
  del:     { background: 'none', border: 'none', borderLeft: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', padding: '.38rem .5rem', fontSize: '.72rem', height: '100%', transition: 'color .15s' },
}
