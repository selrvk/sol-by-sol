// Random events. Every event is a decision, not just a stat change.
// Stage 1 ships one event to prove the mechanism; Stage 4 adds the rest.

import { BALANCE } from './balance.ts'
import { speDoses } from './radiation.ts'
import type { Facilities, PendingEvent, Scenario, ScenarioId } from './types.ts'

export interface EventContext {
  scenario: Scenario
  facilities: Facilities
}

export interface EventDef {
  id: string
  weight: number // relative chance among eligible events
  scenarios: ScenarioId[]
  // Builds the concrete event when it fires. `roll` is a uniform random
  // number in [0, 1) from the seeded RNG, for event-specific variation.
  build: (ctx: EventContext, roll: number) => PendingEvent
}

export const EVENTS: EventDef[] = [
  {
    id: 'solarParticleEvent',
    weight: 1,
    scenarios: ['moon', 'mars'],
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
  },
]
