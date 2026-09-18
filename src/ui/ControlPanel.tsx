import { Play, Power } from 'lucide-react'
import type { Dispatch } from 'react'
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

// Power switches and the Advance button: the bottom of the right column.
export function ControlPanel({ game, decisions, dispatch, highlightAdvance }: Props) {
  const demand = loadDemandKWh(game.scenario, game.facilities)
  const switches = (['lab', 'greenhouse', 'isru'] as const).filter((l) => l !== 'isru' || game.scenario.isruAvailable)
  const waitingForEvent = game.pendingEvent !== null && !decisions.eventChoiceId

  return (
    <section aria-label="Power and advance" className="space-y-3">
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
                  className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 ${on ? 'border-teal-400/60 bg-teal-400/10' : 'border-slate-700 text-slate-400'}`}
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
        <p className="mt-1 text-[11px] text-slate-500">kWh per sol. If there isn't enough power, the lab switches off first.</p>
      </div>

      {/* On phones the button is pinned to the bottom of the screen so the
          player never has to scroll to reach it. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 p-3 lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <button
          type="button"
          disabled={waitingForEvent}
          onClick={() => dispatch({ type: 'advance' })}
          className={`flex w-full items-center justify-center gap-3 rounded-2xl bg-yellow-300 px-6 py-4 text-lg font-bold text-slate-900 shadow-lg shadow-yellow-300/10 hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-40 ${highlightAdvance ? 'animate-pulse ring-4 ring-yellow-300/60' : ''}`}
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
    </section>
  )
}
