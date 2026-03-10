// VoiceInput.jsx — Web Speech API, clean SVG mic icon
import React, { useState, useRef, useEffect } from 'react'

// SVG mic icon — looks like a real mic, not an emoji
const MicIcon = ({ active }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="9" y="2" width="6" height="11" rx="3"
      fill={active ? 'var(--accent3)' : 'currentColor'} />
    <path d="M5 10a7 7 0 0 0 14 0" stroke={active ? 'var(--accent3)' : 'currentColor'}
      strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    <line x1="12" y1="17" x2="12" y2="21"
      stroke={active ? 'var(--accent3)' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="9" y1="21" x2="15" y2="21"
      stroke={active ? 'var(--accent3)' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

// Animated waveform bars shown while listening
const WaveformBars = () => (
  <div style={w.wrap}>
    {[1, 2.2, 1.5, 2.8, 1.2, 2, 1.6].map((h, i) => (
      <div key={i} style={{
        ...w.bar,
        animationDelay: `${i * 0.1}s`,
        animationDuration: `${0.5 + i * 0.07}s`,
      }} />
    ))}
  </div>
)

export default function VoiceInput({ onTranscript, disabled }) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recogRef = useRef(null)

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SR) setSupported(true)
    return () => stop()
  }, [])

  function start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.continuous     = false
    r.interimResults = true
    r.lang           = 'en-US'
    recogRef.current = r
    r.onstart  = () => setListening(true)
    r.onresult = e => {
      const text = Array.from(e.results).map(x => x[0].transcript).join('')
      onTranscript(text)
    }
    r.onend  = stop
    r.onerror= stop
    r.start()
  }

  function stop() {
    recogRef.current?.stop()
    recogRef.current = null
    setListening(false)
  }

  if (!supported) return null

  return (
    <button
      title={listening ? 'Stop — click to cancel' : 'Speak your question'}
      onClick={listening ? stop : start}
      disabled={disabled}
      style={{ ...s.btn, ...(listening ? s.active : {}), opacity: disabled ? .35 : 1 }}
    >
      {listening ? <WaveformBars /> : <MicIcon active={false} />}

      {/* Ripple ring when active */}
      {listening && <div style={s.ripple} />}
    </button>
  )
}

const w = {
  wrap: { display:'flex', alignItems:'center', gap:2, height:16 },
  bar:  {
    width:2.5, borderRadius:2,
    background:'var(--accent3)',
    animation:'voiceBar .5s ease infinite alternate',
    height:'60%',
  },
}

const s = {
  btn: {
    position:'relative',
    width:39, height:39, borderRadius:9, flexShrink:0,
    background:'var(--s2)', border:'1px solid var(--border)',
    color:'var(--muted2)',
    cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center',
    transition:'all .2s',
    overflow:'hidden',
  },
  active: {
    background:'rgba(255,107,107,.1)',
    borderColor:'rgba(255,107,107,.45)',
    color:'var(--accent3)',
    boxShadow:'0 0 0 3px rgba(255,107,107,.1)',
  },
  ripple: {
    position:'absolute',
    inset:-4,
    borderRadius:13,
    border:'1.5px solid rgba(255,107,107,.35)',
    animation:'rippleOut .9s ease-out infinite',
    pointerEvents:'none',
  },
}
