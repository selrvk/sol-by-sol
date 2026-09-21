import { Apple, Clock, Droplet, Globe, Moon, Radiation, Trophy, Wind, Zap, type LucideIcon } from 'lucide-react'
import type { Dispatch } from 'react'
import { c } from '../sim/constants.ts'
import type { GameState, LossReason, ScenarioId } from '../sim/types.ts'
import type { Action } from './gameReducer.ts'
import { SCENARIOS } from './gameReducer.ts'
import { SCENARIO_BLURBS } from './labels.ts'

// A fresh seed per game. The sim itself never calls Math.random: the seed
// is shown on the end screen so a game can be replayed exactly. Passing
// ?seed=123 in the address replays a particular mission, which is handy for
// sharing a run or reproducing a bug.
function newSeed(): number {
  const asked = Number(new URLSearchParams(window.location.search).get('seed'))
  if (Number.isFinite(asked) && asked > 0) return Math.floor(asked)
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
              {id === 'moon' ? (
                <Moon size={36} className="text-amber-200" aria-hidden />
              ) : (
                <Globe size={36} className="text-red-400" aria-hidden />
              )}
              <h2 className="mt-2 text-xl font-bold">{sc.name}</h2>
              <p className="mt-1 text-sm text-slate-300">{SCENARIO_BLURBS[id]}</p>
              <p className="mt-3 text-sm text-violet-300">
                You take command on sol {sc.start.sol}. Goal: {sc.scienceTarget} science by sol {sc.missionLengthSols}.
              </p>
            </button>
          )
        })}
      </div>
    </main>
  )
}

interface LossInfo {
  icon: LucideIcon
  title: string
  whatHappened: (g: GameState) => string
  realWorld: string
  tryNext: string
}

const pctOf = (x: number) => `${Math.round(x * 100)}%`

// Each loss names what went wrong in this game and why it matters in real
// spaceflight. Figures come from constants.ts so they match the game.
const LOSS_INFO: Record<LossReason, LossInfo> = {
  water: {
    icon: Droplet,
    title: 'The crew ran out of water',
    whatHappened: (g) =>
      `By sol ${g.sol - 1} the base was at ${pctOf(g.facilities.condition)} condition, so the recycler was losing water faster than the crew could replace it.`,
    realWorld:
      `Each astronaut uses about ${c('CREW_WATER_L_PER_DAY')} L of water a day. Water is heavy to launch, so the ISS recycles about ${pctOf(c('WATER_RECOVERY_FRACTION'))} of it, from sweat and urine too. A recycler only works if someone keeps it running.`,
    tryNext: 'Keep someone on Maintenance whenever the base condition drops.',
  },
  oxygen: {
    icon: Wind,
    title: 'The crew ran out of oxygen',
    whatHappened: (g) =>
      g.scenario.isruAvailable
        ? `The base had ${g.facilities.isruUnits} O₂ maker${g.facilities.isruUnits === 1 ? '' : 's'}, not enough to cover what four people breathe.`
        : `The oxygen stock ran out before the next cargo lander arrived.`,
    realWorld:
      `Each astronaut breathes about ${c('CREW_O2_KG_PER_DAY')} kg of oxygen a day, and without it a person passes out within minutes. That is why NASA tested MOXIE on Mars: making oxygen from the air means not shipping every kilogram from Earth.`,
    tryNext: 'Build O₂ makers early, and keep enough solar power to run them through dust storms.',
  },
  food: {
    icon: Apple,
    title: 'The crew ran out of food',
    whatHappened: (g) => `The greenhouse was ${g.facilities.greenhouseM2} m², and deliveries could not keep up with four hungry astronauts.`,
    realWorld:
      `Each astronaut gets through about ${c('CREW_FOOD_KG_PER_DAY')} kg of packaged food a day. NASA's Veggie experiment has grown lettuce on the ISS, but growing a whole diet takes a lot of space and power.`,
    tryNext: 'Grow the greenhouse, and keep it powered when you can.',
  },
  power: {
    icon: Zap,
    title: 'Life support lost power',
    whatHappened: (g) =>
      g.scenario.dayNightCycle
        ? 'The battery ran flat during the long lunar night. Every system left on drained power that life support needed later.'
        : 'A dust storm dimmed the Sun and the solar panels could not keep life support running.',
    realWorld:
      `Life support needs about ${c('LIFE_SUPPORT_KW')} kW, all the time: it scrubs the air, makes it breathable and keeps the crew warm. The lunar night lasts ${c('LUNAR_NIGHT_HOURS')} hours, which is why NASA has been developing small fission reactors like Kilopower for the Moon.`,
    tryNext: 'Switch off the lab and greenhouse at night or in a storm, and build panels before storms hit.',
  },
  radiation: {
    icon: Radiation,
    title: 'An astronaut passed their radiation limit',
    whatHappened: (g) => {
      const m = g.crew.reduce((a, b) => (b.doseMSv - b.careerDoseLimitMSv > a.doseMSv - a.careerDoseLimitMSv ? b : a))
      return `${m.name} reached ${Math.round(m.doseMSv)} mSv over their career. They must stop flying, and the mission cannot go on without them.`
    },
    realWorld:
      `NASA limits each astronaut to ${c('CAREER_DOSE_LIMIT_MSV')} mSv over a whole career, to keep their extra risk of dying from cancer small. Piled regolith does little against cosmic rays but blocks solar storms well, which is why sheltering matters.`,
    tryNext: 'Pile regolith, shelter from solar storms, and give spacewalks to the crew with the lowest dose.',
  },
  missionTimeout: {
    icon: Clock,
    title: 'The mission clock ran out',
    whatHappened: (g) => `The crew survived, but finished with ${g.sciencePoints} of the ${g.scenario.scienceTarget} science points needed.`,
    realWorld:
      'Science is why we send people at all. Real missions have fixed windows: from Mars, a chance to fly home only comes around every 26 months or so, so time cannot be stretched.',
    tryNext: 'Once the base is safe, move crew off extra building and onto science. Playing it too safe is a way to fail too.',
  },
}

export function EndScreen({ game, dispatch }: { game: GameState; dispatch: Dispatch<Action> }) {
  const o = game.outcome
  const won = o.status === 'won'
  const info = o.status === 'lost' ? LOSS_INFO[o.reason] : null
  const LossIcon = info?.icon ?? Trophy
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="end-title">
      <div className={`w-full max-w-lg rounded-2xl border bg-slate-900 p-6 ${won ? 'border-emerald-400' : 'border-red-500'}`}>
        <p className="flex justify-center" aria-hidden>
          {won ? <Trophy size={52} className="text-yellow-300" /> : <LossIcon size={52} className="text-red-400" />}
        </p>
        <h2 id="end-title" className="mt-2 text-center text-2xl font-bold">
          {won ? 'Mission accomplished!' : info!.title}
        </h2>
        {won ? (
          <p className="mt-3 text-center text-slate-300">
            Science target reached on sol {game.sol - 1}, with {game.scenario.missionLengthSols - game.sol} sols to spare, and the whole crew is safe.
          </p>
        ) : (
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="font-semibold uppercase tracking-wider text-red-300">What went wrong</p>
              <p className="text-slate-200">{info!.whatHappened(game)}</p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-wider text-sky-300">Why it matters for real</p>
              <p className="text-slate-200">{info!.realWorld}</p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-wider text-yellow-300">Try next time</p>
              <p className="text-slate-200">{info!.tryNext}</p>
            </div>
          </div>
        )}
        <MissionSummary game={game} />
        <p className="mt-3 text-center text-xs text-slate-500">
          Sol {game.sol - 1} · science {game.sciencePoints}/{game.scenario.scienceTarget} · seed {game.rng.seed}
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <button type="button" onClick={() => dispatch({ type: 'restart' })} className="rounded-xl bg-yellow-300 px-5 py-3 font-bold text-slate-900 hover:bg-yellow-200">
            Try again
          </button>
          <button type="button" onClick={() => dispatch({ type: 'quit' })} className="rounded-xl border border-slate-600 px-5 py-3 font-semibold hover:border-slate-400">
            Choose world
          </button>
        </div>
      </div>
    </div>
  )
}

// A short mission report: the crew's radiation and what the base became.
function MissionSummary({ game }: { game: GameState }) {
  const f = game.facilities
  const start = game.scenario.start.facilities
  const built = (now: number, then: number, unit: string) => `${now}${unit}${now !== then ? ` (${now > then ? '+' : ''}${now - then})` : ''}`
  return (
    <div className="mt-4 grid gap-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-xs sm:grid-cols-2">
      <div>
        <p className="mb-1 font-semibold uppercase tracking-wider text-slate-400">Crew career dose</p>
        <ul className="space-y-0.5">
          {game.crew.map((m) => (
            <li key={m.id} className="flex justify-between tabular-nums">
              <span>{m.name}</span>
              <span className={m.doseMSv > m.careerDoseLimitMSv ? 'text-red-300' : m.doseMSv > 0.85 * m.careerDoseLimitMSv ? 'text-amber-300' : 'text-slate-300'}>
                {Math.round(m.doseMSv)} / {m.careerDoseLimitMSv} mSv
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-1 font-semibold uppercase tracking-wider text-slate-400">Your base</p>
        <ul className="space-y-0.5 tabular-nums text-slate-300">
          <li>Solar panels: {built(f.solarArrayM2, start.solarArrayM2, ' m²')}</li>
          <li>Greenhouse: {built(f.greenhouseM2, start.greenhouseM2, ' m²')}</li>
          <li>Shielding level: {built(f.shieldingLevel, start.shieldingLevel, '')}</li>
          {game.scenario.isruAvailable && <li>O₂ makers: {built(f.isruUnits, start.isruUnits, '')}</li>}
          <li>Condition: {Math.round(f.condition * 100)}%</li>
        </ul>
      </div>
    </div>
  )
}
