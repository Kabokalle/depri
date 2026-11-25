import type { ActivityKind, DrinkKind, IntakeStatus, MealSize, MealType, Social, SubstanceKind } from '../db'

export const MEAL_TYPES: { value: MealType; label: string; icon: string }[] = [
  { value: 'fruehstueck', label: 'Frühstück', icon: '🥐' },
  { value: 'mittag', label: 'Mittag', icon: '🍲' },
  { value: 'abend', label: 'Abend', icon: '🍝' },
  { value: 'snack', label: 'Snack', icon: '🍎' },
]

export const MEAL_SIZES: { value: MealSize; label: string }[] = [
  { value: 'klein', label: 'Klein' },
  { value: 'normal', label: 'Normal' },
  { value: 'gross', label: 'Groß' },
]

export function guessMealType(date = new Date()): MealType {
  const h = date.getHours()
  if (h >= 5 && h < 11) return 'fruehstueck'
  if (h >= 11 && h < 15) return 'mittag'
  if (h >= 17 && h < 22) return 'abend'
  return 'snack'
}

export const DRINK_KINDS: { value: DrinkKind; label: string; icon: string; caffeine: boolean; ml: number }[] = [
  { value: 'wasser', label: 'Wasser', icon: '💧', caffeine: false, ml: 250 },
  { value: 'kaffee', label: 'Kaffee', icon: '☕', caffeine: true, ml: 200 },
  { value: 'tee', label: 'Tee', icon: '🍵', caffeine: false, ml: 250 },
  { value: 'saft', label: 'Saft', icon: '🧃', caffeine: false, ml: 250 },
  { value: 'softdrink', label: 'Softdrink', icon: '🥤', caffeine: false, ml: 330 },
  { value: 'energy', label: 'Energy', icon: '⚡', caffeine: true, ml: 250 },
  { value: 'milch', label: 'Milch', icon: '🥛', caffeine: false, ml: 200 },
  { value: 'sonstiges', label: 'Sonstiges', icon: '🫗', caffeine: false, ml: 250 },
]

export const DRINK_AMOUNTS = [100, 200, 250, 330, 500, 750]

export const ACTIVITY_KINDS: { value: ActivityKind; label: string; icon: string }[] = [
  { value: 'spaziergang', label: 'Spaziergang', icon: '🚶' },
  { value: 'sport', label: 'Sport', icon: '🏃' },
  { value: 'rad', label: 'Rad', icon: '🚲' },
  { value: 'yoga', label: 'Yoga / Dehnen', icon: '🧘' },
  { value: 'haushalt', label: 'Haushalt', icon: '🧺' },
  { value: 'treffen', label: 'Treffen', icon: '🫂' },
  { value: 'hobby', label: 'Hobby', icon: '🎨' },
  { value: 'sonstiges', label: 'Sonstiges', icon: '✨' },
]

export const SUBSTANCE_KINDS: { value: SubstanceKind; label: string; icon: string; unit: string }[] = [
  { value: 'alkohol', label: 'Alkohol', icon: '🍷', unit: 'Gläser' },
  { value: 'nikotin', label: 'Nikotin', icon: '🚬', unit: 'Zigaretten' },
  { value: 'cannabis', label: 'Cannabis', icon: '🌿', unit: 'Mal' },
  { value: 'sonstiges', label: 'Sonstiges', icon: '💊', unit: 'Mal' },
]

export const SOCIAL: { value: Social; label: string }[] = [
  { value: 'keine', label: 'Kein Kontakt' },
  { value: 'kurz', label: 'Kurz' },
  { value: 'laenger', label: 'Länger' },
]

export const DAY_TAGS = [
  'Schöner Moment',
  'Stress Arbeit',
  'Streit',
  'Schlechte Nachricht',
  'Gute Nachricht',
  'Einsam',
  'Erschöpft',
  'Arzttermin',
  'Körperlich krank',
  'Zyklus / Hormone',
]

export const SIDE_EFFECTS = [
  'Übelkeit',
  'Müdigkeit',
  'Unruhe',
  'Kopfschmerz',
  'Schwindel',
  'Schlafstörung',
  'Mundtrockenheit',
  'Schwitzen',
  'Gewichtszunahme',
  'Libido verändert',
  'Sonstiges',
]

export const SEVERITY = [
  { value: 1, label: 'Leicht' },
  { value: 2, label: 'Mittel' },
  { value: 3, label: 'Stark' },
]

export const INTAKE_LABEL: Record<IntakeStatus, string> = {
  taken: 'genommen',
  missed: 'vergessen',
  skipped: 'ausgelassen',
}

export const MOOD_FACES = ['😞', '🙁', '😐', '🙂', '😊']
export const MOOD_LABELS = ['Sehr schlecht', 'Schlecht', 'Geht so', 'Gut', 'Sehr gut']
export const ENERGY_FACES = ['🪫', '😴', '😐', '🙂', '⚡']
export const ENERGY_LABELS = ['Keine', 'Wenig', 'Mittel', 'Gut', 'Viel']

export const SYMPTOMS: { key: 'anxiety' | 'drive' | 'concentration' | 'rumination' | 'appetite'; label: string; hint: string }[] = [
  { key: 'anxiety', label: 'Angst / Unruhe', hint: '0 = gar nicht, 4 = sehr stark' },
  { key: 'drive', label: 'Antriebslosigkeit', hint: '0 = gar nicht, 4 = sehr stark' },
  { key: 'concentration', label: 'Konzentrationsprobleme', hint: '0 = gar nicht, 4 = sehr stark' },
  { key: 'rumination', label: 'Grübeln', hint: '0 = gar nicht, 4 = sehr stark' },
  { key: 'appetite', label: 'Appetit verändert', hint: '0 = normal, 4 = sehr stark verändert' },
]

export function label<T extends string | number>(list: { value: T; label: string }[], v: T | undefined): string {
  return list.find((x) => x.value === v)?.label ?? ''
}
export function icon<T extends string>(list: { value: T; icon: string }[], v: T | undefined): string {
  return list.find((x) => x.value === v)?.icon ?? ''
}
