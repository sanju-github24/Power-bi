// src/components/ChatHistory.jsx
import React, { useEffect, useRef } from 'react'

export default function ChatHistory({ history, activeTurnIdx, onReplay, onClear }) {
  const scrollRef = useRef()

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [history])

  const userTurns = history.filter(m => m.role === 'user')

  return (
    <>
      {/* Header */}
      <div style={s.header}>
        <div style={s.label}>Chat History</div>
        <span style={s.count}>
          {userTurns.length > 0 ? `${userTurns.length} turn${userTurns.length !== 1 ? 's' : ''}` : ''}
        </span>
      </div>

      {/* Scrollable messages */}
      <div ref={scrollRef} style={s.scroll}>
        {history.length === 0 ? (
          <div style={s.empty}>Ask your first question</div>
        ) : (
          history.map((msg, i) => {
            const userIdx = msg.role === 'user'
              ? history.slice(0, i + 1).filter(m => m.role === 'user').length - 1
              : -1
            const isActive = msg.role === 'user' && userIdx === activeTurnIdx

            return (
              <div
                key={i}
                style={{
                  ...s.turn,
                  ...(msg.role === 'user' ? s.userTurn : s.aiTurn),
                  ...(msg.isFollowup && msg.role === 'ai' ? s.followupAi : {}),
                  ...(isActive ? s.activeTurn : {}),
                }}
                onClick={msg.role === 'user' ? () => onReplay(userIdx) : undefined}
              >
                <div style={s.turnLabel}>
                  <div style={s.labelLeft}>
                    {msg.role === 'user' ? 'You' : 'Pulse BI'}
                    {msg.isFollowup && msg.role === 'ai' && (
                      <span style={s.fuTag}>follow-up</span>
                    )}
                  </div>
                  {msg.role === 'user' && <span style={s.replay}>↺ replay</span>}
                </div>
                <div>{msg.content}</div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div style={s.footer}>
        <span style={s.hint}>click a question to replay</span>
        <button style={s.clearBtn} onClick={onClear}>✕ Clear</button>
      </div>
    </>
  )
}

const s = {
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.7rem 1rem .2rem', flexShrink: 0 },
  label:      { fontSize: '.72rem', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '.13em', color: 'var(--muted)' },
  count:      { fontSize: '.75rem', fontFamily: "'JetBrains Mono', monospace", color: 'var(--muted)' },
  scroll:     { flex: 1, overflowY: 'auto', padding: '.5rem .76rem', display: 'flex', flexDirection: 'column', gap: '.3rem' },
  empty:      { fontSize: '.73rem', color: 'var(--muted)', textAlign: 'center', marginTop: '1.2rem', fontFamily: "'JetBrains Mono', monospace" },
  turn:       { padding: '.5rem .76rem', borderRadius: 7, fontSize: '.74rem', lineHeight: 1.5, wordBreak: 'break-word', position: 'relative' },
  userTurn:   { background: 'rgba(232,255,71,.07)', border: '1px solid rgba(232,255,71,.14)', color: 'var(--text)', cursor: 'pointer', transition: 'background .15s, border-color .15s' },
  aiTurn:     { background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--muted2)' },
  followupAi: { background: 'rgba(180,142,255,.07)', borderColor: 'rgba(180,142,255,.2)' },
  activeTurn: { borderColor: 'var(--accent)', background: 'rgba(232,255,71,.12)' },
  turnLabel:  { fontSize: '.57rem', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)', marginBottom: '.22rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  labelLeft:  { display: 'flex', alignItems: 'center', gap: '.4rem' },
  fuTag:      { fontSize: '.57rem', background: 'rgba(180,142,255,.15)', color: 'var(--accent4)', border: '1px solid rgba(180,142,255,.25)', borderRadius: 3, padding: '.05rem .3rem' },
  replay:     { fontSize: '.76rem', color: 'var(--accent)', opacity: 0.7, fontFamily: "'JetBrains Mono', monospace" },
  footer:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.5rem .85rem', borderTop: '1px solid var(--border)', flexShrink: 0 },
  hint:       { fontSize: '.75rem', fontFamily: "'JetBrains Mono', monospace", color: 'var(--muted)' },
  clearBtn:   { fontSize: '.76rem', fontFamily: "'JetBrains Mono', monospace", background: 'none', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--muted)', padding: '.25rem .72rem', cursor: 'pointer' },
}
