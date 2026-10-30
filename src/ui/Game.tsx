import { ChartLine, Globe, Moon } from 'lucide-react'
import { lazy, Suspense, useEffect, useReducer, useState } from 'react'
import type { ScenarioId } from '../sim/types.ts'
import { BaseCondition, BaseSummary, BaseView } from './BaseView.tsx'
import { AdvanceButton, PowerSwitches } from './ControlPanel.tsx'
import { CrewPanel } from './CrewPanel.tsx'
import { EventModal } from './EventModal.tsx'
import { loadSavedUiState, reducer, saveUiState, SCENARIOS } from './gameReducer.ts'
import { openingFixed, OPENINGS } from './labels.ts'
import { LastSol, MissionLog } from './MissionLog.tsx'
import { OpeningBriefing } from './OpeningBriefing.tsx'
import { PhoneTabs, type Attention, type Pane } from './PhoneTabs.tsx'
import { useArtReady } from './preload.ts'
import { everyImageOf, imagesFor } from './sprites.ts'
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
  // Which group of panels a phone is showing. Desktop ignores this and
  // shows everything at once.
  const [pane, setPane] = useState<Pane>('mission')
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
  // The map waits for the pictures it shows, then appears whole (preload.ts).
  // Once it is up, everything else the world can show -- the other time of
  // day, every stage of every building -- is fetched quietly, so a picture
  // that changes later does not blink.
  const artReady = useArtReady(game?.scenario.id ?? 'none', game ? imagesFor(game) : [], game ? everyImageOf(game) : [])
  if (!game) return <StartScreen dispatch={dispatch} />

  // The opening guide belongs to this game (keyed by seed) until dismissed.
  const opening = OPENINGS[game.scenario.id]
  const showBriefing = briefingDismissedFor !== game.rng.seed && game.outcome.status === 'playing'
  const fixChosen = openingFixed(game, decisions)
  const onFirstSol = game.sol === game.scenario.start.sol
  // The first two sols belong to the briefing and its follow-up: tips and
  // the power forecasts wait, so there is one thing to read at a time. The
  // top bar still counts down to the night or the dust season.
  const settling = showBriefing && game.sol < game.scenario.start.sol + 2
  const answered = game.pendingEvent !== null && decisions.eventChoiceId !== undefined

  // A phone only shows one pane at a time; a wide screen shows the lot.
  const inPane = (p: Pane) => (pane === p ? '' : 'hidden lg:block')

  // What is worth a dot on a tab the player is not looking at. Read straight
  // off game state, so it cannot disagree with the panels themselves.
  const lastSol = game.sol - 1
  const shed = (game.lastReport?.shedLoads.length ?? 0) > 0
  const doseHigh = game.crew.some((m) => m.doseMSv > 0.85 * m.careerDoseLimitMSv)
  const worn = game.facilities.condition < 0.6
  const attention: Partial<Record<Pane, Attention>> = {
    ...((shed || doseHigh) && { mission: 'bad' as Attention }),
    ...(!shed && !doseHigh && worn && { mission: 'warn' as Attention }),
    ...(game.log.some((e) => e.sol === lastSol && (e.kind === 'eventStart' || e.kind === 'loadShed' || e.kind === 'dustStormStart')) && {
      base: 'warn' as Attention,
    }),
  }

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
      {/* On a phone the page scrolls under the pinned Advance bar, so its
          foot is padded by the bar's height: 137px normally, 213px while an
          answered alert is shown in it (measured at 375 and 320px wide).
          pb-64 leaves room for an answer that wraps to a fourth line. */}
      <main className={`flex flex-1 flex-col gap-4 p-4 ${answered ? 'pb-64' : 'pb-40'} lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden lg:pb-4 xl:grid-cols-[minmax(0,1fr)_24rem]`}>
        <div className="contents lg:block lg:h-full lg:min-h-0 lg:min-w-0 lg:space-y-4 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
          <div className={`@container relative order-2 overflow-hidden rounded-2xl border border-slate-800 lg:order-none ${inPane('base')}`}>
            {/* Capped so the first row of crew cards fits under the map on a
                laptop screen: the crew is what the player changes each sol.
                The map still fills the width; the cap trims sky and cliff
                from its top and bottom (BaseView), but never more than 60
                map units from each: 48.1cqw is the map's height with 120 of
                its 760 units trimmed, and the cap stops there. */}
            <div className={`transition-opacity duration-500 motion-reduce:transition-none ${artReady ? 'opacity-100' : 'opacity-0'}`}>
              <BaseView game={game} decisions={decisions} effects={solEffects} className="lg:max-h-[max(calc(100vh-22rem),48.1cqw)]" />
            </div>
            {!artReady && (
              <p className="absolute inset-0 flex animate-pulse items-center justify-center text-sm font-semibold text-slate-400">Landing at the outpost…</p>
            )}
            <BaseSummary game={game} />
            <BaseCondition game={game} />
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
          <div className={`order-4 lg:order-none ${inPane('mission')}`}>
          <CrewPanel
            game={game}
            decisions={decisions}
            dispatch={dispatch}
            highlight={showBriefing && !fixChosen ? { task: opening.fixTask, from: opening.fixFrom } : undefined}
            showAdvice={!settling}
            pickerFor={pickerFor}
            onPickerChange={setPickerFor}
          />
          </div>
          <div className={`order-6 lg:order-none ${inPane('base')}`}>
            <MissionLog log={game.log} started={game.lastReport !== null} />
          </div>
          <details className={`group order-7 rounded-2xl border border-slate-800 bg-slate-900/50 p-3 lg:order-none ${inPane('trends')}`} open={history.length > 1}>
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
            {/* The briefing sits beside the meter it points at on a wide
                screen, leaving the map and the crew their room; on a phone
                it comes first. */}
            {showBriefing && (
              <div className="order-1 lg:order-none">
                <OpeningBriefing game={game} decisions={decisions} onDismiss={() => setBriefingDismissedFor(game.rng.seed)} />
              </div>
            )}
            <div className={`order-3 space-y-4 lg:order-none ${inPane('mission')}`}>
              <LastSol game={game} />
              <ResourcePanel game={game} previous={previous} decisions={decisions} highlight={showBriefing && onFirstSol ? opening.meter : undefined} quiet={settling} />
            </div>
            <div className={`order-5 lg:order-none ${inPane('mission')}`}>
              <PowerSwitches game={game} decisions={decisions} dispatch={dispatch} />
            </div>
          </div>
          <AdvanceButton
            game={game}
            decisions={decisions}
            dispatch={dispatch}
            highlightAdvance={showBriefing && onFirstSol && fixChosen}
            tabs={
              <PhoneTabs
                pane={pane}
                attention={attention}
                onChange={(next) => {
                  setPane(next)
                  window.scrollTo({ top: 0 })
                }}
              />
            }
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
