// InputBar.jsx — Question input with voice, keyboard shortcuts, dynamic chips
import React, { useRef, useEffect } from 'react'
import VoiceInput from './VoiceInput.jsx'

const FU_CHIPS = [
  ['Filter top 5 ↩',  'Now show only the top 5'],
  ['As pie chart ↩',  'Show this as a pie chart instead'],
  ['By language ↩',   'Now break this down by language'],
]

export default function InputBar({ onAsk, onPin, onTyping, loading, columns, hasDashboard }) {
  const inputRef = useRef()

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e) {
      const mod = e.metaKey || e.ctrlKey
      // Cmd/Ctrl+K → focus input
      if (mod && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
      // Cmd/Ctrl+Enter → submit
      if (mod && e.key === 'Enter') {
        e.preventDefault()
        const q = inputRef.current?.value.trim()
        if (q) onAsk(q)
      }
      // Escape → clear input
      if (e.key === 'Escape') {
        if (document.activeElement === inputRef.current) {
          inputRef.current.value = ''
          inputRef.current.blur()
        }
      }
      // Cmd+P → pin
      if (mod && e.key === 'p' && hasDashboard) {
        e.preventDefault()
        onPin?.()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onAsk, onPin, hasDashboard])

  function handleAsk() {
    const q = inputRef.current?.value.trim()
    if (q) { onAsk(q); inputRef.current.value = '' }
  }

  function fill(q) {
    if (inputRef.current) { inputRef.current.value = q; inputRef.current.focus() }
    onTyping?.()
  }

  const chips = buildChips(columns)

  return (
    <div style={s.bar}>
      <div style={s.row}>
        <div style={s.wrap}>
          <span style={s.prefix}>⌘</span>
          <input
            ref={inputRef}
            style={s.input}
            type="text"
            placeholder="Ask anything… (⌘K to focus, ⌘↵ to send)"
            disabled={loading}
            onInput={() => onTyping?.()}
            onKeyDown={e => e.key === 'Enter' && !e.metaKey && !e.ctrlKey && handleAsk()}
          />
        </div>
        {/* Voice input */}
        <VoiceInput
          onTranscript={t => { if (inputRef.current) inputRef.current.value = t; onTyping?.() }}
          onStart={() => onTyping?.()}
          disabled={loading}
        />
        {/* Pin button */}
        {hasDashboard && (
          <button
            title="Pin this dashboard (⌘P)"
            style={s.pinBtn}
            onClick={() => onPin?.()}
            disabled={loading}
          >
            📌
          </button>
        )}
        <button
          style={{ ...s.btn, opacity: loading ? .4 : 1 }}
          disabled={loading}
          onClick={handleAsk}
        >
          Generate
        </button>
      </div>

      {/* Shortcut hint */}
      <div style={s.hints}>
        <span style={s.hint}>⌘K focus</span>
        <span style={s.hint}>⌘↵ send</span>
        <span style={s.hint}>Esc clear</span>
        {hasDashboard && <span style={s.hint}>⌘P pin</span>}
      </div>

      {/* Suggestion chips */}
      <div style={s.chips}>
        {chips.map(([label, q, isFu]) => (
          <span key={label} style={{ ...s.chip, ...(isFu ? s.fuChip : {}) }} onClick={() => fill(q)}>
            {label}
          </span>
        ))}
      </div>

      {loading && <div style={s.progress} />}
    </div>
  )
}

function buildChips(columns) {
  const lower = (columns || []).join(',').toLowerCase()
  const base  = []
  if (/channel|platform|medium/.test(lower))    base.push(['By channel',    'Show revenue by channel used',      false])
  if (/date|month|year/.test(lower))            base.push(['Monthly trend',  'Monthly revenue trend over time',   false])
  if (/category|segment|type/.test(lower))      base.push(['By category',    'Revenue breakdown by category',     false])
  if (/region|area|zone|language/.test(lower))  base.push(['By language',    'Compare ROI across languages',      false])
  if (/roi|return|profit/.test(lower))          base.push(['Top ROI',        'Top 10 campaigns by ROI',           false])
  if (!base.length) {
    base.push(['Overview', 'Give me a full overview of the data', false])
    base.push(['Summary',  'Show me a summary of the data',       false])
  }
  FU_CHIPS.forEach(([l,q]) => base.push([l, q, true]))
  return base.slice(0, 7)
}

const s = {
  bar:     { padding: '.75rem 1rem', background: 'var(--s1)', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  row:     { display: 'flex', gap: '.5rem', alignItems: 'center' },
  wrap:    { flex: 1, position: 'relative' },
  prefix:  { position: 'absolute', left: '.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', fontSize: '.8rem', pointerEvents: 'none' },
  input:   { width: '100%', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontFamily: "'Figtree',sans-serif", fontSize: '.88rem', padding: '.72rem 1rem .72rem 2.2rem', outline: 'none' },
  pinBtn:  { width: 39, height: 39, borderRadius: 9, background: 'var(--s2)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  btn:     { background: 'var(--accent)', color: '#000', fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '.78rem', letterSpacing: '.06em', textTransform: 'uppercase', height: 39, padding: '0 1.1rem', border: 'none', borderRadius: 9, cursor: 'pointer', whiteSpace: 'nowrap' },
  hints:   { display: 'flex', gap: '.55rem', marginTop: '.35rem' },
  hint:    { fontSize: '.58rem', fontFamily: "'JetBrains Mono',monospace", color: 'var(--muted)', background: 'var(--s3)', border: '1px solid var(--border)', borderRadius: 4, padding: '.08rem .32rem' },
  chips:   { display: 'flex', gap: '.3rem', flexWrap: 'wrap', marginTop: '.5rem' },
  chip:    { fontSize: '.65rem', fontFamily: "'JetBrains Mono',monospace", background: 'var(--s2)', border: '1px solid var(--border2)', borderRadius: 999, padding: '.18rem .55rem', color: 'var(--muted2)', cursor: 'pointer', transition: 'all .15s' },
  fuChip:  { borderColor: 'rgba(180,142,255,.3)', color: 'var(--accent4)' },
  progress:{ height: 2, marginTop: '.55rem', background: 'linear-gradient(90deg,var(--accent),var(--accent2),var(--accent4),var(--accent))', backgroundSize: '300%', animation: 'sweep 1.4s linear infinite', borderRadius: 1 },
}
