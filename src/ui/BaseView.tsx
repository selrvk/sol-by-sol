// The outpost, drawn as an SVG scene over the painted terrain. Purely
// presentational: which art is shown, and how it is tinted, is read from
// game state; nothing here changes the game.
//
// Coordinates are pixels of the terrain image (1585 x 992). Each building
// sits on one of the five pads marked on the terrain.

import { FlaskConical, Home, Pickaxe, Shield, Sprout, Sun, TriangleAlert, Wind, Zap, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { EVA_TASKS } from '../sim/advanceSol.ts'
import { BALANCE } from '../sim/balance.ts'
import { lightInfo } from '../sim/forecast.ts'
import type { CrewMember, CrewTask, Decisions, GameState, PowerLoad } from '../sim/types.ts'
import { portraitFor } from './labels.ts'
import type { SolEffects } from './useSolEffects.ts'

const W = 1585
const H = 992
const ART = '/art'
// The slab fills the frame: its left and right corners run off the sides,
// with just enough sky above the back corner for the stars.
const VIEW = { x: 130, y: 60, w: 1330, h: 760 }

// The terrain's top surface, from the three corners of its painted diamond
// (the front corner follows from the other three). A spot on the ground is
// given as (u, v): u runs from the back corner towards the left one, v
// towards the right one, so (0,0) is the back corner and (1,1) the front.
// Placing buildings this way keeps them on the same ground plane the
// terrain is drawn in, which is what makes them look planted rather than
// pasted on.
const GROUND = { north: [781, 51], west: [11, 420], east: [1576, 476] } as const

function groundAt(u: number, v: number) {
  const [nx, ny] = GROUND.north
  const [wx, wy] = GROUND.west
  const [ex, ey] = GROUND.east
  return { x: nx + u * (wx - nx) + v * (ex - nx), y: ny + u * (wy - ny) + v * (ey - ny) }
}

// Where each building stands: the habitat in the middle with the other four
// around it, bare ground between them. Every stone platform keeps at least
// ~80px of clearance from the slab's rocky rim, which is what stops a
// building from looking like it is sliding off the edge at night.
const PADS = {
  solar: { u: 0.22, v: 0.25 },
  habitat: { u: 0.45, v: 0.5 },
  reactor: { u: 0.22, v: 0.78 },
  greenhouse: { u: 0.8, v: 0.24 },
  lab: { u: 0.64, v: 0.83 },
} as const
type PadId = keyof typeof PADS

// One world scale for every building, so their painted sizes stay in
// proportion to each other and to the ground.
const BUILDING_SCALE = 0.62

// Each building image: its natural size, and where the centre of its stone
// platform sits inside that image (measured from the art by
// art/process.py's sibling measurements). The platform centre is what gets
// placed on the ground point.
interface Sprite {
  name: string
  px: [number, number]
  anchor: [number, number]
}
const SPRITES: Record<PadId, Sprite> = {
  habitat: { name: 'habitat', px: [539, 419], anchor: [0.519, 0.57] },
  reactor: { name: 'reactor', px: [393, 423], anchor: [0.496, 0.738] },
  solar: { name: 'solar', px: [510, 314], anchor: [0.558, 0.548] },
  greenhouse: { name: 'greenhouse', px: [557, 345], anchor: [0.48, 0.565] },
  lab: { name: 'lab', px: [471, 361], anchor: [0.486, 0.62] },
}

// Where astronauts are shown for each task: a pad, or the crater field.
const TASK_PLACE: Record<CrewTask, PadId | 'field' | 'o2'> = {
  labScience: 'lab',
  fieldScience: 'field',
  greenhouse: 'greenhouse',
  solar: 'solar',
  shielding: 'habitat',
  maintenance: 'habitat',
  isru: 'o2',
  rest: 'habitat',
}
const FIELD_SPOT = groundAt(0.8, 0.52) // open ground between the greenhouse and the lab

type Status = 'on' | 'off' | 'shed'

function spriteBox(pad: PadId, s: Sprite) {
  const g = groundAt(PADS[pad].u, PADS[pad].v)
  const width = s.px[0] * BUILDING_SCALE
  const height = s.px[1] * BUILDING_SCALE
  return { x: g.x - s.anchor[0] * width, y: g.y - s.anchor[1] * height, width, height }
}

// A building with day and night art stacked and cross-faded, so nightfall
// is a smooth change and the night image is already loaded when needed.
function Building({ pad, sprite, night, status = 'on', flicker = false }: { pad: PadId; sprite: Sprite; night: boolean; status?: Status; flicker?: boolean }) {
  const box = spriteBox(pad, sprite)
  const filter = status === 'off' ? 'grayscale(1) brightness(0.55)' : undefined
  const cls = [status === 'shed' ? 'shed-pulse' : '', flicker ? 'flicker-out' : ''].filter(Boolean).join(' ')
  return (
    <g className={cls || undefined} style={{ filter }}>
      <image href={`${ART}/buildings/${sprite.name}-day.webp`} {...box} style={{ opacity: night ? 0 : 1, transition: 'opacity 1.2s' }} />
      <g className={night ? 'night-breathe' : undefined}>
        <image href={`${ART}/buildings/${sprite.name}-night.webp`} {...box} style={{ opacity: night ? 1 : 0, transition: 'opacity 1.2s' }} />
      </g>
    </g>
  )
}

// Stars for the night sky: fixed positions above the terrain's edge, so they
// only ever sit in the empty sky, never on the ground.
const STARS = (() => {
  const above = (x: number, y: number) => y < (x < 781 ? 420 - 0.4792 * (x - 11) : 51 + 0.5346 * (x - 781)) - 14
  const out: { x: number; y: number; r: number; delay: number }[] = []
  for (let i = 0; i < 90 && out.length < 34; i++) {
    const x = 130 + ((i * 271) % 1330)
    const y = 145 + ((i * 137) % 300)
    if (above(x, y)) out.push({ x, y, r: i % 4 === 0 ? 3 : 2, delay: (i % 7) * 0.45 })
  }
  return out
})()

// A cargo lander touching down: only drawn on the sol it arrives.
function CargoLander({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <g className="lander-descend">
        <ellipse cx={0} cy={46} rx={54} ry={14} fill="#0f172a" opacity={0.45} />
        <path d="M-34 28 L-46 48 M34 28 L46 48 M-16 30 L-22 50 M16 30 L22 50" stroke="#94a3b8" strokeWidth={5} strokeLinecap="round" />
        <rect x={-40} y={-16} width={80} height={46} rx={10} fill="#e2e8f0" stroke="#475569" strokeWidth={4} />
        <rect x={-40} y={-2} width={80} height={8} fill="#f97316" />
        <rect x={-24} y={-30} width={48} height={16} rx={6} fill="#cbd5e1" stroke="#475569" strokeWidth={3} />
        <g className="thruster">
          <path d="M-14 30 L0 62 L14 30 Z" fill="#fbbf24" opacity={0.9} />
          <path d="M-7 30 L0 48 L7 30 Z" fill="#fef3c7" />
        </g>
      </g>
    </g>
  )
}

// A pill-shaped label, like a map marker, centred at (x, y). It holds real
// elements rather than SVG text, so the icons are the same lucide set the
// rest of the UI uses.
function Pill({ x, y, icon: Icon, children, tone = 'normal' }: { x: number; y: number; icon?: LucideIcon; children: ReactNode; tone?: 'normal' | 'warn' | 'bad' }) {
  const border = tone === 'bad' ? 'border-red-400' : tone === 'warn' ? 'border-amber-300' : 'border-sky-300/60'
  const iconTone = tone === 'bad' ? 'text-red-300' : tone === 'warn' ? 'text-amber-300' : 'text-sky-300'
  return (
    <foreignObject x={x - 220} y={y - 28} width={440} height={56} style={{ overflow: 'visible' }}>
      <div className="flex h-full items-center justify-center">
        <div className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl border-2 ${border} bg-slate-900/85 px-4 py-1 text-[24px] font-semibold text-white shadow-lg`}>
          {Icon && <Icon size={22} className={`shrink-0 ${iconTone}`} aria-hidden />}
          {children}
        </div>
      </div>
    </foreignObject>
  )
}

// Who is working here: a row of portraits (initials if the art is missing).
// Anyone outside is wearing their helmet, which is the same cue the crew
// cards use.
function CrewBadges({ x, y, crew, evaIds }: { x: number; y: number; crew: CrewMember[]; evaIds: ReadonlySet<string> }) {
  const r = 22
  const start = x - ((crew.length - 1) * (r * 2 + 6)) / 2
  return (
    <g>
      {crew.map((m, i) => {
        const src = portraitFor(m.id, evaIds.has(m.id))
        return (
          <g key={m.id} transform={`translate(${start + i * (r * 2 + 6)}, ${y})`}>
            <circle r={r} fill="#fde047" stroke="#0f172a" strokeWidth={4} />
            {src ? (
              <image href={src} x={-r} y={-r} width={r * 2} height={r * 2} clipPath="url(#crew-badge-clip)" preserveAspectRatio="xMidYMid slice" />
            ) : (
              <text y={8} textAnchor="middle" className="fill-slate-900 text-[22px] font-bold">
                {m.name[0]}
              </text>
            )}
            <circle r={r} fill="none" stroke="#0f172a" strokeWidth={4} />
          </g>
        )
      })}
    </g>
  )
}

export function BaseView({ game, decisions, effects }: { game: GameState; decisions: Decisions; effects?: SolEffects }) {
  const f = game.facilities
  const env = game.environment
  const isMars = game.scenario.id === 'mars'
  const night = !lightInfo(game.scenario, game.sol).isDaylight
  const storm = env.dustStormSolsLeft > 0
  const sheltering = env.shelterSolsLeft > 0
  const shed = new Set(game.lastReport?.shedLoads ?? [])
  const status = (load: Exclude<PowerLoad, 'lifeSupport'>): Status =>
    !decisions.power[load] ? 'off' : shed.has(load) ? 'shed' : 'on'

  // Where a building's label and its crew stand: the label floats just
  // clear of the building's top, the crew gather at its front door.
  const labelAt = (pad: PadId, s: Sprite) => {
    const b = spriteBox(pad, s)
    return { x: groundAt(PADS[pad].u, PADS[pad].v).x, y: b.y - 6, foot: b.y + b.height + 6 }
  }

  // Who is where. Sheltering crew are all inside the habitat.
  const crewAt = new Map<string, CrewMember[]>()
  const evaIds = new Set<string>()
  for (const m of game.crew) {
    const task = sheltering ? 'rest' : (decisions.assignments[m.id] ?? 'rest')
    if (EVA_TASKS.has(task)) evaIds.add(m.id)
    const place = TASK_PLACE[task]
    crewAt.set(place, [...(crewAt.get(place) ?? []), m])
  }
  const badgesUnder = (place: string, x: number, y: number) =>
    crewAt.has(place) ? <CrewBadges x={x} y={y} crew={crewAt.get(place)!} evaIds={evaIds} /> : null

  const hab = labelAt('habitat', SPRITES.habitat)
  const lab = labelAt('lab', SPRITES.lab)
  const gh = labelAt('greenhouse', SPRITES.greenhouse)
  const sol = labelAt('solar', SPRITES.solar)
  const rea = labelAt('reactor', SPRITES.reactor)
  const worn = f.condition < 0.6
  const o2Pad = groundAt(PADS.reactor.u, PADS.reactor.v) // Mars has no reactor: its O₂ makers use that pad

  return (
    <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="h-auto w-full bg-[#0c1633]" role="img" aria-label={`The ${isMars ? 'Mars' : 'lunar'} outpost`}>
      <defs>
        {/* Round mask for the crew portraits on the map. */}
        <clipPath id="crew-badge-clip">
          <circle r={22} />
        </clipPath>
      </defs>

      {/* Sky first, then the slab. The terrain art is cut out, so the rust
          filter for Mars lands on the ground and nowhere else. */}
      <rect x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} fill="#0c1633" />
      <image
        href={`${ART}/moon-terrain.webp`}
        width={W}
        height={H}
        // Until there is Mars art: the same slab, tinted rust.
        style={isMars ? { filter: 'sepia(1) saturate(2.6) hue-rotate(-20deg) brightness(0.8) contrast(1.05)' } : undefined}
      />

      {/* Night: darken the ground and the panels; buildings light up. */}
      <rect width={W} height={H} fill="#0a1433" style={{ opacity: night ? 0.55 : 0, transition: 'opacity 1.2s', mixBlendMode: 'multiply' }} />
      <g style={{ opacity: night ? 1 : 0, transition: 'opacity 1.6s' }}>
        {STARS.map((s, i) => (
          <circle key={i} className="twinkle" cx={s.x} cy={s.y} r={s.r} fill="#e2e8f0" style={{ animationDelay: `${s.delay}s` }} />
        ))}
      </g>

      {/* Buildings, drawn back to front so a nearer one overlaps a farther
          one if they ever meet. */}
      {f.solarArrayM2 > 0 && (
        <g style={{ filter: storm ? 'brightness(0.7)' : undefined }}>
          <Building pad="solar" sprite={SPRITES.solar} night={night} />
        </g>
      )}
      <Building pad="habitat" sprite={SPRITES.habitat} night={night} />
      {f.reactorKW > 0 && <Building pad="reactor" sprite={SPRITES.reactor} night={night} />}
      {f.greenhouseM2 > 0 && (
        <Building pad="greenhouse" sprite={SPRITES.greenhouse} night={night} status={status('greenhouse')} flicker={effects?.powerCut && status('greenhouse') === 'shed'} />
      )}
      <Building pad="lab" sprite={SPRITES.lab} night={night} status={status('lab')} flicker={effects?.powerCut && status('lab') === 'shed'} />

      {/* O₂ makers (Mars) have no art yet: simple tanks on the free pad. */}
      {game.scenario.isruAvailable && f.isruUnits > 0 && (
        <g className={status('isru') === 'shed' ? 'shed-pulse' : undefined} style={{ filter: status('isru') === 'off' ? 'grayscale(1) brightness(0.55)' : undefined }}>
          {[...Array(Math.min(f.isruUnits, 8))].map((_, i) => {
            const perRow = Math.min(f.isruUnits, 4)
            const x = o2Pad.x - ((perRow - 1) * 80) / 2 + (i % 4) * 80 + 40
            const y = o2Pad.y + 10 + Math.floor(i / 4) * 70
            return (
              <g key={i} transform={`translate(${x}, ${y})`}>
                <ellipse cx={0} cy={52} rx={34} ry={12} fill="#0f172a" opacity={0.45} />
                <rect x={-28} y={-12} width={56} height={64} rx={12} fill="#e2e8f0" stroke="#334155" strokeWidth={4} />
                <ellipse cx={0} cy={-12} rx={28} ry={10} fill="#f8fafc" stroke="#334155" strokeWidth={4} />
                <rect x={-28} y={16} width={56} height={8} fill="#f97316" />
                <circle cx={0} cy={36} r={6} fill={night ? '#fde68a' : '#94a3b8'} />
              </g>
            )
          })}
        </g>
      )}

      {/* A cargo lander comes down on resupply sols. */}
      {effects?.resupply && <CargoLander key={game.sol} x={880} y={700} />}

      {/* A solar flare washes the scene red once, before the alert opens. */}
      {effects?.flare && <rect key={game.sol} className="flare-flash" width={W} height={H} fill="#ef4444" />}

      {/* Weather and emergencies tint the whole scene. */}
      {storm && <rect width={W} height={H} fill="#b45309" opacity={0.3} />}
      {sheltering && <rect width={W} height={H} fill="#dc2626" opacity={0.12} />}

      {/* Labels and crew, drawn last so nothing covers them. */}
      {f.solarArrayM2 > 0 && (
        <Pill x={sol.x} y={sol.y} icon={Sun}>
          Solar {f.solarArrayM2} m²
        </Pill>
      )}
      {badgesUnder('solar', sol.x, sol.foot)}

      {f.greenhouseM2 > 0 && (
        <Pill x={gh.x} y={gh.y} icon={Sprout} tone={status('greenhouse') === 'shed' ? 'bad' : 'normal'}>
          Greenhouse {f.greenhouseM2} m²{status('greenhouse') === 'off' ? ' · off' : status('greenhouse') === 'shed' ? ' · no power' : ''}
        </Pill>
      )}
      {badgesUnder('greenhouse', gh.x, gh.foot)}

      <Pill x={hab.x} y={hab.y} icon={Home} tone={worn ? 'warn' : 'normal'}>
        Habitat
        {f.shieldingLevel > 0 && (
          <span className="flex items-center gap-1 text-slate-300">
            <Shield size={20} aria-hidden /> {f.shieldingLevel}/{BALANCE.MAX_SHIELDING_LEVEL}
          </span>
        )}
        {worn && (
          <span className="flex items-center gap-1 text-amber-300">
            <TriangleAlert size={20} aria-hidden /> {Math.round(f.condition * 100)}%
          </span>
        )}
      </Pill>
      {badgesUnder('habitat', hab.x, hab.foot)}

      {f.reactorKW > 0 && (
        <Pill x={rea.x} y={rea.y} icon={Zap}>
          Reactor {f.reactorKW} kW
        </Pill>
      )}
      {game.scenario.isruAvailable && f.isruUnits > 0 && (
        <Pill x={o2Pad.x + 40} y={o2Pad.y - 60} icon={Wind} tone={status('isru') === 'shed' ? 'bad' : 'normal'}>
          O₂ makers ×{f.isruUnits}{status('isru') === 'off' ? ' · off' : status('isru') === 'shed' ? ' · no power' : ''}
        </Pill>
      )}
      {badgesUnder('o2', o2Pad.x + 40, o2Pad.y - 8)}

      <Pill x={lab.x} y={lab.y} icon={FlaskConical} tone={status('lab') === 'shed' ? 'bad' : 'normal'}>
        Lab{status('lab') === 'off' ? ' · off' : status('lab') === 'shed' ? ' · no power' : ''}
      </Pill>
      {badgesUnder('lab', lab.x, lab.foot)}

      {crewAt.has('field') && (
        <>
          <Pill x={FIELD_SPOT.x} y={FIELD_SPOT.y - 60} icon={Pickaxe}>Field work</Pill>
          {badgesUnder('field', FIELD_SPOT.x, FIELD_SPOT.y)}
        </>
      )}

      <text x={VIEW.x + VIEW.w - 24} y={VIEW.y + VIEW.h - 20} textAnchor="end" className="fill-slate-300 text-[22px]" style={{ paintOrder: 'stroke', stroke: '#0f172a', strokeWidth: 5 }}>
        condition {Math.round(f.condition * 100)}% · shielding {f.shieldingLevel}/{BALANCE.MAX_SHIELDING_LEVEL}
      </text>
    </svg>
  )
}
