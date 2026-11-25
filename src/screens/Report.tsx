import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { addDays, formatShort, minutesToHM, todayStr } from '../lib/dates'
import { avg, loadRange, medAdherence, series } from '../lib/stats'
import { useSettings, setSetting } from '../lib/settings'
import { Chips, Field, Toggle } from '../components/ui'
import { shareFile } from '../platform/share'
import { exportCsv } from '../lib/export'
import { phqSeverity } from '../lib/phq9'
import { toast } from '../lib/store'

type Preset = 'seit' | '14' | '28' | '90' | 'frei'

export function Report() {
  const s = useSettings()
  const today = todayStr()
  const lastAppt = useLiveQuery(async () => {
    const all = await db.appointments.where('date').below(today).sortBy('date')
    return all[all.length - 1]
  }, [today])
  const [preset, setPreset] = useState<Preset>('28')
  const [freeFrom, setFreeFrom] = useState(addDays(today, -27))
  const [freeTo, setFreeTo] = useState(today)
  const [includeNotes, setIncludeNotes] = useState(false)
  const [detailed, setDetailed] = useState(true)
  const [busy, setBusy] = useState(false)

  let from = addDays(today, -27)
  let to = today
  if (preset === '14') from = addDays(today, -13)
  if (preset === '90') from = addDays(today, -89)
  if (preset === 'seit' && lastAppt) from = lastAppt.date
  if (preset === 'frei') {
    from = freeFrom
    to = freeTo
  }

  const preview = useLiveQuery(async () => {
    const r = await loadRange(from, to)
    const ser = series(r)
    const num = (a: (number | undefined)[]) => a.filter((x): x is number => x != null)
    const { analyze } = await import('../lib/insights')
    const a = analyze(r, { cycle: s.trackCycle })
    return {
      r,
      findings: a.corr.findings.length,
      highlights: a.highlights,
      tracked: ser.filter((x) => x.mood != null || x.meals || x.drinkMl != null || x.steps != null).length,
      mood: avg(num(ser.map((x) => x.mood))),
      sleep: avg(num(ser.map((x) => x.sleepMin))),
      steps: avg(num(ser.map((x) => x.steps))),
      phq: r.phq9.filter((p) => p.date >= from && p.date <= to),
      adh: medAdherence(r).filter((a) => a.planned > 0),
      openQ: r.questions.filter((q) => !q.done).length,
    }
  }, [from, to, s.trackCycle])

  const makePdf = async () => {
    setBusy(true)
    try {
      const { buildReportPdf } = await import('../lib/pdf')
      const r = await loadRange(from, to)
      const blob = buildReportPdf(r, { name: s.name, includeNotes, detailed, cycle: s.trackCycle })
      await shareFile(blob, `Verlaufsbericht-${from}-bis-${to}.pdf`, 'Verlaufsbericht')
    } catch (e) {
      toast('PDF konnte nicht erstellt werden: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const makeCsv = async () => {
    const blob = await exportCsv(from, to)
    await shareFile(blob, `depri-daten-${from}-bis-${to}.csv`, 'Depri-Daten (CSV)')
  }

  const presets: { value: Preset; label: string }[] = [
    ...(lastAppt ? [{ value: 'seit' as Preset, label: `Seit letztem Termin (${formatShort(lastAppt.date)})` }] : []),
    { value: '14', label: '2 Wochen' },
    { value: '28', label: '4 Wochen' },
    { value: '90', label: '3 Monate' },
    { value: 'frei', label: 'Frei wählen' },
  ]

  return (
    <div className="screen">
      <header className="page-header">
        <h1>Bericht für den Arzt</h1>
        <p className="muted">Eine kompakte Zusammenfassung als PDF. Du entscheidest, wem du sie zeigst oder schickst.</p>
      </header>

      <section className="card">
        <Field label="Zeitraum">
          <Chips options={presets} value={preset} onChange={(v) => v && setPreset(v)} />
        </Field>
        {preset === 'frei' && (
          <div className="row2">
            <Field label="Von">
              <input type="date" value={freeFrom} max={freeTo} onChange={(e) => setFreeFrom(e.target.value)} />
            </Field>
            <Field label="Bis">
              <input type="date" value={freeTo} min={freeFrom} max={today} onChange={(e) => setFreeTo(e.target.value)} />
            </Field>
          </div>
        )}
        <Field label="Name im Bericht" hint="optional">
          <input type="text" value={s.name} onChange={(e) => setSetting('name', e.target.value)} placeholder="Vor- und Nachname" />
        </Field>
        <Toggle checked={includeNotes} onChange={setIncludeNotes} label="Persönliche Notizen aus Check-ins einschließen" />
        <Toggle checked={detailed} onChange={setDetailed} label="Ausführliche Auswertung und Tagestabelle" />
        <p className="small muted">
          Mit Tagesrhythmus-Grafik, Auswertung nach Uhrzeit, möglichen Zusammenhängen (z. B. Koffein und Schlaf) und einer
          Tabelle aller Tage. Ausgeschaltet entsteht ein kompakter Bericht.
        </p>
      </section>

      {preview && (
        <section className="card">
          <h3>Vorschau</h3>
          <p className="small muted">
            {formatShort(from)} – {formatShort(to)} · Einträge an {preview.tracked} Tagen
          </p>
          <ul className="plain-list">
            <li>💛 Stimmung Ø {preview.mood != null ? preview.mood.toLocaleString('de-DE', { maximumFractionDigits: 1 }) : '–'} / 5</li>
            <li>🌙 Schlaf Ø {minutesToHM(preview.sleep)}</li>
            <li>👣 Schritte Ø {preview.steps != null ? Math.round(preview.steps).toLocaleString('de-DE') : '–'}</li>
            <li>
              📝 PHQ-9:{' '}
              {preview.phq.length ? preview.phq.map((p) => `${p.score} (${phqSeverity(p.score).label})`).join(' → ') : 'im Zeitraum nicht ausgefüllt'}
            </li>
            {preview.adh.map((a) => (
              <li key={a.med.id}>
                💊 {a.med.name}: {Math.round(a.pct ?? 0)} % genommen
              </li>
            ))}
            <li>❓ {preview.openQ} offene Fragen</li>
            {detailed && (
              <li>
                🔗 {preview.findings ? `${preview.findings} mögliche Zusammenhänge gefunden` : 'Noch keine deutlichen Zusammenhänge (mehr Tage helfen)'}
              </li>
            )}
          </ul>
        </section>
      )}

      <button className="btn primary block" onClick={makePdf} disabled={busy}>
        {busy ? 'Wird erstellt …' : '📄 PDF erstellen und teilen'}
      </button>
      <button className="btn ghost block" onClick={makeCsv}>
        Rohdaten als CSV (Excel)
      </button>
      <p className="footnote">
        Das PDF wird nur auf deinem Gerät erzeugt. Über das Teilen-Menü kannst du es speichern, drucken, per Mail oder AirDrop
        verschicken.
      </p>
    </div>
  )
}
