import { useReducer } from 'react'
import { BaseView } from './BaseView.tsx'
import { DecisionPanel } from './DecisionPanel.tsx'
import { EventModal } from './EventModal.tsx'
import { initialUiState, reducer } from './gameReducer.ts'
import { ResourcePanel } from './ResourcePanel.tsx'
import { EndScreen, StartScreen } from './Screens.tsx'
import { TopBar } from './TopBar.tsx'

export function Game() {
  const [ui, dispatch] = useReducer(reducer, initialUiState)
  const { game, previous, decisions } = ui
  if (!game) return <StartScreen dispatch={dispatch} />

  const recentLog = game.log.slice(-5).reverse()
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar game={game} onQuit={() => dispatch({ type: 'quit' })} />
      <main className="grid flex-1 gap-4 p-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <BaseView game={game} decisions={decisions} />
          </div>
          <ol aria-label="Mission log" className="space-y-1 text-sm">
            {recentLog.map((e, i) => (
              <li key={`${e.sol}-${i}`} className={i === 0 ? 'text-slate-200' : 'text-slate-500'}>
                <span className="tabular-nums text-slate-500">Sol {e.sol}:</span> {e.message}
              </li>
            ))}
          </ol>
        </div>
        <ResourcePanel game={game} previous={previous} decisions={decisions} />
        <div className="lg:col-span-2">
          <DecisionPanel game={game} decisions={decisions} dispatch={dispatch} />
        </div>
      </main>
      {game.pendingEvent && !decisions.eventChoiceId && game.outcome.status === 'playing' && (
        <EventModal event={game.pendingEvent} dispatch={dispatch} />
      )}
      {game.outcome.status !== 'playing' && <EndScreen game={game} dispatch={dispatch} />}
    </div>
  )
}
