// Headless simulation: runs a scenario with a fixed decision policy and prints
// a sol-by-sol table.
//
//   node scripts/simulate.ts --scenario moon --policy balanced --seed 42
//   node scripts/simulate.ts --scenario mars --policy greedy --every 10
//
// Policies:
//   balanced  - keeps the base alive and does steady science (should win)
//   greedy    - everyone on EVA science, ignore upkeep, press on (should lose)
//   cautious  - safety work only, no science (should survive, then time out)

import { advanceSol } from '../src/sim/advanceSol.ts'
import { newGame } from '../src/sim/newGame.ts'
import { mars } from '../src/sim/scenarios/mars.ts'
import { moon } from '../src/sim/scenarios/moon.ts'
import type { CrewTask, Decisions, GameState } from '../src/sim/types.ts'

type Policy = (s: GameState) => Decisions

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

const POLICIES: Record<string, Policy> = { balanced, greedy, cautious }
const SCENARIOS = { moon, mars }

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const scenarioId = arg('scenario', 'moon') as keyof typeof SCENARIOS
const policyName = arg('policy', 'balanced')
const seed = Number(arg('seed', '42'))
const every = Number(arg('every', '1'))

const scenario = SCENARIOS[scenarioId]
const policy = POLICIES[policyName]
if (!scenario || !policy) {
  console.error(`Unknown scenario or policy. Scenarios: moon, mars. Policies: ${Object.keys(POLICIES).join(', ')}`)
  process.exit(1)
}

const cols: [string, number][] = [
  ['sol', 4], ['sky', 6], ['batt', 6], ['gen', 6], ['need', 6], ['O2', 6], ['water', 6], ['food', 6],
  ['cond', 5], ['maxDose', 8], ['sci', 5], ['hrs', 6], ['notes', 0],
]
const pad = (v: string | number, w: number) => String(v).padStart(w)
const header = cols.map(([n, w]) => (w ? pad(n, w) : n)).join(' ')

console.log(`\n${scenario.name} | policy: ${policyName} | seed: ${seed} | target: ${scenario.scienceTarget} science in ${scenario.missionLengthSols} sols\n`)
console.log(header)
console.log('-'.repeat(header.length + 20))

let state = newGame(scenario, seed)
while (state.outcome.status === 'playing') {
  const logStart = state.log.length
  state = advanceSol(state, policy(state))
  const r = state.lastReport!
  const newLog = state.log.slice(logStart).filter((e) => e.kind !== 'loadShed')
  const worst = state.crew.reduce((a, b) => (b.doseMSv > a.doseMSv ? b : a))
  const sky = !state.environment.isDaylight ? 'night' : state.environment.dustStormSolsLeft > 0 || newLog.some((e) => e.kind === 'dustStormEnd') ? 'storm' : 'day'
  const notes = [
    r.shedLoads.length ? `shed:${r.shedLoads.join('+')}` : '',
    ...newLog.map((e) => e.kind),
  ].filter(Boolean).join(' ')

  if (r.sol % every === 0 || notes || state.outcome.status !== 'playing') {
    const row: (string | number)[] = [
      r.sol, sky,
      state.resources.storedPowerKWh.toFixed(0), r.powerGeneratedKWh.toFixed(0), r.powerDemandKWh.toFixed(0),
      state.resources.oxygenKg.toFixed(0), state.resources.waterL.toFixed(0), state.resources.foodKg.toFixed(0),
      state.facilities.condition.toFixed(2), `${worst.doseMSv.toFixed(0)}`,
      state.sciencePoints, `${r.crewHoursWorked}/${r.crewHoursAvailable}`, notes,
    ]
    console.log(row.map((v, i) => (cols[i][1] ? pad(v, cols[i][1]) : v)).join(' '))
  }
}

const o = state.outcome
console.log(`\nRESULT: ${o.status === 'lost' ? `LOST (${o.reason})` : 'WON'} at sol ${state.sol - 1} | science ${state.sciencePoints}/${scenario.scienceTarget}`)
console.log(`Crew dose (mSv): ${state.crew.map((m) => `${m.name} ${m.doseMSv.toFixed(0)}`).join(', ')}`)
console.log(`Base: solar ${state.facilities.solarArrayM2} m², greenhouse ${state.facilities.greenhouseM2} m², shielding ${state.facilities.shieldingLevel}, ISRU ${state.facilities.isruUnits}\n`)
