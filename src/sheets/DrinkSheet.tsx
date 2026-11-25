import { useEffect, useState } from 'react'
import { db, type Drink, type DrinkKind, type Product, type ProductRef } from '../db'
import { ProductSection } from '../components/ProductSection'
import { scaleNutrition, toRef } from '../lib/food'
import { Chips, Field, Sheet, SheetFooter, Stepper, Toggle } from '../components/ui'
import { DRINK_AMOUNTS, DRINK_KINDS } from '../lib/labels'
import { combine, defaultTime, timeStr } from '../lib/dates'
import { toast } from '../lib/store'

export function DrinkSheet({ date, id, onClose }: { date: string; id?: number; onClose: () => void }) {
  const [time, setTime] = useState(defaultTime(date))
  const [kind, setKind] = useState<DrinkKind>('wasser')
  const [ml, setMl] = useState(250)
  const [caffeine, setCaffeine] = useState(false)
  const [product, setProduct] = useState<ProductRef | undefined>()

  useEffect(() => {
    if (id == null) return
    db.drinks.get(id).then((d) => {
      if (!d) return
      setTime(timeStr(d.ts))
      setKind(d.kind)
      setMl(d.ml)
      setCaffeine(d.caffeine)
      setProduct(d.product)
    })
  }, [id])

  const pickKind = (k: DrinkKind) => {
    setKind(k)
    const def = DRINK_KINDS.find((d) => d.value === k)!
    setCaffeine(def.caffeine)
    if (id == null && !product) setMl(def.ml)
  }

  const pick = (p: Product) => {
    setProduct(toRef(p))
    const amount = p.quantity && p.quantity <= 1500 ? p.quantity : (p.serving ?? 250)
    setMl(Math.round(amount))
    if (kind === 'wasser' && (p.per100.sugar ?? 0) > 1) setKind('softdrink')
    if ((p.per100.caffeine ?? 0) > 0 || /cola|mate|energy|kaffee|coffee/i.test(p.name)) setCaffeine(true)
  }

  const save = async () => {
    const d: Drink = {
      ts: combine(date, time),
      date,
      kind,
      ml,
      caffeine,
      product,
      nutrition: product ? scaleNutrition(product.per100, ml) : undefined,
    }
    if (id != null) await db.drinks.put({ ...d, id })
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
      <Field label="Verpacktes Getränk?" hint="optional">
        <ProductSection kind="drink" product={product} amount={ml} onPick={pick} onClear={() => setProduct(undefined)} />
      </Field>
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
