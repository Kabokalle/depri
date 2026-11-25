import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { daysBetween, formatLong, formatShort, relativeDay, todayStr } from '../lib/dates'
import { phqSeverity } from '../lib/phq9'
import { navigate, openSheet } from '../lib/store'
import { useSettings } from '../lib/settings'

export function Doctor() {
  const s = useSettings()
  const today = todayStr()
  const data = useLiveQuery(async () => {
    const [appointments, questions, lastPhq, meds] = await Promise.all([
      db.appointments.orderBy('date').toArray(),
      db.questions.orderBy('createdAt').toArray(),
      db.phq9.orderBy('ts').last(),
      db.medications.toArray(),
    ])
    return { appointments, questions, lastPhq, meds }
  }, [])
  if (!data) return <div className="screen" />
  const upcoming = data.appointments.filter((a) => a.date >= today)
  const past = data.appointments.filter((a) => a.date < today).reverse()
  const open = data.questions.filter((q) => !q.done)
  const done = data.questions.filter((q) => q.done).reverse()
  const phqDays = data.lastPhq ? daysBetween(data.lastPhq.date, today) : undefined
  const activeMeds = data.meds.filter((m) => m.active)

  return (
    <div className="screen">
      <header className="page-header">
        <h1>Arzt & Therapie</h1>
        <p className="muted">Alles, was du zum nächsten Termin mitnehmen möchtest.</p>
      </header>

      <button className="card action-card report" onClick={() => navigate('/bericht')}>
        <span className="action-icon">📄</span>
        <span>
          <b>Bericht für den Arzt</b>
          <span className="small muted block">Zusammenfassung als PDF – Zeitraum frei wählbar</span>
        </span>
        <span className="chev">›</span>
      </button>

      <button className="card action-card" onClick={() => navigate('/phq9')}>
        <span className="action-icon">📝</span>
        <span>
          <b>Fragebogen PHQ-9</b>
          <span className="small muted block">
            {data.lastPhq
              ? `Zuletzt vor ${phqDays} Tag${phqDays === 1 ? '' : 'en'}: ${data.lastPhq.score} Punkte (${phqSeverity(data.lastPhq.score).label})`
              : 'Noch nicht ausgefüllt'}
            {phqDays != null && phqDays >= s.phqIntervalDays ? ' · wieder fällig' : ''}
          </span>
        </span>
        <span className="chev">›</span>
      </button>

      <button className="card action-card" onClick={() => navigate('/medikamente')}>
        <span className="action-icon">💊</span>
        <span>
          <b>Medikamente</b>
          <span className="small muted block">
            {activeMeds.length ? activeMeds.map((m) => `${m.name} ${m.dose}`).join(', ') : 'Noch keine eingetragen'}
          </span>
        </span>
        <span className="chev">›</span>
      </button>

      <section className="card">
        <div className="card-head">
          <h3>❓ Fragen für den nächsten Termin</h3>
          <button className="btn small" onClick={() => openSheet({ kind: 'question', date: today })}>
            + Frage
          </button>
        </div>
        {open.length === 0 ? (
          <p className="muted small">Wenn dir etwas einfällt, schreib es hier auf – dann geht es beim Termin nicht verloren.</p>
        ) : (
          <ul className="check-list">
            {open.map((q) => (
              <li key={q.id}>
                <button
                  className="check"
                  aria-label="Als besprochen markieren"
                  onClick={() => db.questions.update(q.id!, { done: true, doneAt: Date.now() })}
                />
                <button className="check-text" onClick={() => openSheet({ kind: 'question', date: today, id: q.id })}>
                  {q.text}
                </button>
              </li>
            ))}
          </ul>
        )}
        {done.length > 0 && (
          <details className="disclosure">
            <summary>Besprochen ({done.length})</summary>
            <ul className="check-list done">
              {done.map((q) => (
                <li key={q.id}>
                  <button className="check on" aria-label="Wieder öffnen" onClick={() => db.questions.update(q.id!, { done: false, doneAt: undefined })} />
                  <button className="check-text" onClick={() => openSheet({ kind: 'question', date: today, id: q.id })}>
                    {q.text}
                    {q.answer && <span className="small muted block">→ {q.answer}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h3>📅 Termine</h3>
          <button className="btn small" onClick={() => openSheet({ kind: 'appointment', date: today })}>
            + Termin
          </button>
        </div>
        {upcoming.length === 0 && past.length === 0 && <p className="muted small">Noch keine Termine eingetragen.</p>}
        <ul className="appt-list">
          {upcoming.map((a) => (
            <li key={a.id}>
              <button onClick={() => openSheet({ kind: 'appointment', date: today, id: a.id })}>
                <b>{relativeDay(a.date) === formatLong(a.date) ? formatLong(a.date) : relativeDay(a.date)}</b>
                {a.time ? ` · ${a.time}` : ''}
                <span className="block small muted">
                  {a.kind}
                  {a.who ? ` · ${a.who}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {past.length > 0 && (
          <details className="disclosure">
            <summary>Vergangene Termine ({past.length})</summary>
            <ul className="appt-list past">
              {past.map((a) => (
                <li key={a.id}>
                  <button onClick={() => openSheet({ kind: 'appointment', date: today, id: a.id })}>
                    {formatShort(a.date)} · {a.kind}
                    {a.who ? ` · ${a.who}` : ''}
                    {a.note && <span className="block small muted">{a.note}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  )
}
