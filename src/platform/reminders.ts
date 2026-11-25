import { db } from '../db'
import { getSettings } from '../lib/settings'
import { isAndroidApp } from './native'

/**
 * Erinnerungen:
 * - Android-App: echte lokale Benachrichtigungen (täglich wiederkehrend)
 * - iPhone / Web: über Kurzbefehl-Automationen (siehe Anleitung), hier nichts zu tun
 */
export const remindersSupported = isAndroidApp

const MED_ID_BASE = 1000

async function plugin() {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  return LocalNotifications
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!remindersSupported) return false
  const LN = await plugin()
  let p = await LN.checkPermissions()
  if (p.display !== 'granted') p = await LN.requestPermissions()
  return p.display === 'granted'
}

/** Plant alle Erinnerungen neu (nach jeder Änderung an Einstellungen oder Medikamenten aufrufen) */
export async function syncReminders(): Promise<void> {
  if (!remindersSupported) return
  const LN = await plugin()
  const pending = await LN.getPending()
  if (pending.notifications.length) {
    await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
  }
  const s = await getSettings()
  const meds = await db.medications.filter((m) => m.active && m.remind).toArray()
  const list: { id: number; title: string; body: string; time: string; route: string }[] = []
  for (const r of s.reminders) {
    if (!r.enabled) continue
    list.push({ id: r.id, title: r.label, body: r.body, time: r.time, route: '/heute' })
  }
  for (const m of meds) {
    m.times.forEach((t, i) => {
      list.push({
        id: MED_ID_BASE + (m.id ?? 0) * 10 + i,
        title: `${m.name} ${m.dose}`.trim(),
        body: 'Zeit für dein Medikament. Tippe zum Abhaken.',
        time: t,
        route: '/heute',
      })
    })
  }
  if (!list.length) return
  const ok = await ensureNotificationPermission()
  if (!ok) return
  await LN.schedule({
    notifications: list.map((n) => {
      const [hour, minute] = n.time.split(':').map(Number)
      return {
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: { on: { hour, minute }, allowWhileIdle: true },
        extra: { route: n.route },
      }
    }),
  })
}

export async function initReminderTapHandler(go: (route: string) => void) {
  if (!remindersSupported) return
  const LN = await plugin()
  await LN.addListener('localNotificationActionPerformed', (e) => {
    const route = (e.notification.extra as { route?: string } | undefined)?.route
    if (route) go(route)
  })
}

export async function testReminder() {
  if (!remindersSupported) return
  if (!(await ensureNotificationPermission())) return
  const LN = await plugin()
  await LN.schedule({
    notifications: [{ id: 999, title: 'Test-Erinnerung', body: 'So sehen deine Erinnerungen aus 💛', schedule: { at: new Date(Date.now() + 5000) } }],
  })
}
