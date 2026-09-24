// Looks for a lazy way to win: every fixed crew plan, kept all game, on
// both worlds. A fixed plan is four tasks that never change (with the
// careful player's power switches and alert answers), optionally after an
// opening that fixes the briefing's crisis first. If one of these wins
// about as often as the careful player, the world has lost its trade-off.
// The results as of the last balance change are in scripts/policies.ts.
//
//   node scripts/fixed-plans.ts             (100 seeds each)
//   node scripts/fixed-plans.ts --seeds 200

import { c } from '../src/sim/constants.ts'
import type { CrewTask, GameState, Scenario } from '../src/sim/types.ts'
import { outcomes, SCENARIOS } from './expectations.ts'
import { POLICIES, type Policy } from './policies.ts'

const i = process.argv.indexOf('--seeds')
const SEEDS = i >= 0 ? Number(process.argv[i + 1]) : 100

const LETTER: Partial<Record<CrewTask, string>> = {
  maintenance: 'M',
  fieldScience: 'F',
  labScience: 'L',
  greenhouse: 'G',
  isru: 'O',
  solar: 'S',
}

// Every way to fill four jobs from these tasks, ignoring order.
function mixes(tasks: CrewTask[]): CrewTask[][] {
  const out: CrewTask[][] = []
  const pick = (from: number, plan: CrewTask[]) => {
    if (plan.length === 4) return void out.push(plan)
    for (let k = from; k < tasks.length; k++) pick(k, [...plan, tasks[k]])
  }
  pick(0, [])
  return out
}

// The briefing's fix, done first: repairs on the Moon, O₂ makers on Mars.
function openingNeeded(s: GameState): boolean {
  if (s.scenario.isruAvailable) {
    const breathed = c('CREW_O2_KG_PER_DAY') * s.crew.length * (s.scenario.hoursPerSol / 24)
    return s.facilities.isruUnits < breathed
  }
  return s.facilities.condition < 0.95 && s.sol < 60
}

function fixedPlan(plan: CrewTask[], opening: boolean): Policy {
  return (s) => {
    const fix: CrewTask = s.scenario.isruAvailable ? 'isru' : 'maintenance'
    const today = opening && openingNeeded(s) ? [fix, fix, ...plan.slice(2)] : plan
    return {
      assignments: Object.fromEntries(s.crew.map((m, k) => [m.id, today[k]])),
      power: POLICIES.balanced(s).power,
      eventChoiceId: s.pendingEvent?.defaultChoiceId,
    }
  }
}

function search(scenario: Scenario) {
  const tasks: CrewTask[] = ['maintenance', 'fieldScience', 'labScience', 'greenhouse']
  if (scenario.isruAvailable) tasks.push('isru', 'solar')
  const results: { name: string; won: number }[] = []
  for (const plan of mixes(tasks)) {
    for (const opening of [false, true]) {
      const name = (opening ? 'fix first, then ' : '') + plan.map((t) => LETTER[t]).join('')
      results.push({ name, won: outcomes(scenario, fixedPlan(plan, opening), SEEDS).won })
    }
  }
  results.sort((a, b) => b.won - a.won)
  const careful = outcomes(scenario, POLICIES.balanced, SEEDS).won
  const pct = (n: number) => `${Math.round((100 * n) / SEEDS)}%`
  console.log(`\n${scenario.name}: ${results.length} fixed plans, ${SEEDS} games each. Careful bot: ${pct(careful)}`)
  for (const r of results.slice(0, 5)) console.log(`  ${pct(r.won).padStart(4)}  ${r.name}`)
}

console.log('M maintenance, F field science, L lab science, G greenhouse, O O₂ maker, S solar')
for (const scenario of SCENARIOS) search(scenario)
