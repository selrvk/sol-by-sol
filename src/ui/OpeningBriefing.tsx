import { TriangleAlert } from 'lucide-react'
import type { Decisions, GameState } from '../sim/types.ts'
import { OPENINGS } from './labels.ts'

// The first-90-seconds guide. One problem, one fix, shown in place: no
// tutorial to read. It disappears once the player has seen the fix work.
export function OpeningBriefing({ game, decisions, onDismiss }: { game: GameState; decisions: Decisions; onDismiss: () => void }) {
  const opening = OPENINGS[game.scenario.id]
  const fixed = Object.values(decisions.assignments).includes(opening.fixTask)
  const firstSol = game.sol === game.scenario.start.sol

  if (!firstSol && fixed) {
    return (
      <div role="status" className="flex flex-wrap items-start gap-3 rounded-xl border border-emerald-400/60 bg-emerald-950/40 p-3 text-sm">
        <p className="flex-1">
          <span className="font-semibold text-emerald-300">That's the loop: plan, advance, watch what changes. </span>
          {opening.afterFix}
        </p>
        <button type="button" onClick={onDismiss} className="rounded-lg bg-emerald-300 px-3 py-1.5 font-semibold text-slate-900 hover:bg-emerald-200">
          Got it
        </button>
      </div>
    )
  }

  return (
    <div role="status" className="flex gap-3 rounded-2xl border border-yellow-300/70 bg-yellow-950/40 p-3 text-sm">
      <TriangleAlert size={28} className="mt-0.5 shrink-0 text-yellow-300" aria-hidden />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-300">Mission briefing</p>
        <p className="text-base font-bold text-yellow-100">{opening.title}</p>
        <p className="mt-1 text-slate-200">{opening.problem}</p>
        <p className="mt-1 font-semibold text-yellow-100">
          {fixed ? 'Good. Now press Advance sol ▶ and see what happens.' : opening.fix}
        </p>
      </div>
    </div>
  )
}
