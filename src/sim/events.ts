// Random events. Every event is a decision, not just a stat change.
// Stage 1 ships one event to prove the mechanism; Stage 4 adds the rest.

import { BALANCE } from './balance.ts'
import { c } from './constants.ts'
import type { PendingEvent, ScenarioId } from './types.ts'

export interface EventDef extends PendingEvent {
  weight: number // relative chance among eligible events
  scenarios: ScenarioId[]
}

export const EVENTS: EventDef[] = [
  {
    id: 'solarParticleEvent',
    title: 'Solar particle event',
    description:
      'A solar flare has sent a burst of high-energy protons our way. ' +
      'Shelter in the most shielded part of the base, or keep working and take the dose.',
    weight: 1,
    scenarios: ['moon', 'mars'],
    defaultChoiceId: 'shelter',
    choices: [
      {
        id: 'shelter',
        label: `Shelter for ${BALANCE.SPE_SHELTER_SOLS} sols (no work gets done)`,
        outcome: {
          message: 'The crew sheltered. No work was done, but the dose was small.',
          crewDoseMSv: c('SPE_SHELTERED_DOSE_MSV'),
          shelterSols: BALANCE.SPE_SHELTER_SOLS,
        },
      },
      {
        id: 'pressOn',
        label: 'Press on and take the dose',
        outcome: {
          message: 'The crew kept working through the storm and took a heavy dose.',
          crewDoseMSv: c('SPE_UNSHELTERED_DOSE_MSV'),
        },
      },
    ],
  },
]
