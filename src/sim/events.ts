// Random events. Every event is a decision, not just a stat change.
//
// Convention: choices[0] is the careful option and the default; the last
// choice is the one that cuts corners.
//
// The sizes of effects here (kg lost, shifts needed, odds) are game balance,
// not physics. Descriptions state real-world facts but no invented figures.

import { BALANCE } from './balance.ts'
import { speDoses } from './radiation.ts'
import type { CrewMember, Environment, Facilities, PendingEvent, Scenario, ScenarioId } from './types.ts'

export interface EventContext {
  scenario: Scenario
  facilities: Facilities
  environment: Environment
  crew: CrewMember[]
  sol: number
}

export interface EventDef {
  id: string
  weight: number // relative chance among eligible events
  scenarios: ScenarioId[]
  canHappen?: (ctx: EventContext) => boolean
  // Builds the concrete event when it fires. `roll` is a uniform random
  // number in [0, 1) from the seeded RNG, for event-specific variation.
  build: (ctx: EventContext, roll: number) => PendingEvent
}

const BOTH: ScenarioId[] = ['moon', 'mars']
const pct = (p: number) => `${Math.round(p * 100)}%`

// Space weather: rolled on its own each sol (scenario.speChancePerSol).
export const SOLAR_PARTICLE_EVENT: EventDef = {
  id: 'solarParticleEvent',
  weight: 0, // rolled separately: see scenario.speChancePerSol
  scenarios: BOTH,
  build: ({ scenario, facilities }, roll) => {
    const scale = BALANCE.SPE_SCALE_MIN + roll * (BALANCE.SPE_SCALE_MAX - BALANCE.SPE_SCALE_MIN)
    const size = scale < 0.15 ? 'minor' : scale < 0.3 ? 'strong' : 'severe'
    const dose = speDoses(scenario, facilities, scale)
    const mSv = (x: number) => `${Math.round(x)} mSv`
    return {
      id: 'solarParticleEvent',
      title: `Solar particle event (${size})`,
      description:
        'A solar flare has sent a burst of high-energy protons our way. ' +
        'Mass between the crew and space stops these well: shelter, or keep working and take the dose.',
      defaultChoiceId: 'shelter',
      choices: [
        {
          id: 'shelter',
          label: `Shelter for ${BALANCE.SPE_SHELTER_SOLS} sols, no work gets done (about ${mSv(dose.sheltered)} each)`,
          outcome: {
            message: 'The crew sheltered. No work was done, but the dose was kept low.',
            solarParticleEvent: { scale, sheltered: true },
            shelterSols: BALANCE.SPE_SHELTER_SOLS,
          },
        },
        {
          id: 'pressOn',
          label: `Press on (about ${mSv(dose.indoor)} indoors, ${mSv(dose.eva)} for anyone on EVA)`,
          outcome: {
            message: 'The crew kept working through the event and took the dose.',
            solarParticleEvent: { scale, sheltered: false },
          },
        },
      ],
    }
  },
}

// Everything else: one shared roll per sol (scenario.eventChancePerSol).
export const EVENTS: EventDef[] = [
  {
    id: 'dustOnPanels',
    weight: 1,
    scenarios: BOTH,
    canHappen: ({ facilities, environment }) => facilities.solarArrayM2 > 0 && environment.isDaylight,
    build: ({ scenario }) => ({
      id: 'dustOnPanels',
      title: 'Dust on the solar panels',
      description:
        scenario.id === 'moon'
          ? 'Lunar dust is electrically charged and clings to everything. Apollo crews found it on suits, seals and equipment.'
          : 'Fine dust settles out of the Martian air onto everything. Solar-powered Mars rovers slowly lost power as dust built up on their panels.',
      defaultChoiceId: 'clean',
      choices: [
        {
          id: 'clean',
          label: 'Send two astronauts out to brush them clean (2 EVA shifts)',
          outcome: { message: 'The panels are clean again.', evaShifts: 2 },
        },
        {
          id: 'ignore',
          label: 'Leave it (base condition drops)',
          outcome: { message: 'Dust keeps building up, and the base wears faster.', facilities: { condition: -0.12 } },
        },
      ],
    }),
  },

  {
    id: 'micrometeorite',
    weight: 1,
    scenarios: BOTH,
    build: ({ scenario }) => ({
      id: 'micrometeorite',
      title: 'Micrometeorite puncture',
      description:
        'A speck of space rock, smaller than a grain of sand but moving many times faster than a bullet, has punched a pinhole in the habitat. Air is leaking.' +
        (scenario.id === 'mars' ? ' On Mars the thin atmosphere burns up most of these, but not all.' : ' With no atmosphere, nothing slows them down on the Moon.'),
      defaultChoiceId: 'patch',
      choices: [
        {
          id: 'patch',
          label: 'Find and patch it properly (2 crew shifts, lose 4 kg O₂)',
          outcome: { message: 'The leak is sealed for good.', crewShifts: 2, resources: { oxygenKg: -4 } },
        },
        {
          id: 'quickPatch',
          label: `Slap on a quick patch (1 crew shift, ${pct(0.6)} chance it holds)`,
          outcome: {
            message: 'A quick patch went on.',
            crewShifts: 1,
            resources: { oxygenKg: -4 },
            gamble: {
              chance: 0.6,
              success: { message: 'It held.' },
              failure: { message: 'It blew out overnight: more air lost and a proper repair needed.', resources: { oxygenKg: -25 }, crewShifts: 2 },
            },
          },
        },
        {
          id: 'ignore',
          label: 'Ignore it for now (lose 30 kg O₂)',
          outcome: { message: 'Precious oxygen hissed away into space.', resources: { oxygenKg: -30 } },
        },
      ],
    }),
  },

  {
    id: 'recyclerFouling',
    weight: 1,
    scenarios: BOTH,
    build: () => ({
      id: 'recyclerFouling',
      title: 'Water recycler clogged',
      description:
        'Minerals from recycled urine have built up inside the water processor. The ISS has had the same problem: recycling water takes constant upkeep.',
      defaultChoiceId: 'clean',
      choices: [
        {
          id: 'clean',
          label: 'Strip it down and clean it (2 crew shifts)',
          outcome: { message: 'The water processor is running clean.', crewShifts: 2 },
        },
        {
          id: 'flush',
          label: 'Flush it with spare filters (costs 25 L of water)',
          outcome: { message: 'Flushed clean, at the cost of some water.', resources: { waterL: -25 } },
        },
        {
          id: 'ignore',
          label: 'Keep it running dirty (base condition drops)',
          outcome: { message: 'The recycler struggles on, recovering less water.', facilities: { condition: -0.15 } },
        },
      ],
    }),
  },

  {
    id: 'cropBlight',
    weight: 1,
    scenarios: BOTH,
    canHappen: ({ facilities }) => facilities.greenhouseM2 >= 4,
    build: ({ facilities }) => {
      const quarter = Math.max(1, Math.round(facilities.greenhouseM2 / 4))
      const half = Math.max(2, Math.round(facilities.greenhouseM2 / 2))
      return {
        id: 'cropBlight',
        title: 'Crop blight in the greenhouse',
        description: 'A fungus is spreading through the potato beds. In a sealed greenhouse there is nowhere for it to go.',
        defaultChoiceId: 'pull',
        choices: [
          {
            id: 'pull',
            label: `Pull out the sick plants (lose ${quarter} m² of beds)`,
            outcome: { message: 'The blight is gone, along with some of the beds.', facilities: { greenhouseM2: -quarter } },
          },
          {
            id: 'treat',
            label: `Try to treat it (2 crew shifts, ${pct(0.6)} chance it works)`,
            outcome: {
              message: 'The crew treated the plants.',
              crewShifts: 2,
              gamble: {
                chance: 0.6,
                success: { message: 'It worked: every bed was saved.' },
                failure: { message: `It didn't work. ${half} m² of beds died.`, facilities: { greenhouseM2: -half } },
              },
            },
          },
          {
            id: 'ignore',
            label: `Ignore it (lose about ${half} m² of beds)`,
            outcome: { message: 'The blight spread through half the greenhouse.', facilities: { greenhouseM2: -half } },
          },
        ],
      }
    },
  },

  {
    id: 'batteryFault',
    weight: 1,
    scenarios: BOTH,
    build: () => ({
      id: 'batteryFault',
      title: 'Battery module overheating',
      description: 'One battery module is running hot. Lithium-ion batteries that overheat can fail badly, so it cannot just be left alone.',
      defaultChoiceId: 'replace',
      choices: [
        {
          id: 'replace',
          label: 'Swap in the spare module (2 crew shifts)',
          outcome: { message: 'The spare module is in and working.', crewShifts: 2 },
        },
        {
          id: 'disconnect',
          label: 'Disconnect it (lose 150 kWh of battery storage for good)',
          outcome: { message: 'The module is disconnected. The battery holds less from now on.', facilities: { batteryCapacityKWh: -150 } },
        },
      ],
    }),
  },

  {
    id: 'crewIllness',
    weight: 1,
    scenarios: BOTH,
    build: ({ crew }, roll) => {
      const m = crew[Math.floor(roll * crew.length)]
      return {
        id: 'crewIllness',
        title: `${m.name} is ill`,
        description: `${m.name} has a fever. The crew medic thinks it is minor, but in a tiny habitat everyone shares the same air.`,
        defaultChoiceId: 'rest',
        choices: [
          {
            id: 'rest',
            label: 'Bed rest for two sols (2 crew shifts)',
            outcome: { message: `${m.name} rested and recovered.`, crewShifts: 2 },
          },
          {
            id: 'work',
            label: `Keep working (${pct(0.7)} chance it passes)`,
            outcome: {
              message: `${m.name} kept working.`,
              gamble: {
                chance: 0.7,
                success: { message: 'The fever passed.' },
                failure: { message: 'It got worse, and two crew members were ill for a while.', crewShifts: 5 },
              },
            },
          },
        ],
      }
    },
  },

  {
    id: 'interestingRocks',
    weight: 1,
    scenarios: BOTH,
    build: ({ crew }) => {
      const scientist = crew.find((m) => m.role === 'scientist')?.name ?? 'The crew'
      return {
        id: 'interestingRocks',
        title: 'Unusual rocks spotted',
        description: `${scientist} has spotted layered rocks on a ridge a few kilometres away. Layers can record the planet's history, but the ridge is a long spacewalk away.`,
        defaultChoiceId: 'log',
        choices: [
          {
            id: 'log',
            label: 'Photograph them from here (+5 science)',
            outcome: { message: 'The photos went back to Earth.', sciencePoints: 5 },
          },
          {
            id: 'expedition',
            label: 'Send a team out to sample them (2 EVA shifts, +20 science)',
            outcome: { message: 'The team brought back samples.', sciencePoints: 20, evaShifts: 2 },
          },
        ],
      }
    },
  },

  {
    id: 'cargoChoice',
    weight: 1,
    scenarios: ['moon'],
    build: () => ({
      id: 'cargoChoice',
      title: 'Room for one more pallet',
      description: 'The next cargo lander has space for one extra pallet. Mission Control needs to know today what to load.',
      defaultChoiceId: 'oxygen',
      choices: [
        { id: 'oxygen', label: 'Oxygen (+40 kg O₂)', outcome: { message: 'Extra oxygen arrived.', resources: { oxygenKg: 40 } } },
        { id: 'water', label: 'Water (+60 L)', outcome: { message: 'Extra water arrived.', resources: { waterL: 60 } } },
        { id: 'food', label: 'Food (+60 kg)', outcome: { message: 'Extra food arrived.', resources: { foodKg: 60 } } },
        { id: 'science', label: 'Science instruments (+15 science)', outcome: { message: 'New instruments arrived.', sciencePoints: 15 } },
      ],
    }),
  },

  {
    id: 'urgentExperiment',
    weight: 1,
    scenarios: BOTH,
    build: () => ({
      id: 'urgentExperiment',
      title: 'Urgent request from Earth',
      description: 'Scientists on Earth need a time-critical measurement taken in the next few sols. Doing it means pulling crew off other work.',
      defaultChoiceId: 'decline',
      choices: [
        { id: 'decline', label: 'Say no: the crew is busy enough', outcome: { message: 'Mission Control understood.' } },
        {
          id: 'accept',
          label: 'Do it (3 crew shifts, +10 science)',
          outcome: { message: 'The measurement was taken.', crewShifts: 3, sciencePoints: 10 },
        },
      ],
    }),
  },

  {
    id: 'o2MakerClog',
    weight: 1,
    scenarios: ['mars'],
    canHappen: ({ facilities }) => facilities.isruUnits > 0,
    build: () => ({
      id: 'o2MakerClog',
      title: 'O₂ maker clogged with dust',
      description:
        'An oxygen maker is choking on dust. Like MOXIE on the Perseverance rover, it pulls in Martian air and splits carbon dioxide at around 800 °C, so dust has to be kept out.',
      defaultChoiceId: 'clean',
      choices: [
        { id: 'clean', label: 'Clean the intake filter (1 EVA shift)', outcome: { message: 'The O₂ maker is breathing freely again.', evaShifts: 1 } },
        {
          id: 'run',
          label: 'Keep running it (one O₂ maker breaks)',
          outcome: { message: 'The clogged O₂ maker burned out.', facilities: { isruUnits: -1 } },
        },
      ],
    }),
  },

  {
    id: 'heaterFailure',
    weight: 1,
    scenarios: ['moon'],
    canHappen: ({ environment }) => !environment.isDaylight,
    build: () => ({
      id: 'heaterFailure',
      title: 'Heater failure',
      description: 'A habitat heater has failed in the middle of the lunar night, when the surface gets colder than anywhere on Earth.',
      defaultChoiceId: 'repair',
      choices: [
        { id: 'repair', label: 'Repair it (2 crew shifts)', outcome: { message: 'The heater is fixed.', crewShifts: 2 } },
        {
          id: 'backup',
          label: 'Run the backup heater (uses 80 kWh of battery)',
          outcome: { message: 'The backup heater ate into the battery.', resources: { storedPowerKWh: -80 } },
        },
      ],
    }),
  },

  {
    id: 'moonquake',
    weight: 1,
    scenarios: ['moon'],
    canHappen: ({ facilities }) => facilities.shieldingLevel > 0,
    build: () => ({
      id: 'moonquake',
      title: 'Moonquake',
      description: 'Seismometers left by Apollo astronauts recorded shallow moonquakes. One has just shaken loose some of the soil piled on the habitat as shielding.',
      defaultChoiceId: 'rebuild',
      choices: [
        { id: 'rebuild', label: 'Pile it back up (2 EVA shifts)', outcome: { message: 'The shielding is back in place.', evaShifts: 2 } },
        {
          id: 'leave',
          label: 'Leave it (lose 1 level of shielding)',
          outcome: { message: 'The habitat has less shielding now.', facilities: { shieldingLevel: -1 } },
        },
      ],
    }),
  },

  {
    id: 'airlockSeal',
    weight: 1,
    scenarios: BOTH,
    build: () => ({
      id: 'airlockSeal',
      title: 'Worn airlock seal',
      description: 'Every spacewalk wears the airlock seals a little, and gritty dust makes it worse.',
      defaultChoiceId: 'replace',
      choices: [
        { id: 'replace', label: 'Replace the seal (1 crew shift)', outcome: { message: 'New seal fitted.', crewShifts: 1 } },
        {
          id: 'keep',
          label: `Keep using it (${pct(0.75)} chance it lasts)`,
          outcome: {
            message: 'The crew kept using the old seal.',
            gamble: {
              chance: 0.75,
              success: { message: 'It held out.' },
              failure: { message: 'It failed during a spacewalk and air vented from the airlock.', resources: { oxygenKg: -20 } },
            },
          },
        },
      ],
    }),
  },

  {
    id: 'roverBreakdown',
    weight: 1,
    scenarios: BOTH,
    build: () => ({
      id: 'roverBreakdown',
      title: 'Rover breakdown',
      description: 'The rover has broken down several kilometres from base. Without it, field trips are much harder.',
      defaultChoiceId: 'tow',
      choices: [
        { id: 'tow', label: 'Send a team to tow it home (2 EVA shifts)', outcome: { message: 'The rover is back and repaired.', evaShifts: 2 } },
        {
          id: 'fieldFix',
          label: `Try a repair on the spot (1 EVA shift, ${pct(0.5)} chance it works)`,
          outcome: {
            message: 'An astronaut went out to fix it.',
            evaShifts: 1,
            gamble: {
              chance: 0.5,
              success: { message: 'It started first time.' },
              failure: { message: "The fix didn't work: it had to be towed anyway.", evaShifts: 2 },
            },
          },
        },
      ],
    }),
  },
]
