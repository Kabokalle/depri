import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { formatShort, todayStr } from '../lib/dates'
import { PHQ_BANDS, PHQ_DIFFICULTY, PHQ_DIFFICULTY_Q, PHQ_INTRO, PHQ_ITEMS, PHQ_OPTIONS, phqSeverity } from '../lib/phq9'
import { navigate, openSheet } from '../lib/store'
import { LineChart } from '../components/Charts'
import { CrisisContent } from '../components/CrisisHelp'

export function Phq9Screen() {
  const history = useLiveQuery(() => db.phq9.orderBy('ts').toArray(), [])
  const [answers, setAnswers] = useState<(number | undefined)[]>(Array(9).fill(undefined))
  const [difficulty, setDifficulty] = useState<number | undefined>()
  const [result, setResult] = useState<number | null>(null)
  const [started, setStarted] = useState(false)

  const complete = answers.every((a) => a != null)
  const score = answers.reduce<number>((a, x) => a + (x ?? 0), 0)
  const item9 = answers[8] ?? 0

  const set = (i: number, v: number) => {
    setAnswers((prev) => {
      const next = [...prev]
      next[i] = v
      return next
    })
    if (i === 8 && v > 0) openSheet({ kind: 'crisis', date: todayStr() })
  }

  const save = async () => {
    if (!complete) return
    await db.phq9.add({ ts: Date.now(), date: todayStr(), answers: answers as number[], score, difficulty })
    setResult(score)
    window.scrollTo(0, 0)
  }

  if (result != null) {
    const sev = phqSeverity(result)
    return (
      <div className="screen">
        <header className="page-header">
          <h1>Danke fürs Ausfüllen</h1>
        </header>
        <div className="card phq-result">
          <div className="phq-score">{result}</div>
          <div className="muted">von 27 Punkten</div>
          <p>
            Das entspricht einer <b>{sev.label}en</b> Ausprägung depressiver Beschwerden in den letzten 2 Wochen.
          </p>
          <p className="small muted">
            Der Fragebogen ist eine Orientierung, keine Diagnose. Am aussagekräftigsten ist der Verlauf über mehrere Wochen –
            besprich ihn gern mit deinem Arzt oder deiner Therapeutin.
          </p>
        </div>
        {item9 > 0 && (
          <div className="card crisis-card">
            <h3>Du hast angegeben, dass du an Tod oder Selbstverletzung gedacht hast.</h3>
            <p>Das ist wichtig. Bitte sprich mit jemandem darüber – möglichst heute.</p>
            <CrisisContent intro={false} />
          </div>
        )}
        <button className="btn primary block" onClick={() => navigate('/arzt')}>
          Fertig
        </button>
      </div>
    )
  }

  if (!started) {
    const last = history?.[history.length - 1]
    return (
      <div className="screen">
        <header className="page-header">
          <h1>Fragebogen PHQ-9</h1>
          <p className="muted">
            Der Standard-Fragebogen, den auch Ärzte nutzen. 9 Fragen über die <b>letzten 2 Wochen</b>, etwa 2 Minuten.
          </p>
        </header>
        {history && history.length > 0 && (
          <div className="card chart-card">
            <div className="chart-head">
              <h3>Dein Verlauf</h3>
              {last && (
                <span className="muted small">
                  zuletzt {formatShort(last.date)}: {last.score} ({phqSeverity(last.score).label})
                </span>
              )}
            </div>
            <LineChart
              data={history.slice(-12).map((h) => ({ date: h.date, value: h.score }))}
              min={0}
              max={27}
              bands={PHQ_BANDS}
              labelMode="date"
              format={(v) => String(v)}
            />
            <ul className="plain-list small">
              {[...history].reverse().slice(0, 6).map((h) => (
                <li key={h.id} className="row-between">
                  <span>{formatShort(h.date)}</span>
                  <span>
                    {h.score} · {phqSeverity(h.score).label}
                    <button
                      className="link small"
                      onClick={async () => {
                        if (confirm('Diesen Fragebogen löschen?')) await db.phq9.delete(h.id!)
                      }}
                    >
                      {' '}
                      löschen
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button className="btn primary block" onClick={() => setStarted(true)}>
          Fragebogen starten
        </button>
      </div>
    )
  }

  return (
    <div className="screen">
      <header className="page-header">
        <h1>PHQ-9</h1>
        <p>{PHQ_INTRO}</p>
      </header>
      {PHQ_ITEMS.map((q, i) => (
        <div className={'card phq-q' + (answers[i] != null ? ' answered' : '')} key={i}>
          <div className="phq-num">{i + 1}/9</div>
          <p className="phq-text">{q}</p>
          <div className="phq-opts">
            {PHQ_OPTIONS.map((o, v) => (
              <button type="button" key={o} className={'opt' + (answers[i] === v ? ' on' : '')} onClick={() => set(i, v)}>
                {o}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="card phq-q">
        <p className="phq-text">{PHQ_DIFFICULTY_Q}</p>
        <div className="phq-opts">
          {PHQ_DIFFICULTY.map((o, v) => (
            <button type="button" key={o} className={'opt' + (difficulty === v ? ' on' : '')} onClick={() => setDifficulty(v)}>
              {o}
            </button>
          ))}
        </div>
      </div>
      <button className="btn primary block" disabled={!complete} onClick={save}>
        {complete ? 'Auswerten' : `Noch ${answers.filter((a) => a == null).length} Fragen offen`}
      </button>
    </div>
  )
}
