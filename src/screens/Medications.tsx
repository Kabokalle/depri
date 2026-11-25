import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, formatShort, todayStr } from '../lib/dates'
import { loadRange, medAdherence, sideEffectSummary } from '../lib/stats'
import { openSheet } from '../lib/store'
import { SEVERITY, label } from '../lib/labels'

export function Medications() {
  const today = todayStr()
  const data = useLiveQuery(async () => {
    const r = await loadRange(addDays(today, -27), today)
    return { adh: medAdherence(r), effects: r.sideEffects, meds: r.meds }
  }, [today])
  if (!data) return <div className="screen" />
  const active = data.adh.filter((a) => a.med.active)
  const inactive = data.adh.filter((a) => !a.med.active)

  return (
    <div className="screen">
      <header className="page-header">
        <h1>Medikamente</h1>
        <p className="muted">Einnahme, Dosis-Änderungen und Nebenwirkungen – die wichtigste Grundlage für Gespräche mit deinem Arzt.</p>
      </header>

      <button className="btn primary block" onClick={() => openSheet({ kind: 'medication', date: today })}>
        + Medikament hinzufügen
      </button>

      {active.map((a) => (
        <section className="card" key={a.med.id}>
          <div className="card-head">
            <div>
              <h3>
                {a.med.name} <span className="muted">{a.med.dose}</span>
              </h3>
              <div className="small muted">{a.med.times.join(' · ')} Uhr</div>
            </div>
            <button className="btn small ghost" onClick={() => openSheet({ kind: 'medication', date: today, id: a.med.id })}>
              Bearbeiten
            </button>
          </div>
          {a.planned > 0 && (
            <div className="adherence">
              <div className="progress">
                <div style={{ width: `${a.pct ?? 0}%` }} />
              </div>
              <span className="small">
                Letzte 4 Wochen: <b>{Math.round(a.pct ?? 0)} %</b> genommen
                {a.skipped ? ` · ${a.skipped}× bewusst ausgelassen` : ''}
              </span>
            </div>
          )}
          {a.effects.length > 0 && (
            <div className="small">
              Nebenwirkungen:{' '}
              {sideEffectSummary(a.effects)
                .map((e) => `${e.kind} (${e.count}×)`)
                .join(', ')}
            </div>
          )}
        </section>
      ))}

      <section className="card">
        <div className="card-head">
          <h3>⚠️ Nebenwirkungen</h3>
          <button className="btn small" onClick={() => openSheet({ kind: 'sideeffect', date: today })}>
            + Eintragen
          </button>
        </div>
        {data.effects.length === 0 ? (
          <p className="muted small">In den letzten 4 Wochen nichts notiert.</p>
        ) : (
          <ul className="plain-list">
            {[...data.effects].reverse().map((e) => (
              <li key={e.id}>
                <button className="link-row" onClick={() => openSheet({ kind: 'sideeffect', date: e.date, id: e.id })}>
                  <span>
                    {formatShort(e.date)} · <b>{e.kind}</b> ({label(SEVERITY, e.severity)})
                  </span>
                  <span className="muted small">{data.meds.find((m) => m.id === e.medId)?.name ?? ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {inactive.length > 0 && (
        <details className="disclosure card">
          <summary>Frühere Medikamente ({inactive.length})</summary>
          <ul className="plain-list">
            {inactive.map((a) => (
              <li key={a.med.id}>
                <button className="link-row" onClick={() => openSheet({ kind: 'medication', date: today, id: a.med.id })}>
                  <span>
                    {a.med.name} {a.med.dose}
                  </span>
                  <span className="muted small">abgesetzt</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="footnote">Ändere Medikamente bitte nur in Absprache mit deinem Arzt.</p>
    </div>
  )
}
