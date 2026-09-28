import { Apple, Clock, Droplet, Globe, Moon, Radiation, Trophy, Wind, Zap, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, type Dispatch } from 'react'
import { c } from '../sim/constants.ts'
import { resourceRates } from '../sim/effects.ts'
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
      <div className="flex items-start gap-4">
        <img src="/art/archspace-logo.webp" alt="ARCHSPACE" width={72} height={72} className="hidden shrink-0 sm:block" />
        <div>
        <p className="text-sm uppercase tracking-widest text-sky-300">Junior Astronaut Mission Trainer</p>
        <h1 className="mt-1 text-3xl font-bold">Keep your crew alive. Do the science.</h1>
        <p className="mt-2 text-slate-300">
          Four astronauts, one outpost. Every hour and every kilowatt you spend on safety is one you can't spend on science.
        </p>
        <p className="mt-1 text-sm text-slate-400">Each turn is one sol: a day at the base. You plan it, then play it.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => {
          const sc = SCENARIOS[id]
          return (
            <button
              key={id}
              type="button"
              onClick={() => start(id)}
              className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-left transition hover:border-yellow-300 active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
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

// Text that is the same on both worlds, or that depends on the game. The
// two worlds lose the same resource for different reasons -- the Moon's
// power runs out in the night, Mars's in a dust storm -- and advice that
// is right on one can be impossible on the other.
type LossText = string | ((g: GameState) => string)

interface LossInfo {
  icon: LucideIcon
  title: string
  whatHappened: (g: GameState) => string
  realWorld: LossText
  tryNext: LossText
}

const say = (text: LossText, g: GameState) => (typeof text === 'function' ? text(g) : text)

const pctOf = (x: number) => `${Math.round(x * 100)}%`

// Could the O₂ makers have kept up, had they been running?
const makersCoverCrew = (g: GameState) => {
  const r = resourceRates(g)
  return r.o2MakersKg >= r.crewUse.oxygenKg
}

// Each loss names what went wrong in this game and why it matters in real
// spaceflight. Figures come from constants.ts so they match the game.
const LOSS_INFO: Record<LossReason, LossInfo> = {
  water: {
    icon: Droplet,
    title: 'The crew ran out of water',
    whatHappened: (g) =>
      `By sol ${g.sol - 1} the base was at ${pctOf(g.facilities.condition)} condition, so the recycler was losing water faster than the crew could replace it.` +
      (g.scenario.evaDustWear > 0 ? ' Every shift outside brought in dust that wore it down.' : ''),
    realWorld: (g) =>
      `Each astronaut uses about ${c('CREW_WATER_L_PER_DAY')} L of water a day. Water is heavy to launch, so the ISS recycles about ${pctOf(c('WATER_RECOVERY_FRACTION'))} of it, from sweat and urine too. A recycler only works if someone keeps it running.` +
      (g.scenario.evaDustWear > 0
        ? ' Moon dust makes that harder: on Apollo it scratched suits and made seals fail, and Pete Conrad said their suits were more worn after 8 hours on the Moon than their training suits after 100.'
        : ''),
    tryNext: (g) =>
      g.scenario.evaDustWear > 0
        ? 'Keep someone repairing the base whenever its condition drops, and more of them while crew are working outside: every trip brings dust in.'
        : 'Keep someone repairing the base whenever its condition drops.',
  },
  oxygen: {
    icon: Wind,
    title: 'The crew ran out of oxygen',
    whatHappened: (g) =>
      !g.scenario.isruAvailable
        ? `The oxygen stock ran out before the next cargo lander arrived.`
        : makersCoverCrew(g)
          ? g.environment.dustStormSolsLeft > 0
            ? `The base had ${g.facilities.isruUnits} O₂ makers, enough for the crew, but they run on solar power, and in the dust storm there was not enough to keep them going.`
            : `The base had ${g.facilities.isruUnits} O₂ makers, enough for the crew, but they were switched off or short of power, and the oxygen ran out.`
          : `The base had ${g.facilities.isruUnits} O₂ maker${g.facilities.isruUnits === 1 ? '' : 's'}, not enough to cover what four people breathe.`,
    realWorld:
      `Each astronaut breathes about ${c('CREW_O2_KG_PER_DAY')} kg of oxygen a day, and without it a person passes out within minutes. That is why NASA tested MOXIE on Mars: making oxygen from the air means not shipping every kilogram from Earth.`,
    tryNext: (g) =>
      g.scenario.isruAvailable
        ? 'Build O₂ makers early, then build solar before the dust season, so they keep running through a storm. The top bar shows when it starts.'
        : 'Every kilogram comes by cargo lander, so fix air leaks properly rather than patching or ignoring them, and choose oxygen when there is room for an extra pallet.',
  },
  food: {
    icon: Apple,
    title: 'The crew ran out of food',
    whatHappened: (g) =>
      g.scenario.resupply
        ? `The greenhouse was ${g.facilities.greenhouseM2} m², and deliveries could not keep up with four hungry astronauts.`
        : `The greenhouse was ${g.facilities.greenhouseM2} m², and with no cargo coming before the next launch window, the stores ran out.`,
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
    realWorld: (g) =>
      `Life support needs about ${c('LIFE_SUPPORT_KW')} kW, all the time: it scrubs the air, makes it breathable and keeps the crew warm. ` +
      (g.scenario.dayNightCycle
        ? `The lunar night lasts ${c('LUNAR_NIGHT_HOURS')} hours, which is why NASA has been developing small fission reactors like Kilopower for the Moon.`
        : `A big Martian dust storm can cut the sunlight reaching the ground to about ${pctOf(c('DUST_STORM_SOLAR_FACTOR'))} for weeks. ` +
          'In 2018 one silenced NASA’s solar-powered Opportunity rover for good, which is why Curiosity and Perseverance carry nuclear power instead.'),
    tryNext: (g) =>
      g.scenario.dayNightCycle
        ? 'Switch off the lab and greenhouse before night falls, so the battery lasts until sunrise. The top bar shows how long until dark.'
        : `Build panels before the dust season, so they still cover life support at ${pctOf(c('DUST_STORM_SOLAR_FACTOR'))} of their output, and switch the lab and greenhouse off while a storm lasts. The top bar shows when the season starts.`,
  },
  radiation: {
    icon: Radiation,
    title: 'An astronaut passed their radiation limit',
    whatHappened: (g) => {
      const m = g.crew.reduce((a, b) => (b.doseMSv - b.careerDoseLimitMSv > a.doseMSv - a.careerDoseLimitMSv ? b : a))
      return `${m.name} reached ${Math.round(m.doseMSv)} mSv over their career. They must stop flying, and the mission cannot go on without them.`
    },
    realWorld:
      `NASA limits each astronaut to ${c('CAREER_DOSE_LIMIT_MSV')} mSv over a whole career, to keep their extra risk of dying from cancer small. Soil piled on a habitat (regolith) does little against cosmic rays but blocks solar storms well, which is why sheltering matters.`,
    tryNext: 'Build shielding, shelter from solar storms, and give spacewalks to the crew with the lowest dose.',
  },
  missionTimeout: {
    icon: Clock,
    title: 'The mission clock ran out',
    whatHappened: (g) => `The crew survived, but finished with ${g.sciencePoints} of the ${g.scenario.scienceTarget} science points needed.`,
    realWorld: (g) =>
      'Science is why we send people at all. ' +
      (g.scenario.id === 'moon'
        ? 'A crew’s time on the Moon is limited by the supplies it brings and its ride home, so every shift counts and the time cannot be stretched.'
        : 'Real missions have fixed windows: from Mars, a chance to fly home only comes around every 26 months or so, so time cannot be stretched.'),
    tryNext: (g) =>
      g.scenario.outsideWorkAtNight
        ? 'Once the base is safe, move crew off extra building and onto science. Playing it too safe is a way to fail too.'
        : 'Send crew out for field science while the Sun is up, and use the long nights for the lab and repairs: nothing gets done outside in the dark. Playing it too safe is a way to fail too.',
  },
}

export function EndScreen({ game, dispatch }: { game: GameState; dispatch: Dispatch<Action> }) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => panel.current?.focus(), [])
  const o = game.outcome
  const won = o.status === 'won'
  const info = o.status === 'lost' ? LOSS_INFO[o.reason] : null
  const LossIcon = info?.icon ?? Trophy
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="end-title">
      {/* Focus moves to the panel, not a button, so a screen reader starts at
          the title, and an Enter still held from advancing sols can't press
          Try again before the player has read why the mission ended. */}
      <div ref={panel} tabIndex={-1} className={`end-in w-full max-w-lg rounded-2xl border bg-slate-900 p-6 outline-none ${won ? 'border-emerald-400' : 'border-red-500'}`}>
        <p className="relative flex justify-center" aria-hidden>
          {/* One burst of light behind the trophy, and nothing behind a loss. */}
          {won && <span className="win-burst absolute inset-0 m-auto h-16 w-16 rounded-full bg-yellow-300/60 blur-lg" />}
          {won ? (
            <Trophy size={52} className="icon-pop relative text-yellow-300" />
          ) : (
            <LossIcon size={52} className="icon-settle relative text-red-400" />
          )}
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
            {[
              { head: 'What went wrong', tone: 'text-red-300', body: info!.whatHappened(game) },
              { head: 'Why it matters for real', tone: 'text-sky-300', body: say(info!.realWorld, game) },
              { head: 'Try next time', tone: 'text-yellow-300', body: say(info!.tryNext, game) },
            ].map((part, i) => (
              <div key={part.head} className="section-in" style={{ animationDelay: `${260 + i * 110}ms` }}>
                <p className={`font-semibold uppercase tracking-wider ${part.tone}`}>{part.head}</p>
                <p className="text-slate-200">{part.body}</p>
              </div>
            ))}
          </div>
        )}
        <MissionSummary game={game} />
        <p className="mt-3 text-center text-xs text-slate-500">
          Sol {game.sol - 1} · science {game.sciencePoints}/{game.scenario.scienceTarget} · seed {game.rng.seed}
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <button type="button" onClick={() => dispatch({ type: 'restart' })} className="rounded-xl bg-yellow-300 px-5 py-3 font-bold text-slate-900 transition hover:bg-yellow-200 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100">
            Try again
          </button>
          <button type="button" onClick={() => dispatch({ type: 'quit' })} className="rounded-xl border border-slate-600 px-5 py-3 font-semibold transition hover:border-slate-400 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100">
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
