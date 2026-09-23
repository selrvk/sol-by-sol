import { BALANCE } from './balance.ts'
import { c } from './constants.ts'
import { EVENTS, SOLAR_PARTICLE_EVENT } from './events.ts'
import { lightInfo } from './forecast.ts'
import { gcrDoseMSv, speDoses } from './radiation.ts'
import { nextRandom } from './rng.ts'
import type {
  CrewId,
  CrewMember,
  CrewTask,
  Decisions,
  Environment,
  EventEffects,
  Facilities,
  GameEvent,
  GameState,
  LossReason,
  Outcome,
  PendingEvent,
  PowerLoad,
  ResourceLevels,
  RngState,
  Scenario,
} from './types.ts'
import type { EventContext } from './events.ts'

// Tasks done outside in a spacesuit: they take extra radiation dose.
export const EVA_TASKS: ReadonlySet<CrewTask> = new Set(['fieldScience', 'solar', 'shielding', 'isru'])

const LOAD_NAMES: Record<PowerLoad, string> = {
  lifeSupport: 'life support',
  isru: 'O₂ makers',
  greenhouse: 'greenhouse',
  lab: 'science lab',
}

// The optional loads, most important first. Oxygen outranks food, and food
// outranks science, so on a shortfall the lab is the first thing to go dark
// and the O₂ makers are the last. The UI states this rule to the player, so
// it has to hold in every case: the line stops at the first load there is
// not enough power for, rather than skipping it to afford a cheaper one
// further down. Otherwise a tight sol could run the science lab while the
// crew's oxygen plant sat idle. Power the line does not reach is not wasted:
// it charges the battery for the next sol.
const LOAD_PRIORITY = ['isru', 'greenhouse', 'lab'] as const

// When repairs need crew, they are taken off science first.
const BUSY_PRIORITY: CrewTask[] = ['fieldScience', 'labScience', 'greenhouse', 'solar', 'shielding', 'isru', 'maintenance']

// kWh each system would draw this sol if switched on.
export function loadDemandKWh(scenario: Scenario, fac: Facilities): Record<PowerLoad, number> {
  const solDays = scenario.hoursPerSol / 24
  return {
    lifeSupport: c('LIFE_SUPPORT_KW') * scenario.hoursPerSol,
    isru: scenario.isruAvailable
      ? fac.isruUnits * BALANCE.ISRU_KG_O2_PER_UNIT_PER_SOL * c('MOXIE_KWH_PER_KG_O2')
      : 0,
    greenhouse: fac.greenhouseM2 * c('GREENHOUSE_YIELD_KG_M2_PER_DAY') * solDays * c('GREENHOUSE_KWH_PER_KG_FOOD'),
    lab: BALANCE.LAB_KW * scenario.hoursPerSol,
  }
}

// What the whole crew breathes, drinks and eats in one sol.
export function crewUse(scenario: Scenario, crewCount: number): { oxygenKg: number; waterL: number; foodKg: number } {
  const solDays = scenario.hoursPerSol / 24
  return {
    oxygenKg: c('CREW_O2_KG_PER_DAY') * crewCount * solDays,
    waterL: c('CREW_WATER_L_PER_DAY') * crewCount * solDays,
    foodKg: c('CREW_FOOD_KG_PER_DAY') * crewCount * solDays,
  }
}

// Solar energy the array makes in one sol. `light` is 1 in clear sunlight,
// 0 at night, and the storm factor in a dust storm.
export function solarKWh(scenario: Scenario, fac: Facilities, light: number): number {
  return fac.solarArrayM2 * scenario.solarKWhPerM2PerSol * c('SOLAR_PANEL_EFFICIENCY') * fac.condition * light
}

// Food a greenhouse of this size grows in one sol, while it has power.
export function greenhouseFoodKg(scenario: Scenario, m2: number): number {
  return m2 * c('GREENHOUSE_YIELD_KG_M2_PER_DAY') * (scenario.hoursPerSol / 24)
}

// How much base condition is lost in one sol. Everything you build wears
// out, so building costs future crew time.
export function wearPerSol(fac: Facilities): number {
  return (
    BALANCE.WEAR_BASE_PER_SOL +
    BALANCE.WEAR_PER_SOLAR_M2 * fac.solarArrayM2 +
    BALANCE.WEAR_PER_GREENHOUSE_M2 * fac.greenhouseM2 +
    BALANCE.WEAR_PER_ISRU_UNIT * fac.isruUnits
  )
}

// Advance the simulation by one sol. Pure and deterministic: all randomness
// comes from state.rng, never Math.random().
//
// Order within a sol:
//   0. Resolve the event the player answered last sol
//   1. Crew consumption
//   2. Power generation (day/night, dust storms)
//   3. Power draw, shedding loads on a shortfall
//   4. Water recovery, greenhouse and ISRU production
//   5. Radiation dose
//   6. Crew tasks, base wear, resupply
//   7. Random event roll
//   8. Win/loss check
export function advanceSol(state: GameState, decisions: Decisions): GameState {
  if (state.outcome.status !== 'playing') return state

  const scenario = state.scenario
  const sol = state.sol
  const log: GameEvent[] = []
  let rng = state.rng

  const res: ResourceLevels = { ...state.resources }
  const crew: CrewMember[] = state.crew.map((m) => ({ ...m }))
  const fac: Facilities = { ...state.facilities }
  const env: Environment = { ...state.environment }
  let science = state.sciencePoints

  // 0. Resolve pending event
  let spe: { scale: number; sheltered: boolean } | null = null
  if (state.pendingEvent) {
    const event = state.pendingEvent
    const choice =
      event.choices.find((ch) => ch.id === decisions.eventChoiceId) ??
      event.choices.find((ch) => ch.id === event.defaultChoiceId)!
    const o = choice.outcome
    const messages = [o.message]
    const applied: EventEffects[] = [o]
    if (o.gamble) {
      const roll = nextRandom(rng)
      rng = roll.next
      const result = roll.value < o.gamble.chance ? o.gamble.success : o.gamble.failure
      applied.push(result)
      messages.push(result.message)
    }
    for (const e of applied) {
      applyEffects(e, res, fac, env, crew)
      if (e.sciencePoints) science += e.sciencePoints
      if (e.solarParticleEvent) spe = e.solarParticleEvent
    }
    if (spe) {
      const dose = speDoses(scenario, fac, spe.scale)
      for (const m of crew) {
        const onEva = EVA_TASKS.has(decisions.assignments[m.id] ?? 'rest')
        m.doseMSv += spe.sheltered ? dose.sheltered : onEva ? dose.eva : dose.indoor
      }
    }
    log.push({ sol, kind: 'eventResolved', message: `${event.title}: ${messages.join(' ')}` })
  }
  const sheltering = env.shelterSolsLeft > 0
  const planned = (m: CrewMember): CrewTask =>
    sheltering ? 'rest' : (decisions.assignments[m.id] ?? 'rest')

  // Crew owed to event repairs this sol, taken off science first.
  const busy = new Map<CrewId, 'eva' | 'indoor'>()
  const workers = crew
    .filter((m) => planned(m) !== 'rest')
    .sort((a, b) => BUSY_PRIORITY.indexOf(planned(a)) - BUSY_PRIORITY.indexOf(planned(b)))
  for (const m of workers) {
    if (env.busyEvaShifts > 0) {
      busy.set(m.id, 'eva')
      env.busyEvaShifts--
    } else if (env.busyShifts > 0) {
      busy.set(m.id, 'indoor')
      env.busyShifts--
    }
  }
  const taskFor = (m: CrewMember): CrewTask => (busy.has(m.id) ? 'rest' : planned(m))
  const onEva = (m: CrewMember) => busy.get(m.id) === 'eva' || EVA_TASKS.has(taskFor(m))

  // 1. Crew consumption (everyone breathes, eats and drinks)
  const use = crewUse(scenario, crew.length)
  const waterUsed = use.waterL
  res.oxygenKg -= use.oxygenKg
  res.waterL -= waterUsed
  res.foodKg -= use.foodKg

  // 2. Power generation
  const daylight = lightInfo(scenario, sol).isDaylight
  if (daylight !== env.isDaylight) {
    log.push(
      daylight
        ? { sol, kind: 'sunrise', message: 'Sunrise. The solar panels are producing again.' }
        : { sol, kind: 'nightfall', message: 'Nightfall. No solar power until sunrise.' },
    )
  }
  env.isDaylight = daylight

  if (env.dustStormSolsLeft === 0 && scenario.dustStorm.chancePerSol > 0) {
    const roll = nextRandom(rng)
    rng = roll.next
    if (roll.value < scenario.dustStorm.chancePerSol) {
      const len = nextRandom(rng)
      rng = len.next
      const { minSols, maxSols } = scenario.dustStorm
      env.dustStormSolsLeft = minSols + Math.floor(len.value * (maxSols - minSols + 1))
      log.push({ sol, kind: 'dustStormStart', message: 'A dust storm has rolled in. Solar output has dropped.' })
    }
  }
  const storm = env.dustStormSolsLeft > 0

  const solar = solarKWh(scenario, fac, (daylight ? 1 : 0) * (storm ? scenario.dustStorm.solarFactor : 1))
  const reactorKWh = fac.reactorKW * scenario.hoursPerSol
  const generated = solar + reactorKWh

  // 3. Power draw. Life support first, then optional loads in priority order.
  const full = loadDemandKWh(scenario, fac)
  const demand: Record<PowerLoad, number> = {
    lifeSupport: full.lifeSupport,
    isru: decisions.power.isru ? full.isru : 0,
    greenhouse: decisions.power.greenhouse ? full.greenhouse : 0,
    lab: decisions.power.lab ? full.lab : 0,
  }
  let available = res.storedPowerKWh + generated
  let lifeSupportFailed = false
  if (available >= demand.lifeSupport) {
    available -= demand.lifeSupport
  } else {
    lifeSupportFailed = true
    available = 0
  }
  const powered = new Set<PowerLoad>()
  const shed: PowerLoad[] = []
  let short = false
  for (const load of LOAD_PRIORITY) {
    if (demand[load] === 0) continue
    if (!short && demand[load] <= available) {
      available -= demand[load]
      powered.add(load)
    } else {
      // Once one load cannot be afforded, everything below it goes too.
      short = true
      shed.push(load)
    }
  }
  // Reported in the order they were given up, which is how the player is
  // told it works: the lab goes first.
  shed.reverse()
  if (shed.length > 0) {
    log.push({ sol, kind: 'loadShed', message: `Not enough power. Switched off: ${shed.map((l) => LOAD_NAMES[l]).join(', ')}.` })
  }
  res.storedPowerKWh = Math.min(fac.batteryCapacityKWh, available)

  // 4. Production
  res.waterL += waterUsed * c('WATER_RECOVERY_FRACTION') * fac.condition
  if (powered.has('greenhouse')) {
    res.foodKg += greenhouseFoodKg(scenario, fac.greenhouseM2)
  }
  if (powered.has('isru')) {
    res.oxygenKg += fac.isruUnits * BALANCE.ISRU_KG_O2_PER_UNIT_PER_SOL
  }

  // 5. Radiation (galactic cosmic rays). EVA hours take the full surface
  // dose; indoor hours are reduced a little by the habitat and regolith.
  for (const m of crew) {
    const evaFraction = onEva(m) ? BALANCE.SHIFT_HOURS / scenario.hoursPerSol : 0
    m.doseMSv += gcrDoseMSv(scenario, fac, evaFraction)
  }

  // 6. Crew tasks
  let shiftsWorked = 0
  let scienceEarned = 0
  let maintenanceShifts = 0
  let evaShifts = 0
  const outsideWorks = daylight || scenario.outsideWorkAtNight
  for (const m of crew) {
    if (onEva(m)) evaShifts++
    const task = taskFor(m)
    if (task !== 'rest' || busy.has(m.id)) shiftsWorked++
    if (EVA_TASKS.has(task) && !outsideWorks) continue
    switch (task) {
      case 'labScience':
        if (powered.has('lab')) scienceEarned += BALANCE.LAB_SCIENCE_PER_SHIFT
        break
      case 'fieldScience':
        scienceEarned += BALANCE.FIELD_SCIENCE_PER_SHIFT
        break
      case 'greenhouse':
        fac.greenhouseM2 += BALANCE.GREENHOUSE_M2_PER_SHIFT
        break
      case 'solar':
        fac.solarArrayM2 = Math.min(scenario.maxSolarArrayM2, fac.solarArrayM2 + BALANCE.SOLAR_M2_PER_SHIFT)
        break
      case 'shielding':
        fac.shieldingLevel = Math.min(BALANCE.MAX_SHIELDING_LEVEL, fac.shieldingLevel + BALANCE.SHIELDING_LEVELS_PER_SHIFT)
        break
      case 'maintenance':
        maintenanceShifts++
        break
      case 'isru':
        if (scenario.isruAvailable) fac.isruUnits += BALANCE.ISRU_UNITS_PER_SHIFT
        break
      case 'rest':
        break
    }
  }
  science += scienceEarned

  fac.condition = clamp01(
    fac.condition -
      wearPerSol(fac) -
      scenario.evaDustWear * evaShifts +
      BALANCE.MAINTENANCE_PER_SHIFT * maintenanceShifts,
  )

  if (scenario.resupply && sol > 0 && sol % scenario.resupply.intervalSols === 0) {
    const cargo = scenario.resupply.cargo
    res.storedPowerKWh = Math.min(fac.batteryCapacityKWh, res.storedPowerKWh + cargo.storedPowerKWh)
    res.oxygenKg += cargo.oxygenKg
    res.waterL += cargo.waterL
    res.foodKg += cargo.foodKg
    log.push({ sol, kind: 'resupply', message: 'A cargo lander has delivered supplies.' })
  }

  // Counters tick down at the end of the sol they applied to.
  if (env.shelterSolsLeft > 0) env.shelterSolsLeft--
  if (env.dustStormSolsLeft > 0) {
    env.dustStormSolsLeft--
    if (env.dustStormSolsLeft === 0) {
      log.push({ sol, kind: 'dustStormEnd', message: 'The dust storm has cleared.' })
    }
  }

  // 7. Random event
  let pendingEvent: PendingEvent | null = null
  const rolled = rollEvent({ scenario, facilities: fac, environment: env, crew, sol }, rng)
  rng = rolled.rng
  if (rolled.event) {
    pendingEvent = rolled.event
    log.push({ sol, kind: 'eventStart', message: rolled.event.title })
  }

  // 8. Win/loss
  const outcome = checkOutcome(scenario, sol, res, crew, science, lifeSupportFailed)

  const before = state.resources
  return {
    ...state,
    sol: sol + 1,
    resources: {
      storedPowerKWh: Math.max(0, res.storedPowerKWh),
      oxygenKg: Math.max(0, res.oxygenKg),
      waterL: Math.max(0, res.waterL),
      foodKg: Math.max(0, res.foodKg),
    },
    crew,
    facilities: fac,
    environment: env,
    sciencePoints: science,
    rng,
    pendingEvent,
    log: [...state.log, ...log],
    lastReport: {
      sol,
      powerGeneratedKWh: generated,
      powerDemandKWh: Object.values(demand).reduce((a, b) => a + b, 0),
      shedLoads: shed,
      resourceDeltas: {
        storedPowerKWh: res.storedPowerKWh - before.storedPowerKWh,
        oxygenKg: res.oxygenKg - before.oxygenKg,
        waterL: res.waterL - before.waterL,
        foodKg: res.foodKg - before.foodKg,
      },
      crewHoursAvailable: crew.length * BALANCE.SHIFT_HOURS,
      crewHoursWorked: shiftsWorked * BALANCE.SHIFT_HOURS,
      repairShifts: busy.size,
      scienceEarned,
    },
    outcome,
  }
}

function applyEffects(e: EventEffects, res: ResourceLevels, fac: Facilities, env: Environment, crew: CrewMember[]) {
  if (e.resources) {
    for (const key of Object.keys(e.resources) as (keyof ResourceLevels)[]) {
      res[key] = Math.max(0, res[key] + (e.resources[key] ?? 0))
    }
  }
  if (e.facilities) {
    for (const key of Object.keys(e.facilities) as (keyof typeof e.facilities)[]) {
      fac[key] = Math.max(0, fac[key] + (e.facilities[key] ?? 0))
    }
    fac.condition = clamp01(fac.condition)
    res.storedPowerKWh = Math.min(res.storedPowerKWh, fac.batteryCapacityKWh)
  }
  if (e.crewDoseMSv) for (const m of crew) m.doseMSv += e.crewDoseMSv
  if (e.shelterSols) env.shelterSolsLeft = Math.max(env.shelterSolsLeft, e.shelterSols)
  if (e.crewShifts) env.busyShifts += e.crewShifts
  if (e.evaShifts) env.busyEvaShifts += e.evaShifts
}

// Solar particle events are space weather: they get their own roll, like
// dust storms. Everything else shares one roll and is picked by weight.
function rollEvent(ctx: EventContext, rng: RngState): { event: PendingEvent | null; rng: RngState } {
  const { scenario } = ctx
  const spe = nextRandom(rng)
  if (spe.value < scenario.speChancePerSol) {
    const variation = nextRandom(spe.next)
    return { event: SOLAR_PARTICLE_EVENT.build(ctx, variation.value), rng: variation.next }
  }

  const roll = nextRandom(spe.next)
  if (roll.value >= scenario.eventChancePerSol) return { event: null, rng: roll.next }

  const eligible = EVENTS.filter((e) => e.scenarios.includes(scenario.id) && (e.canHappen?.(ctx) ?? true))
  const pick = nextRandom(roll.next)
  if (eligible.length === 0) return { event: null, rng: pick.next }

  const total = eligible.reduce((sum, e) => sum + e.weight, 0)
  let target = pick.value * total
  let chosen = eligible[eligible.length - 1]
  for (const e of eligible) {
    target -= e.weight
    if (target < 0) {
      chosen = e
      break
    }
  }
  const variation = nextRandom(pick.next)
  return { event: chosen.build(ctx, variation.value), rng: variation.next }
}

function checkOutcome(
  scenario: Scenario,
  sol: number,
  res: ResourceLevels,
  crew: CrewMember[],
  science: number,
  lifeSupportFailed: boolean,
): Outcome {
  const lose = (reason: LossReason): Outcome => ({ status: 'lost', reason })
  if (lifeSupportFailed) return lose('power')
  if (res.oxygenKg <= 0) return lose('oxygen')
  if (res.waterL <= 0) return lose('water')
  if (res.foodKg <= 0) return lose('food')
  if (crew.some((m) => m.doseMSv > m.careerDoseLimitMSv)) return lose('radiation')
  if (science >= scenario.scienceTarget) return { status: 'won' }
  if (sol + 1 >= scenario.missionLengthSols) return lose('missionTimeout')
  return { status: 'playing' }
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}
