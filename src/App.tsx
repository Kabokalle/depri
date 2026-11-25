import { useEffect } from 'react'
import { closeSheet, navigate, sheetStore, toastStore, useRoute, useStore } from './lib/store'
import { todayStr } from './lib/dates'
import { DayView } from './screens/DayView'
import { History } from './screens/History'
import { Week } from './screens/Week'
import { Doctor } from './screens/Doctor'
import { Phq9Screen } from './screens/Phq9'
import { Report } from './screens/Report'
import { Medications } from './screens/Medications'
import { SettingsScreen } from './screens/Settings'
import { ImportFromShortcut } from './screens/ImportFromShortcut'
import { ShortcutGuide } from './screens/ShortcutGuide'
import { HelpScreen } from './screens/Help'
import { MealSheet } from './sheets/MealSheet'
import { DrinkSheet } from './sheets/DrinkSheet'
import { ActivitySheet, StepsSheet } from './sheets/ActivitySheet'
import { CheckinSheet } from './sheets/CheckinSheet'
import { SleepSheet } from './sheets/SleepSheet'
import { SubstanceSheet } from './sheets/SubstanceSheet'
import { ReviewSheet } from './sheets/ReviewSheet'
import { MedicationSheet, SideEffectSheet } from './sheets/MedicationSheets'
import { AppointmentSheet, QuestionSheet } from './sheets/DoctorSheets'
import { CrisisSheet } from './components/CrisisHelp'
import { isAndroidApp } from './platform/native'
import { syncHealth } from './platform/health'
import { initReminderTapHandler, syncReminders } from './platform/reminders'

const TABS = [
  { path: '/heute', label: 'Heute', icon: '☀️' },
  { path: '/verlauf', label: 'Verlauf', icon: '📅' },
  { path: '/woche', label: 'Woche', icon: '📊' },
  { path: '/arzt', label: 'Arzt', icon: '🩺' },
  { path: '/mehr', label: 'Mehr', icon: '⚙️' },
]

const TAB_OF: Record<string, string> = {
  '/tag': '/verlauf',
  '/phq9': '/arzt',
  '/bericht': '/arzt',
  '/medikamente': '/arzt',
  '/kurzbefehle': '/mehr',
  '/hilfe': '/mehr',
}

function Screen() {
  const { path, params } = useRoute()
  switch (path) {
    case '/heute':
      return <DayView date={todayStr()} />
    case '/tag':
      return <DayView date={params.get('d') || todayStr()} />
    case '/verlauf':
      return <History />
    case '/woche':
      return <Week />
    case '/arzt':
      return <Doctor />
    case '/phq9':
      return <Phq9Screen />
    case '/bericht':
      return <Report />
    case '/medikamente':
      return <Medications />
    case '/mehr':
      return <SettingsScreen />
    case '/import':
      return <ImportFromShortcut params={params} />
    case '/kurzbefehle':
      return <ShortcutGuide />
    case '/hilfe':
      return <HelpScreen />
    default:
      return <DayView date={todayStr()} />
  }
}

function SheetHost() {
  const s = useStore(sheetStore)
  if (!s) return null
  const id = typeof s.id === 'number' ? s.id : undefined
  const p = { date: s.date, id, onClose: closeSheet }
  switch (s.kind) {
    case 'meal':
      return <MealSheet key={`${s.date}-${id}`} {...p} />
    case 'drink':
      return <DrinkSheet key={`${s.date}-${id}`} {...p} />
    case 'activity':
      return <ActivitySheet key={`${s.date}-${id}`} {...p} />
    case 'steps':
      return <StepsSheet {...p} />
    case 'checkin':
      return <CheckinSheet key={`${s.date}-${id}`} {...p} />
    case 'sleep':
      return <SleepSheet {...p} />
    case 'substance':
      return <SubstanceSheet key={`${s.date}-${id}`} {...p} />
    case 'review':
      return <ReviewSheet {...p} />
    case 'sideeffect':
      return <SideEffectSheet key={`${s.date}-${id}`} {...p} />
    case 'medication':
      return <MedicationSheet id={id} onClose={closeSheet} />
    case 'appointment':
      return <AppointmentSheet id={id} onClose={closeSheet} />
    case 'question':
      return <QuestionSheet id={id} onClose={closeSheet} />
    case 'crisis':
      return <CrisisSheet onClose={closeSheet} />
  }
}

function Toast() {
  const t = useStore(toastStore)
  if (!t) return null
  return (
    <div className="toast" role="status" key={t.id}>
      <span>{t.text}</span>
      {t.undo && (
        <button
          className="toast-undo"
          onClick={() => {
            t.undo?.()
            toastStore.set(null)
          }}
        >
          Rückgängig
        </button>
      )}
    </div>
  )
}

export default function App() {
  const { path } = useRoute()
  const active = TAB_OF[path] ?? path

  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {})
    if (!isAndroidApp) return
    // Android: beim Start und bei jeder Rückkehr in die App synchronisieren
    syncHealth(7)
    syncReminders()
    initReminderTapHandler((r) => navigate(r))
    let remove: (() => void) | undefined
    import('@capacitor/app').then(({ App: CapApp }) => {
      CapApp.addListener('appStateChange', (st) => {
        if (st.isActive) syncHealth(3)
      }).then((h) => (remove = () => h.remove()))
      CapApp.addListener('backButton', () => {
        if (sheetStore.get()) closeSheet()
        else if (window.location.hash && !window.location.hash.startsWith('#/heute')) window.history.back()
        else CapApp.minimizeApp()
      })
    })
    return () => remove?.()
  }, [])

  return (
    <div className="app">
      <main>
        <Screen />
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <a key={t.path} href={`#${t.path}`} className={'tab' + (active === t.path ? ' on' : '')}>
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </a>
        ))}
      </nav>
      <SheetHost />
      <Toast />
    </div>
  )
}
