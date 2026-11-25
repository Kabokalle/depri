import { useCallback, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Product, ProductRef } from '../db'
import { lookupBarcode, nutritionRows, recentProducts, scaleNutrition, sugarCubes } from '../lib/food'
import { BarcodeScanner } from './BarcodeScanner'

/**
 * Barcode scannen → Produkt aus Open Food Facts → Nährwerte für die Menge.
 * Die Menge (g bzw. ml) verwaltet das Formular selbst.
 */
export function ProductSection({
  product,
  amount,
  onPick,
  onClear,
  kind,
}: {
  product?: ProductRef
  amount: number
  onPick: (p: Product) => void
  onClear: () => void
  kind: 'food' | 'drink'
}) {
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const recent = useLiveQuery(() => recentProducts(8), [])

  const handleCode = useCallback(
    async (code: string) => {
      setScanning(false)
      setBusy(true)
      setMsg(null)
      const r = await lookupBarcode(code)
      setBusy(false)
      if (r.ok) onPick(r.product)
      else
        setMsg(
          r.reason === 'notfound'
            ? `Produkt ${code} ist noch nicht in der Datenbank. Trag es einfach von Hand ein.`
            : r.reason === 'offline'
              ? 'Keine Internetverbindung – Produkte lassen sich nur online nachschlagen.'
              : 'Das Nachschlagen hat nicht geklappt. Versuch es gleich noch mal.',
        )
    },
    [onPick],
  )

  const unit = product?.unit ?? (kind === 'drink' ? 'ml' : 'g')
  const total = product ? scaleNutrition(product.per100, amount) : undefined
  const rows = total ? nutritionRows(total) : []
  const cubes = sugarCubes(total?.sugar)
  const hasData = product && Object.values(product.per100).some((v) => v != null)

  return (
    <div className="product-section">
      {!product && (
        <>
          <button type="button" className="btn scan-btn" onClick={() => setScanning(true)} disabled={busy}>
            {busy ? 'Suche Produkt …' : '📷 Barcode scannen'}
          </button>
          {recent && recent.filter((p) => (kind === 'drink' ? p.unit === 'ml' : p.unit === 'g')).length > 0 && (
            <div className="chips small">
              {recent
                .filter((p) => (kind === 'drink' ? p.unit === 'ml' : p.unit === 'g'))
                .map((p) => (
                  <button type="button" key={p.code} className="chip" onClick={() => onPick(p)}>
                    {p.name}
                  </button>
                ))}
            </div>
          )}
          {msg && <p className="small muted">{msg}</p>}
        </>
      )}

      {product && (
        <div className="product-card">
          <div className="product-head">
            <div>
              <b>{product.name}</b>
              {product.brand && <span className="small muted block">{product.brand}</span>}
            </div>
            <button type="button" className="icon-btn" onClick={onClear} aria-label="Produkt entfernen">
              ✕
            </button>
          </div>
          {hasData ? (
            <>
              <div className="small muted">
                Für {amount.toLocaleString('de-DE')} {unit}:
              </div>
              <div className="nutri-grid">
                {rows.map((r) => (
                  <div key={r.label} className={'nutri' + (r.label === 'Zucker' || r.label === 'Energie' ? ' strong' : '')}>
                    <span>{r.label}</span>
                    <b>{r.value}</b>
                  </div>
                ))}
              </div>
              {cubes != null && cubes >= 1 && (
                <p className="small sugar-cubes">
                  Das sind etwa <b>{cubes.toLocaleString('de-DE')} Stück Würfelzucker</b>.
                </p>
              )}
              <p className="tiny muted">Angaben von Open Food Facts, ohne Gewähr.</p>
            </>
          ) : (
            <p className="small muted">Für dieses Produkt sind keine Nährwerte hinterlegt.</p>
          )}
        </div>
      )}

      {scanning && <BarcodeScanner onResult={handleCode} onClose={() => setScanning(false)} />}
    </div>
  )
}
