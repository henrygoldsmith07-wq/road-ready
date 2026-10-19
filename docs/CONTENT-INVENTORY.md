# Road Ready content inventory

> **Generated file — do not edit by hand.**
>
> Source: `scripts/content-coverage.mjs`, run against the canonical content
> sources (`js/questions.js`, `js/concepts.js`, `js/state-packs.js`,
> `js/packs/uk.js`, `js/exam-blueprints.js`, `js/jurisdictions.js`).
>
> Regenerate with `node scripts/content-coverage.mjs --write`.
> Every count in `README.md` should trace back to this file.

**Generated:** 2026-10-19

## Headline numbers

| Measure | Value |
|---|---|
| Questions in the full bank | 2215 |
| Universal (US, no state pack) bank | 477 |
| Jurisdiction-pack questions | 1738 |
| Great Britain pack questions | 1579 |
| U.S. state-pack questions (six states) | 159 |
| Distinct concepts | 659 |
| Concepts with 3+ questions | 561 |
| Concepts with 2+ question forms | 562 |
| Concepts with a single question | 74 |
| Distinct question forms | 9 |
| Road signs with artwork | 58 |
| Registered jurisdictions (packs) | 8 |

## What these numbers do and do not support

The table below is the honest version of the product's coverage claim.

| Jurisdiction | Universal bank | Own pack questions | Total available | Unique questions for an official-length mock | Own-pack depth vs a full exam |
|---|---|---|---|---|---|
| General U.S. rules — no state pack selected | 477 | 0 | 477 | n/a (no published exam spec) | n/a |
| California (DMV) | 477 | 33 | 510 | yes - 510 available, 46 needed | **33 own questions - 72% of a full exam's worth (46 needed)** |
| Texas (DPS) | 477 | 30 | 507 | yes - 507 available, 30 needed | 30 own questions (100% of a full exam's worth) |
| New York (DMV) | 477 | 24 | 501 | yes - 501 available, 20 needed | 24 own questions (120% of a full exam's worth) |
| Florida (FLHSMV) | 477 | 24 | 501 | yes - 501 available, 50 needed | **24 own questions - 48% of a full exam's worth (50 needed)** |
| Washington (DOL) | 477 | 24 | 501 | yes - 501 available, 40 needed | **24 own questions - 60% of a full exam's worth (40 needed)** |
| Pennsylvania (PennDOT) | 477 | 24 | 501 | yes - 501 available, 18 needed | 24 own questions (133% of a full exam's worth) |
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
| Safety & Emergencies | 320 | 98 | 86 | 9 |
| Signs & Signals | 286 | 93 | 71 | 9 |
| People & Riders | 256 | 68 | 66 | 9 |
| Rules & Penalties | 229 | 74 | 62 | 9 |
| Markings & Lanes | 217 | 59 | 54 | 8 |
| Right of Way | 212 | 62 | 50 | 9 |
| Speed & Distance | 193 | 56 | 48 | 8 |
| Alcohol & Drugs | 190 | 60 | 58 | 6 |
| Parking & Stopping | 171 | 48 | 48 | 7 |
| Vehicle Basics | 141 | 50 | 42 | 6 |

A high concept count with a low "concepts with variation" number means the
topic is broad but shallow: each rule is tested by one question, so a right
answer is evidence about one question, not about the rule.

## Question-form distribution

| Form | Questions | Share |
|---|---|---|
| scenario | 577 | 26.0% |
| recall | 529 | 23.9% |
| what-next | 514 | 23.2% |
| multi-step | 218 | 9.8% |
| sign-combo | 210 | 9.5% |
| diagram | 68 | 3.1% |
| photo | 56 | 2.5% |
| lane-choice | 29 | 1.3% |
| prioritisation | 14 | 0.6% |

Recall and scenario forms dominate. 98 concepts have fewer than
three questions, which limits how well the app can verify that a learner can
apply a rule to an unfamiliar situation rather than recognise a familiar
prompt.

## Concepts that cannot yet evidence transfer

Listed so the gap is visible in review rather than hidden inside a topic total.
Batch 1 of the content plan targets the concepts a learner is most likely to
meet first; this list is the work queue, in priority order.

| Concept | Questions | Forms | Topic |
|---|---|---|---|
| `passing-distance` | 1 | recall | speed |
| `passing-on-the-right` | 1 | recall | markings |
| `pedestrian-against-signal` | 1 | recall | vulnerable |
| `pedestrian-crossing-sign` | 1 | recall | signs |
| `police-pull-over` | 1 | recall | laws |
| `pre-drive-adjustment` | 1 | recall | vehicle |
| `private-drive-yield` | 1 | recall | row |
| `provisional-license` | 1 | recall | laws |
| `railroad-crossbuck` | 1 | recall | markings |
| `railroad-crossing-response` | 1 | recall | signs |
| `railroad-crossing-sign` | 1 | recall | signs |
| `railroad-stop` | 1 | recall | signs |
| `raised-pavement-markers` | 1 | recall | markings |
| `reckless-driving` | 1 | recall | laws |
| `regulatory-vs-warning` | 1 | recall | signs |
| `reversing-camera` | 1 | recall | vehicle |
| `reversing-yield` | 1 | recall | row |
| `right-turn-on-red` | 1 | recall | laws |
| `right-turn-pedestrian-yield` | 1 | recall | row |
| `roundabout-entry-yield` | 1 | recall | row |
| `roundabout-sign` | 1 | recall | signs |
| `school-bus-divided` | 1 | recall | row |
| `school-bus-undivided` | 1 | recall | row |
| `school-crossing-vs-zone` | 1 | recall | signs |
| `school-zone-sign` | 1 | recall | signs |
| `seat-belt-law` | 1 | recall | safety |
| `seatbelt-back-seat` | 1 | recall | safety |
| `seatbelt-law` | 1 | scenario | safety |
| `services-sign` | 1 | recall | signs |
| `signal-ahead-sign` | 1 | recall | signs |
| `signal-distance` | 1 | recall | safety |
| `signalling-requirement` | 1 | recall | laws |
| `slippery-road-sign` | 1 | recall | signs |
| `slow-driving-hazard` | 1 | recall | speed |
| `slower-traffic-keep-right` | 1 | recall | laws |
| `soft-shoulder-sign` | 1 | recall | signs |
| `solid-white-lane-line` | 1 | recall | markings |
| `speed-and-stopping-distance` | 1 | recall | speed |
| `speed-limit-sign` | 1 | recall | signs |
| `stale-green-light` | 1 | recall | signs |
| `standard-drink-equivalence` | 1 | recall | alcohol |
| `steering-hand-position` | 1 | recall | vehicle |
| `stop-ahead-sign` | 1 | recall | signs |
| `stop-sign-response` | 1 | recall | signs |
| `stop-sign-shape` | 1 | recall | signs |
| `stopped-emergency-vehicle` | 1 | recall | row |
| `stopping-distance-components` | 1 | recall | speed |
| `stuck-accelerator` | 1 | recall | safety |
| `suspended-licence` | 1 | recall | laws |
| `t-intersection-priority` | 1 | recall | row |
| `tailgating-response` | 1 | recall | safety |
| `texting-while-driving` | 1 | recall | safety |
| `tire-blowout` | 1 | multi-step | safety |
| `towing-chains` | 1 | recall | vehicle |
| `truck-following-downgrade` | 1 | recall | speed |
| `truck-no-zones` | 1 | recall | safety |
| `turn-across-bike-lane` | 1 | recall | row |
| `turn-priority` | 1 | what-next | row |
| `two-way-left-turn-lane` | 1 | recall | markings |
| `two-way-traffic-sign` | 1 | recall | signs |
| `tyre-blowout` | 1 | recall | safety |
| `tyre-pressure-source` | 1 | recall | vehicle |
| `tyre-tread-test` | 1 | recall | vehicle |
| `u-turn-legality` | 1 | recall | laws |
| `unattended-vehicle-damage` | 1 | recall | safety |
| `uncontrolled-intersection-tie` | 1 | recall | row |
| `under-21-alcohol-limit` | 1 | recall | alcohol |
| `uphill-stop-in-traffic` | 1 | recall | vehicle |
| `wiper-condition` | 1 | recall | vehicle |
| `work-zone-authority` | 1 | recall | signs |
| `work-zone-sign` | 1 | recall | signs |
| `work-zone-speed` | 1 | recall | speed |
| `wrong-way-sign` | 1 | recall | signs |
| `yield-sign-meaning` | 1 | recall | signs |
| `brake-failure` | 2 | recall, multi-step | safety |
| `crash-protocol` | 2 | multi-step | laws |
| `curb-colours` | 2 | recall | parking |
| `curb-distance` | 2 | recall | parking |
| `distracted-driving` | 2 | recall | laws |
| `dwi-penalties` | 2 | recall, scenario | alcohol |
| `emergency-vehicles` | 2 | recall, multi-step | laws |
| `following-distance-seconds` | 2 | recall | speed |
| `gore-area` | 2 | recall, what-next | markings |
| `headlight-use` | 2 | recall | safety |
| `hill-parking-wheels` | 2 | recall | parking |
| `illegal-parking` | 2 | recall | parking |
| `implied-consent` | 2 | recall | laws |
| `junior-license` | 2 | recall | laws |
| `left-on-red` | 2 | recall | row |
| `merge-priority` | 2 | scenario, diagram | row |
| `open-container` | 2 | recall | laws |
| `pedestrian-crosswalk` | 2 | scenario | vulnerable |
| `roundabout-yield` | 2 | scenario | row |
| `school-zone-speed` | 2 | scenario, recall | vulnerable |
| `sign-color` | 2 | sign-combo | signs |
| `sign-shape` | 2 | sign-combo | signs |
| `skid-recovery` | 2 | recall, scenario | safety |
| `two-way-left-turn` | 2 | lane-choice | markings |


## Source provenance

Every question resolves to one of these registered sources. Direct agency
sources are labelled **Official source** in the app; the multi-handbook U.S.
composite is labelled **Reference basis**, because it is not a single official
document.

| Source | Authority | Jurisdiction | Verified | Questions citing it directly | Via category default |
|---|---|---|---|---|---|
| ca-dmv-driver-handbook | California DMV | CA | 2026-08-23 | 33 | 0 |
| tx-dps-driver-handbook | Texas DPS | TX | 2026-08-23 | 30 | 0 |
| ny-dmv-driver-manual | New York DMV | NY | 2026-08-23 | 24 | 0 |
| fl-flhsmv-handbook | FLHSMV | FL | 2026-08-23 | 24 | 0 |
| wa-dol-driver-guide | Washington DOL | WA | 2026-08-23 | 24 | 0 |
| pa-penndot-driver-manual | PennDOT | PA | 2026-08-23 | 24 | 0 |
| uk-highway-code | Department for Transport | UK | 2026-09-22 | 1364 | 0 |
| uk-know-your-traffic-signs | Department for Transport | UK | 2026-09-22 | 215 | 0 |
| uk-theory-test-format | DVSA | UK | 2026-09-22 | 0 | 0 |
| us-dmv-handbooks-composite | Multiple state DMVs (composite) | * | 2026-08-23 | 477 | 0 |

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
