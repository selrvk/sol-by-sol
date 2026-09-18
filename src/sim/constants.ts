// Physical constants for the simulation.
// Every value has a source comment.
//
// BVAD = NASA Life Support Baseline Values and Assumptions Document,
// NASA/TP-2015-218570/REV2, Feb 2022.
// https://ntrs.nasa.gov/api/citations/20210024855/downloads/BVAD_2.15.22-final.pdf

// --- Crew consumables (per crew member, per Earth day) ---

// BVAD Table 3-31 (nominal: 0.895) and Table 3-32 (nominal: 0.90;
// range 0.61 low to 1.08 high). Footnote 77: the older 0.84 figure came
// from a MetMan model error that has since been corrected.
export const CREW_O2_KG_PER_DAY = 0.9

// BVAD Table 4-20, "Early Planetary Base" column, total water consumption.
// = 2.00 drinking + 0.50 food rehydration + 0.50 urinal flush
//   + 0.40 personal hygiene + 1.08 shower. Values are kg/CM-d (1 kg ≈ 1 L).
export const CREW_WATER_L_PER_DAY = 4.48

// BVAD Table 4-47, ISS food as shipped, including packaging.
// 1.83 is the historical ISS value; the current ISS planning value is 2.39
// (Section 3.3.5). Food actually eaten is ~1.56 kg (0.80 kg dry).
export const CREW_FOOD_KG_PER_DAY = 1.83

// --- Environment ---

// Half a synodic month (29.53 d / 2 ≈ 14.77 d ≈ 354 h).
// Source: NASA Moon Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html).
export const LUNAR_NIGHT_HOURS = 354

// Total solar irradiance at 1 AU, W/m^2. Kopp & Lean (2011), GRL 38, L01706.
// The Moon is at ~1 AU so this applies directly (no atmosphere).
export const SOLAR_FLUX_MOON = 1361

// Mean solar irradiance at Mars' orbit (top of atmosphere), W/m^2.
// NASA Mars Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)
// lists 586.2, i.e. 1361 / 1.5237^2, consistent with SOLAR_FLUX_MOON.
// (The often-quoted 590 is from Appelbaum & Flood 1989, NASA TM-102299, which
// used an older solar constant of 1371.) Surface flux is lower and drops
// further with dust opacity.
export const SOLAR_FLUX_MARS = 586
