import { Clock, FlaskConical, Moon, Orbit, Package, ShieldAlert, Sun, Tornado, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { lightInfo, nextResupplySol } from '../sim/forecast.ts'
import type { GameState } from '../sim/types.ts'
import { MissionPatch } from './icons.tsx'

function Stat({ icon: Icon, label, children, iconClass = 'text-slate-300' }: { icon: LucideIcon; label: string; children: ReactNode; iconClass?: string }) {
  return (
    <div className="flex items-center gap-2.5 border-slate-700/70 sm:border-l sm:pl-4">
      <Icon size={22} className={iconClass} aria-hidden />
      <div className="leading-tight">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}

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
  const plural = (n: number) => `${n} sol${n === 1 ? '' : 's'}`
  const sky = env.shelterSolsLeft > 0
    ? { icon: ShieldAlert, cls: 'text-red-300', text: 'Sheltering', sub: `${plural(env.shelterSolsLeft)} left` }
    : env.dustStormSolsLeft > 0
      ? { icon: Tornado, cls: 'text-orange-300', text: 'Dust storm', sub: `about ${plural(env.dustStormSolsLeft)} left` }
      : light.isDaylight
        ? { icon: Sun, cls: 'text-yellow-300', text: 'Daylight', sub: light.solsUntilChange !== null ? `night in ${plural(light.solsUntilChange)}` : null }
        : { icon: Moon, cls: 'text-indigo-300', text: 'Night', sub: `sunrise in ${plural(light.solsUntilChange ?? 0)}` }
  const nightSoon = light.isDaylight && light.solsUntilChange !== null && light.solsUntilChange <= 3
  const cargo = nextResupplySol(sc, game.sol)

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-slate-800 bg-[#0a1226] px-4 py-3">
      <div className="flex items-center gap-2.5 pr-2">
        <MissionPatch />
        <p className="text-sm font-extrabold uppercase leading-tight tracking-wide">
          Junior Astronaut
          <br />
          Mission Trainer
        </p>
      </div>
      <Stat icon={Orbit} label="Sol" iconClass="text-sky-300">
        <span className="text-lg font-bold tabular-nums">
          {shownSol} <span className="text-slate-500">/ {sc.missionLengthSols}</span>
        </span>
      </Stat>
      <Stat icon={Clock} label="Mission clock">
        <span className={`font-semibold tabular-nums ${solsLeft <= 15 ? 'text-amber-300' : ''}`}>{solsLeft} sols left</span>
      </Stat>
      <Stat icon={sky.icon} label="Sky" iconClass={sky.cls}>
        <span className="font-semibold">{sky.text}</span>
        {sky.sub && <span className={`block text-xs ${nightSoon ? 'font-semibold text-amber-300' : 'text-slate-400'}`}>({sky.sub})</span>}
      </Stat>
      {cargo !== null && cargo < sc.missionLengthSols && (
        <Stat icon={Package} label="Next cargo">
          <span className="font-semibold tabular-nums">sol {cargo}</span>
        </Stat>
      )}
      <div className="flex min-w-56 flex-1 items-center gap-2.5 border-slate-700/70 sm:border-l sm:pl-4">
        <FlaskConical size={22} className="text-violet-300" aria-hidden />
        <div className="flex-1">
          <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <span>Science</span>
            <span className="text-sm normal-case tracking-normal text-slate-100 tabular-nums">
              {game.sciencePoints} / {sc.scienceTarget}
              {earned > 0 && <span className="ml-1 text-violet-300">(+{earned})</span>}
              {behind && <span className="ml-2 text-amber-300">behind schedule</span>}
            </span>
          </div>
          <div className="relative mt-1 h-2.5 overflow-hidden rounded-full bg-slate-700">
            <div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${science * 100}%` }} />
            {/* where you'd need to be to finish on time */}
            <div className="absolute top-0 h-full w-0.5 bg-white/70" style={{ left: `${timeUsed * 100}%` }} title="Mission time used" />
          </div>
        </div>
      </div>
      <button type="button" onClick={onQuit} className="text-xs text-slate-400 underline hover:text-slate-200">
        Quit
      </button>
    </header>
  )
}
