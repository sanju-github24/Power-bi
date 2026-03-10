// src/components/UploadZone.jsx
import React, { useRef, useState } from 'react'

export default function UploadZone({ onFile, csvInfo }) {
  const inputRef = useRef()
  const [drag, setDrag]       = useState(false)
  const [progress, setProgress] = useState(0)

  function handleFile(file) {
    if (!file?.name.toLowerCase().endsWith('.csv')) return
    // Animate progress bar visually
    setProgress(35)
    setTimeout(() => setProgress(65), 100)
    onFile(file, (done) => {
      setProgress(done ? 100 : 0)
      if (done) setTimeout(() => setProgress(0), 450)
    })
  }

  return (
    <div style={s.section}>
      <div style={s.label}>Data Source</div>

      <div
        style={{ ...s.zone, ...(drag ? s.zoneDrag : {}) }}
        onClick={() => inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]) }}
      >
        <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])} />
        <div style={s.icon}>📂</div>
        <div style={s.main}><span style={s.accent}>Click</span> or drag a CSV</div>
        <div style={s.sub}>Any schema — no hardcoding</div>
        {/* Progress bar */}
        <div style={{ ...s.bar, width: `${progress}%` }} />
      </div>

      {csvInfo && (
        <div style={s.loaded}>
          <div style={s.csvName}>✓ {csvInfo.filename}</div>
          <div style={s.csvMeta}>{Number(csvInfo.rowCount).toLocaleString()} rows · {csvInfo.colCount} cols</div>
          <span style={s.swap} onClick={() => inputRef.current.click()}>↑ Upload different file</span>
        </div>
      )}
    </div>
  )
}

const s = {
  section: { padding: '.85rem 1rem', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  label:   { fontSize: '.72rem', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '.13em', color: 'var(--muted)', marginBottom: '.75rem' },
  zone: {
    border: '1.5px dashed var(--border2)', borderRadius: 10, padding: '.85rem',
    textAlign: 'center', cursor: 'pointer', transition: 'all .2s',
    position: 'relative', overflow: 'hidden',
  },
  zoneDrag: { borderColor: 'var(--accent)', background: 'rgba(232,255,71,.04)' },
  icon:  { fontSize: '1.5rem', lineHeight: 1, marginBottom: '.35rem' },
  main:  { fontSize: '.78rem', color: 'var(--text)' },
  accent:{ color: 'var(--accent)', fontWeight: 600 },
  sub:   { fontSize: '.66rem', color: 'var(--muted)', marginTop: '.18rem' },
  bar:   { position: 'absolute', bottom: 0, left: 0, height: 2, background: 'var(--accent)', transition: 'width .25s', borderRadius: 1 },
  loaded:  { marginTop: '.75rem', background: 'rgba(74,222,128,.06)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 8, padding: '.75rem .75rem' },
  csvName: { fontSize: '.74rem', fontFamily: "'JetBrains Mono', monospace", color: 'var(--success)', fontWeight: 600, marginBottom: '.15rem', wordBreak: 'break-all' },
  csvMeta: { fontSize: '.76rem', color: 'var(--muted2)' },
  swap:    { fontSize: '.61rem', color: 'var(--muted)', textDecoration: 'underline dotted', cursor: 'pointer', marginTop: '.25rem', display: 'inline-block' },
}
