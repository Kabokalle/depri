import { useRef, useState } from 'react'
import { DEFAULT_SETTINGS, SECTION_LABELS, setSetting, useSettings, type Reminder } from '../lib/settings'
import { Field, Stepper, Toggle } from '../components/ui'
import { navigate, openSheet, toast } from '../lib/store'
import { backupFilename, exportBackup, importBackup } from '../lib/export'
import { shareFile } from '../platform/share'
import { isAndroidApp, isIOSWeb } from '../platform/native'
import { remindersSupported, syncReminders, testReminder } from '../platform/reminders'
import { connectHealth, healthConnectSupported, syncHealth } from '../platform/health'
import { todayStr, timeStr, formatShort, toDateStr } from '../lib/dates'

export function SettingsScreen() {
  const s = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [hcBusy, setHcBusy] = useState(false)

  const updateReminder = async (id: number, patch: Partial<Reminder>) => {
    await setSetting(
      'reminders',
      s.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    )
    await syncReminders()
  }

  const backup = async () => {
    const blob = await exportBackup()
    await shareFile(blob, backupFilename(), 'Depri-Sicherung')
  }

  const restore = async (f: File) => {
    if (!confirm('Achtung: Alle aktuellen Daten werden durch die Sicherung ersetzt. Fortfahren?')) return
    try {
      const n = await importBackup(f)
      await syncReminders()
      toast(`Sicherung wiederhergestellt (${n} Einträge)`)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const lastSync = s.lastHealthSync ? new Date(s.lastHealthSync) : undefined

  return (
    <div className="screen">
      <header className="page-header">
        <h1>Mehr</h1>
      </header>

      <button className="card action-card crisis-link" onClick={() => openSheet({ kind: 'crisis', date: todayStr() })}>
        <span className="action-icon">🆘</span>
        <span>
          <b>Hilfe in Krisen</b>
          <span className="small muted block">Telefonseelsorge, Bereitschaftsdienst, Notruf</span>
        </span>
        <span className="chev">›</span>
      </button>

      <section className="card">
        <h3>Über dich</h3>
        <Field label="Vorname" hint="für die Begrüßung und den Arztbericht">
          <input type="text" value={s.name} onChange={(e) => setSetting('name', e.target.value)} placeholder="optional" />
        </Field>
      </section>

      <section className="card">
        <h3>Sanfte Ziele</h3>
        <p className="muted small">Nur zur Orientierung. Es ist völlig okay, sie nicht zu erreichen.</p>
        <Field label="Schritte pro Tag">
          <Stepper value={s.goalSteps} onChange={(v) => setSetting('goalSteps', v)} step={500} max={50000} />
        </Field>
        <Field label="Trinken pro Tag">
          <Stepper value={s.goalDrinkMl} onChange={(v) => setSetting('goalDrinkMl', v)} step={250} unit="ml" max={6000} />
        </Field>
        <Field label="Schnell-Button Wasser">
          <Stepper value={s.quickWaterMl} onChange={(v) => setSetting('quickWaterMl', v)} step={50} unit="ml" max={1500} />
        </Field>
        <Field label="Schnell-Button Kaffee">
          <Stepper value={s.quickCoffeeMl} onChange={(v) => setSetting('quickCoffeeMl', v)} step={50} unit="ml" max={1000} />
        </Field>
        <Field label="PHQ-9 vorschlagen alle">
          <Stepper value={s.phqIntervalDays} onChange={(v) => setSetting('phqIntervalDays', v)} step={7} min={7} max={56} unit="Tage" />
        </Field>
      </section>

      <section className="card">
        <h3>Startseite</h3>
        <p className="muted small">Blende aus, was du gerade nicht brauchst.</p>
        {Object.entries(SECTION_LABELS).map(([k, l]) => (
          <Toggle
            key={k}
            checked={s.todaySections[k] !== false}
            onChange={(v) => setSetting('todaySections', { ...s.todaySections, [k]: v })}
            label={l}
          />
        ))}
      </section>

      <section className="card">
        <h3>🔔 Erinnerungen</h3>
        {remindersSupported ? (
          <>
            <p className="muted small">Freundliche Hinweise zu festen Uhrzeiten. Medikamenten-Erinnerungen stellst du beim jeweiligen Medikament ein.</p>
            {s.reminders.map((r) => (
              <div className="reminder-row" key={r.id}>
                <Toggle checked={r.enabled} onChange={(v) => updateReminder(r.id, { enabled: v })} label={r.label} />
                {r.enabled && <input type="time" value={r.time} onChange={(e) => updateReminder(r.id, { time: e.target.value })} />}
              </div>
            ))}
            <button className="btn small ghost" onClick={testReminder}>
              Test-Erinnerung in 5 Sekunden
            </button>
          </>
        ) : (
          <>
            <p className="small">
              {isIOSWeb
                ? 'Auf dem iPhone richtest du Erinnerungen einmalig über die Kurzbefehle-App ein. Dort lässt sich auch der automatische Abgleich von Schritten und Schlaf aus Apple Health einrichten.'
                : 'Im Browser sind Erinnerungen nicht möglich. Nutze am iPhone die Kurzbefehle-App, auf Android die Depri-App.'}
            </p>
            <button className="btn small" onClick={() => navigate('/kurzbefehle')}>
              Anleitung: Kurzbefehle & Apple Health
            </button>
          </>
        )}
      </section>

      {healthConnectSupported && (
        <section className="card">
          <h3>❤️ Health Connect</h3>
          <p className="muted small">
            Schritte, Schlaf und Trainings automatisch übernehmen (z. B. von Google Fit, Samsung Health, Fitbit).
          </p>
          {s.healthConnected ? (
            <>
              <p className="small">
                Verbunden ✓{lastSync ? ` · zuletzt ${toDateStr(lastSync) === todayStr() ? 'heute' : formatShort(toDateStr(lastSync))} ${timeStr(lastSync.getTime())}` : ''}
              </p>
              <button
                className="btn small"
                disabled={hcBusy}
                onClick={async () => {
                  setHcBusy(true)
                  await syncHealth(30)
                  setHcBusy(false)
                  toast('Abgeglichen ✓')
                }}
              >
                {hcBusy ? 'Gleiche ab …' : 'Jetzt abgleichen (30 Tage)'}
              </button>
            </>
          ) : (
            <button
              className="btn"
              disabled={hcBusy}
              onClick={async () => {
                setHcBusy(true)
                try {
                  const ok = await connectHealth()
                  toast(ok ? 'Health Connect verbunden ✓' : 'Keine Berechtigung erteilt')
                } catch (e) {
                  alert((e as Error).message)
                } finally {
                  setHcBusy(false)
                }
              }}
            >
              Mit Health Connect verbinden
            </button>
          )}
        </section>
      )}

      {!isAndroidApp && (
        <button className="card action-card" onClick={() => navigate('/kurzbefehle')}>
          <span className="action-icon">⚡</span>
          <span>
            <b>Kurzbefehle & Apple Health</b>
            <span className="small muted block">Schritte und Schlaf automatisch übernehmen, Erinnerungen</span>
          </span>
          <span className="chev">›</span>
        </button>
      )}

      <section className="card">
        <h3>💾 Sicherung</h3>
        <p className="muted small">
          Deine Daten liegen nur auf diesem Gerät. Speichere ab und zu eine Sicherung (z. B. in iCloud Drive oder Google
          Drive), damit nichts verloren geht. Die Sicherung funktioniert auf iPhone und Android.
        </p>
        <div className="row-inline">
          <button className="btn" onClick={backup}>
            Sicherung speichern
          </button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>
            Wiederherstellen
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) restore(f)
            e.target.value = ''
          }}
        />
      </section>

      <section className="card">
        <h3>Datenschutz</h3>
        <p className="small muted">
          Depri hat keinen Server, kein Konto und keine Werbung. Alle Einträge bleiben in der App auf diesem Gerät. Nur du
          entscheidest, ob du eine Sicherung oder einen Bericht weitergibst.
        </p>
      </section>

      <details className="disclosure card">
        <summary>Erweitert</summary>
        <button
          className="btn small ghost"
          onClick={async () => {
            if (!confirm('Einstellungen auf Standard zurücksetzen? Deine Einträge bleiben erhalten.')) return
            for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
              if (k === 'name' || k === 'onboarded' || k === 'healthConnected') continue
              await setSetting(k as never, v as never)
            }
            await syncReminders()
            toast('Einstellungen zurückgesetzt')
          }}
        >
          Einstellungen zurücksetzen
        </button>
      </details>

      <p className="footnote">Depri · Version {__APP_VERSION__}</p>
    </div>
  )
}
