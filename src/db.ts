import Dexie, { type EntityTable } from 'dexie'

/** Datum immer als lokales 'YYYY-MM-DD', Zeitpunkte als ms-Timestamp. */

export type Source = 'manual' | 'shortcut' | 'healthconnect'

/** Nährwerte – je 100 g/ml oder absolut für die verzehrte Menge */
export interface Nutrition {
  kcal?: number
  sugar?: number
  carbs?: number
  fat?: number
  satFat?: number
  protein?: number
  salt?: number
  fiber?: number
  caffeine?: number
}

/** Verknüpftes Produkt (aus dem Barcode-Scan) */
export interface ProductRef {
  code: string
  name: string
  brand?: string
  per100: Nutrition
  /** 'g' oder 'ml' */
  unit: 'g' | 'ml'
}

/** Produkt-Cache, damit erneutes Scannen auch offline klappt */
export interface Product extends ProductRef {
  quantity?: number
  serving?: number
  image?: string
  lastUsed: number
}

export type MealType = 'fruehstueck' | 'mittag' | 'abend' | 'snack'
export type MealSize = 'klein' | 'normal' | 'gross'
export interface Meal {
  id?: number
  ts: number
  date: string
  type: MealType
  what: string
  size: MealSize
  grams?: number
  note?: string
  product?: ProductRef
  /** Nährwerte der verzehrten Menge */
  nutrition?: Nutrition
}

export type DrinkKind = 'wasser' | 'kaffee' | 'tee' | 'saft' | 'softdrink' | 'energy' | 'milch' | 'sonstiges'
export interface Drink {
  id?: number
  ts: number
  date: string
  kind: DrinkKind
  ml: number
  caffeine: boolean
  product?: ProductRef
  nutrition?: Nutrition
}

export type ActivityKind =
  | 'spaziergang'
  | 'sport'
  | 'rad'
  | 'yoga'
  | 'haushalt'
  | 'treffen'
  | 'hobby'
  | 'sonstiges'
export interface Activity {
  id?: number
  ts: number
  date: string
  kind: ActivityKind
  minutes: number
  /** Freude 0–10 */
  joy?: number
  /** Erfolg / Bewältigung 0–10 */
  achievement?: number
  note?: string
  source: Source
  /** ID aus Health Connect, um Doppelte zu vermeiden */
  healthId?: string
}

export interface DailySteps {
  date: string
  steps: number
  source: Source
  updatedAt: number
}

export interface Checkin {
  id?: number
  ts: number
  date: string
  /** 1–5 */
  mood: number
  /** 1–5 */
  energy: number
  /** Symptome 0–4 (0 = gar nicht, 4 = sehr stark) */
  anxiety?: number
  drive?: number
  concentration?: number
  rumination?: number
  appetite?: number
  note?: string
}

export interface Sleep {
  /** Datum des Aufwachens */
  date: string
  bed?: string
  wake?: string
  durationMin?: number
  latencyMin?: number
  awakenings?: number
  /** 1–5 */
  quality?: number
  napMin?: number
  source: Source
  updatedAt: number
}

export interface Medication {
  id?: number
  name: string
  dose: string
  /** geplante Uhrzeiten 'HH:MM' */
  times: string[]
  active: boolean
  remind: boolean
  createdAt: number
  /** Dosis-Historie inkl. Startdosis */
  history: { date: string; dose: string; note?: string }[]
}

export type IntakeStatus = 'taken' | 'missed' | 'skipped'
export interface MedIntake {
  id?: number
  medId: number
  date: string
  /** geplante Uhrzeit oder 'extra' */
  slot: string
  status: IntakeStatus
  ts: number
}

export interface SideEffect {
  id?: number
  ts: number
  date: string
  medId?: number
  kind: string
  /** 1 leicht, 2 mittel, 3 stark */
  severity: number
  note?: string
}

export type SubstanceKind = 'alkohol' | 'nikotin' | 'cannabis' | 'sonstiges'
export interface Substance {
  id?: number
  ts: number
  date: string
  kind: SubstanceKind
  amount: number
  note?: string
}

export type Social = 'keine' | 'kurz' | 'laenger'
export interface DayReview {
  date: string
  outsideMin?: number
  social?: Social
  socialWith?: string
  events?: string
  tags: string[]
  weightKg?: number
  updatedAt: number
}

export interface Phq9 {
  id?: number
  ts: number
  date: string
  answers: number[]
  score: number
  /** 0–3: wie sehr erschweren die Beschwerden den Alltag */
  difficulty?: number
}

export interface Appointment {
  id?: number
  date: string
  time?: string
  who: string
  kind: string
  note?: string
}

export interface Question {
  id?: number
  createdAt: number
  text: string
  done: boolean
  doneAt?: number
  answer?: string
}

export interface SettingRow {
  key: string
  value: unknown
}

export class DepriDB extends Dexie {
  meals!: EntityTable<Meal, 'id'>
  drinks!: EntityTable<Drink, 'id'>
  activities!: EntityTable<Activity, 'id'>
  dailySteps!: EntityTable<DailySteps, 'date'>
  checkins!: EntityTable<Checkin, 'id'>
  sleep!: EntityTable<Sleep, 'date'>
  medications!: EntityTable<Medication, 'id'>
  medIntakes!: EntityTable<MedIntake, 'id'>
  sideEffects!: EntityTable<SideEffect, 'id'>
  substances!: EntityTable<Substance, 'id'>
  dayReviews!: EntityTable<DayReview, 'date'>
  phq9!: EntityTable<Phq9, 'id'>
  appointments!: EntityTable<Appointment, 'id'>
  questions!: EntityTable<Question, 'id'>
  settings!: EntityTable<SettingRow, 'key'>
  products!: EntityTable<Product, 'code'>

  constructor() {
    super('depri')
    this.version(1).stores({
      meals: '++id, date, ts',
      drinks: '++id, date, ts',
      activities: '++id, date, ts, healthId',
      dailySteps: 'date',
      checkins: '++id, date, ts',
      sleep: 'date',
      medications: '++id',
      medIntakes: '++id, date, medId, [medId+date+slot]',
      sideEffects: '++id, date, ts',
      substances: '++id, date, ts',
      dayReviews: 'date',
      phq9: '++id, date, ts',
      appointments: '++id, date',
      questions: '++id, createdAt',
      settings: 'key',
    })
    this.version(2).stores({ products: 'code, lastUsed' })
  }
}

export const db = new DepriDB()

/** Tabellen mit Tagesbezug, für Verlauf, Backup und Bericht */
export const DATA_TABLES = [
  'meals',
  'drinks',
  'activities',
  'dailySteps',
  'checkins',
  'sleep',
  'medications',
  'medIntakes',
  'sideEffects',
  'substances',
  'dayReviews',
  'phq9',
  'appointments',
  'questions',
  'settings',
  'products',
] as const
export type TableName = (typeof DATA_TABLES)[number]
