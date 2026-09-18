// Headless simulation: runs a scenario with a fixed decision policy and prints
// a sol-by-sol table.
//
//   node scripts/simulate.ts --scenario moon --policy balanced --seed 42
//   node scripts/simulate.ts --scenario mars --policy greedy --every 10
//
// Policies are defined in scripts/policies.ts.

import { advanceSol } from '../src/sim/advanceSol.ts'
import { newGame } from '../src/sim/newGame.ts'
import { mars } from '../src/sim/scenarios/mars.ts'
import { moon } from '../src/sim/scenarios/moon.ts'
import { POLICIES } from './policies.ts'

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
