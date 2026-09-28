// Game-balance numbers. These are design choices, not physics, and are the
// knobs Stage 2 tunes. Scenario-specific numbers live in scenarios/*.ts.

export const BALANCE = {
  // Crew time
  SHIFT_HOURS: 8, // one task per astronaut per sol

  // Science points per shift
  LAB_SCIENCE_PER_SHIFT: 1, // needs the lab powered
  FIELD_SCIENCE_PER_SHIFT: 2, // EVA: more science, more dose

  // Building, per shift
  GREENHOUSE_M2_PER_SHIFT: 2,
  SOLAR_M2_PER_SHIFT: 20,
  SHIELDING_LEVELS_PER_SHIFT: 1,
  MAX_SHIELDING_LEVEL: 6,
  REGOLITH_G_CM2_PER_LEVEL: 5, // shielding mass added per level of piled regolith
  ISRU_UNITS_PER_SHIFT: 1,

  // ISRU output per unit, kg O2 per sol (energy cost comes from constants.ts)
  ISRU_KG_O2_PER_UNIT_PER_SOL: 1.0,

  // Science lab power draw
  LAB_KW: 2,

  // Base condition (0..1). Every module wears; maintenance repairs.
  // Condition scales solar output (dust on panels) and water recovery.
  WEAR_BASE_PER_SOL: 0.02,
  WEAR_PER_SOLAR_M2: 0.00001,
  WEAR_PER_GREENHOUSE_M2: 0.001,
  WEAR_PER_ISRU_UNIT: 0.005,
  MAINTENANCE_PER_SHIFT: 0.08,

  // Events
  // No random alerts in the first sols of the player's command: the opening
  // briefing has the stage, and an alert on top of it buried its lesson (a
  // third of games had one in the first three sols).
  QUIET_START_SOLS: 3,
  SPE_SHELTER_SOLS: 2,
  // Solar particle event size, as a fraction of the August 1972 event
  // (one of the largest ever recorded). Rolled when the event happens.
  SPE_SCALE_MIN: 0.05,
  SPE_SCALE_MAX: 0.5,
} as const
