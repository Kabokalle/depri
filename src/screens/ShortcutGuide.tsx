import { setSetting, useSettings } from '../lib/settings'
import { Toggle } from '../components/ui'
import { SHORTCUT_NAME, runHealthShortcut } from '../platform/health'
import { isAndroid } from '../platform/native'

export function ShortcutGuide() {
  const s = useSettings()
  return (
    <div className="screen guide">
      <header className="page-header">
        <h1>Kurzbefehle & Apple Health</h1>
        <p className="muted">
          Einmal einrichten, ca. 10 Minuten. Danach holst du Schritte und Schlaf mit einem Tipp aus Apple Health.
        </p>
      </header>

      {isAndroid && (
        <div className="card">
          <p>Diese Anleitung ist fürs iPhone. Auf Android gibt es keine Kurzbefehle – trag deine Schritte auf „Heute“ einfach selbst ein (Tipp auf „Bewegung“).</p>
        </div>
      )}

      <section className="card">
        <h3>So funktioniert es</h3>
        <ol className="steps-list">
          <li>Du tippst in Depri auf <b>„Schritte & Schlaf aus Apple Health holen“</b>.</li>
          <li>
            Der Kurzbefehl <b>„{SHORTCUT_NAME}“</b> läuft kurz, liest die Werte aus Health und legt sie in die Zwischenablage.
          </li>
          <li>
            Du wechselst zurück zu Depri (oben links auf <b>‹ Depri</b> oder über den App-Umschalter) und tippst auf{' '}
            <b>„Health-Werte einfügen“</b>.
          </li>
        </ol>
        <p className="small muted">
          Warum so? Apple erlaubt Web-Apps keinen direkten Zugriff auf Health. Der Kurzbefehl ist die Brücke, ganz ohne Server.
        </p>
      </section>

      <section className="card">
        <h3>1. Kurzbefehl anlegen</h3>
        <ol className="steps-list">
          <li>
            Öffne die App <b>Kurzbefehle</b> → Tab <b>Kurzbefehle</b> → <b>+</b> (oben rechts).
          </li>
          <li>
            Tippe oben auf den Namen und nenne ihn genau <b>{SHORTCUT_NAME}</b> (mit Leerzeichen).
          </li>
        </ol>
      </section>

      <section className="card">
        <h3>2. Schritte von heute</h3>
        <ol className="steps-list">
          <li>
            Aktion suchen: <b>„Health-Samples suchen“</b>. Bei <i>Typ</i> <b>Schritte</b> wählen.
          </li>
          <li>
            <b>Filter hinzufügen</b>: <i>Startdatum</i> · <i>ist heute</i>.
          </li>
          <li>
            Aktion <b>„Statistik berechnen“</b> darunter: <b>Summe</b> von <i>Health-Samples</i>.
          </li>
          <li>
            Aktion <b>„Variable festlegen“</b>: Name <code>Schritte</code>, Wert <i>Statistik</i>.
          </li>
        </ol>
        <details className="disclosure">
          <summary>Optional: auch die Schritte von gestern</summary>
          <p className="small">
            Wiederhole die drei Aktionen mit Filter <i>Startdatum · ist gestern</i> und nenne die Variable <code>Gestern</code>.
            So stimmen die Schritte auch, wenn du morgens abgleichst.
          </p>
        </details>
      </section>

      <section className="card">
        <h3>3. Schlaf der letzten Nacht</h3>
        <ol className="steps-list">
          <li>
            Aktion <b>„Health-Samples suchen“</b>, Typ <b>Schlafanalyse</b>.
          </li>
          <li>
            Filter: <i>Enddatum · ist heute</i> und <i>Wert · ist nicht · Wach</i>.
          </li>
          <li>
            <i>Sortieren nach</i> <b>Startdatum</b>, <i>Reihenfolge</i> <b>Älteste zuerst</b>.
          </li>
          <li>
            Aktion <b>„Objekt aus Liste abrufen“</b>: <b>Erstes Objekt</b> aus <i>Health-Samples</i>.
          </li>
          <li>
            Aktion <b>„Details von Health-Samples abrufen“</b>: <b>Startdatum</b>.
          </li>
          <li>
            Aktion <b>„Datum formatieren“</b>: Format <b>Eigenes</b>, Formatstring <code>HH:mm</code>. Dann{' '}
            <b>„Variable festlegen“</b>: <code>Bett</code>.
          </li>
          <li>
            Nochmal <b>„Objekt aus Liste abrufen“</b>: <b>Letztes Objekt</b> aus den <i>Health-Samples</i> (die Schlafanalyse von
            oben auswählen), dann <b>Details: Enddatum</b>, <b>Datum formatieren</b> <code>HH:mm</code>, Variable{' '}
            <code>Aufstehen</code>.
          </li>
        </ol>
        <p className="small muted">
          Schlafdaten gibt es in Health nur, wenn du eine Apple Watch oder eine Schlaf-App nutzt oder den Schlafmodus mit
          Zeitplan verwendest. Sonst lass diesen Schritt weg und trag den Schlaf in Depri selbst ein.
        </p>
      </section>

      <section className="card">
        <h3>4. In die Zwischenablage</h3>
        <ol className="steps-list">
          <li>
            Aktion <b>„Text“</b> mit genau diesem Inhalt. Die Wörter in eckigen Klammern ersetzt du durch die jeweilige
            Variable (antippen → Variable auswählen):
            <pre className="code">depri?steps=[Schritte]&amp;stepsY=[Gestern]&amp;bed=[Bett]&amp;wake=[Aufstehen]</pre>
            Teile, die du nicht eingerichtet hast, lässt du einfach weg, z. B. nur <code>depri?steps=[Schritte]</code>.
          </li>
          <li>
            Aktion <b>„In Zwischenablage kopieren“</b> (Text).
          </li>
          <li>
            Fertig. Beim ersten Ausführen fragt iOS, ob der Kurzbefehl auf Health zugreifen darf: <b>Erlauben</b>.
          </li>
        </ol>
      </section>

      <section className="card">
        <h3>5. Ausprobieren</h3>
        <p className="small">Schalte den Abgleich ein. Danach erscheint auf „Heute“ der Health-Knopf.</p>
        <Toggle checked={s.iosShortcut} onChange={(v) => setSetting('iosShortcut', v)} label="Ich habe den Kurzbefehl eingerichtet" />
        <button className="btn" onClick={runHealthShortcut}>
          Kurzbefehl jetzt testen
        </button>
      </section>

      <section className="card">
        <h3>🔔 Erinnerungen</h3>
        <p className="small">
          Am einfachsten mit der <b>Erinnerungen-App</b>: neue Erinnerung, z. B. „Frühstück eingetragen? 🥐“, mit Uhrzeit und{' '}
          <i>Wiederholen: Täglich</i>. Oder per Kurzbefehle → <b>Automation</b> → <b>Tageszeit</b> → Aktion{' '}
          <b>„Mitteilung anzeigen“</b>.
        </p>
      </section>
    </div>
  )
}
