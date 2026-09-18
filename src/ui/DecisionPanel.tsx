import type { Dispatch } from 'react'
import { EVA_TASKS, loadDemandKWh } from '../sim/advanceSol.ts'
import type { CrewTask, Decisions, GameState } from '../sim/types.ts'
import type { Action } from './gameReducer.ts'
import { POWER_LABELS, TASK_LABELS } from './labels.ts'

interface Props {
  game: GameState
  decisions: Decisions
  dispatch: Dispatch<Action>
  highlightTask?: CrewTask // pulse this task's buttons (opening guide)
  highlightAdvance?: boolean
}

export function DecisionPanel({ game, decisions, dispatch, highlightTask, highlightAdvance }: Props) {
  const tasks = (Object.keys(TASK_LABELS) as CrewTask[]).filter(
    (t) => t !== 'isru' || game.scenario.isruAvailable,
  )
  const demand = loadDemandKWh(game.scenario, game.facilities)
  const switches = (['lab', 'greenhouse', 'isru'] as const).filter((l) => l !== 'isru' || game.scenario.isruAvailable)
  const sheltering = game.environment.shelterSolsLeft > 0
  const repairShifts = game.environment.busyShifts + game.environment.busyEvaShifts
  const waitingForEvent = game.pendingEvent !== null && !decisions.eventChoiceId

  return (
    <section aria-label="Decisions" className="grid gap-4 lg:grid-cols-[1fr_auto]">
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Crew assignments {sheltering && <span className="normal-case text-amber-300">(sheltering: no work this sol)</span>}
          {!sheltering && repairShifts > 0 && (
            <span className="normal-case text-amber-300">
              {' '}(🔧 {repairShifts} shift{repairShifts > 1 ? 's' : ''} owed to repairs{game.environment.busyEvaShifts > 0 ? ', some outside' : ''}: taken from science first)
            </span>
          )}
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {game.crew.map((m) => {
            const task = decisions.assignments[m.id] ?? 'rest'
            const doseFrac = m.doseMSv / m.careerDoseLimitMSv
            return (
              <div key={m.id} className="rounded-lg border border-slate-700 bg-slate-900/60 p-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    <span className="font-semibold">{m.name}</span>{' '}
                    <span className="text-slate-400 capitalize">{m.role}</span>
                  </span>
                  <span className={`text-xs tabular-nums ${doseFrac > 0.85 ? 'text-red-300' : doseFrac > 0.7 ? 'text-amber-300' : 'text-slate-400'}`}>
                    ☢️ {Math.round(m.doseMSv)}/{m.careerDoseLimitMSv} mSv
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded bg-slate-700">
                  <div className={`h-full ${doseFrac > 0.85 ? 'bg-red-500' : doseFrac > 0.7 ? 'bg-amber-400' : 'bg-slate-400'}`} style={{ width: `${Math.min(1, doseFrac) * 100}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label={`Task for ${m.name}`}>
                  {tasks.map((t) => (
                    <button
                      key={t}
                      type="button"
                      title={`${TASK_LABELS[t].label}: ${TASK_LABELS[t].hint}`}
                      aria-pressed={task === t}
                      onClick={() => dispatch({ type: 'assign', crewId: m.id, task: t })}
                      className={`rounded-md border px-2 py-1 text-base leading-none ${task === t ? 'border-yellow-300 bg-yellow-300/20' : 'border-slate-700 hover:border-slate-500'} ${highlightTask === t && task !== t ? 'animate-pulse ring-2 ring-yellow-300' : ''}`}
                    >
                      <span aria-hidden>{TASK_LABELS[t].icon}</span>
                      <span className="sr-only">{TASK_LABELS[t].label}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-slate-300">
                  {TASK_LABELS[task].label}
                  {EVA_TASKS.has(task) && <span className="ml-1 rounded bg-orange-500/20 px-1 text-orange-300">EVA: extra radiation</span>}
                  <span className="block text-slate-500">{TASK_LABELS[task].hint}</span>
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:w-64">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Power switches</h2>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center justify-between rounded-md border border-slate-800 px-2.5 py-1.5 text-slate-400">
              <span>{POWER_LABELS.lifeSupport}</span>
              <span className="text-xs">always on · {Math.round(demand.lifeSupport)} kWh</span>
            </li>
            {switches.map((load) => (
              <li key={load}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={decisions.power[load]}
                  onClick={() => dispatch({ type: 'togglePower', load })}
                  className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 ${decisions.power[load] ? 'border-teal-400/60 bg-teal-400/10' : 'border-slate-700 text-slate-400'}`}
                >
                  <span>{POWER_LABELS[load]}</span>
                  <span className="text-xs">
                    {decisions.power[load] ? 'ON' : 'OFF'} · {Math.round(demand[load])} kWh
                  </span>
                </button>
              </li>
            ))}
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
            className={`w-full rounded-xl bg-yellow-300 px-6 py-4 text-lg font-bold text-slate-900 shadow-lg hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-40 ${highlightAdvance ? 'animate-pulse ring-4 ring-yellow-300/60' : ''}`}
          >
            {waitingForEvent ? 'Answer the alert first' : `Advance sol ${game.sol} ▶`}
          </button>
        </div>
      </div>
    </section>
  )
}
