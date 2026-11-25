import { useEffect, useState } from 'react'
import { db } from '../db'
import { Chips, Field, Sheet, SheetFooter, Toggle } from '../components/ui'
import { todayStr } from '../lib/dates'
import { toast } from '../lib/store'

const KINDS = ['Hausarzt', 'Psychiater', 'Psychotherapie', 'Klinik', 'Sonstiges']

export function AppointmentSheet({ id, onClose }: { id?: number; onClose: () => void }) {
  const [date, setDate] = useState(todayStr())
  const [time, setTime] = useState('')
  const [who, setWho] = useState('')
  const [kind, setKind] = useState<string | undefined>('Psychiater')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (id == null) return
    db.appointments.get(id).then((a) => {
      if (!a) return
      setDate(a.date)
      setTime(a.time ?? '')
      setWho(a.who)
      setKind(a.kind)
      setNote(a.note ?? '')
    })
  }, [id])

  const save = async () => {
    const a = { date, time: time || undefined, who: who.trim(), kind: kind ?? 'Sonstiges', note: note.trim() || undefined }
    if (id != null) await db.appointments.update(id, a)
    else await db.appointments.add(a)
    toast('Termin gespeichert')
    onClose()
  }

  return (
    <Sheet
      title={id != null ? 'Termin bearbeiten' : 'Neuer Termin'}
      onClose={onClose}
      footer={
        <SheetFooter
          onSave={save}
          onDelete={
            id != null
              ? async () => {
                  await db.appointments.delete(id)
                  onClose()
                }
              : undefined
          }
        />
      }
    >
      <div className="row2">
        <Field label="Datum">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Uhrzeit" hint="optional">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <Field label="Art">
        <Chips options={KINDS.map((k) => ({ value: k, label: k }))} value={kind} onChange={setKind} />
      </Field>
      <Field label="Bei wem?" hint="optional">
        <input type="text" value={who} onChange={(e) => setWho(e.target.value)} placeholder="z. B. Dr. Müller" />
      </Field>
      <Field label="Notizen zum Termin" hint="optional">
        <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Was wurde besprochen? Was ist der nächste Schritt?" />
      </Field>
    </Sheet>
  )
}

export function QuestionSheet({ id, onClose }: { id?: number; onClose: () => void }) {
  const [text, setText] = useState('')
  const [done, setDone] = useState(false)
  const [answer, setAnswer] = useState('')

  useEffect(() => {
    if (id == null) return
    db.questions.get(id).then((q) => {
      if (!q) return
      setText(q.text)
      setDone(q.done)
      setAnswer(q.answer ?? '')
    })
  }, [id])

  const save = async () => {
    if (!text.trim()) return
    if (id != null) {
      const q = await db.questions.get(id)
      await db.questions.update(id, {
        text: text.trim(),
        done,
        answer: answer.trim() || undefined,
        doneAt: done ? (q?.doneAt ?? Date.now()) : undefined,
      })
    } else {
      await db.questions.add({ text: text.trim(), done: false, createdAt: Date.now() })
    }
    toast('Frage gespeichert')
    onClose()
  }

  return (
    <Sheet
      title={id != null ? 'Frage bearbeiten' : 'Frage für den nächsten Termin'}
      onClose={onClose}
      footer={
        <SheetFooter
          onSave={save}
          disabled={!text.trim()}
          onDelete={
            id != null
              ? async () => {
                  await db.questions.delete(id)
                  onClose()
                }
              : undefined
          }
        />
      }
    >
      <Field label="Frage oder Thema">
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="z. B. Ist die Müdigkeit eine Nebenwirkung? Kann ich die Dosis abends nehmen?"
          autoFocus={id == null}
        />
      </Field>
      {id != null && (
        <>
          <Toggle checked={done} onChange={setDone} label="Beim Termin besprochen" />
          <Field label="Antwort / Ergebnis" hint="optional">
            <textarea rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} />
          </Field>
        </>
      )}
    </Sheet>
  )
}
