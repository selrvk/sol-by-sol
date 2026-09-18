// Fixed decision policies used by the headless scripts. These stand in for a
// player; they are not game rules and must not be tuned to pass balance tests.
//
//   balanced  - keeps the base alive and does steady science (should win)
//   greedy    - everyone on EVA science, ignore upkeep, press on (should lose)
//   cautious  - safety work only, no science (should survive, then time out)

import type { CrewTask, Decisions, GameState } from '../src/sim/types.ts'

export type Policy = (s: GameState) => Decisions

const greedy: Policy = (s) => ({
  assignments: Object.fromEntries(s.crew.map((m) => [m.id, 'fieldScience' as CrewTask])),
  power: { lab: true, greenhouse: false, isru: false },
  eventChoiceId: 'pressOn',
})

const cautious: Policy = (s) => {
  const f = s.facilities
  const build: CrewTask =
    s.scenario.isruAvailable && f.isruUnits < 4 ? 'isru'
    : f.greenhouseM2 < 20 ? 'greenhouse'
    : f.shieldingLevel < 6 ? 'shielding'
    : 'rest'
  const tasks: CrewTask[] = ['maintenance', 'maintenance', build, 'rest']
  return {
    assignments: Object.fromEntries(s.crew.map((m, i) => [m.id, tasks[i]])),
    power: { lab: false, greenhouse: true, isru: true },
    eventChoiceId: 'shelter',
  }
}

const balanced: Policy = (s) => {
  const solsLeft = s.scenario.missionLengthSols - s.sol
  const perSol = s.scenario.hoursPerSol / 24
  const o2Need = 0.9 * 4 * perSol * solsLeft
  const foodNeed = 1.83 * 4 * perSol * solsLeft

  // Lowest-dose crew first: they get the EVA work.
  const byDose = [...s.crew].sort((a, b) => a.doseMSv - b.doseMSv)
  const jobs: CrewTask[] = []
  if (s.facilities.condition < 0.95) jobs.push('maintenance')
  if (s.facilities.condition < 0.8) jobs.push('maintenance')
  if (s.scenario.isruAvailable && s.facilities.isruUnits < 3 && s.resources.oxygenKg < o2Need) jobs.push('isru')
  if (s.resources.foodKg < foodNeed && s.facilities.greenhouseM2 < 16) jobs.push('greenhouse')
  if (s.facilities.shieldingLevel < 3) jobs.push('shielding')

  const assignments: Record<string, CrewTask> = {}
  byDose.forEach((m, i) => {
    const headroom = m.careerDoseLimitMSv - m.doseMSv
    if (i < jobs.length) assignments[m.id] = jobs[i]
    else assignments[m.id] = headroom > 100 ? 'fieldScience' : 'labScience'
  })
  return {
    assignments,
    power: { lab: true, greenhouse: true, isru: true },
    eventChoiceId: 'shelter',
  }
}

export const POLICIES: Record<string, Policy> = { balanced, greedy, cautious }
