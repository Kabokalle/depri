/** Nur für die Entwicklung: realistische Testdaten erzeugen / alles löschen */
import { db, DATA_TABLES, type ActivityKind, type DrinkKind, type MealType } from '../db'
import { addDays, combine, todayStr } from './dates'

const rnd = (a: number, b: number) => Math.round(a + Math.random() * (b - a))
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)]

export async function clearAll() {
  await Promise.all(DATA_TABLES.map((t) => db.table(t).clear()))
  return 'gelöscht'
}

export async function seed(days = 42) {
  await clearAll()
  const today = todayStr()
  const start = addDays(today, -(days - 1))
  const medA = (await db.medications.add({
    name: 'Sertralin',
    dose: '50 mg',
    times: ['08:00'],
    active: true,
    remind: true,
    createdAt: Date.now(),
    history: [
      { date: start, dose: '25 mg', note: 'Beginn' },
      { date: addDays(start, 14), dose: '50 mg', note: 'auf ärztlichen Rat erhöht' },
    ],
  })) as number
  const medB = (await db.medications.add({
    name: 'Mirtazapin',
    dose: '15 mg',
    times: ['21:30'],
    active: true,
    remind: true,
    createdAt: Date.now(),
    history: [{ date: addDays(start, 7), dose: '15 mg', note: 'Beginn' }],
  })) as number
  const foods: Record<MealType, string[]> = {
    fruehstueck: ['Müsli', 'Brot mit Käse', 'Joghurt', 'Toast'],
    mittag: ['Nudeln', 'Suppe', 'Salat', 'Reis mit Gemüse'],
    abend: ['Brot', 'Pizza', 'Auflauf', 'Rührei'],
    snack: ['Apfel', 'Schokolade', 'Nüsse', 'Banane'],
  }
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i)
    const trend = i / days // langsame Besserung
    if (Math.random() < 0.12 && date !== today) continue // Lücken sind normal
    const mood = Math.max(1, Math.min(5, Math.round(2 + trend * 2 + (Math.random() - 0.5) * 1.6)))
    await db.checkins.add({
      ts: combine(date, '19:30'),
      date,
      mood,
      energy: Math.max(1, Math.min(5, mood + rnd(-1, 1))),
      anxiety: rnd(0, 3),
      drive: Math.max(0, 4 - mood + rnd(-1, 0)),
      rumination: rnd(1, 3),
      note: Math.random() < 0.15 ? pick(['Schwerer Morgen', 'Mit M. telefoniert, tat gut', 'Sehr müde']) : undefined,
    })
    for (const t of ['fruehstueck', 'mittag', 'abend', 'snack'] as MealType[]) {
      if (Math.random() < (t === 'snack' ? 0.4 : 0.75)) {
        const time = { fruehstueck: '08:30', mittag: '12:45', abend: '19:00', snack: '16:00' }[t]
        await db.meals.add({ ts: combine(date, time), date, type: t, what: pick(foods[t]), size: pick(['klein', 'normal', 'normal', 'gross']) })
      }
    }
    for (let k = 0; k < rnd(3, 7); k++) {
      const kind = pick<DrinkKind>(['wasser', 'wasser', 'wasser', 'kaffee', 'tee'])
      await db.drinks.add({ ts: combine(date, `${String(rnd(8, 21)).padStart(2, '0')}:${rnd(10, 59)}`), date, kind, ml: kind === 'kaffee' ? 200 : 250, caffeine: kind === 'kaffee' })
    }
    await db.dailySteps.put({ date, steps: rnd(800, 4000) + Math.round(trend * 5000), source: 'manual', updatedAt: Date.now() })
    if (Math.random() < 0.6) {
      await db.activities.add({
        ts: combine(date, '15:00'),
        date,
        kind: pick<ActivityKind>(['spaziergang', 'spaziergang', 'yoga', 'treffen', 'haushalt', 'rad']),
        minutes: pick([10, 15, 20, 30, 45]),
        joy: rnd(3, 9),
        achievement: rnd(4, 9),
        source: 'manual',
      })
    }
    const bedH = rnd(22, 25) % 24
    const bed = `${String(bedH).padStart(2, '0')}:${pick(['00', '15', '30', '45'])}`
    const wake = `${String(rnd(6, 9)).padStart(2, '0')}:${pick(['00', '15', '30'])}`
    await db.sleep.put({ date, bed, wake, durationMin: rnd(300, 500), latencyMin: pick([15, 30, 60]), awakenings: rnd(0, 4), quality: Math.max(1, Math.min(5, mood + rnd(-1, 1))), source: 'manual', updatedAt: Date.now() })
    if (date < today || Math.random() < 0.5) {
      await db.medIntakes.add({ medId: medA, date, slot: '08:00', status: Math.random() < 0.9 ? 'taken' : 'missed', ts: combine(date, '08:10') })
      if (i >= 7) await db.medIntakes.add({ medId: medB, date, slot: '21:30', status: Math.random() < 0.85 ? 'taken' : 'skipped', ts: combine(date, '21:40') })
    }
    if (i < 12 && Math.random() < 0.3) await db.sideEffects.add({ ts: combine(date, '11:00'), date, medId: medA, kind: pick(['Übelkeit', 'Unruhe', 'Kopfschmerz']), severity: rnd(1, 2) })
    if (Math.random() < 0.25) await db.substances.add({ ts: combine(date, '20:00'), date, kind: 'alkohol', amount: rnd(1, 2) })
    await db.dayReviews.put({
      date,
      outsideMin: pick([0, 10, 30, 60]),
      social: pick(['keine', 'kurz', 'kurz', 'laenger']),
      tags: Math.random() < 0.2 ? [pick(['Stress Arbeit', 'Schöner Moment', 'Streit'])] : [],
      updatedAt: Date.now(),
    })
  }
  for (const [d, base] of [[start, 17], [addDays(start, 14), 14], [addDays(start, 28), 10]] as [string, number][]) {
    const answers = Array.from({ length: 9 }, (_, i) => (i === 8 ? 0 : Math.min(3, Math.max(0, Math.round(base / 8 + (Math.random() - 0.5) * 1.5)))))
    await db.phq9.add({ ts: combine(d, '10:00'), date: d, answers, score: answers.reduce((a, b) => a + b, 0), difficulty: 1 })
  }
  await db.appointments.add({ date: addDays(today, -14), time: '10:00', who: 'Dr. Beispiel', kind: 'Psychiater', note: 'Dosis auf 50 mg erhöht' })
  await db.appointments.add({ date: addDays(today, 9), time: '09:30', who: 'Dr. Beispiel', kind: 'Psychiater' })
  await db.questions.add({ text: 'Ist die Müdigkeit am Vormittag eine Nebenwirkung?', done: false, createdAt: Date.now() })
  await db.questions.add({ text: 'Kann ich Sertralin abends statt morgens nehmen?', done: false, createdAt: Date.now() })
  await db.settings.put({ key: 'onboarded', value: true })
  return 'Testdaten erstellt'
}
