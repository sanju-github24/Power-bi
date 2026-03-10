// src/components/ColumnPills.jsx
import React from 'react'

export default function ColumnPills({ columns }) {
  if (!columns?.length) return null

  return (
    <div style={s.section}>
      <div style={s.label}>Columns</div>
      <div style={s.wrap}>
        {columns.map(col => {
          const lower = col.toLowerCase()
          const type  = lower.includes('date') || lower.includes('month') || lower.includes('year') ? 'date'
                      : lower.includes('amount') || lower.includes('revenue') || lower.includes('qty') || lower.includes('price') || lower.includes('cost') || lower.includes('roi') ? 'num'
                      : 'text'
          return (
            <div key={col} title={col} style={{ ...s.pill, ...(type === 'num' ? s.num : type === 'date' ? s.date : {}) }}>
              {col.replace(/_/g, ' ')}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const s = {
  section: { padding: '.85rem 1rem', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  label:   { fontSize: '.59rem', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '.13em', color: 'var(--muted)', marginBottom: '.6rem' },
  wrap:    { display: 'flex', flexWrap: 'wrap', gap: '.28rem', maxHeight: 100, overflowY: 'auto' },
  pill:    { fontSize: '.62rem', fontFamily: "'JetBrains Mono', monospace", background: 'var(--s3)', border: '1px solid var(--border2)', borderRadius: 4, padding: '.16rem .45rem', color: 'var(--muted2)', whiteSpace: 'nowrap' },
  num:     { borderColor: 'rgba(0,212,255,.35)', color: 'var(--accent2)' },
  date:    { borderColor: 'rgba(180,142,255,.35)', color: 'var(--accent4)' },
}
