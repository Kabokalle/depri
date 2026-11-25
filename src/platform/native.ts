import { createStore } from '../lib/store'

const ua = navigator.userAgent

/** iPhone/iPad (Safari oder Home-Bildschirm-App) */
export const isAndroid = /Android/i.test(ua)
export const isIOSWeb =
  !isAndroid && (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

export const isStandalone =
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

/* Android/Chrome: "App installieren"-Dialog merken, um ihn per Knopf auszulösen */
interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
export const installStore = createStore<InstallEvent | null>(null)

export function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installStore.set(e as InstallEvent)
  })
  window.addEventListener('appinstalled', () => installStore.set(null))
}

export async function promptInstall(): Promise<boolean> {
  const e = installStore.get()
  if (!e) return false
  await e.prompt()
  const r = await e.userChoice
  installStore.set(null)
  return r.outcome === 'accepted'
}
