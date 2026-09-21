import { ArrowLeftRight, Lightbulb, Radiation, TriangleAlert, Users, Wrench } from 'lucide-react'
import type { Dispatch } from 'react'
import { EVA_TASKS } from '../sim/advanceSol.ts'
import { BALANCE } from '../sim/balance.ts'
import { gcrDoseMSv } from '../sim/radiation.ts'
import type { CrewTask, Decisions, GameState } from '../sim/types.ts'
import type { Action } from './gameReducer.ts'
import { CrewAvatar } from './icons.tsx'
import { TASK_ICONS, TASK_LABELS } from './labels.ts'

interface Props {
  game: GameState
  decisions: Decisions
  dispatch: Dispatch<Action>
  highlightTask?: CrewTask // pulse this task's buttons (opening guide)
  showAdvice?: boolean     // hold back tips while the opening briefing has the stage
}

export function CrewPanel({ game, decisions, dispatch, highlightTask, showAdvice = true }: Props) {
  const tasks = (Object.keys(TASK_LABELS) as CrewTask[]).filter((t) => t !== 'isru' || game.scenario.isruAvailable)
  const sheltering = game.environment.shelterSolsLeft > 0
  const repairShifts = game.environment.busyShifts + game.environment.busyEvaShifts

  // Background dose for one sol, indoors vs on a spacewalk (from the sim's
  // radiation model), so the cost of an EVA is visible before choosing it.
  const evaFraction = BALANCE.SHIFT_HOURS / game.scenario.hoursPerSol
  const indoorDose = gcrDoseMSv(game.scenario, game.facilities, 0)
  const evaDose = gcrDoseMSv(game.scenario, game.facilities, evaFraction)
  const headroom = (id: string) => {
    const m = game.crew.find((c) => c.id === id)!
    return m.careerDoseLimitMSv - m.doseMSv
  }
  const name = (id: string) => game.crew.find((m) => m.id === id)!.name

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

  // Building past a cap does nothing: say so, or the shift is silently wasted.
  const maxedOut: Partial<Record<CrewTask, string>> = {
    ...(game.facilities.shieldingLevel >= BALANCE.MAX_SHIELDING_LEVEL && { shielding: 'Shielding is already at maximum: this shift does nothing.' }),
    ...(game.facilities.solarArrayM2 >= game.scenario.maxSolarArrayM2 && { solar: 'No room for more panels: this shift does nothing.' }),
  }

  return (
    <section aria-label="Crew assignments" className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-300">
          <Users size={18} className="text-sky-300" aria-hidden /> Crew assignments
        </h2>
        <p className="text-[11px] text-slate-400">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-orange-400 align-middle" /> helmet on = outside (EVA), extra radiation
        </p>
      </div>
      {sheltering && <p className="mb-2 text-sm text-amber-300">Sheltering from a solar storm: no work this sol.</p>}
      {!sheltering && repairShifts > 0 && (
        <p className="flex items-center gap-1.5 mb-2 text-sm text-amber-300">
          <Wrench size={15} className="shrink-0" aria-hidden /> {repairShifts} shift{repairShifts > 1 ? 's' : ''} owed to repairs{game.environment.busyEvaShifts > 0 ? ', some outside' : ''}: taken from science first.
        </p>
      )}
      {showAdvice && swapAdvice && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-sky-400/50 bg-sky-950/40 px-3 py-2 text-sm">
          <Lightbulb size={18} className="shrink-0 text-sky-300" aria-hidden />
          <span className="flex-1">
            {name(swapAdvice.out)} is outside with only {Math.round(headroom(swapAdvice.out))} mSv of radiation to spare.{' '}
            {name(swapAdvice.in)} has {Math.round(headroom(swapAdvice.in))} mSv to spare and is working indoors. Whoever is outside takes the
            biggest dose if a solar storm hits.
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'swapTasks', a: swapAdvice!.out, b: swapAdvice!.in })}
            className="flex items-center gap-1 rounded-lg bg-sky-300 px-2.5 py-1 text-xs font-semibold text-slate-900 hover:bg-sky-200"
          >
            <ArrowLeftRight size={14} aria-hidden /> Swap their jobs
          </button>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {game.crew.map((m, index) => {
          const task = decisions.assignments[m.id] ?? 'rest'
          const doseFrac = m.doseMSv / m.careerDoseLimitMSv
          const doseTone = doseFrac > 0.85 ? 'text-red-300' : doseFrac > 0.7 ? 'text-amber-300' : 'text-slate-300'
          return (
            <div key={m.id} className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-2.5">
              <div className="flex items-center gap-2.5">
                <CrewAvatar index={index} initial={m.name[0]} crewId={m.id} onEva={EVA_TASKS.has(task)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{m.name}</span>
                    <span className={`flex items-center gap-1 text-xs tabular-nums ${doseTone}`}>
                      <Radiation size={13} aria-hidden /> {Math.round(m.doseMSv)}/{m.careerDoseLimitMSv} mSv
                      {EVA_TASKS.has(task) && <span className="h-2 w-2 rounded-full bg-orange-400" title="Outside today" />}
                    </span>
                  </div>
                  <p className="text-xs capitalize text-slate-400">{m.role}</p>
                  <div className="mt-1 h-1 overflow-hidden rounded bg-slate-700">
                    <div
                      className={`h-full ${doseFrac > 0.85 ? 'bg-red-500' : doseFrac > 0.7 ? 'bg-amber-400' : 'bg-sky-400'}`}
                      style={{ width: `${Math.min(1, doseFrac) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {Math.round(m.careerDoseLimitMSv - m.doseMSv)} mSv to spare · per sol: indoors +{indoorDose.toFixed(1)}, on EVA +{evaDose.toFixed(1)}
              </p>
              <div className="mt-2 grid grid-cols-4 gap-1" role="group" aria-label={`Task for ${m.name}`}>
                {tasks.map((t) => {
                  const Icon = TASK_ICONS[t]
                  const selected = task === t
                  const pulse = highlightTask === t && (task === 'labScience' || task === 'fieldScience')
                  return (
                    <button
                      key={t}
                      type="button"
                      title={`${TASK_LABELS[t].label}: ${TASK_LABELS[t].hint}`}
                      aria-pressed={selected}
                      aria-label={TASK_LABELS[t].label}
                      onClick={() => dispatch({ type: 'assign', crewId: m.id, task: t })}
                      className={`relative flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 leading-none transition-colors ${
                        selected ? 'border-yellow-300 bg-yellow-300/15 text-yellow-100' : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800/60'
                      } ${pulse ? 'animate-pulse ring-2 ring-yellow-300' : ''}`}
                    >
                      <Icon size={18} aria-hidden />
                      <span aria-hidden className="text-[10px]">{TASK_LABELS[t].short}</span>
                      {EVA_TASKS.has(t) && <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-orange-400" />}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1.5 text-xs text-slate-300">
                {TASK_LABELS[task].label}
                {EVA_TASKS.has(task) && <span className="ml-1 rounded bg-orange-500/20 px-1 text-orange-300">EVA: extra radiation</span>}
                <span className="block text-slate-500">{TASK_LABELS[task].hint}</span>
                {maxedOut[task] && (
                  <span className="flex items-start gap-1 font-semibold text-amber-300">
                    <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden /> {maxedOut[task]}
                  </span>
                )}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
