import { useEffect, useRef, useState } from 'react'
import { importFromParams, type ImportResult } from '../platform/health'
import { minutesToHM, relativeDay } from '../lib/dates'
import { navigate } from '../lib/store'

export function ImportFromShortcut({ params }: { params: URLSearchParams }) {
  const [res, setRes] = useState<ImportResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    importFromParams(params)
      .then((r) => {
        setRes(r)
        // Link-Parameter entfernen, damit ein Neuladen nichts doppelt importiert
        window.history.replaceState(null, '', '#/import-ok')
        setTimeout(() => navigate('/heute'), 2500)
      })
      .catch((e) => setErr(String(e)))
  }, [params])

  return (
    <div className="screen center-screen">
      {err && <p>Das hat nicht geklappt: {err}</p>}
      {res && (
        <div className="card import-ok">
          <div className="big-check">✓</div>
          <h2>Übernommen</h2>
          <p className="muted">{relativeDay(res.date)}</p>
          <ul className="plain-list">
            {res.steps != null && <li>👣 {res.steps.toLocaleString('de-DE')} Schritte</li>}
            {res.sleepMin != null && (
              <li>
                🌙 {minutesToHM(res.sleepMin)} Schlaf {res.bed && res.wake ? `(${res.bed} – ${res.wake})` : ''}
              </li>
            )}
            {res.steps == null && res.sleepMin == null && <li>Keine Werte im Link gefunden.</li>}
          </ul>
          <button className="btn primary" onClick={() => navigate('/heute')}>
            Zu Heute
          </button>
        </div>
      )}
    </div>
  )
}
