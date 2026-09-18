import type { Dispatch } from 'react'
import { EVA_TASKS, loadDemandKWh } from '../sim/advanceSol.ts'
import { BALANCE } from '../sim/balance.ts'
import { gcrDoseMSv } from '../sim/radiation.ts'
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
  // Background dose for one sol, indoors vs on a spacewalk (from the sim's
  // radiation model), so the cost of an EVA is visible before choosing it.
  const evaFraction = BALANCE.SHIFT_HOURS / game.scenario.hoursPerSol
  const indoorDose = gcrDoseMSv(game.scenario, game.facilities, 0)
  const evaDose = gcrDoseMSv(game.scenario, game.facilities, evaFraction)
  const headroom = (id: string) => {
    const m = game.crew.find((c) => c.id === id)!
    return m.careerDoseLimitMSv - m.doseMSv
  }
  // Advice: if someone with little radiation to spare is outside while a
  // crewmate with more to spare works indoors, suggest swapping their jobs.
  const onEva = game.crew.filter((m) => EVA_TASKS.has(decisions.assignments[m.id] ?? 'rest'))
  const indoorWorkers = game.crew.filter((m) => {
    const t = decisions.assignments[m.id] ?? 'rest'
    return t !== 'rest' && !EVA_TASKS.has(t)
  })
  let swapAdvice: { out: string; in: string } | null = null
  for (const out of [...onEva].sort((a, b) => headroom(a.id) - headroom(b.id))) {
    const better = [...indoorWorkers].sort((a, b) => headroom(b.id) - headroom(a.id))[0]
    if (better && headroom(better.id) - headroom(out.id) > 100) {
      swapAdvice = { out: out.id, in: better.id }
      break
    }
  }
  const name = (id: string) => game.crew.find((m) => m.id === id)!.name

  // Building past a cap does nothing: say so, or the shift is silently wasted.
  const maxedOut: Partial<Record<CrewTask, string>> = {
    ...(game.facilities.shieldingLevel >= BALANCE.MAX_SHIELDING_LEVEL && { shielding: 'Shielding is already at maximum: this shift does nothing.' }),
    ...(game.facilities.solarArrayM2 >= game.scenario.maxSolarArrayM2 && { solar: 'No room for more panels: this shift does nothing.' }),
  }

  return (
    <section aria-label="Decisions" className="grid gap-4 lg:grid-cols-[1fr_auto]">
      <div>
        <p className="float-right mt-0.5 text-[11px] text-slate-500">
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-orange-400 align-middle" /> = outside (EVA), extra radiation
        </p>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Crew assignments {sheltering && <span className="normal-case text-amber-300">(sheltering: no work this sol)</span>}
          {!sheltering && repairShifts > 0 && (
            <span className="normal-case text-amber-300">
              {' '}(🔧 {repairShifts} shift{repairShifts > 1 ? 's' : ''} owed to repairs{game.environment.busyEvaShifts > 0 ? ', some outside' : ''}: taken from science first)
            </span>
          )}
        </h2>
        {swapAdvice && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-sky-400/50 bg-sky-950/40 px-3 py-2 text-sm">
            <span className="flex-1">
              💡 {name(swapAdvice.out)} is outside with only {Math.round(headroom(swapAdvice.out))} mSv of radiation to spare.{' '}
              {name(swapAdvice.in)} has {Math.round(headroom(swapAdvice.in))} mSv to spare and is working indoors. Whoever is outside
              takes the biggest dose if a solar storm hits.
            </span>
            <button
              type="button"
              onClick={() => dispatch({ type: 'swapTasks', a: swapAdvice!.out, b: swapAdvice!.in })}
              className="rounded-md bg-sky-300 px-2.5 py-1 text-xs font-semibold text-slate-900 hover:bg-sky-200"
            >
              Swap their jobs
            </button>
          </div>
        )}
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
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {Math.round(m.careerDoseLimitMSv - m.doseMSv)} mSv to spare · per sol: indoors +{indoorDose.toFixed(1)}, on EVA +{evaDose.toFixed(1)}
                </p>
                <div className="mt-2 grid grid-cols-4 gap-1" role="group" aria-label={`Task for ${m.name}`}>
                  {tasks.map((t) => (
                    <button
                      key={t}
                      type="button"
                      title={`${TASK_LABELS[t].label}: ${TASK_LABELS[t].hint}`}
                      aria-pressed={task === t}
                      aria-label={TASK_LABELS[t].label}
                      onClick={() => dispatch({ type: 'assign', crewId: m.id, task: t })}
                      className={`relative flex flex-col items-center gap-0.5 rounded-md border px-1 py-1 leading-none ${task === t ? 'border-yellow-300 bg-yellow-300/20 text-yellow-100' : 'border-slate-700 text-slate-300 hover:border-slate-500'} ${highlightTask === t && (task === 'labScience' || task === 'fieldScience') ? 'animate-pulse ring-2 ring-yellow-300' : ''}`}
                    >
                      <span aria-hidden className="text-base">{TASK_LABELS[t].icon}</span>
                      <span aria-hidden className="text-[10px]">{TASK_LABELS[t].short}</span>
                      {EVA_TASKS.has(t) && <span aria-hidden className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-orange-400" title="EVA" />}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-slate-300">
                  {TASK_LABELS[task].label}
                  {EVA_TASKS.has(task) && <span className="ml-1 rounded bg-orange-500/20 px-1 text-orange-300">EVA: extra radiation</span>}
                  <span className="block text-slate-500">{TASK_LABELS[task].hint}</span>
                  {maxedOut[task] && <span className="block font-semibold text-amber-300">⚠ {maxedOut[task]}</span>}
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
          <p className="mb-1 hidden text-center text-[11px] text-slate-500 lg:block">or press Enter</p>
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
