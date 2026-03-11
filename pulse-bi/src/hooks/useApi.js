// Use VITE_API_URL env var in production (set in Vercel dashboard)
// Falls back to /api proxy for local development
const BASE = import.meta.env.VITE_API_URL || '/api'

export async function apiHealth() {
  const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(3000) })
  return r.json()
}

export async function apiUpload(file) {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(`${BASE}/upload`, { method: 'POST', body: fd })
  const d = await r.json()
  if (!r.ok) throw new Error(d.detail || 'Upload failed')
  return d
}

export async function apiAsk(question, sessionId) {
  const r = await fetch(`${BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, session_id: sessionId }),
    signal: AbortSignal.timeout(90000),
  })
  if (r.status === 429) throw new RateLimitError()
  const d = await r.json()
  if (!r.ok) throw new Error(d.detail || `Error ${r.status}`)
  return d
}

export async function apiAutoAnalyze() {
  const r = await fetch(`${BASE}/auto-analyze`, { signal: AbortSignal.timeout(120000) })
  const d = await r.json()
  if (!r.ok) throw new Error(d.detail || 'Auto-analysis failed')
  return d
}

export async function apiAnomalies() {
  const r = await fetch(`${BASE}/anomalies`, { signal: AbortSignal.timeout(15000) })
  const d = await r.json()
  if (!r.ok) throw new Error(d.detail || 'Anomaly scan failed')
  return d
}

export async function apiWhy(payload) {
  const r = await fetch(`${BASE}/why`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45000),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.detail || 'Why explanation failed')
  return d
}

export async function apiClearHistory(sessionId) {
  await fetch(`${BASE}/history/${sessionId}`, { method: 'DELETE' })
}

export class RateLimitError extends Error {
  constructor() { super('Rate limit hit'); this.name = 'RateLimitError' }
}