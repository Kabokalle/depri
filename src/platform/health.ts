import { db, type ActivityKind, type Sleep } from '../db'
import { addDays, durationBetween, timeStr, toDateStr, todayStr } from '../lib/dates'
import { getSettings, setSetting } from '../lib/settings'
import { isAndroidApp } from './native'

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

/* ------------------------------------------------------------------ */
/* Android: Health Connect                                              */
/* ------------------------------------------------------------------ */

export const healthConnectSupported = isAndroidApp

async function plugin() {
  const { Health } = await import('@capgo/capacitor-health')
  return Health
}

export async function healthAvailable(): Promise<{ available: boolean; reason?: string }> {
  if (!healthConnectSupported) return { available: false, reason: 'Nur in der Android-App' }
  const H = await plugin()
  return H.isAvailable()
}

export async function connectHealth(): Promise<boolean> {
  if (!healthConnectSupported) return false
  const H = await plugin()
  const av = await H.isAvailable()
  if (!av.available) throw new Error(av.reason || 'Health Connect ist auf diesem Gerät nicht verfügbar.')
  const res = await H.requestAuthorization({ read: ['steps', 'sleep', 'workouts'] })
  const ok = res.readAuthorized.length > 0
  await setSetting('healthConnected', ok)
  if (ok) await syncHealth(14)
  return ok
}

const WORKOUT_MAP: Partial<Record<string, ActivityKind>> = {
  walking: 'spaziergang',
  hiking: 'spaziergang',
  cycling: 'rad',
  bikingStationary: 'rad',
  handCycling: 'rad',
  yoga: 'yoga',
  pilates: 'yoga',
  stretching: 'yoga',
  flexibility: 'yoga',
  mindAndBody: 'yoga',
  taiChi: 'yoga',
  meditation: 'yoga',
  guidedBreathing: 'yoga',
}

interface Interval {
  start: number
  end: number
  state?: string
}

let syncing = false

/** Holt Schritte, Schlaf und Trainings der letzten `days` Tage aus Health Connect */
export async function syncHealth(days = 3): Promise<void> {
  if (!healthConnectSupported || syncing) return
  const s = await getSettings()
  if (!s.healthConnected) return
  syncing = true
  try {
    const H = await plugin()
    const end = new Date()
    const startDay = addDays(todayStr(), -(days - 1))
    const start = new Date(`${startDay}T00:00:00`)

    // --- Schritte pro Tag ---
    try {
      const agg = await H.queryAggregated({
        dataType: 'steps',
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        bucket: 'day',
        aggregation: 'sum',
      })
      for (const b of agg.samples) {
        const date = toDateStr(new Date(b.startDate))
        const steps = Math.round(b.value)
        const cur = await db.dailySteps.get(date)
        if (cur?.source === 'manual' && cur.steps > steps) continue
        await db.dailySteps.put({ date, steps, source: 'healthconnect', updatedAt: Date.now() })
      }
    } catch (e) {
      console.warn('Schritte', e)
    }

    // --- Schlaf ---
    try {
      const sleepStart = new Date(start.getTime() - 12 * 3600e3)
      const res = await H.readSamples({
        dataType: 'sleep',
        startDate: sleepStart.toISOString(),
        endDate: end.toISOString(),
        limit: 500,
        ascending: true,
      })
      const parts: Interval[] = []
      for (const smp of res.samples) {
        if (smp.stages && smp.stages.length) {
          for (const st of smp.stages)
            parts.push({ start: Date.parse(st.startDate), end: Date.parse(st.endDate), state: st.stage })
        } else {
          parts.push({ start: Date.parse(smp.startDate), end: Date.parse(smp.endDate), state: smp.sleepState })
        }
      }
      parts.sort((a, b) => a.start - b.start)
      // zu Sitzungen gruppieren (Lücke < 60 min)
      const sessions: Interval[][] = []
      for (const p of parts) {
        const last = sessions[sessions.length - 1]
        if (last && p.start - Math.max(...last.map((x) => x.end)) < 60 * 60e3) last.push(p)
        else sessions.push([p])
      }
      const byDate = new Map<string, { main?: Interval[]; napMin: number }>()
      for (const ses of sessions) {
        const sStart = Math.min(...ses.map((x) => x.start))
        const sEnd = Math.max(...ses.map((x) => x.end))
        const date = toDateStr(new Date(sEnd))
        const entry = byDate.get(date) ?? { napMin: 0 }
        const totalMin = (sEnd - sStart) / 60e3
        const endHour = new Date(sEnd).getHours()
        const isNap = totalMin < 180 && endHour >= 11 && endHour < 21
        if (isNap) entry.napMin += Math.round(totalMin)
        else {
          const curMain = entry.main
          const curLen = curMain ? Math.max(...curMain.map((x) => x.end)) - Math.min(...curMain.map((x) => x.start)) : 0
          if (sEnd - sStart > curLen) entry.main = ses
        }
        byDate.set(date, entry)
      }
      for (const [date, e] of byDate) {
        if (date < startDay) continue
        const cur = await db.sleep.get(date)
        if (cur?.source === 'manual' && cur.durationMin) {
          // manuelle Angaben behalten, nur Mittagsschlaf ergänzen
          if (e.napMin && !cur.napMin) await db.sleep.update(date, { napMin: e.napMin })
          continue
        }
        const upd: Sleep = { ...(cur ?? {}), date, source: 'healthconnect', updatedAt: Date.now() } as Sleep
        if (e.main) {
          const sStart = Math.min(...e.main.map((x) => x.start))
          const sEnd = Math.max(...e.main.map((x) => x.end))
          const hasStates = e.main.some((x) => x.state)
          const asleep = hasStates
            ? e.main.filter((x) => x.state && x.state !== 'awake' && x.state !== 'inBed').reduce((a, x) => a + (x.end - x.start), 0) / 60e3
            : (sEnd - sStart) / 60e3
          upd.bed = timeStr(sStart)
          upd.wake = timeStr(sEnd)
          upd.durationMin = Math.round(asleep || (sEnd - sStart) / 60e3)
          const awakes = e.main.filter((x) => x.state === 'awake' && x.start > sStart && x.end < sEnd).length
          if (hasStates) upd.awakenings = awakes
        }
        if (e.napMin) upd.napMin = e.napMin
        await db.sleep.put(upd)
      }
    } catch (e) {
      console.warn('Schlaf', e)
    }

    // --- Trainings ---
    try {
      const w = await H.queryWorkouts({ startDate: start.toISOString(), endDate: end.toISOString(), limit: 200 })
      for (const wo of w.workouts) {
        const healthId = wo.platformId ?? `${wo.workoutType}-${wo.startDate}`
        const exists = await db.activities.where('healthId').equals(healthId).first()
        if (exists) continue
        const ts = Date.parse(wo.startDate)
        await db.activities.add({
          ts,
          date: toDateStr(new Date(ts)),
          kind: WORKOUT_MAP[wo.workoutType] ?? 'sport',
          minutes: Math.max(1, Math.round(wo.duration / 60)),
          source: 'healthconnect',
          healthId,
          note: wo.sourceName ? `aus ${wo.sourceName}` : undefined,
        })
      }
    } catch (e) {
      console.warn('Trainings', e)
    }

    await setSetting('lastHealthSync', Date.now())
  } finally {
    syncing = false
  }
}
