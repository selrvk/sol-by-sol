// Fixed decision policies used by the headless scripts. These stand in for a
// player; they are not game rules and must not be tuned to pass balance tests.
//
// Each losing policy makes one kind of mistake, so each loss condition has
// a policy that proves it can happen. What each one does on each world is
// checked, not just described: see scripts/expectations.ts. Change an
// outcome here and there together.
//
//   balanced  - keeps the base alive and does steady science. Wins.
//   greedy    - everyone on EVA science, no upkeep, press on.
//               Moon: out of water. Mars: out of oxygen, now and then
//               power when a dust storm hits the array.
//   reckless  - does upkeep but ignores radiation: no shielding, EVA science
//               whatever the dose, press on through flares.
//               Moon: often a radiation loss. Mars: wins -- the surface
//               dose is half the Moon's and the air shields flares.
//   power-hog - plays like balanced but never switches anything off.
//               Moon: out of power in the lunar night. Mars: wins, as
//               there is no night to ration for.
//   cautious  - safety work first, lab science with leftover crew.
//               Survives to the end with a low score: the clock runs out.
//   rota-2m2f - two on maintenance, two on field science, every sol, never
//               builds. Moon: out of food just before the end. Mars:
//               out of oxygen.
//   rota-1m3f - one on maintenance, three on field science, every sol,
//               never builds. Mars: out of oxygen.
//               Moon: WINS, as reliably and as early as balanced. This is
//               a known gap, not a goal. It used to starve, until the
//               mid-mission opening (283cd92) gave the base a greenhouse
//               and cargo started covering the food. Under the sourced
//               physics nothing else you can build on the Moon pays back
//               -- the greenhouse costs 10.5 kWh per m² per sol, cosmic
//               rays barely notice shielding, panels are dark half the
//               time -- so after the opening the Moon's crew decision comes
//               down to maintenance vs science, and a fixed plan that gets
//               that right does as well as an adaptive one. No single
//               balance number separates the two without a cliff (starting
//               food 230 kg: both win; 220: only balanced; 210: neither).
//               It is not brainless: its power switches are the careful
//               player's, and left all on it dies in the night.

import { BALANCE } from '../src/sim/balance.ts'
import { c } from '../src/sim/constants.ts'
import type { CrewTask, Decisions, GameState } from '../src/sim/types.ts'

export type Policy = (s: GameState) => Decisions

const ALL_ON = { lab: true, greenhouse: true, isru: true }

// Events list the careful choice first (the default) and the corner-cutting
// one last.
const careful = (s: GameState) => s.pendingEvent?.defaultChoiceId
const cutCorners = (s: GameState) => s.pendingEvent?.choices.at(-1)?.id

function loadKWh(s: GameState) {
  const sc = s.scenario
  const f = s.facilities
  const solDays = sc.hoursPerSol / 24
  return {
    lifeSupport: c('LIFE_SUPPORT_KW') * sc.hoursPerSol,
    isru: sc.isruAvailable ? f.isruUnits * BALANCE.ISRU_KG_O2_PER_UNIT_PER_SOL * c('MOXIE_KWH_PER_KG_O2') : 0,
    greenhouse: f.greenhouseM2 * c('GREENHOUSE_YIELD_KG_M2_PER_DAY') * solDays * c('GREENHOUSE_KWH_PER_KG_FOOD'),
    lab: BALANCE.LAB_KW * sc.hoursPerSol,
  }
}

// A sensible player's power switches: keep enough battery in reserve to run
// life support through the rest of the night or dust storm, and only switch
// on optional loads (most important first) if there is power to spare.
function rationPower(s: GameState): Decisions['power'] {
  const sc = s.scenario
  const f = s.facilities
  const loads = loadKWh(s)
  const cycle = sc.dayNightCycle
  const pos = cycle ? s.sol % (cycle.daySols + cycle.nightSols) : 0
  const night = cycle ? pos >= cycle.daySols : false
  const storm = s.environment.dustStormSolsLeft > 0
  const solarFactor = night ? 0 : storm ? sc.dustStorm.solarFactor : 1
  const genKWh =
    f.solarArrayM2 * sc.solarKWhPerM2PerSol * c('SOLAR_PANEL_EFFICIENCY') * f.condition * solarFactor +
    f.reactorKW * sc.hoursPerSol
  const hardSolsLeft = night ? cycle!.daySols + cycle!.nightSols - pos : storm ? s.environment.dustStormSolsLeft : 0
  const reserve = Math.max(0, loads.lifeSupport - genKWh) * hardSolsLeft
  let spare = s.resources.storedPowerKWh + genKWh - loads.lifeSupport - reserve
  const on = { isru: false, greenhouse: false, lab: false }
  for (const load of ['isru', 'greenhouse', 'lab'] as const) {
    if (loads[load] <= spare) {
      on[load] = true
      spare -= loads[load]
    }
  }
  return on
}

// What a sensible player would notice: will the base survive the worst sol
// for power (lunar night, or a dust storm)?
function needsMorePower(s: GameState): boolean {
  const sc = s.scenario
  const f = s.facilities
  // Panels can't help at night; only rationing the battery can.
  if (sc.dayNightCycle) return false
  const worstSolar = sc.dustStorm.solarFactor
  const worstKWh =
    f.solarArrayM2 * sc.solarKWhPerM2PerSol * c('SOLAR_PANEL_EFFICIENCY') * worstSolar + f.reactorKW * sc.hoursPerSol
  // Life support, plus oxygen production where the base depends on it.
  const essentialKWh =
    c('LIFE_SUPPORT_KW') * sc.hoursPerSol +
    (sc.isruAvailable ? f.isruUnits * BALANCE.ISRU_KG_O2_PER_UNIT_PER_SOL * c('MOXIE_KWH_PER_KG_O2') : 0)
  return worstKWh < essentialKWh * 1.1 && f.solarArrayM2 < sc.maxSolarArrayM2
}

function supplyNeeds(s: GameState) {
  const solsLeft = s.scenario.missionLengthSols - s.sol
  const days = (s.scenario.hoursPerSol / 24) * solsLeft * s.crew.length
  return {
    o2Short: s.resources.oxygenKg < c('CREW_O2_KG_PER_DAY') * days,
    foodShort: s.resources.foodKg < c('CREW_FOOD_KG_PER_DAY') * days,
  }
}

// Shared "keep the base alive" job list, most urgent first.
function upkeepJobs(s: GameState, opts: { shielding: boolean }): CrewTask[] {
  const f = s.facilities
  const { o2Short, foodShort } = supplyNeeds(s)
  const jobs: CrewTask[] = []
  if (f.condition < 0.95) jobs.push('maintenance')
  if (f.condition < 0.8) jobs.push('maintenance')
  if (needsMorePower(s)) jobs.push('solar')
  // Build O₂ makers until they cover what the crew breathes.
  const o2Made = f.isruUnits * BALANCE.ISRU_KG_O2_PER_UNIT_PER_SOL
  const o2Breathed = c('CREW_O2_KG_PER_DAY') * s.crew.length * (s.scenario.hoursPerSol / 24)
  if (s.scenario.isruAvailable && (o2Made < o2Breathed || (o2Short && f.isruUnits < 6))) jobs.push('isru')
  if (foodShort && f.greenhouseM2 < 16) jobs.push('greenhouse')
  if (opts.shielding && f.shieldingLevel < 3) jobs.push('shielding')
  return jobs
}

// Hand out jobs lowest-dose crew first (they get the EVA work), then fill
// the rest with `leftover(member)`.
function assign(s: GameState, jobs: CrewTask[], leftover: (headroom: number) => CrewTask) {
  const byDose = [...s.crew].sort((a, b) => a.doseMSv - b.doseMSv)
  const assignments: Record<string, CrewTask> = {}
  byDose.forEach((m, i) => {
    assignments[m.id] = i < jobs.length ? jobs[i] : leftover(m.careerDoseLimitMSv - m.doseMSv)
  })
  return assignments
}

const balanced: Policy = (s) => ({
  assignments: assign(s, upkeepJobs(s, { shielding: true }), (headroom) =>
    headroom > 100 ? 'fieldScience' : 'labScience',
  ),
  power: rationPower(s),
  eventChoiceId: careful(s),
})

const greedy: Policy = (s) => ({
  assignments: Object.fromEntries(s.crew.map((m) => [m.id, 'fieldScience' as CrewTask])),
  power: rationPower(s),
  eventChoiceId: cutCorners(s),
})

const powerHog: Policy = (s) => ({ ...balanced(s), power: ALL_ON })

const reckless: Policy = (s) => ({
  assignments: assign(s, upkeepJobs(s, { shielding: false }), () => 'fieldScience'),
  power: rationPower(s),
  eventChoiceId: cutCorners(s),
})

const cautious: Policy = (s) => {
  const f = s.facilities
  // Keeps the base in top repair before anything else.
  const jobs: CrewTask[] = []
  if (f.condition < 0.98) jobs.push('maintenance')
  if (f.condition < 0.9) jobs.push('maintenance')
  jobs.push(...upkeepJobs(s, { shielding: true }).filter((j) => j !== 'maintenance'))
  // Then over-build "just in case".
  if (s.scenario.isruAvailable && f.isruUnits < 4) jobs.push('isru')
  if (f.greenhouseM2 < 20) jobs.push('greenhouse')
  if (f.shieldingLevel < BALANCE.MAX_SHIELDING_LEVEL) jobs.push('shielding')
  return {
    assignments: assign(s, jobs, () => 'labScience'),
    power: rationPower(s),
    eventChoiceId: careful(s),
  }
}

const rota = (tasks: CrewTask[]): Policy => (s) => ({
  assignments: Object.fromEntries(s.crew.map((m, i) => [m.id, tasks[i]])),
  power: rationPower(s),
  eventChoiceId: careful(s),
})

export const POLICIES: Record<string, Policy> = {
  balanced,
  greedy,
  reckless,
  'power-hog': powerHog,
  cautious,
  'rota-1m3f': rota(['maintenance', 'fieldScience', 'fieldScience', 'fieldScience']),
  'rota-2m2f': rota(['maintenance', 'maintenance', 'fieldScience', 'fieldScience']),
}
