import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export interface Settings {
  name: string
  goalSteps: number
  goalDrinkMl: number
  quickWaterMl: number
  quickCoffeeMl: number
  todaySections: Record<string, boolean>
  /** iPhone: Apple-Health-Abgleich über Kurzbefehl eingerichtet */
  iosShortcut: boolean
  phqIntervalDays: number
  trackCycle: boolean
  onboarded: boolean
}

export const SECTION_LABELS: Record<string, string> = {
  movement: 'Bewegung',
  drinks: 'Getränke',
  meals: 'Essen',
  nutrition: 'Nährwerte (gescannte Produkte)',
  mood: 'Stimmung',
  sleep: 'Schlaf',
  meds: 'Medikamente',
  substances: 'Substanzen',
  review: 'Tagesrückblick',
}

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  goalSteps: 5000,
  goalDrinkMl: 1500,
  quickWaterMl: 250,
  quickCoffeeMl: 200,
  todaySections: Object.fromEntries(Object.keys(SECTION_LABELS).map((k) => [k, true])),
  iosShortcut: false,
  phqIntervalDays: 14,
  trackCycle: false,
  onboarded: false,
}

export async function getSettings(): Promise<Settings> {
  const rows = await db.settings.toArray()
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS }
  for (const r of rows) s[r.key] = r.value
  return s as unknown as Settings
}

export function useSettings(): Settings {
  return useLiveQuery(getSettings, [], DEFAULT_SETTINGS)
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await db.settings.put({ key, value })
}
