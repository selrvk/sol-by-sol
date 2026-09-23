// Presentation text only. No game rules here.

import { BedDouble, FlaskConical, Mountain, Pickaxe, Sprout, Sun, Wind, Wrench, type LucideIcon } from 'lucide-react'
import { c, type ConstantKey, type CurveKey } from '../sim/constants.ts'
import type { ResourceRates, TaskEffects } from '../sim/effects.ts'
import type { CrewTask, GameState, PowerLoad, Scenario, ScenarioId } from '../sim/types.ts'

// What each task is called. What it does is worked out live: see describeTask.
export const TASK_LABELS: Record<CrewTask, { label: string; short: string }> = {
  labScience: { label: 'Lab science', short: 'Lab' },
  fieldScience: { label: 'Field science', short: 'Field' },
  greenhouse: { label: 'Grow greenhouse', short: 'Grow' },
  solar: { label: 'Build solar', short: 'Solar' },
  // Named for what it builds, so it matches "Shielding" wherever the base
  // shows it. What it is -- soil piled on the habitat -- is in its line.
  shielding: { label: 'Build shielding', short: 'Shield' },
  maintenance: { label: 'Maintenance', short: 'Repair' },
  isru: { label: 'Build O₂ maker', short: 'O₂' },
  rest: { label: 'Rest', short: 'Rest' },
}

// One line per task saying what a shift of it does, the same shape for every
// task: what changes, then what it lasts or costs, then what it is for. The
// numbers are the sim's own for this base, live (taskEffects), so "2 → 3" is
// this base's shielding, not an example. `warn` is set when the shift would
// do nothing or next to nothing, and is shown in amber: a task at its limit,
// lab science with the lab switched off, shielding where the air already
// does the job.
export interface TaskLine {
  does: string
  warn?: string
}

const one = (x: number) => String(Math.round(x * 10) / 10) // 0.21 -> "0.2", 21.4 -> "21.4"
const whole = (x: number) => String(Math.round(x))
const pct = (x: number) => `${one(x * 100)}%` // 0.029 -> "2.9%"

export function describeTask(task: CrewTask, fx: TaskEffects): TaskLine {
  switch (task) {
    case 'labScience':
      return {
        does: `+${fx.labScience.science} science point · only while the lab has power`,
        warn: fx.labScience.labOn ? undefined : 'The lab is switched off: this shift earns nothing.',
      }
    case 'fieldScience': {
      const f = fx.fieldScience
      return {
        does:
          `+${f.science} science points · outside, so +${one(f.extraDoseMSv)} mSv radiation a sol` +
          (f.stormExtraMSv >= 1 ? `, and +${whole(f.stormExtraMSv)} mSv more if a solar storm hits` : ''),
      }
    }
    case 'greenhouse': {
      const g = fx.greenhouse
      return { does: `+${g.m2} m² → +${one(g.foodKg)} kg food a sol · its lights use +${whole(g.powerKWh)} kWh a sol · +${pct(g.wear)} base wear a sol` }
    }
    case 'solar': {
      const s = fx.solar
      if (s.m2 === 0) return { does: `Panels are at the limit, ${s.maxM2} m²`, warn: 'No room for more panels: this shift does nothing.' }
      const dark = s.hasNight ? ' · none at night' : s.hasStorms ? ' · much less in a dust storm' : ''
      return { does: `+${s.m2} m² → +${whole(s.sunKWh)} kWh a sol in sunlight${dark} · limit ${s.maxM2} m²` }
    }
    case 'shielding': {
      const s = fx.shielding
      if (s.level >= s.max) return { does: `Shielding ${s.max} of ${s.max}`, warn: 'Shielding is already at maximum: this shift does nothing.' }
      const lasts = s.canBeLost ? 'lasts unless a moonquake shakes it loose' : 'never wears off'
      const base = `+1 shielding (${s.level} → ${s.next} of ${s.max}): soil piled on the habitat · ${lasts}`
      if (s.stormMSv - s.stormNextMSv >= 0.5) return { does: `${base} · a solar storm indoors: ${one(s.stormMSv)} → ${one(s.stormNextMSv)} mSv` }
      return {
        does: base,
        warn: s.airShields
          ? 'Barely helps here: Mars’s air already blocks most solar-storm radiation.'
          : 'Barely helps now: indoors is already about as safe as the storm shelter.',
      }
    }
    case 'maintenance': {
      const m = fx.maintenance
      return { does: `+${pct(m.repair)} base condition (now ${whole(m.condition * 100)}%, wears ${pct(m.wear)} a sol) · sets water recycling and solar power` }
    }
    case 'isru': {
      const i = fx.isru
      return { does: `+1 O₂ maker → +${one(i.kgO2)} kg oxygen a sol (the crew breathes ${one(i.crewBreathesKg)}) · uses ${whole(i.powerKWh)} kWh a sol · +${pct(i.wear)} base wear a sol` }
    }
    case 'rest':
      return { does: 'Nothing built or earned · no extra radiation' }
  }
}

// Crew portraits, cut from the two art sheets by art/process.py. Each
// astronaut has an indoor face and a helmeted one; the game shows the
// helmet whenever they are working outside. Keyed by crew id, so swapping
// who looks like whom is a one-line change.
interface Portrait {
  inside: string
  eva: string
  accent: string // the disc colour painted behind them, for rings and dots
}

export const CREW_PORTRAITS: Record<string, Portrait> = {
  ada: { inside: '/art/crew/crew-1.webp', eva: '/art/crew/crew-1-eva.webp', accent: '#2f72d9' },
  kofi: { inside: '/art/crew/crew-2.webp', eva: '/art/crew/crew-2-eva.webp', accent: '#31ac90' },
  mei: { inside: '/art/crew/crew-3.webp', eva: '/art/crew/crew-3-eva.webp', accent: '#f8a24b' },
  luis: { inside: '/art/crew/crew-4.webp', eva: '/art/crew/crew-4-eva.webp', accent: '#6665e3' },
}

export const portraitFor = (crewId: string, onEva: boolean): string | undefined => {
  const p = CREW_PORTRAITS[crewId]
  return p && (onEva ? p.eva : p.inside)
}

export const TASK_ICONS: Record<CrewTask, LucideIcon> = {
  labScience: FlaskConical,
  fieldScience: Pickaxe,
  greenhouse: Sprout,
  solar: Sun,
  shielding: Mountain,
  maintenance: Wrench,
  isru: Wind,
  rest: BedDouble,
}

export const POWER_LABELS: Record<PowerLoad, string> = {
  lifeSupport: 'Life support',
  isru: 'O₂ makers',
  greenhouse: 'Greenhouse',
  lab: 'Science lab',
}

export const SCENARIO_BLURBS: Record<ScenarioId, string> = {
  moon: 'Two weeks of sunlight, then two weeks of darkness. No air to stop radiation. Cargo landers visit every 30 sols.',
  mars: 'Solar power only, and dust storms can dim the Sun for weeks. The thin air blocks some radiation. No resupply.',
}

// Plain names for the sourced figures shown in "why?" tooltips.
export const SOURCE_LABELS: Record<ConstantKey | CurveKey, string> = {
  CREW_O2_KG_PER_DAY: 'Oxygen breathed per astronaut per day',
  CREW_WATER_L_PER_DAY: 'Water used per astronaut per day',
  CREW_FOOD_KG_PER_DAY: 'Food per astronaut per day (with packaging)',
  LUNAR_NIGHT_HOURS: 'Length of the lunar night',
  MARS_SOL_HOURS: 'Length of a Mars day (sol)',
  SOLAR_FLUX_MOON: 'Sunlight reaching the Moon',
  SOLAR_FLUX_MARS: 'Sunlight reaching Mars (top of the air)',
  MARS_CLEAR_SOL_INSOLATION_KWH_M2: 'Solar energy on the Martian ground, clear day',
  DUST_STORM_SOLAR_FACTOR: 'Sunlight left during a big dust storm',
  SOLAR_PANEL_EFFICIENCY: 'Solar panel efficiency',
  LIFE_SUPPORT_KW: 'Life support power (ISS)',
  WATER_RECOVERY_FRACTION: 'Water the ISS recycler recovers',
  GREENHOUSE_YIELD_KG_M2_PER_DAY: 'Potato harvest per m² per day',
  GREENHOUSE_KWH_PER_KG_FOOD: 'Energy to grow 1 kg of food under lamps',
  MOXIE_KWH_PER_KG_O2: 'Energy MOXIE used per kg of oxygen',
  MOON_SURFACE_DOSE_MSV_PER_DAY: 'Radiation dose on the Moon’s surface',
  MARS_SURFACE_DOSE_MSV_PER_DAY: 'Radiation dose on the Mars surface',
  CAREER_DOSE_LIMIT_MSV: 'NASA career radiation limit',
  HABITAT_WALL_G_CM2: 'Shielding from the habitat walls',
  STORM_SHELTER_EXTRA_G_CM2: 'Extra shielding in the storm shelter',
  MARS_ATMOSPHERE_G_CM2: 'Shielding from the Martian air',
  GCR_DOSE_VS_SHIELDING: 'Cosmic-ray dose behind regolith',
  SPE_1972_DOSE_VS_SHIELDING: 'August 1972 solar storm dose behind regolith',
}

// Which sourced figures each meter's "why?" tooltip shows.
export type WhyRef = { constant: ConstantKey } | { curve: CurveKey } | { rule: string }

export interface MeterWhy {
  summary: string
  refs: WhyRef[]
  rules?: WhyRules // how it moves in the game, shown first
}

// What moves a meter in the game, as "goes up" and "goes down", in numbers
// for this base today. The "why?" panel opens with it, before the real-world
// science, so the first thing a newcomer reads is how to change the number.
export interface WhyRules {
  up: string
  down: string
  note?: string // a unit or a term, said once
}

const n = (key: ConstantKey) => c(key).toLocaleString('en')

export const METER_WHY: Record<string, (s: Scenario) => MeterWhy> = {
  power: (s) =>
    s.id === 'moon'
      ? {
          summary:
            `Life support needs ${n('LIFE_SUPPORT_KW')} kW every hour of every day. Sunlight is strong on the Moon ` +
            `(${n('SOLAR_FLUX_MOON')} W on every square metre), but the night lasts ${n('LUNAR_NIGHT_HOURS')} hours. ` +
            `Your ${s.start.facilities.reactorKW} kW reactor can't quite cover life support alone, so the battery has to last until sunrise.`,
          refs: [{ constant: 'LIFE_SUPPORT_KW' }, { constant: 'SOLAR_FLUX_MOON' }, { constant: 'LUNAR_NIGHT_HOURS' }, { constant: 'SOLAR_PANEL_EFFICIENCY' }],
        }
      : {
          summary:
            `Life support needs ${n('LIFE_SUPPORT_KW')} kW all the time. Mars is farther from the Sun: a clear sol gives ` +
            `${n('MARS_CLEAR_SOL_INSOLATION_KWH_M2')} kWh on each square metre of ground. A big dust storm cuts that to ` +
            `${Math.round(c('DUST_STORM_SOLAR_FACTOR') * 100)}%, for weeks. Build enough panels before a storm comes.`,
          refs: [{ constant: 'LIFE_SUPPORT_KW' }, { constant: 'MARS_CLEAR_SOL_INSOLATION_KWH_M2' }, { constant: 'DUST_STORM_SOLAR_FACTOR' }, { constant: 'SOLAR_FLUX_MARS' }, { constant: 'SOLAR_PANEL_EFFICIENCY' }],
        },
  oxygen: (s) => ({
    summary:
      `Each astronaut breathes about ${n('CREW_O2_KG_PER_DAY')} kg of oxygen a day. ` +
      (s.isruAvailable
        ? `On Mars you can make more: O₂ makers split carbon dioxide from the air, like NASA's MOXIE experiment, which used about ${n('MOXIE_KWH_PER_KG_O2')} kWh of energy per kg.`
        : ''), // the Moon: where its oxygen comes from is in the game half of the panel
    refs: [{ constant: 'CREW_O2_KG_PER_DAY' }, ...(s.isruAvailable ? [{ constant: 'MOXIE_KWH_PER_KG_O2' } as WhyRef] : [])],
  }),
  water: () => ({
    summary:
      `Each astronaut uses about ${n('CREW_WATER_L_PER_DAY')} L of water a day for drinking, food, washing and the toilet. ` +
      `The recycler can win back up to ${Math.round(c('WATER_RECOVERY_FRACTION') * 100)}% of it, as the ISS does, but only if the base is kept in good repair.`,
    refs: [{ constant: 'CREW_WATER_L_PER_DAY' }, { constant: 'WATER_RECOVERY_FRACTION' }],
  }),
  food: () => ({
    summary:
      `Each astronaut gets through about ${n('CREW_FOOD_KG_PER_DAY')} kg of packaged food a day. ` +
      `A greenhouse helps: potatoes grow about ${n('GREENHOUSE_YIELD_KG_M2_PER_DAY')} kg per square metre each day, ` +
      `but the grow lights need about ${n('GREENHOUSE_KWH_PER_KG_FOOD')} kWh for every kg. Food costs power.`,
    refs: [{ constant: 'CREW_FOOD_KG_PER_DAY' }, { constant: 'GREENHOUSE_YIELD_KG_M2_PER_DAY' }, { constant: 'GREENHOUSE_KWH_PER_KG_FOOD' }],
  }),
  radiation: (s) => ({
    summary:
      (s.id === 'moon'
        ? `On the Moon's surface an astronaut takes about ${n('MOON_SURFACE_DOSE_MSV_PER_DAY')} mSv a day, measured by China's Chang'e 4 lander. `
        : `On Mars an astronaut takes about ${n('MARS_SURFACE_DOSE_MSV_PER_DAY')} mSv a day, measured by the Curiosity rover. The thin air blocks some. `) +
      `NASA stops astronauts at ${n('CAREER_DOSE_LIMIT_MSV')} mSv over their whole career. ` +
      (s.id === 'mars'
        ? `Soil piled on the habitat (regolith) barely slows cosmic rays, and Mars's air already stops most of a solar storm.`
        : `Soil piled on the habitat (regolith) barely slows cosmic rays, but it stops solar storms very well.`),
    refs: [
      { constant: s.id === 'moon' ? 'MOON_SURFACE_DOSE_MSV_PER_DAY' : 'MARS_SURFACE_DOSE_MSV_PER_DAY' },
      { constant: 'CAREER_DOSE_LIMIT_MSV' },
      { curve: 'GCR_DOSE_VS_SHIELDING' },
      { curve: 'SPE_1972_DOSE_VS_SHIELDING' },
      ...(s.id === 'mars' ? [{ constant: 'MARS_ATMOSPHERE_G_CM2' } as WhyRef] : []),
    ],
  }),
  crewTime: () => ({
    summary:
      'Four astronauts, one 8-hour shift each per sol. Every hour spent fixing, building or sheltering is an hour not spent on science. That is why real crews work to a tightly planned schedule.',
    refs: [{ rule: 'The 8-hour shift is a game rule, not a NASA figure.' }],
  }),
}

// Live numbers for the "why?" panels: see WhyRules.
const cargoLine = (r: ResourceRates, key: 'oxygenKg' | 'waterL' | 'foodKg', unit: string) =>
  r.cargo ? ` Cargo landers bring ${r.cargo.cargo[key]} ${unit} every ${r.cargo.every} sols (next: sol ${r.cargo.nextSol}).` : ''

export const METER_RULES: Record<string, (g: GameState, r: ResourceRates) => WhyRules> = {
  power: (g, r) => ({
    up:
      (g.scenario.dayNightCycle
        ? `Solar panels make about ${whole(r.sunKWh)} kWh a sol in sunlight and none at night. `
        : `Solar panels make about ${whole(r.sunKWh)} kWh on a clear sol, and far less in a dust storm. `) +
      (r.reactorKWh > 0 ? `The reactor makes ${whole(r.reactorKWh)} kWh a sol, day and night. ` : '') +
      `Panels make less as the base condition drops. The battery stores up to ${r.battery} kWh.`,
    down: `Life support uses ${whole(r.crewUse.storedPowerKWh)} kWh a sol and is never off. The lab${g.scenario.isruAvailable ? ', greenhouse and O₂ makers' : ' and greenhouse'} use more while switched on.`,
    note: 'kWh is an amount of energy; kW is how fast it flows. 5 kW for a 24-hour sol is 120 kWh.',
  }),
  oxygen: (g, r) => ({
    up: g.scenario.isruAvailable
      ? `Each O₂ maker makes 1 kg a sol while it has power: ${one(r.o2MakersKg)} kg a sol from yours.`
      : `Nothing on this base makes oxygen.${cargoLine(r, 'oxygenKg', 'kg')}`,
    down: `The crew breathes ${one(r.crewUse.oxygenKg)} kg a sol. Air leaks from some alerts.`,
  }),
  water: (_g, r) => ({
    up: `The recycler wins back ${one(r.recycledL)} L a sol: up to ${Math.round(r.recyclerMax * 100)}% of what is used, but only as much as the base condition allows.${cargoLine(r, 'waterL', 'L')}`,
    down: `The crew uses ${one(r.crewUse.waterL)} L a sol.`,
  }),
  food: (_g, r) => ({
    up: `The greenhouse grows ${one(r.greenhouseKg)} kg a sol while it has power.${cargoLine(r, 'foodKg', 'kg')}`,
    down: `The crew eats ${one(r.crewUse.foodKg)} kg a sol.`,
  }),
  radiation: (g) => ({
    up: 'A little every sol on the surface, a bit more for anyone outside, and a lot in a solar storm unless the crew shelters.',
    down: `Never: it is a total over each astronaut's whole career. Keep everyone under ${g.crew[0]?.careerDoseLimitMSv ?? c('CAREER_DOSE_LIMIT_MSV')} mSv.`,
    note: 'mSv (millisievert) is a measure of radiation dose. The crew cards show each person’s.',
  }),
  crewTime: () => ({
    up: 'Four astronauts, one 8-hour shift each, every sol.',
    down: 'Repairs from alerts take shifts, from science first. Sheltering from a solar storm stops all work.',
    note: 'A shift is one astronaut’s work for one sol.',
  }),
}

// The opening crisis for each world: one visible problem, one fix. The first
// click should teach the loop: pick a task, watch the forecast change,
// press Advance sol.
export interface Opening {
  // The previous commander's plan, which the player inherits. The crisis
  // comes from it, and changing it is the player's first move.
  inheritedTasks: CrewTask[]
  meter: 'water' | 'oxygen'
  title: string
  problem: string
  // The sentence that tells the player what to do, split either side of the
  // task it names, so the screen can show that task's own icon and label.
  fix: { before: string; after: string }
  fixTask: CrewTask
  afterFix: string
}

export const OPENINGS: Record<ScenarioId, Opening> = {
  moon: {
    inheritedTasks: ['labScience', 'fieldScience', 'labScience', 'fieldScience'],
    meter: 'water',
    title: 'You are the new commander. Water is running out.',
    problem:
      'Your predecessor put everyone on science and skipped repairs. The base is worn out, so the water recycler is losing most of the water the crew uses.',
    fix: { before: 'Give one astronaut the', after: 'task and watch the base condition in the Water box go up. Then press Advance sol.' },
    fixTask: 'maintenance',
    afterFix:
      'Maintenance repairs the base, so the recycler wins back more water each sol. It takes a few sols to recover, and two astronauts on maintenance fix it faster. But every shift spent on repairs is a shift not spent on science. That trade-off is the whole game. Night is coming: the top bar shows when.',
  },
  mars: {
    inheritedTasks: ['maintenance', 'fieldScience', 'labScience', 'fieldScience'],
    meter: 'oxygen',
    title: 'You are the new commander. Oxygen is running low.',
    problem:
      'Only one O₂ maker is running, and the crew breathes more than it makes. Your predecessor kept the base repaired but spent every other shift on science.',
    fix: { before: 'Move one of the scientists to the', after: 'task and watch the number of O₂ makers in the Oxygen box go up. Then press Advance sol.' },
    fixTask: 'isru',
    afterFix:
      'Each O₂ maker splits carbon dioxide from the Martian air, but it runs on solar power and wears the base. Once oxygen is going up each sol, move them back to science. When a dust storm dims the Sun you may not have power for every O₂ maker, so build panels before the storms come.',
  },
}
