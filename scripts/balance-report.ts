// Runs every policy on both scenarios across many seeds, summarises the
// outcomes, and checks each against what it is expected to do
// (scripts/expectations.ts). Exits non-zero if any expectation fails, so a
// change to balance.ts or a scenario config that quietly alters a lesson
// does not go unnoticed.
//
//   node scripts/balance-report.ts            (100 seeds, as the test runs it)
//   node scripts/balance-report.ts --seeds 1000

import { checkAll, SEEDS as DEFAULT_SEEDS } from './expectations.ts'

const i = process.argv.indexOf('--seeds')
const SEEDS = i >= 0 ? Number(process.argv[i + 1]) : DEFAULT_SEEDS

const median = (xs: number[]) => {
  if (xs.length === 0) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

const { rows, failures } = checkAll(SEEDS)

console.log(`\n${SEEDS} seeds per row. "ended" = sol the game ended (median, min-max).\n`)
console.log('scenario  policy     won   ended (med, range)   science (med)   check  outcomes')
console.log('-'.repeat(108))

for (const { scenario, policy, outcomes, failed } of rows) {
  const { games, won } = outcomes
  const target = games[0].scenario.scienceTarget
  const ended = games.map((s) => s.sol - 1)
  const counts = new Map<string, number>()
  for (const s of games) {
    const key = s.outcome.status === 'lost' ? s.outcome.reason : s.outcome.status
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const summary = [...counts].map(([k, v]) => `${k} ${v}`).join(', ')
  console.log(
    `${scenario.padEnd(9)} ${policy.padEnd(10)} ${String(won).padStart(3)}   ` +
      `${String(median(ended)).padStart(4)} (${Math.min(...ended)}-${Math.max(...ended)})`.padEnd(21) +
      `${String(median(games.map((s) => s.sciencePoints))).padStart(4)}/${target}`.padEnd(16) +
      (failed.length ? 'FAIL' : 'ok').padEnd(7) +
      summary,
  )
}

if (failures.length) {
  console.log(`\n${failures.length} expectation${failures.length === 1 ? '' : 's'} failed:`)
  for (const f of failures) console.log(`  - ${f}`)
  console.log('\nIf this change is on purpose, update scripts/expectations.ts and the policy notes in scripts/policies.ts.\n')
  process.exitCode = 1
} else {
  console.log('\nEvery policy did what it is expected to, and every loss is reachable.\n')
}
