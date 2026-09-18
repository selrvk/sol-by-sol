import { BALANCE } from '../sim/balance.ts'
import type { Decisions, GameState } from '../sim/types.ts'
import { METER_SOURCES, POWER_LABELS } from './labels.ts'
import { WhyTooltip } from './WhyTooltip.tsx'

interface Props {
  game: GameState
  previous: GameState | null
  decisions: Decisions
}

export function ResourcePanel({ game, previous, decisions }: Props) {
  const r = game.resources
  const start = game.scenario.start.resources
  const d = game.lastReport?.resourceDeltas
  const sc = game.scenario.id

  const worst = game.crew.reduce((a, b) => (b.doseMSv / b.careerDoseLimitMSv > a.doseMSv / a.careerDoseLimitMSv ? b : a))
  const prevWorst = previous?.crew.find((m) => m.id === worst.id)
  const activeCrew = game.crew.filter((m) => m.status === 'active')
  const hoursAvailable = activeCrew.length * BALANCE.SHIFT_HOURS
  const hoursAssigned =
    game.environment.shelterSolsLeft > 0
      ? 0
      : activeCrew.filter((m) => (decisions.assignments[m.id] ?? 'rest') !== 'rest').length * BALANCE.SHIFT_HOURS

  const report = game.lastReport
  return (
    <section aria-label="Resources" className="space-y-3">
      <Meter
        name="Power"
        icon="⚡"
        value={`${Math.round(r.storedPowerKWh)} kWh`}
        fill={r.storedPowerKWh / game.facilities.batteryCapacityKWh}
        delta={d?.storedPowerKWh}
        unit="kWh"
        amount={r.storedPowerKWh}
        why={METER_SOURCES.power(sc)}
        detail={
          report
            ? `Last sol: made ${Math.round(report.powerGeneratedKWh)}, needed ${Math.round(report.powerDemandKWh)}` +
              (report.shedLoads.length ? ` · switched off: ${report.shedLoads.map((l) => POWER_LABELS[l]).join(', ')}` : '')
            : `Battery holds ${game.facilities.batteryCapacityKWh} kWh`
        }
        warn={report ? report.shedLoads.length > 0 : false}
      />
      <Meter name="Oxygen" icon="🫁" value={`${Math.round(r.oxygenKg)} kg`} fill={r.oxygenKg / Math.max(start.oxygenKg, r.oxygenKg)} delta={d?.oxygenKg} unit="kg" amount={r.oxygenKg} why={METER_SOURCES.oxygen(sc)} />
      <Meter name="Water" icon="💧" value={`${Math.round(r.waterL)} L`} fill={r.waterL / Math.max(start.waterL, r.waterL)} delta={d?.waterL} unit="L" amount={r.waterL} why={METER_SOURCES.water(sc)} />
      <Meter name="Food" icon="🥔" value={`${Math.round(r.foodKg)} kg`} fill={r.foodKg / Math.max(start.foodKg, r.foodKg)} delta={d?.foodKg} unit="kg" amount={r.foodKg} why={METER_SOURCES.food(sc)} />
      <Meter
        name="Radiation"
        icon="☢️"
        value={`${Math.round(worst.doseMSv)} / ${worst.careerDoseLimitMSv} mSv`}
        fill={worst.doseMSv / worst.careerDoseLimitMSv}
        invert
        delta={prevWorst ? worst.doseMSv - prevWorst.doseMSv : undefined}
        unit="mSv"
        why={METER_SOURCES.radiation(sc)}
        detail={`Highest career dose: ${worst.name}`}
      />
      <Meter
        name="Crew time"
        icon="⏱️"
        value={`${hoursAssigned} / ${hoursAvailable} h`}
        fill={hoursAvailable ? hoursAssigned / hoursAvailable : 0}
        why={METER_SOURCES.crewTime(sc)}
        detail={game.environment.shelterSolsLeft > 0 ? 'Sheltering from a solar storm: no work this sol' : 'Hours of work planned for the next sol'}
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
  why: Parameters<typeof WhyTooltip>[0]['refs']
  detail?: string
  invert?: boolean  // higher is worse (radiation)
  neutral?: boolean // no good/bad colouring
  warn?: boolean
}

function Meter({ name, icon, value, fill, delta, unit, amount, why, detail, invert, neutral, warn }: MeterProps) {
  const f = Math.max(0, Math.min(1, fill))
  const danger = invert ? f > 0.85 : f < 0.2
  const caution = invert ? f > 0.7 : f < 0.4
  const bar = neutral ? 'bg-sky-400' : danger ? 'bg-red-500' : caution ? 'bg-amber-400' : 'bg-emerald-400'
  const solsLeft = amount !== undefined && delta !== undefined && delta < -0.01 ? Math.floor(amount / -delta) : null

  return (
    <div className={`rounded-lg border p-2.5 ${danger && !neutral ? 'border-red-500/60 bg-red-950/30' : 'border-slate-700 bg-slate-900/60'}`}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">
          <span aria-hidden>{icon}</span> {name}
        </span>
        <span className="flex items-center gap-2">
          <span className="tabular-nums">{value}</span>
          <WhyTooltip refs={why} />
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded bg-slate-700" role="meter" aria-valuenow={Math.round(f * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={name}>
        <div className={`h-full ${bar} transition-all`} style={{ width: `${f * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between gap-2 text-[11px] text-slate-400">
        <span className={warn ? 'text-amber-300' : ''}>{detail}</span>
        {delta !== undefined && Math.abs(delta) >= 0.05 && (
          <span className={`shrink-0 tabular-nums ${(invert ? delta > 0 : delta < 0) ? 'text-red-300' : 'text-emerald-300'}`}>
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)} {unit}/sol{solsLeft !== null && solsLeft < 60 ? ` · ~${solsLeft} sols left` : ''}
          </span>
        )}
      </div>
    </div>
  )
}
