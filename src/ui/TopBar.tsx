import { FlaskConical, LogOut, Moon, Orbit, Package, ShieldAlert, Sun, Tornado, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { dustSeason, lightInfo, nextResupplySol } from '../sim/forecast.ts'
import type { GameState } from '../sim/types.ts'
import { scienceWhy } from './labels.ts'
import { WhyTooltip } from './WhyTooltip.tsx'

// One reading in the bar. On a phone the caption is dropped and the value
// sits next to its icon, which is the difference between a four-row bar and
// a one-row one.
function Stat({ icon: Icon, label, children, iconClass = 'text-slate-300' }: { icon: LucideIcon; label: string; children: ReactNode; iconClass?: string }) {
  return (
    <div className="flex items-center gap-1.5 border-slate-700/70 sm:gap-2.5 sm:border-l sm:pl-4">
      <Icon size={18} className={`shrink-0 sm:h-[22px] sm:w-[22px] ${iconClass}`} aria-hidden />
      <div className="leading-tight">
        <p className="hidden text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:block">{label}</p>
        <div className="text-sm">
          <span className="sr-only">{label}: </span>
          {children}
        </div>
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
  const score = (
    <>
      {game.sciencePoints} / {sc.scienceTarget}
      {earned > 0 && <span className="ml-1 text-violet-300">(+{earned})</span>}
      {/* Short where the row is tight: the science why? explains it. */}
      {behind && (
        <span className="ml-2 text-amber-300">
          behind<span className="hidden xl:inline"> schedule</span>
        </span>
      )}
    </>
  )

  // Describe the sol about to be played, and when the light changes next.
  const light = lightInfo(sc, game.sol)
  const season = dustSeason(sc, game.sol)
  const plural = (n: number) => `${n} sol${n === 1 ? '' : 's'}`
  // Mars has no night to count down to; it counts down to the dust season.
  const seasonSub = season ? (season.now ? `dust season until sol ${season.toSol}` : `dust season in ${plural(season.inSols)}`) : null
  const sky = env.shelterSolsLeft > 0
    ? { icon: ShieldAlert, cls: 'text-red-300', text: 'Sheltering', sub: `${plural(env.shelterSolsLeft)} left` }
    : env.dustStormSolsLeft > 0
      ? { icon: Tornado, cls: 'text-orange-300', text: 'Dust storm', sub: `about ${plural(env.dustStormSolsLeft)} left` }
      : light.isDaylight
        ? { icon: Sun, cls: 'text-yellow-300', text: 'Daylight', sub: light.solsUntilChange !== null ? `night in ${plural(light.solsUntilChange)}` : seasonSub }
        : { icon: Moon, cls: 'text-indigo-300', text: 'Night', sub: `sunrise in ${plural(light.solsUntilChange ?? 0)}` }
  const changeSoon =
    (light.isDaylight && light.solsUntilChange !== null && light.solsUntilChange <= 3) ||
    (env.dustStormSolsLeft === 0 && season !== null && !season.now && season.inSols <= 3)
  const cargo = nextResupplySol(sc, game.sol)

  return (
    <header className="shrink-0 border-b border-slate-800 bg-[#0a1226] px-3 py-2 sm:px-4 sm:py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-4 sm:gap-y-3">
      <div className="flex items-center gap-2.5 pr-1 sm:pr-2">
        <img src="/art/archspace-logo.webp" alt="ARCHSPACE" width={32} height={32} className="shrink-0" />
        <p className="hidden text-sm font-extrabold uppercase leading-tight tracking-wide sm:block">
          Junior Astronaut
          <br />
          Mission Trainer
        </p>
      </div>
      {/* Sol x of y already says how long is left, so the old "sols left"
          reading was the same number twice. It comes back only when the
          deadline is close enough to matter. */}
      {/* A phone drops the captions, so the day count gets a word of its own
          there. The cargo reading is desktop-only: on a phone the Oxygen box
          says when the next lander comes and what it brings. */}
      <Stat icon={Orbit} label="Sol (day)" iconClass="text-sky-300">
        <span className="text-lg font-bold tabular-nums">
          <span aria-hidden className="mr-1 text-sm font-semibold text-slate-400 sm:hidden">Sol</span>
          {shownSol} <span className="text-slate-500">/ {sc.missionLengthSols}</span>
        </span>
        {solsLeft <= 15 && (
          <span className="ml-1.5 whitespace-nowrap text-xs font-semibold text-amber-300">{plural(solsLeft)} left</span>
        )}
      </Stat>
      <Stat icon={sky.icon} label="Sky" iconClass={sky.cls}>
        <span className="font-semibold">{sky.text}</span>
        {sky.sub && <span className={`block text-xs ${changeSoon ? 'font-semibold text-amber-300' : 'text-slate-400'}`}>({sky.sub})</span>}
      </Stat>
      {cargo !== null && cargo < sc.missionLengthSols && (
        <div className="hidden sm:flex">
          <Stat icon={Package} label="Next cargo">
            <span className="font-semibold tabular-nums">sol {cargo}</span>
          </Stat>
        </div>
      )}
      {/* Science: caption above the bar where there is room, and a single
          line of icon, bar and score on a phone, sharing that row with Quit
          so neither costs a row of its own. */}
      <div className="order-last flex w-full min-w-0 items-center gap-3 sm:contents">
      <div className="flex min-w-0 flex-1 items-center gap-2 border-slate-700/70 sm:min-w-56 sm:gap-2.5 sm:border-l sm:pl-4">
        <FlaskConical size={18} className="shrink-0 text-violet-300 sm:h-[22px] sm:w-[22px]" aria-hidden />
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:block">
          <div className="hidden items-baseline justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:flex">
            <span>Science</span>
            <span className="ml-auto text-sm normal-case tracking-normal text-slate-100 tabular-nums">{score}</span>
            <span className="normal-case tracking-normal">
              <WhyTooltip why={scienceWhy(sc)} label="Science" />
            </span>
          </div>
          <div className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-700 sm:mt-1">
            <div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${science * 100}%` }} />
            {/* Where a steady pace would have you by now: explained in the why? */}
            <div className="absolute top-0 h-full w-0.5 bg-white/70" style={{ left: `${timeUsed * 100}%` }} title="Where a steady pace would have you by now" />
          </div>
          <span className="shrink-0 text-sm tabular-nums sm:hidden">
            <span className="sr-only">Science: </span>
            {score}
          </span>
          <span className="flex shrink-0 leading-none sm:hidden">
            <WhyTooltip why={scienceWhy(sc)} label="Science" />
          </span>
        </div>
      </div>
      <button type="button" onClick={onQuit} className="shrink-0 text-slate-400 hover:text-slate-200" title="Quit mission">
        <LogOut size={16} aria-hidden className="sm:hidden" />
        <span className="hidden text-xs underline sm:inline">Quit</span>
        <span className="sr-only">Quit mission</span>
      </button>
      </div>
      </div>
    </header>
  )
}
