// Physical constants for the simulation.
// Every value has a source comment. Items marked VERIFY have not yet been
// checked against the primary document and must be before shipping.

// --- Crew consumables (per crew member, per Earth day) ---

// NASA Baseline Values and Assumptions Document (BVAD).
// VERIFY: BVAD 2018 (NASA/TP-2015-218570/REV1) lists ~0.82 kg nominal;
// 0.84 is the older BVAD (Hanford, NASA/CR-2004-208941) figure.
export const CREW_O2_KG_PER_DAY = 0.84

// NASA BVAD, drinking + hygiene.
// VERIFY: BVAD splits potable, food-prep and hygiene water; confirm which
// lines sum to 3.5 L.
export const CREW_WATER_L_PER_DAY = 3.5

// NASA BVAD.
// VERIFY: confirm whether 1.8 kg includes packaging mass.
export const CREW_FOOD_KG_PER_DAY = 1.8

// --- Environment ---

// Half a synodic month (29.53 d / 2 ≈ 14.77 d ≈ 354 h).
// Source: NASA Moon Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html).
export const LUNAR_NIGHT_HOURS = 354

// Total solar irradiance at 1 AU, W/m^2. Kopp & Lean (2011), GRL 38, L01706.
// The Moon is at ~1 AU so this applies directly (no atmosphere).
export const SOLAR_FLUX_MOON = 1361

// Mean solar irradiance at Mars orbit, W/m^2.
// Source: NASA Mars Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html),
// which lists 586.2; 590 is the rounded mean.
// VERIFY: decide whether to use 586 exactly. Top-of-atmosphere value; surface
// flux is lower and varies with dust opacity.
export const SOLAR_FLUX_MARS = 590
