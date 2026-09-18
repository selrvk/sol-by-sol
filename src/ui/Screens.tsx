import type { Dispatch } from 'react'
import type { GameState, LossReason, ScenarioId } from '../sim/types.ts'
import type { Action } from './gameReducer.ts'
import { SCENARIOS } from './gameReducer.ts'
import { SCENARIO_BLURBS } from './labels.ts'

// A fresh seed per game. The sim itself never calls Math.random: the seed
// is shown on the end screen so a game can be replayed exactly.
function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

export function StartScreen({ dispatch }: { dispatch: Dispatch<Action> }) {
  const start = (scenarioId: ScenarioId) => dispatch({ type: 'start', scenarioId, seed: newSeed() })
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-sky-300">Junior Astronaut Mission Trainer</p>
        <h1 className="mt-1 text-3xl font-bold">Keep your crew alive. Do the science.</h1>
        <p className="mt-2 text-slate-300">
          Four astronauts, one outpost. Every hour and every kilowatt you spend on safety is one you can't spend on science.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => {
          const sc = SCENARIOS[id]
          return (
            <button
              key={id}
              type="button"
              onClick={() => start(id)}
              className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-left hover:border-yellow-300"
            >
              <p className="text-4xl" aria-hidden>{id === 'moon' ? '🌕' : '🔴'}</p>
              <h2 className="mt-2 text-xl font-bold">{sc.name}</h2>
              <p className="mt-1 text-sm text-slate-300">{SCENARIO_BLURBS[id]}</p>
              <p className="mt-3 text-sm text-violet-300">
                Goal: {sc.scienceTarget} science in {sc.missionLengthSols} sols
              </p>
            </button>
          )
        })}
      </div>
    </main>
  )
}

// Placeholder wording: Stage 5 writes the real loss screens.
const LOSS_TEXT: Record<LossReason, string> = {
  oxygen: 'The crew ran out of oxygen.',
  water: 'The crew ran out of water.',
  food: 'The crew ran out of food.',
  power: 'Life support lost power.',
  radiation: 'An astronaut passed their career radiation limit.',
  missionTimeout: 'The mission clock ran out before the science target was reached.',
}

export function EndScreen({ game, dispatch }: { game: GameState; dispatch: Dispatch<Action> }) {
  const o = game.outcome
  const won = o.status === 'won'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
      <div className={`w-full max-w-md rounded-2xl border p-6 text-center ${won ? 'border-emerald-400' : 'border-red-500'} bg-slate-900`}>
        <p className="text-5xl" aria-hidden>{won ? '🏆' : '💀'}</p>
        <h2 className="mt-2 text-2xl font-bold">{won ? 'Mission accomplished!' : 'Mission failed'}</h2>
        <p className="mt-2 text-slate-300">
          {o.status === 'lost' ? LOSS_TEXT[o.reason] : `Science target reached with ${game.scenario.missionLengthSols - game.sol} sols to spare.`}
        </p>
        <p className="mt-3 text-sm text-slate-400">
          Sol {game.sol} · science {game.sciencePoints}/{game.scenario.scienceTarget} · seed {game.rng.seed}
        </p>
        <button type="button" onClick={() => dispatch({ type: 'quit' })} className="mt-5 rounded-xl bg-yellow-300 px-6 py-3 font-bold text-slate-900 hover:bg-yellow-200">
          Play again
        </button>
      </div>
    </div>
  )
}
