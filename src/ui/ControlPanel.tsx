import { CircleCheck, Play, Power } from 'lucide-react'
import type { Dispatch, ReactNode } from 'react'
import { loadDemandKWh } from '../sim/advanceSol.ts'
import type { Decisions, GameState } from '../sim/types.ts'
import type { Action } from './gameReducer.ts'
import { POWER_LABELS } from './labels.ts'

interface Props {
  game: GameState
  decisions: Decisions
  dispatch: Dispatch<Action>
  highlightAdvance?: boolean
}

// What each system costs to run, and whether it is switched on.
export function PowerSwitches({ game, decisions, dispatch }: Omit<Props, 'highlightAdvance'>) {
  const demand = loadDemandKWh(game.scenario, game.facilities)
  const switches = (['lab', 'greenhouse', 'isru'] as const).filter((l) => l !== 'isru' || game.scenario.isruAvailable)

  return (
    <section aria-label="Power switches">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-300">
          <Power size={16} className="text-amber-300" aria-hidden /> Power switches
        </h2>
        <ul className="space-y-1.5 text-sm">
          <li className="flex items-center justify-between rounded-lg border border-slate-800 px-2.5 py-1.5 text-slate-400">
            <span>{POWER_LABELS.lifeSupport}</span>
            <span className="text-xs">always on · {Math.round(demand.lifeSupport)} kWh</span>
          </li>
          {switches.map((load) => {
            const on = decisions.power[load]
            return (
              <li key={load}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => dispatch({ type: 'togglePower', load })}
                  className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 transition active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 ${on ? 'border-teal-400/60 bg-teal-400/10' : 'border-slate-700 text-slate-400'}`}
                >
                  <span>{POWER_LABELS[load]}</span>
                  <span className="flex items-center gap-2 text-xs">
                    {Math.round(demand[load])} kWh
                    {/* a small toggle so on/off reads at a glance */}
                    <span className={`relative h-4 w-7 rounded-full ${on ? 'bg-teal-400' : 'bg-slate-600'}`}>
                      <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${on ? 'left-3.5' : 'left-0.5'}`} />
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {/* The order the sim actually sheds in (LOAD_PRIORITY in
            advanceSol), spelled out: on Mars it matters that the oxygen
            plant is the last thing to lose power, not the first. */}
        <p className="mt-1 text-[11px] text-slate-500">
          kWh per sol. If there isn't enough, the lab switches off first, then the greenhouse
          {game.scenario.isruAvailable ? '. The O₂ makers are the last to go.' : '.'}
        </p>
      </div>
    </section>
  )
}

// The one button the whole game turns on, so it is never somewhere the
// player has to go looking: pinned to the bottom of the screen on phones,
// and held at the foot of the status column on desktop. On a phone it also
// carries the section tabs, so the two live in one bar instead of two
// stacked fixtures that have to be kept in step.
export function AdvanceButton({ game, decisions, dispatch, highlightAdvance, tabs }: Props & { tabs?: ReactNode }) {
  const waitingForEvent = game.pendingEvent !== null && !decisions.eventChoiceId
  // Once an alert is answered its window closes, and nothing else on screen
  // says which answer was picked. It takes effect when the sol is played,
  // so it is shown here, beside the button that plays it, with a way to
  // change it -- a mis-tap on "ignore it, lose 30 kg O₂" should not be
  // silent or final.
  const answer = game.pendingEvent?.choices.find((ch) => ch.id === decisions.eventChoiceId)
  return (
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 p-3 lg:static lg:border-0 lg:bg-transparent lg:p-0">
        {tabs && <div className="mb-2 lg:hidden">{tabs}</div>}
        {answer && game.pendingEvent && (
          <div role="status" className="mb-2 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-950/40 px-3 py-2 text-xs">
            <CircleCheck size={15} className="shrink-0 text-amber-300" aria-hidden />
            <p className="min-w-0 flex-1 leading-snug text-slate-200">
              <span className="font-semibold text-amber-200">{game.pendingEvent.title}:</span> {answer.label}
            </p>
            <button
              type="button"
              onClick={() => dispatch({ type: 'reopenEvent' })}
              className="shrink-0 rounded-lg border border-amber-300/60 px-2.5 py-1 font-semibold text-amber-100 hover:bg-amber-300/10 transition active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              Change
            </button>
          </div>
        )}
        <button
          type="button"
          disabled={waitingForEvent}
          onClick={() => dispatch({ type: 'advance' })}
          className={`flex w-full items-center justify-center gap-3 rounded-2xl bg-yellow-300 px-6 py-4 text-lg font-bold text-slate-900 shadow-lg shadow-yellow-300/10 hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-40 transition active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:active:scale-100 ${highlightAdvance ? 'animate-pulse ring-4 ring-yellow-300/60' : ''}`}
        >
          {waitingForEvent ? (
            'Answer the alert first'
          ) : (
            <>
              <Play size={20} fill="currentColor" aria-hidden /> Advance sol {game.sol}
            </>
          )}
        </button>
        <p className="mt-1 hidden text-center text-[11px] text-slate-500 lg:block">or press Enter</p>
      </div>
  )
}
