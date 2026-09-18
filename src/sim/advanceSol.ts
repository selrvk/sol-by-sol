import { BALANCE } from './balance.ts'
import { c } from './constants.ts'
import { EVENTS } from './events.ts'
import { nextRandom } from './rng.ts'
import type {
  CrewMember,
  CrewTask,
  Decisions,
  Environment,
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

const EVA_TASKS: ReadonlySet<CrewTask> = new Set(['fieldScience', 'solar', 'shielding', 'isru'])

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
  const solDays = scenario.hoursPerSol / 24
  const log: GameEvent[] = []
  let rng = state.rng

  const res: ResourceLevels = { ...state.resources }
  const crew: CrewMember[] = state.crew.map((m) => ({ ...m }))
  const fac: Facilities = { ...state.facilities }
  const env: Environment = { ...state.environment }
  let science = state.sciencePoints

  // 0. Resolve pending event
  if (state.pendingEvent) {
    const event = state.pendingEvent
    const choice =
      event.choices.find((ch) => ch.id === decisions.eventChoiceId) ??
      event.choices.find((ch) => ch.id === event.defaultChoiceId)!
    const o = choice.outcome
    if (o.resources) {
      for (const key of Object.keys(o.resources) as (keyof ResourceLevels)[]) {
        res[key] += o.resources[key] ?? 0
      }
    }
    if (o.crewDoseMSv) for (const m of crew) m.doseMSv += o.crewDoseMSv
    if (o.sciencePoints) science += o.sciencePoints
    if (o.shelterSols) env.shelterSolsLeft = Math.max(env.shelterSolsLeft, o.shelterSols)
    log.push({ sol, kind: 'eventResolved', message: `${event.title}: ${o.message}` })
  }
  const sheltering = env.shelterSolsLeft > 0
  const taskFor = (m: CrewMember): CrewTask =>
    sheltering || m.status !== 'active' ? 'rest' : (decisions.assignments[m.id] ?? 'rest')

  // 1. Crew consumption (everyone breathes, eats and drinks)
  const waterUsed = c('CREW_WATER_L_PER_DAY') * crew.length * solDays
  res.oxygenKg -= c('CREW_O2_KG_PER_DAY') * crew.length * solDays
  res.waterL -= waterUsed
  res.foodKg -= c('CREW_FOOD_KG_PER_DAY') * crew.length * solDays

  // 2. Power generation
  const daylight = isDaylight(scenario, sol)
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

  const solarKWh =
    fac.solarArrayM2 *
    scenario.solarKWhPerM2PerSol *
    c('SOLAR_PANEL_EFFICIENCY') *
    fac.condition *
    (daylight ? 1 : 0) *
    (storm ? scenario.dustStorm.solarFactor : 1)
  const reactorKWh = fac.reactorKW * scenario.hoursPerSol
  const generated = solarKWh + reactorKWh

  // 3. Power draw. Life support first, then optional loads in priority order.
  const demand: Record<PowerLoad, number> = {
    lifeSupport: c('LIFE_SUPPORT_KW') * scenario.hoursPerSol,
    isru: scenario.isruAvailable && decisions.power.isru
      ? fac.isruUnits * BALANCE.ISRU_KG_O2_PER_UNIT_PER_SOL * c('MOXIE_KWH_PER_KG_O2')
      : 0,
    greenhouse: decisions.power.greenhouse
      ? fac.greenhouseM2 * c('GREENHOUSE_YIELD_KG_M2_PER_DAY') * solDays * c('GREENHOUSE_KWH_PER_KG_FOOD')
      : 0,
    lab: decisions.power.lab ? BALANCE.LAB_KW * scenario.hoursPerSol : 0,
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
  for (const load of ['isru', 'greenhouse', 'lab'] as const) {
    if (demand[load] === 0) continue
    if (demand[load] <= available) {
      available -= demand[load]
      powered.add(load)
    } else {
      shed.push(load)
    }
  }
  if (shed.length > 0) {
    log.push({ sol, kind: 'loadShed', message: `Not enough power. Switched off: ${shed.join(', ')}.` })
  }
  res.storedPowerKWh = Math.min(fac.batteryCapacityKWh, available)

  // 4. Production
  res.waterL += waterUsed * c('WATER_RECOVERY_FRACTION') * fac.condition
  if (powered.has('greenhouse')) {
    res.foodKg += fac.greenhouseM2 * c('GREENHOUSE_YIELD_KG_M2_PER_DAY') * solDays
  }
  if (powered.has('isru')) {
    res.oxygenKg += fac.isruUnits * BALANCE.ISRU_KG_O2_PER_UNIT_PER_SOL
  }

  // 5. Radiation. EVA hours take the full surface dose; indoor hours are
  // reduced by the habitat and any regolith shielding.
  const shieldTransmission = Math.max(
    c('SHIELDING_MIN_TRANSMISSION'),
    1 - c('SHIELDING_REDUCTION_PER_LEVEL') * fac.shieldingLevel,
  )
  const indoorTransmission = c('HABITAT_DOSE_TRANSMISSION') * shieldTransmission
  for (const m of crew) {
    const evaFraction = EVA_TASKS.has(taskFor(m)) ? BALANCE.SHIFT_HOURS / scenario.hoursPerSol : 0
    m.doseMSv +=
      scenario.surfaceDoseMSvPerSol * (evaFraction + (1 - evaFraction) * indoorTransmission)
  }

  // 6. Crew tasks
  const activeCrew = crew.filter((m) => m.status === 'active')
  let shiftsWorked = 0
  let scienceEarned = 0
  let maintenanceShifts = 0
  for (const m of activeCrew) {
    const task = taskFor(m)
    if (task !== 'rest') shiftsWorked++
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

  // Everything you build wears out, so building costs future crew time.
  const wear =
    BALANCE.WEAR_BASE_PER_SOL +
    BALANCE.WEAR_PER_SOLAR_M2 * fac.solarArrayM2 +
    BALANCE.WEAR_PER_GREENHOUSE_M2 * fac.greenhouseM2 +
    BALANCE.WEAR_PER_ISRU_UNIT * fac.isruUnits
  fac.condition = clamp01(fac.condition - wear + BALANCE.MAINTENANCE_PER_SHIFT * maintenanceShifts)

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
  const rolled = rollEvent(scenario, rng)
  rng = rolled.rng
  if (rolled.event) {
    pendingEvent = rolled.event
    log.push({ sol, kind: 'eventStart', message: `${rolled.event.title}: ${rolled.event.description}` })
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
      crewHoursAvailable: activeCrew.length * BALANCE.SHIFT_HOURS,
      crewHoursWorked: shiftsWorked * BALANCE.SHIFT_HOURS,
      scienceEarned,
    },
    outcome,
  }
}

function isDaylight(scenario: Scenario, sol: number): boolean {
  const cycle = scenario.dayNightCycle
  if (!cycle) return true
  return sol % (cycle.daySols + cycle.nightSols) < cycle.daySols
}

function rollEvent(scenario: Scenario, rng: RngState): { event: PendingEvent | null; rng: RngState } {
  const roll = nextRandom(rng)
  if (roll.value >= scenario.eventChancePerSol) return { event: null, rng: roll.next }

  const eligible = EVENTS.filter((e) => e.scenarios.includes(scenario.id))
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
  const { id, title, description, choices, defaultChoiceId } = chosen
  return { event: { id, title, description, choices, defaultChoiceId }, rng: pick.next }
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
