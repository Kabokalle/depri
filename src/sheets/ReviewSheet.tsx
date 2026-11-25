import { useEffect, useState } from 'react'
import { db, type Social } from '../db'
import { Chips, Field, MultiChips, Sheet, SheetFooter, Stepper } from '../components/ui'
import { DAY_TAGS, SOCIAL } from '../lib/labels'
import { toast } from '../lib/store'

export function ReviewSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const [outside, setOutside] = useState(0)
  const [social, setSocial] = useState<Social | undefined>()
  const [socialWith, setSocialWith] = useState('')
  const [events, setEvents] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [weight, setWeight] = useState('')
  const [exists, setExists] = useState(false)

  useEffect(() => {
    db.dayReviews.get(date).then((r) => {
      if (!r) return
      setExists(true)
      setOutside(r.outsideMin ?? 0)
      setSocial(r.social)
      setSocialWith(r.socialWith ?? '')
      setEvents(r.events ?? '')
      setTags(r.tags ?? [])
      setWeight(r.weightKg ? String(r.weightKg) : '')
    })
  }, [date])

  const save = async () => {
    await db.dayReviews.put({
      date,
      outsideMin: outside || undefined,
      social,
      socialWith: socialWith.trim() || undefined,
      events: events.trim() || undefined,
      tags,
      weightKg: weight ? Number(weight.replace(',', '.')) : undefined,
      updatedAt: Date.now(),
    })
    toast('Tagesrückblick gespeichert ✨')
    onClose()
  }

  return (
    <Sheet
      title="Tagesrückblick"
      onClose={onClose}
      footer={
        <SheetFooter
          onSave={save}
          onDelete={
            exists
              ? async () => {
                  await db.dayReviews.delete(date)
                  onClose()
                }
              : undefined
          }
        />
      }
    >
      <Field label="Zeit draußen bei Tageslicht">
        <div className="chips">
          {[0, 10, 30, 60, 120].map((m) => (
            <button type="button" key={m} className={'chip' + (outside === m ? ' on' : '')} onClick={() => setOutside(m)}>
              {m === 0 ? 'Gar nicht' : m >= 60 ? `${m / 60} h` : `${m} min`}
            </button>
          ))}
        </div>
        <Stepper value={outside} onChange={setOutside} step={10} unit="min" max={1440} />
      </Field>
      <Field label="Kontakt mit anderen Menschen">
        <Chips options={SOCIAL} value={social} onChange={setSocial} allowEmpty />
        {social && social !== 'keine' && (
          <input type="text" value={socialWith} onChange={(e) => setSocialWith(e.target.value)} placeholder="Mit wem? (optional, z. B. Freundin, Familie)" />
        )}
      </Field>
      <Field label="Was war heute besonders?" hint="optional">
        <MultiChips options={DAY_TAGS} value={tags} onChange={setTags} />
        <textarea rows={3} value={events} onChange={(e) => setEvents(e.target.value)} placeholder="Ereignisse, Auslöser, schöne Momente …" />
      </Field>
      <Field label="Gewicht" hint="kg, optional">
        <input type="text" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="–" />
      </Field>
    </Sheet>
  )
}
