const pad = (n: number) => String(n).padStart(2, '0')

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayStr(): string {
  return toDateStr(new Date())
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000)
}

/** Alle Tage von a bis b (inklusive) */
export function dateRange(a: string, b: string): string[] {
  const out: string[] = []
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d)
  return out
}

/** Montag der Woche */
export function weekStart(s: string): string {
  const d = parseDate(s)
  const wd = (d.getDay() + 6) % 7
  return addDays(s, -wd)
}

export function timeStr(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Datum + 'HH:MM' → Timestamp */
export function combine(date: string, time: string): number {
  const d = parseDate(date)
  const [h, m] = time.split(':').map(Number)
  d.setHours(h || 0, m || 0, 0, 0)
  return d.getTime()
}

export function nowTime(): string {
  return timeStr(Date.now())
}

/** Standard-Zeit für neue Einträge: jetzt, oder 12:00 bei vergangenen Tagen */
export function defaultTime(date: string): string {
  return date === todayStr() ? nowTime() : '12:00'
}

const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

export function formatLong(s: string): string {
  const d = parseDate(s)
  return `${WD[d.getDay()]}, ${d.getDate()}. ${MON[d.getMonth()]}`
}

export function formatShort(s: string): string {
  const d = parseDate(s)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

export function formatDayMonth(s: string): string {
  const d = parseDate(s)
  return `${d.getDate()}.${d.getMonth() + 1}.`
}

export function weekdayShort(s: string): string {
  return WD_SHORT[parseDate(s).getDay()]
}

export function relativeDay(s: string): string {
  const diff = daysBetween(s, todayStr())
  if (diff === 0) return 'Heute'
  if (diff === 1) return 'Gestern'
  if (diff === -1) return 'Morgen'
  return formatLong(s)
}

export function minutesToHM(min: number | undefined): string {
  if (min == null || isNaN(min)) return '–'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Dauer zwischen zwei 'HH:MM', über Mitternacht hinweg */
export function durationBetween(bed: string, wake: string): number {
  const [bh, bm] = bed.split(':').map(Number)
  const [wh, wm] = wake.split(':').map(Number)
  let d = wh * 60 + wm - (bh * 60 + bm)
  if (d <= 0) d += 24 * 60
  return d
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Gute Nacht'
  if (h < 11) return 'Guten Morgen'
  if (h < 17) return 'Hallo'
  if (h < 22) return 'Guten Abend'
  return 'Gute Nacht'
}
