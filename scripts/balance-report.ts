// Runs every policy on both scenarios across many seeds and summarises the
// outcomes. Use this to check balance after changing balance.ts or a
// scenario config.
//
//   node scripts/balance-report.ts            (20 seeds)
//   node scripts/balance-report.ts --seeds 50

import { advanceSol } from '../src/sim/advanceSol.ts'
import { newGame } from '../src/sim/newGame.ts'
import { mars } from '../src/sim/scenarios/mars.ts'
import { moon } from '../src/sim/scenarios/moon.ts'
import type { GameState, Scenario } from '../src/sim/types.ts'
import { POLICIES, type Policy } from './policies.ts'

const i = process.argv.indexOf('--seeds')
const SEEDS = i >= 0 ? Number(process.argv[i + 1]) : 20

function run(scenario: Scenario, policy: Policy, seed: number): GameState {
  let state = newGame(scenario, seed)
  while (state.outcome.status === 'playing') state = advanceSol(state, policy(state))
  return state
}

const median = (xs: number[]) => {
  if (xs.length === 0) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

console.log(`\n${SEEDS} seeds per row. "ended" = sol the game ended (median, min-max).\n`)
console.log('scenario  policy     won   ended (med, range)   science (med)   outcomes')
console.log('-'.repeat(100))

for (const scenario of [moon, mars]) {
  for (const [name, policy] of Object.entries(POLICIES)) {
    const results = Array.from({ length: SEEDS }, (_, k) => run(scenario, policy, k + 1))
    const ended = results.map((s) => s.sol - 1)
    const wins = results.filter((s) => s.outcome.status === 'won').length
    const counts = new Map<string, number>()
    for (const s of results) {
      const key = s.outcome.status === 'lost' ? s.outcome.reason : s.outcome.status
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const outcomes = [...counts].map(([k, v]) => `${k} ${v}`).join(', ')
    console.log(
      `${scenario.id.padEnd(9)} ${name.padEnd(10)} ${String(wins).padStart(3)}   ` +
        `${String(median(ended)).padStart(4)} (${Math.min(...ended)}-${Math.max(...ended)})`.padEnd(21) +
        `${String(median(results.map((s) => s.sciencePoints))).padStart(4)}/${scenario.scienceTarget}`.padEnd(16) +
        outcomes,
    )
  }
}
console.log()
