import {
  db,
  type Activity,
  type Appointment,
  type Checkin,
  type DailySteps,
  type DayReview,
  type Drink,
  type Meal,
  type MedIntake,
  type Medication,
  type Phq9,
  type Question,
  type SideEffect,
  type Sleep,
  type Substance,
} from '../db'
import { dateRange, todayStr } from './dates'
import { ACTIVITY_KINDS, label } from './labels'

export interface RangeData {
  from: string
  to: string
  days: string[]
  meals: Meal[]
  drinks: Drink[]
  activities: Activity[]
  steps: DailySteps[]
  checkins: Checkin[]
  sleep: Sleep[]
  meds: Medication[]
  intakes: MedIntake[]
  sideEffects: SideEffect[]
  substances: Substance[]
  reviews: DayReview[]
  phq9: Phq9[]
  appointments: Appointment[]
  questions: Question[]
}

export async function loadRange(from: string, to: string): Promise<RangeData> {
  const r = <T>(t: { where: (k: string) => { between: (a: string, b: string, i: boolean, j: boolean) => { toArray: () => Promise<T[]> } } }) =>
    t.where('date').between(from, to, true, true).toArray()
  const [meals, drinks, activities, steps, checkins, sleep, meds, intakes, sideEffects, substances, reviews, phq9, appointments, questions] =
    await Promise.all([
      r<Meal>(db.meals as never),
      r<Drink>(db.drinks as never),
      r<Activity>(db.activities as never),
      r<DailySteps>(db.dailySteps as never),
      r<Checkin>(db.checkins as never),
      r<Sleep>(db.sleep as never),
      db.medications.toArray(),
      r<MedIntake>(db.medIntakes as never),
      r<SideEffect>(db.sideEffects as never),
      r<Substance>(db.substances as never),
      r<DayReview>(db.dayReviews as never),
      db.phq9.orderBy('ts').toArray(),
      db.appointments.orderBy('date').toArray(),
      db.questions.orderBy('createdAt').toArray(),
    ])
  return {
    from,
    to,
    days: dateRange(from, to),
    meals,
    drinks,
    activities,
    steps,
    checkins,
    sleep,
    meds,
    intakes,
    sideEffects,
    substances,
    reviews,
    phq9,
    appointments,
    questions,
  }
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : undefined)
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const group = <T extends { date: string }>(a: T[]) => {
  const m = new Map<string, T[]>()
  for (const x of a) m.set(x.date, [...(m.get(x.date) ?? []), x])
  return m
}

export interface DaySeries {
  date: string
  steps?: number
  activeMin: number
  drinkMl?: number
  meals: number
  mood?: number
  energy?: number
  sleepMin?: number
  sleepQuality?: number
  medPct?: number
  outsideMin?: number
  social?: string
  alcohol: number
  caffeine: number
  symptoms: Partial<Record<'anxiety' | 'drive' | 'concentration' | 'rumination' | 'appetite', number>>
}

/** Geplante Einnahmen eines Medikaments an einem Tag */
function plannedSlots(meds: Medication[], date: string) {
  return meds
    .filter((m) => {
      // aktiv an diesem Tag? Anhand der Historie
      const hist = [...m.history].sort((a, b) => a.date.localeCompare(b.date))
      if (!hist.length) return m.active
      if (hist[0].date > date) return false
      let active = true
      for (const h of hist) {
        if (h.date > date) break
        if (h.note === 'Abgesetzt') active = false
        else if (h.note === 'Wieder begonnen' || h.note === 'Beginn') active = true
      }
      return active
    })
    .flatMap((m) => m.times.map((t) => ({ medId: m.id!, slot: t })))
}

export function series(d: RangeData): DaySeries[] {
  const today = todayStr()
  const meals = group(d.meals)
  const drinks = group(d.drinks)
  const acts = group(d.activities)
  const checks = group(d.checkins)
  const intakes = group(d.intakes)
  const subs = group(d.substances)
  return d.days.map((date) => {
    const dr = drinks.get(date) ?? []
    const ch = checks.get(date) ?? []
    const sl = d.sleep.find((s) => s.date === date)
    const rv = d.reviews.find((r) => r.date === date)
    const planned = plannedSlots(d.meds, date)
    const ins = intakes.get(date) ?? []
    let medPct: number | undefined
    if (planned.length && date <= today) {
      const taken = planned.filter((p) => ins.some((i) => i.medId === p.medId && i.slot === p.slot && i.status === 'taken')).length
      const anyRecorded = ins.length > 0
      medPct = anyRecorded || date < today ? (taken / planned.length) * 100 : undefined
    }
    const symptoms: DaySeries['symptoms'] = {}
    for (const k of ['anxiety', 'drive', 'concentration', 'rumination', 'appetite'] as const) {
      const v = avg(ch.map((c) => c[k]).filter((x): x is number => x != null))
      if (v != null) symptoms[k] = v
    }
    return {
      date,
      steps: d.steps.find((s) => s.date === date)?.steps,
      activeMin: sum((acts.get(date) ?? []).map((a) => a.minutes)),
      drinkMl: dr.length ? sum(dr.map((x) => x.ml)) : undefined,
      meals: (meals.get(date) ?? []).length,
      mood: avg(ch.map((c) => c.mood)),
      energy: avg(ch.map((c) => c.energy)),
      sleepMin: sl?.durationMin,
      sleepQuality: sl?.quality,
      medPct,
      outsideMin: rv?.outsideMin,
      social: rv?.social,
      alcohol: sum((subs.get(date) ?? []).filter((s) => s.kind === 'alkohol').map((s) => s.amount)),
      caffeine: dr.filter((x) => x.caffeine).length,
      symptoms,
    }
  })
}

export interface Win {
  icon: string
  text: string
}

/** „Kleine Erfolge“ – nur positive, freundliche Aussagen */
export function smallWins(d: RangeData, s: DaySeries[], goals: { steps: number; drinkMl: number }): Win[] {
  const wins: Win[] = []
  const outsideDays = s.filter((x) => (x.outsideMin ?? 0) > 0).length
  if (outsideDays) wins.push({ icon: '☀️', text: `An ${outsideDays} Tag${outsideDays === 1 ? '' : 'en'} draußen gewesen` })
  const activeDays = s.filter((x) => x.activeMin > 0 || (x.steps ?? 0) >= 2000).length
  if (activeDays) wins.push({ icon: '🚶', text: `An ${activeDays} Tag${activeDays === 1 ? '' : 'en'} in Bewegung gewesen` })
  const stepGoal = s.filter((x) => (x.steps ?? 0) >= goals.steps).length
  if (stepGoal) wins.push({ icon: '👣', text: `${stepGoal}× dein Schritte-Ziel erreicht` })
  const drinkVals = s.map((x) => x.drinkMl).filter((x): x is number => x != null)
  if (drinkVals.length) {
    const a = avg(drinkVals)!
    wins.push({ icon: '💧', text: `Ø ${(a / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} l pro Tag getrunken` })
  }
  const mealDays = s.filter((x) => x.meals > 0).length
  if (mealDays) wins.push({ icon: '🍽️', text: `${d.meals.length} Mahlzeiten festgehalten` })
  const social = s.filter((x) => x.social && x.social !== 'keine').length
  if (social) wins.push({ icon: '🫂', text: `An ${social} Tag${social === 1 ? '' : 'en'} Kontakt zu anderen gehabt` })
  const med = s.map((x) => x.medPct).filter((x): x is number => x != null)
  if (med.length && avg(med)! >= 80) wins.push({ icon: '💊', text: `Medikamente zuverlässig genommen (${Math.round(avg(med)!)} %)` })
  if (d.checkins.length) wins.push({ icon: '💛', text: `${d.checkins.length}× in dich hineingehört` })
  return wins
}

/** Welche Aktivitäten tun gut? (Freude/Erfolg im Schnitt) */
export function activityInsights(acts: Activity[]) {
  const m = new Map<string, { joy: number[]; ach: number[]; n: number; min: number }>()
  for (const a of acts) {
    const e = m.get(a.kind) ?? { joy: [], ach: [], n: 0, min: 0 }
    e.n++
    e.min += a.minutes
    if (a.joy != null) e.joy.push(a.joy)
    if (a.achievement != null) e.ach.push(a.achievement)
    m.set(a.kind, e)
  }
  return [...m.entries()]
    .map(([kind, e]) => ({
      kind,
      label: label(ACTIVITY_KINDS, kind as never),
      count: e.n,
      minutes: e.min,
      joy: avg(e.joy),
      achievement: avg(e.ach),
    }))
    .sort((a, b) => (b.joy ?? -1) - (a.joy ?? -1))
}

export function medAdherence(d: RangeData) {
  const today = todayStr()
  return d.meds.map((m) => {
    let planned = 0
    let taken = 0
    let missed = 0
    let skipped = 0
    const missedDays: string[] = []
    for (const date of d.days) {
      if (date > today) continue
      const slots = plannedSlots([m], date)
      if (!slots.length) continue
      for (const sl of slots) {
        const i = d.intakes.find((x) => x.medId === m.id && x.date === date && x.slot === sl.slot)
        // Heute ist noch nicht vorbei: offene Einnahmen nicht als vergessen zählen
        if (date === today && !i) continue
        planned++
        if (i?.status === 'taken') taken++
        else if (i?.status === 'skipped') skipped++
        else {
          missed++
          if (!missedDays.includes(date)) missedDays.push(date)
        }
      }
    }
    const changes = m.history.filter((h) => h.date >= d.from && h.date <= d.to)
    const effects = d.sideEffects.filter((s) => s.medId === m.id)
    return { med: m, planned, taken, missed, skipped, pct: planned ? (taken / planned) * 100 : undefined, missedDays, changes, effects }
  })
}

export function sideEffectSummary(effects: SideEffect[]) {
  const m = new Map<string, { n: number; sev: number[] }>()
  for (const e of effects) {
    const x = m.get(e.kind) ?? { n: 0, sev: [] }
    x.n++
    x.sev.push(e.severity)
    m.set(e.kind, x)
  }
  return [...m.entries()].map(([kind, x]) => ({ kind, count: x.n, severity: avg(x.sev)! })).sort((a, b) => b.count - a.count)
}

export { avg, sum }
