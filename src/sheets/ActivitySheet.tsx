import { useEffect, useState } from 'react'
import { db, type Activity, type ActivityKind } from '../db'
import { Chips, Field, NumScale, Sheet, SheetFooter, Stepper } from '../components/ui'
import { ACTIVITY_KINDS } from '../lib/labels'
import { combine, defaultTime, timeStr } from '../lib/dates'
import { toast } from '../lib/store'

export function ActivitySheet({ date, id, onClose }: { date: string; id?: number; onClose: () => void }) {
  const [time, setTime] = useState(defaultTime(date))
  const [kind, setKind] = useState<ActivityKind>('spaziergang')
  const [minutes, setMinutes] = useState(20)
  const [joy, setJoy] = useState<number | undefined>()
  const [achievement, setAchievement] = useState<number | undefined>()
  const [note, setNote] = useState('')
  const [existing, setExisting] = useState<Activity | undefined>()

  useEffect(() => {
    if (id == null) return
    db.activities.get(id).then((a) => {
      if (!a) return
      setExisting(a)
      setTime(timeStr(a.ts))
      setKind(a.kind)
      setMinutes(a.minutes)
      setJoy(a.joy)
      setAchievement(a.achievement)
      setNote(a.note ?? '')
    })
  }, [id])

  const save = async () => {
    const a: Activity = {
      ts: combine(date, time),
      date,
      kind,
      minutes,
      joy,
      achievement,
      note: note.trim() || undefined,
      source: existing?.source ?? 'manual',
      healthId: existing?.healthId,
    }
    if (id != null) await db.activities.update(id, a)
    else await db.activities.add(a)
    toast('Aktivität gespeichert – schön! 🌿')
    onClose()
  }

  return (
    <Sheet
      title={id != null ? 'Aktivität bearbeiten' : 'Aktivität'}
      onClose={onClose}
      footer={
        <SheetFooter
          onSave={save}
          onDelete={
            id != null
              ? async () => {
                  await db.activities.delete(id)
                  onClose()
                }
              : undefined
          }
        />
      }
    >
      <Field label="Was hast du gemacht?">
        <Chips options={ACTIVITY_KINDS} value={kind} onChange={(v) => v && setKind(v)} />
      </Field>
      <Field label="Dauer">
        <div className="chips">
          {[5, 10, 15, 30, 45, 60].map((m) => (
            <button type="button" key={m} className={'chip' + (minutes === m ? ' on' : '')} onClick={() => setMinutes(m)}>
              {m} min
            </button>
          ))}
        </div>
        <Stepper value={minutes} onChange={setMinutes} step={5} unit="min" max={1440} />
      </Field>
      <Field label="Freude" hint="0 = keine, 10 = sehr viel · optional">
        <NumScale min={0} max={10} value={joy} onChange={setJoy} />
      </Field>
      <Field label="Erfolg / Geschafft-Gefühl" hint="0 = keins, 10 = sehr stark · optional">
        <NumScale min={0} max={10} value={achievement} onChange={setAchievement} />
      </Field>
      <Field label="Uhrzeit">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
      <Field label="Notiz" hint="optional">
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Sheet>
  )
}

export function StepsSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const [steps, setSteps] = useState(0)
  useEffect(() => {
    db.dailySteps.get(date).then((s) => s && setSteps(s.steps))
  }, [date])
  const save = async () => {
    await db.dailySteps.put({ date, steps, source: 'manual', updatedAt: Date.now() })
    toast('Schritte gespeichert 👣')
    onClose()
  }
  return (
    <Sheet title="Schritte" onClose={onClose} footer={<SheetFooter onSave={save} />}>
      <p className="muted small">
        Deine Schritte siehst du z. B. in der Health-App (iPhone), in Google Fit oder Samsung Health (Android). Am iPhone
        kann sie auch der Kurzbefehl übernehmen.
      </p>
      <Field label="Schritte heute">
        <Stepper value={steps} onChange={setSteps} step={500} max={100000} />
      </Field>
    </Sheet>
  )
}
