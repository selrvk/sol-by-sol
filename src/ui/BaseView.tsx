// The outpost, drawn as an SVG scene over the painted terrain. Purely
// presentational: which art is shown, and how it is tinted, is read from
// game state; nothing here changes the game.
//
// Coordinates are pixels of the terrain image (1536 x 1024). Each building
// sits on one of the five pads marked on the terrain.

import { FlaskConical, Home, Package, Pickaxe, Shield, Sprout, Sun, TriangleAlert, Wind, Zap, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { EVA_TASKS } from '../sim/advanceSol.ts'
import { BALANCE } from '../sim/balance.ts'
import { lightInfo, nextResupplySol } from '../sim/forecast.ts'
import type { CrewMember, CrewTask, Decisions, GameState, PowerLoad, ScenarioId } from '../sim/types.ts'
import { portraitFor } from './labels.ts'
import type { SolEffects } from './useSolEffects.ts'

const W = 1536
const H = 1024
const ART = '/art'
// The slab fills the frame: its left and right corners run off the sides,
// with just enough sky above the back corner for the stars.
const VIEW = { x: 103, y: 12, w: 1330, h: 760 }

// Each world's terrain art, and the three corners of its painted diamond
// (the front corner follows from the other three). A spot on the ground is
// given as (u, v): u runs from the back corner towards the left one, v
// towards the right one, so (0,0) is the back corner and (1,1) the front.
// Placing buildings this way keeps them on the same ground plane the
// terrain is drawn in, which is what makes them look planted rather than
// pasted on.
//
// The two slabs were generated from one another, so they are all but the
// same shape (see art/ART-GUIDE.md), but the corners are still measured per
// world, so a slab regenerated on its own can be dropped in. The (u, v)
// positions below are the same for both, which is what lets one layout
// serve both worlds. Measured by fitting lines to each slab's back edges,
// ignoring the rocks along them: both edges slope at 28.5 degrees.
interface Terrain {
  art: string
  north: readonly [number, number]
  west: readonly [number, number]
  east: readonly [number, number]
}

const TERRAIN: Record<ScenarioId, Terrain> = {
  moon: { art: 'moon-terrain.webp', north: [764, 31], west: [37, 426], east: [1495, 429] },
  mars: { art: 'mars-terrain.webp', north: [761, 29], west: [34, 425], east: [1496, 427] },
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
// night. The clearance is measured against Mars, the smaller slab.
const PADS = {
  solar: { u: 0.22, v: 0.25 },
  habitat: { u: 0.45, v: 0.5 },
  reactor: { u: 0.22, v: 0.78 },
  greenhouse: { u: 0.74, v: 0.26 },
  lab: { u: 0.72, v: 0.77 },
  // The Moon's cargo pad, on the open ground between the lab and the
  // reactor. Mars has no deliveries, so it has no pad.
  landing: { u: 0.5, v: 0.84 },
} as const
type PadId = keyof typeof PADS

// One world scale for every building, so their painted sizes stay in
// proportion to each other and to the ground.
const BUILDING_SCALE = 0.45

// Mars daylight. The building art was painted in the Moon's cool greys, and
// on Mars's orange ground it looked pasted on. Dust in the Martian air gives
// daylight a warm, butterscotch cast, so on Mars the buildings are lit by
// it: blue is cut most, green a little, and colour slightly softened, which
// keeps each building's own hue (the green greenhouse, the blue lab) while
// matching the light the ground is lit by. A tint, not a coat of dust, so
// the buildings stay easy to tell apart.
const MARS_LIGHT = '0.900 0.109 0.011 0 0  0.029 0.881 0.010 0 0  0.025 0.084 0.671 0 0  0 0 0 1 0'
// The solar glint's colour, #e0f2fe, run through the same matrix. The glint
// is drawn outside the filter (see below), so it carries the light itself.
const GLINT = { moon: '#e0f2fe', mars: '#e7dec4' } as const

// Radius of a crew portrait on the map, shared by the badge and its mask.
const BADGE_R = 26

// Crew stand under the name of the place they are working, like a map
// marker's caption, so a name and the people there read as one. The name
// pill is 48 units tall on a wide screen, and the crew sit a 10-unit gap
// below it. On a phone the pill is 78 units (its text is larger, to stay
// legible when the map is shrunk), so the crew are nudged down 15 more there
// -- see CrewBadges.
const CREW_UNDER_LABEL = 48 / 2 + 10 + BADGE_R

// Buildings that light the ground at night, and the switch that decides
// whether they are lit at all. The habitat and the reactor are never
// switched off; the solar field and the cargo pad have their own lamps.
const LIT_PADS: { pad: PadId; load?: Exclude<PowerLoad, 'lifeSupport'> }[] = [
  { pad: 'habitat' },
  { pad: 'reactor' },
  { pad: 'solar' },
  { pad: 'greenhouse', load: 'greenhouse' },
  { pad: 'lab', load: 'lab' },
  { pad: 'landing' },
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
  scale?: number // when the image was shipped at a different size
  glint?: string // the solar cells alone, where the sunlight glint may fall
  daylight?: string // a filter for the day image: the world's light (MOON_LIGHT)
}
// The scale of the art built on the cargo pad (the pad itself, the lander,
// the second set of buildings): its platform is drawn about 280 units wide,
// a fifth of the slab.
const MOON_SET_SCALE = 0.456

// The four lamp posts at the corners of every platform built on the cargo
// pad: offsets from the platform's middle, in pixels of the 1254px renders
// (measured on the habitat's night image; the platform is the same in
// every render). The renders ship at half size, hence the 0.5. Their light
// is drawn on the ground a little below the lamp's foot, which stands on
// the raised platform.
const LAMP_POSTS = [[-569, 0], [0, -317], [569, 0], [0, 317]] as const
const RENDER_TO_MAP = 0.5 * MOON_SET_SCALE
const PLATFORM_DEPTH = 25 // the platform's height above the ground, in render pixels
const LAMP_POOL_RX = 62

const SPRITES: Record<Exclude<PadId, 'landing'> | 'isru' | 'landerPad' | 'landerPod', Sprite> = {
  habitat: { name: 'habitat', px: [539, 419], anchor: [0.519, 0.57] },
  reactor: { name: 'reactor', px: [393, 423], anchor: [0.496, 0.738] },
  solar: { name: 'solar', px: [510, 314], anchor: [0.558, 0.548] },
  greenhouse: { name: 'greenhouse', px: [557, 345], anchor: [0.48, 0.565] },
  lab: { name: 'lab', px: [471, 361], anchor: [0.486, 0.62] },
  // The O₂ plant stands on the reactor's pad, which Mars leaves empty. It
  // ships as one image because Mars has no night to light up for.
  isru: { name: 'co2maker', px: [515, 339], anchor: [0.538, 0.519], single: true },
  // The cargo pad and the lander on it share one image box (art/process.py
  // lines them up), anchored on the landing circle's centre.
  landerPad: { name: 'lander-pad', px: [619, 482], anchor: [0.501, 0.622], single: true, scale: MOON_SET_SCALE },
  landerPod: { name: 'lander-pod', px: [619, 482], anchor: [0.501, 0.622], single: true, scale: MOON_SET_SCALE },
}

// Moon daylight, for the art built on the cargo pad. The generator painted
// the pad's stone warm and tan, and the Moon's ground is a cool grey, so
// the platforms looked laid on the map rather than set in it. Measured on
// both: the plain tiles average rgb(162, 148, 143) and the open ground
// rgb(140, 141, 150). This moves the art three quarters of the way from
// the one colour to the other at the same brightness: red down a little,
// blue up. Night images are lamp-lit, so they keep their warm light.
const MOON_LIGHT = '0.94 0 0 0 0  0 1.01 0 0 0  0 0 1.09 0 0  0 0 0 1 0'

// The second set of buildings (art/ART-GUIDE.md), on the Moon so far; Mars
// keeps the first set until its own comes. Each is built on a copy of the
// cargo pad's platform, so all share the pad's scale, and art/process.py
// cuts a building's stages and its day and night to one box, so they share
// a size and anchor. A building with no night image yet is dimmed at night
// like the ground.
type BuildingId = 'habitat' | 'solar' | 'reactor' | 'greenhouse' | 'lab'
const MOON_SET: Record<BuildingId, Pick<Sprite, 'px' | 'anchor'> & { night: boolean }> = {
  habitat: { px: [620, 422], anchor: [0.501, 0.566], night: true },
  solar: { px: [620, 366], anchor: [0.501, 0.501], night: false },
  reactor: { px: [619, 470], anchor: [0.501, 0.612], night: true },
  greenhouse: { px: [619, 364], anchor: [0.501, 0.499], night: false },
  lab: { px: [619, 410], anchor: [0.501, 0.553], night: false },
}

// Two buildings change with the game: the habitat shows the base's
// condition, and the solar field gains rows of panels as it is built.
// Where the stages change is a display choice, not a game rule; damaged
// starts where the habitat's label turns amber (see `worn` below).
function habitatStage(condition: number) {
  return condition >= 0.85 ? 'good' : condition >= 0.6 ? 'worn' : 'damaged'
}

function solarStage(game: GameState) {
  const built = game.facilities.solarArrayM2 / game.scenario.maxSolarArrayM2
  return built >= 0.85 ? 3 : built >= 0.6 ? 2 : 1
}

function buildingSprites(game: GameState): Record<BuildingId, Sprite> {
  if (game.scenario.id !== 'moon') return SPRITES
  const moon = (id: BuildingId, file: string): Sprite => {
    const { px, anchor, night } = MOON_SET[id]
    const name = night ? `moon/${file}` : `moon/${file}-day`
    return { name, px, anchor, single: !night, scale: MOON_SET_SCALE, daylight: 'url(#moon-light)' }
  }
  const solar = `solar-${solarStage(game)}`
  return {
    habitat: moon('habitat', `habitat-${habitatStage(game.facilities.condition)}`),
    solar: { ...moon('solar', solar), glint: `moon/${solar}-day-glint` },
    reactor: moon('reactor', 'reactor'),
    greenhouse: moon('greenhouse', 'greenhouse'),
    lab: moon('lab', 'lab'),
  }
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
  const width = s.px[0] * (s.scale ?? BUILDING_SCALE)
  const height = s.px[1] * (s.scale ?? BUILDING_SCALE)
  return { x: g.x - s.anchor[0] * width, y: g.y - s.anchor[1] * height, width, height }
}

const art = (s: Sprite, when: 'day' | 'night') => `${ART}/buildings/${s.name}${s.single ? '' : `-${when}`}.webp`

// A building with day and night art stacked and cross-faded, so nightfall
// is a smooth change and the night image is already loaded when needed.
// Art with no night version fades to itself, dimmed like the ground.
function Building({ terrain, pad, sprite, night, status = 'on', flicker = false }: { terrain: Terrain; pad: PadId; sprite: Sprite; night: boolean; status?: Status; flicker?: boolean }) {
  const box = spriteBox(terrain, pad, sprite)
  const filter = status === 'off' ? 'grayscale(1) brightness(0.55)' : undefined
  const cls = [status === 'shed' ? 'shed-pulse' : '', flicker ? 'flicker-out' : ''].filter(Boolean).join(' ')
  return (
    <g className={cls || undefined} style={{ filter }}>
      <image href={art(sprite, 'day')} {...box} filter={sprite.daylight} style={{ opacity: night ? 0 : 1, transition: 'opacity 1.2s' }} />
      <g className={night ? 'night-breathe' : undefined}>
        <image href={art(sprite, 'night')} {...box} filter={sprite.single ? 'url(#night-dim)' : undefined} style={{ opacity: night ? 1 : 0, transition: 'opacity 1.2s' }} />
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
    const x = VIEW.x + ((i * 271) % VIEW.w)
    const y = VIEW.y + 85 + ((i * 137) % 300)
    if (above(x, y)) out.push({ x, y, r: i % 4 === 0 ? 3 : 2, delay: (i % 7) * 0.45 })
  }
  starFields.set(t.art, out)
  return out
}

// Sunlight travelling across the solar array, while it is actually making
// power: it stops at night and under a dust storm, which is the point.
// Masked by the array's own artwork, so the light falls on the panels and
// not on the ground beside them.
function PanelGlint({ box, color }: { box: { x: number; y: number; width: number; height: number }; color: string }) {
  const band = box.width * 0.2
  const lean = box.height * 0.5 // the scene's 2:1 isometric
  return (
    <g mask="url(#solar-mask)">
      <g className="panel-glint" style={{ ['--glint-travel' as string]: `${box.width * 0.9}px` }}>
        <polygon
          points={`${box.x + lean},${box.y} ${box.x + lean + band},${box.y} ${box.x + band},${box.y + box.height} ${box.x},${box.y + box.height}`}
          fill={color}
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
// The Moon's cargo pad, and the lander standing on it. Real cargo landers
// are one-way, so the last one stays on the pad; on a delivery sol a new
// one comes down (the old one taken to have been cleared off). There is no
// night art yet, so at night both are dimmed to match the ground.
//
// The landing: the lander drops onto the pad, slowing, on its engine; its
// shadow grows and darkens as it nears the pad; at touchdown the dust flies
// out low and straight and is gone. With no air on the Moon, dust does not
// billow into a cloud, it travels in straight lines and drops, as the Apollo
// landing films show.
function CargoPad({ terrain, night, landing }: { terrain: Terrain; night: boolean; landing: boolean }) {
  const box = spriteBox(terrain, 'landing', SPRITES.landerPad)
  // Map units per pixel of the shipped image, for spots measured on it.
  const k = box.width / SPRITES.landerPad.px[0]
  const at = (px: number, py: number) => ({ x: box.x + px * k, y: box.y + py * k })
  const centre = at(300, 298) // under the lander's body
  const bell = at(290, 297) // the bottom of the engine bell
  // The iso ground squashes circles to 0.54 of their width.
  const streaks = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2
    const [cx, cy] = [Math.cos(a), Math.sin(a) * 0.54]
    return { x1: cx * 70 * k, y1: cy * 70 * k, x2: cx * 190 * k, y2: cy * 190 * k }
  })
  return (
    <g filter={night ? 'url(#night-dim)' : undefined}>
      <image href={`${ART}/buildings/lander-pad.webp`} {...box} filter="url(#moon-light)" />
      <ellipse className={landing ? 'lander-shadow' : undefined} cx={centre.x} cy={centre.y} rx={125 * k} ry={60 * k} fill="#020617" opacity={0.45} />
      {landing && (
        <g transform={`translate(${centre.x}, ${centre.y})`}>
          <g className="lander-dust">
            {streaks.map((l, i) => (
              <line key={i} {...l} stroke="#f8fafc" strokeWidth={4} strokeLinecap="round" />
            ))}
          </g>
        </g>
      )}
      {/* Keyed, so the descent starts over for each new lander. */}
      <g key={landing ? 'landing' : 'landed'} className={landing ? 'lander-descend' : undefined}>
        {landing && (
          <path
            className="lander-plume"
            d={`M${bell.x - 17 * k} ${bell.y - 4 * k} L${bell.x} ${bell.y + 95 * k} L${bell.x + 17 * k} ${bell.y - 4 * k} Z`}
            fill="#fde68a"
          />
        )}
        <image href={`${ART}/buildings/lander-pod.webp`} {...box} filter="url(#moon-light)" />
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
    // Moved down on a phone, where the name pill above is taller.
    <g className="max-lg:translate-y-[15px]">
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
  const marsLight = isMars ? 'url(#mars-light)' : undefined
  const terrain = TERRAIN[game.scenario.id]
  const b = buildingSprites(game)
  const fieldSpot = groundAt(terrain, FIELD_UV.u, FIELD_UV.v)
  const night = !lightInfo(game.scenario, game.sol).isDaylight
  const storm = env.dustStormSolsLeft > 0
  const sheltering = env.shelterSolsLeft > 0
  const shed = new Set(game.lastReport?.shedLoads ?? [])
  const status = (load: Exclude<PowerLoad, 'lifeSupport'>): Status =>
    !decisions.power[load] ? 'off' : shed.has(load) ? 'shed' : 'on'

  // Where a building's label stands: just clear of the building's top. The
  // crew working there stand under it (CREW_UNDER_LABEL).
  const labelAt = (pad: PadId, s: Sprite) => {
    const b = spriteBox(terrain, pad, s)
    return { x: groundAt(terrain, PADS[pad].u, PADS[pad].v).x, y: b.y - 6 }
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

  const hab = labelAt('habitat', b.habitat)
  const lab = labelAt('lab', b.lab)
  const gh = labelAt('greenhouse', b.greenhouse)
  const sol = labelAt('solar', b.solar)
  const rea = labelAt('reactor', b.reactor)
  const cargo = labelAt('landing', SPRITES.landerPod)
  const nextCargo = nextResupplySol(game.scenario, game.sol)
  const worn = f.condition < 0.6
  const o2 = labelAt('reactor', SPRITES.isru) // Mars has no reactor: the O₂ plant uses that pad

  return (
    <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="h-auto w-full bg-[#0c1633]" role="img" aria-label={`The ${isMars ? 'Mars' : 'lunar'} outpost`}>
      <defs>
        {/* Round mask for the crew portraits on the map. */}
        <clipPath id="crew-badge-clip">
          <circle r={BADGE_R} />
        </clipPath>
        {/* The array's own shape, so its glint falls on the panels and not
            on the ground beside them. */}
        <mask id="solar-mask" maskUnits="userSpaceOnUse" style={{ maskType: 'alpha' }} {...spriteBox(terrain, 'solar', b.solar)}>
          <image href={b.solar.glint ? `${ART}/buildings/${b.solar.glint}.webp` : art(b.solar, 'day')} {...spriteBox(terrain, 'solar', b.solar)} />
        </mask>
        <filter id="mars-light" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={MARS_LIGHT} />
        </filter>
        <filter id="moon-light" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={MOON_LIGHT} />
        </filter>
        {/* Night for art that has no night version: what the night overlay
            does to the ground (a 55% multiply by #0a1433). */}
        <filter id="night-dim" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0.47 0 0 0 0  0 0.49 0 0 0  0 0 0.56 0 0  0 0 0 1 0" />
        </filter>
        {/* The pool of light a lamp post throws on the ground. The Moon has
            no air for light to glow in, so the only thing to see at night
            is the ground it lands on. The colour is the lamps' own: tiles
            in their light in the night art average rgb(133, 96, 66), and
            this colour at the centre's opacity turns the night ground
            (about rgb(66, 69, 84)) into that. */}
        <radialGradient id="lamp-pool">
          <stop offset="0" stopColor="rgb(188, 118, 51)" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="rgb(188, 118, 51)" stopOpacity="0.25" />
          <stop offset="1" stopColor="rgb(188, 118, 51)" stopOpacity="0" />
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
          if (pad === 'landing' && !game.scenario.resupply) return null
          // Mars has no night, so only the Moon's platforms, which all have
          // their lamps in the same four places, are ever lit.
          const g = groundAt(terrain, PADS[pad].u, PADS[pad].v)
          return LAMP_POSTS.map(([dx, dy], i) => (
            <ellipse
              key={`${pad}-${i}`}
              cx={g.x + dx * RENDER_TO_MAP}
              cy={g.y + (dy + PLATFORM_DEPTH) * RENDER_TO_MAP}
              rx={LAMP_POOL_RX}
              ry={LAMP_POOL_RX * 0.54}
              fill="url(#lamp-pool)"
            />
          ))
        })}
      </g>
      <g style={{ opacity: night ? 1 : 0, transition: 'opacity 1.6s' }}>
        {starsFor(terrain).map((s, i) => (
          <circle key={i} className="twinkle" cx={s.x} cy={s.y} r={s.r} fill="#e2e8f0" style={{ animationDelay: `${s.delay}s` }} />
        ))}
      </g>

      {/* Buildings, drawn back to front so a nearer one overlaps a farther
          one if they ever meet. On Mars they are lit by its warm daylight
          (MARS_LIGHT). The filter goes on an outer group of its own: a
          building's own CSS filter (switched off, storm-dimmed) would
          otherwise replace it. */}
      {f.solarArrayM2 > 0 && (
        <>
          <g filter={marsLight}>
            <g style={{ filter: storm ? 'brightness(0.7)' : undefined }}>
              <Building terrain={terrain} pad="solar" sprite={b.solar} night={night} />
            </g>
          </g>
          {/* Only while the array is actually making power. Outside the Mars
              light: it animates without end, and an animation inside a
              filtered group makes the browser re-run the filter every frame. */}
          {!night && !storm && <PanelGlint box={spriteBox(terrain, 'solar', b.solar)} color={GLINT[game.scenario.id]} />}
        </>
      )}
      <g filter={marsLight}>
      <Building terrain={terrain} pad="habitat" sprite={b.habitat} night={night} />
      {f.reactorKW > 0 && <Building terrain={terrain} pad="reactor" sprite={b.reactor} night={night} />}
      {f.greenhouseM2 > 0 && (
        <Building terrain={terrain} pad="greenhouse" sprite={b.greenhouse} night={night} status={status('greenhouse')} flicker={effects?.powerCut && status('greenhouse') === 'shed'} />
      )}
      {game.scenario.resupply && <CargoPad terrain={terrain} night={night} landing={!!effects?.resupply} />}
      <Building terrain={terrain} pad="lab" sprite={b.lab} night={night} status={status('lab')} flicker={effects?.powerCut && status('lab') === 'shed'} />

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
      </g>

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
      {badgesUnder('solar', sol.x, sol.y + CREW_UNDER_LABEL)}

      {f.greenhouseM2 > 0 && (
        <Pill x={gh.x} y={gh.y} icon={Sprout} tone={status('greenhouse') === 'shed' ? 'bad' : 'normal'} quiet={status('greenhouse') === 'on'}>
          Greenhouse {f.greenhouseM2} m²{status('greenhouse') === 'off' ? ' · off' : status('greenhouse') === 'shed' ? ' · no power' : ''}
        </Pill>
      )}
      {badgesUnder('greenhouse', gh.x, gh.y + CREW_UNDER_LABEL)}

      {/* Shielding and condition are named in words in the corner badge
          (desktop) and the strip under the map (phone). The habitat's own
          label only speaks up when the base is worn. */}
      <Pill x={hab.x} y={hab.y} icon={Home} tone={worn ? 'warn' : 'normal'} quiet={!worn}>
        Habitat
        {worn && (
          <span className="flex items-center gap-1 text-amber-300">
            <TriangleAlert className="h-[36px] w-[36px] lg:h-[20px] lg:w-[20px]" aria-hidden /> base condition {Math.round(f.condition * 100)}%
          </span>
        )}
      </Pill>
      {badgesUnder('habitat', hab.x, hab.y + CREW_UNDER_LABEL)}

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
      {badgesUnder('o2', o2.x, o2.y + CREW_UNDER_LABEL)}

      {game.scenario.resupply && (
        <Pill x={cargo.x} y={cargo.y} icon={Package} quiet>
          Cargo{nextCargo !== null && nextCargo < game.scenario.missionLengthSols ? ` · next sol ${nextCargo}` : ''}
        </Pill>
      )}

      <Pill x={lab.x} y={lab.y} icon={FlaskConical} tone={status('lab') === 'shed' ? 'bad' : 'normal'} quiet={status('lab') === 'on'}>
        Lab{status('lab') === 'off' ? ' · off' : status('lab') === 'shed' ? ' · no power' : ''}
      </Pill>
      {badgesUnder('lab', lab.x, lab.y + CREW_UNDER_LABEL)}

      {crewAt.has('field') && (
        <>
          <Pill x={fieldSpot.x} y={fieldSpot.y - CREW_UNDER_LABEL} icon={Pickaxe} quiet>
            Field work
          </Pill>
          {badgesUnder('field', fieldSpot.x, fieldSpot.y)}
        </>
      )}

    </svg>
  )
}

// The figures the map's own labels carry on a wide screen, as readable text
// for a phone, where those labels would be about 6px tall. Nothing here is
// new information: it is the quiet half of the map, spelled out.
//
// It is also the map for a screen reader, on every screen size: the map
// itself is one image. So on a wide screen it is visually hidden rather
// than removed, and each figure says what it is in words, since the icons
// that name them on screen are not read out.
export function BaseSummary({ game }: { game: GameState }) {
  const f = game.facilities
  const worn = f.condition < 0.6
  const item = 'flex items-center gap-1'
  // Every figure carries its name in words. The icons help the eye find
  // it, but an icon beside a bare "1/6" left players guessing.
  const name = 'text-slate-400'
  return (
    <ul
      aria-label="Base facilities"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 lg:sr-only"
    >
      {f.solarArrayM2 > 0 && (
        <li className={item}>
          <Sun size={13} className="text-yellow-300" aria-hidden /> <span className={name}>Solar</span> {f.solarArrayM2} m²
        </li>
      )}
      {f.reactorKW > 0 && (
        <li className={item}>
          <Zap size={13} className="text-amber-300" aria-hidden /> <span className={name}>Reactor</span> {f.reactorKW} kW
        </li>
      )}
      {f.greenhouseM2 > 0 && (
        <li className={item}>
          <Sprout size={13} className="text-emerald-300" aria-hidden /> <span className={name}>Greenhouse</span> {f.greenhouseM2} m²
        </li>
      )}
      {game.scenario.isruAvailable && (
        <li className={item}>
          <Wind size={13} className="text-sky-300" aria-hidden /> <span className={name}>O₂ makers</span> {f.isruUnits}
        </li>
      )}
      <li className={item}>
        <Shield size={13} className="text-sky-300" aria-hidden /> <span className={name}>Shielding</span>{' '}
        {/* one piece, so the row's gap does not split "1/6" */}
        <span>
          {f.shieldingLevel}
          <span aria-hidden>/</span>
          <span className="sr-only"> of </span>
          {BALANCE.MAX_SHIELDING_LEVEL}
        </span>
      </li>
      <li className={`${item} ${worn ? 'text-amber-300' : ''}`}>
        <Home size={13} aria-hidden /> <span className={worn ? '' : name}>Base condition</span> {Math.round(f.condition * 100)}%
        {worn && <span className="sr-only">, worn: needs maintenance</span>}
      </li>
    </ul>
  )
}

// The base's condition and shielding, in the map's bottom-right corner on a
// wide screen: the same kind of overlay as the world picker in the other
// corner. Condition is a bar because it is a level that wears down and is
// repaired; shielding is six pips because it is built one level at a time.
// A phone shows both in the BaseSummary strip instead, and a screen reader
// hears them there, so this is hidden from both.
export function BaseCondition({ game }: { game: GameState }) {
  const f = game.facilities
  const pct = Math.round(f.condition * 100)
  const worn = f.condition < 0.6 // the same point the habitat's label turns amber
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-3 right-3 hidden items-center gap-3 rounded-xl border border-slate-600 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-lg lg:flex"
    >
      <span className="flex items-center gap-1.5">
        <Home size={14} className={worn ? 'text-amber-300' : 'text-slate-300'} />
        Base condition
        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-700">
          <span className={`block h-full rounded-full ${worn ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} />
        </span>
        <span className={`tabular-nums ${worn ? 'text-amber-300' : ''}`}>{pct}%</span>
      </span>
      <span className="h-4 w-px bg-slate-600" />
      <span className="flex items-center gap-1.5">
        <Shield size={14} className="text-sky-300" />
        Shielding
        <span className="flex gap-0.5">
          {Array.from({ length: BALANCE.MAX_SHIELDING_LEVEL }, (_, i) => (
            <span key={i} className={`h-2.5 w-1.5 rounded-sm ${i < f.shieldingLevel ? 'bg-sky-400' : 'bg-slate-700'}`} />
          ))}
        </span>
        <span className="tabular-nums">
          {f.shieldingLevel}/{BALANCE.MAX_SHIELDING_LEVEL}
        </span>
      </span>
    </div>
  )
}
