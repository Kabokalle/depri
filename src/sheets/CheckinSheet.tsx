import { useEffect, useState } from 'react'
import { db, type Checkin } from '../db'
import { Disclosure, FaceScale, Field, NumScale, Sheet, SheetFooter } from '../components/ui'
import { ENERGY_FACES, ENERGY_LABELS, MOOD_FACES, MOOD_LABELS, SYMPTOMS } from '../lib/labels'
import { combine, defaultTime, timeStr } from '../lib/dates'
import { toast } from '../lib/store'

type Symptoms = Pick<Checkin, 'anxiety' | 'drive' | 'concentration' | 'rumination' | 'appetite'>

export function CheckinSheet({ date, id, onClose }: { date: string; id?: number; onClose: () => void }) {
  const [time, setTime] = useState(defaultTime(date))
  const [mood, setMood] = useState<number | undefined>()
  const [energy, setEnergy] = useState<number | undefined>()
  const [sym, setSym] = useState<Symptoms>({})
  const [note, setNote] = useState('')

  useEffect(() => {
    if (id == null) return
    db.checkins.get(id).then((c) => {
      if (!c) return
      setTime(timeStr(c.ts))
      setMood(c.mood)
      setEnergy(c.energy)
      setSym({ anxiety: c.anxiety, drive: c.drive, concentration: c.concentration, rumination: c.rumination, appetite: c.appetite })
      setNote(c.note ?? '')
    })
  }, [id])

  const save = async () => {
    if (!mood) return
    const c: Checkin = { ts: combine(date, time), date, mood, energy: energy ?? 3, ...sym, note: note.trim() || undefined }
    if (id != null) await db.checkins.update(id, c)
    else await db.checkins.add(c)
    toast(mood <= 2 ? 'Danke, dass du es festhältst. Sei sanft mit dir. 💛' : 'Check-in gespeichert 💛')
    onClose()
  }

  return (
    <Sheet
      title="Wie geht es dir?"
      onClose={onClose}
      footer={
        <SheetFooter
          onSave={save}
          disabled={!mood}
          onDelete={
            id != null
              ? async () => {
                  await db.checkins.delete(id)
                  onClose()
                }
              : undefined
          }
        />
      }
    >
      <Field label="Stimmung">
        <FaceScale faces={MOOD_FACES} labels={MOOD_LABELS} value={mood} onChange={setMood} />
      </Field>
      <Field label="Energie">
        <FaceScale faces={ENERGY_FACES} labels={ENERGY_LABELS} value={energy} onChange={setEnergy} />
      </Field>
      <Disclosure title="Weitere Beschwerden (optional)">
        {SYMPTOMS.map((s) => (
          <Field key={s.key} label={s.label} hint={s.hint}>
            <NumScale min={0} max={4} value={sym[s.key]} onChange={(v) => setSym((prev) => ({ ...prev, [s.key]: v }))} />
          </Field>
        ))}
      </Disclosure>
      <Field label="Notiz" hint="optional">
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Was beschäftigt dich?" />
      </Field>
      <Field label="Uhrzeit">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
    </Sheet>
  )
}
