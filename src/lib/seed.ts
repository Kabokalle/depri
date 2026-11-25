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
      { date: addDays(today, -60), dose: '25 mg', note: 'Beginn' },
      { date: addDays(today, -14), dose: '50 mg', note: 'auf ärztlichen Rat erhöht' },
    ],
  })) as number
  const medB = (await db.medications.add({
    name: 'Mirtazapin',
    dose: '15 mg',
    times: ['21:30'],
    active: true,
    remind: true,
    createdAt: Date.now(),
    history: [{ date: addDays(today, -9), dose: '15 mg', note: 'Beginn' }],
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
    if (Math.random() < 0.4) {
      // gescannte Cola (Nährwerte wie aus Open Food Facts)
      const per100 = { kcal: 44, sugar: 10.9, carbs: 10.9, fat: 0, satFat: 0, protein: 0, salt: 0 }
      const ml = pick([330, 500])
      const nutrition = Object.fromEntries(Object.entries(per100).map(([k, v]) => [k, (v * ml) / 100]))
      await db.drinks.add({
        ts: combine(date, '14:30'),
        date,
        kind: 'softdrink',
        ml,
        caffeine: true,
        product: { code: '5449000000996', name: 'Coca-Cola', brand: 'Coca-Cola', per100, unit: 'ml' },
        nutrition,
      })
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
      if (date >= addDays(today, -9)) await db.medIntakes.add({ medId: medB, date, slot: '21:30', status: Math.random() < 0.85 ? 'taken' : 'skipped', ts: combine(date, '21:40') })
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
  for (const [d, base] of [[addDays(today, -27), 17], [addDays(today, -13), 14], [today, 10]] as [string, number][]) {
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

/**
 * Testdaten mit bewusst eingebauten Mustern, um die Auswertung zu prüfen:
 * - Süßes vor allem nachmittags, Heißhunger nach kurzen Nächten
 * - Koffein nach 15 Uhr → kürzerer Schlaf, längeres Einschlafen
 * - Bildschirm am Abend → längeres Einschlafen
 * - Alkohol → schlechtere Stimmung am nächsten Tag
 * - Morgentief (morgens schlechtere Stimmung als abends)
 * - prämenstruell schlechtere Stimmung
 * Schritte und Zeit draußen sind bewusst ZUFÄLLIG (dürfen nicht als Zusammenhang auftauchen).
 */
export async function seedPatterns(days = 28) {
  await seed(1)
  await Promise.all(['meals', 'drinks', 'activities', 'dailySteps', 'checkins', 'sleep', 'medIntakes', 'sideEffects', 'substances', 'dayReviews'].map((t) => db.table(t).clear()))
  const today = todayStr()
  const start = addDays(today, -(days - 1))
  const meds = await db.medications.toArray()
  const t = (h: number, m = 0) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const behav: { cafLate: boolean; alcohol: boolean; screen: number }[] = []
  let prevShortSleep = false
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i)
    const prev = behav[i - 1]
    // --- Schlaf der vergangenen Nacht (abhängig vom Vorabend) ---
    let sleepMin = rnd(400, 470)
    let latency = rnd(10, 25)
    if (prev?.cafLate) {
      sleepMin -= rnd(60, 90)
      latency += rnd(25, 40)
    }
    if (prev) latency += Math.round(prev.screen / 3)
    const bedMin = 23 * 60 + rnd(-30, 40) + latency
    const wakeMin = (bedMin + sleepMin + latency) % 1440
    const shortSleep = sleepMin < 380
    await db.sleep.put({
      date,
      bed: t(Math.floor((bedMin % 1440) / 60), bedMin % 60),
      wake: t(Math.floor(wakeMin / 60), wakeMin % 60),
      durationMin: sleepMin,
      latencyMin: latency,
      awakenings: rnd(0, 3),
      quality: Math.max(1, Math.min(5, Math.round((sleepMin - 300) / 45))),
      source: 'manual',
      updatedAt: Date.now(),
    })
    // --- Stimmung: Morgentief, Alkohol am Vortag, prämenstruell ---
    const pms = i >= 1 && i <= 7
    const period = i >= 8 && i <= 12 ? rnd(1, 3) : 0
    let base = 3.2 + (Math.random() - 0.5) * 0.8
    if (prev?.alcohol) base -= 1
    if (pms) base -= 0.9
    const clamp = (v: number) => Math.max(1, Math.min(5, Math.round(v)))
    await db.checkins.add({ ts: combine(date, '08:30'), date, mood: clamp(base - 0.8), energy: clamp(base - 1), anxiety: rnd(1, 3) })
    await db.checkins.add({ ts: combine(date, '20:00'), date, mood: clamp(base + 0.4), energy: clamp(base), anxiety: rnd(0, 2) })
    // --- Essen: Süßes nachmittags, Heißhunger nach kurzer Nacht ---
    if (Math.random() < 0.7) await db.meals.add({ ts: combine(date, t(8, rnd(0, 50))), date, type: 'fruehstueck', what: pick(['Müsli', 'Brot']), size: 'normal' })
    await db.meals.add({ ts: combine(date, t(12, rnd(15, 59))), date, type: 'mittag', what: pick(['Nudeln', 'Suppe', 'Reis']), size: 'normal' })
    const sweets = rnd(0, 2) + (shortSleep || prevShortSleep ? 1 : 0)
    for (let k = 0; k < sweets; k++)
      await db.meals.add({ ts: combine(date, t(rnd(14, 17), rnd(0, 59))), date, type: 'snack', what: pick(['Schokolade', 'Kuchen', 'Kekse']), size: 'klein', sweet: true, craving: shortSleep && k === 0 })
    await db.meals.add({ ts: combine(date, t(rnd(18, 20), rnd(0, 59))), date, type: 'abend', what: pick(['Brot', 'Auflauf', 'Salat']), size: 'normal' })
    if (Math.random() < 0.15) await db.meals.add({ ts: combine(date, t(22, rnd(10, 50))), date, type: 'snack', what: 'Chips', size: 'klein' })
    // --- Trinken & Koffein ---
    await db.drinks.add({ ts: combine(date, '08:40'), date, kind: 'kaffee', ml: 200, caffeine: true })
    const cafLate = Math.random() < 0.4
    if (cafLate) await db.drinks.add({ ts: combine(date, t(16, rnd(0, 50))), date, kind: 'kaffee', ml: 200, caffeine: true })
    for (let k = 0; k < rnd(3, 6); k++) await db.drinks.add({ ts: combine(date, t(rnd(9, 21), rnd(0, 59))), date, kind: 'wasser', ml: 250, caffeine: false })
    if (Math.random() < 0.3) {
      const per100 = { kcal: 44, sugar: 10.9, carbs: 10.9, fat: 0, protein: 0, salt: 0 }
      await db.drinks.add({ ts: combine(date, t(15, rnd(0, 59))), date, kind: 'softdrink', ml: 330, caffeine: true, product: { code: '5449000000996', name: 'Coca-Cola', per100, unit: 'ml' }, nutrition: { kcal: 145, sugar: 36, carbs: 36, fat: 0, protein: 0, salt: 0 } })
    }
    // --- Alkohol & Rauchen ---
    const alcohol = Math.random() < 0.3
    if (alcohol) await db.substances.add({ ts: combine(date, '20:30'), date, kind: 'alkohol', amount: rnd(2, 3) })
    for (let k = 0; k < rnd(6, 11); k++) {
      const h = Math.random() < 0.5 ? rnd(18, 22) : rnd(8, 17)
      await db.substances.add({ ts: combine(date, t(h, rnd(0, 59))), date, kind: 'nikotin', amount: 1 })
    }
    // --- zufällig: Schritte, Aktivität, Rückblick ---
    await db.dailySteps.put({ date, steps: rnd(1500, 9000), source: 'manual', updatedAt: Date.now() })
    if (Math.random() < 0.5) await db.activities.add({ ts: combine(date, '15:30'), date, kind: pick(['spaziergang', 'haushalt', 'rad']), minutes: pick([15, 20, 30]), joy: rnd(4, 8), achievement: rnd(4, 8), source: 'manual' })
    const screen = pick([0, 20, 45, 90, 150])
    await db.dayReviews.put({ date, outsideMin: pick([0, 15, 30, 60]), social: pick(['keine', 'kurz', 'laenger']), tags: [], screenEveningMin: screen, period, updatedAt: Date.now() })
    // --- Medikamente ---
    for (const m of meds) {
      if ((m.history[0]?.date ?? '') > date) continue
      for (const slot of m.times) {
        const ok = Math.random() < 0.88
        const [sh, sm] = slot.split(':').map(Number)
        await db.medIntakes.add({ medId: m.id!, date, slot, status: ok ? 'taken' : 'missed', ts: combine(date, t(sh, Math.min(59, sm + rnd(0, 40)))) })
      }
    }
    behav.push({ cafLate, alcohol, screen })
    prevShortSleep = shortSleep
  }
  await db.settings.put({ key: 'trackCycle', value: true })
  return 'Muster-Testdaten erstellt'
}
