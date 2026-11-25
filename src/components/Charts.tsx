import { weekdayShort, formatDayMonth } from '../lib/dates'

export interface Point {
  date: string
  value?: number
}

/** Schlichtes Balkendiagramm in SVG */
export function BarChart({
  data,
  max,
  goal,
  format = (v) => String(Math.round(v)),
  color = 'var(--accent)',
  labelMode = 'weekday',
  height = 120,
}: {
  data: Point[]
  max?: number
  goal?: number
  format?: (v: number) => string
  color?: string
  labelMode?: 'weekday' | 'date' | 'none'
  height?: number
}) {
  const vals = data.map((d) => d.value ?? 0)
  const top = max ?? Math.max(goal ?? 0, ...vals, 1)
  const W = 320
  const H = height
  const pad = 18
  const bw = (W / data.length) * 0.62
  const step = W / data.length
  const y = (v: number) => H - pad - (v / top) * (H - pad - 14)
  const showLabels = labelMode !== 'none' && data.length <= 14
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
      {goal != null && goal > 0 && (
        <line x1={0} x2={W} y1={y(goal)} y2={y(goal)} className="chart-goal" />
      )}
      {data.map((d, i) => {
        const v = d.value
        const x = i * step + (step - bw) / 2
        return (
          <g key={d.date}>
            {v != null && v > 0 ? (
              <>
                <rect x={x} y={y(v)} width={bw} height={Math.max(2, H - pad - y(v))} rx={Math.min(6, bw / 3)} fill={color} />
                {data.length <= 7 && (
                  <text x={x + bw / 2} y={y(v) - 4} className="chart-val" textAnchor="middle">
                    {format(v)}
                  </text>
                )}
              </>
            ) : (
              <rect x={x} y={H - pad - 2} width={bw} height={2} rx={1} className="chart-empty" />
            )}
            {showLabels && (
              <text x={x + bw / 2} y={H - 4} className="chart-label" textAnchor="middle">
                {labelMode === 'weekday' ? weekdayShort(d.date) : formatDayMonth(d.date)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** Linie mit Punkten (z. B. Stimmung 1–5, PHQ-9 0–27) */
export function LineChart({
  data,
  min = 0,
  max,
  color = 'var(--mood)',
  height = 120,
  labelMode = 'weekday',
  bands,
  format = (v) => v.toLocaleString('de-DE', { maximumFractionDigits: 1 }),
}: {
  data: Point[]
  min?: number
  max: number
  color?: string
  height?: number
  labelMode?: 'weekday' | 'date' | 'none'
  bands?: { from: number; to: number; className: string }[]
  format?: (v: number) => string
}) {
  const W = 320
  const H = height
  const pad = 18
  const step = data.length > 1 ? (W - 24) / (data.length - 1) : 0
  const x = (i: number) => 12 + i * step
  const y = (v: number) => H - pad - ((v - min) / (max - min)) * (H - pad - 14)
  const pts = data.map((d, i) => (d.value != null ? { x: x(i), y: y(d.value), v: d.value } : null))
  const segs: string[] = []
  let cur = ''
  for (const p of pts) {
    if (p) cur += `${cur ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)} `
    else if (cur) {
      segs.push(cur)
      cur = ''
    }
  }
  if (cur) segs.push(cur)
  const showLabels = labelMode !== 'none'
  const labelEvery = Math.ceil(data.length / 8)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
      {bands?.map((b) => (
        <rect key={b.from} x={0} width={W} y={y(Math.min(b.to, max))} height={y(b.from) - y(Math.min(b.to, max))} className={b.className} />
      ))}
      {segs.map((s, i) => (
        <path key={i} d={s} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {pts.map(
        (p, i) =>
          p && (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={4} fill={color} />
              {data.length <= 10 && (
                <text x={p.x} y={p.y - 8} className="chart-val" textAnchor="middle">
                  {format(p.v)}
                </text>
              )}
            </g>
          ),
      )}
      {showLabels &&
        data.map(
          (d, i) =>
            i % labelEvery === 0 && (
              <text key={d.date} x={x(i)} y={H - 4} className="chart-label" textAnchor="middle">
                {labelMode === 'weekday' ? weekdayShort(d.date) : formatDayMonth(d.date)}
              </text>
            ),
        )}
    </svg>
  )
}
