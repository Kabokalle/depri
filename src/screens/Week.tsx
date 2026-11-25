import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, formatDayMonth, minutesToHM, todayStr, weekStart } from '../lib/dates'
import { activityInsights, avg, loadRange, series, smallWins } from '../lib/stats'
import { useSettings } from '../lib/settings'
import { BarChart, LineChart } from '../components/Charts'
import { navigate } from '../lib/store'

export function Week() {
  const s = useSettings()
  const [start, setStart] = useState(weekStart(todayStr()))
  const end = addDays(start, 6)
  const isCurrent = start === weekStart(todayStr())
  const data = useLiveQuery(async () => {
    const r = await loadRange(start, end)
    const insightRange = await loadRange(addDays(end, -27), end)
    return { r, ser: series(r), insights: activityInsights(insightRange.activities) }
  }, [start, end])

  if (!data) return <div className="screen" />
  const { r, ser, insights } = data
  const wins = smallWins(r, ser, { steps: s.goalSteps, drinkMl: s.goalDrinkMl })
  const pt = (f: (x: (typeof ser)[number]) => number | undefined) => ser.map((x) => ({ date: x.date, value: f(x) }))
  const avgOf = (f: (x: (typeof ser)[number]) => number | undefined) => avg(ser.map(f).filter((v): v is number => v != null))
  const hasMeds = r.meds.some((m) => m.active)

  return (
    <div className="screen">
      <header className="page-header row-between">
        <button className="icon-btn" onClick={() => setStart(addDays(start, -7))} aria-label="Vorherige Woche">
          ‹
        </button>
        <div className="center">
          <div className="eyebrow">{isCurrent ? 'Diese Woche' : 'Woche'}</div>
          <h1>
            {formatDayMonth(start)} – {formatDayMonth(end)}
          </h1>
        </div>
        <button
          className="icon-btn"
          onClick={() => setStart(addDays(start, 7))}
          aria-label="Nächste Woche"
          style={{ visibility: isCurrent ? 'hidden' : 'visible' }}
        >
          ›
        </button>
      </header>

      <section className="card wins">
        <h3>Kleine Erfolge 🌱</h3>
        {wins.length ? (
          <ul className="win-list">
            {wins.map((w) => (
              <li key={w.text}>
                <span>{w.icon}</span> {w.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Diese Woche ist noch leer. Jeder kleine Eintrag erscheint hier.</p>
        )}
      </section>

      <section className="card chart-card">
        <div className="chart-head">
          <h3>💛 Stimmung</h3>
          <span className="muted small">Ø {avgOf((x) => x.mood)?.toLocaleString('de-DE', { maximumFractionDigits: 1 }) ?? '–'} / 5</span>
        </div>
        <LineChart data={pt((x) => x.mood)} min={1} max={5} />
      </section>

      <section className="card chart-card">
        <div className="chart-head">
          <h3>👣 Schritte</h3>
          <span className="muted small">Ø {Math.round(avgOf((x) => x.steps) ?? 0).toLocaleString('de-DE')}</span>
        </div>
        <BarChart data={pt((x) => x.steps)} goal={s.goalSteps} color="var(--move)" format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
      </section>

      <section className="card chart-card">
        <div className="chart-head">
          <h3>💧 Trinken</h3>
          <span className="muted small">Ø {((avgOf((x) => x.drinkMl) ?? 0) / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} l</span>
        </div>
        <BarChart data={pt((x) => x.drinkMl)} goal={s.goalDrinkMl} color="var(--water)" format={(v) => (v / 1000).toFixed(1)} />
      </section>

      <section className="card chart-card">
        <div className="chart-head">
          <h3>🌙 Schlaf</h3>
          <span className="muted small">Ø {minutesToHM(avgOf((x) => x.sleepMin))}</span>
        </div>
        <BarChart data={pt((x) => (x.sleepMin != null ? x.sleepMin / 60 : undefined))} color="var(--sleep)" format={(v) => v.toFixed(1)} />
      </section>

      <section className="card chart-card">
        <div className="chart-head">
          <h3>🚶 Aktive Minuten</h3>
          <span className="muted small">gesamt {minutesToHM(ser.reduce((a, x) => a + x.activeMin, 0))}</span>
        </div>
        <BarChart data={pt((x) => x.activeMin)} color="var(--move)" />
      </section>

      {hasMeds && (
        <section className="card chart-card">
          <div className="chart-head">
            <h3>💊 Medikamente</h3>
            <span className="muted small">Ø {Math.round(avgOf((x) => x.medPct) ?? 0)} % genommen</span>
          </div>
          <BarChart data={pt((x) => x.medPct)} max={100} color="var(--meds)" format={(v) => `${Math.round(v)}`} />
        </section>
      )}

      {insights.some((i) => i.joy != null) && (
        <section className="card">
          <h3>Was dir guttut</h3>
          <p className="muted small">Freude und Erfolg deiner Aktivitäten der letzten 4 Wochen</p>
          <ul className="insights">
            {insights
              .filter((i) => i.joy != null || i.achievement != null)
              .map((i) => (
                <li key={i.kind}>
                  <span className="ins-label">{i.label}</span>
                  <span className="ins-bar">
                    <span style={{ width: `${((i.joy ?? 0) / 10) * 100}%` }} />
                  </span>
                  <span className="ins-val">
                    {i.joy != null ? `Freude ${i.joy.toFixed(1)}` : ''}
                    {i.achievement != null ? ` · Erfolg ${i.achievement.toFixed(1)}` : ''}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <button className="btn block" onClick={() => navigate('/bericht')}>
        📄 Bericht für den Arzt erstellen
      </button>
    </div>
  )
}
