import { useEffect, useRef, type ReactNode } from 'react'

export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <div className="field-label">
        {label}
        {hint && <span className="field-hint">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  allowEmpty,
  wrap = true,
}: {
  options: { value: T; label: string; icon?: string }[]
  value: T | undefined
  onChange: (v: T | undefined) => void
  allowEmpty?: boolean
  wrap?: boolean
}) {
  return (
    <div className={wrap ? 'chips' : 'chips nowrap'}>
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          className={'chip' + (o.value === value ? ' on' : '')}
          onClick={() => onChange(o.value === value && allowEmpty ? undefined : o.value)}
        >
          {o.icon && <span className="chip-icon">{o.icon}</span>}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function MultiChips({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o)
        return (
          <button
            type="button"
            key={o}
            className={'chip' + (on ? ' on' : '')}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

/** Emoji-Skala 1–5 */
export function FaceScale({
  faces,
  labels,
  value,
  onChange,
}: {
  faces: string[]
  labels: string[]
  value: number | undefined
  onChange: (v: number) => void
}) {
  return (
    <div className="faces">
      {faces.map((f, i) => (
        <button
          type="button"
          key={i}
          className={'face' + (value === i + 1 ? ' on' : '')}
          onClick={() => onChange(i + 1)}
          aria-label={labels[i]}
        >
          <span className="face-emoji">{f}</span>
          <span className="face-label">{labels[i]}</span>
        </button>
      ))}
    </div>
  )
}

/** Zahlenskala min..max als Knöpfe */
export function NumScale({
  min,
  max,
  value,
  onChange,
  allowEmpty = true,
}: {
  min: number
  max: number
  value: number | undefined
  onChange: (v: number | undefined) => void
  allowEmpty?: boolean
}) {
  const nums = []
  for (let i = min; i <= max; i++) nums.push(i)
  return (
    <div className="numscale">
      {nums.map((n) => (
        <button
          type="button"
          key={n}
          className={'num' + (value === n ? ' on' : '')}
          onClick={() => onChange(value === n && allowEmpty ? undefined : n)}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 100000,
  unit,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
}) {
  return (
    <div className="stepper">
      <button type="button" className="step-btn" onClick={() => onChange(Math.max(min, value - step))} aria-label="weniger">
        −
      </button>
      <div className="step-val">
        <input
          type="number"
          inputMode="numeric"
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
        />
        {unit && <span className="step-unit">{unit}</span>}
      </div>
      <button type="button" className="step-btn" onClick={() => onChange(Math.min(max, value + step))} aria-label="mehr">
        +
      </button>
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
    </label>
  )
}

export function Disclosure({ title, children, defaultOpen }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="disclosure" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="disclosure-body">{children}</div>
    </details>
  )
}

export function SheetFooter({
  onSave,
  onDelete,
  saveLabel = 'Speichern',
  disabled,
}: {
  onSave: () => void
  onDelete?: () => void
  saveLabel?: string
  disabled?: boolean
}) {
  return (
    <>
      {onDelete && (
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            if (confirm('Diesen Eintrag löschen?')) onDelete()
          }}
        >
          Löschen
        </button>
      )}
      <button type="button" className="btn primary grow" onClick={onSave} disabled={disabled}>
        {saveLabel}
      </button>
    </>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}
