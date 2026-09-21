import { ChartLine, Globe, Moon } from 'lucide-react'
import { lazy, Suspense, useEffect, useReducer, useState } from 'react'
import type { ScenarioId } from '../sim/types.ts'
import { BaseSummary, BaseView } from './BaseView.tsx'
import { AdvanceButton, PowerSwitches } from './ControlPanel.tsx'
import { CrewPanel } from './CrewPanel.tsx'
import { EventModal } from './EventModal.tsx'
import { loadSavedUiState, reducer, saveUiState, SCENARIOS } from './gameReducer.ts'
import { OPENINGS } from './labels.ts'
import { MissionLog } from './MissionLog.tsx'
import { OpeningBriefing } from './OpeningBriefing.tsx'
import { useSolEffects } from './useSolEffects.ts'
import { ResourcePanel } from './ResourcePanel.tsx'
import { EndScreen, StartScreen } from './Screens.tsx'
import { TopBar } from './TopBar.tsx'

// The charts pull in Recharts, the largest dependency. Load it separately so
// the game itself appears quickly.
const TrendCharts = lazy(() => import('./TrendCharts.tsx').then((m) => ({ default: m.TrendCharts })))

export function Game() {
  const [ui, dispatch] = useReducer(reducer, undefined, loadSavedUiState)
  const [briefingDismissedFor, setBriefingDismissedFor] = useState<number | null>(null)
  // Which astronaut's task picker is open (phones only).
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const { game, previous, decisions, history } = ui
  const solEffects = useSolEffects(game)

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
    // On desktop the app fills the screen and never scrolls as a page: each
    // column scrolls inside itself. That keeps the Advance button and the
    // meters on screen on a short laptop, instead of below the fold. Phones
    // keep ordinary page scrolling.
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <TopBar
        game={game}
        onQuit={() => {
          if (game.outcome.status !== 'playing' || window.confirm('Quit this mission? Your progress will be lost.')) dispatch({ type: 'quit' })
        }}
      />
      {/* Two columns on large screens. On phones the columns dissolve
          (display: contents) so sections can be re-ordered: the meters come
          right after the map, where the briefing points. */}
      <main className="flex flex-1 flex-col gap-4 p-4 pb-28 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden lg:pb-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="contents lg:block lg:h-full lg:min-h-0 lg:min-w-0 lg:space-y-4 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
          {showBriefing && (
            <div className="order-1 lg:order-none">
            <OpeningBriefing game={game} decisions={decisions} onDismiss={() => setBriefingDismissedFor(game.rng.seed)} />
            </div>
          )}
          <div className="relative order-2 overflow-hidden rounded-2xl border border-slate-800 lg:order-none">
            <BaseView game={game} decisions={decisions} effects={solEffects} />
            <BaseSummary game={game} />
            <label className="absolute left-3 top-3 flex items-center">
              <span className="sr-only">World</span>
              {/* A native <option> can only hold text, so the world's icon
                  sits beside the menu rather than inside it. */}
              <span className="pointer-events-none absolute left-2 z-10" aria-hidden>
                {game.scenario.id === 'moon' ? (
                  <Moon size={14} className="text-amber-200" />
                ) : (
                  <Globe size={14} className="text-red-400" />
                )}
              </span>
              <select
                value={game.scenario.id}
                onChange={(e) => {
                  const next = e.target.value as ScenarioId
                  if (next === game.scenario.id) return
                  if (window.confirm(`Start a new mission on ${SCENARIOS[next].name}? This mission will be lost.`)) {
                    dispatch({ type: 'start', scenarioId: next, seed: (game.rng.seed * 1103515245 + 12345) >>> 0 })
                  }
                }}
                className="appearance-none rounded-lg border border-slate-600 bg-slate-900/90 py-0.5 pl-7 pr-6 text-xs font-semibold text-white shadow-lg sm:rounded-xl sm:py-1.5 sm:text-sm"
              >
                <option value="moon">Moon</option>
                <option value="mars">Mars</option>
              </select>
            </label>
          </div>
          <div className="order-4 lg:order-none">
          <CrewPanel
            game={game}
            decisions={decisions}
            dispatch={dispatch}
            highlightTask={showBriefing && !fixChosen ? opening.fixTask : undefined}
            showAdvice={!(showBriefing && onFirstSol)}
            pickerFor={pickerFor}
            onPickerChange={setPickerFor}
          />
          </div>
          <div className="order-6 lg:order-none">
            <MissionLog log={game.log} />
          </div>
          <details className="group order-7 rounded-2xl border border-slate-800 bg-slate-900/50 p-3 lg:order-none" open={history.length > 1}>
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-300">
              <ChartLine size={16} className="text-sky-300" aria-hidden /> Trends
            </summary>
            <div className="mt-2">
              <Suspense fallback={<p className="text-sm text-slate-500">Loading charts…</p>}>
                <TrendCharts game={game} history={history} />
              </Suspense>
            </div>
          </details>
        </div>
        {/* The status column stays put while the map and crew scroll, and
            never grows past the screen: the meters scroll inside it, and the
            Advance button is held at its foot so it is always in reach. */}
        <div className="contents lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:gap-4">
          <div className="contents lg:block lg:min-h-0 lg:flex-1 lg:space-y-4 lg:overflow-y-auto lg:overscroll-contain">
            <div className="order-3 lg:order-none">
              <ResourcePanel game={game} previous={previous} decisions={decisions} highlight={showBriefing && onFirstSol ? opening.meter : undefined} />
            </div>
            <div className="order-5 lg:order-none">
              <PowerSwitches game={game} decisions={decisions} dispatch={dispatch} />
            </div>
          </div>
          <AdvanceButton game={game} decisions={decisions} dispatch={dispatch} highlightAdvance={showBriefing && onFirstSol && fixChosen} />
        </div>
      </main>
      {game.pendingEvent && !decisions.eventChoiceId && game.outcome.status === 'playing' && (
        <EventModal event={game.pendingEvent} dispatch={dispatch} />
      )}
      {game.outcome.status !== 'playing' && <EndScreen game={game} dispatch={dispatch} />}
    </div>
  )
}
