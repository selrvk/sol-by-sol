// Small multiples: one line chart per resource over the mission so far.
// Different units never share an axis; each chart has one series, so no
// legend is needed (the title names it). Nights and dust storms are shaded
// so the power sawtooth has its cause right behind it.

import { Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { GameState } from '../sim/types.ts'
import type { HistoryPoint } from './gameReducer.ts'

const LINE = '#38bdf8' // sky-400: one hue for every chart, high contrast on the dark panel
const INK_MUTED = '#94a3b8'
const GRID = '#334155'

type Key = 'power' | 'oxygen' | 'water' | 'food' | 'dose' | 'science'

interface ChartSpec {
  key: Key
  title: string
  unit: string
  refLine?: { y: number; label: string }
}

export function TrendCharts({ game, history }: { game: GameState; history: HistoryPoint[] }) {
  const limit = game.crew[0]?.careerDoseLimitMSv ?? 600
  const charts: ChartSpec[] = [
    { key: 'power', title: 'Battery', unit: 'kWh' },
    { key: 'oxygen', title: 'Oxygen', unit: 'kg' },
    { key: 'water', title: 'Water', unit: 'L' },
    { key: 'food', title: 'Food', unit: 'kg' },
    { key: 'dose', title: 'Highest crew dose', unit: 'mSv', refLine: { y: limit, label: 'limit' } },
    { key: 'science', title: 'Science', unit: 'pts', refLine: { y: game.scenario.scienceTarget, label: 'target' } },
  ]

  // Contiguous runs of night or storm sols, drawn as shaded bands.
  const bands: { x1: number; x2: number; kind: 'night' | 'storm' }[] = []
  for (const p of history) {
    const kind = p.night ? 'night' : p.storm ? 'storm' : null
    if (!kind) continue
    const last = bands.at(-1)
    if (last && last.kind === kind && last.x2 === p.sol - 1) last.x2 = p.sol
    else bands.push({ x1: p.sol - 1, x2: p.sol, kind })
  }

  if (history.length < 2) {
    return <p className="text-sm text-slate-500">Trends appear after the first sol.</p>
  }

  const domain: [number, number] = [history[0].sol, Math.max(history[0].sol + 10, history.at(-1)!.sol)]
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {charts.map((spec) => (
          <figure key={spec.key} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
            <figcaption className="flex justify-between text-[11px] text-slate-400">
              <span>{spec.title}</span>
              <span className="tabular-nums text-slate-200">
                {history.at(-1)![spec.key]} {spec.unit}
              </span>
            </figcaption>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 6, right: 6, bottom: 0, left: -12 }}>
                  {bands.map((b, i) => (
                    <ReferenceArea
                      key={i}
                      x1={b.x1}
                      x2={b.x2}
                      fill={b.kind === 'night' ? '#1e293b' : '#7c2d12'}
                      fillOpacity={b.kind === 'night' ? 0.9 : 0.35}
                      ifOverflow="hidden"
                    />
                  ))}
                  <XAxis dataKey="sol" type="number" domain={domain} tick={{ fontSize: 9, fill: INK_MUTED }} tickLine={false} axisLine={{ stroke: GRID }} tickCount={4} allowDecimals={false} />
                  <YAxis tick={{ fontSize: 9, fill: INK_MUTED }} tickLine={false} axisLine={false} width={40} domain={[0, 'auto']} tickCount={3} allowDecimals={false} />
                  {spec.refLine && (
                    <ReferenceLine
                      y={spec.refLine.y}
                      stroke={INK_MUTED}
                      strokeDasharray="3 3"
                      ifOverflow="extendDomain"
                      label={{ value: spec.refLine.label, position: 'insideBottomRight', fontSize: 9, fill: INK_MUTED }}
                    />
                  )}
                  <Tooltip
                    cursor={{ stroke: INK_MUTED, strokeWidth: 1 }}
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: INK_MUTED }}
                    itemStyle={{ color: '#e2e8f0' }}
                    labelFormatter={(sol) => `Sol ${sol}`}
                    formatter={(v) => [`${v} ${spec.unit}`, spec.title]}
                  />
                  <Line type="monotone" dataKey={spec.key} stroke={LINE} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </figure>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        {game.scenario.dayNightCycle ? 'Dark bands are lunar nights.' : 'Rust bands are dust storms.'} Hover a chart to see each sol.
      </p>
      {/* The same data as a table, for screen readers. The wrapper does the
          hiding: tables ignore the 1px width of sr-only and would overflow. */}
      <div className="sr-only">
      <table>
        <caption>Resources by sol</caption>
        <thead>
          <tr>
            <th>Sol</th>
            {charts.map((c) => (
              <th key={c.key}>
                {c.title} ({c.unit})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.map((p) => (
            <tr key={p.sol}>
              <td>{p.sol}</td>
              {charts.map((c) => (
                <td key={c.key}>{p[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
