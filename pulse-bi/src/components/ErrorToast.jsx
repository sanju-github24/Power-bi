// src/components/ErrorToast.jsx
import React, { useEffect } from 'react'

export default function ErrorToast({ error, onClose }) {
  useEffect(() => {
    if (!error) return
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [error, onClose])

  if (!error) return null

  return (
    <div style={{ ...styles.toast, opacity: error ? 1 : 0, transform: error ? 'translateY(0)' : 'translateY(8px)' }}>
      <div style={styles.icon}>⚠</div>
      <div style={styles.body}>
        <div style={styles.title}>{error.title}</div>
        <div style={styles.msg}>{error.message}</div>
      </div>
      <div style={styles.close} onClick={onClose}>✕</div>
    </div>
  )
}

const styles = {
  toast: {
    position: 'fixed', bottom: '1.25rem', right: '1.25rem', zIndex: 999,
    maxWidth: 360, padding: '.65rem 1rem',
    background: '#13161e', border: '1px solid rgba(255,107,107,.4)', borderRadius: 10,
    fontSize: '.76rem', fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent3)',
    display: 'flex', alignItems: 'flex-start', gap: '.6rem',
    boxShadow: '0 4px 20px rgba(0,0,0,.5)',
    transition: 'transform .25s ease, opacity .25s ease',
  },
  icon:  { fontSize: '1rem', flexShrink: 0, marginTop: '.05rem' },
  body:  { flex: 1 },
  title: { fontWeight: 600, color: '#ff8a8a', marginBottom: '.2rem', fontSize: '.74rem' },
  msg:   { color: 'var(--muted2)', fontSize: '.69rem', lineHeight: 1.5 },
  close: { fontSize: '.8rem', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0, lineHeight: 1 },
}
