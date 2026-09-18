import type { GameState } from '../sim/types.ts'

export function TopBar({ game, onQuit }: { game: GameState; onQuit: () => void }) {
  const sc = game.scenario
  const solsLeft = sc.missionLengthSols - game.sol
  const science = Math.min(1, game.sciencePoints / sc.scienceTarget)
  const timeUsed = game.sol / sc.missionLengthSols
  const behind = science < timeUsed - 0.05
  const env = game.environment
  const sky = env.shelterSolsLeft > 0
    ? { icon: '🛡️', text: 'Sheltering' }
    : env.dustStormSolsLeft > 0
      ? { icon: '🌪️', text: `Dust storm (${env.dustStormSolsLeft} sols)` }
      : env.isDaylight
        ? { icon: '☀️', text: 'Daylight' }
        : { icon: '🌑', text: 'Night' }

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-800 bg-slate-950/80 px-4 py-3">
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-400">{sc.name}</p>
        <p className="text-lg font-semibold tabular-nums">
          Sol {game.sol} <span className="text-slate-500">/ {sc.missionLengthSols}</span>
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
        </p>
      </div>
      <div className="min-w-48 flex-1">
        <div className="flex justify-between text-xs">
          <span className="uppercase tracking-wider text-slate-400">Science</span>
          <span className="tabular-nums">
            {game.sciencePoints} / {sc.scienceTarget}
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
