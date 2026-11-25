import { jsPDF } from 'jspdf'
import type { RangeData, DaySeries } from './stats'
import { activityInsights, avg, medAdherence, series, sideEffectSummary } from './stats'
import { formatDayMonth, formatShort, minutesToHM, todayStr } from './dates'
import { PHQ_SHORT, PHQ_OPTIONS, phqSeverity } from './phq9'
import { SOCIAL, SUBSTANCE_KINDS } from './labels'

export interface ReportOptions {
  name: string
  includeNotes: boolean
}

const M = 16 // Rand mm
const W = 210
const H = 297
const CW = W - 2 * M
const INK: [number, number, number] = [40, 44, 48]
const MUTED: [number, number, number] = [110, 116, 122]
const ACCENT: [number, number, number] = [74, 124, 104]
const LIGHT: [number, number, number] = [232, 236, 233]

/** Entfernt Zeichen, die die Standardschrift nicht kennt (Emojis etc.) */
function clean(s: string): string {
  return s
    .replace(/[→]/g, '->')
    .replace(/[≥]/g, '>=')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\u0000-ÿ–—‘’‚“”„•…€]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const f1 = (v?: number) => (v == null ? '–' : v.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 }))
const f0 = (v?: number) => (v == null ? '–' : Math.round(v).toLocaleString('de-DE'))

class Doc {
  pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  y = M
  page = 1
  footer: string
  constructor(footer: string) {
    this.footer = footer
    this.pdf.setFont('helvetica', 'normal')
    this.drawFooter()
  }
  drawFooter() {
    const p = this.pdf
    p.setFontSize(8)
    p.setTextColor(...MUTED)
    p.text(clean(this.footer), M, H - 8)
    p.text(`Seite ${this.page}`, W - M, H - 8, { align: 'right' })
  }
  ensure(h: number) {
    if (this.y + h > H - 16) {
      const p = this.pdf
      // Schriftzustand merken, die Fußzeile ändert ihn
      const size = p.getFontSize()
      const font = p.getFont()
      const color = p.getTextColor()
      p.addPage()
      this.page++
      this.y = M
      this.drawFooter()
      p.setFont(font.fontName, font.fontStyle)
      p.setFontSize(size)
      p.setTextColor(color)
    }
  }
  h1(t: string) {
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.setFontSize(18)
    this.pdf.setTextColor(...INK)
    this.pdf.text(clean(t), M, this.y + 6)
    this.y += 10
  }
  h2(t: string) {
    this.ensure(16)
    this.y += 3
    this.pdf.setDrawColor(...ACCENT)
    this.pdf.setLineWidth(0.6)
    this.pdf.line(M, this.y, M + 8, this.y)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.setFontSize(12)
    this.pdf.setTextColor(...ACCENT)
    this.pdf.text(clean(t), M, this.y + 5.5)
    this.y += 9
  }
  text(t: string, opts: { size?: number; color?: [number, number, number]; bold?: boolean; indent?: number } = {}) {
    const size = opts.size ?? 9.5
    const p = this.pdf
    p.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    p.setFontSize(size)
    p.setTextColor(...(opts.color ?? INK))
    const lines = p.splitTextToSize(clean(t), CW - (opts.indent ?? 0)) as string[]
    const lh = size * 0.42
    for (const l of lines) {
      this.ensure(lh + 1)
      p.text(l, M + (opts.indent ?? 0), this.y + lh)
      this.y += lh
    }
    this.y += 1.2
  }
  /** Tabelle: einfache Zeilen mit festen Spaltenbreiten (Anteile) */
  table(head: string[], rows: string[][], widths: number[]) {
    const p = this.pdf
    const total = widths.reduce((a, b) => a + b, 0)
    const cols = widths.map((w) => (w / total) * CW)
    const drawRow = (r: string[], bold: boolean, shade: boolean) => {
      p.setFont('helvetica', bold ? 'bold' : 'normal')
      p.setFontSize(8.8)
      const cells = r.map((c, i) => p.splitTextToSize(clean(c), cols[i] - 2) as string[])
      const lines = Math.max(...cells.map((c) => c.length))
      const h = lines * 3.8 + 2.2
      this.ensure(h)
      if (shade) {
        p.setFillColor(...LIGHT)
        p.rect(M, this.y, CW, h, 'F')
      }
      p.setTextColor(...(bold ? MUTED : INK))
      let x = M
      cells.forEach((c, i) => {
        c.forEach((l, j) => p.text(l, x + 1, this.y + 3.6 + j * 3.8))
        x += cols[i]
      })
      this.y += h
    }
    drawRow(head, true, false)
    p.setDrawColor(...MUTED)
    p.setLineWidth(0.2)
    p.line(M, this.y, M + CW, this.y)
    rows.forEach((r, i) => drawRow(r, false, i % 2 === 1))
    this.y += 2
  }
  /** Zahlenreihe als Kennzahlen-Kacheln */
  stats(items: { label: string; value: string }[]) {
    const p = this.pdf
    const perRow = 4
    const cw = CW / perRow
    for (let i = 0; i < items.length; i += perRow) {
      this.ensure(15)
      items.slice(i, i + perRow).forEach((it, j) => {
        const x = M + j * cw
        p.setFillColor(...LIGHT)
        p.roundedRect(x + 0.5, this.y, cw - 1.5, 13, 1.5, 1.5, 'F')
        p.setFont('helvetica', 'bold')
        p.setFontSize(11)
        p.setTextColor(...INK)
        p.text(clean(it.value), x + 3, this.y + 6)
        p.setFont('helvetica', 'normal')
        p.setFontSize(7.5)
        p.setTextColor(...MUTED)
        p.text(clean(it.label), x + 3, this.y + 10.5)
      })
      this.y += 15
    }
    this.y += 1
  }
  /** Diagramm: Balken oder Linie über Tage */
  chart(data: { date: string; value?: number }[], o: { min?: number; max: number; type: 'bar' | 'line'; unit?: string; height?: number; refLine?: number }) {
    const p = this.pdf
    const h = o.height ?? 32
    this.ensure(h + 8)
    const x0 = M + 8
    const w = CW - 8
    const y0 = this.y
    const min = o.min ?? 0
    const yv = (v: number) => y0 + h - ((v - min) / (o.max - min)) * h
    // Achsen / Hilfslinien
    p.setDrawColor(...LIGHT)
    p.setLineWidth(0.2)
    p.setFontSize(6.5)
    p.setTextColor(...MUTED)
    for (let k = 0; k <= 2; k++) {
      const v = min + ((o.max - min) * k) / 2
      p.line(x0, yv(v), x0 + w, yv(v))
      p.text(v.toLocaleString('de-DE', { maximumFractionDigits: o.max - min > 20 ? 0 : 1 }), x0 - 1.5, yv(v) + 1, { align: 'right' })
    }
    if (o.refLine != null) {
      p.setDrawColor(...ACCENT)
      p.setLineDashPattern([1, 1], 0)
      p.line(x0, yv(o.refLine), x0 + w, yv(o.refLine))
      p.setLineDashPattern([], 0)
    }
    const n = data.length
    const step = w / Math.max(1, n)
    p.setFillColor(...ACCENT)
    p.setDrawColor(...ACCENT)
    p.setLineWidth(0.6)
    let prev: { x: number; y: number } | null = null
    data.forEach((d, i) => {
      const cx = x0 + i * step + step / 2
      if (d.value == null) {
        prev = null
        return
      }
      const v = Math.min(o.max, Math.max(min, d.value))
      if (o.type === 'bar') {
        const bw = Math.max(0.8, step * 0.65)
        p.rect(cx - bw / 2, yv(v), bw, y0 + h - yv(v), 'F')
      } else {
        const pt = { x: cx, y: yv(v) }
        if (prev) p.line(prev.x, prev.y, pt.x, pt.y)
        p.circle(pt.x, pt.y, 0.7, 'F')
        prev = pt
      }
    })
    // Datumsbeschriftung
    p.setFontSize(6.5)
    p.setTextColor(...MUTED)
    const every = Math.ceil(n / 10)
    data.forEach((d, i) => {
      if (i % every === 0) p.text(formatDayMonth(d.date), x0 + i * step + step / 2, y0 + h + 3.5, { align: 'center' })
    })
    this.y += h + 7
  }
}

export function buildReportPdf(r: RangeData, opt: ReportOptions): Blob {
  const ser: DaySeries[] = series(r)
  const today = todayStr()
  const doc = new Doc(`Depri · Verlaufsbericht ${formatShort(r.from)} – ${formatShort(r.to)} · selbst erfasste Daten`)
  const vals = <K extends keyof DaySeries>(k: K) => ser.map((x) => x[k]).filter((v): v is NonNullable<DaySeries[K]> => v != null) as number[]
  const tracked = ser.filter((x) => x.mood != null || x.meals || x.drinkMl != null || x.steps != null || x.sleepMin != null).length

  // ---------- Kopf ----------
  doc.h1('Verlaufsbericht')
  doc.text(
    [opt.name ? `Name: ${opt.name}` : '', `Zeitraum: ${formatShort(r.from)} – ${formatShort(r.to)} (${r.days.length} Tage)`, `Erstellt am ${formatShort(today)}`]
      .filter(Boolean)
      .join('   ·   '),
    { color: MUTED },
  )
  doc.text(
    `Selbst erfasste Angaben aus einer Tagebuch-App. Einträge an ${tracked} von ${r.days.length} Tagen. Fehlende Werte bedeuten „nicht eingetragen“, nicht „nicht vorhanden“.`,
    { size: 8.5, color: MUTED },
  )

  // ---------- Überblick ----------
  doc.h2('Überblick')
  const outsideDays = ser.filter((x) => (x.outsideMin ?? 0) > 0).length
  const socialDays = ser.filter((x) => x.social && x.social !== 'keine').length
  const reviewDays = ser.filter((x) => x.social != null || x.outsideMin != null).length
  const alcoholDays = ser.filter((x) => x.alcohol > 0).length
  doc.stats([
    { label: 'Stimmung Ø (1–5)', value: f1(avg(vals('mood'))) },
    { label: 'Energie Ø (1–5)', value: f1(avg(vals('energy'))) },
    { label: 'Schlaf Ø pro Nacht', value: minutesToHM(avg(vals('sleepMin'))) },
    { label: 'Schlafqualität Ø (1–5)', value: f1(avg(vals('sleepQuality'))) },
    { label: 'Schritte Ø pro Tag', value: f0(avg(vals('steps'))) },
    { label: 'Aktive Minuten Ø / Tag', value: f0(avg(ser.map((x) => x.activeMin))) },
    { label: 'Trinkmenge Ø / Tag', value: avg(vals('drinkMl')) != null ? `${f1(avg(vals('drinkMl'))! / 1000)} l` : '–' },
    { label: 'Mahlzeiten Ø / Tag', value: f1(avg(ser.filter((x) => x.meals > 0 || x.drinkMl != null).map((x) => x.meals))) },
    { label: 'Tage draußen', value: reviewDays ? `${outsideDays} von ${reviewDays}` : '–' },
    { label: 'Tage mit sozialem Kontakt', value: reviewDays ? `${socialDays} von ${reviewDays}` : '–' },
    { label: 'Alkohol (Gläser gesamt)', value: `${ser.reduce((a, x) => a + x.alcohol, 0)} an ${alcoholDays} Tagen` },
    { label: 'Koffein-Getränke Ø / Tag', value: f1(avg(ser.map((x) => x.caffeine))) },
  ])

  // ---------- PHQ-9 ----------
  const phqIn = r.phq9.filter((p) => p.date >= r.from && p.date <= r.to)
  const phqBefore = r.phq9.filter((p) => p.date < r.from).slice(-1)
  doc.h2('PHQ-9 (Gesundheitsfragebogen)')
  if (!phqIn.length && !phqBefore.length) doc.text('Im Zeitraum nicht ausgefüllt.', { color: MUTED })
  else {
    const rows = [...phqBefore, ...phqIn].map((p) => [
      formatShort(p.date) + (p.date < r.from ? ' (davor)' : ''),
      String(p.score),
      phqSeverity(p.score).label,
      p.answers[8] > 0 ? `ja (${PHQ_OPTIONS[p.answers[8]]})` : 'nein',
    ])
    doc.table(['Datum', 'Summe (0–27)', 'Schweregrad', 'Item 9 (Suizidgedanken)'], rows, [2, 1.5, 2, 3])
    const latest = phqIn[phqIn.length - 1]
    if (latest) {
      doc.text(`Einzelwerte vom ${formatShort(latest.date)}:`, { bold: true, size: 9 })
      doc.text(latest.answers.map((a, i) => `${i + 1}. ${PHQ_SHORT[i]}: ${a}`).join('  ·  '), { size: 8.5 })
    }
    if ([...phqIn].some((p) => p.answers[8] > 0)) {
      doc.text('Hinweis: Item 9 wurde im Zeitraum mit mehr als „überhaupt nicht“ beantwortet.', { bold: true, size: 9 })
    }
  }

  // ---------- Stimmung ----------
  doc.h2('Stimmung, Energie und Beschwerden')
  if (!r.checkins.length) doc.text('Keine Check-ins im Zeitraum.', { color: MUTED })
  else {
    doc.text(`Stimmung pro Tag (Ø, 1 = sehr schlecht, 5 = sehr gut) · ${r.checkins.length} Check-ins`, { size: 8.5, color: MUTED })
    doc.chart(ser.map((x) => ({ date: x.date, value: x.mood })), { min: 1, max: 5, type: 'line' })
    doc.text('Energie pro Tag (Ø, 1–5)', { size: 8.5, color: MUTED })
    doc.chart(ser.map((x) => ({ date: x.date, value: x.energy })), { min: 1, max: 5, type: 'line', height: 24 })
    const symKeys = [
      ['anxiety', 'Angst / Unruhe'],
      ['drive', 'Antriebslosigkeit'],
      ['concentration', 'Konzentrationsprobleme'],
      ['rumination', 'Grübeln'],
      ['appetite', 'Appetitveränderung'],
    ] as const
    const rows = symKeys
      .map(([k, l]) => {
        const v = r.checkins.map((c) => c[k]).filter((x): x is number => x != null)
        return v.length ? [l, f1(avg(v)), String(Math.max(...v)), String(v.length)] : null
      })
      .filter((x): x is string[] => !!x)
    if (rows.length) doc.table(['Beschwerde (0 = gar nicht, 4 = sehr stark)', 'Ø', 'Maximum', 'Angaben'], rows, [4, 1, 1, 1])
  }

  // ---------- Schlaf ----------
  doc.h2('Schlaf')
  if (!r.sleep.length) doc.text('Keine Schlafdaten im Zeitraum.', { color: MUTED })
  else {
    const lat = r.sleep.map((s) => s.latencyMin).filter((x): x is number => x != null)
    const aw = r.sleep.map((s) => s.awakenings).filter((x): x is number => x != null)
    const naps = r.sleep.map((s) => s.napMin).filter((x): x is number => !!x)
    doc.text(
      [
        `Ø Schlafdauer ${minutesToHM(avg(vals('sleepMin')))}`,
        lat.length ? `Ø Einschlafdauer ${f0(avg(lat))} min` : '',
        aw.length ? `Ø ${f1(avg(aw))}× nachts aufgewacht` : '',
        naps.length ? `Mittagsschlaf an ${naps.length} Tagen (Ø ${f0(avg(naps))} min)` : '',
        `Kürzeste Nacht ${minutesToHM(Math.min(...vals('sleepMin')))}, längste ${minutesToHM(Math.max(...vals('sleepMin')))}`,
      ]
        .filter(Boolean)
        .join(' · '),
    )
    doc.text('Schlafdauer pro Nacht (Stunden)', { size: 8.5, color: MUTED })
    doc.chart(ser.map((x) => ({ date: x.date, value: x.sleepMin != null ? x.sleepMin / 60 : undefined })), { max: Math.max(10, ...vals('sleepMin').map((v) => v / 60)), type: 'bar' })
  }

  // ---------- Medikamente ----------
  doc.h2('Medikamente')
  const adh = medAdherence(r).filter((a) => a.planned > 0 || a.changes.length || a.effects.length)
  if (!adh.length) doc.text('Keine Medikamente erfasst.', { color: MUTED })
  else {
    doc.table(
      ['Medikament', 'Aktuelle Dosis / Zeiten', 'Einnahme', 'Vergessen', 'Ausgelassen'],
      adh.map((a) => [
        a.med.name + (a.med.active ? '' : ' (abgesetzt)'),
        `${a.med.dose} · ${a.med.times.join(', ')}`,
        a.pct != null ? `${Math.round(a.pct)} % (${a.taken}/${a.planned})` : '–',
        String(a.missed),
        String(a.skipped),
      ]),
      [2, 2.3, 1.8, 1.2, 1.3],
    )
    for (const a of adh) {
      if (a.changes.length)
        doc.text(`${a.med.name} – Änderungen: ${a.changes.map((c) => `${formatShort(c.date)} ${c.dose}${c.note ? ` (${c.note})` : ''}`).join('; ')}`, { size: 8.8 })
      if (a.missedDays.length && a.missed > 0)
        doc.text(`${a.med.name} – nicht als genommen markiert an: ${a.missedDays.slice(0, 14).map(formatDayMonth).join(', ')}${a.missedDays.length > 14 ? ' …' : ''}`, { size: 8.3, color: MUTED })
    }
    doc.text('Hinweis: Nicht abgehakte Einnahmen werden als „vergessen“ gezählt.', { size: 7.8, color: MUTED })
  }
  const se = sideEffectSummary(r.sideEffects)
  if (se.length) {
    doc.text('Nebenwirkungen', { bold: true })
    const sevLabel = (v: number) => (v < 1.5 ? 'leicht' : v < 2.5 ? 'mittel' : 'stark')
    doc.table(
      ['Beschwerde', 'Häufigkeit', 'Ø Stärke', 'Vermutetes Medikament', 'Zuerst'],
      se.map((e) => {
        const all = r.sideEffects.filter((x) => x.kind === e.kind)
        const meds = [...new Set(all.map((x) => r.meds.find((m) => m.id === x.medId)?.name).filter(Boolean))].join(', ')
        return [e.kind, `${e.count}×`, sevLabel(e.severity), meds || '–', formatShort(all.map((x) => x.date).sort()[0])]
      }),
      [2.2, 1, 1, 2.2, 1.4],
    )
  }

  // ---------- Bewegung & Alltag ----------
  doc.h2('Bewegung, Essen und Alltag')
  if (vals('steps').length) {
    doc.text('Schritte pro Tag', { size: 8.5, color: MUTED })
    doc.chart(ser.map((x) => ({ date: x.date, value: x.steps })), { max: Math.max(...vals('steps'), 1000), type: 'bar', height: 26 })
  }
  const ins = activityInsights(r.activities)
  if (ins.length)
    doc.table(
      ['Aktivität', 'Anzahl', 'Minuten gesamt', 'Freude Ø (0–10)', 'Erfolg Ø (0–10)'],
      ins.map((i) => [i.label, String(i.count), String(i.minutes), f1(i.joy), f1(i.achievement)]),
      [2.2, 1, 1.4, 1.4, 1.4],
    )
  const mealDays = ser.filter((x) => x.meals > 0)
  if (mealDays.length) {
    const small = r.meals.filter((m) => m.size === 'klein').length
    doc.text(
      `Mahlzeiten an ${mealDays.length} Tagen erfasst, Ø ${f1(avg(mealDays.map((x) => x.meals)))} pro Tag. ${small ? `${small} davon als „kleine“ Portion.` : ''} Tage mit nur 0–1 Mahlzeit: ${mealDays.filter((x) => x.meals <= 1).length}.`,
    )
  }
  const subs = SUBSTANCE_KINDS.map((k) => {
    const list = r.substances.filter((s) => s.kind === k.value)
    return list.length ? `${k.label}: ${list.reduce((a, s) => a + s.amount, 0)} ${k.unit} an ${new Set(list.map((s) => s.date)).size} Tagen` : ''
  }).filter(Boolean)
  if (subs.length) doc.text(`Substanzen: ${subs.join(' · ')}`)
  const socialCount = SOCIAL.map((s) => `${s.label}: ${r.reviews.filter((v) => v.social === s.value).length}`).join(', ')
  if (r.reviews.length) doc.text(`Soziale Kontakte (Tage): ${socialCount}. Zeit draußen Ø ${f0(avg(r.reviews.map((v) => v.outsideMin ?? 0)))} min.`)
  const weights = r.reviews.filter((v) => v.weightKg).sort((a, b) => a.date.localeCompare(b.date))
  if (weights.length >= 1)
    doc.text(
      `Gewicht: ${weights[0].weightKg} kg (${formatShort(weights[0].date)})${weights.length > 1 ? ` -> ${weights[weights.length - 1].weightKg} kg (${formatShort(weights[weights.length - 1].date)})` : ''}`,
    )

  // ---------- Ereignisse ----------
  const events = r.reviews.filter((v) => v.tags.length || v.events)
  const notes = opt.includeNotes ? r.checkins.filter((c) => c.note) : []
  if (events.length || notes.length) {
    doc.h2('Besondere Ereignisse')
    const rows: string[][] = events.map((v) => [formatShort(v.date), [v.tags.join(', '), v.events].filter(Boolean).join(' – ')])
    for (const c of notes) rows.push([formatShort(c.date), `Notiz (Stimmung ${c.mood}/5): ${c.note}`])
    rows.sort((a, b) => a[0].split('.').reverse().join().localeCompare(b[0].split('.').reverse().join()))
    doc.table(['Datum', 'Ereignis'], rows, [1, 6])
  }

  // ---------- Fragen ----------
  const open = r.questions.filter((q) => !q.done)
  doc.h2('Fragen für das Gespräch')
  if (!open.length) doc.text('Keine offenen Fragen notiert.', { color: MUTED })
  else open.forEach((q) => doc.text(`•  ${q.text}`, { indent: 2 }))

  const next = r.appointments.find((a) => a.date >= today)
  if (next) doc.text(`Nächster Termin: ${formatShort(next.date)}${next.time ? ` ${next.time}` : ''} · ${next.kind}${next.who ? ` · ${next.who}` : ''}`, { color: MUTED, size: 8.5 })

  return doc.pdf.output('blob')
}
