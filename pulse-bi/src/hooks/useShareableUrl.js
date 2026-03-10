// useShareableUrl.js — encode/decode dashboard state in URL hash
import { useEffect, useCallback } from 'react'

export function encodeState(result) {
  try {
    const minimal = {
      t: result.dashboard_title,
      s: result.summary,
      f: result.is_followup,
      p: (result.panels || []).map(p => ({
        ti: p.title,
        ct: p.chart_type,
        sq: p.sql,
        x:  p.x_axis,
        y:  p.y_axis,
        in: p.insight,
        d:  (p.data || []).slice(0, 50),
        rc: p.row_count,
        co: p.confidence,
      })),
      tl: result.tldr || [],
    }
    return btoa(encodeURIComponent(JSON.stringify(minimal)))
  } catch { return null }
}

export function decodeState(hash) {
  try {
    const raw    = JSON.parse(decodeURIComponent(atob(hash)))
    return {
      dashboard_title: raw.t,
      summary:         raw.s,
      is_followup:     raw.f,
      cannot_answer:   false,
      tldr:            raw.tl || [],
      panels: (raw.p || []).map(p => ({
        title:      p.ti,
        chart_type: p.ct,
        sql:        p.sq,
        x_axis:     p.x,
        y_axis:     p.y,
        insight:    p.in,
        data:       p.d,
        row_count:  p.rc,
        confidence: p.co,
      })),
    }
  } catch { return null }
}

export function useShareableUrl(dashResult, setDashResult) {
  // On mount — restore from URL hash if present
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash && hash.startsWith('d=')) {
      const restored = decodeState(hash.slice(2))
      if (restored) setDashResult(restored)
    }
  }, [])

  // Update hash whenever dashboard changes
  useEffect(() => {
    if (!dashResult || dashResult.cannot_answer) {
      history.replaceState(null, '', window.location.pathname)
      return
    }
    const encoded = encodeState(dashResult)
    if (encoded) history.replaceState(null, '', `#d=${encoded}`)
  }, [dashResult])

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => alert('Dashboard link copied to clipboard!'))
      .catch(() => {})
  }, [])

  return { copyLink }
}
