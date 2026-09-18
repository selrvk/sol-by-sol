import { lightInfo, nextResupplySol } from '../sim/forecast.ts'
import type { GameState } from '../sim/types.ts'

export function TopBar({ game, onQuit }: { game: GameState; onQuit: () => void }) {
  const sc = game.scenario
  const over = game.outcome.status !== 'playing'
  const shownSol = over ? game.sol - 1 : game.sol
  const solsLeft = sc.missionLengthSols - shownSol
  const science = Math.min(1, game.sciencePoints / sc.scienceTarget)
  const timeUsed = shownSol / sc.missionLengthSols
  const behind = science < timeUsed - 0.05
  const env = game.environment
  const earned = game.lastReport?.scienceEarned ?? 0

  // Describe the sol about to be played, and when the light changes next.
  const light = lightInfo(sc, game.sol)
  const sky = env.shelterSolsLeft > 0
    ? { icon: '🛡️', text: 'Sheltering', sub: `${env.shelterSolsLeft} sol${env.shelterSolsLeft > 1 ? 's' : ''} left` }
    : env.dustStormSolsLeft > 0
      ? { icon: '🌪️', text: 'Dust storm', sub: `about ${env.dustStormSolsLeft} sols left` }
      : light.isDaylight
        ? { icon: '☀️', text: 'Daylight', sub: light.solsUntilChange !== null ? `night in ${light.solsUntilChange} sol${light.solsUntilChange > 1 ? 's' : ''}` : null }
        : { icon: '🌑', text: 'Night', sub: `sunrise in ${light.solsUntilChange} sol${light.solsUntilChange! > 1 ? 's' : ''}` }
  const nightSoon = light.isDaylight && light.solsUntilChange !== null && light.solsUntilChange <= 3
  const cargo = nextResupplySol(sc, game.sol)

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-800 bg-slate-950/80 px-4 py-3">
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-400">{sc.name}</p>
        <p className="text-lg font-semibold tabular-nums">
          Sol {shownSol} <span className="text-slate-500">/ {sc.missionLengthSols}</span>
        </p>
      </div>
      <div className="text-sm">
        <p className="text-xs uppercase tracking-wider text-slate-400">Mission clock</p>
        <p className={`tabular-nums ${solsLeft <= 15 ? 'text-amber-300' : ''}`}>{solsLeft} sols left</p>
      </div>
      <div className="text-sm">
        <p className="text-xs uppercase tracking-wider text-slate-400">Sky</p>
        <p>
          <span aria-hidden>{sky.icon}</span> {sky.text}
          {sky.sub && <span className={`ml-1 text-xs ${nightSoon ? 'font-semibold text-amber-300' : 'text-slate-400'}`}>({sky.sub})</span>}
        </p>
      </div>
      {cargo !== null && cargo < sc.missionLengthSols && (
        <div className="text-sm">
          <p className="text-xs uppercase tracking-wider text-slate-400">Next cargo</p>
          <p className="tabular-nums">sol {cargo}</p>
        </div>
      )}
      <div className="min-w-48 flex-1">
        <div className="flex justify-between text-xs">
          <span className="uppercase tracking-wider text-slate-400">Science</span>
          <span className="tabular-nums">
            {game.sciencePoints} / {sc.scienceTarget}
            {earned > 0 && <span className="ml-1 text-violet-300">(+{earned})</span>}
            {behind && <span className="ml-2 text-amber-300">behind schedule</span>}
          </span>
        </div>
        <div className="relative mt-1 h-3 overflow-hidden rounded bg-slate-700">
          <div className="h-full bg-violet-400 transition-all" style={{ width: `${science * 100}%` }} />
          {/* where you'd need to be to finish on time */}
          <div className="absolute top-0 h-full w-0.5 bg-white/70" style={{ left: `${timeUsed * 100}%` }} title="Mission time used" />
        </div>
      </div>
      <button type="button" onClick={onQuit} className="text-xs text-slate-400 underline hover:text-slate-200">
        Quit
      </button>
    </header>
  )
}
