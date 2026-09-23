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

export interface CrewMember {
  id: CrewId
  name: string
  role: CrewRole
  doseMSv: number             // cumulative career dose, including past missions
  careerDoseLimitMSv: number
}

// One task per astronaut per sol (one shift).
// fieldScience, solar, shielding and isru are EVA tasks: extra radiation dose.
export type CrewTask =
  | 'labScience'   // science, needs the lab powered
  | 'fieldScience' // more science, EVA
  | 'greenhouse'   // expand greenhouse area
  | 'solar'        // deploy more solar panels, EVA
  | 'shielding'    // pile regolith on the habitat, EVA
  | 'maintenance'  // repair base condition
  | 'isru'         // build an ISRU unit (Mars only), EVA
  | 'rest'

// --- Base ---

export interface Facilities {
  solarArrayM2: number
  reactorKW: number
  batteryCapacityKWh: number
  greenhouseM2: number
  shieldingLevel: number // regolith piled so far; lowers indoor dose
  isruUnits: number      // Mars only (MOXIE-style O2 production)
  condition: number      // 0..1; scales solar output and water recovery
}

export type PowerLoad = 'lifeSupport' | 'isru' | 'greenhouse' | 'lab'

export interface Environment {
  isDaylight: boolean
  dustStormSolsLeft: number // 0 when no storm is active
  shelterSolsLeft: number   // >0 while crew shelter from a solar particle event
  // Crew shifts owed to event repairs. Taken from science tasks first.
  busyShifts: number
  busyEvaShifts: number     // same, but the work is outside (EVA dose)
}

// --- Scenario (static config, one per world) ---

export type ScenarioId = 'moon' | 'mars'

export interface Scenario {
  id: ScenarioId
  name: string
  hoursPerSol: number
  missionLengthSols: number
  scienceTarget: number
  // Clear-sky solar energy per m² of panel area per daylit sol, before
  // panel efficiency.
  solarKWhPerM2PerSol: number
  // null = every sol has sunlight (Mars: day/night is averaged into the sol)
  dayNightCycle: { daySols: number; nightSols: number } | null
  maxSolarArrayM2: number
  dustStorm: {
    chancePerSol: number // 0 on the Moon
    minSols: number
    maxSols: number
    solarFactor: number
  }
  surfaceDoseMSvPerSol: number
  atmosphereGCm2: number // shielding from the atmosphere (0 on the Moon)
  speChancePerSol: number   // solar particle events (space weather)
  eventChancePerSol: number // all other events
  resupply: { intervalSols: number; cargo: ResourceLevels } | null
  isruAvailable: boolean
  // Full starting state, so a scenario can open mid-mission (Stage 5).
  start: {
    sol: number
    resources: ResourceLevels
    facilities: Facilities
    crew: CrewMember[]
    sciencePoints: number
  }
}

// --- Events ---

// Facility values an event can change (deltas).
export type FacilityDeltas = Partial<
  Pick<Facilities, 'solarArrayM2' | 'batteryCapacityKWh' | 'greenhouseM2' | 'shieldingLevel' | 'isruUnits' | 'condition'>
>

// What a player's answer to an event does.
export interface EventEffects {
  resources?: Partial<ResourceLevels> // deltas
  facilities?: FacilityDeltas         // deltas
  crewDoseMSv?: number                // added to every crew member
  // Solar particle event: dose depends on each person's shielding.
  // scale = event size as a fraction of the August 1972 event.
  solarParticleEvent?: { scale: number; sheltered: boolean }
  sciencePoints?: number              // delta
  shelterSols?: number                // crew shelter and do no work
  crewShifts?: number                 // shifts diverted to the problem
  evaShifts?: number                  // same, but outside (EVA dose)
}

export interface EventOutcome extends EventEffects {
  message: string
  // A risky choice: resolved with the seeded RNG when the player answers.
  gamble?: {
    chance: number // probability of success, 0..1
    success: EventEffects & { message: string }
    failure: EventEffects & { message: string }
  }
}

export interface EventChoice {
  id: string
  label: string
  outcome: EventOutcome
}

// An event waiting for the player's decision. Resolved at the start of the
// next advanceSol using Decisions.eventChoiceId.
// Convention: choices[0] is the careful option and the default; the last
// choice is the one that cuts corners.
export interface PendingEvent {
  id: string
  title: string
  description: string
  choices: EventChoice[]
  defaultChoiceId: string // used if the player doesn't choose
}

export type GameEventKind =
  | 'eventStart'
  | 'eventResolved'
  | 'dustStormStart'
  | 'dustStormEnd'
  | 'nightfall'
  | 'sunrise'
  | 'loadShed'
  | 'resupply'
  | 'info'

// A log entry shown to the player.
export interface GameEvent {
  sol: number
  kind: GameEventKind
  message: string
}

// --- Outcome ---

export type LossReason =
  | 'oxygen'
  | 'water'
  | 'food'
  | 'power'          // life support could not be powered
  | 'radiation'      // a crew member exceeded their career limit
  | 'missionTimeout' // survived, but missed the science target

export type Outcome =
  | { status: 'playing' }
  | { status: 'won' }
  | { status: 'lost'; reason: LossReason }

// --- Per-sol report ---

// What happened during the last sol. Used for UI deltas and the sim script.
export interface SolReport {
  sol: number
  powerGeneratedKWh: number
  powerDemandKWh: number
  shedLoads: PowerLoad[]
  resourceDeltas: ResourceLevels
  crewHoursAvailable: number
  crewHoursWorked: number
  repairShifts: number // shifts that went to event repairs instead of tasks
  scienceEarned: number
}

// --- Game state ---

// Crew time is not stored: available hours are derived each sol from
// the crew, so it can never be banked.
export interface GameState {
  scenario: Scenario
  sol: number // turn counter; the sol about to be played
  resources: ResourceLevels
  crew: CrewMember[]
  facilities: Facilities
  environment: Environment
  sciencePoints: number
  rng: RngState
  pendingEvent: PendingEvent | null
  log: GameEvent[]
  lastReport: SolReport | null
  outcome: Outcome
}

// --- Player input for one sol ---

export interface Decisions {
  assignments: Record<CrewId, CrewTask>
  // Life support is always powered. On a shortfall the sim sheds these
  // loads, lab first, then greenhouse, then isru.
  power: {
    greenhouse: boolean
    lab: boolean
    isru: boolean
  }
  eventChoiceId?: string // answer to state.pendingEvent
}
