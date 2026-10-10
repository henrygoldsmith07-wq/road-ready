# Road Ready content inventory

> **Generated file — do not edit by hand.**
>
> Source: `scripts/content-coverage.mjs`, run against the canonical content
> sources (`js/questions.js`, `js/concepts.js`, `js/state-packs.js`,
> `js/packs/uk.js`, `js/exam-blueprints.js`, `js/jurisdictions.js`).
>
> Regenerate with `node scripts/content-coverage.mjs --write`.
> Every count in `README.md` should trace back to this file.

**Generated:** 2026-10-10

## Headline numbers

| Measure | Value |
|---|---|
| Questions in the full bank | 715 |
| Universal (US, no state pack) bank | 267 |
| Jurisdiction-pack questions | 448 |
| Great Britain pack questions | 410 |
| U.S. state-pack questions (six states) | 38 |
| Distinct concepts | 572 |
| Concepts with 3+ questions | 22 |
| Concepts with 2+ question forms | 39 |
| Concepts with a single question | 512 |
| Distinct question forms | 9 |
| Road signs with artwork | 58 |
| Registered jurisdictions (packs) | 8 |

## What these numbers do and do not support

The table below is the honest version of the product's coverage claim.

| Jurisdiction | Universal bank | Own pack questions | Total available | Unique questions for an official-length mock | Own-pack depth vs a full exam |
|---|---|---|---|---|---|
| General U.S. rules — no state pack selected | 267 | 0 | 267 | n/a (no published exam spec) | n/a |
| California (DMV) | 267 | 7 | 274 | yes - 274 available, 46 needed | **7 own questions - 15% of a full exam's worth (46 needed)** |
| Texas (DPS) | 267 | 6 | 273 | yes - 273 available, 30 needed | **6 own questions - 20% of a full exam's worth (30 needed)** |
| New York (DMV) | 267 | 6 | 273 | yes - 273 available, 20 needed | **6 own questions - 30% of a full exam's worth (20 needed)** |
| Florida (FLHSMV) | 267 | 6 | 273 | yes - 273 available, 50 needed | **6 own questions - 12% of a full exam's worth (50 needed)** |
| Washington (DOL) | 267 | 6 | 273 | yes - 273 available, 40 needed | **6 own questions - 15% of a full exam's worth (40 needed)** |
| Pennsylvania (PennDOT) | 267 | 7 | 274 | yes - 274 available, 18 needed | **7 own questions - 39% of a full exam's worth (18 needed)** |
| Great Britain (DVSA car) | 0 | 410 | 410 | yes - 410 available, 50 needed | 410 own questions (820% of a full exam's worth) |

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
| Signs & Signals | 109 | 92 | 10 | 7 |
| Safety & Emergencies | 107 | 86 | 7 | 7 |
| Right of Way | 86 | 61 | 9 | 8 |
| People & Riders | 77 | 60 | 5 | 7 |
| Markings & Lanes | 75 | 56 | 8 | 7 |
| Rules & Penalties | 69 | 60 | 6 | 6 |
| Speed & Distance | 64 | 55 | 5 | 6 |
| Parking & Stopping | 50 | 44 | 6 | 4 |
| Alcohol & Drugs | 43 | 28 | 3 | 4 |
| Vehicle Basics | 35 | 35 | 0 | 4 |

A high concept count with a low "concepts with variation" number means the
topic is broad but shallow: each rule is tested by one question, so a right
answer is evidence about one question, not about the rule.

## Question-form distribution

| Form | Questions | Share |
|---|---|---|
| recall | 407 | 56.9% |
| scenario | 128 | 17.9% |
| multi-step | 55 | 7.7% |
| what-next | 40 | 5.6% |
| diagram | 28 | 3.9% |
| sign-combo | 25 | 3.5% |
| prioritisation | 14 | 2.0% |
| lane-choice | 10 | 1.4% |
| photo | 8 | 1.1% |

Recall and scenario forms dominate. 550 concepts have fewer than
three questions, which limits how well the app can verify that a learner can
apply a rule to an unfamiliar situation rather than recognise a familiar
prompt.

## Concepts that cannot yet evidence transfer

Listed so the gap is visible in review rather than hidden inside a topic total.
Batch 1 of the content plan targets the concepts a learner is most likely to
meet first; this list is the work queue, in priority order.

| Concept | Questions | Forms | Topic |
|---|---|---|---|
| `abs-emergency-braking` | 1 | recall | vehicle |
| `abs-steering-practice` | 1 | scenario | safety |
| `absent-fault-light-intermittent` | 1 | what-next | vehicle |
| `accident-evidence-order` | 1 | prioritisation | safety |
| `accident-scene-safety` | 1 | recall | safety |
| `address-change-notification` | 1 | recall | laws |
| `advisory-sign-exemptions` | 1 | scenario | speed |
| `advisory-speed-sign` | 1 | recall | speed |
| `advisory-speed-signs` | 1 | recall | speed |
| `aggressive-driver-response` | 1 | recall | safety |
| `airbag-and-child-seat-distance` | 1 | recall | safety |
| `alcohol-driving-consequence` | 1 | recall | alcohol |
| `alcohol-first-effect` | 1 | recall | alcohol |
| `alcohol-impairment-realism` | 1 | what-next | alcohol |
| `alcohol-in-charge` | 1 | scenario | alcohol |
| `alcohol-measurement-offences` | 1 | multi-step | alcohol |
| `alcohol-persistence` | 1 | scenario | alcohol |
| `alcohol-under-twenty-one` | 1 | recall | alcohol |
| `alcohol-workplace-policy` | 1 | multi-step | alcohol |
| `animal-collision-avoidance` | 1 | scenario | vulnerable |
| `animal-crossing-sign` | 1 | recall | signs |
| `animal-on-road` | 1 | recall | safety |
| `anti-lock-braking-purpose` | 1 | recall | safety |
| `aquaplaning-response` | 1 | what-next | safety |
| `arrow-retiming` | 1 | scenario | markings |
| `authorised-person-signals` | 1 | recall | row |
| `bac-blood-limit` | 1 | recall | laws |
| `bac-determining-factors` | 1 | recall | alcohol |
| `bac-legal-limit` | 1 | recall | alcohol |
| `bac-reduction-myth` | 1 | recall | alcohol |
| `ball-into-street` | 1 | recall | vulnerable |
| `basic-speed-law` | 1 | recall | speed |
| `bike-crossing-sign` | 1 | recall | signs |
| `bike-lane-use` | 1 | recall | markings |
| `blind-pedestrian-priority` | 1 | recall | row |
| `blind-pedestrian-signal` | 1 | recall | row |
| `blind-spot-checks` | 1 | recall | safety |
| `blind-spot-pedestrian` | 1 | scenario | vulnerable |
| `blocked-intersection` | 1 | recall | row |
| `blocked-junction` | 1 | scenario | row |
| `blue-badge-scotland-stay` | 1 | recall | parking |
| `blue-circle-left-order` | 1 | scenario | signs |
| `blue-circle-mandatory-sign` | 1 | sign-combo | signs |
| `blue-circle-sign` | 1 | recall | signs |
| `box-junction-right-turn` | 1 | scenario | markings |
| `brake-pedal-fault` | 1 | recall | vehicle |
| `braking-distance-factors` | 1 | recall | speed |
| `breakdown-safe-place` | 1 | recall | safety |
| `breath-limit-measurement` | 1 | recall | alcohol |
| `broken-cycle-lane-entry` | 1 | recall | markings |
| `broken-white-line-meaning` | 1 | recall | markings |
| `broken-yellow-line` | 1 | recall | markings |
| `brown-tourist-signs` | 1 | scenario | signs |
| `built-up-area-default` | 1 | scenario | speed |
| `bus-lane-cycle-plate` | 1 | sign-combo | signs |
| `bus-stop-clearway-marking` | 1 | multi-step | markings |
| `bus-stop-waiting` | 1 | recall | parking |
| `car-trailer-speed-combination` | 1 | recall | speed |
| `carbon-monoxide-risk` | 1 | recall | safety |
| `careful-driving-duty` | 1 | recall | laws |
| `centre-line-passing-rule` | 1 | recall | signs |
| `centre-line-stopping` | 1 | recall | markings |
| `chevron-marking` | 1 | scenario | markings |
| `chevron-sign` | 1 | recall | signs |
| `child-restraint-seat` | 1 | recall | safety |
| `child-restraint-selection` | 1 | multi-step | safety |
| `coasting-control` | 1 | what-next | speed |
| `collision-casualty-movement` | 1 | recall | safety |
| `collision-information-exchange` | 1 | recall | safety |
| `collision-warn-traffic` | 1 | multi-step | safety |
| `controlled-parking-zone-sign` | 1 | scenario | parking |
| `crash-calling-emergency` | 1 | multi-step | safety |
| `crash-duty-to-stop` | 1 | recall | laws |
| `crash-scene-first-action` | 1 | recall | safety |
| `crash-scene-priority` | 1 | scenario | safety |
| `cross-hatching-markings` | 1 | scenario | markings |
| `crossing-guard-authority` | 1 | recall | vulnerable |
| `crossing-refuge` | 1 | what-next | row |
| `crossroads-junction-approaching` | 1 | diagram | laws |
| `crossroads-priority-arm` | 1 | recall | signs |
| `crossroads-warning` | 1 | scenario | signs |
| `crosswalk-markings` | 1 | recall | markings |
| `crosswalk-pedestrian-priority` | 1 | recall | row |
| `crosswind-hazard` | 1 | scenario | safety |
| `cycle-lane-at-junction` | 1 | multi-step | row |
| `cycle-lane-marking` | 1 | recall | markings |
| `cycle-lane-overtaking-blind-spot` | 1 | diagram | vulnerable |
| `cyclist-approach-speed` | 1 | multi-step | vulnerable |
| `cyclist-lane-crossing` | 1 | multi-step | vulnerable |
| `cyclist-night-visibility` | 1 | recall | vulnerable |
| `cyclist-overtaking-gap` | 1 | scenario | vulnerable |
| `cyclist-primary-position` | 1 | recall | vulnerable |
| `cyclist-swerve` | 1 | recall | vulnerable |
| `dead-end-sign` | 1 | recall | signs |
| `deafblind-cane` | 1 | recall | vulnerable |
| `direction-colour-sequence` | 1 | multi-step | signs |
| `directive-to-stop-ambiguity` | 1 | recall | laws |
| `disqualification-six-points` | 1 | recall | laws |
| `distance-judgement` | 1 | scenario | speed |
| `distracted-driving` | 1 | recall | laws |
| `distraction-recovery` | 1 | scenario | safety |
| `divided-highway-sign` | 1 | recall | signs |
| `do-not-enter-sign` | 1 | recall | signs |
| `documents-to-carry` | 1 | recall | laws |
| `dog-on-lead-crossing` | 1 | multi-step | vulnerable |
| `double-kerb-loading-marks` | 1 | recall | markings |
| `double-red-lines` | 1 | recall | markings |
| `double-solid-yellow` | 1 | recall | markings |
| `double-white-broken-near-side` | 1 | recall | markings |
| `double-white-junction` | 1 | multi-step | markings |
| `double-yellow-meaning` | 1 | recall | parking |
| `drink-driving-ban-period` | 1 | multi-step | laws |
| `drink-driving-planning` | 1 | recall | alcohol |
| `drink-driving-refusal` | 1 | recall | alcohol |
| `driver-responsibility-calibration` | 1 | recall | laws |
| `driving-licence-carrying` | 1 | recall | laws |
| `drowsy-driving` | 1 | recall | safety |
| `drug-driving-offence` | 1 | multi-step | alcohol |
| `e-scooter-in-bike-lane` | 1 | recall | vulnerable |
| `edge-of-carriageway-line` | 1 | scenario | markings |

and 430 more. See `node scripts/validate-content.mjs` for the full list.

## Source provenance

Every question resolves to one of these registered sources. Direct agency
sources are labelled **Official source** in the app; the multi-handbook U.S.
composite is labelled **Reference basis**, because it is not a single official
document.

| Source | Authority | Jurisdiction | Verified | Questions citing it directly | Via category default |
|---|---|---|---|---|---|
| ca-dmv-driver-handbook | California DMV | CA | 2026-08-23 | 7 | 0 |
| tx-dps-driver-handbook | Texas DPS | TX | 2026-08-23 | 6 | 0 |
| ny-dmv-driver-manual | New York DMV | NY | 2026-08-23 | 6 | 0 |
| fl-flhsmv-handbook | FLHSMV | FL | 2026-08-23 | 6 | 0 |
| wa-dol-driver-guide | Washington DOL | WA | 2026-08-23 | 6 | 0 |
| pa-penndot-driver-manual | PennDOT | PA | 2026-08-23 | 7 | 0 |
| uk-highway-code | Department for Transport | UK | 2026-09-22 | 352 | 0 |
| uk-know-your-traffic-signs | Department for Transport | UK | 2026-09-22 | 58 | 0 |
| uk-theory-test-format | DVSA | UK | 2026-09-22 | 0 | 0 |
| us-dmv-handbooks-composite | Multiple state DMVs (composite) | * | 2026-08-23 | 267 | 0 |

A source older than `VERIFICATION_MAX_AGE_DAYS` (365) fails content QA
(`scripts/content-checks.mjs`, rule `provenance-stale`), so the table above
cannot silently go stale.

## Open review notes from content QA

0 advisory notes, grouped by rule. These are surfaced, never
silently dropped, and none of them fail the build on their own.

## Reproducing this file

```bash
node scripts/validate-content.mjs --strict   # content QA, must pass
node scripts/content-coverage.mjs --write    # regenerate this file
node scripts/content-coverage.mjs --check    # CI: fail if it is out of date
```
