# Road Ready content inventory

> **Generated file — do not edit by hand.**
>
> Source: `scripts/content-coverage.mjs`, run against the canonical content
> sources (`js/questions.js`, `js/concepts.js`, `js/state-packs.js`,
> `js/packs/uk.js`, `js/exam-blueprints.js`, `js/jurisdictions.js`).
>
> Regenerate with `node scripts/content-coverage.mjs --write`.
> Every count in `README.md` should trace back to this file.

**Generated:** 2026-10-16

## Headline numbers

| Measure | Value |
|---|---|
| Questions in the full bank | 1920 |
| Universal (US, no state pack) bank | 267 |
| Jurisdiction-pack questions | 1653 |
| Great Britain pack questions | 1579 |
| U.S. state-pack questions (six states) | 74 |
| Distinct concepts | 644 |
| Concepts with 3+ questions | 441 |
| Concepts with 2+ question forms | 440 |
| Concepts with a single question | 186 |
| Distinct question forms | 9 |
| Road signs with artwork | 58 |
| Registered jurisdictions (packs) | 8 |

## What these numbers do and do not support

The table below is the honest version of the product's coverage claim.

| Jurisdiction | Universal bank | Own pack questions | Total available | Unique questions for an official-length mock | Own-pack depth vs a full exam |
|---|---|---|---|---|---|
| General U.S. rules — no state pack selected | 267 | 0 | 267 | n/a (no published exam spec) | n/a |
| California (DMV) | 267 | 25 | 292 | yes - 292 available, 46 needed | **25 own questions - 54% of a full exam's worth (46 needed)** |
| Texas (DPS) | 267 | 24 | 291 | yes - 291 available, 30 needed | **24 own questions - 80% of a full exam's worth (30 needed)** |
| New York (DMV) | 267 | 6 | 273 | yes - 273 available, 20 needed | **6 own questions - 30% of a full exam's worth (20 needed)** |
| Florida (FLHSMV) | 267 | 6 | 273 | yes - 273 available, 50 needed | **6 own questions - 12% of a full exam's worth (50 needed)** |
| Washington (DOL) | 267 | 6 | 273 | yes - 273 available, 40 needed | **6 own questions - 15% of a full exam's worth (40 needed)** |
| Pennsylvania (PennDOT) | 267 | 7 | 274 | yes - 274 available, 18 needed | **7 own questions - 39% of a full exam's worth (18 needed)** |
| Great Britain (DVSA car) | 0 | 1579 | 1579 | yes - 1579 available, 50 needed | 1579 own questions (3158% of a full exam's worth) |

Read the last two columns together, because they answer different questions.

- **Unique questions for an official-length mock** is what the app can actually
  assemble (`Core.officialExamAvailability`): the universal bank plus the state's
  own questions, counted without repeats. This is why every U.S. state can still
  run a full-length locked simulation.
- **Own-pack depth** is the honest measure of *state-specific* preparation.
  It counts only the questions whose answers are specific to that state. A
  learner who only ever sees the universal bank has learned general U.S. rules and
  nothing about that state's own limits, distances and penalties.

Neither column says anything about how well the bank represents a real exam's
topic mix: the blueprint's `topicWeights` are editorial approximations
(`js/exam-blueprints.js`), and states do not publish numeric topic breakdowns.

## Coverage by topic

| Topic | Questions | Concepts | Concepts with 2+ questions | Question forms |
|---|---|---|---|---|
| Safety & Emergencies | 269 | 92 | 66 | 9 |
| Signs & Signals | 254 | 93 | 55 | 9 |
| People & Riders | 213 | 65 | 48 | 9 |
| Markings & Lanes | 199 | 59 | 45 | 8 |
| Rules & Penalties | 189 | 69 | 46 | 9 |
| Right of Way | 188 | 62 | 39 | 9 |
| Speed & Distance | 171 | 56 | 41 | 8 |
| Alcohol & Drugs | 164 | 59 | 46 | 6 |
| Parking & Stopping | 148 | 47 | 37 | 7 |
| Vehicle Basics | 125 | 50 | 35 | 6 |

A high concept count with a low "concepts with variation" number means the
topic is broad but shallow: each rule is tested by one question, so a right
answer is evidence about one question, not about the rule.

## Question-form distribution

| Form | Questions | Share |
|---|---|---|
| recall | 471 | 24.5% |
| scenario | 462 | 24.1% |
| what-next | 400 | 20.8% |
| multi-step | 218 | 11.4% |
| sign-combo | 204 | 10.6% |
| diagram | 67 | 3.5% |
| photo | 56 | 2.9% |
| lane-choice | 28 | 1.5% |
| prioritisation | 14 | 0.7% |

Recall and scenario forms dominate. 203 concepts have fewer than
three questions, which limits how well the app can verify that a learner can
apply a rule to an unfamiliar situation rather than recognise a familiar
prompt.

## Concepts that cannot yet evidence transfer

Listed so the gap is visible in review rather than hidden inside a topic total.
Batch 1 of the content plan targets the concepts a learner is most likely to
meet first; this list is the work queue, in priority order.

| Concept | Questions | Forms | Topic |
|---|---|---|---|
| `address-change-notification` | 1 | recall | laws |
| `advisory-speed-sign` | 1 | recall | speed |
| `aggressive-driver-response` | 1 | recall | safety |
| `airbag-and-child-seat-distance` | 1 | recall | safety |
| `alcohol-first-effect` | 1 | recall | alcohol |
| `animal-crossing-sign` | 1 | recall | signs |
| `animal-on-road` | 1 | recall | safety |
| `bac-determining-factors` | 1 | recall | alcohol |
| `bac-legal-limit` | 1 | recall | alcohol |
| `bac-reduction-myth` | 1 | recall | alcohol |
| `ball-into-street` | 1 | recall | vulnerable |
| `basic-speed-law` | 1 | recall | speed |
| `bike-crossing-sign` | 1 | recall | signs |
| `bike-lane-turns` | 1 | scenario | laws |
| `bike-lane-use` | 1 | recall | markings |
| `blind-pedestrian-priority` | 1 | recall | row |
| `blind-pedestrian-signal` | 1 | recall | row |
| `blind-spot-checks` | 1 | recall | safety |
| `blocked-intersection` | 1 | recall | row |
| `brake-pedal-fault` | 1 | recall | vehicle |
| `broken-yellow-line` | 1 | recall | markings |
| `carbon-monoxide-risk` | 1 | recall | safety |
| `center-turn-lane` | 1 | scenario | markings |
| `centre-line-passing-rule` | 1 | recall | signs |
| `chevron-sign` | 1 | recall | signs |
| `child-restraint` | 1 | recall | safety |
| `child-restraint-seat` | 1 | recall | safety |
| `collision-information-exchange` | 1 | recall | safety |
| `crash-duty-to-stop` | 1 | recall | laws |
| `crash-scene-first-action` | 1 | recall | safety |
| `crossing-guard-authority` | 1 | recall | vulnerable |
| `crosswalk-markings` | 1 | recall | markings |
| `crosswalk-pedestrian-priority` | 1 | recall | row |
| `cyclist-swerve` | 1 | recall | vulnerable |
| `dead-end-sign` | 1 | recall | signs |
| `distracted-driving` | 1 | recall | laws |
| `divided-highway-sign` | 1 | recall | signs |
| `do-not-enter-sign` | 1 | recall | signs |
| `documents-to-carry` | 1 | recall | laws |
| `double-solid-yellow` | 1 | recall | markings |
| `drink-driving-planning` | 1 | recall | alcohol |
| `driveway-exit` | 1 | scenario | laws |
| `drowsy-driving` | 1 | recall | safety |
| `dwi-child-passenger` | 1 | recall | alcohol |
| `dwi-penalties` | 1 | recall | alcohol |
| `e-scooter-in-bike-lane` | 1 | recall | vulnerable |
| `elderly-pedestrian` | 1 | recall | vulnerable |
| `emergency-vehicle-approach` | 1 | recall | row |
| `engine-stall` | 1 | recall | safety |
| `exiting-parked-car` | 1 | recall | parking |
| `fire-hydrant-distance` | 1 | recall | parking |
| `fog-driving` | 1 | recall | speed |
| `four-way-stop-simultaneous` | 1 | recall | row |
| `freeway-entrance-ramp` | 1 | recall | speed |
| `freeway-merge-priority` | 1 | recall | row |
| `frost-clearance` | 1 | recall | vehicle |
| `fuel-reserve` | 1 | recall | vehicle |
| `gps-while-driving` | 1 | recall | laws |
| `green-arrow-light` | 1 | recall | signs |
| `group-of-cyclists` | 1 | recall | vulnerable |
| `headlight-failure` | 1 | recall | vehicle |
| `headlight-flash-response` | 1 | recall | row |
| `headlight-use-required` | 1 | recall | safety |
| `headphones-while-driving` | 1 | recall | laws |
| `high-beam-dimming` | 1 | recall | safety |
| `highway-shoulder-stop` | 1 | recall | parking |
| `hill-crest-speed` | 1 | recall | speed |
| `hill-parking-rationale` | 1 | recall | parking |
| `hill-sign` | 1 | recall | signs |
| `horn-use` | 1 | recall | vehicle |
| `horse-and-rider` | 1 | recall | vulnerable |
| `hot-car` | 1 | recall | safety |
| `hov-lane-marking` | 1 | recall | markings |
| `implied-consent-refusal` | 1 | recall | alcohol |
| `keep-right-sign` | 1 | recall | signs |
| `lane-end-merge` | 1 | recall | markings |
| `leaving-parking-space` | 1 | recall | parking |
| `left-turn-priority` | 1 | recall | row |
| `licence-points` | 1 | recall | laws |
| `line-colour-system` | 1 | recall | markings |
| `littering` | 1 | recall | laws |
| `littering-fine` | 1 | recall | laws |
| `loose-objects` | 1 | recall | vehicle |
| `marijuana-and-driving` | 1 | recall | alcohol |
| `medicine-and-driving` | 1 | recall | alcohol |
| `merge-sign` | 1 | recall | signs |
| `mirror-limits` | 1 | recall | vehicle |
| `motorcycle-indicators` | 1 | recall | vulnerable |
| `motorcycle-lane-sharing` | 1 | recall | vulnerable |
| `motorcycle-lane-splitting` | 1 | scenario | vulnerable |
| `motorcycle-position-in-lane` | 1 | recall | vulnerable |
| `motorcycle-sharing-lane` | 1 | recall | safety |
| `motorcycle-visibility` | 1 | recall | vulnerable |
| `narrow-road-priority` | 1 | recall | row |
| `night-driving-risk` | 1 | recall | speed |
| `no-left-turn-sign` | 1 | recall | signs |
| `no-parking-sign` | 1 | recall | signs |
| `no-passing-zone-sign` | 1 | recall | signs |
| `no-passing-zones` | 1 | recall | markings |
| `no-u-turn-sign` | 1 | recall | signs |
| `oncoming-headlight-glare` | 1 | recall | safety |
| `oncoming-vehicle-drift` | 1 | recall | safety |
| `one-way-parking-side` | 1 | recall | parking |
| `one-way-sign` | 1 | recall | signs |
| `open-container` | 1 | recall | laws |
| `open-container-law` | 1 | recall | alcohol |
| `parallel-parking-curb-distance` | 1 | recall | parking |
| `parked-car-door-risk` | 1 | recall | vulnerable |
| `parking-at-curb` | 1 | recall | parking |
| `parking-clearances` | 1 | recall | parking |
| `parking-near-fire-station` | 1 | recall | parking |
| `passing-and-speed-limit` | 1 | recall | speed |
| `passing-distance` | 1 | recall | speed |
| `passing-on-the-right` | 1 | recall | markings |
| `pedestrian-against-signal` | 1 | recall | vulnerable |
| `pedestrian-crossing-sign` | 1 | recall | signs |
| `pedestrian-crosswalk` | 1 | scenario | vulnerable |
| `police-pull-over` | 1 | recall | laws |
| `pre-drive-adjustment` | 1 | recall | vehicle |
| `private-drive-yield` | 1 | recall | row |

and 83 more. See `node scripts/validate-content.mjs` for the full list.

## Source provenance

Every question resolves to one of these registered sources. Direct agency
sources are labelled **Official source** in the app; the multi-handbook U.S.
composite is labelled **Reference basis**, because it is not a single official
document.

| Source | Authority | Jurisdiction | Verified | Questions citing it directly | Via category default |
|---|---|---|---|---|---|
| ca-dmv-driver-handbook | California DMV | CA | 2026-08-23 | 25 | 0 |
| tx-dps-driver-handbook | Texas DPS | TX | 2026-08-23 | 24 | 0 |
| ny-dmv-driver-manual | New York DMV | NY | 2026-08-23 | 6 | 0 |
| fl-flhsmv-handbook | FLHSMV | FL | 2026-08-23 | 6 | 0 |
| wa-dol-driver-guide | Washington DOL | WA | 2026-08-23 | 6 | 0 |
| pa-penndot-driver-manual | PennDOT | PA | 2026-08-23 | 7 | 0 |
| uk-highway-code | Department for Transport | UK | 2026-09-22 | 1364 | 0 |
| uk-know-your-traffic-signs | Department for Transport | UK | 2026-09-22 | 215 | 0 |
| uk-theory-test-format | DVSA | UK | 2026-09-22 | 0 | 0 |
| us-dmv-handbooks-composite | Multiple state DMVs (composite) | * | 2026-08-23 | 267 | 0 |

A source older than `VERIFICATION_MAX_AGE_DAYS` (365) fails content QA
(`scripts/content-checks.mjs`, rule `provenance-stale`), so the table above
cannot silently go stale.

## Open review notes from content QA

4 advisory notes, grouped by rule. These are surfaced, never
silently dropped, and none of them fail the build on their own.

### explanation — 4

- [uk-478] explanation shares no wording with the correct answer — check it explains the right option
- [uk-1419] explanation shares no wording with the correct answer — check it explains the right option
- [uk-1479] explanation shares no wording with the correct answer — check it explains the right option
- [uk-1504] explanation shares no wording with the correct answer — check it explains the right option

## Reproducing this file

```bash
node scripts/validate-content.mjs --strict   # content QA, must pass
node scripts/content-coverage.mjs --write    # regenerate this file
node scripts/content-coverage.mjs --check    # CI: fail if it is out of date
```
