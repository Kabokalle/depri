import { useSyncExternalStore } from 'react'

/** Winzige globale Stores für Sheets, Toasts und Routing (ohne zusätzliche Bibliothek) */
function createStore<T>(initial: T) {
  let value = initial
  const subs = new Set<() => void>()
  return {
    get: () => value,
    set: (v: T) => {
      value = v
      subs.forEach((f) => f())
    },
    subscribe: (f: () => void) => {
      subs.add(f)
      return () => subs.delete(f)
    },
  }
}

export function useStore<T>(s: { get: () => T; subscribe: (f: () => void) => () => void }): T {
  return useSyncExternalStore(s.subscribe, s.get, s.get)
}

// ---------- Sheets ----------
export type SheetKind =
  | 'meal'
  | 'drink'
  | 'activity'
  | 'steps'
  | 'checkin'
  | 'sleep'
  | 'substance'
  | 'review'
  | 'sideeffect'
  | 'medication'
  | 'appointment'
  | 'question'
  | 'crisis'

export interface SheetState {
  kind: SheetKind
  date: string
  id?: number | string
}

export const sheetStore = createStore<SheetState | null>(null)
export const openSheet = (s: SheetState) => sheetStore.set(s)
export const closeSheet = () => sheetStore.set(null)

// ---------- Toasts ----------
export interface ToastState {
  id: number
  text: string
  undo?: () => void
}
export const toastStore = createStore<ToastState | null>(null)
let toastTimer: number | undefined
export function toast(text: string, undo?: () => void) {
  const t = { id: Date.now(), text, undo }
  toastStore.set(t)
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    if (toastStore.get()?.id === t.id) toastStore.set(null)
  }, 4000)
}

// ---------- Routing (Hash) ----------
export interface Route {
  path: string
  params: URLSearchParams
}
function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/heute'
  const [path, query = ''] = raw.split('?')
  return { path: path || '/heute', params: new URLSearchParams(query) }
}
export const routeStore = createStore<Route>(parseHash())
window.addEventListener('hashchange', () => {
  routeStore.set(parseHash())
  window.scrollTo(0, 0)
})
export const useRoute = () => useStore(routeStore)
export function navigate(to: string) {
  window.location.hash = to
}
