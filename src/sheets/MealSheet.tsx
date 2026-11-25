import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Meal, type MealSize, type MealType, type Product, type ProductRef } from '../db'
import { ProductSection } from '../components/ProductSection'
import { scaleNutrition, toRef } from '../lib/food'
import { Chips, Field, Sheet, SheetFooter } from '../components/ui'
import { MEAL_SIZES, MEAL_TYPES, guessMealType } from '../lib/labels'
import { combine, defaultTime, timeStr } from '../lib/dates'
import { toast } from '../lib/store'

export function MealSheet({ date, id, onClose }: { date: string; id?: number; onClose: () => void }) {
  const [time, setTime] = useState(defaultTime(date))
  const [type, setType] = useState<MealType>(guessMealType(new Date(combine(date, defaultTime(date)))))
  const [what, setWhat] = useState('')
  const [size, setSize] = useState<MealSize>('normal')
  const [grams, setGrams] = useState('')
  const [note, setNote] = useState('')
  const [product, setProduct] = useState<ProductRef | undefined>()

  useEffect(() => {
    if (id == null) return
    db.meals.get(id).then((m) => {
      if (!m) return
      setTime(timeStr(m.ts))
      setType(m.type)
      setWhat(m.what)
      setSize(m.size)
      setGrams(m.grams ? String(m.grams) : '')
      setNote(m.note ?? '')
      setProduct(m.product)
    })
  }, [id])

  const suggestions = useLiveQuery(async () => {
    const last = await db.meals.orderBy('ts').reverse().limit(300).toArray()
    const count = new Map<string, number>()
    for (const m of last) if (m.what) count.set(m.what, (count.get(m.what) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map((e) => e[0])
  }, [])

  const pick = (p: Product) => {
    setProduct(toRef(p))
    setWhat(p.brand && !p.name.includes(p.brand) ? `${p.name} (${p.brand})` : p.name)
    const g = p.serving ?? (p.quantity && p.quantity <= 150 ? p.quantity : 100)
    setGrams(String(Math.round(g)))
  }
  const amount = Number(grams) || 100

  const save = async () => {
    const meal: Meal = {
      ts: combine(date, time),
      date,
      type,
      what: what.trim(),
      size,
      grams: grams ? Number(grams) : undefined,
      note: note.trim() || undefined,
      product,
      nutrition: product ? scaleNutrition(product.per100, amount) : undefined,
    }
    if (product && !grams) meal.grams = amount
    if (id != null) await db.meals.put({ ...meal, id })
    else await db.meals.add(meal)
    toast('Mahlzeit gespeichert 🍽️')
    onClose()
  }

  return (
    <Sheet
      title={id != null ? 'Mahlzeit bearbeiten' : 'Mahlzeit'}
      onClose={onClose}
      footer={
        <SheetFooter
          onSave={save}
          onDelete={
            id != null
              ? async () => {
                  await db.meals.delete(id)
                  onClose()
                }
              : undefined
          }
        />
      }
    >
      <Field label="Uhrzeit">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
      <Field label="Art">
        <Chips options={MEAL_TYPES} value={type} onChange={(v) => v && setType(v)} />
      </Field>
      <Field label="Verpacktes Produkt?" hint="optional">
        <ProductSection kind="food" product={product} amount={amount} onPick={pick} onClear={() => setProduct(undefined)} />
      </Field>
      <Field label="Was gab es?" hint="optional">
        <input
          type="text"
          value={what}
          placeholder="z. B. Brot mit Käse"
          onChange={(e) => setWhat(e.target.value)}
          list="meal-suggestions"
          enterKeyHint="done"
        />
        {suggestions && suggestions.length > 0 && !what && (
          <div className="chips small">
            {suggestions.map((s) => (
              <button type="button" key={s} className="chip" onClick={() => setWhat(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </Field>
      <Field label="Menge">
        <Chips options={MEAL_SIZES} value={size} onChange={(v) => v && setSize(v)} />
      </Field>
      <Field label="Gramm" hint={product ? 'für die Nährwerte' : 'optional'}>
        <input type="number" inputMode="numeric" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="–" />
      </Field>
      <Field label="Notiz" hint="optional">
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. kaum Appetit, mit Freunden gegessen …" />
      </Field>
    </Sheet>
  )
}
