/**
 * Auswertung für den Arztbericht: Tagesrhythmus, Zusammenhänge, Vollständigkeit.
 *
 * Zusammenhänge werden vorsichtig berechnet: Rangkorrelation (Spearman) mit
 * p-Wert und Korrektur für viele gleichzeitige Prüfungen (Benjamini-Hochberg).
 * So erscheinen bei reinen Zufallsdaten möglichst keine Scheinbefunde.
 */
import type { Drink, Meal } from '../db'
import type { RangeData } from './stats'
import { combine, daysBetween, minutesToHM, parseDate } from './dates'

/* ------------------------------------------------------------------ */
/* Tagesdaten                                                           */
/* ------------------------------------------------------------------ */

export interface DayX {
  date: string
  mood?: number
  energy?: number
  anxiety?: number
  /** Schlaf der Nacht, die an diesem Tag endete */
  sleepMin?: number
  sleepQuality?: number
  latency?: number
  napMin?: number
  steps?: number
  activeMin: number
  outsideMin?: number
  /** 0 keine, 1 kurz, 2 länger */
  social?: number
  meals: number
  firstMeal?: number
  lastMeal?: number
  lateMeal: boolean
  breakfast: boolean
  sweet: number
  sugarG?: number
  cravings: number
  drinkMl?: number
  caffeine: number
  caffeineLate: boolean
  lastCaffeine?: number
  alcohol: number
  cigarettes: number
  cigEvening: number
  firstCig?: number
  screen?: number
  period?: number
  medPct?: number
  medMissed: boolean
  sideEffects: number
  /** Gab es an diesem Tag überhaupt Einträge? */
  tracked: boolean
}

const minOfDay = (ts: number) => {
  const d = new Date(ts)
  return d.getHours() * 60 + d.getMinutes()
}
const hhmm = (min: number) => {
  const m = Math.round(min) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : undefined)
const nums = (a: (number | undefined)[]) => a.filter((x): x is number => x != null && Number.isFinite(x))

export function isSweetDrink(d: Drink): boolean {
  if (d.nutrition?.sugar != null) return d.nutrition.sugar >= 5 || (d.product?.per100.sugar ?? 0) > 5
  return d.kind === 'saft' || d.kind === 'softdrink' || d.kind === 'energy'
}
export function isSweetMeal(m: Meal): boolean {
  return !!m.sweet || (m.product?.per100.sugar ?? 0) > 15
}

export function buildDays(r: RangeData): DayX[] {
  const by = <T extends { date: string }>(a: T[]) => {
    const m = new Map<string, T[]>()
    for (const x of a) m.set(x.date, [...(m.get(x.date) ?? []), x])
    return m
  }
  const meals = by(r.meals)
  const drinks = by(r.drinks)
  const acts = by(r.activities)
  const checks = by(r.checkins)
  const subs = by(r.substances)
  const intakes = by(r.intakes)
  const effects = by(r.sideEffects)
  return r.days.map((date) => {
    const ml = (meals.get(date) ?? []).sort((a, b) => a.ts - b.ts)
    const dr = drinks.get(date) ?? []
    const ch = checks.get(date) ?? []
    const sb = subs.get(date) ?? []
    const sl = r.sleep.find((s) => s.date === date)
    const rv = r.reviews.find((x) => x.date === date)
    const st = r.steps.find((x) => x.date === date)
    const ins = intakes.get(date) ?? []
    const caf = dr.filter((x) => x.caffeine)
    const cigs = sb.filter((x) => x.kind === 'nikotin')
    const sugarVals = [...ml.map((m) => m.nutrition?.sugar), ...dr.map((x) => x.nutrition?.sugar)]
    const hasSugar = sugarVals.some((v) => v != null)
    const avgOf = (k: 'mood' | 'energy' | 'anxiety') => mean(nums(ch.map((c) => c[k])))
    const mealMins = ml.map((m) => minOfDay(m.ts))
    const taken = ins.filter((i) => i.status === 'taken').length
    const plannedSlots = r.meds
      .filter((m) => m.active && (m.history[0]?.date ?? '') <= date)
      .reduce((a, m) => a + m.times.length, 0)
    const tracked = !!(ml.length || dr.length || ch.length || sl || st || rv || sb.length || (acts.get(date) ?? []).length)
    return {
      date,
      mood: avgOf('mood'),
      energy: avgOf('energy'),
      anxiety: avgOf('anxiety'),
      sleepMin: sl?.durationMin,
      sleepQuality: sl?.quality,
      latency: sl?.latencyMin,
      napMin: sl?.napMin,
      steps: st?.steps,
      activeMin: (acts.get(date) ?? []).reduce((a, x) => a + x.minutes, 0),
      outsideMin: rv?.outsideMin ?? (rv ? 0 : undefined),
      social: rv?.social ? { keine: 0, kurz: 1, laenger: 2 }[rv.social] : undefined,
      meals: ml.length,
      firstMeal: mealMins.length ? Math.min(...mealMins) : undefined,
      lastMeal: mealMins.length ? Math.max(...mealMins) : undefined,
      lateMeal: mealMins.some((m) => m >= 22 * 60),
      breakfast: ml.some((m) => m.type === 'fruehstueck' || minOfDay(m.ts) < 10 * 60 + 30),
      sweet: ml.filter(isSweetMeal).length + dr.filter(isSweetDrink).length,
      sugarG: hasSugar ? nums(sugarVals).reduce((a, b) => a + b, 0) : undefined,
      cravings: ml.filter((m) => m.craving).length,
      drinkMl: dr.length ? dr.reduce((a, x) => a + x.ml, 0) : undefined,
      caffeine: caf.length,
      caffeineLate: caf.some((x) => minOfDay(x.ts) >= 15 * 60),
      lastCaffeine: caf.length ? Math.max(...caf.map((x) => minOfDay(x.ts))) : undefined,
      alcohol: sb.filter((x) => x.kind === 'alkohol').reduce((a, x) => a + x.amount, 0),
      cigarettes: cigs.reduce((a, x) => a + x.amount, 0),
      cigEvening: cigs.filter((x) => minOfDay(x.ts) >= 18 * 60).reduce((a, x) => a + x.amount, 0),
      firstCig: cigs.length ? Math.min(...cigs.map((x) => minOfDay(x.ts))) : undefined,
      screen: rv?.screenEveningMin,
      period: rv?.period,
      medPct: plannedSlots && (ins.length || tracked) ? (taken / plannedSlots) * 100 : undefined,
      medMissed: plannedSlots > 0 && taken < plannedSlots && tracked,
      sideEffects: (effects.get(date) ?? []).length,
      tracked,
    }
  })
}

/* ------------------------------------------------------------------ */
/* Tagesrhythmus                                                        */
/* ------------------------------------------------------------------ */

export const BUCKETS = [
  { label: 'Nacht (0–5 Uhr)', from: 0, to: 5 },
  { label: 'Morgen (5–10)', from: 5, to: 10 },
  { label: 'Vormittag (10–12)', from: 10, to: 12 },
  { label: 'Mittag (12–14)', from: 12, to: 14 },
  { label: 'Nachmittag (14–18)', from: 14, to: 18 },
  { label: 'Abend (18–22)', from: 18, to: 22 },
  { label: 'Spät (22–24)', from: 22, to: 24 },
]
const bucketOf = (ts: number) => {
  const h = new Date(ts).getHours()
  return BUCKETS.findIndex((b) => h >= b.from && h < b.to)
}

export interface BucketRow {
  label: string
  mood?: number
  moodN: number
  meals: number
  sweet: number
  sugarG: number
  cravings: number
  caffeine: number
  alcohol: number
  cigarettes: number
}

export function timeProfile(r: RangeData): BucketRow[] {
  const rows: BucketRow[] = BUCKETS.map((b) => ({ label: b.label, moodN: 0, meals: 0, sweet: 0, sugarG: 0, cravings: 0, caffeine: 0, alcohol: 0, cigarettes: 0 }))
  const moods: number[][] = BUCKETS.map(() => [])
  for (const c of r.checkins) moods[bucketOf(c.ts)].push(c.mood)
  for (const m of r.meals) {
    const b = rows[bucketOf(m.ts)]
    b.meals++
    if (isSweetMeal(m)) b.sweet++
    if (m.craving) b.cravings++
    b.sugarG += m.nutrition?.sugar ?? 0
  }
  for (const d of r.drinks) {
    const b = rows[bucketOf(d.ts)]
    if (isSweetDrink(d)) b.sweet++
    if (d.caffeine) b.caffeine++
    b.sugarG += d.nutrition?.sugar ?? 0
  }
  for (const s of r.substances) {
    const b = rows[bucketOf(s.ts)]
    if (s.kind === 'alkohol') b.alcohol += s.amount
    if (s.kind === 'nikotin') b.cigarettes += s.amount
  }
  rows.forEach((row, i) => {
    row.mood = mean(moods[i])
    row.moodN = moods[i].length
  })
  return rows
}

function peakText(rows: BucketRow[], key: 'sugarG' | 'sweet' | 'cigarettes' | 'caffeine' | 'alcohol', what: string, unit = ''): string | null {
  const total = rows.reduce((a, r) => a + r[key], 0)
  if (total <= 0) return null
  const top = [...rows].sort((a, b) => b[key] - a[key])[0]
  const share = Math.round((top[key] / total) * 100)
  if (share < 30) return null
  return `${what}: ${share} % ${unit ? `(${Math.round(top[key])} ${unit}) ` : ''}fallen in die Zeit „${top.label}“.`
}

/** Aussagen über Uhrzeiten und Gewohnheiten */
export function rhythmFacts(r: RangeData, days: DayX[]): string[] {
  const out: string[] = []
  const rows = timeProfile(r)
  const tracked = days.filter((d) => d.tracked)

  // Morgentief / Stimmungsverlauf über den Tag
  const morning = mean(r.checkins.filter((c) => new Date(c.ts).getHours() < 11).map((c) => c.mood))
  const evening = mean(r.checkins.filter((c) => new Date(c.ts).getHours() >= 17).map((c) => c.mood))
  const nM = r.checkins.filter((c) => new Date(c.ts).getHours() < 11).length
  const nE = r.checkins.filter((c) => new Date(c.ts).getHours() >= 17).length
  if (morning != null && evening != null && nM >= 3 && nE >= 3) {
    const diff = evening - morning
    if (diff >= 0.5) out.push(`Stimmung morgens deutlich schlechter als abends (Ø ${f1(morning)} vs. ${f1(evening)} von 5) – Hinweis auf ein Morgentief.`)
    else if (diff <= -0.5) out.push(`Stimmung abends schlechter als morgens (Ø ${f1(evening)} vs. ${f1(morning)} von 5).`)
    else out.push(`Stimmung morgens und abends ähnlich (Ø ${f1(morning)} bzw. ${f1(evening)} von 5).`)
  }

  const sugar = peakText(rows, 'sugarG', 'Zucker (gescannte Produkte)', 'g')
  if (sugar) out.push(sugar)
  const sweet = peakText(rows, 'sweet', 'Süße Mahlzeiten und Getränke')
  if (sweet) out.push(sweet)
  const cravings = rows.reduce((a, x) => a + x.cravings, 0)
  if (cravings) {
    const top = [...rows].sort((a, b) => b.cravings - a.cravings)[0]
    out.push(`${cravings}× Heißhunger, am häufigsten „${top.label}“.`)
  }

  const first = nums(tracked.filter((d) => d.meals).map((d) => d.firstMeal))
  const last = nums(tracked.filter((d) => d.meals).map((d) => d.lastMeal))
  const mealDays = tracked.filter((d) => d.meals > 0)
  if (mealDays.length >= 3) {
    const noBreakfast = mealDays.filter((d) => !d.breakfast).length
    const late = mealDays.filter((d) => d.lateMeal).length
    out.push(
      `Erste Mahlzeit Ø ${hhmm(mean(first)!)}, letzte Ø ${hhmm(mean(last)!)}` +
        `${noBreakfast ? `; an ${noBreakfast} von ${mealDays.length} Tagen kein Frühstück` : ''}` +
        `${late ? `; an ${late} Tagen nach 22 Uhr gegessen` : ''}.`,
    )
  }
  const lastCaf = nums(tracked.map((d) => d.lastCaffeine))
  if (lastCaf.length >= 3) {
    const lateDays = tracked.filter((d) => d.caffeineLate).length
    out.push(`Letztes koffeinhaltiges Getränk Ø ${hhmm(mean(lastCaf)!)}; an ${lateDays} Tagen nach 15 Uhr.`)
  }
  const firstCig = nums(tracked.map((d) => d.firstCig))
  if (firstCig.length >= 3) {
    const cig = peakText(rows, 'cigarettes', 'Zigaretten')
    out.push(`Erste Zigarette Ø ${hhmm(mean(firstCig)!)}, Ø ${f1(mean(tracked.map((d) => d.cigarettes)))} pro Tag.${cig ? ' ' + cig : ''}`)
  }
  const alc = peakText(rows, 'alcohol', 'Alkohol')
  if (alc && rows.reduce((a, x) => a + x.alcohol, 0) >= 3) out.push(alc)

  // Schlafrhythmus
  const beds = nums(r.sleep.map((s) => (s.bed ? toNightMin(s.bed) : undefined)))
  const wakes = nums(r.sleep.map((s) => (s.wake ? toMin(s.wake) : undefined)))
  if (beds.length >= 3) {
    const sd = stdev(beds)
    out.push(
      `Zubettgehen Ø ${hhmm(mean(beds)! % 1440)}, Aufstehen Ø ${hhmm(mean(wakes)!)}; Schwankung der Bettzeit ±${Math.round(sd)} min` +
        `${sd > 60 ? ' (unregelmäßiger Schlafrhythmus)' : ''}.`,
    )
  }
  const screens = nums(tracked.map((d) => d.screen))
  if (screens.length >= 3) out.push(`Bildschirm am Abend (nach 20 Uhr) Ø ${minutesToHM(mean(screens))} an ${screens.length} erfassten Abenden.`)
  return out
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
/** Bettzeit auf eine durchgehende Skala (18 Uhr … 12 Uhr am Folgetag) */
const toNightMin = (t: string) => {
  const m = toMin(t)
  return m < 12 * 60 ? m + 1440 : m
}
const stdev = (a: number[]) => {
  const m = mean(a)!
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2))!)
}

/** Pünktlichkeit der Medikamente (Zeitpunkt des Abhakens vs. geplante Zeit) */
export function medTiming(r: RangeData): { name: string; slot: string; avgDiff: number; within1h: number; n: number }[] {
  const out: { name: string; slot: string; avgDiff: number; within1h: number; n: number }[] = []
  for (const m of r.meds) {
    for (const slot of m.times) {
      const diffs = r.intakes
        .filter((i) => i.medId === m.id && i.slot === slot && i.status === 'taken')
        .map((i) => (i.ts - combine(i.date, slot)) / 60000)
        .filter((d) => Math.abs(d) < 12 * 60)
      if (diffs.length < 3) continue
      out.push({
        name: m.name,
        slot,
        avgDiff: mean(diffs)!,
        within1h: (diffs.filter((d) => Math.abs(d) <= 60).length / diffs.length) * 100,
        n: diffs.length,
      })
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Zusammenhänge                                                        */
/* ------------------------------------------------------------------ */

function ranks(a: number[]): number[] {
  const idx = a.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0])
  const r = new Array<number>(a.length)
  for (let i = 0; i < idx.length; ) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
    const rank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) r[idx[k][1]] = rank
    i = j + 1
  }
  return r
}
function pearson(x: number[], y: number[]): number {
  const mx = mean(x)!
  const my = mean(y)!
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < x.length; i++) {
    num += (x[i] - mx) * (y[i] - my)
    dx += (x[i] - mx) ** 2
    dy += (y[i] - my) ** 2
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0
}
/** Zweiseitiger p-Wert für eine Korrelation (t-Verteilung, Näherung) */
function pValue(r: number, n: number): number {
  if (n < 4 || Math.abs(r) >= 1) return Math.abs(r) >= 1 && n >= 4 ? 0 : 1
  const df = n - 2
  const t = Math.abs(r) * Math.sqrt(df / (1 - r * r))
  const z = (t * (1 - 1 / (4 * df))) / Math.sqrt(1 + (t * t) / (2 * df))
  return 2 * (1 - normCdf(z))
}
function normCdf(z: number): number {
  // Abramowitz & Stegun 26.2.17
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}

type Getter = (d: DayX, i: number, all: DayX[]) => number | undefined | null

interface Predictor {
  id: string
  /** Bedingung der „hohen“ Gruppe, z. B. „Tage mit Alkohol“ */
  high: (threshold: string) => string
  low: (threshold: string) => string
  get: Getter
  binary?: boolean
  fmt?: (v: number) => string
}
interface Outcome {
  id: string
  label: string
  get: Getter
  higherIsBetter: boolean
  fmt: (v: number) => string
  /** Bezugsgröße für die Mindest-Effektstärke */
  scale: (values: number[]) => number
  /** Zeitbezug, z. B. „in der Nacht danach“ */
  when: string
}

const f1 = (v: number | undefined) => (v == null ? '–' : v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
const next = (all: DayX[], i: number) => all[i + 1]

const P: Record<string, Predictor> = {
  steps: { id: 'steps', high: (t) => `An Tagen mit mehr als ${t} Schritten`, low: () => '', get: (d) => d.steps, fmt: (v) => Math.round(v).toLocaleString('de-DE') },
  active: { id: 'active', high: () => 'An Tagen mit Bewegung/Aktivität', low: () => '', get: (d) => (d.tracked ? d.activeMin : undefined), binary: true },
  outside: { id: 'outside', high: () => 'An Tagen, an denen du draußen warst', low: () => '', get: (d) => (d.outsideMin != null ? d.outsideMin : undefined), binary: true },
  social: { id: 'social', high: () => 'An Tagen mit Kontakt zu anderen', low: () => '', get: (d) => d.social, binary: true },
  meals: { id: 'meals', high: (t) => `An Tagen mit mehr als ${t} Mahlzeiten`, low: () => '', get: (d) => (d.tracked ? d.meals : undefined), fmt: (v) => String(Math.round(v)) },
  sweet: { id: 'sweet', high: () => 'An Tagen mit Süßem', low: () => '', get: (d) => (d.tracked ? d.sweet : undefined), binary: true },
  drink: { id: 'drink', high: (t) => `An Tagen mit mehr als ${t} ml Trinken`, low: () => '', get: (d) => d.drinkMl, fmt: (v) => Math.round(v).toLocaleString('de-DE') },
  caffeine: { id: 'caffeine', high: (t) => `An Tagen mit mehr als ${t} koffeinhaltigen Getränken`, low: () => '', get: (d) => (d.tracked ? d.caffeine : undefined), fmt: (v) => String(Math.round(v)) },
  alcohol: { id: 'alcohol', high: () => 'An Tagen mit Alkohol', low: () => '', get: (d) => (d.tracked ? d.alcohol : undefined), binary: true },
  cigs: { id: 'cigs', high: (t) => `An Tagen mit mehr als ${t} Zigaretten`, low: () => '', get: (d) => (d.tracked ? d.cigarettes : undefined), fmt: (v) => String(Math.round(v)) },
  sleep: { id: 'sleep', high: (t) => `Nach Nächten mit mehr als ${t} Schlaf`, low: () => '', get: (d) => d.sleepMin, fmt: (v) => minutesToHM(v) },
  sleepQ: { id: 'sleepQ', high: (t) => `Nach Nächten mit Schlafqualität über ${t}`, low: () => '', get: (d) => d.sleepQuality, fmt: (v) => f1(v) },
  cravings: { id: 'cravings', high: () => 'An Tagen mit Heißhunger', low: () => '', get: (d) => (d.tracked ? d.cravings : undefined), binary: true },
  cafLate: { id: 'cafLate', high: () => 'Nach Koffein ab 15 Uhr', low: () => '', get: (d) => (d.tracked ? (d.caffeineLate ? 1 : 0) : undefined), binary: true },
  screen: { id: 'screen', high: (t) => `Nach Abenden mit mehr als ${t} Bildschirm`, low: () => '', get: (d) => d.screen, fmt: (v) => minutesToHM(v) },
  lateMeal: { id: 'lateMeal', high: () => 'Nach einer Mahlzeit nach 22 Uhr', low: () => '', get: (d) => (d.tracked && d.meals ? (d.lateMeal ? 1 : 0) : undefined), binary: true },
  cigEve: { id: 'cigEve', high: () => 'Nach Zigaretten am Abend', low: () => '', get: (d) => (d.tracked ? d.cigEvening : undefined), binary: true },
  nap: { id: 'nap', high: () => 'Nach einem Mittagsschlaf', low: () => '', get: (d) => (d.sleepMin != null ? (d.napMin ?? 0) : undefined), binary: true },
  alcEve: { id: 'alcEve', high: () => 'Nach Alkohol am Vortag', low: () => '', get: (d) => (d.tracked ? d.alcohol : undefined), binary: true },
  medMissed: { id: 'medMissed', high: () => 'Nach einem Tag mit vergessenem Medikament', low: () => '', get: (d) => (d.medPct != null ? (d.medMissed ? 1 : 0) : undefined), binary: true },
}

const moodScale = () => 4
const relScale = (v: number[]) => Math.max(1, Math.abs(mean(v) ?? 1))
const O: Record<string, Outcome> = {
  mood: { id: 'mood', label: 'die Stimmung', get: (d) => d.mood, higherIsBetter: true, fmt: (v) => `${f1(v)}/5`, scale: moodScale, when: '' },
  energy: { id: 'energy', label: 'die Energie', get: (d) => d.energy, higherIsBetter: true, fmt: (v) => `${f1(v)}/5`, scale: moodScale, when: '' },
  anxiety: { id: 'anxiety', label: 'Angst/Unruhe', get: (d) => d.anxiety, higherIsBetter: false, fmt: (v) => `${f1(v)}/4`, scale: moodScale, when: '' },
  sweetOut: { id: 'sweetOut', label: 'die Zahl süßer Einträge', get: (d) => (d.tracked ? d.sweet : undefined), higherIsBetter: false, fmt: (v) => f1(v), scale: () => 1, when: '' },
  moodNext: { id: 'moodNext', label: 'die Stimmung am nächsten Tag', get: (_d, i, a) => next(a, i)?.mood, higherIsBetter: true, fmt: (v) => `${f1(v)}/5`, scale: moodScale, when: '' },
  anxNext: { id: 'anxNext', label: 'Angst/Unruhe am nächsten Tag', get: (_d, i, a) => next(a, i)?.anxiety, higherIsBetter: false, fmt: (v) => `${f1(v)}/4`, scale: moodScale, when: '' },
  sleepNext: { id: 'sleepNext', label: 'der Schlaf in der Nacht danach', get: (_d, i, a) => next(a, i)?.sleepMin, higherIsBetter: true, fmt: (v) => minutesToHM(v), scale: relScale, when: '' },
  sleepQNext: { id: 'sleepQNext', label: 'die Schlafqualität in der Nacht danach', get: (_d, i, a) => next(a, i)?.sleepQuality, higherIsBetter: true, fmt: (v) => `${f1(v)}/5`, scale: moodScale, when: '' },
  latNext: { id: 'latNext', label: 'die Einschlafdauer in der Nacht danach', get: (_d, i, a) => next(a, i)?.latency, higherIsBetter: false, fmt: (v) => `${Math.round(v)} min`, scale: relScale, when: '' },
}

/** Welche Verbindungen geprüft werden */
const TESTS: [keyof typeof P, keyof typeof O, string][] = [
  // Stimmung & Alltag am selben Tag
  ['steps', 'mood', 'Bewegung'],
  ['active', 'mood', 'Bewegung'],
  ['outside', 'mood', 'Licht & Kontakte'],
  ['social', 'mood', 'Licht & Kontakte'],
  ['meals', 'mood', 'Essen'],
  ['sweet', 'mood', 'Essen'],
  ['drink', 'mood', 'Trinken'],
  ['caffeine', 'anxiety', 'Koffein'],
  ['alcohol', 'mood', 'Alkohol'],
  ['cigs', 'mood', 'Rauchen'],
  ['cigs', 'anxiety', 'Rauchen'],
  ['steps', 'energy', 'Bewegung'],
  ['outside', 'anxiety', 'Licht & Kontakte'],
  ['social', 'anxiety', 'Licht & Kontakte'],
  // Schlaf → nächster Tag
  ['sleep', 'mood', 'Schlaf'],
  ['sleep', 'energy', 'Schlaf'],
  ['sleepQ', 'mood', 'Schlaf'],
  ['sleep', 'sweetOut', 'Schlaf & Essen'],
  ['sleep', 'anxiety', 'Schlaf'],
  // Gefühle ↔ Essen
  ['cravings', 'mood', 'Essen'],
  ['cravings', 'anxiety', 'Essen'],
  // Abend → Nacht
  ['cafLate', 'sleepNext', 'Koffein & Schlaf'],
  ['cafLate', 'latNext', 'Koffein & Schlaf'],
  ['alcohol', 'sleepQNext', 'Alkohol & Schlaf'],
  ['alcohol', 'sleepNext', 'Alkohol & Schlaf'],
  ['screen', 'latNext', 'Bildschirm & Schlaf'],
  ['screen', 'sleepNext', 'Bildschirm & Schlaf'],
  ['screen', 'sleepQNext', 'Bildschirm & Schlaf'],
  ['lateMeal', 'sleepQNext', 'Essen & Schlaf'],
  ['cigEve', 'sleepQNext', 'Rauchen & Schlaf'],
  ['steps', 'sleepQNext', 'Bewegung & Schlaf'],
  ['nap', 'latNext', 'Mittagsschlaf'],
  // Folgetag
  ['alcEve', 'moodNext', 'Alkohol'],
  ['alcEve', 'anxNext', 'Alkohol'],
  ['medMissed', 'moodNext', 'Medikamente'],
]

export interface Finding {
  topic: string
  text: string
  r: number
  p: number
  q?: number
  n: number
  nHigh: number
  nLow: number
  strength: 'deutlich' | 'möglich'
  /** gute oder ungünstige Richtung (für die Formulierung) */
  favorable: boolean
}

/** Fehlerrate für Benjamini-Hochberg */
export const FDR = 0.1

export interface CorrelationResult {
  findings: Finding[]
  tested: string[]
  notFound: string[]
  tooFewData: string[]
}

function testPair(days: DayX[], pk: keyof typeof P, ok: keyof typeof O, topic: string): (Finding & { _effect: number }) | 'few' | null {
  const p = P[pk]
  const o = O[ok]
  const pairs: { x: number; y: number }[] = []
  days.forEach((d, i) => {
    const x = p.get(d, i, days)
    const y = o.get(d, i, days)
    if (x != null && y != null && Number.isFinite(x) && Number.isFinite(y)) pairs.push({ x, y })
  })
  // Merkmal kommt gar nicht vor (z. B. Nichtraucher) → nicht anwendbar
  if (pairs.length && pairs.every((q) => q.x === pairs[0].x)) return null
  if (pairs.length < 6) return 'few'
  const xs = pairs.map((q) => q.x)
  const ys = pairs.map((q) => q.y)
  // Gruppen bilden
  let threshold: number
  if (p.binary) threshold = 0
  else {
    const sorted = [...xs].sort((a, b) => a - b)
    threshold = sorted[Math.floor((sorted.length - 1) / 2)]
    if (!pairs.some((q) => q.x > threshold)) threshold = sorted[0]
  }
  const hi = pairs.filter((q) => q.x > threshold).map((q) => q.y)
  const lo = pairs.filter((q) => q.x <= threshold).map((q) => q.y)
  if (hi.length < 3 || lo.length < 3) return 'few'
  const r = pearson(ranks(xs), ranks(ys))
  const pv = pValue(r, pairs.length)
  const mHi = mean(hi)!
  const mLo = mean(lo)!
  const effect = Math.abs(mHi - mLo) / o.scale(ys)
  const better = o.higherIsBetter ? mHi > mLo : mHi < mLo
  const verb =
    o.id === 'sweetOut' ? (mHi > mLo ? 'höher' : 'niedriger')
    : o.id.startsWith('lat') ? (mHi > mLo ? 'länger' : 'kürzer')
    : o.id.startsWith('sleepNext') ? (mHi > mLo ? 'länger' : 'kürzer')
    : o.id === 'anxiety' || o.id === 'anxNext' ? (mHi > mLo ? 'stärker' : 'schwächer')
    : better ? 'besser' : 'schlechter'
  const thrTxt = p.binary ? '' : p.fmt ? p.fmt(threshold) : String(threshold)
  const text = `${p.high(thrTxt)} war ${o.label} im Schnitt ${verb}: ${o.fmt(mHi)} statt ${o.fmt(mLo)} (${hi.length} vs. ${lo.length} Tage).`
  return {
    topic,
    text,
    r,
    p: pv,
    n: pairs.length,
    nHigh: hi.length,
    nLow: lo.length,
    strength: 'möglich',
    favorable: better,
    _effect: effect,
  }
}

export function correlations(days: DayX[], opts: { cycle: boolean; fdr?: number }): CorrelationResult {
  const fdr = opts.fdr ?? FDR
  const raw: (Finding & { _effect: number })[] = []
  const tooFew = new Set<string>()
  const tested = new Set<string>()
  const tests = [...TESTS]
  for (const [pk, ok, topic] of tests) {
    const res = testPair(days, pk, ok, topic)
    if (res === 'few') tooFew.add(topic)
    else if (res) {
      tested.add(topic)
      raw.push(res)
    }
  }
  // Zyklus: Periode und prämenstruelle Tage
  if (opts.cycle) {
    const cyc = cycleTests(days)
    raw.push(...cyc.found)
    if (cyc.tested) tested.add('Zyklus')
    else tooFew.add('Zyklus')
  }
  // Benjamini-Hochberg gegen Zufallstreffer bei vielen Prüfungen
  const m = raw.length
  const sorted = [...raw].sort((a, b) => a.p - b.p)
  let kMax = -1
  sorted.forEach((f, k) => {
    if (f.p <= ((k + 1) / m) * fdr) kMax = k
  })
  const findings: Finding[] = []
  sorted.forEach((f, k) => {
    const significant = k <= kMax && Math.abs(f.r) >= 0.3 && f._effect >= 0.1
    if (!significant) return
    const { _effect, ...rest } = f
    void _effect
    findings.push({ ...rest, q: (f.p * m) / (k + 1), strength: f.p < 0.01 && Math.abs(f.r) >= 0.45 ? 'deutlich' : 'möglich' })
  })
  // pro Thema nur den stärksten Befund ausführlich, Doppelungen vermeiden
  const seen = new Set<string>()
  const unique = findings.filter((f) => {
    const key = f.text.split(' im Schnitt ')[0]
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const foundTopics = new Set(unique.map((f) => f.topic))
  return {
    findings: unique,
    tested: [...tested],
    notFound: [...tested].filter((t) => !foundTopics.has(t)),
    tooFewData: [...tooFew].filter((t) => !tested.has(t)),
  }
}

function cycleTests(days: DayX[]): { found: (Finding & { _effect: number })[]; tested: boolean } {
  const isP = (d?: DayX) => (d?.period ?? 0) > 0
  const starts = days.map((d, i) => (isP(d) && !isP(days[i - 1]) ? i : -1)).filter((i) => i >= 0)
  if (!starts.length) return { found: [], tested: false }
  const pre = new Set<number>()
  for (const s of starts) for (let k = 1; k <= 7; k++) if (s - k >= 0) pre.add(s - k)
  const groups: { label: string; inGroup: (i: number) => boolean }[] = [
    { label: 'An Tagen mit Periode', inGroup: (i) => isP(days[i]) },
    { label: 'In den 7 Tagen vor der Periode', inGroup: (i) => pre.has(i) && !isP(days[i]) },
  ]
  const found: (Finding & { _effect: number })[] = []
  let tested = false
  for (const g of groups) {
    const a: number[] = []
    const b: number[] = []
    const xs: number[] = []
    const ys: number[] = []
    days.forEach((d, i) => {
      if (d.mood == null) return
      const inG = g.inGroup(i)
      ;(inG ? a : b).push(d.mood)
      xs.push(inG ? 1 : 0)
      ys.push(d.mood)
    })
    if (a.length < 3 || b.length < 3) continue
    tested = true
    const r = pearson(ranks(xs), ranks(ys))
    const pv = pValue(r, xs.length)
    const ma = mean(a)!
    const mb = mean(b)!
    found.push({
      topic: 'Zyklus',
      text: `${g.label} war die Stimmung im Schnitt ${ma > mb ? 'besser' : 'schlechter'}: ${f1(ma)}/5 statt ${f1(mb)}/5 (${a.length} vs. ${b.length} Tage).`,
      r,
      p: pv,
      n: xs.length,
      nHigh: a.length,
      nLow: b.length,
      strength: 'möglich',
      favorable: ma > mb,
      _effect: Math.abs(ma - mb) / 4,
    })
  }
  return { found, tested }
}

/** Zyklustag (1 = erster Periodentag) für jeden Tag, sofern ableitbar */
export function cycleDays(days: DayX[]): (number | undefined)[] {
  let lastStart: string | undefined
  return days.map((d, i) => {
    const isStart = (d.period ?? 0) > 0 && !((days[i - 1]?.period ?? 0) > 0)
    if (isStart) lastStart = d.date
    return lastStart ? daysBetween(lastStart, d.date) + 1 : undefined
  })
}

/* ------------------------------------------------------------------ */
/* Muster nach Wochentag und Verlauf                                    */
/* ------------------------------------------------------------------ */

const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

export function weekdayPattern(days: DayX[]): string | null {
  if (days.length < 21) return null
  const by: number[][] = WD.map(() => [])
  for (const d of days) if (d.mood != null) by[parseDate(d.date).getDay()].push(d.mood)
  const avgs = by.map((a, i) => ({ wd: WD[i], m: a.length >= 2 ? mean(a) : undefined })).filter((x) => x.m != null) as { wd: string; m: number }[]
  if (avgs.length < 5) return null
  const best = [...avgs].sort((a, b) => b.m - a.m)[0]
  const worst = [...avgs].sort((a, b) => a.m - b.m)[0]
  if (best.m - worst.m < 0.6) return null
  return `Wochentage: Stimmung am besten ${best.wd}s (Ø ${f1(best.m)}), am schlechtesten ${worst.wd}s (Ø ${f1(worst.m)}).`
}

export function trend(days: DayX[]): { label: string; first?: number; second?: number; fmt: (v: number) => string; higherIsBetter: boolean }[] {
  const half = Math.floor(days.length / 2)
  const a = days.slice(0, half)
  const b = days.slice(half)
  const m = (arr: DayX[], f: (d: DayX) => number | undefined) => mean(nums(arr.map(f)))
  const t = (label: string, f: (d: DayX) => number | undefined, fmt: (v: number) => string, higherIsBetter: boolean) => ({
    label,
    first: m(a, f),
    second: m(b, f),
    fmt,
    higherIsBetter,
  })
  return [
    t('Stimmung', (d) => d.mood, (v) => `${f1(v)}/5`, true),
    t('Energie', (d) => d.energy, (v) => `${f1(v)}/5`, true),
    t('Angst/Unruhe', (d) => d.anxiety, (v) => `${f1(v)}/4`, false),
    t('Schlaf', (d) => d.sleepMin, (v) => minutesToHM(v), true),
    t('Schritte', (d) => d.steps, (v) => Math.round(v).toLocaleString('de-DE'), true),
    t('Süße Einträge/Tag', (d) => (d.tracked ? d.sweet : undefined), (v) => f1(v), false),
    t('Zigaretten/Tag', (d) => (d.tracked && d.cigarettes ? d.cigarettes : d.tracked ? 0 : undefined), (v) => f1(v), false),
  ].filter((x) => x.first != null && x.second != null)
}

/* ------------------------------------------------------------------ */
/* Vollständigkeit                                                      */
/* ------------------------------------------------------------------ */

export function completeness(r: RangeData, days: DayX[]): { label: string; days: number }[] {
  const has = (dates: string[]) => new Set(dates).size
  return [
    { label: 'Check-in (Stimmung)', days: has(r.checkins.map((x) => x.date)) },
    { label: 'Mahlzeiten', days: has(r.meals.map((x) => x.date)) },
    { label: 'Getränke', days: has(r.drinks.map((x) => x.date)) },
    { label: 'Schlaf', days: has(r.sleep.map((x) => x.date)) },
    { label: 'Schritte', days: has(r.steps.map((x) => x.date)) },
    { label: 'Medikamente abgehakt', days: has(r.intakes.map((x) => x.date)) },
    { label: 'Tagesrückblick', days: has(r.reviews.map((x) => x.date)) },
    { label: 'Irgendein Eintrag', days: days.filter((d) => d.tracked).length },
  ]
}

/* ------------------------------------------------------------------ */
/* Auf einen Blick                                                      */
/* ------------------------------------------------------------------ */

export function highlights(r: RangeData, days: DayX[], corr: CorrelationResult, facts: string[]): string[] {
  const out: string[] = []
  const phq = r.phq9.filter((p) => p.date <= r.to)
  const inRange = phq.filter((p) => p.date >= r.from)
  if (inRange.length) {
    const before = phq.filter((p) => p.date < r.from).slice(-1)[0] ?? inRange[0]
    const last = inRange[inRange.length - 1]
    if (before !== last) out.push(`PHQ-9 von ${before.score} auf ${last.score} Punkte (${last.score < before.score ? 'gebessert' : last.score > before.score ? 'verschlechtert' : 'unverändert'}).`)
    else out.push(`PHQ-9 aktuell ${last.score} Punkte.`)
    if (inRange.some((p) => p.answers[8] > 0)) out.push('Achtung: Gedanken an Tod/Selbstverletzung im PHQ-9 angegeben (Item 9).')
  }
  const morningFact = facts.find((f) => f.includes('Morgentief'))
  if (morningFact) out.push(morningFact)
  for (const f of corr.findings.slice(0, 3)) out.push(f.text)
  const sleeps = nums(days.map((d) => d.sleepMin))
  if (sleeps.length >= 5 && mean(sleeps)! < 360) out.push(`Wenig Schlaf: Ø ${minutesToHM(mean(sleeps))} pro Nacht.`)
  const meds = nums(days.map((d) => d.medPct))
  if (meds.length >= 5 && mean(meds)! < 80) out.push(`Medikamente nur zu ${Math.round(mean(meds)!)} % als genommen markiert.`)
  const sugarFact = facts.find((f) => f.startsWith('Zucker') || f.startsWith('Süße'))
  if (out.length < 6 && sugarFact) out.push(sugarFact)
  return out.slice(0, 7)
}

export function analyze(r: RangeData, opts: { cycle: boolean }) {
  const days = buildDays(r)
  const facts = rhythmFacts(r, days)
  const corr = correlations(days, opts)
  const wd = weekdayPattern(days)
  if (wd) facts.push(wd)
  return {
    days,
    facts,
    profile: timeProfile(r),
    corr,
    medTiming: medTiming(r),
    trend: trend(days),
    completeness: completeness(r, days),
    cycleDays: cycleDays(days),
    highlights: highlights(r, days, corr, facts),
  }
}

export type Analysis = ReturnType<typeof analyze>
export { hhmm }
