// SuggestedQuestions.jsx — shows 3 smart follow-up questions after every dashboard response
import { useState, useEffect } from 'react'

// Generate contextual follow-up questions based on what was just shown
function generateSuggestions(result) {
  if (!result || result.cannot_answer) return []

  const panels  = result.panels || []
  const title   = (result.dashboard_title || '').toLowerCase()
  const summary = (result.summary || '').toLowerCase()

  const suggestions = new Set()

  for (const panel of panels) {
    const pt   = (panel.title || '').toLowerCase()
    const sql  = (panel.sql  || '').toLowerCase()
    const ct   = (panel.chart_type || '').toLowerCase()

    // ── Revenue questions ────────────────────────────────────────────
    if (pt.includes('revenue') || sql.includes('revenue')) {
      suggestions.add('Which campaign type generates the highest average revenue?')
      suggestions.add('Show top 5 campaigns by revenue')
      suggestions.add('What is the monthly revenue trend over 2025?')
    }

    // ── ROI questions ────────────────────────────────────────────────
    if (pt.includes('roi') || sql.includes('roi')) {
      suggestions.add('Which channel has the best ROI on average?')
      suggestions.add('Show campaigns where ROI is greater than 5')
      suggestions.add('Compare ROI across all campaign types')
    }

    // ── Channel questions ────────────────────────────────────────────
    if (pt.includes('channel') || sql.includes('channel_used')) {
      suggestions.add('Which channel has the most conversions?')
      suggestions.add('Compare Instagram vs YouTube performance')
      suggestions.add('Show revenue by channel for Paid Ads only')
    }

    // ── Campaign type questions ───────────────────────────────────────
    if (pt.includes('campaign') || sql.includes('campaign_type')) {
      suggestions.add('Which campaign type has the lowest acquisition cost?')
      suggestions.add('Show influencer campaign performance by audience')
      suggestions.add('Compare Social Media vs SEO campaigns')
    }

    // ── Audience questions ────────────────────────────────────────────
    if (pt.includes('audience') || sql.includes('target_audience') || sql.includes('customer_segment')) {
      suggestions.add('Which audience segment converts the best?')
      suggestions.add('Show engagement score by target audience')
      suggestions.add('Compare Working Women vs College Students revenue')
    }

    // ── Language questions ────────────────────────────────────────────
    if (sql.includes('language')) {
      suggestions.add('Which language has the highest engagement score?')
      suggestions.add('Show revenue by language')
      suggestions.add('Compare Hindi vs English campaign performance')
    }

    // ── Engagement questions ──────────────────────────────────────────
    if (pt.includes('engagement') || sql.includes('engagement_score')) {
      suggestions.add('Which campaign type scores highest on engagement?')
      suggestions.add('Show top 10 campaigns by engagement score')
      suggestions.add('Is there a correlation between engagement and conversions?')
    }

    // ── Trend / line chart follow-ups ─────────────────────────────────
    if (ct === 'line' || ct === 'area' || sql.includes('date')) {
      suggestions.add('Which month had the peak revenue in 2025?')
      suggestions.add('Show clicks trend over time')
      suggestions.add('What is the quarterly conversion trend?')
    }

    // ── KPI follow-ups ────────────────────────────────────────────────
    if (ct === 'kpi') {
      suggestions.add('Break this down by campaign type')
      suggestions.add('Show this metric over time as a trend')
      suggestions.add('Which segment drives this number the most?')
    }

    // ── Bar / ranking follow-ups ──────────────────────────────────────
    if (ct === 'bar' || ct === 'horizontalbar') {
      suggestions.add('Now filter to only the top 3')
      suggestions.add('Show the same breakdown but for conversions')
      suggestions.add('Which has the lowest acquisition cost?')
    }
  }

  // ── Fallback generic Nykaa questions ─────────────────────────────────────
  const fallbacks = [
    'What is the overall average ROI across all campaigns?',
    'Show total impressions and clicks by campaign type',
    'Which target audience has the highest conversion rate?',
    'Show campaigns with negative ROI',
    'What is the average campaign duration by type?',
    'Show revenue breakdown by customer segment',
  ]

  const arr = [...suggestions]
  while (arr.length < 3) {
    const f = fallbacks.find(q => !arr.includes(q))
    if (!f) break
    arr.push(f)
    fallbacks.splice(fallbacks.indexOf(f), 1)
  }

  // Shuffle slightly (deterministic enough to feel fresh each time)
  const seed = (result.dashboard_title || '').length
  const shuffled = arr.sort((a, b) => ((a.charCodeAt(seed % a.length) + seed) % 3) - 1)

  return shuffled.slice(0, 3)
}

export default function SuggestedQuestions({ result, onAsk, loading }) {
  const [suggestions, setSuggestions] = useState([])
  const [visible, setVisible]         = useState(false)
  const [dismissed, setDismissed]     = useState(false)

  useEffect(() => {
    setDismissed(false)
    setVisible(false)
    if (!result || result.cannot_answer) { setSuggestions([]); return }
    // Small delay so it appears after dashboard animation settles
    const t = setTimeout(() => {
      setSuggestions(generateSuggestions(result))
      setVisible(true)
    }, 600)
    return () => clearTimeout(t)
  }, [result])

  if (!visible || dismissed || suggestions.length === 0 || loading) return null

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.sparkle}>✦</span>
        <span style={s.label}>Suggested questions</span>
        <button style={s.dismiss} onClick={() => setDismissed(true)} title="Dismiss">✕</button>
      </div>
      <div style={s.pills}>
        {suggestions.map((q, i) => (
          <button
            key={i}
            style={s.pill}
            onClick={() => { setDismissed(true); onAsk(q) }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(232,255,71,.1)'
              e.currentTarget.style.borderColor = 'rgba(232,255,71,.4)'
              e.currentTarget.style.color = '#e8ff47'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = s.pill.background
              e.currentTarget.style.borderColor = s.pill.borderColor
              e.currentTarget.style.color = s.pill.color
            }}
          >
            <span style={s.arrow}>→</span>
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}

const s = {
  wrap: {
    margin: '0 0 1rem 0',
    padding: '.75rem 1rem',
    background: 'rgba(232,255,71,.03)',
    border: '1px solid rgba(232,255,71,.12)',
    borderRadius: 12,
    animation: 'fadeUp .4s ease both',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '.4rem',
    marginBottom: '.6rem',
  },
  sparkle: {
    color: '#e8ff47',
    fontSize: '.85rem',
  },
  label: {
    fontSize: '.78rem',
    fontFamily: "'Syne', sans-serif",
    fontWeight: 700,
    color: '#e8ff47',
    letterSpacing: '.04em',
    flex: 1,
  },
  dismiss: {
    background: 'none',
    border: 'none',
    color: '#6b7a94',
    fontSize: '.75rem',
    cursor: 'pointer',
    padding: '0 .2rem',
    lineHeight: 1,
  },
  pills: {
    display: 'flex',
    flexDirection: 'column',
    gap: '.4rem',
  },
  pill: {
    display: 'flex',
    alignItems: 'center',
    gap: '.55rem',
    background: 'rgba(255,255,255,.03)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 8,
    padding: '.55rem .85rem',
    color: '#c8d8f0',
    fontSize: '.83rem',
    fontFamily: "'Figtree', sans-serif",
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all .15s ease',
    width: '100%',
  },
  arrow: {
    color: 'rgba(232,255,71,.6)',
    fontSize: '.8rem',
    flexShrink: 0,
    fontFamily: 'monospace',
  },
}
