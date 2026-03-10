// PDFExport.jsx — One-click branded PDF report with charts + insights
import React, { useState } from 'react'

const PdfIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 2v6h6M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

export default function PDFExport({ result, csvInfo }) {
  const [exporting, setExporting] = useState(false)

  async function exportPDF() {
    if (!result?.panels?.length) return
    setExporting(true)

    try {
      // Dynamic import — only loads when user clicks
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])

      const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W      = 210  // A4 width mm
      const margin = 14
      const inner  = W - margin * 2
      let   y      = margin

      // ── Brand header ────────────────────────────────────────────────────────
      pdf.setFillColor(14, 16, 22)
      pdf.rect(0, 0, W, 28, 'F')

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.setTextColor(232, 255, 71)
      pdf.text('Pulse BI', margin, 17)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(107, 122, 148)
      pdf.text(`Generated ${new Date().toLocaleString()}`, W - margin, 17, { align: 'right' })

      y = 36

      // ── Dashboard title ──────────────────────────────────────────────────────
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(15)
      pdf.setTextColor(221, 226, 236)
      pdf.text(result.dashboard_title || 'Dashboard', margin, y)
      y += 7

      // ── Summary ──────────────────────────────────────────────────────────────
      if (result.summary) {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.setTextColor(136, 150, 176)
        const lines = pdf.splitTextToSize(result.summary, inner)
        pdf.text(lines, margin, y)
        y += lines.length * 4.5 + 3
      }

      // ── CSV info pill ────────────────────────────────────────────────────────
      if (csvInfo?.filename) {
        pdf.setFillColor(26, 30, 40)
        pdf.roundedRect(margin, y, inner, 8, 2, 2, 'F')
        pdf.setFontSize(7.5)
        pdf.setTextColor(74, 222, 128)
        pdf.text(`📄 ${csvInfo.filename}  ·  ${Number(csvInfo.rowCount).toLocaleString()} rows  ·  ${csvInfo.colCount} columns`, margin + 3, y + 5.2)
        y += 13
      }

      // ── TL;DR bullets ────────────────────────────────────────────────────────
      if (result.tldr?.length) {
        pdf.setFillColor(18, 20, 28)
        pdf.setDrawColor(232, 255, 71, 0.3)
        const tldrH = result.tldr.length * 7 + 10
        pdf.roundedRect(margin, y, inner, tldrH, 3, 3, 'FD')

        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(7)
        pdf.setTextColor(232, 255, 71)
        pdf.text('AI ANALYST SUMMARY', margin + 4, y + 6)

        let by = y + 12
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8.5)
        pdf.setTextColor(176, 189, 208)
        result.tldr.forEach(item => {
          const lines = pdf.splitTextToSize(`${item.emoji || '•'}  ${item.text}`, inner - 8)
          pdf.text(lines, margin + 4, by)
          by += lines.length * 5
        })
        y += tldrH + 6
      }

      // ── Panels: capture each chart canvas ────────────────────────────────────
      const panelEls = document.querySelectorAll('[data-panel-idx]')

      for (let i = 0; i < result.panels.length; i++) {
        const panel  = result.panels[i]
        const panelEl = document.querySelector(`[data-panel-idx="${i}"]`)

        // Page break if needed
        if (y > 240) { pdf.addPage(); y = margin }

        // Panel title bar
        pdf.setFillColor(26, 30, 40)
        pdf.roundedRect(margin, y, inner, 7, 2, 2, 'F')
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(8)
        pdf.setTextColor(221, 226, 236)
        pdf.text((panel.title || `Panel ${i+1}`).toUpperCase(), margin + 3, y + 4.8)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7)
        pdf.setTextColor(200, 232, 50)
        pdf.text(panel.chart_type || 'Chart', W - margin - 3, y + 4.8, { align: 'right' })
        y += 9

        // Capture chart canvas
        const canvas = panelEl?.querySelector('canvas')
        if (canvas) {
          try {
            // Render canvas to image directly
            const imgData = canvas.toDataURL('image/png')
            const aspect  = canvas.height / canvas.width
            const imgW    = inner
            const imgH    = Math.min(imgW * aspect, 65)
            if (y + imgH > 280) { pdf.addPage(); y = margin }
            pdf.addImage(imgData, 'PNG', margin, y, imgW, imgH)
            y += imgH + 4
          } catch {
            y += 2
          }
        }

        // Insight text
        if (panel.insight) {
          pdf.setFont('helvetica', 'italic')
          pdf.setFontSize(8)
          pdf.setTextColor(136, 150, 176)
          const lines = pdf.splitTextToSize(`💡 ${panel.insight}`, inner)
          if (y + lines.length * 4.5 > 282) { pdf.addPage(); y = margin }
          pdf.text(lines, margin, y)
          y += lines.length * 4.5 + 5
        } else {
          y += 3
        }
      }

      // ── Anomaly section ──────────────────────────────────────────────────────
      // (passed via window if available — lightweight approach)
      const anomalies = window.__pulseAnomalies || []
      if (anomalies.length > 0) {
        if (y > 240) { pdf.addPage(); y = margin }
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10)
        pdf.setTextColor(255, 107, 107)
        pdf.text('⚡ Anomaly Report', margin, y); y += 7

        anomalies.slice(0, 5).forEach(a => {
          const sevColor = a.severity==='critical' ? [255,107,107] : a.severity==='warning' ? [251,191,36] : [0,212,255]
          pdf.setFillColor(...sevColor, 0.08)
          pdf.roundedRect(margin, y, inner, 9, 2, 2, 'F')
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(8)
          pdf.setTextColor(...sevColor)
          pdf.text(`${a.column}`, margin + 3, y + 5.8)
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(136, 150, 176)
          pdf.text(`${a.outlier_pct}% outliers · ${a.type} · mean ${a.mean}`, margin + 40, y + 5.8)
          y += 11
        })
        y += 4
      }

      // ── Footer on every page ─────────────────────────────────────────────────
      const totalPages = pdf.internal.getNumberOfPages()
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p)
        pdf.setFillColor(14, 16, 22)
        pdf.rect(0, 292, W, 10, 'F')
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7)
        pdf.setTextColor(74, 84, 104)
        pdf.text('Pulse BI — Confidential', margin, 298)
        pdf.text(`Page ${p} of ${totalPages}`, W - margin, 298, { align: 'right' })
      }

      const filename = `${(result.dashboard_title||'report').replace(/\s+/g,'-').toLowerCase()}.pdf`
      pdf.save(filename)

    } catch (err) {
      console.error('[PDF]', err)
      alert('PDF export failed: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  if (!result?.panels?.length) return null

  return (
    <button
      style={{ ...s.btn, opacity: exporting ? .6 : 1 }}
      onClick={exportPDF}
      disabled={exporting}
      title="Export full dashboard as PDF report"
    >
      <PdfIcon />
      <span>{exporting ? 'Exporting…' : 'Export PDF'}</span>
    </button>
  )
}

const s = {
  btn: {
    display: 'flex', alignItems: 'center', gap: '.35rem',
    background: 'rgba(232,255,71,.08)',
    border: '1px solid rgba(232,255,71,.2)',
    borderRadius: 8,
    color: 'rgba(232,255,71,.85)',
    fontFamily: "'Syne', sans-serif",
    fontWeight: 700, fontSize: '.7rem',
    letterSpacing: '.04em',
    padding: '.38rem .8rem',
    cursor: 'pointer',
    transition: 'all .2s',
    whiteSpace: 'nowrap',
  },
}
