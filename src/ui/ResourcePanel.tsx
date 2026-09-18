import { useMemo } from 'react'
import { advanceSol } from '../sim/advanceSol.ts'
import { BALANCE } from '../sim/balance.ts'
import { lifeSupportReserveKWh } from '../sim/forecast.ts'
import type { Decisions, GameState } from '../sim/types.ts'
import { METER_WHY, POWER_LABELS } from './labels.ts'
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
  const activeCrew = game.crew.filter((m) => m.status === 'active')
  const hoursAvailable = activeCrew.length * BALANCE.SHIFT_HOURS
  const hoursAssigned =
    game.environment.shelterSolsLeft > 0
      ? 0
      : activeCrew.filter((m) => (decisions.assignments[m.id] ?? 'rest') !== 'rest').length * BALANCE.SHIFT_HOURS

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
  const reserveLine =
    reserve.hardSols > 0 && reserveKWh > 0
      ? `Life support needs ${reserveKWh} kWh of battery to reach ${game.environment.dustStormSolsLeft > 0 && game.environment.isDaylight ? 'the end of the storm' : 'sunrise'}.` +
        (reserveShort ? ' Not enough: switch things off!' : '')
      : null
  const units = game.facilities.isruUnits
  const nextUnits = forecast?.facilities.isruUnits
  const o2Line = !game.scenario.isruAvailable
    ? 'Delivered by cargo landers'
    : nextUnits !== undefined && nextUnits !== units
      ? `${units} O₂ maker${units === 1 ? '' : 's'} → ${nextUnits} next sol`
      : `${units} O₂ maker${units === 1 ? '' : 's'} running`
  const recyclerLine =
    nextCond !== null
      ? `Recycler working at ${cond}% → ${nextCond}% next sol`
      : prevCond !== null && prevCond !== cond
        ? `Recycler working at ${cond}% (was ${prevCond}%)`
        : `Recycler working at ${cond}%`
  const repairShifts = game.environment.busyShifts + game.environment.busyEvaShifts
  const lastRepairs = game.lastReport?.repairShifts ?? 0
  return (
    <section aria-label="Resources" className="space-y-3">
      <Meter
        name="Power"
        forecast={isForecast}
        highlight={highlight === 'power'}
        icon="⚡"
        value={`${Math.round(r.storedPowerKWh)} kWh`}
        fill={r.storedPowerKWh / game.facilities.batteryCapacityKWh}
        delta={d?.storedPowerKWh}
        unit="kWh"
        amount={r.storedPowerKWh}
        why={METER_WHY.power(game.scenario)}
        detail={
          (reserveLine ? reserveLine + ' ' : '') +
          (report
            ? `${isForecast ? 'Next sol' : 'Last sol'}: made ${Math.round(report.powerGeneratedKWh)}, needed ${Math.round(report.powerDemandKWh)}` +
              (report.shedLoads.length ? ` · switched off: ${report.shedLoads.map((l) => POWER_LABELS[l]).join(', ')}` : '')
            : `Battery holds ${game.facilities.batteryCapacityKWh} kWh`)
        }
        warn={reserveShort || (report ? report.shedLoads.length > 0 : false)}
      />
      <Meter
        name="Oxygen"
        icon="🫁"
        value={`${Math.round(r.oxygenKg)} kg`}
        fill={r.oxygenKg / Math.max(start.oxygenKg, r.oxygenKg)}
        delta={d?.oxygenKg}
        unit="kg"
        amount={r.oxygenKg}
        forecast={isForecast}
        highlight={highlight === 'oxygen'}
        why={METER_WHY.oxygen(game.scenario)}
        detail={o2Line}
      />
      <Meter
        name="Water"
        icon="💧"
        value={`${Math.round(r.waterL)} L`}
        fill={r.waterL / Math.max(start.waterL, r.waterL)}
        delta={d?.waterL}
        unit="L"
        amount={r.waterL}
        forecast={isForecast}
        highlight={highlight === 'water'}
        why={METER_WHY.water(game.scenario)}
        detail={recyclerLine}
        warn={game.facilities.condition < 0.7}
      />
      <Meter
        name="Food"
        icon="🥔"
        value={`${Math.round(r.foodKg)} kg`}
        fill={r.foodKg / Math.max(start.foodKg, r.foodKg)}
        delta={d?.foodKg}
        unit="kg"
        amount={r.foodKg}
        forecast={isForecast}
        highlight={highlight === 'food'}
        why={METER_WHY.food(game.scenario)}
        detail={`Greenhouse ${game.facilities.greenhouseM2} m²`}
      />
      <Meter
        name="Radiation"
        forecast={isForecast}
        highlight={highlight === 'radiation'}
        icon="☢️"
        value={`${Math.round(worst.doseMSv)} / ${worst.careerDoseLimitMSv} mSv`}
        fill={worst.doseMSv / worst.careerDoseLimitMSv}
        invert
        delta={doseDelta}
        unit="mSv"
        why={METER_WHY.radiation(game.scenario)}
        detail={`Highest career dose: ${worst.name}`}
      />
      <Meter
        name="Crew time"
        forecast={isForecast}
        highlight={highlight === 'crew time'}
        icon="⏱️"
        value={`${hoursAssigned} / ${hoursAvailable} h`}
        fill={hoursAvailable ? hoursAssigned / hoursAvailable : 0}
        why={METER_WHY.crewTime(game.scenario)}
        detail={
          game.environment.shelterSolsLeft > 0
            ? 'Sheltering from a solar storm: no work this sol'
            : repairShifts > 0
              ? `${repairShifts} shift${repairShifts > 1 ? 's' : ''} still owed to repairs (taken from science first)`
              : lastRepairs > 0
                ? `Last sol, ${lastRepairs} shift${lastRepairs > 1 ? 's' : ''} went to repairs instead of the plan`
                : 'Hours of work planned for the next sol'
        }
        warn={repairShifts > 0 || lastRepairs > 0}
        neutral
      />
    </section>
  )
}

interface MeterProps {
  name: string
  icon: string
  value: string
  fill: number
  delta?: number
  unit?: string
  amount?: number // for a "sols left" estimate from the last sol's change
  why: Parameters<typeof WhyTooltip>[0]['why']
  detail?: string
  invert?: boolean  // higher is worse (radiation)
  neutral?: boolean // no good/bad colouring
  warn?: boolean
  forecast?: boolean  // delta is a forecast for the next sol, not last sol
  highlight?: boolean
}

function Meter({ name, icon, value, fill, delta, unit, amount, why, detail, invert, neutral, warn, forecast, highlight }: MeterProps) {
  const solsLeft = amount !== undefined && delta !== undefined && delta < -0.01 ? Math.floor(amount / -delta) : null
  // While a resource is draining, the bar shows how long it will last
  // (full = 40+ sols), so a crisis looks like one even when the stock is
  // at its usual level.
  const f = Math.max(0, Math.min(1, solsLeft !== null ? Math.min(fill, solsLeft / 40) : fill))
  const danger = invert ? f > 0.85 : f < 0.2
  const caution = invert ? f > 0.7 : f < 0.4
  const bar = neutral ? 'bg-sky-400' : danger ? 'bg-red-500' : caution ? 'bg-amber-400' : 'bg-emerald-400'

  return (
    <div className={`rounded-lg border p-2.5 ${danger && !neutral ? 'border-red-500/60 bg-red-950/30' : 'border-slate-700 bg-slate-900/60'} ${highlight ? 'ring-2 ring-yellow-300' : ''}`}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">
          <span aria-hidden>{icon}</span> {name}
        </span>
        <span className="flex items-center gap-2">
          <span className="tabular-nums">{value}</span>
          <WhyTooltip why={why} />
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded bg-slate-700" role="meter" aria-valuenow={Math.round(f * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={name}>
        <div className={`h-full ${bar} transition-all`} style={{ width: `${f * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between gap-2 text-[11px] text-slate-400">
        <span className={warn ? 'text-amber-300' : ''}>{detail}</span>
        {delta !== undefined && Math.abs(delta) >= 0.05 && (
          <span className={`shrink-0 tabular-nums ${(invert ? delta > 0 : delta < 0) ? 'text-red-300' : 'text-emerald-300'}`}>
            {forecast ? 'next sol: ' : ''}
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)} {unit}/sol{solsLeft !== null && solsLeft < 60 ? ` · ~${solsLeft} sols left` : ''}
          </span>
        )}
      </div>
    </div>
  )
}
