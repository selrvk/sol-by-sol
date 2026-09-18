// Fixed decision policies used by the headless scripts. These stand in for a
// player; they are not game rules and must not be tuned to pass balance tests.
//
// Each losing policy makes one kind of mistake, so each loss condition has
// a policy that proves it can happen.
//
//   balanced  - keeps the base alive and does steady science (should win)
//   greedy    - everyone on EVA science, no upkeep, press on (dies: water)
//   reckless  - does upkeep but ignores radiation: no shielding, EVA science
//               whatever the dose, press on through flares (Moon: radiation)
//   cautious  - safety work first, lab science with leftover crew
//               (survives with a low score)
//   rota-*    - the same tasks every sol, no thinking (should not win)

import { BALANCE } from '../src/sim/balance.ts'
import { c } from '../src/sim/constants.ts'
import type { CrewTask, Decisions, GameState } from '../src/sim/types.ts'

export type Policy = (s: GameState) => Decisions

const ALL_ON = { lab: true, greenhouse: true, isru: true }

// What a sensible player would notice: will the base survive the worst sol
// for power (lunar night, or a dust storm)?
function needsMorePower(s: GameState): boolean {
  const sc = s.scenario
  const f = s.facilities
  const worstSolar = sc.dayNightCycle ? 0 : sc.dustStorm.solarFactor
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
  if (s.scenario.isruAvailable && f.isruUnits < 3 && o2Short) jobs.push('isru')
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
  power: ALL_ON,
  eventChoiceId: 'shelter',
})

const greedy: Policy = (s) => ({
  assignments: Object.fromEntries(s.crew.map((m) => [m.id, 'fieldScience' as CrewTask])),
  power: { lab: true, greenhouse: false, isru: false },
  eventChoiceId: 'pressOn',
})

const reckless: Policy = (s) => ({
  assignments: assign(s, upkeepJobs(s, { shielding: false }), () => 'fieldScience'),
  power: ALL_ON,
  eventChoiceId: 'pressOn',
})

const cautious: Policy = (s) => {
  const f = s.facilities
  const jobs = upkeepJobs(s, { shielding: true })
  // Then over-build "just in case".
  if (s.scenario.isruAvailable && f.isruUnits < 4) jobs.push('isru')
  if (f.greenhouseM2 < 20) jobs.push('greenhouse')
  if (f.shieldingLevel < BALANCE.MAX_SHIELDING_LEVEL) jobs.push('shielding')
  return {
    assignments: assign(s, jobs, () => 'labScience'),
    power: ALL_ON,
    eventChoiceId: 'shelter',
  }
}

const rota = (tasks: CrewTask[]): Policy => (s) => ({
  assignments: Object.fromEntries(s.crew.map((m, i) => [m.id, tasks[i]])),
  power: ALL_ON,
  eventChoiceId: 'shelter',
})

export const POLICIES: Record<string, Policy> = {
  balanced,
  greedy,
  reckless,
  cautious,
  'rota-1m3f': rota(['maintenance', 'fieldScience', 'fieldScience', 'fieldScience']),
  'rota-2m2f': rota(['maintenance', 'maintenance', 'fieldScience', 'fieldScience']),
}
