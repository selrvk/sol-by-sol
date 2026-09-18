import { useEffect, useReducer, useState } from 'react'
import { BaseView } from './BaseView.tsx'
import { DecisionPanel } from './DecisionPanel.tsx'
import { EventModal } from './EventModal.tsx'
import { loadSavedUiState, reducer, saveUiState } from './gameReducer.ts'
import { OPENINGS } from './labels.ts'
import { MissionLog } from './MissionLog.tsx'
import { OpeningBriefing } from './OpeningBriefing.tsx'
import { ResourcePanel } from './ResourcePanel.tsx'
import { EndScreen, StartScreen } from './Screens.tsx'
import { TopBar } from './TopBar.tsx'
import { TrendCharts } from './TrendCharts.tsx'

export function Game() {
  const [ui, dispatch] = useReducer(reducer, undefined, loadSavedUiState)
  const [briefingDismissedFor, setBriefingDismissedFor] = useState<number | null>(null)
  const { game, previous, decisions, history } = ui

  useEffect(() => saveUiState(ui), [ui])

  // Enter advances the sol, unless an alert is waiting or a control has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return
      const target = e.target as HTMLElement
      if (target.closest('button, input, select, textarea, [role=dialog]')) return
      if (!ui.game || ui.game.outcome.status !== 'playing') return
      if (ui.game.pendingEvent && !ui.decisions.eventChoiceId) return
      dispatch({ type: 'advance' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ui])
  if (!game) return <StartScreen dispatch={dispatch} />

  // The opening guide belongs to this game (keyed by seed) until dismissed.
  const opening = OPENINGS[game.scenario.id]
  const showBriefing = briefingDismissedFor !== game.rng.seed && game.outcome.status === 'playing'
  const fixChosen = Object.values(decisions.assignments).includes(opening.fixTask)
  const onFirstSol = game.sol === game.scenario.start.sol

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        game={game}
        onQuit={() => {
          if (game.outcome.status !== 'playing' || window.confirm('Quit this mission? Your progress will be lost.')) dispatch({ type: 'quit' })
        }}
      />
      <main className="grid flex-1 gap-4 p-4 pb-28 lg:grid-cols-[1fr_20rem] lg:pb-4">
        <div className="space-y-3">
          {showBriefing && (
            <OpeningBriefing game={game} decisions={decisions} onDismiss={() => setBriefingDismissedFor(game.rng.seed)} />
          )}
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <BaseView game={game} decisions={decisions} />
          </div>
          <MissionLog log={game.log} />
          <details className="group rounded-xl border border-slate-800 p-3" open={history.length > 1}>
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wider text-slate-400">📈 Trends</summary>
            <div className="mt-2">
              <TrendCharts game={game} history={history} />
            </div>
          </details>
        </div>
        <ResourcePanel game={game} previous={previous} decisions={decisions} highlight={showBriefing && onFirstSol ? opening.meter : undefined} />
        <div className="lg:col-span-2">
          <DecisionPanel
            game={game}
            decisions={decisions}
            dispatch={dispatch}
            highlightTask={showBriefing && !fixChosen ? opening.fixTask : undefined}
            highlightAdvance={showBriefing && onFirstSol && fixChosen}
          />
        </div>
      </main>
      {game.pendingEvent && !decisions.eventChoiceId && game.outcome.status === 'playing' && (
        <EventModal event={game.pendingEvent} dispatch={dispatch} />
      )}
      {game.outcome.status !== 'playing' && <EndScreen game={game} dispatch={dispatch} />}
    </div>
  )
}
