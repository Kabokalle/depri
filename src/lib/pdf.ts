import { jsPDF } from 'jspdf'
import type { RangeData, DaySeries } from './stats'
import { activityInsights, avg, medAdherence, series, sideEffectSummary } from './stats'
import { formatDayMonth, formatShort, minutesToHM, todayStr } from './dates'
import { PHQ_SHORT, PHQ_OPTIONS, phqSeverity } from './phq9'
import { SOCIAL, SUBSTANCE_KINDS } from './labels'
import { sumNutrition } from './food'
import { analyze, buildDays, isSweetDrink, isSweetMeal } from './insights'
import { addDays, weekdayShort } from './dates'

export interface ReportOptions {
  name: string
  includeNotes: boolean
  /** ausführliche Auswertung: Rhythmus, Zusammenhänge, Tagestabelle */
  detailed?: boolean
  /** Zyklus auswerten */
  cycle?: boolean
}

type RGB = [number, number, number]
const C_SLEEP: RGB = [196, 198, 232]
const C_MEAL: RGB = [96, 102, 108]
const C_SWEET: RGB = [232, 140, 56]
const C_CAF: RGB = [125, 84, 52]
const C_ALC: RGB = [150, 88, 170]
const C_CIG: RGB = [120, 120, 120]
const C_MED: RGB = [74, 124, 104]
const C_MISS: RGB = [205, 78, 66]
const moodColor = (m: number): RGB => {
  const t = Math.max(0, Math.min(1, (m - 1) / 4))
  return t < 0.5 ? [220, Math.round(90 + t * 2 * 110), 70] : [Math.round(220 - (t - 0.5) * 2 * 140), 190, 90]
}

export interface RhythmDay {
  date: string
  sleep: [number, number][]
  meals: { t: number; sweet: boolean; craving: boolean; sugar?: number }[]
  sweetDrinks: { t: number; sugar?: number }[]
  caffeine: number[]
  alcohol: number[]
  cigs: number[]
  medTaken: number[]
  medMissed: number[]
  moods: { t: number; mood: number }[]
}

const M = 16 // Rand mm
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
  W = 210
  H = 297
  get CW() {
    return this.W - 2 * M
  }
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
    p.setFont('helvetica', 'normal')
    p.setFontSize(8)
    p.setTextColor(...MUTED)
    p.text(clean(this.footer), M, this.H - 8)
    p.text(`Seite ${this.page}`, this.W - M, this.H - 8, { align: 'right' })
  }
  ensure(h: number) {
    if (this.y + h > this.H - 16) {
      const p = this.pdf
      // Schriftzustand merken, die Fußzeile ändert ihn
      const size = p.getFontSize()
      const font = p.getFont()
      const color = p.getTextColor()
      p.addPage('a4', this.W > this.H ? 'landscape' : 'portrait')
      this.page++
      this.y = M
      this.drawFooter()
      p.setFont(font.fontName, font.fontStyle)
      p.setFontSize(size)
      p.setTextColor(color)
    }
  }
  /** Neue Seite, optional im Querformat */
  newPage(orientation: 'portrait' | 'landscape' = 'portrait') {
    const p = this.pdf
    p.addPage('a4', orientation)
    this.W = orientation === 'landscape' ? 297 : 210
    this.H = orientation === 'landscape' ? 210 : 297
    this.page++
    this.y = M
    this.drawFooter()
  }
  h1(t: string) {
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.setFontSize(18)
    this.pdf.setTextColor(...INK)
    this.pdf.text(clean(t), M, this.y + 6)
    this.y += 10
  }
  h2(t: string) {
    // Überschrift nie allein am Seitenende
    this.ensure(30)
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
    const lines = p.splitTextToSize(clean(t), this.CW - (opts.indent ?? 0)) as string[]
    const lh = size * 0.42
    for (const l of lines) {
      this.ensure(lh + 1)
      p.text(l, M + (opts.indent ?? 0), this.y + lh)
      this.y += lh
    }
    this.y += 1.2
  }
  /** Tabelle: einfache Zeilen mit festen Spaltenbreiten (Anteile) */
  table(head: string[], rows: string[][], widths: number[], fontSize = 8.8) {
    const p = this.pdf
    const lh = fontSize * 0.43
    const total = widths.reduce((a, b) => a + b, 0)
    const cols = widths.map((w) => (w / total) * this.CW)
    const drawRow = (r: string[], bold: boolean, shade: boolean) => {
      p.setFont('helvetica', bold ? 'bold' : 'normal')
      p.setFontSize(fontSize)
      const cells = r.map((c, i) => p.splitTextToSize(clean(c), cols[i] - 1.6) as string[])
      const lines = Math.max(...cells.map((c) => c.length))
      const h = lines * lh + 2.2
      this.ensure(h)
      if (shade) {
        p.setFillColor(...LIGHT)
        p.rect(M, this.y, this.CW, h, 'F')
      }
      p.setTextColor(...(bold ? MUTED : INK))
      let x = M
      cells.forEach((c, i) => {
        c.forEach((l, j) => p.text(l, x + 0.8, this.y + lh + 0.9 + j * lh))
        x += cols[i]
      })
      this.y += h
    }
    // Kopf nur zusammen mit mindestens einer Zeile auf einer Seite
    this.ensure(lh * 6 + 8)
    drawRow(head, true, false)
    p.setDrawColor(...MUTED)
    p.setLineWidth(0.2)
    p.line(M, this.y, M + this.CW, this.y)
    rows.forEach((r, i) => drawRow(r, false, i % 2 === 1))
    this.y += 2
  }
  /** Zahlenreihe als Kennzahlen-Kacheln */
  stats(items: { label: string; value: string }[]) {
    const p = this.pdf
    const perRow = 4
    const cw = this.CW / perRow
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
  /** Tagesrhythmus: eine Zeile pro Tag auf einer 0–24-Uhr-Achse */
  rhythm(days: RhythmDay[]) {
    const p = this.pdf
    const labelW = 17
    const x0 = M + labelW
    const w = this.CW - labelW
    const rowH = days.length > 45 ? 3.6 : 4.6
    const X = (min: number) => x0 + (Math.max(0, Math.min(1440, min)) / 1440) * w
    const legend = () => {
      this.ensure(14)
      p.setFontSize(7)
      p.setFont('helvetica', 'normal')
      let lx = M
      let ly = this.y + 3
      const item = (draw: (x: number, y: number) => void, label: string) => {
        const wItem = 4 + p.getTextWidth(label) + 4
        if (lx + wItem > M + this.CW) {
          lx = M
          ly += 4.5
          this.y += 4.5
        }
        draw(lx + 1.5, ly - 1)
        p.setTextColor(...MUTED)
        p.text(label, lx + 4, ly)
        lx += wItem
      }
      item((x, y) => { p.setFillColor(...C_SLEEP); p.rect(x - 1.5, y - 1.2, 3, 2.4, 'F') }, 'Schlaf')
      item((x, y) => { p.setFillColor(...C_MEAL); p.circle(x, y, 0.9, 'F') }, 'Mahlzeit')
      item((x, y) => { p.setFillColor(...C_SWEET); p.circle(x, y, 1.1, 'F') }, 'Süßes (Größe = Zucker)')
      item((x, y) => { p.setFillColor(...C_SWEET); p.setDrawColor(...INK); p.setLineWidth(0.3); p.circle(x, y, 1.1, 'FD') }, 'Heißhunger')
      item((x, y) => { p.setFillColor(...C_CAF); p.triangle(x - 1, y + 0.8, x + 1, y + 0.8, x, y - 1, 'F') }, 'Koffein')
      item((x, y) => { p.setFillColor(...C_ALC); p.triangle(x - 1, y, x + 1, y, x, y - 1.2, 'F'); p.triangle(x - 1, y, x + 1, y, x, y + 1.2, 'F') }, 'Alkohol')
      item((x, y) => { p.setDrawColor(...C_CIG); p.setLineWidth(0.5); p.line(x, y - 1.2, x, y + 1.2) }, 'Zigarette')
      item((x, y) => { p.setFillColor(...C_MED); p.rect(x - 0.4, y - 1.2, 0.8, 2.4, 'F') }, 'Medikament genommen')
      item((x, y) => { p.setDrawColor(...C_MISS); p.setLineWidth(0.4); p.line(x - 0.9, y - 0.9, x + 0.9, y + 0.9); p.line(x - 0.9, y + 0.9, x + 0.9, y - 0.9) }, 'vergessen')
      item((x, y) => { p.setFillColor(...moodColor(1)); p.rect(x - 1.5, y - 0.6, 1.5, 1.2, 'F'); p.setFillColor(...moodColor(5)); p.rect(x, y - 0.6, 1.5, 1.2, 'F') }, 'Stimmung (rot = schlecht, grün = gut)')
      this.y += 6
    }
    const axis = () => {
      p.setFontSize(6.5)
      p.setTextColor(...MUTED)
      for (let h = 0; h <= 24; h += 3) p.text(`${h}`, X(h * 60), this.y + 2.5, { align: 'center' })
      this.y += 3.5
    }
    legend()
    axis()
    for (const d of days) {
      if (this.y + rowH > this.H - 18) {
        this.ensure(this.H)
        axis()
      }
      const top = this.y
      const mid = top + rowH / 2
      // Raster
      p.setDrawColor(...LIGHT)
      p.setLineWidth(0.15)
      for (let h = 0; h <= 24; h += 3) p.line(X(h * 60), top, X(h * 60), top + rowH)
      p.line(x0, top + rowH, x0 + w, top + rowH)
      p.setFontSize(7)
      p.setTextColor(...INK)
      p.text(`${weekdayShort(d.date)} ${formatDayMonth(d.date)}`, M, mid + 1.1)
      p.setFillColor(...C_SLEEP)
      for (const [a, b] of d.sleep) p.rect(X(a), top + 0.5, Math.max(0.4, X(b) - X(a)), rowH - 1, 'F')
      for (const m of d.moods) {
        p.setFillColor(...moodColor(m.mood))
        p.rect(X(m.t) - 0.9, top + rowH - 1.5, 1.8, 1.2, 'F')
      }
      for (const t of d.medTaken) {
        p.setFillColor(...C_MED)
        p.rect(X(t) - 0.35, top + 0.4, 0.7, rowH - 0.8, 'F')
      }
      p.setDrawColor(...C_MISS)
      p.setLineWidth(0.4)
      for (const t of d.medMissed) {
        const x = X(t)
        p.line(x - 0.9, mid - 0.9, x + 0.9, mid + 0.9)
        p.line(x - 0.9, mid + 0.9, x + 0.9, mid - 0.9)
      }
      p.setDrawColor(...C_CIG)
      p.setLineWidth(0.45)
      for (const t of d.cigs) p.line(X(t), top + 0.8, X(t), top + rowH - 0.8)
      for (const t of d.caffeine) {
        const x = X(t)
        p.setFillColor(...C_CAF)
        p.triangle(x - 0.9, top + 2, x + 0.9, top + 2, x, top + 0.3, 'F')
      }
      for (const t of d.alcohol) {
        const x = X(t)
        p.setFillColor(...C_ALC)
        p.triangle(x - 0.9, mid, x + 0.9, mid, x, mid - 1.2, 'F')
        p.triangle(x - 0.9, mid, x + 0.9, mid, x, mid + 1.2, 'F')
      }
      for (const m of d.meals) {
        if (m.sweet || m.craving) {
          p.setFillColor(...C_SWEET)
          const rr = 0.9 + Math.min(1.1, (m.sugar ?? 8) / 30)
          if (m.craving) {
            p.setDrawColor(...INK)
            p.setLineWidth(0.3)
            p.circle(X(m.t), mid, rr, 'FD')
          } else p.circle(X(m.t), mid, rr, 'F')
        } else {
          p.setFillColor(...C_MEAL)
          p.circle(X(m.t), mid, 0.9, 'F')
        }
      }
      for (const s of d.sweetDrinks) {
        p.setFillColor(...C_SWEET)
        p.circle(X(s.t), mid, 0.9 + Math.min(1.1, (s.sugar ?? 8) / 30), 'F')
      }
      this.y += rowH
    }
    this.y += 3
  }
  /** Diagramm: Balken oder Linie über Tage */
  chart(data: { date: string; value?: number }[], o: { min?: number; max: number; type: 'bar' | 'line'; unit?: string; height?: number; refLine?: number }) {
    const p = this.pdf
    const h = o.height ?? 32
    this.ensure(h + 8)
    const x0 = M + 8
    const w = this.CW - 8
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

const minOf = (ts: number) => {
  const d = new Date(ts)
  return d.getHours() * 60 + d.getMinutes()
}
const tMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function rhythmDays(r: RangeData): RhythmDay[] {
  const rows: RhythmDay[] = r.days.map((date) => ({ date, sleep: [], meals: [], sweetDrinks: [], caffeine: [], alcohol: [], cigs: [], medTaken: [], medMissed: [], moods: [] }))
  const row = (date: string) => rows.find((x) => x.date === date)
  for (const s of r.sleep) {
    if (!s.bed || !s.wake) continue
    const b = tMin(s.bed)
    const w = tMin(s.wake)
    if (b > w) {
      row(s.date)?.sleep.push([0, w])
      row(addDays(s.date, -1))?.sleep.push([b, 1440])
    } else row(s.date)?.sleep.push([b, w])
    if (s.napMin) row(s.date)?.sleep.push([14 * 60, 14 * 60 + s.napMin])
  }
  for (const m of r.meals) row(m.date)?.meals.push({ t: minOf(m.ts), sweet: isSweetMeal(m), craving: !!m.craving, sugar: m.nutrition?.sugar })
  for (const d of r.drinks) {
    if (isSweetDrink(d)) row(d.date)?.sweetDrinks.push({ t: minOf(d.ts), sugar: d.nutrition?.sugar })
    if (d.caffeine) row(d.date)?.caffeine.push(minOf(d.ts))
  }
  for (const x of r.substances) {
    if (x.kind === 'alkohol') row(x.date)?.alcohol.push(minOf(x.ts))
    if (x.kind === 'nikotin') for (let k = 0; k < x.amount; k++) row(x.date)?.cigs.push(minOf(x.ts) + k * 4)
  }
  for (const c of r.checkins) row(c.date)?.moods.push({ t: minOf(c.ts), mood: c.mood })
  const today = todayStr()
  for (const d of rows) {
    for (const m of r.meds) {
      if (!m.active || (m.history[0]?.date ?? '') > d.date) continue
      for (const slot of m.times) {
        const i = r.intakes.find((x) => x.medId === m.id && x.date === d.date && x.slot === slot)
        if (i?.status === 'taken') d.medTaken.push(minOf(i.ts))
        else if (!i || i.status === 'missed') {
          if (d.date < today || i) d.medMissed.push(tMin(slot))
        }
      }
    }
  }
  return rows
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

  const A = opt.detailed ? analyze(r, { cycle: !!opt.cycle }) : null
  const X = A?.days ?? buildDays(r)
  const trackedX = X.filter((d) => d.tracked)
  const avgX = (f: (d: (typeof X)[number]) => number | undefined) => avg(trackedX.map(f).filter((v): v is number => v != null))

  // ---------- Auf einen Blick ----------
  if (A && A.highlights.length) {
    doc.h2('Auf einen Blick')
    for (const h of A.highlights) doc.text(`•  ${h}`, { indent: 2 })
    doc.text('Automatisch aus den Einträgen berechnet – als Gesprächsgrundlage, nicht als Diagnose.', { size: 7.8, color: MUTED })
  }

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
    ...(r.substances.some((x) => x.kind === 'nikotin') ? [{ label: 'Zigaretten Ø / Tag', value: f1(avgX((d) => d.cigarettes)) }] : []),
    ...(trackedX.some((d) => d.sweet) ? [{ label: 'Süße Einträge Ø / Tag', value: f1(avgX((d) => d.sweet)) }] : []),
    ...(trackedX.some((d) => d.cravings) ? [{ label: 'Heißhunger (gesamt)', value: `${trackedX.reduce((a, d) => a + d.cravings, 0)}×` }] : []),
    ...(trackedX.some((d) => d.screen != null) ? [{ label: 'Bildschirm abends Ø', value: minutesToHM(avgX((d) => d.screen)) }] : []),
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

  if (A) {
    // ---------- Tagesrhythmus ----------
    doc.h2('Tagesrhythmus')
    doc.text('Jede Zeile ist ein Tag (0–24 Uhr). So sind Muster bei Schlaf, Essen, Süßem, Koffein, Alkohol, Rauchen, Medikamenten und Stimmung auf einen Blick sichtbar.', { size: 8.3, color: MUTED })
    doc.rhythm(rhythmDays(r))
    if (A.facts.length) {
      doc.text('Auffälligkeiten im Tagesablauf', { bold: true })
      for (const f of A.facts) doc.text(`•  ${f}`, { indent: 2, size: 9 })
    }
    const prof = A.profile.filter((b) => b.moodN || b.meals || b.sweet || b.caffeine || b.alcohol || b.cigarettes)
    if (prof.length) {
      doc.text('Nach Tageszeit (Summen über den Zeitraum)', { bold: true })
      const hasSugar = prof.some((b) => b.sugarG > 0)
      const hasCig = prof.some((b) => b.cigarettes > 0)
      const hasAlc = prof.some((b) => b.alcohol > 0)
      const head = ['Tageszeit', 'Ø Stimmung', 'Mahlzeiten', 'Süßes', ...(hasSugar ? ['Zucker (g)'] : []), 'Heißhunger', 'Koffein', ...(hasAlc ? ['Alkohol'] : []), ...(hasCig ? ['Zigaretten'] : [])]
      const rows = prof.map((b) => [
        b.label,
        b.mood != null ? `${f1(b.mood)} (${b.moodN}×)` : '–',
        String(b.meals),
        String(b.sweet),
        ...(hasSugar ? [f0(b.sugarG)] : []),
        String(b.cravings),
        String(b.caffeine),
        ...(hasAlc ? [String(b.alcohol)] : []),
        ...(hasCig ? [String(b.cigarettes)] : []),
      ])
      doc.table(head, rows, [2.1, 1.35, ...head.slice(2).map((h) => (h === 'Heißhunger' || h === 'Zigaretten' || h === 'Mahlzeiten' ? 1.25 : 1))], 7.8)
    }
    if (A.medTiming.length) {
      doc.text(
        `Pünktlichkeit der Medikamente (Zeitpunkt des Abhakens): ${A.medTiming
          .map((m) => `${m.name} ${m.slot} Uhr – Ø ${Math.abs(Math.round(m.avgDiff))} min ${m.avgDiff >= 0 ? 'später' : 'früher'}, ${Math.round(m.within1h)} % innerhalb ±1 h`)
          .join('; ')}.`,
        { size: 8.8 },
      )
    }

    // ---------- Zusammenhänge ----------
    doc.ensure(70)
    doc.h2('Mögliche Zusammenhänge')
    doc.text(
      'Verglichen wurden Tage mit und ohne bestimmte Gewohnheiten (bzw. mit mehr und weniger). Angezeigt wird nur, was statistisch auffällig ist (Rangkorrelation, Korrektur für viele Prüfungen). Ein Zusammenhang ist keine Ursache – bei wenigen Tagen kann auch ein Zufall dabei sein.',
      { size: 8.3, color: MUTED },
    )
    if (!A.corr.findings.length) doc.text('Keine deutlichen Zusammenhänge gefunden. Mit mehr eingetragenen Tagen werden Muster sicherer erkennbar.', { color: MUTED })
    else
      doc.table(
        ['Thema', 'Beobachtung', 'Stärke'],
        A.corr.findings.map((f) => [f.topic, f.text, `${f.strength} (r = ${f.r.toFixed(2).replace('.', ',')})`]),
        [1.4, 6, 1.6],
        8.4,
      )
    if (A.corr.notFound.length) doc.text(`Geprüft, ohne deutlichen Zusammenhang: ${A.corr.notFound.join(', ')}.`, { size: 8.3, color: MUTED })
    if (A.corr.tooFewData.length) doc.text(`Zu wenige Vergleichstage (z. B. fast jeden Tag gleich oder kaum eingetragen) für: ${A.corr.tooFewData.join(', ')}.`, { size: 8.3, color: MUTED })
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
        doc.text(
          `${a.med.name} – Änderungen: ${a.changes.map((c) => `${formatShort(c.date)}: ${c.note ? `${c.note}, ` : ''}${c.dose}`).join('; ')}`,
          { size: 8.8 },
        )
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
  const scanned = [...r.meals, ...r.drinks].filter((x) => x.nutrition)
  if (scanned.length) {
    const days = new Set(scanned.map((x) => x.date)).size
    const tot = sumNutrition(scanned.map((x) => x.nutrition))
    const perDay = (v?: number) => (v != null ? v / days : undefined)
    doc.text(
      `Nährwerte aus ${scanned.length} gescannten Produkten an ${days} Tagen (nur diese, nicht die gesamte Ernährung), Ø pro Tag: ${f0(perDay(tot.kcal))} kcal, Zucker ${f0(perDay(tot.sugar))} g, Fett ${f0(perDay(tot.fat))} g, Eiweiß ${f0(perDay(tot.protein))} g.`,
    )
  }
  const subs = SUBSTANCE_KINDS.map((k) => {
    const list = r.substances.filter((s) => s.kind === k.value)
    return list.length ? `${k.label}: ${list.reduce((a, s) => a + s.amount, 0)} ${k.unit} an ${new Set(list.map((s) => s.date)).size} Tagen` : ''
  }).filter(Boolean)
  if (subs.length) doc.text(`Substanzen: ${subs.join(' · ')}`)
  const periodDays = X.filter((d) => (d.period ?? 0) > 0)
  if (opt.cycle && periodDays.length) {
    const moodP = avg(periodDays.map((d) => d.mood).filter((v): v is number => v != null))
    const moodO = avg(X.filter((d) => !((d.period ?? 0) > 0)).map((d) => d.mood).filter((v): v is number => v != null))
    doc.text(`Zyklus: Periode an ${periodDays.length} Tagen (${periodDays.map((d) => formatDayMonth(d.date)).join(', ')}). Stimmung an diesen Tagen Ø ${f1(moodP)}, sonst Ø ${f1(moodO)}.`)
  }
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

  if (A) {
    // ---------- Verlauf ----------
    if (A.trend.length && r.days.length >= 10) {
      doc.h2('Verlauf: erste vs. zweite Hälfte des Zeitraums')
      doc.table(
        ['Bereich', 'Erste Hälfte', 'Zweite Hälfte', 'Tendenz'],
        A.trend.map((t) => {
          const d = t.second! - t.first!
          const rel = Math.abs(d) / Math.max(1, Math.abs(t.first!))
          const better = t.higherIsBetter ? d > 0 : d < 0
          return [t.label, t.fmt(t.first!), t.fmt(t.second!), rel < 0.08 ? 'gleich' : better ? 'besser' : 'schlechter']
        }),
        [2, 1.5, 1.5, 1.2],
      )
    }
    // ---------- Vollständigkeit ----------
    doc.h2('Vollständigkeit der Daten')
    doc.table(
      ['Bereich', 'Tage mit Einträgen', 'Anteil'],
      A.completeness.map((c) => [c.label, `${c.days} von ${r.days.length}`, `${Math.round((c.days / r.days.length) * 100)} %`]),
      [3, 1.5, 1],
    )

    // ---------- Anhang: Tagestabelle ----------
    doc.newPage('landscape')
    doc.h2('Anhang: alle Tage im Überblick')
    const cyc = A.cycleDays
    const reviewsBy = new Map(r.reviews.map((v) => [v.date, v]))
    const head = [
      'Datum', 'Stimm.', 'Energie', 'Angst', 'Schlaf', 'Qual.', 'Schritte', 'Aktiv', 'Draußen', 'Kontakt', 'Mahlz.', 'Süß', 'Zucker',
      'Trinken', 'Koffein', 'Alk.', 'Zig.', 'Bildsch.', 'Med. %', ...(opt.cycle ? ['Zyklus'] : []), 'Ereignisse / Notizen',
    ]
    const v = (n?: number, d = 1) => (n == null ? '' : n.toLocaleString('de-DE', { maximumFractionDigits: d }))
    const rows = A.days.map((d, i) => {
      const rv = reviewsBy.get(d.date)
      const notes = opt.includeNotes ? r.checkins.filter((c) => c.date === d.date && c.note).map((c) => c.note) : []
      return [
        `${weekdayShort(d.date)} ${formatDayMonth(d.date)}`,
        v(d.mood),
        v(d.energy),
        v(d.anxiety),
        d.sleepMin != null ? `${v(d.sleepMin / 60)} h` : '',
        v(d.sleepQuality),
        v(d.steps, 0),
        d.tracked ? `${d.activeMin}` : '',
        v(d.outsideMin, 0),
        d.social == null ? '' : ['nein', 'kurz', 'länger'][d.social],
        d.tracked ? String(d.meals) : '',
        d.tracked ? String(d.sweet) : '',
        v(d.sugarG, 0),
        d.drinkMl != null ? `${v(d.drinkMl / 1000)} l` : '',
        d.tracked ? String(d.caffeine) : '',
        d.alcohol ? String(d.alcohol) : '',
        d.cigarettes ? String(d.cigarettes) : '',
        d.screen != null ? `${d.screen}` : '',
        d.medPct != null ? `${Math.round(d.medPct)}` : '',
        ...(opt.cycle ? [(d.period ?? 0) > 0 ? `P${cyc[i] ?? ''}` : cyc[i] ? `T${cyc[i]}` : ''] : []),
        [...(rv?.tags ?? []), rv?.events, ...notes].filter(Boolean).join('; '),
      ]
    })
    doc.table(head, rows, [1.5, 0.75, 0.8, 0.7, 0.85, 0.65, 1, 0.7, 0.85, 0.85, 0.75, 0.55, 1, 0.85, 0.8, 0.55, 0.55, 1, 0.8, ...(opt.cycle ? [0.7] : []), 3.8], 6.6)
    doc.text(
      `Einheiten: Stimmung/Energie 1–5, Angst 0–4, Qualität 1–5, Zucker in g (gescannte Produkte), Aktiv/Draußen/Bildschirm (abends nach 20 Uhr) in Minuten, Med. % = abgehakte Einnahmen.${opt.cycle ? ' Zyklus: P = Periodentag, T = Zyklustag.' : ''}`,
      { size: 7.5, color: MUTED },
    )
  }

  return doc.pdf.output('blob')
}
