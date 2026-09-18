// Isometric SVG view of the outpost. Purely presentational: sizes and
// colours are read from game state, nothing here changes the game.

import type { ReactNode } from 'react'
import { BALANCE } from '../sim/balance.ts'
import type { CrewTask, Decisions, GameState, PowerLoad } from '../sim/types.ts'

const TW = 44 // tile width
const TH = 22 // tile height
const OX = 275 // screen origin
const OY = 100

function iso(x: number, y: number, z = 0): [number, number] {
  return [OX + ((x - y) * TW) / 2, OY + ((x + y) * TH) / 2 - z]
}
const pts = (p: [number, number][]) => p.map(([a, b]) => `${a},${b}`).join(' ')

type Status = 'on' | 'off' | 'shed'
const COLORS: Record<Status | 'neutral', { top: string; left: string; right: string }> = {
  on: { top: '#5eead4', left: '#0f766e', right: '#115e59' },
  off: { top: '#94a3b8', left: '#475569', right: '#334155' },
  shed: { top: '#fca5a5', left: '#b91c1c', right: '#7f1d1d' },
  neutral: { top: '#e2e8f0', left: '#94a3b8', right: '#64748b' },
}

function Box({ x, y, w, d, h, c, opacity = 1, label }: {
  x: number; y: number; w: number; d: number; h: number
  c: { top: string; left: string; right: string }; opacity?: number; label?: string
}) {
  const top = [iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)]
  const left = [iso(x, y + d, h), iso(x + w, y + d, h), iso(x + w, y + d, 0), iso(x, y + d, 0)]
  const right = [iso(x + w, y, h), iso(x + w, y + d, h), iso(x + w, y + d, 0), iso(x + w, y, 0)]
  const [lx, ly] = iso(x + w / 2, y + d / 2, h)
  return (
    <g opacity={opacity}>
      <polygon points={pts(left)} fill={c.left} />
      <polygon points={pts(right)} fill={c.right} />
      <polygon points={pts(top)} fill={c.top} stroke="rgba(0,0,0,0.25)" strokeWidth={0.5} />
      {label && (
        <text x={lx} y={ly - 6} textAnchor="middle" className="fill-white text-[10px] font-semibold" style={{ paintOrder: 'stroke', stroke: '#0f172a', strokeWidth: 3 }}>
          {label}
        </text>
      )}
    </g>
  )
}

// Where each task happens, so astronauts can be drawn at their work.
const TASK_SPOTS: Record<CrewTask, [number, number]> = {
  labScience: [8.2, 4.6],
  fieldScience: [9.8, 9.2],
  greenhouse: [4.6, 8.4],
  solar: [2.6, 0.2],
  shielding: [3.4, 6.4],
  maintenance: [5.2, 3.2],
  isru: [9.2, 7.2],
  rest: [5, 5],
}

export function BaseView({ game, decisions }: { game: GameState; decisions: Decisions }) {
  const f = game.facilities
  const env = game.environment
  const isMars = game.scenario.id === 'mars'
  const shed = new Set(game.lastReport?.shedLoads ?? [])
  const status = (load: Exclude<PowerLoad, 'lifeSupport'>): Status =>
    !decisions.power[load] ? 'off' : shed.has(load) ? 'shed' : 'on'

  const sky = env.dustStormSolsLeft > 0 ? ['#7c2d12', '#431407'] : env.isDaylight ? (isMars ? ['#c2410c', '#1e1b4b'] : ['#1e293b', '#020617']) : ['#020617', '#000000']
  const ground = isMars ? ['#9a3412', '#7c2d12'] : ['#64748b', '#475569']
  const sunlit = env.isDaylight && env.dustStormSolsLeft === 0

  // Solar panels: one drawn panel per 20 m², laid out in rows.
  const panelCount = Math.min(45, Math.round(f.solarArrayM2 / 20))
  const panels: ReactNode[] = []
  for (let i = 0; i < panelCount; i++) {
    const col = i % 5
    const row = Math.floor(i / 5)
    panels.push(
      <Box key={i} x={-1.5 + col * 0.8} y={-2 + row * 0.55} w={0.7} d={0.4} h={4}
        c={sunlit ? { top: '#60a5fa', left: '#1e3a8a', right: '#1e40af' } : { top: '#334155', left: '#1e293b', right: '#0f172a' }}
        opacity={0.4 + 0.6 * f.condition} />,
    )
  }

  const ghW = f.greenhouseM2 > 0 ? 1 + Math.min(f.greenhouseM2, 40) / 10 : 0
  const berm = Math.min(f.shieldingLevel, BALANCE.MAX_SHIELDING_LEVEL) / BALANCE.MAX_SHIELDING_LEVEL

  // Group crew by task spot so they don't overlap.
  const bySpot = new Map<CrewTask, string[]>()
  for (const m of game.crew) {
    const t = env.shelterSolsLeft > 0 ? 'rest' : (decisions.assignments[m.id] ?? 'rest')
    bySpot.set(t, [...(bySpot.get(t) ?? []), m.name[0]])
  }

  return (
    <svg viewBox="0 0 660 360" className="h-auto w-full" role="img" aria-label="Isometric view of the outpost">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky[1]} />
          <stop offset="1" stopColor={sky[0]} />
        </linearGradient>
      </defs>
      <rect width="660" height="360" fill="url(#sky)" />
      {!env.isDaylight && [...Array(30)].map((_, i) => (
        <circle key={i} cx={(i * 97) % 660} cy={(i * 53) % 140} r={i % 3 === 0 ? 1.2 : 0.7} fill="white" opacity={0.7} />
      ))}
      {/* ground */}
      <polygon points={pts([iso(-2.5, -3), iso(11.5, -3), iso(11.5, 10), iso(-2.5, 10)])} fill={ground[0]} stroke={ground[1]} />

      {panels}

      {/* power source */}
      {f.reactorKW > 0 && <Box x={9} y={0.5} w={1} d={1} h={22} c={{ top: '#fdba74', left: '#c2410c', right: '#9a3412' }} label={`Reactor ${f.reactorKW} kW`} />}

      {/* habitat + regolith shielding */}
      <Box x={4} y={4} w={2.4} d={2.4} h={34} c={COLORS.neutral} label="Habitat" />
      {berm > 0 && (
        <Box x={3.7} y={3.7} w={3} d={3} h={6 + berm * 26} c={{ top: '#a8a29e', left: '#78716c', right: '#57534e' }} opacity={0.92} />
      )}

      {/* lab */}
      <Box x={7.4} y={3.6} w={1.6} d={1.6} h={22} c={COLORS[status('lab')]} label="Lab" />

      {/* greenhouse */}
      {ghW > 0 ? (
        <Box x={4} y={7.4} w={ghW} d={1.4} h={12} c={status('greenhouse') === 'on' ? { top: '#86efac', left: '#15803d', right: '#166534' } : COLORS[status('greenhouse')]} label={`Greenhouse ${f.greenhouseM2} m²`} />
      ) : (
        <polygon points={pts([iso(4, 7.4), iso(5.5, 7.4), iso(5.5, 8.8), iso(4, 8.8)])} fill="none" stroke="#86efac" strokeDasharray="4 3" opacity={0.6} />
      )}

      {/* ISRU oxygen makers */}
      {[...Array(Math.min(f.isruUnits, 8))].map((_, i) => (
        <Box key={i} x={8.3 + (i % 4) * 0.8} y={6.4 + Math.floor(i / 4) * 0.8} w={0.6} d={0.6} h={10} c={COLORS[status('isru')]} />
      ))}
      {f.isruUnits > 0 && (() => {
        const [x, y] = iso(9.5, 6.6, 26)
        return <text x={x} y={y} textAnchor="middle" className="fill-white text-[10px] font-semibold" style={{ paintOrder: 'stroke', stroke: '#0f172a', strokeWidth: 3 }}>O₂ makers ×{f.isruUnits}</text>
      })()}

      {/* crew */}
      {[...bySpot].map(([task, initials]) => {
        const [sx, sy] = TASK_SPOTS[task]
        return initials.map((init, i) => {
          const [x, y] = iso(sx + i * 0.5, sy, 8)
          return (
            <g key={task + init}>
              <circle cx={x} cy={y} r={8} fill="#fde047" stroke="#0f172a" strokeWidth={1.5} />
              <text x={x} y={y + 3.5} textAnchor="middle" className="fill-slate-900 text-[10px] font-bold">{init}</text>
            </g>
          )
        })
      })}

      {/* condition warning */}
      {f.condition < 0.6 && (
        <text x={12} y={350} className="fill-amber-300 text-[13px] font-semibold">⚠ Base condition {Math.round(f.condition * 100)}%: needs maintenance</text>
      )}
      <text x={648} y={350} textAnchor="end" className="fill-slate-300 text-[11px]">
        condition {Math.round(f.condition * 100)}% · shielding {f.shieldingLevel}/{BALANCE.MAX_SHIELDING_LEVEL}
      </text>
    </svg>
  )
}
