import { useEffect, useState } from 'react'
import { db, type DrinkKind } from '../db'
import { Chips, Field, Sheet, SheetFooter, Stepper, Toggle } from '../components/ui'
import { DRINK_AMOUNTS, DRINK_KINDS } from '../lib/labels'
import { combine, defaultTime, timeStr } from '../lib/dates'
import { toast } from '../lib/store'

export function DrinkSheet({ date, id, onClose }: { date: string; id?: number; onClose: () => void }) {
  const [time, setTime] = useState(defaultTime(date))
  const [kind, setKind] = useState<DrinkKind>('wasser')
  const [ml, setMl] = useState(250)
  const [caffeine, setCaffeine] = useState(false)

  useEffect(() => {
    if (id == null) return
    db.drinks.get(id).then((d) => {
      if (!d) return
      setTime(timeStr(d.ts))
      setKind(d.kind)
      setMl(d.ml)
      setCaffeine(d.caffeine)
    })
  }, [id])

  const pickKind = (k: DrinkKind) => {
    setKind(k)
    const def = DRINK_KINDS.find((d) => d.value === k)!
    setCaffeine(def.caffeine)
    if (id == null) setMl(def.ml)
  }

  const save = async () => {
    const d = { ts: combine(date, time), date, kind, ml, caffeine }
    if (id != null) await db.drinks.update(id, d)
    else await db.drinks.add(d)
    toast('Getränk gespeichert 💧')
    onClose()
  }

  return (
    <Sheet
      title={id != null ? 'Getränk bearbeiten' : 'Getränk'}
      onClose={onClose}
      footer={
        <SheetFooter
          onSave={save}
          onDelete={
            id != null
              ? async () => {
                  await db.drinks.delete(id)
                  onClose()
                }
              : undefined
          }
        />
      }
    >
      <Field label="Was?">
        <Chips options={DRINK_KINDS} value={kind} onChange={(v) => v && pickKind(v)} />
      </Field>
      <Field label="Menge">
        <div className="chips">
          {DRINK_AMOUNTS.map((a) => (
            <button type="button" key={a} className={'chip' + (ml === a ? ' on' : '')} onClick={() => setMl(a)}>
              {a} ml
            </button>
          ))}
        </div>
        <Stepper value={ml} onChange={setMl} step={50} unit="ml" max={5000} />
      </Field>
      <Toggle checked={caffeine} onChange={setCaffeine} label="Mit Koffein" />
      <Field label="Uhrzeit">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
    </Sheet>
  )
}
