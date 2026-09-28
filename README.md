# Junior Astronaut Mission Trainer

By **Team ARCHSPACE**. A browser game for the 2026 NASA Space Apps Challenge, "Build a Junior Astronaut Mission Trainer", aimed at learners aged about 10 to 16.

You take command of a four-person outpost on the **Moon** or **Mars** on sol 40 of a 120-sol mission. Reach the science target before the mission clock runs out, without letting oxygen, water, food or power run out, and without any astronaut passing NASA's career radiation limit.

The game is about **trade-offs**, not meters. Every shift spent on repairs or shielding is a shift not spent on science. Every kilowatt the greenhouse uses is one the lab can't have. A cautious player survives with a poor score. A greedy player loses the crew. That gap is the lesson.

## How to play

1. Pick a world. You inherit a base with one urgent problem. The briefing tells you what it is and which task fixes it.
2. Give each astronaut one task for the sol: science, repairing the base, building, shielding and so on. Tasks marked **EVA** happen outside and add radiation dose.
3. Switch the lab, greenhouse and (on Mars) O₂ makers on or off.
4. Press **Advance sol** and watch the meters. Every meter has a **why?** button showing the real NASA figures behind it.
5. Answer alerts as they come. Every event is a choice with a cost.
6. Plan for what your world throws at you. On the **Moon**, the night lasts two weeks: the panels stop, and nothing gets done outside until sunrise, so work outside by day and use the nights for the lab and repairs. Every trip outside also brings in dust that wears the base. On **Mars**, big dust storms come in the dust season, so build solar before it starts. The top bar counts down to both.

## Running it

Requires Node 22 or later (developed on Node 25).

```bash
npm install
npm run dev        # play at http://localhost:5173
npm test           # unit tests for the simulation and the opening
npm run typecheck  # type-check the app, config and scripts
npm run build      # production build into dist/
```

Headless tools for balancing the game from a terminal:

```bash
npm run sim -- --scenario moon --policy balanced --seed 42 --every 5
npm run balance -- --seeds 1000
npm run fixed-plans
```

A link to the game shows a preview picture (`public/og-image.jpg`, made by `python3 art/preview.py` from the game's own art). Chat apps and social sites need the picture's full address, which the build fills in from Vercel's or Netlify's deploy address; for any other host, or a custom domain, build with `SITE_URL=https://your.address npm run build`.

`sim` prints a sol-by-sol table of every resource for one scripted player. `balance` runs every scripted player on both worlds (100 seeds unless told otherwise), summarises who wins and what kills them, and fails if any of them stops doing what it is meant to. `fixed-plans` tries every crew plan that never changes, looking for a lazy way to win; none should come close to a careful player.

## Architecture

```
src/
  sim/              pure TypeScript: the whole game, no React, no side effects
    advanceSol.ts   (GameState, Decisions) => GameState, one sol
    constants.ts    real-world figures, each with its source and status
    balance.ts      game-tuning numbers (science yields, wear, odds)
    radiation.ts    dose model: cosmic rays vs solar particle events
    events.ts       the 15 decision events
    rng.ts          seeded random numbers
    newGame.ts      (Scenario, seed) => GameState
    scenarios/      Moon and Mars configurations
  ui/               React components: display the state, collect decisions
  test/             unit tests (Node's built-in test runner)
scripts/
  simulate.ts       headless sol-by-sol runner
  policies.ts       scripted players, each losing one makes one mistake
  balance-report.ts every player x world x seed summary, checked
  expectations.ts   what each scripted player is expected to do
  fixed-plans.ts    every never-changing crew plan, looking for a lazy win
```

### Why the simulation is pure and deterministic

All game rules live in one function, `advanceSol(state, decisions)`. It takes the current state and the player's choices for one sol and returns a new state. It never changes its inputs, never reads the clock, and never calls `Math.random()`. Randomness comes from a seeded generator whose state is stored inside `GameState`.

That gives three things:

- **Replayable games.** A seed plus the list of decisions reproduces a game exactly. The end screen shows the seed, so a surprising loss can be replayed and debugged.
- **Testable, balanceable rules.** The game runs without a browser. The same function drives the unit tests, the terminal simulator, and the balance report that plays thousands of games with scripted players.
- **A thin UI.** The React code only draws state and collects decisions; no game rules live there. Even the "next sol" forecast in the opening is just `advanceSol` called one step ahead, which is safe because the function has no side effects.

### Physics vs balance

`constants.ts` holds only real-world figures, and each one stores its source and a status as data:

- `verified`: checked against the primary source
- `unchecked`: from a real source, not yet re-read at the source
- `placeholder`: a stand-in that must never be shown as fact

The "why?" tooltips read these directly. Everything tuned for fun (science per shift, wear rates, event odds, starting stock) lives in `balance.ts`, the scenario files and the event definitions. The physics is never adjusted to make the game easier or harder.

The balance is checked with scripted players, each built to make one kind of mistake:

| Player | Mistake | Moon | Mars |
|---|---|---|---|
| balanced | none | wins (92%) | wins (98%) |
| greedy | everyone on science, no upkeep | runs out of water | runs out of oxygen |
| reckless | ignores radiation | often exceeds the dose limit (49%) | wins: the atmosphere shields it |
| power-hog | never switches anything off | loses power in the lunar night | wins: no night to ration for |
| cautious | too little science | survives, misses target | survives, misses target |
| rota-1m3f | the same plan every sol: 1 on repairs, 3 on field science | runs out of water | runs out of oxygen |
| day-night | none: out by day, lab and repairs by night | wins (100%) | no night: runs out of oxygen |

Percentages are over 100 seeds (`npm run balance`). The balanced player on the Moon keeps its most irradiated astronaut indoors, which costs it some games; day-night shows the Moon can be won nearly every time. Of every never-changing crew plan (`npm run fixed-plans`), the best wins about 13% on the Moon and 21% on Mars.

## Sources

Every physical figure in the game, and where it comes from.

| Figure | Value | Source | Status |
|---|---|---|---|
| Oxygen per astronaut | 0.9 kg/day | NASA BVAD Rev2 (2022), Tables 3-31, 3-32 | verified |
| Water per astronaut | 4.48 L/day | NASA BVAD Rev2 (2022), Table 4-20, early planetary base | verified |
| Food per astronaut | 1.83 kg/day | NASA BVAD Rev2 (2022), Table 4-47 | verified |
| Life support power | 5.31 kW | NASA BVAD Rev2 (2022), Table 3-2 (ISS ECLSS) | verified |
| Potato yield | 0.105 kg/m²/day | NASA BVAD Rev2 (2022), Table 4-90 | verified |
| Greenhouse energy | 100 kWh/kg | NASA BVAD Rev2 (2022), Section 4.14 | unchecked |
| Solar panel efficiency | 26% | NASA BVAD Rev2 (2022), power system tables | unchecked |
| Mars solar flux | 586 W/m² | NASA Mars Fact Sheet | verified |
| Mars ground insolation | 3.99 kWh/m²/sol | Appelbaum & Flood (1989), NASA TM-102299 | verified |
| Dust storm sunlight | 30% | Appelbaum & Flood (1989), NASA TM-102299 | verified |
| Solar flux at the Moon | 1361 W/m² | Kopp & Lean (2011) | unchecked |
| Lunar night | 354 h | NASA Moon Fact Sheet | unchecked |
| Mars sol | 24.66 h | NASA Mars Fact Sheet | unchecked |
| Reactor | up to 10 kWe | NASA Kilopower / KRUSTY (2018) | unchecked |
| Water recycling | 98% | NASA ISS ECLSS (2023); ICES-2023-097 | unchecked |
| MOXIE energy | 25 kWh/kg O₂ | NASA/JPL MOXIE results (2023) | unchecked |
| Moon surface dose | 1.369 mSv/day | Zhang et al. (2020), Chang'E 4 | unchecked |
| Mars surface dose | 0.64 mSv/day | Hassler et al. (2014), Curiosity RAD | unchecked |
| Career dose limit | 600 mSv | NASA-STD-3001 Vol. 1 Rev B (2022) | unchecked |
| Cosmic-ray dose vs shielding | curve | Matthiä & Berger (2024), Table 2 | verified |
| 1972 solar storm dose vs shielding | curve | Matthiä & Berger (2024), Table 2 | verified |
| Habitat wall shielding | 5 g/cm² | Shavers et al. (2023), via Matthiä & Berger (2024) | unchecked |
| Mars atmosphere shielding | 21 g/cm² | Hassler et al. (2014); Guo et al. (2017) | unchecked |
| Storm shelter extra shielding | 10 g/cm² | none yet | **placeholder** |

Real effects behind game rules (the sizes are game settings, not measurements):

| Rule | Real basis | Source |
|---|---|---|
| Moon: each shift outside wears the base | Apollo: lunar dust abraded suits, clogged mechanisms, made seals fail | Gaier (2005), NASA/TM-2005-213610 |
| Moon: no work outside at night | the lunar night is about two weeks of dark and deep cold | NASA Moon Fact Sheet (night length) |
| Mars: storms come in a dust season | southern spring and summer, near perihelion, is Mars's dust storm season | NASA JPL (see below) |
| Mars: a storm can end a solar-powered mission | the 2018 storm began 30 May; Opportunity's last message was 10 June | Sánchez-Lavega et al. (2019); NASA JPL PIA22929 |

Documents and datasets:

- NASA, *Life Support Baseline Values and Assumptions Document* (BVAD), NASA/TP-2015-218570/REV2, 2022. <https://ntrs.nasa.gov/api/citations/20210024855/downloads/BVAD_2.15.22-final.pdf>
- Appelbaum, J. & Flood, D. J., *Solar Radiation on Mars*, NASA TM-102299, 1989. <https://ntrs.nasa.gov/api/citations/19890018252/downloads/19890018252.pdf>
- NASA NSSDCA, *Mars Fact Sheet*. <https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html>
- NASA NSSDCA, *Moon Fact Sheet*. <https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html>
- Kopp, G. & Lean, J. L., *A new, lower value of total solar irradiance*, Geophysical Research Letters 38, L01706, 2011. <https://doi.org/10.1029/2010GL045777>
- Zhang, S. et al., *First measurements of the radiation dose on the lunar surface*, Science Advances 6, eaaz1334, 2020. <https://www.science.org/doi/10.1126/sciadv.aaz1334>
- Hassler, D. M. et al., *Mars' surface radiation environment measured with the Mars Science Laboratory's Curiosity rover*, Science 343, 1244797, 2014. <https://doi.org/10.1126/science.1244797>
- Guo, J. et al., *Dependence of the Martian radiation environment on atmospheric depth*, JGR Planets, 2017. <https://agupubs.onlinelibrary.wiley.com/doi/full/10.1002/2016JE005206>
- Matthiä, D. & Berger, T., *Radiation Exposure and Shielding Effects on the Lunar Surface*, Space Weather 22, e2024SW004095, 2024. <https://doi.org/10.1029/2024SW004095>
- NASA OCHMO, *NASA-STD-3001 Volume 1 Rev B and Volume 2 Rev C* (career radiation limit). <https://www.nasa.gov/wp-content/uploads/2023/03/ochmo-standards-newsletter-february-2022.pdf>
- NASA, *NASA's Oxygen-Generating Experiment MOXIE Completes Mars Mission*, 2023. <https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/>
- NASA, *Demonstration Proves Nuclear Fission System Can Provide Space Exploration Power* (Kilopower), 2018. <https://www.nasa.gov/news-release/demonstration-proves-nuclear-fission-system-can-provide-space-exploration-power/>
- Gaier, J. R., *The Effects of Lunar Dust on EVA Systems During the Apollo Missions*, NASA/TM-2005-213610, 2005. <https://ntrs.nasa.gov/api/citations/20050160460/downloads/20050160460.pdf>
- NASA JPL, *NASA Mars Orbiters Reveal Seasonal Dust Storm Pattern*. <https://www.jpl.nasa.gov/news/nasa-mars-orbiters-reveal-seasonal-dust-storm-pattern/>
- Sánchez-Lavega, A. et al., *The onset and growth of the 2018 Martian Global Dust Storm*, Geophysical Research Letters, 2019. <https://arxiv.org/abs/1906.00963>
- NASA JPL, *Opportunity's Last Message* (PIA22929). <https://www.jpl.nasa.gov/images/pia22929-opportunitys-last-message/>
- NASA, *Status of ISS Water Management and Recovery*, ICES-2023-097. <https://ntrs.nasa.gov/api/citations/20230006217/downloads/ICES%202023-097%20Status%20of%20ISS%20Water%20Management%20and%20Recovery.pdf>

## Known simplifications

- Life-support power is the ISS figure, used unscaled for a crew of four.
- Greenhouse potatoes are counted against packaged-food mass.
- MOXIE was a demonstrator about 1% of full scale; the game's O₂ makers use its energy per kilogram.
- Aluminium and regolith shielding are treated as equivalent per g/cm², and the solar-storm dose curve has no data beyond 20 g/cm², so extra shielding past that point gives no further benefit.
- Event sizes, science yields, wear and event odds are game balance, not physics.
- The game's dust season (sols 50–75) is far shorter than the real one, which is about half a Martian year, so that it fits in the mission.
- "No work outside at night" is a rule, not a measured limit: it stands for the dark and the deep cold of the lunar night.
