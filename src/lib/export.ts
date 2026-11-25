import { db, DATA_TABLES } from '../db'
import { ACTIVITY_KINDS, DRINK_KINDS, INTAKE_LABEL, MEAL_SIZES, MEAL_TYPES, SEVERITY, SOCIAL, SUBSTANCE_KINDS, label } from './labels'
import { timeStr, todayStr } from './dates'
import { loadRange, series } from './stats'
import { PHQ_SHORT } from './phq9'
import { nutritionShort } from './food'

const FORMAT = 'depri-backup'
const VERSION = 1

export async function exportBackup(): Promise<Blob> {
  const data: Record<string, unknown[]> = {}
  for (const t of DATA_TABLES) data[t] = await db.table(t).toArray()
  const payload = { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), data }
  return new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' })
}

export async function importBackup(file: File): Promise<number> {
  const text = await file.text()
  const json = JSON.parse(text)
  if (json?.format !== FORMAT || typeof json.data !== 'object') throw new Error('Das ist keine Depri-Sicherung.')
  let count = 0
  await db.transaction('rw', DATA_TABLES.map((t) => db.table(t)), async () => {
    for (const t of DATA_TABLES) {
      const rows = json.data[t]
      if (!Array.isArray(rows)) continue
      await db.table(t).clear()
      await db.table(t).bulkPut(rows)
      count += rows.length
    }
  })
  return count
}

export function backupFilename() {
  return `depri-sicherung-${todayStr()}.json`
}

/* ---------------- CSV ---------------- */

function csvCell(v: unknown): string {
  if (v == null) return ''
  const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v)
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function csv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(';')).join('\r\n')
}

/** Eine CSV mit allen Einzeleinträgen + eine Tagesübersicht (Excel-kompatibel, Semikolon) */
export async function exportCsv(from: string, to: string): Promise<Blob> {
  const r = await loadRange(from, to)
  const medName = (id?: number) => r.meds.find((m) => m.id === id)?.name ?? ''
  const rows: unknown[][] = [['Datum', 'Uhrzeit', 'Bereich', 'Art', 'Wert', 'Einheit', 'Details']]
  for (const m of r.meals) rows.push([m.date, timeStr(m.ts), 'Essen', label(MEAL_TYPES, m.type), m.grams ?? label(MEAL_SIZES, m.size), m.grams ? 'g' : '', [m.what, nutritionShort(m.nutrition), m.note].filter(Boolean).join(' – ')])
  for (const d of r.drinks) rows.push([d.date, timeStr(d.ts), 'Getränk', label(DRINK_KINDS, d.kind), d.ml, 'ml', [d.product?.name, d.caffeine ? 'koffeinhaltig' : '', nutritionShort(d.nutrition)].filter(Boolean).join(' – ')])
  for (const a of r.activities)
    rows.push([a.date, timeStr(a.ts), 'Aktivität', label(ACTIVITY_KINDS, a.kind), a.minutes, 'min', [a.joy != null ? `Freude ${a.joy}/10` : '', a.achievement != null ? `Erfolg ${a.achievement}/10` : '', a.note].filter(Boolean).join(' – ')])
  for (const s of r.steps) rows.push([s.date, '', 'Schritte', '', s.steps, 'Schritte', s.source])
  for (const c of r.checkins)
    rows.push([
      c.date,
      timeStr(c.ts),
      'Check-in',
      'Stimmung/Energie',
      c.mood,
      '1–5',
      [
        `Energie ${c.energy}/5`,
        c.anxiety != null ? `Angst ${c.anxiety}/4` : '',
        c.drive != null ? `Antriebslosigkeit ${c.drive}/4` : '',
        c.concentration != null ? `Konzentration ${c.concentration}/4` : '',
        c.rumination != null ? `Grübeln ${c.rumination}/4` : '',
        c.appetite != null ? `Appetit ${c.appetite}/4` : '',
        c.note,
      ]
        .filter(Boolean)
        .join(' – '),
    ])
  for (const s of r.sleep)
    rows.push([
      s.date,
      s.wake ?? '',
      'Schlaf',
      '',
      s.durationMin,
      'min',
      [s.bed && s.wake ? `${s.bed}–${s.wake}` : '', s.quality ? `Qualität ${s.quality}/5` : '', s.latencyMin != null ? `Einschlafen ${s.latencyMin} min` : '', s.awakenings != null ? `${s.awakenings}× wach` : '', s.napMin ? `Mittagsschlaf ${s.napMin} min` : ''].filter(Boolean).join(' – '),
    ])
  for (const i of r.intakes) rows.push([i.date, i.slot, 'Medikament', medName(i.medId), INTAKE_LABEL[i.status], '', ''])
  for (const e of r.sideEffects) rows.push([e.date, timeStr(e.ts), 'Nebenwirkung', e.kind, label(SEVERITY, e.severity), '', [medName(e.medId), e.note].filter(Boolean).join(' – ')])
  for (const s of r.substances) rows.push([s.date, timeStr(s.ts), 'Substanz', label(SUBSTANCE_KINDS, s.kind), s.amount, '', s.note])
  for (const v of r.reviews)
    rows.push([v.date, '', 'Tagesrückblick', '', v.outsideMin, 'min draußen', [v.social ? `Kontakt: ${label(SOCIAL, v.social)}` : '', v.socialWith, v.tags.join(', '), v.events, v.weightKg ? `${v.weightKg} kg` : ''].filter(Boolean).join(' – ')])
  for (const p of r.phq9.filter((p) => p.date >= from && p.date <= to))
    rows.push([p.date, timeStr(p.ts), 'PHQ-9', 'Summenwert', p.score, '0–27', p.answers.map((a, i) => `${PHQ_SHORT[i]}: ${a}`).join(', ')])
  const head = rows.shift()!
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])))

  const ser = series(r)
  const days: unknown[][] = [
    ['Datum', 'Schritte', 'Aktiv (min)', 'Trinken (ml)', 'Mahlzeiten', 'Stimmung Ø (1–5)', 'Energie Ø (1–5)', 'Schlaf (min)', 'Schlafqualität (1–5)', 'Medikamente (%)', 'Draußen (min)', 'Alkohol (Gläser)', 'Koffein (Getränke)'],
    ...ser.map((x) => [x.date, x.steps, x.activeMin, x.drinkMl, x.meals, x.mood != null ? Math.round(x.mood * 10) / 10 : undefined, x.energy != null ? Math.round(x.energy * 10) / 10 : undefined, x.sleepMin, x.sleepQuality, x.medPct != null ? Math.round(x.medPct) : '', x.outsideMin, x.alcohol, x.caffeine]),
  ]
  const text = `Depri – Export ${from} bis ${to}\r\n\r\nTagesübersicht\r\n${csv(days)}\r\n\r\nAlle Einträge\r\n${csv([head, ...rows])}\r\n`
  // BOM, damit Excel Umlaute korrekt anzeigt
  return new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })
}
