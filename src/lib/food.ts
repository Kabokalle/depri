import { db, type Nutrition, type Product, type ProductRef } from '../db'

/**
 * Produktdaten von Open Food Facts (freie, offene Lebensmitteldatenbank).
 * Gesendet wird nur der Barcode – keine persönlichen Daten.
 */
const API = 'https://world.openfoodfacts.org/api/v2/product/'
const FIELDS = [
  'product_name',
  'product_name_de',
  'generic_name_de',
  'brands',
  'nutriments',
  'quantity',
  'product_quantity',
  'product_quantity_unit',
  'serving_quantity',
  'image_front_small_url',
].join(',')

type OffNutriments = Record<string, number | string | undefined>

function n(v: unknown): number | undefined {
  const x = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
  return Number.isFinite(x) ? x : undefined
}

function per100From(nm: OffNutriments): Nutrition {
  const kj = n(nm['energy-kj_100g']) ?? n(nm['energy_100g'])
  return {
    kcal: n(nm['energy-kcal_100g']) ?? (kj != null ? kj / 4.184 : undefined),
    sugar: n(nm['sugars_100g']),
    carbs: n(nm['carbohydrates_100g']),
    fat: n(nm['fat_100g']),
    satFat: n(nm['saturated-fat_100g']),
    protein: n(nm['proteins_100g']),
    salt: n(nm['salt_100g']),
    fiber: n(nm['fiber_100g']),
    // Koffein wird in g/100 g angegeben → in mg umrechnen
    caffeine: n(nm['caffeine_100g']) != null ? n(nm['caffeine_100g'])! * 1000 : undefined,
  }
}

export function isValidBarcode(code: string): boolean {
  return /^\d{8}$|^\d{12,14}$/.test(code)
}

export type LookupResult = { ok: true; product: Product; cached: boolean } | { ok: false; reason: 'notfound' | 'offline' | 'error' }

export async function lookupBarcode(code: string): Promise<LookupResult> {
  code = code.replace(/\D/g, '')
  const cached = await db.products.get(code)
  try {
    const res = await fetch(`${API}${code}.json?fields=${FIELDS}`, { headers: { Accept: 'application/json' } })
    if (res.status === 404) return cached ? { ok: true, product: cached, cached: true } : { ok: false, reason: 'notfound' }
    if (!res.ok) throw new Error(String(res.status))
    const j = await res.json()
    if (j.status !== 1 || !j.product) return cached ? { ok: true, product: cached, cached: true } : { ok: false, reason: 'notfound' }
    const p = j.product
    const unitRaw = String(p.product_quantity_unit ?? p.quantity ?? '').toLowerCase()
    const unit: 'g' | 'ml' = /ml|cl|\bl\b|liter|litre/.test(unitRaw) ? 'ml' : 'g'
    const product: Product = {
      code,
      name: String(p.product_name_de || p.product_name || p.generic_name_de || 'Unbekanntes Produkt').trim(),
      brand: p.brands ? String(p.brands).split(',')[0].trim() : undefined,
      per100: per100From(p.nutriments ?? {}),
      unit,
      quantity: n(p.product_quantity),
      serving: n(p.serving_quantity),
      image: p.image_front_small_url,
      lastUsed: Date.now(),
    }
    await db.products.put(product)
    return { ok: true, product, cached: false }
  } catch {
    if (cached) return { ok: true, product: cached, cached: true }
    return { ok: false, reason: navigator.onLine ? 'error' : 'offline' }
  }
}

export async function recentProducts(limit = 8): Promise<Product[]> {
  return db.products.orderBy('lastUsed').reverse().limit(limit).toArray()
}

export function toRef(p: Product): ProductRef {
  return { code: p.code, name: p.name, brand: p.brand, per100: p.per100, unit: p.unit }
}

/** Nährwerte für eine Menge (g oder ml) berechnen */
export function scaleNutrition(per100: Nutrition, amount: number): Nutrition {
  const out: Nutrition = {}
  for (const [k, v] of Object.entries(per100) as [keyof Nutrition, number | undefined][]) {
    if (v != null) out[k] = (v * amount) / 100
  }
  return out
}

export function sumNutrition(list: (Nutrition | undefined)[]): Nutrition & { count: number } {
  const out: Nutrition & { count: number } = { count: 0 }
  for (const x of list) {
    if (!x) continue
    out.count++
    for (const [k, v] of Object.entries(x) as [keyof Nutrition, number | undefined][]) {
      if (v != null) out[k] = (out[k] ?? 0) + v
    }
  }
  return out
}

/** Ein Stück Würfelzucker ≈ 3 g */
export const SUGAR_CUBE_G = 3

const fmt = (v: number, d = 1) => v.toLocaleString('de-DE', { maximumFractionDigits: v >= 100 ? 0 : d })

export function nutritionRows(x: Nutrition): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  if (x.kcal != null) rows.push({ label: 'Energie', value: `${Math.round(x.kcal).toLocaleString('de-DE')} kcal` })
  if (x.sugar != null) rows.push({ label: 'Zucker', value: `${fmt(x.sugar)} g` })
  if (x.carbs != null) rows.push({ label: 'Kohlenhydrate', value: `${fmt(x.carbs)} g` })
  if (x.fat != null) rows.push({ label: 'Fett', value: `${fmt(x.fat)} g` })
  if (x.satFat != null) rows.push({ label: 'davon gesättigt', value: `${fmt(x.satFat)} g` })
  if (x.protein != null) rows.push({ label: 'Eiweiß', value: `${fmt(x.protein)} g` })
  if (x.fiber != null) rows.push({ label: 'Ballaststoffe', value: `${fmt(x.fiber)} g` })
  if (x.salt != null) rows.push({ label: 'Salz', value: `${fmt(x.salt, 2)} g` })
  if (x.caffeine != null && x.caffeine > 0) rows.push({ label: 'Koffein', value: `${Math.round(x.caffeine)} mg` })
  return rows
}

/** Kurze Zeile wie „245 kcal · 12 g Zucker“ */
export function nutritionShort(x: Nutrition | undefined): string {
  if (!x) return ''
  return [x.kcal != null ? `${Math.round(x.kcal).toLocaleString('de-DE')} kcal` : '', x.sugar != null ? `${fmt(x.sugar)} g Zucker` : '']
    .filter(Boolean)
    .join(' · ')
}

export function sugarCubes(sugarG: number | undefined): number | undefined {
  if (sugarG == null) return undefined
  return Math.round((sugarG / SUGAR_CUBE_G) * 2) / 2
}
