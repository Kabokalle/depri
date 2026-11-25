import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Medication } from '../db'
import { Chips, Field, Sheet, SheetFooter, Toggle } from '../components/ui'
import { SEVERITY, SIDE_EFFECTS } from '../lib/labels'
import { combine, defaultTime, timeStr, todayStr } from '../lib/dates'
import { toast } from '../lib/store'
import { syncReminders } from '../platform/reminders'

export function MedicationSheet({ id, onClose }: { id?: number; onClose: () => void }) {
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [times, setTimes] = useState<string[]>(['08:00'])
  const [remind, setRemind] = useState(true)
  const [active, setActive] = useState(true)
  const [changeNote, setChangeNote] = useState('')
  const [existing, setExisting] = useState<Medication | undefined>()

  useEffect(() => {
    if (id == null) return
    db.medications.get(id).then((m) => {
      if (!m) return
      setExisting(m)
      setName(m.name)
      setDose(m.dose)
      setTimes(m.times)
      setRemind(m.remind)
      setActive(m.active)
    })
  }, [id])

  const doseChanged = existing && existing.dose !== dose.trim()

  const save = async () => {
    if (!name.trim()) return
    const today = todayStr()
    const history = existing?.history ? [...existing.history] : []
    if (!existing) history.push({ date: today, dose: dose.trim(), note: 'Beginn' })
    else if (doseChanged) history.push({ date: today, dose: dose.trim(), note: changeNote.trim() || undefined })
    if (existing && existing.active && !active) history.push({ date: today, dose: dose.trim(), note: 'Abgesetzt' })
    if (existing && !existing.active && active) history.push({ date: today, dose: dose.trim(), note: 'Wieder begonnen' })
    const med: Medication = {
      name: name.trim(),
      dose: dose.trim(),
      times: [...new Set(times.filter(Boolean))].sort(),
      remind,
      active,
      createdAt: existing?.createdAt ?? Date.now(),
      history,
    }
    if (id != null) await db.medications.put({ ...med, id })
    else await db.medications.add(med)
    await syncReminders()
    toast('Medikament gespeichert')
    onClose()
  }

  return (
    <Sheet
      title={id != null ? 'Medikament bearbeiten' : 'Neues Medikament'}
      onClose={onClose}
      footer={
        <SheetFooter
          onSave={save}
          disabled={!name.trim()}
          onDelete={
            id != null
              ? async () => {
                  await db.medications.delete(id)
                  await db.medIntakes.where('medId').equals(id).delete()
                  await syncReminders()
                  onClose()
                }
              : undefined
          }
        />
      }
    >
      <Field label="Name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Sertralin" />
      </Field>
      <Field label="Dosis">
        <input type="text" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="z. B. 50 mg" />
      </Field>
      {doseChanged && (
        <Field label="Grund der Änderung" hint="optional">
          <input type="text" value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="z. B. auf ärztlichen Rat erhöht" />
        </Field>
      )}
      <Field label="Einnahmezeiten">
        {times.map((t, i) => (
          <div className="row-inline" key={i}>
            <input type="time" value={t} onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))} />
            {times.length > 1 && (
              <button type="button" className="icon-btn" onClick={() => setTimes(times.filter((_, j) => j !== i))} aria-label="Zeit entfernen">
                ✕
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn small ghost" onClick={() => setTimes([...times, '20:00'])}>
          + weitere Uhrzeit
        </button>
      </Field>
      <Toggle checked={remind} onChange={setRemind} label="Daran erinnern" />
      <Toggle checked={active} onChange={setActive} label="Nehme ich aktuell" />
      {existing && existing.history.length > 0 && (
        <Field label="Verlauf">
          <ul className="plain-list small">
            {existing.history.map((h, i) => (
              <li key={i}>
                {h.date.split('-').reverse().join('.')} – {h.dose || '–'} {h.note ? `(${h.note})` : ''}
              </li>
            ))}
          </ul>
        </Field>
      )}
    </Sheet>
  )
}

export function SideEffectSheet({ date, id, onClose }: { date: string; id?: number; onClose: () => void }) {
  const meds = useLiveQuery(() => db.medications.filter((m) => m.active).toArray(), [])
  const [time, setTime] = useState(defaultTime(date))
  const [kind, setKind] = useState<string | undefined>()
  const [other, setOther] = useState('')
  const [severity, setSeverity] = useState<number>(1)
  const [medId, setMedId] = useState<number | undefined>()
  const [note, setNote] = useState('')

  useEffect(() => {
    if (id == null) return
    db.sideEffects.get(id).then((s) => {
      if (!s) return
      setTime(timeStr(s.ts))
      if (SIDE_EFFECTS.includes(s.kind)) setKind(s.kind)
      else {
        setKind('Sonstiges')
        setOther(s.kind)
      }
      setSeverity(s.severity)
      setMedId(s.medId)
      setNote(s.note ?? '')
    })
  }, [id])

  const save = async () => {
    if (!kind) return
    const s = {
      ts: combine(date, time),
      date,
      kind: kind === 'Sonstiges' && other.trim() ? other.trim() : kind,
      severity,
      medId,
      note: note.trim() || undefined,
    }
    if (id != null) await db.sideEffects.update(id, s)
    else await db.sideEffects.add(s)
    toast('Nebenwirkung notiert')
    onClose()
  }

  return (
    <Sheet
      title="Nebenwirkung"
      onClose={onClose}
      footer={
        <SheetFooter
          onSave={save}
          disabled={!kind}
          onDelete={
            id != null
              ? async () => {
                  await db.sideEffects.delete(id)
                  onClose()
                }
              : undefined
          }
        />
      }
    >
      <Field label="Was merkst du?">
        <Chips options={SIDE_EFFECTS.map((s) => ({ value: s, label: s }))} value={kind} onChange={setKind} />
        {kind === 'Sonstiges' && <input type="text" value={other} onChange={(e) => setOther(e.target.value)} placeholder="Beschreibung" />}
      </Field>
      <Field label="Wie stark?">
        <Chips options={SEVERITY} value={severity} onChange={(v) => v && setSeverity(v)} />
      </Field>
      {meds && meds.length > 0 && (
        <Field label="Vermutlich durch" hint="optional">
          <Chips
            options={meds.map((m) => ({ value: m.id!, label: m.name }))}
            value={medId}
            onChange={setMedId}
            allowEmpty
          />
        </Field>
      )}
      <Field label="Uhrzeit">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
      <Field label="Notiz" hint="optional">
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Sheet>
  )
}
