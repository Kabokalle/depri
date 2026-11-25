import { useRef } from 'react'
import { DEFAULT_SETTINGS, SECTION_LABELS, setSetting, useSettings } from '../lib/settings'
import { Field, Stepper, Toggle } from '../components/ui'
import { navigate, openSheet, toast, useStore } from '../lib/store'
import { backupFilename, exportBackup, importBackup } from '../lib/export'
import { shareFile } from '../platform/share'
import { installStore, isAndroid, isStandalone, promptInstall } from '../platform/native'
import { todayStr } from '../lib/dates'

export function SettingsScreen() {
  const s = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const install = useStore(installStore)

  const backup = async () => {
    const blob = await exportBackup()
    await shareFile(blob, backupFilename(), 'Depri-Sicherung')
  }

  const restore = async (f: File) => {
    if (!confirm('Achtung: Alle aktuellen Daten werden durch die Sicherung ersetzt. Fortfahren?')) return
    try {
      const n = await importBackup(f)
      toast(`Sicherung wiederhergestellt (${n} Einträge)`)
    } catch (e) {
      alert((e as Error).message)
    }
  }

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

      {install && !isStandalone && (
        <button
          className="card action-card report"
          onClick={async () => {
            if (await promptInstall()) toast('Depri ist installiert ✓')
          }}
        >
          <span className="action-icon">📲</span>
          <span>
            <b>Als App installieren</b>
            <span className="small muted block">Eigenes Icon, Vollbild, funktioniert offline</span>
          </span>
          <span className="chev">›</span>
        </button>
      )}

      <section className="card">
        <h3>🔔 Erinnerungen</h3>
        <p className="small">
          Web-Apps können ohne eigenen Server keine Benachrichtigungen zu festen Uhrzeiten verschicken. Nimm dafür die
          Erinnerungen deines Handys – das ist zuverlässig und bleibt privat:
        </p>
        {isAndroid ? (
          <ul className="steps-list small">
            <li>
              <b>Google Kalender oder Google Tasks:</b> Termin oder Aufgabe, z. B. „Frühstück eingetragen? 🥐“, mit{' '}
              <i>Wiederholen: Täglich</i>.
            </li>
            <li>
              Oder sag einfach: <i>„Hey Google, erinnere mich jeden Tag um 9 Uhr ans Frühstück.“</i>
            </li>
          </ul>
        ) : (
          <ul className="steps-list small">
            <li>
              <b>Erinnerungen-App:</b> neue Erinnerung, z. B. „Frühstück eingetragen? 🥐“, mit Uhrzeit und{' '}
              <i>Wiederholen: Täglich</i>.
            </li>
            <li>
              Oder sag einfach: <i>„Siri, erinnere mich jeden Tag um 9 Uhr ans Frühstück.“</i>
            </li>
          </ul>
        )}
        <p className="small muted">
          Gute Zeiten zum Start: 9:00 Frühstück, 10:30 Trinken, 12:30 Mittagessen, 18:30 Abendessen, 20:00 Check-in, dazu
          deine Medikamenten-Zeiten.
        </p>
      </section>

      {!isAndroid && (
        <button className="card action-card" onClick={() => navigate('/kurzbefehle')}>
          <span className="action-icon">⚡</span>
          <span>
            <b>Kurzbefehle & Apple Health</b>
            <span className="small muted block">Schritte und Schlaf vom iPhone übernehmen</span>
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
              if (k === 'name' || k === 'onboarded') continue
              await setSetting(k as never, v as never)
            }
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
