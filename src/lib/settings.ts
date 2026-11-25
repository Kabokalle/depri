import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export interface Reminder {
  id: number
  label: string
  body: string
  time: string
  enabled: boolean
}

export interface Settings {
  name: string
  goalSteps: number
  goalDrinkMl: number
  quickWaterMl: number
  quickCoffeeMl: number
  todaySections: Record<string, boolean>
  reminders: Reminder[]
  healthConnected: boolean
  /** iPhone: Apple-Health-Abgleich über Kurzbefehl eingerichtet */
  iosShortcut: boolean
  lastHealthSync: number
  phqIntervalDays: number
  onboarded: boolean
}

export const SECTION_LABELS: Record<string, string> = {
  movement: 'Bewegung',
  drinks: 'Getränke',
  meals: 'Essen',
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
  reminders: [
    { id: 101, label: 'Trinken (Vormittag)', body: 'Magst du ein Glas Wasser trinken? 💧', time: '10:30', enabled: false },
    { id: 102, label: 'Mittagessen', body: 'Zeit für eine Kleinigkeit zu essen. Jeder Bissen zählt.', time: '12:30', enabled: false },
    { id: 103, label: 'Trinken (Nachmittag)', body: 'Kleine Trinkpause? 💧', time: '15:30', enabled: false },
    { id: 104, label: 'Abendessen', body: 'Hast du schon etwas gegessen? Auch etwas Kleines ist gut.', time: '18:30', enabled: false },
    { id: 105, label: 'Check-in', body: 'Wie geht es dir gerade? Ein Tipp reicht.', time: '20:00', enabled: false },
    { id: 106, label: 'Tagesrückblick', body: 'Magst du kurz auf den Tag schauen? Ohne Bewertung.', time: '21:30', enabled: false },
  ],
  healthConnected: false,
  iosShortcut: false,
  lastHealthSync: 0,
  phqIntervalDays: 14,
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
