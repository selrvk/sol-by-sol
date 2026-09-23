import { Apple, Droplet, Radiation, Users, Zap } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { advanceSol } from '../sim/advanceSol.ts'
import { BALANCE } from '../sim/balance.ts'
import { lifeSupportReserveKWh, nextResupplySol, nightAhead } from '../sim/forecast.ts'
import type { Decisions, GameState } from '../sim/types.ts'
import { METER_WHY, POWER_LABELS } from './labels.ts'
import { AnimatedValue } from './AnimatedValue.tsx'
import { WhyTooltip } from './WhyTooltip.tsx'

interface Props {
  game: GameState
  previous: GameState | null
  decisions: Decisions
  highlight?: string // meter name to draw attention to
}

export function ResourcePanel({ game, previous, decisions, highlight }: Props) {
  const r = game.resources
  const start = game.scenario.start.resources
  // Before the first sol there is nothing to compare with, so show a
  // forecast: the pure sim run one sol ahead with the current plan. It
  // updates as the player changes tasks, which is how the loop is learned.
  const forecast = useMemo(() => (game.lastReport ? null : advanceSol(game, decisions)), [game, decisions])
  const d = (game.lastReport ?? forecast?.lastReport)?.resourceDeltas
  const isForecast = forecast !== null

  const worst = game.crew.reduce((a, b) => (b.doseMSv / b.careerDoseLimitMSv > a.doseMSv / a.careerDoseLimitMSv ? b : a))
  const prevWorst = previous?.crew.find((m) => m.id === worst.id)
  const nextWorst = forecast?.crew.find((m) => m.id === worst.id)
  const doseDelta = prevWorst ? worst.doseMSv - prevWorst.doseMSv : nextWorst ? nextWorst.doseMSv - worst.doseMSv : undefined
  const hoursAvailable = game.crew.length * BALANCE.SHIFT_HOURS
  const hoursAssigned =
    game.environment.shelterSolsLeft > 0
      ? 0
      : game.crew.filter((m) => (decisions.assignments[m.id] ?? 'rest') !== 'rest').length * BALANCE.SHIFT_HOURS

  const report = game.lastReport ?? forecast?.lastReport ?? null
  // Base condition drives water recovery. Show where it is heading so the
  // effect of maintenance is visible the moment it is assigned.
  const cond = Math.round(game.facilities.condition * 100)
  const nextCond = forecast ? Math.round(forecast.facilities.condition * 100) : null
  const prevCond = previous ? Math.round(previous.facilities.condition * 100) : null
  // Through a night or dust storm, how much battery life support will need.
  const reserve = lifeSupportReserveKWh(game)
  const reserveKWh = Math.ceil(reserve.reserveKWh)
  const reserveShort = reserve.hardSols > 0 && r.storedPowerKWh < reserveKWh
  // Warn while there is still daylight to act in: the whole night's life
  // support has to come out of the battery.
  const ahead = nightAhead(game, decisions)
  const battery = game.facilities.batteryCapacityKWh
  const nightWarning = !ahead || ahead.inSols > 5
    ? null
    : ahead.plannedKWh > battery
      ? `Night in ${ahead.inSols} sol${ahead.inSols === 1 ? '' : 's'}: this plan needs ~${Math.ceil(ahead.plannedKWh)} kWh through ${ahead.nightSols} dark sols, ` +
        `but the battery holds ${battery}. Switch the lab and greenhouse off at night — life support alone needs ~${Math.ceil(ahead.reserveKWh)} kWh.`
      : `Night in ${ahead.inSols} sol${ahead.inSols === 1 ? '' : 's'}: ~${Math.ceil(ahead.plannedKWh)} kWh of battery sees this plan through ${ahead.nightSols} dark sols.`
  const reserveLine =
    reserve.hardSols > 0 && reserveKWh > 0
      ? `Life support needs ${reserveKWh} kWh to reach ${game.environment.dustStormSolsLeft > 0 && game.environment.isDaylight ? 'the end of the storm' : 'sunrise'}.` +
        (reserveShort ? ' Not enough — switch things off!' : '')
      : null
  const units = game.facilities.isruUnits
  const nextUnits = forecast?.facilities.isruUnits
  // Where the Moon's oxygen comes from, and when the next lot arrives.
  const lander = game.scenario.resupply
  const nextLander = nextResupplySol(game.scenario, game.sol)
  const o2Line = !game.scenario.isruAvailable
    ? lander && nextLander !== null && nextLander < game.scenario.missionLengthSols
      ? `Next cargo lander: sol ${nextLander} (+${lander.cargo.oxygenKg} kg)`
      : 'No more cargo landers before the mission ends'
    : nextUnits !== undefined && nextUnits !== units
      ? `${units} O₂ maker${units === 1 ? '' : 's'} → ${nextUnits} next sol`
      : `${units} O₂ maker${units === 1 ? '' : 's'} running`
  // Base condition is what the recycler runs at, so the Water box is where
  // it is shown. One name for it everywhere: base condition.
  const conditionLine =
    nextCond !== null
      ? `Base condition ${cond}% → ${nextCond}% next sol`
      : prevCond !== null && prevCond !== cond
        ? `Base condition ${cond}% (was ${prevCond}%)`
        : `Base condition ${cond}%`
  const repairShifts = game.environment.busyShifts + game.environment.busyEvaShifts
  const lastRepairs = game.lastReport?.repairShifts ?? 0
  return (
    <section aria-label="Mission status" className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-300">
        <Users size={16} className="text-sky-300" aria-hidden /> Mission status
      </h2>
      <Meter
        name="Power"
        valueText={`${Math.round(r.storedPowerKWh)} of ${game.facilities.batteryCapacityKWh} kWh stored`}
        forecast={isForecast}
        tick={game.sol}
        highlight={highlight === 'power'}
        icon={<Badge tone="amber"><Zap size={17} fill="currentColor" /></Badge>}
        value={<AnimatedValue value={r.storedPowerKWh} suffix=" kWh" />}
        fill={r.storedPowerKWh / game.facilities.batteryCapacityKWh}
        delta={d?.storedPowerKWh}
        unit="kWh"
        amount={r.storedPowerKWh}
        why={METER_WHY.power(game.scenario)}
        warning={nightWarning ?? reserveLine}
        detail={
          report
            ? `${isForecast ? 'Next sol' : 'Last sol'}: made ${Math.round(report.powerGeneratedKWh)}, needed ${Math.round(report.powerDemandKWh)}` +
              (report.shedLoads.length ? ` · off: ${report.shedLoads.map((l) => POWER_LABELS[l]).join(', ')}` : '')
            : `Battery holds ${game.facilities.batteryCapacityKWh} kWh`
        }
        warn={reserveShort || nightWarning !== null || (report ? report.shedLoads.length > 0 : false)}
      />
      <Meter
        name="Oxygen"
        valueText={`${Math.round(r.oxygenKg)} kg`}
        icon={<Badge tone="sky"><span className="text-xs font-bold">O₂</span></Badge>}
        value={<AnimatedValue value={r.oxygenKg} suffix=" kg" />}
        fill={r.oxygenKg / Math.max(start.oxygenKg, r.oxygenKg)}
        delta={d?.oxygenKg}
        unit="kg"
        amount={r.oxygenKg}
        forecast={isForecast}
        tick={game.sol}
        highlight={highlight === 'oxygen'}
        why={METER_WHY.oxygen(game.scenario)}
        detail={o2Line}
      />
      <Meter
        name="Water"
        valueText={`${Math.round(r.waterL)} litres`}
        icon={<Badge tone="blue"><Droplet size={17} fill="currentColor" /></Badge>}
        value={<AnimatedValue value={r.waterL} suffix=" L" />}
        fill={r.waterL / Math.max(start.waterL, r.waterL)}
        delta={d?.waterL}
        unit="L"
        amount={r.waterL}
        forecast={isForecast}
        tick={game.sol}
        highlight={highlight === 'water'}
        why={METER_WHY.water(game.scenario)}
        detail={conditionLine}
        warn={game.facilities.condition < 0.7}
      />
      <Meter
        name="Food"
        valueText={`${Math.round(r.foodKg)} kg`}
        icon={<Badge tone="green"><Apple size={17} fill="currentColor" /></Badge>}
        value={<AnimatedValue value={r.foodKg} suffix=" kg" />}
        fill={r.foodKg / Math.max(start.foodKg, r.foodKg)}
        delta={d?.foodKg}
        unit="kg"
        amount={r.foodKg}
        forecast={isForecast}
        tick={game.sol}
        highlight={highlight === 'food'}
        why={METER_WHY.food(game.scenario)}
        detail={`Greenhouse ${game.facilities.greenhouseM2} m²`}
      />
      <Meter
        name="Radiation"
        valueText={`${Math.round(worst.doseMSv)} of ${worst.careerDoseLimitMSv} mSv, highest in the crew: ${worst.name}`}
        forecast={isForecast}
        tick={game.sol}
        highlight={highlight === 'radiation'}
        icon={<Badge tone="yellow"><Radiation size={17} /></Badge>}
        value={<><AnimatedValue value={worst.doseMSv} /> / {worst.careerDoseLimitMSv} mSv</>}
        fill={worst.doseMSv / worst.careerDoseLimitMSv}
        invert
        delta={doseDelta}
        unit="mSv"
        why={METER_WHY.radiation(game.scenario)}
        detail={`Highest career dose: ${worst.name}`}
      />
      <Meter
        name="Crew time"
        valueText={`${hoursAssigned} of ${hoursAvailable} hours assigned`}
        forecast={isForecast}
        tick={game.sol}
        highlight={highlight === 'crew time'}
        icon={<Badge tone="indigo"><Users size={17} /></Badge>}
        value={`${hoursAssigned} / ${hoursAvailable} h`}
        fill={hoursAvailable ? hoursAssigned / hoursAvailable : 0}
        why={METER_WHY.crewTime(game.scenario)}
        detail={
          game.environment.shelterSolsLeft > 0
            ? 'Sheltering from a solar storm: no work this sol'
            : repairShifts > 0
              ? `${repairShifts} shift${repairShifts > 1 ? 's' : ''} owed to repairs, taken from science first`
              : lastRepairs > 0
                ? `Last sol ${lastRepairs} shift${lastRepairs > 1 ? 's' : ''} went to repairs, not the plan`
                : 'Planned for the next sol'
        }
        warn={repairShifts > 0 || lastRepairs > 0}
        neutral
      />
    </section>
  )
}

interface MeterProps {
  name: string
  // What a screen reader says for the bar. The bar's own fill is not a
  // number on screen: while a resource drains it shows sols left instead.
  valueText: string
  icon: ReactNode
  value: ReactNode
  fill: number
  delta?: number
  unit?: string
  amount?: number // for a "sols left" estimate from the last sol's change
  why: Parameters<typeof WhyTooltip>[0]['why']
  detail?: string
  warning?: string | null // shown on its own line, and may wrap
  invert?: boolean  // higher is worse (radiation)
  neutral?: boolean // no good/bad colouring
  warn?: boolean
  tick?: number       // changes each sol, so the delta animation replays
  forecast?: boolean  // delta is a forecast for the next sol, not last sol
  highlight?: boolean
}

function Meter({ name, valueText, icon, value, fill, delta, unit, amount, why, detail, warning, invert, neutral, warn, forecast, highlight, tick }: MeterProps) {
  const solsLeft = amount !== undefined && delta !== undefined && delta < -0.01 ? Math.floor(amount / -delta) : null
  // While a resource is draining, the bar shows how long it will last
  // (full = 40+ sols), so a crisis looks like one even when the stock is
  // at its usual level.
  const f = Math.max(0, Math.min(1, solsLeft !== null ? Math.min(fill, solsLeft / 40) : fill))
  const danger = invert ? f > 0.85 : f < 0.2
  const caution = invert ? f > 0.7 : f < 0.4
  const bar = neutral ? 'bg-sky-400' : danger ? 'bg-red-500' : caution ? 'bg-amber-400' : 'bg-emerald-400'

  return (
    <div className={`flex gap-2.5 rounded-xl border p-2 ${danger && !neutral ? 'border-red-500/60 bg-red-950/30' : 'border-slate-700/80 bg-slate-950/50'} ${highlight ? 'ring-2 ring-yellow-300' : ''}`}>
      {icon}
      <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold">{name}</span>
        <span className="flex items-center gap-2">
          <span className="tabular-nums">{value}</span>
          <WhyTooltip why={why} />
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded bg-slate-700" role="meter" aria-valuenow={Math.round(f * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={name}
        aria-valuetext={valueText + (solsLeft !== null && solsLeft < 60 ? `, about ${solsLeft} sols left` : '')}>
        <div className={`h-full ${bar} transition-all`} style={{ width: `${f * 100}%` }} />
      </div>
      {/* A warning gets its own line, above the running detail, so a long
          one does not push the numbers around. */}
      {warning && <p className="mt-1 text-[11px] font-semibold text-amber-300">{warning}</p>}
      <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-2 text-[11px] leading-tight text-slate-400">
        <span className={warn ? 'text-amber-300' : ''}>{detail}</span>
        {delta !== undefined && Math.abs(delta) >= 0.05 && (
          <span key={tick} className={`delta-pop ml-auto shrink-0 whitespace-nowrap tabular-nums ${(invert ? delta > 0 : delta < 0) ? 'text-red-300' : 'text-emerald-300'}`}>
            {forecast ? 'next sol: ' : ''}
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)} {unit}/sol{solsLeft !== null && solsLeft < 60 ? ` · ~${solsLeft} sols left` : ''}
          </span>
        )}
      </div>
      </div>
    </div>
  )
}

const BADGE_TONES = {
  amber: 'bg-amber-400/15 text-amber-300 ring-amber-300/30',
  sky: 'bg-sky-400/15 text-sky-300 ring-sky-300/30',
  blue: 'bg-blue-400/15 text-blue-300 ring-blue-300/30',
  green: 'bg-emerald-400/15 text-emerald-300 ring-emerald-300/30',
  yellow: 'bg-yellow-400/15 text-yellow-300 ring-yellow-300/30',
  indigo: 'bg-indigo-400/15 text-indigo-300 ring-indigo-300/30',
}

// The round icon badge at the left of each meter.
function Badge({ tone, children }: { tone: keyof typeof BADGE_TONES; children: ReactNode }) {
  return (
    <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  )
}
