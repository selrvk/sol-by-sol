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
import type { CrewMember, CrewTask, Decisions, GameState, PowerLoad, ScenarioId } from '../sim/types.ts'
import { portraitFor } from './labels.ts'
import type { SolEffects } from './useSolEffects.ts'

const W = 1585
const H = 992
const ART = '/art'
// The slab fills the frame: its left and right corners run off the sides,
// with just enough sky above the back corner for the stars.
const VIEW = { x: 130, y: 60, w: 1330, h: 760 }

// Each world's terrain art, and the three corners of its painted diamond
// (the front corner follows from the other three). A spot on the ground is
// given as (u, v): u runs from the back corner towards the left one, v
// towards the right one, so (0,0) is the back corner and (1,1) the front.
// Placing buildings this way keeps them on the same ground plane the
// terrain is drawn in, which is what makes them look planted rather than
// pasted on.
//
// The two slabs are not the same shape -- Mars sits lower and is a little
// smaller -- so the corners are measured per world rather than shared. The
// (u, v) positions below are the same for both, which is what lets one
// layout serve both worlds.
interface Terrain {
  art: string
  north: readonly [number, number]
  west: readonly [number, number]
  east: readonly [number, number]
}

const TERRAIN: Record<ScenarioId, Terrain> = {
  moon: { art: 'moon-terrain.webp', north: [781, 51], west: [11, 420], east: [1576, 476] },
  mars: { art: 'mars-terrain.webp', north: [788, 102], west: [37, 438], east: [1552, 463] },
}

function groundAt(t: Terrain, u: number, v: number) {
  const [nx, ny] = t.north
  const [wx, wy] = t.west
  const [ex, ey] = t.east
  return { x: nx + u * (wx - nx) + v * (ex - nx), y: ny + u * (wy - ny) + v * (ey - ny) }
}

// Where each building stands: the habitat in the middle with the other four
// around it, bare ground between them. Every stone platform keeps at least
// ~80px of clearance from the slab's rocky rim on both worlds, which is
// what stops a building from looking like it is sliding off the edge at
// night. The clearance is measured against Mars, the smaller slab, and the
// crew standing at a building's door count as part of its footprint.
const PADS = {
  solar: { u: 0.22, v: 0.25 },
  habitat: { u: 0.45, v: 0.5 },
  reactor: { u: 0.22, v: 0.78 },
  greenhouse: { u: 0.74, v: 0.26 },
  lab: { u: 0.64, v: 0.79 },
} as const
type PadId = keyof typeof PADS

// One world scale for every building, so their painted sizes stay in
// proportion to each other and to the ground.
const BUILDING_SCALE = 0.62

// Radius of a crew portrait on the map, shared by the badge and its mask.
const BADGE_R = 26

// Buildings that light the ground at night, and the switch that decides
// whether they are lit at all. The habitat and the reactor are never
// switched off; the solar field has its own lamps.
const LIT_PADS: { pad: PadId; load?: Exclude<PowerLoad, 'lifeSupport'> }[] = [
  { pad: 'habitat' },
  { pad: 'reactor' },
  { pad: 'solar' },
  { pad: 'greenhouse', load: 'greenhouse' },
  { pad: 'lab', load: 'lab' },
]

// Each building image: its natural size, and where the centre of its stone
// platform sits inside that image (measured from the art by
// art/process.py's sibling measurements). The platform centre is what gets
// placed on the ground point.
interface Sprite {
  name: string
  px: [number, number]
  anchor: [number, number]
  single?: boolean // one image, no separate night art
}
const SPRITES: Record<PadId | 'isru', Sprite> = {
  habitat: { name: 'habitat', px: [539, 419], anchor: [0.519, 0.57] },
  reactor: { name: 'reactor', px: [393, 423], anchor: [0.496, 0.738] },
  solar: { name: 'solar', px: [510, 314], anchor: [0.558, 0.548] },
  greenhouse: { name: 'greenhouse', px: [557, 345], anchor: [0.48, 0.565] },
  lab: { name: 'lab', px: [471, 361], anchor: [0.486, 0.62] },
  // The O₂ plant stands on the reactor's pad, which Mars leaves empty. It
  // ships as one image because Mars has no night to light up for.
  isru: { name: 'co2maker', px: [515, 339], anchor: [0.538, 0.519], single: true },
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
const FIELD_UV = { u: 0.8, v: 0.52 } // open ground between the greenhouse and the lab

type Status = 'on' | 'off' | 'shed'

function spriteBox(t: Terrain, pad: PadId, s: Sprite) {
  const g = groundAt(t, PADS[pad].u, PADS[pad].v)
  const width = s.px[0] * BUILDING_SCALE
  const height = s.px[1] * BUILDING_SCALE
  return { x: g.x - s.anchor[0] * width, y: g.y - s.anchor[1] * height, width, height }
}

const art = (s: Sprite, when: 'day' | 'night') => `${ART}/buildings/${s.name}${s.single ? '' : `-${when}`}.webp`

// A building with day and night art stacked and cross-faded, so nightfall
// is a smooth change and the night image is already loaded when needed.
function Building({ terrain, pad, sprite, night, status = 'on', flicker = false }: { terrain: Terrain; pad: PadId; sprite: Sprite; night: boolean; status?: Status; flicker?: boolean }) {
  const box = spriteBox(terrain, pad, sprite)
  const filter = status === 'off' ? 'grayscale(1) brightness(0.55)' : undefined
  const cls = [status === 'shed' ? 'shed-pulse' : '', flicker ? 'flicker-out' : ''].filter(Boolean).join(' ')
  return (
    <g className={cls || undefined} style={{ filter }}>
      <image href={art(sprite, 'day')} {...box} style={{ opacity: night ? 0 : 1, transition: 'opacity 1.2s' }} />
      <g className={night ? 'night-breathe' : undefined}>
        <image href={art(sprite, 'night')} {...box} style={{ opacity: night ? 1 : 0, transition: 'opacity 1.2s' }} />
      </g>
    </g>
  )
}

interface Star {
  x: number
  y: number
  r: number
  delay: number
}

// Stars for the night sky: fixed positions above the terrain's own skyline,
// so they only ever sit in the empty sky, never on the ground. The skyline
// is the slab's two back edges, which differ per world, so the field is
// worked out once per terrain and kept.
const starFields = new Map<string, Star[]>()

function starsFor(t: Terrain): Star[] {
  const cached = starFields.get(t.art)
  if (cached) return cached
  const [nx, ny] = t.north
  const [wx, wy] = t.west
  const [ex, ey] = t.east
  const leftSlope = (wy - ny) / (wx - nx)
  const rightSlope = (ey - ny) / (ex - nx)
  const above = (x: number, y: number) => y < ny + (x < nx ? leftSlope * (x - nx) : rightSlope * (x - nx)) - 14
  const out: Star[] = []
  for (let i = 0; i < 90 && out.length < 34; i++) {
    const x = 130 + ((i * 271) % 1330)
    const y = 145 + ((i * 137) % 300)
    if (above(x, y)) out.push({ x, y, r: i % 4 === 0 ? 3 : 2, delay: (i % 7) * 0.45 })
  }
  starFields.set(t.art, out)
  return out
}

// Sunlight travelling across the solar array, while it is actually making
// power: it stops at night and under a dust storm, which is the point.
// Masked by the array's own artwork, so the light falls on the panels and
// not on the ground beside them.
function PanelGlint({ box }: { box: { x: number; y: number; width: number; height: number } }) {
  const band = box.width * 0.2
  const lean = box.height * 0.5 // the scene's 2:1 isometric
  return (
    <g mask="url(#solar-mask)">
      <g className="panel-glint" style={{ ['--glint-travel' as string]: `${box.width * 0.9}px` }}>
        <polygon
          points={`${box.x + lean},${box.y} ${box.x + lean + band},${box.y} ${box.x + band},${box.y + box.height} ${box.x},${box.y + box.height}`}
          fill="#e0f2fe"
          opacity={0.42}
        />
      </g>
    </g>
  )
}

// Dust blowing across during a Martian storm. Fixed offsets, so it does not
// reshuffle on every render.
const DUST = [...Array(22)].map((_, i) => ({
  y: 70 + ((i * 173) % 800),
  r: 6 + (i % 3) * 4,
  delay: (i % 11) * 0.85,
  time: 6.5 + (i % 5) * 1.6,
  peak: 0.22 + (i % 4) * 0.11,
}))

function DustDrift() {
  return (
    <g aria-hidden>
      {DUST.map((d, i) => (
        <ellipse
          key={i}
          className="dust-drift"
          cx={0}
          cy={d.y}
          rx={d.r * 3.2}
          ry={d.r}
          fill="#e7b489"
          style={{
            animationDelay: `${d.delay}s`,
            ['--dust-time' as string]: `${d.time}s`,
            ['--dust-peak' as string]: d.peak,
          }}
        />
      ))}
    </g>
  )
}

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
//
// The map is drawn in its own coordinates and scaled to fit, so a label
// that reads well on a desktop is about 6px tall on a phone. Labels are
// therefore much larger below `lg`, and the routine ones (`quiet`) are
// hidden there and shown as readable text under the map instead. What is
// left on a phone is the labels that report a problem.
function Pill({
  x,
  y,
  icon: Icon,
  children,
  tone = 'normal',
  quiet = false,
}: {
  x: number
  y: number
  icon?: LucideIcon
  children: ReactNode
  tone?: 'normal' | 'warn' | 'bad'
  quiet?: boolean
}) {
  const border = tone === 'bad' ? 'border-red-400' : tone === 'warn' ? 'border-amber-300' : 'border-sky-300/60'
  const iconTone = tone === 'bad' ? 'text-red-300' : tone === 'warn' ? 'text-amber-300' : 'text-sky-300'
  return (
    <foreignObject x={x - 220} y={y - 28} width={440} height={56} className={quiet ? 'hidden lg:block' : undefined} style={{ overflow: 'visible' }}>
      <div className="flex h-full items-center justify-center">
        <div className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl border-2 ${border} bg-slate-900/85 px-4 py-1 text-[44px] font-semibold text-white shadow-lg lg:text-[24px]`}>
          {Icon && <Icon className={`h-[40px] w-[40px] shrink-0 lg:h-[22px] lg:w-[22px] ${iconTone}`} aria-hidden />}
          {children}
        </div>
      </div>
    </foreignObject>
  )
}

// A steady per-astronaut offset, so four people standing together are not
// a chorus line.
const bobDelay = (id: string) => ((id.charCodeAt(0) * 7) % 11) * 0.25

// Who is working here: a row of portraits (initials if the art is missing).
// Anyone outside is wearing their helmet, which is the same cue the crew
// cards use.
function CrewBadges({ x, y, crew, evaIds }: { x: number; y: number; crew: CrewMember[]; evaIds: ReadonlySet<string> }) {
  const r = BADGE_R
  const start = x - ((crew.length - 1) * (r * 2 + 6)) / 2
  return (
    <g>
      {crew.map((m, i) => {
        const src = portraitFor(m.id, evaIds.has(m.id))
        return (
          <g key={m.id} transform={`translate(${start + i * (r * 2 + 6)}, ${y})`}>
            {/* The bob lives on an inner group: the outer one is holding the
                position, and a CSS transform would replace it. The offset
                comes from who they are, not from where they are standing,
                so the crew do not bob in unison when they share a building. */}
            <g className="crew-bob" style={{ animationDelay: `${bobDelay(m.id)}s` }}>
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
  const terrain = TERRAIN[game.scenario.id]
  const fieldSpot = groundAt(terrain, FIELD_UV.u, FIELD_UV.v)
  const night = !lightInfo(game.scenario, game.sol).isDaylight
  const storm = env.dustStormSolsLeft > 0
  const sheltering = env.shelterSolsLeft > 0
  const shed = new Set(game.lastReport?.shedLoads ?? [])
  const status = (load: Exclude<PowerLoad, 'lifeSupport'>): Status =>
    !decisions.power[load] ? 'off' : shed.has(load) ? 'shed' : 'on'

  // Where a building's label and its crew stand: the label floats just
  // clear of the building's top, the crew gather at its front door.
  const labelAt = (pad: PadId, s: Sprite) => {
    const b = spriteBox(terrain, pad, s)
    return { x: groundAt(terrain, PADS[pad].u, PADS[pad].v).x, y: b.y - 6, foot: b.y + b.height + 6 }
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
  const o2 = labelAt('reactor', SPRITES.isru) // Mars has no reactor: the O₂ plant uses that pad

  return (
    <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="h-auto w-full bg-[#0c1633]" role="img" aria-label={`The ${isMars ? 'Mars' : 'lunar'} outpost`}>
      <defs>
        {/* Round mask for the crew portraits on the map. */}
        <clipPath id="crew-badge-clip">
          <circle r={BADGE_R} />
        </clipPath>
        {/* The pool of light a lit building throws on the ground. The Moon
            has no air for light to glow in, so the only thing to see at
            night is the ground it lands on. */}
        {/* The array's own shape, so its glint falls on the panels and not
            on the ground beside them. */}
        <mask id="solar-mask" maskUnits="userSpaceOnUse" style={{ maskType: 'alpha' }} {...spriteBox(terrain, 'solar', SPRITES.solar)}>
          <image href={`${ART}/buildings/solar-day.webp`} {...spriteBox(terrain, 'solar', SPRITES.solar)} />
        </mask>
        <radialGradient id="lamp-pool">
          <stop offset="0" stopColor="#fde68a" stopOpacity="0.5" />
          <stop offset="0.45" stopColor="#fbbf24" stopOpacity="0.22" />
          <stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sky first, then the slab. The terrain art is cut out, so the rust
          filter for Mars lands on the ground and nowhere else. */}
      <rect x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} fill="#0c1633" />
      <image href={`${ART}/${terrain.art}`} width={W} height={H} />

      {/* Night: darken the ground and the panels; buildings light up. */}
      <rect width={W} height={H} fill="#0a1433" style={{ opacity: night ? 0.55 : 0, transition: 'opacity 1.2s', mixBlendMode: 'multiply' }} />
      {/* Lamplight on the regolith. A building with no power throws none,
          so a dark patch of ground is a real signal, not decoration. */}
      <g style={{ opacity: night ? 1 : 0, transition: 'opacity 1.6s' }}>
        {LIT_PADS.map(({ pad, load }) => {
          if (pad === 'solar' && f.solarArrayM2 === 0) return null
          if (pad === 'reactor' && f.reactorKW === 0) {
            // Mars has no reactor: the pad is lit only when the O₂ plant is.
            const plantLit = game.scenario.isruAvailable && f.isruUnits > 0 && status('isru') === 'on'
            if (!plantLit) return null
          }
          if (pad === 'greenhouse' && f.greenhouseM2 === 0) return null
          if (load && status(load) !== 'on') return null
          const g = groundAt(terrain, PADS[pad].u, PADS[pad].v)
          const rx = SPRITES[pad].px[0] * BUILDING_SCALE * 0.95
          return <ellipse key={pad} cx={g.x} cy={g.y} rx={rx} ry={rx * 0.52} fill="url(#lamp-pool)" />
        })}
      </g>
      <g style={{ opacity: night ? 1 : 0, transition: 'opacity 1.6s' }}>
        {starsFor(terrain).map((s, i) => (
          <circle key={i} className="twinkle" cx={s.x} cy={s.y} r={s.r} fill="#e2e8f0" style={{ animationDelay: `${s.delay}s` }} />
        ))}
      </g>

      {/* Buildings, drawn back to front so a nearer one overlaps a farther
          one if they ever meet. */}
      {f.solarArrayM2 > 0 && (
        <g style={{ filter: storm ? 'brightness(0.7)' : undefined }}>
          <Building terrain={terrain} pad="solar" sprite={SPRITES.solar} night={night} />
          {/* Only while the array is actually making power. */}
          {!night && !storm && <PanelGlint box={spriteBox(terrain, 'solar', SPRITES.solar)} />}
        </g>
      )}
      <Building terrain={terrain} pad="habitat" sprite={SPRITES.habitat} night={night} />
      {f.reactorKW > 0 && <Building terrain={terrain} pad="reactor" sprite={SPRITES.reactor} night={night} />}
      {f.greenhouseM2 > 0 && (
        <Building terrain={terrain} pad="greenhouse" sprite={SPRITES.greenhouse} night={night} status={status('greenhouse')} flicker={effects?.powerCut && status('greenhouse') === 'shed'} />
      )}
      <Building terrain={terrain} pad="lab" sprite={SPRITES.lab} night={night} status={status('lab')} flicker={effects?.powerCut && status('lab') === 'shed'} />

      {/* The O₂ plant, on the pad Mars leaves empty. One plant however many
          makers are running: the count is on its label, the same way the
          greenhouse shows its area rather than growing. */}
      {game.scenario.isruAvailable && f.isruUnits > 0 && (
        <Building
          terrain={terrain}
          pad="reactor"
          sprite={SPRITES.isru}
          night={night}
          status={status('isru')}
          flicker={effects?.powerCut && status('isru') === 'shed'}
        />
      )}

      {/* A cargo lander comes down on resupply sols. */}
      {effects?.resupply && <CargoLander key={game.sol} x={880} y={700} />}

      {/* A solar flare washes the scene red once, before the alert opens. */}
      {effects?.flare && <rect key={game.sol} className="flare-flash" width={W} height={H} fill="#ef4444" />}

      {/* Weather and emergencies tint the whole scene. */}
      {storm && (
        <>
          <rect width={W} height={H} fill="#b45309" opacity={0.3} />
          <DustDrift />
        </>
      )}
      {sheltering && <rect width={W} height={H} fill="#dc2626" opacity={0.12} />}

      {/* Labels and crew, drawn last so nothing covers them. */}
      {f.solarArrayM2 > 0 && (
        <Pill x={sol.x} y={sol.y} icon={Sun} quiet>
          Solar {f.solarArrayM2} m²
        </Pill>
      )}
      {badgesUnder('solar', sol.x, sol.foot)}

      {f.greenhouseM2 > 0 && (
        <Pill x={gh.x} y={gh.y} icon={Sprout} tone={status('greenhouse') === 'shed' ? 'bad' : 'normal'} quiet={status('greenhouse') === 'on'}>
          Greenhouse {f.greenhouseM2} m²{status('greenhouse') === 'off' ? ' · off' : status('greenhouse') === 'shed' ? ' · no power' : ''}
        </Pill>
      )}
      {badgesUnder('greenhouse', gh.x, gh.foot)}

      <Pill x={hab.x} y={hab.y} icon={Home} tone={worn ? 'warn' : 'normal'} quiet={!worn}>
        Habitat
        {f.shieldingLevel > 0 && (
          <span className="flex items-center gap-1 text-slate-300">
            <Shield className="h-[36px] w-[36px] lg:h-[20px] lg:w-[20px]" aria-hidden /> {f.shieldingLevel}/{BALANCE.MAX_SHIELDING_LEVEL}
          </span>
        )}
        {worn && (
          <span className="flex items-center gap-1 text-amber-300">
            <TriangleAlert className="h-[36px] w-[36px] lg:h-[20px] lg:w-[20px]" aria-hidden /> {Math.round(f.condition * 100)}%
          </span>
        )}
      </Pill>
      {badgesUnder('habitat', hab.x, hab.foot)}

      {f.reactorKW > 0 && (
        <Pill x={rea.x} y={rea.y} icon={Zap} quiet>
          Reactor {f.reactorKW} kW
        </Pill>
      )}
      {game.scenario.isruAvailable && f.isruUnits > 0 && (
        <Pill x={o2.x} y={o2.y} icon={Wind} tone={status('isru') === 'shed' ? 'bad' : 'normal'} quiet={status('isru') === 'on'}>
          O₂ makers ×{f.isruUnits}{status('isru') === 'off' ? ' · off' : status('isru') === 'shed' ? ' · no power' : ''}
        </Pill>
      )}
      {badgesUnder('o2', o2.x, o2.foot)}

      <Pill x={lab.x} y={lab.y} icon={FlaskConical} tone={status('lab') === 'shed' ? 'bad' : 'normal'} quiet={status('lab') === 'on'}>
        Lab{status('lab') === 'off' ? ' · off' : status('lab') === 'shed' ? ' · no power' : ''}
      </Pill>
      {badgesUnder('lab', lab.x, lab.foot)}

      {crewAt.has('field') && (
        <>
          <Pill x={fieldSpot.x} y={fieldSpot.y - 60} icon={Pickaxe} quiet>
            Field work
          </Pill>
          {badgesUnder('field', fieldSpot.x, fieldSpot.y)}
        </>
      )}

      <text x={VIEW.x + VIEW.w - 24} y={VIEW.y + VIEW.h - 20} textAnchor="end" className="hidden fill-slate-300 text-[22px] lg:block" style={{ paintOrder: 'stroke', stroke: '#0f172a', strokeWidth: 5 }}>
        condition {Math.round(f.condition * 100)}% · shielding {f.shieldingLevel}/{BALANCE.MAX_SHIELDING_LEVEL}
      </text>
    </svg>
  )
}

// The figures the map's own labels carry on a wide screen, as readable text
// for a phone, where those labels would be about 6px tall. Nothing here is
// new information: it is the quiet half of the map, spelled out.
export function BaseSummary({ game }: { game: GameState }) {
  const f = game.facilities
  const worn = f.condition < 0.6
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300 lg:hidden">
      {f.solarArrayM2 > 0 && (
        <span className="flex items-center gap-1">
          <Sun size={13} className="text-yellow-300" aria-hidden /> {f.solarArrayM2} m²
        </span>
      )}
      {f.reactorKW > 0 && (
        <span className="flex items-center gap-1">
          <Zap size={13} className="text-amber-300" aria-hidden /> {f.reactorKW} kW
        </span>
      )}
      {game.scenario.isruAvailable && (
        <span className="flex items-center gap-1">
          <Wind size={13} className="text-sky-300" aria-hidden /> O₂ ×{f.isruUnits}
        </span>
      )}
      <span className="flex items-center gap-1">
        <Shield size={13} className="text-sky-300" aria-hidden /> {f.shieldingLevel}/{BALANCE.MAX_SHIELDING_LEVEL}
      </span>
      <span className={`flex items-center gap-1 ${worn ? 'text-amber-300' : ''}`}>
        <Home size={13} aria-hidden /> {Math.round(f.condition * 100)}%
      </span>
    </div>
  )
}
