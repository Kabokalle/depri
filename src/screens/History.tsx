import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, formatLong, minutesToHM, relativeDay, todayStr } from '../lib/dates'
import { loadRange, series } from '../lib/stats'
import { MOOD_FACES } from '../lib/labels'
import { navigate } from '../lib/store'

const PAGE = 14

export function History() {
  const [pages, setPages] = useState(1)
  const to = todayStr()
  const from = addDays(to, -(PAGE * pages - 1))
  const data = useLiveQuery(async () => series(await loadRange(from, to)).reverse(), [from, to])
  return (
    <div className="screen">
      <header className="page-header">
        <h1>Verlauf</h1>
        <p className="muted">Tippe auf einen Tag, um Einträge anzusehen, nachzutragen oder zu ändern.</p>
      </header>
      <ul className="day-list">
        {data?.map((d) => {
          const empty = !d.steps && !d.activeMin && !d.drinkMl && !d.meals && d.mood == null && !d.sleepMin
          return (
            <li key={d.date}>
              <button className="day-row" onClick={() => navigate(d.date === todayStr() ? '/heute' : `/tag?d=${d.date}`)}>
                <div className="day-row-head">
                  <span className="day-row-title">{relativeDay(d.date) === formatLong(d.date) ? formatLong(d.date) : `${relativeDay(d.date)} · ${formatLong(d.date)}`}</span>
                  <span className="day-row-mood">{d.mood != null ? MOOD_FACES[Math.round(d.mood) - 1] : ''}</span>
                </div>
                {empty ? (
                  <div className="muted small">Keine Einträge – auch das ist okay.</div>
                ) : (
                  <div className="day-row-stats">
                    {d.steps != null && <span>👣 {d.steps.toLocaleString('de-DE')}</span>}
                    {d.activeMin > 0 && <span>🚶 {minutesToHM(d.activeMin)}</span>}
                    {d.drinkMl != null && <span>💧 {(d.drinkMl / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} l</span>}
                    {d.meals > 0 && <span>🍽️ {d.meals}</span>}
                    {d.sleepMin != null && <span>🌙 {minutesToHM(d.sleepMin)}</span>}
                    {d.medPct != null && <span>💊 {Math.round(d.medPct)} %</span>}
                  </div>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <button className="btn ghost block" onClick={() => setPages(pages + 1)}>
        Ältere Tage anzeigen
      </button>
    </div>
  )
}
