// ChartPanel.jsx — clean cards, SVG download icon, crisp insight text, Why panel, confidence
import React, { useEffect, useRef } from 'react'
import { Chart } from 'chart.js/auto'
import zoomPlugin from 'chartjs-plugin-zoom'
import WhyPanel from './WhyPanel.jsx'

Chart.register(zoomPlugin)

const PAL = ['#e8ff47','#00d4ff','#ff6b6b','#b48eff','#4ade80','#fb923c','#38bdf8','#f472b6','#a3e635','#34d399']
const kpiHistory = new Map()

// ── SVG icons ─────────────────────────────────────────────────────────────────
const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
)

export default function ChartPanel({ panel, idx, isFollowup, queryMs, sessionId }) {
  const panelRef = useRef()
  const ct = (panel.chart_type||'bar').toLowerCase()
  const confidence = panel.confidence ?? null   // 0-100 from backend

  function downloadPNG() {
    const canvas = panelRef.current?.querySelector('canvas')
    if (!canvas) return
    // Draw on white bg for clean PNG
    const offscreen = document.createElement('canvas')
    offscreen.width  = canvas.width
    offscreen.height = canvas.height
    const ctx = offscreen.getContext('2d')
    ctx.fillStyle = '#0e1016'
    ctx.fillRect(0, 0, offscreen.width, offscreen.height)
    ctx.drawImage(canvas, 0, 0)
    const link = document.createElement('a')
    link.download = `${(panel.title||'chart').replace(/\s+/g,'-').toLowerCase()}.png`
    link.href = offscreen.toDataURL('image/png')
    link.click()
  }

  return (
    <div ref={panelRef} data-panel-idx={idx} style={{ ...s.panel, ...(isFollowup ? s.updated : {}) }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={s.head}>
        <div style={s.headLeft}>
          <div style={s.title}>{panel.title || `Panel ${idx+1}`}</div>
          <span style={s.tag}>{panel.chart_type || 'Bar'}</span>
        </div>
        <div style={s.headActions}>
          {/* Confidence score */}
          {confidence !== null && <ConfidenceBadge score={confidence} />}
          {ct !== 'table' && ct !== 'kpi' && (
            <button style={s.dlBtn} title="Download PNG" onClick={downloadPNG}>
              <DownloadIcon />
              <span>PNG</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Insight — clean readable text ──────────────────────────────── */}
      {panel.insight && (
        <div style={s.insight}>
          <span style={s.insightDot}>●</span>
          <span>{panel.insight}</span>
        </div>
      )}

      {/* ── Chart reasoning — subtle, not a block ──────────────────────── */}
      {panel.chart_reasoning && (
        <div style={s.reasoning} title={panel.chart_reasoning}>
          {panel.chart_reasoning}
        </div>
      )}

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div style={s.body}>
        {panel.error ? (
          <div style={s.sqlErr}>⚠ {panel.error}</div>
        ) : ct === 'table' ? (
          <DataTable data={panel.data} />
        ) : ct === 'kpi' ? (
          <KPICard data={panel.data||[]} title={panel.title} />
        ) : (
          <ChartRenderer panel={panel} />
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div style={s.foot}>
        <span style={s.rows}>{Number(panel.row_count ?? (panel.data||[]).length).toLocaleString()} rows</span>
        <div style={{display:'flex',alignItems:'center',gap:'.6rem'}}>
          {queryMs != null && (
            <span style={s.speed}>⚡ {queryMs < 1000 ? `${queryMs}ms` : `${(queryMs/1000).toFixed(1)}s`}</span>
          )}
          <span title={panel.sql||''} style={s.sql}>
            {(panel.sql||'').slice(0,45)}{(panel.sql||'').length > 45 ? '…' : ''}
          </span>
        </div>
      </div>

      {/* ── Why did this happen ─────────────────────────────────────────── */}
      <WhyPanel panel={panel} sessionId={sessionId} />
    </div>
  )
}

// ── Confidence badge ──────────────────────────────────────────────────────────
function ConfidenceBadge({ score }) {
  const color = score >= 80 ? '#4ade80' : score >= 60 ? '#fbbf24' : '#ff6b6b'
  const label = score >= 80 ? 'High' : score >= 60 ? 'Med' : 'Low'
  return (
    <div title={`AI confidence: ${score}%`} style={{ ...s.confBadge, borderColor: color + '44', color }}>
      <div style={{ ...s.confDot, background: color }} />
      {score}% {label}
    </div>
  )
}

// ── KPI with trend ────────────────────────────────────────────────────────────
function KPICard({ data, title }) {
  if (!data?.length) return <div style={s.noRows}>No data</div>
  const keys = Object.keys(data[0])
  const val  = data[0][keys[keys.length-1]]
  const lbl  = (keys[keys.length-1]||'').replace(/_/g,' ')
  const num  = Number(val)
  const key  = title || lbl
  let trend  = null
  if (!isNaN(num) && kpiHistory.has(key)) {
    const prev = kpiHistory.get(key)
    if (prev !== 0 && prev !== num) {
      const pct = ((num - prev) / Math.abs(prev)) * 100
      trend = { pct: Math.abs(pct).toFixed(1), up: num > prev }
    }
  }
  if (!isNaN(num)) kpiHistory.set(key, num)
  return (
    <div style={s.kpi}>
      <div style={s.kpiVal}>{isNaN(num) ? String(val) : num.toLocaleString()}</div>
      <div style={s.kpiLbl}>{lbl}</div>
      {trend && (
        <div style={{ ...s.trend, color: trend.up ? 'var(--success)' : 'var(--accent3)' }}>
          {trend.up ? '▲' : '▼'} {trend.pct}% vs last query
        </div>
      )}
    </div>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────
function DataTable({ data }) {
  if (!data?.length) return <div style={s.noRows}>No rows returned</div>
  const cols = Object.keys(data[0])
  return (
    <div style={s.tblWrap}>
      <table style={s.tbl}>
        <thead>
          <tr>{cols.map(c => <th key={c} style={s.th}>{c.replace(/_/g,' ')}</th>)}</tr>
        </thead>
        <tbody>
          {data.slice(0,50).map((row,i) => (
            <tr key={i} style={i%2===0 ? {} : {background:'rgba(255,255,255,.012)'}}>
              {cols.map(c => (
                <td key={c} style={s.td}>
                  {row[c]===null||row[c]===''
                    ? <span style={{color:'var(--muted)',fontStyle:'italic'}}>—</span>
                    : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Chart renderer ────────────────────────────────────────────────────────────
function ChartRenderer({ panel }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)
  const { data=[], chart_type='Bar', x_axis, y_axis } = panel
  const ct = chart_type.toLowerCase().trim()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!data.length || !canvas) return
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

    const keys   = Object.keys(data[0])
    const xKey   = (x_axis && keys.includes(x_axis)) ? x_axis : keys[0]
    const yKey   = (y_axis && keys.includes(y_axis)) ? y_axis : (keys[1]||keys[0])
    const isHBar = ct==='horizontalbar'||ct==='hbar'
    const isPie  = ct==='pie'||ct==='doughnut'
    const isArea = ct==='area'
    const isLine = ct==='line'||isArea
    const isScat = ct==='scatter'
    const jsType = isHBar?'bar':isPie?ct:isLine?'line':'bar'

    try {
      if (isScat) {
        chartRef.current = new Chart(canvas, {
          type:'scatter',
          data:{ datasets:[{ label:`${xKey} vs ${yKey}`,
            data:data.map(d=>({x:Number(d[xKey])||0,y:Number(d[yKey])||0})),
            backgroundColor:PAL[0]+'99',borderColor:PAL[0],pointRadius:5,pointHoverRadius:7 }]},
          options:{
            responsive:true,maintainAspectRatio:false,animation:{duration:600},
            plugins:{
              legend:{display:false},
              tooltip:tooltipStyle(c=>`(${c.parsed.x.toLocaleString()}, ${c.parsed.y.toLocaleString()})`),
              zoom:{zoom:{wheel:{enabled:true},pinch:{enabled:true},mode:'xy'},pan:{enabled:true,mode:'xy'}}
            },
            scales:{
              x:xScale(xKey),
              y:yScale(yKey,false),
            }
          }
        }); return
      }

      const labels     = data.map(d=>String(d[xKey]??''))
      const values     = data.map(d=>{ const n=Number(d[yKey]); return isNaN(n)?0:n })
      const isMultiBar = !isPie && !isLine
      const bgColor    = isPie ? PAL.slice(0,labels.length)
                       : isMultiBar ? labels.map((_,i)=>PAL[i%PAL.length]+'cc')
                       : isArea ? PAL[0]+'22' : PAL[0]+'cc'
      const bdColor    = isPie ? 'transparent'
                       : isMultiBar ? labels.map((_,i)=>PAL[i%PAL.length])
                       : PAL[0]

      chartRef.current = new Chart(canvas, {
        type: jsType,
        data:{ labels, datasets:[{
          label:yKey.replace(/_/g,' '), data:values,
          backgroundColor:bgColor, borderColor:bdColor,
          borderWidth:isPie?0:1.5,
          borderRadius:(!isPie&&!isLine)?7:0,
          tension:isLine?0.4:0, fill:isArea,
          pointBackgroundColor:PAL[0],
          pointRadius:isLine?4:0, pointHoverRadius:isLine?7:0,
          pointBorderWidth:0,
        }]},
        options:{
          indexAxis:isHBar?'y':'x',
          responsive:true, maintainAspectRatio:false,
          animation:{duration:600,easing:'easeOutQuart'},
          interaction:{mode:isPie?'nearest':'index',intersect:isPie},
          plugins:{
            legend:{display:isPie,labels:{
              color:'#8896b0',
              font:{family:'Figtree',size:11},
              padding:14,
              usePointStyle:true,
              pointStyleWidth:8,
            }},
            tooltip:tooltipStyle(c=>` ${c.dataset.label}: ${Number(c.raw).toLocaleString()}`),
            zoom:{zoom:{wheel:{enabled:!isPie},pinch:{enabled:!isPie},mode:'x'},pan:{enabled:!isPie,mode:'x'}}
          },
          scales: isPie ? {} : {
            x: {
              grid:{display:isHBar, color:'rgba(255,255,255,.04)'},
              border:{display:false},
              ticks:{
                color:'#4a5468',
                font:{family:'JetBrains Mono',size:10},
                maxRotation:isHBar?0:30,
                callback(v){
                  if(isHBar) return Number(this.getLabelForValue(v)).toLocaleString()
                  const l=this.getLabelForValue(v)
                  return l?.length>13?l.slice(0,12)+'…':l
                }
              }
            },
            y: {
              beginAtZero:true,
              grid:{color:'rgba(255,255,255,.05)', display:!isHBar},
              border:{display:false},
              ticks:{
                color:'#4a5468',
                font:{family:'JetBrains Mono',size:10},
                callback:isHBar
                  ?function(v){const l=this.getLabelForValue(v);return l?.length>16?l.slice(0,15)+'…':l}
                  :v=>Number(v).toLocaleString()
              }
            }
          }
        }
      })
    } catch(err) { console.error('[ChartPanel]',err) }
    return () => { if(chartRef.current){chartRef.current.destroy();chartRef.current=null} }
  }, [JSON.stringify(data?.slice(0,5)), ct, x_axis, y_axis])

  if (!data.length) return <div style={s.noRows}>No data</div>
  return <div style={s.chartWrap}><canvas ref={canvasRef} /></div>
}

// ── Shared tooltip / scale helpers ────────────────────────────────────────────
function tooltipStyle(labelCb) {
  return {
    backgroundColor:'#0e1016',
    borderColor:'rgba(255,255,255,.08)',
    borderWidth:1,
    titleColor:'#dde2ec',
    bodyColor:'#8896b0',
    padding:10,
    cornerRadius:8,
    titleFont:{family:'Syne',size:12,weight:'700'},
    bodyFont:{family:'JetBrains Mono',size:11},
    callbacks:{ label: labelCb }
  }
}
function xScale(title) {
  return {
    grid:{color:'rgba(255,255,255,.04)'},border:{display:false},
    ticks:{color:'#4a5468',font:{family:'JetBrains Mono',size:10}},
    title:{display:!!title,text:(title||'').replace(/_/g,' '),color:'#6b7a94',font:{size:10}}
  }
}
function yScale(title, isHBar) {
  return {
    grid:{color:'rgba(255,255,255,.04)',display:!isHBar},border:{display:false},
    ticks:{color:'#4a5468',font:{family:'JetBrains Mono',size:10},callback:v=>Number(v).toLocaleString()},
    title:{display:!!title,text:(title||'').replace(/_/g,' '),color:'#6b7a94',font:{size:10}}
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  // Panel card — no harsh borders, soft shadow
  panel: {
    background:'var(--s1)',
    border:'1px solid rgba(255,255,255,.07)',
    borderRadius:14,
    overflow:'hidden',
    animation:'fadeUp .45s ease both',
    boxShadow:'0 2px 16px rgba(0,0,0,.35)',
  },
  updated: { animation:'panelFlash .7s ease' },

  // Header — clean horizontal row
  head: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'.6rem .95rem',
    background:'rgba(255,255,255,.025)',
    borderBottom:'1px solid rgba(255,255,255,.06)',
    gap:'.5rem',
  },
  headLeft: { display:'flex', alignItems:'center', gap:'.55rem', minWidth:0 },
  headActions:{ display:'flex', alignItems:'center', gap:'.4rem' },
  confBadge: {
    display:'flex', alignItems:'center', gap:'.28rem',
    fontSize:'.58rem', fontFamily:"'JetBrains Mono',monospace",
    border:'1px solid', borderRadius:5, padding:'.1rem .38rem', flexShrink:0,
  },
  confDot: { width:5, height:5, borderRadius:'50%', flexShrink:0 },
  speed: { fontSize:'.58rem', fontFamily:"'JetBrains Mono',monospace", color:'rgba(74,222,128,.7)' },
  title: {
    fontFamily:"'Syne',sans-serif",
    fontSize:'.78rem', fontWeight:700,
    color:'var(--text)',
    letterSpacing:'-.01em',
    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
  },
  tag: {
    flexShrink:0,
    fontSize:'.57rem', fontFamily:"'JetBrains Mono',monospace",
    background:'rgba(232,255,71,.08)',
    color:'#c8e832',
    border:'1px solid rgba(232,255,71,.15)',
    borderRadius:5, padding:'.1rem .42rem',
    letterSpacing:'.04em',
  },

  // Download button — icon + label, no heavy border
  dlBtn: {
    display:'flex', alignItems:'center', gap:'.28rem',
    background:'transparent',
    border:'1px solid rgba(0,212,255,.2)',
    borderRadius:6,
    color:'rgba(0,212,255,.7)',
    fontSize:'.63rem', fontFamily:"'JetBrains Mono',monospace",
    padding:'.22rem .55rem',
    cursor:'pointer',
    flexShrink:0,
    transition:'all .15s',
  },

  // Insight — clean sentence, not a box
  insight: {
    display:'flex', alignItems:'flex-start', gap:'.5rem',
    padding:'.5rem .95rem',
    fontSize:'.75rem',
    color:'#a8b8d0',
    lineHeight:1.55,
    borderBottom:'1px solid rgba(255,255,255,.04)',
  },
  insightDot: {
    color:'var(--accent2)', fontSize:'.45rem',
    flexShrink:0, marginTop:'.38rem',
  },

  // Reasoning — tiny muted line, no background block
  reasoning: {
    padding:'.3rem .95rem',
    fontSize:'.63rem',
    color:'rgba(107,122,148,.7)',
    fontFamily:"'JetBrains Mono',monospace",
    fontStyle:'italic',
    borderBottom:'1px solid rgba(255,255,255,.03)',
    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
    cursor:'help',
  },

  body: { padding:'.85rem .95rem' },
  chartWrap: { position:'relative', height:230 },

  // KPI
  kpi:    { display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:185,gap:'.4rem' },
  kpiVal: { fontFamily:"'JetBrains Mono',monospace",fontSize:'2.8rem',fontWeight:700,color:'var(--accent)',letterSpacing:'-.04em',lineHeight:1 },
  kpiLbl: { fontSize:'.72rem',color:'var(--muted2)',textTransform:'uppercase',letterSpacing:'.12em',marginTop:'.1rem' },
  trend:  { fontSize:'.7rem',fontFamily:"'JetBrains Mono',monospace",fontWeight:600,marginTop:'.15rem' },

  // Table
  tblWrap: { overflowX:'auto',maxHeight:270,overflowY:'auto' },
  tbl:     { width:'100%',borderCollapse:'collapse' },
  th: {
    fontFamily:"'JetBrains Mono',monospace",fontSize:'.58rem',fontWeight:500,
    textTransform:'uppercase',letterSpacing:'.1em',color:'var(--muted)',
    padding:'.4rem .65rem',
    background:'rgba(255,255,255,.025)',
    position:'sticky',top:0,
    borderBottom:'1px solid rgba(255,255,255,.06)',
    textAlign:'left',whiteSpace:'nowrap',
  },
  td: {
    padding:'.4rem .65rem',
    borderBottom:'1px solid rgba(255,255,255,.04)',
    fontFamily:"'JetBrains Mono',monospace",
    fontSize:'.69rem',color:'#a8b8d0',
  },
  sqlErr: {
    background:'rgba(255,107,107,.06)',
    border:'1px solid rgba(255,107,107,.15)',
    borderRadius:8,padding:'.65rem .85rem',
    fontSize:'.73rem',fontFamily:"'JetBrains Mono',monospace",color:'var(--accent3)',
  },
  noRows: { textAlign:'center',padding:'1.5rem',color:'var(--muted)',fontSize:'.78rem' },

  // Footer
  foot: {
    display:'flex',justifyContent:'space-between',alignItems:'center',
    padding:'.35rem .95rem',
    background:'rgba(255,255,255,.018)',
    borderTop:'1px solid rgba(255,255,255,.05)',
  },
  rows: { fontSize:'.6rem',fontFamily:"'JetBrains Mono',monospace",color:'rgba(0,212,255,.6)' },
  sql:  { color:'rgba(107,122,148,.5)',fontSize:'.6rem',fontFamily:"'JetBrains Mono',monospace' " },
}
