import { useEffect, useState } from 'react'
import { db, type Sleep } from '../db'
import { Field, NumScale, Sheet, SheetFooter, Stepper } from '../components/ui'
import { durationBetween, minutesToHM } from '../lib/dates'
import { toast } from '../lib/store'

const QUALITY = ['Sehr schlecht', 'Schlecht', 'Okay', 'Gut', 'Sehr gut']

export function SleepSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const [bed, setBed] = useState('23:00')
  const [wake, setWake] = useState('07:00')
  const [duration, setDuration] = useState<number | undefined>()
  const [latency, setLatency] = useState<number | undefined>()
  const [awakenings, setAwakenings] = useState<number | undefined>()
  const [quality, setQuality] = useState<number | undefined>()
  const [nap, setNap] = useState(0)
  const [existing, setExisting] = useState<Sleep | undefined>()

  useEffect(() => {
    db.sleep.get(date).then((s) => {
      if (!s) return
      setExisting(s)
      if (s.bed) setBed(s.bed)
      if (s.wake) setWake(s.wake)
      setDuration(s.durationMin)
      setLatency(s.latencyMin)
      setAwakenings(s.awakenings)
      setQuality(s.quality)
      setNap(s.napMin ?? 0)
    })
  }, [date])

  const inBed = durationBetween(bed, wake)
  const asleep = duration ?? Math.max(0, inBed - (latency ?? 0))

  const save = async () => {
    const s: Sleep = {
      date,
      bed,
      wake,
      durationMin: asleep,
      latencyMin: latency,
      awakenings,
      quality,
      napMin: nap || undefined,
      source: existing?.source && existing.source !== 'manual' ? existing.source : 'manual',
      updatedAt: Date.now(),
    }
    await db.sleep.put(s)
    toast('Schlaf gespeichert 🌙')
    onClose()
  }

  return (
    <Sheet
      title="Schlaf letzte Nacht"
      onClose={onClose}
      footer={
        <SheetFooter
          onSave={save}
          onDelete={
            existing
              ? async () => {
                  await db.sleep.delete(date)
                  onClose()
                }
              : undefined
          }
        />
      }
    >
      {existing && existing.source !== 'manual' && (
        <p className="muted small">Zeiten automatisch übernommen. Ergänze gern, wie du geschlafen hast.</p>
      )}
      <div className="row2">
        <Field label="Ins Bett">
          <input type="time" value={bed} onChange={(e) => { setBed(e.target.value); setDuration(undefined) }} />
        </Field>
        <Field label="Aufgestanden">
          <input type="time" value={wake} onChange={(e) => { setWake(e.target.value); setDuration(undefined) }} />
        </Field>
      </div>
      <p className="muted small">
        Im Bett: {minutesToHM(inBed)} · geschätzter Schlaf: <b>{minutesToHM(asleep)}</b>
      </p>
      <Field label="Wie gut hast du geschlafen?">
        <div className="chips">
          {QUALITY.map((q, i) => (
            <button type="button" key={q} className={'chip' + (quality === i + 1 ? ' on' : '')} onClick={() => setQuality(i + 1)}>
              {q}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Einschlafdauer" hint="optional">
        <div className="chips">
          {[5, 15, 30, 60, 90, 120].map((m) => (
            <button
              type="button"
              key={m}
              className={'chip' + (latency === m ? ' on' : '')}
              onClick={() => { setLatency(latency === m ? undefined : m); setDuration(undefined) }}
            >
              {m === 120 ? '2 h+' : `${m} min`}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Wie oft aufgewacht?" hint="optional">
        <NumScale min={0} max={6} value={awakenings} onChange={setAwakenings} />
      </Field>
      <Field label="Mittagsschlaf" hint="Minuten, optional">
        <Stepper value={nap} onChange={setNap} step={10} unit="min" max={600} />
      </Field>
    </Sheet>
  )
}
