import { db, type Sleep } from '../db'
import { addDays, durationBetween, todayStr } from '../lib/dates'

/* ------------------------------------------------------------------ */
/* iPhone: Import über Link aus dem Kurzbefehl                          */
/* ------------------------------------------------------------------ */

/** Robust Zahlen aus Kurzbefehlen lesen ("6.432", "6432,0", "6,9") */
function num(v: string | null, integer = false): number | undefined {
  if (v == null || v.trim() === '') return undefined
  let s = v.trim().replace(/[\s ']/g, '')
  if (integer) {
    const hasDot = s.includes('.')
    const hasComma = s.includes(',')
    if (hasDot && hasComma) {
      const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ','
      s = s.replace(dec === '.' ? /,/g : /\./g, '')
      s = s.split(dec)[0]
    } else if (hasDot || hasComma) {
      const sep = hasDot ? '.' : ','
      const parts = s.split(sep)
      const thousands = parts.length > 2 || (parts.length === 2 && parts[1].length === 3)
      s = thousands ? parts.join('') : parts[0]
    }
    const n = parseInt(s, 10)
    return Number.isFinite(n) ? n : undefined
  }
  // Dezimalzahl: letzter Trenner ist das Komma/Punkt
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(',', '.')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : undefined
}

function hhmm(v: string | null): string | undefined {
  if (!v) return undefined
  const m = v.match(/(\d{1,2})[:.](\d{2})/)
  if (!m) return undefined
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

export interface ImportResult {
  date: string
  steps?: number
  sleepMin?: number
  bed?: string
  wake?: string
}

export async function importFromParams(p: URLSearchParams): Promise<ImportResult> {
  const rawDate = p.get('date')
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayStr()
  const steps = num(p.get('steps'), true)
  const bed = hhmm(p.get('bed'))
  const wake = hhmm(p.get('wake'))
  let sleepMin = num(p.get('sleepMin'))
  const sleepH = num(p.get('sleepH'))
  const sleepSec = num(p.get('sleepSec'))
  if (sleepMin == null && sleepH != null) sleepMin = sleepH * 60
  if (sleepMin == null && sleepSec != null) sleepMin = sleepSec / 60
  // Plausibilität: mehr als 24 h „Minuten“ sind vermutlich Sekunden
  if (sleepMin != null && sleepMin > 1440) sleepMin = sleepMin / 60
  if (sleepMin == null && bed && wake) sleepMin = durationBetween(bed, wake)
  if (sleepMin != null) sleepMin = Math.round(sleepMin)

  const putSteps = async (d: string, n: number) => {
    const cur = await db.dailySteps.get(d)
    // Manuelle Einträge nur überschreiben, wenn der Kurzbefehl mehr liefert
    if (!cur || cur.source !== 'manual' || n >= cur.steps) {
      await db.dailySteps.put({ date: d, steps: n, source: 'shortcut', updatedAt: Date.now() })
    }
  }
  if (steps != null) await putSteps(date, steps)
  const stepsY = num(p.get('stepsY'), true)
  if (stepsY != null) await putSteps(addDays(date, -1), stepsY)
  if (sleepMin != null && sleepMin > 0) {
    const sleepDate = p.get('sleepDate') && /^\d{4}-\d{2}-\d{2}$/.test(p.get('sleepDate')!) ? p.get('sleepDate')! : date
    const cur = await db.sleep.get(sleepDate)
    await db.sleep.put({
      ...(cur ?? {}),
      date: sleepDate,
      bed: bed ?? cur?.bed,
      wake: wake ?? cur?.wake,
      durationMin: sleepMin,
      source: 'shortcut',
      updatedAt: Date.now(),
    } as Sleep)
  }
  return { date, steps, sleepMin, bed, wake }
}

/* iPhone: Kurzbefehl legt "depri?steps=…&sleepMin=…" in die Zwischenablage.
   (Links aus Kurzbefehlen öffnen sich in Safari, das einen anderen Speicher als
   die Home-Bildschirm-App hat – daher der Weg über die Zwischenablage.) */

export const SHORTCUT_NAME = 'Depri Health'

export function parseImportText(text: string): URLSearchParams | null {
  const t = text.trim()
  if (!/steps=|stepsY=|sleepMin=|sleepH=|sleepSec=|wake=/.test(t)) return null
  const q = t.includes('?') ? t.slice(t.indexOf('?') + 1) : t
  return new URLSearchParams(q.replace(/\s+/g, ''))
}

export async function importFromClipboard(): Promise<ImportResult | null> {
  const text = await navigator.clipboard.readText()
  const p = parseImportText(text)
  if (!p) return null
  const res = await importFromParams(p)
  // Zwischenablage leeren, damit nichts doppelt übernommen wird
  try {
    await navigator.clipboard.writeText('')
  } catch {
    /* egal */
  }
  return res
}

export function runHealthShortcut() {
  sessionStorage.setItem('depri-await-health', String(Date.now()))
  window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}`
}

export function awaitingHealth(): boolean {
  const t = Number(sessionStorage.getItem('depri-await-health') || 0)
  return Date.now() - t < 10 * 60e3
}
export function clearAwaitingHealth() {
  sessionStorage.removeItem('depri-await-health')
}
