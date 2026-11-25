import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  type Activity,
  type Checkin,
  type DailySteps,
  type DayReview,
  type Drink,
  type Meal,
  type MedIntake,
  type Medication,
  type SideEffect,
  type Sleep,
  type Substance,
} from '../db'

export interface DayData {
  date: string
  meals: Meal[]
  drinks: Drink[]
  activities: Activity[]
  steps?: DailySteps
  checkins: Checkin[]
  sleep?: Sleep
  meds: Medication[]
  intakes: MedIntake[]
  sideEffects: SideEffect[]
  substances: Substance[]
  review?: DayReview
}

const byTs = <T extends { ts: number }>(a: T[]) => a.sort((x, y) => x.ts - y.ts)

export async function loadDay(date: string): Promise<DayData> {
  const [meals, drinks, activities, steps, checkins, sleep, meds, intakes, sideEffects, substances, review] = await Promise.all([
    db.meals.where('date').equals(date).toArray(),
    db.drinks.where('date').equals(date).toArray(),
    db.activities.where('date').equals(date).toArray(),
    db.dailySteps.get(date),
    db.checkins.where('date').equals(date).toArray(),
    db.sleep.get(date),
    db.medications.toArray(),
    db.medIntakes.where('date').equals(date).toArray(),
    db.sideEffects.where('date').equals(date).toArray(),
    db.substances.where('date').equals(date).toArray(),
    db.dayReviews.get(date),
  ])
  return {
    date,
    meals: byTs(meals),
    drinks: byTs(drinks),
    activities: byTs(activities),
    steps,
    checkins: byTs(checkins),
    sleep,
    meds,
    intakes,
    sideEffects: byTs(sideEffects),
    substances: byTs(substances),
    review,
  }
}

export function useDay(date: string): DayData | undefined {
  return useLiveQuery(() => loadDay(date), [date])
}

export function dayTotals(d: DayData) {
  const drinkMl = d.drinks.reduce((a, x) => a + x.ml, 0)
  const caffeine = d.drinks.filter((x) => x.caffeine).length
  const activeMin = d.activities.reduce((a, x) => a + x.minutes, 0)
  const moodAvg = d.checkins.length ? d.checkins.reduce((a, c) => a + c.mood, 0) / d.checkins.length : undefined
  const energyAvg = d.checkins.length ? d.checkins.reduce((a, c) => a + c.energy, 0) / d.checkins.length : undefined
  return { drinkMl, caffeine, activeMin, moodAvg, energyAvg, steps: d.steps?.steps }
}

/** Einnahme-Slots eines Tages für aktive Medikamente */
export function medSlots(d: DayData) {
  const slots: { med: Medication; slot: string; intake?: MedIntake }[] = []
  for (const m of d.meds) {
    if (!m.active) continue
    const started = m.history[0]?.date
    if (started && started > d.date) continue
    for (const t of m.times) {
      slots.push({ med: m, slot: t, intake: d.intakes.find((i) => i.medId === m.id && i.slot === t) })
    }
  }
  return slots.sort((a, b) => a.slot.localeCompare(b.slot))
}

export async function setIntake(medId: number, date: string, slot: string, status: MedIntake['status'] | null) {
  const cur = await db.medIntakes.where('[medId+date+slot]').equals([medId, date, slot]).first()
  if (status == null) {
    if (cur?.id != null) await db.medIntakes.delete(cur.id)
    return
  }
  if (cur?.id != null) await db.medIntakes.update(cur.id, { status, ts: Date.now() })
  else await db.medIntakes.add({ medId, date, slot, status, ts: Date.now() })
}
