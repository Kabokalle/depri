import { useEffect, useState } from 'react'
import { db, type SubstanceKind } from '../db'
import { Chips, Field, Sheet, SheetFooter, Stepper } from '../components/ui'
import { SUBSTANCE_KINDS } from '../lib/labels'
import { combine, defaultTime, timeStr } from '../lib/dates'
import { toast } from '../lib/store'

export function SubstanceSheet({ date, id, onClose }: { date: string; id?: number; onClose: () => void }) {
  const [time, setTime] = useState(defaultTime(date))
  const [kind, setKind] = useState<SubstanceKind>('alkohol')
  const [amount, setAmount] = useState(1)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (id == null) return
    db.substances.get(id).then((s) => {
      if (!s) return
      setTime(timeStr(s.ts))
      setKind(s.kind)
      setAmount(s.amount)
      setNote(s.note ?? '')
    })
  }, [id])

  const unit = SUBSTANCE_KINDS.find((k) => k.value === kind)!.unit

  const save = async () => {
    const s = { ts: combine(date, time), date, kind, amount, note: note.trim() || undefined }
    if (id != null) await db.substances.update(id, s)
    else await db.substances.add(s)
    toast('Gespeichert')
    onClose()
  }

  return (
    <Sheet
      title="Substanzen"
      onClose={onClose}
      footer={
        <SheetFooter
          onSave={save}
          onDelete={
            id != null
              ? async () => {
                  await db.substances.delete(id)
                  onClose()
                }
              : undefined
          }
        />
      }
    >
      <p className="muted small">Ganz ohne Wertung – nur damit du und dein Arzt Zusammenhänge sehen könnt. Koffein wird automatisch aus den Getränken gezählt.</p>
      <Field label="Was?">
        <Chips options={SUBSTANCE_KINDS} value={kind} onChange={(v) => v && setKind(v)} />
      </Field>
      <Field label="Menge">
        <Stepper value={amount} onChange={setAmount} step={1} min={1} unit={unit} max={100} />
      </Field>
      <Field label="Uhrzeit">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
      <Field label="Notiz" hint="optional">
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Sheet>
  )
}
