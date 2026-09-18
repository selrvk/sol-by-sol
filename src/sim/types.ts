// Core simulation types. Pure TypeScript: no React, no logic.

// --- Randomness ---

// Seeded RNG state. Plain numbers so GameState serialises to JSON and a
// losing game can be replayed exactly from its seed.
export interface RngState {
  seed: number  // original seed, kept for replay/debugging
  state: number // current internal state, advanced on every draw
}

// A pure RNG step: returns a float in [0, 1) and the next state.
// The sim must only get randomness through a function of this shape.
export type RngFn = (rng: RngState) => { value: number; next: RngState }

// --- Resources ---

export interface ResourceLevels {
  storedPowerKWh: number
  oxygenKg: number
  waterL: number
  foodKg: number
}

// --- Crew ---

export type CrewId = string

export type CrewRole = 'commander' | 'engineer' | 'scientist' | 'medic'

export type CrewStatus = 'active' | 'incapacitated'

export interface CrewMember {
  id: CrewId
  name: string
  role: CrewRole
  doseMSv: number             // cumulative radiation dose
  careerDoseLimitMSv: number
  status: CrewStatus          // incapacitated crew contribute no hours
}

// One task per astronaut per sol (~8h of work).
// fieldScience and shielding are EVA tasks and add extra radiation dose.
export type CrewTask =
  | 'labScience'
  | 'fieldScience'
  | 'greenhouse'
  | 'shielding'
  | 'maintenance'
  | 'isru'
  | 'rest'

// --- Base ---

export interface Facilities {
  solarArrayM2: number
  batteryCapacityKWh: number
  greenhouseLevel: number
  shieldingLevel: number // regolith piled so far; lowers indoor dose
  isruUnits: number      // Mars only (MOXIE-style O2 production)
}

export interface Environment {
  isDaylight: boolean
  dustStormSolsLeft: number // 0 when no storm is active
}

// --- Scenario (static config, one per world) ---

export type ScenarioId = 'moon' | 'mars'

export interface Scenario {
  id: ScenarioId
  name: string
  hoursPerSol: number             // 24 on the Moon, 24.66 on Mars
  missionLengthSols: number
  scienceTarget: number
  solarFluxWm2: number            // from constants.ts
  daylightSols: number            // length of a day period, in sols
  nightSols: number               // length of a night period, in sols
  dustStormChancePerSol: number   // 0 on the Moon
  dustStormSolarFactor: number    // fraction of solar output kept during a storm
  surfaceDoseMSvPerSol: number    // unshielded background dose
  resupplyIntervalSols: number
  isruAvailable: boolean
  startingResources: ResourceLevels
  startingFacilities: Facilities
  startingCrew: CrewMember[]
}

// --- Events ---

export type GameEventKind =
  | 'solarParticleEvent'
  | 'dustStormStart'
  | 'dustStormEnd'
  | 'nightfall'
  | 'sunrise'
  | 'equipmentFailure'
  | 'resupply'
  | 'crewIncapacitated'
  | 'info'

export interface GameEvent {
  sol: number
  kind: GameEventKind
  message: string                    // shown to the player
  effects?: Partial<ResourceLevels>  // resource deltas applied by this event
}

// --- Outcome ---

export type LossReason =
  | 'oxygen'
  | 'water'
  | 'food'
  | 'power'
  | 'radiation'      // a crew member exceeded their career limit
  | 'missionTimeout' // survived, but missed the science target

export type Outcome =
  | { status: 'playing' }
  | { status: 'won' }
  | { status: 'lost'; reason: LossReason }

// --- Game state ---

// Crew time is not stored: available hours are derived each sol from
// active crew, so it can never be banked.
export interface GameState {
  scenario: Scenario
  sol: number // 0-based turn counter
  resources: ResourceLevels
  crew: CrewMember[]
  facilities: Facilities
  environment: Environment
  sciencePoints: number
  rng: RngState
  log: GameEvent[]
  outcome: Outcome
}

// --- Player input for one sol ---

export interface Decisions {
  assignments: Record<CrewId, CrewTask>
  // Life support is always powered. On a shortfall the sim sheds these
  // loads in a fixed priority order.
  power: {
    greenhouse: boolean
    lab: boolean
    isru: boolean
  }
}
