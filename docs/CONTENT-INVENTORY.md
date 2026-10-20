# Road Ready content inventory

> **Generated file — do not edit by hand.**
>
> Source: `scripts/content-coverage.mjs`, run against the canonical content
> sources (`js/questions.js`, `js/concepts.js`, `js/state-packs.js`,
> `js/packs/uk.js`, `js/exam-blueprints.js`, `js/jurisdictions.js`).
>
> Regenerate with `node scripts/content-coverage.mjs --write`.
> Every count in `README.md` should trace back to this file.

**Generated:** 2026-10-20

## Headline numbers

| Measure | Value |
|---|---|
| Questions in the full bank | 2390 |
| Universal (US, no state pack) bank | 625 |
| Jurisdiction-pack questions | 1765 |
| Great Britain pack questions | 1579 |
| U.S. state-pack questions (six states) | 186 |
| Distinct concepts | 659 |
| Concepts with 3+ questions | 623 |
| Concepts with 2+ question forms | 654 |
| Concepts with a single question | 3 |
| Distinct question forms | 9 |
| Road signs with artwork | 58 |
| Registered jurisdictions (packs) | 8 |

## What these numbers do and do not support

The table below is the honest version of the product's coverage claim.

| Jurisdiction | Universal bank | Own pack questions | Total available | Unique questions for an official-length mock | Own-pack depth vs a full exam |
|---|---|---|---|---|---|
| General U.S. rules — no state pack selected | 625 | 0 | 625 | n/a (no published exam spec) | n/a |
| California (DMV) | 625 | 38 | 663 | yes - 663 available, 46 needed | **38 own questions - 83% of a full exam's worth (46 needed)** |
| Texas (DPS) | 625 | 37 | 662 | yes - 662 available, 30 needed | 37 own questions (123% of a full exam's worth) |
| New York (DMV) | 625 | 30 | 655 | yes - 655 available, 20 needed | 30 own questions (150% of a full exam's worth) |
| Florida (FLHSMV) | 625 | 28 | 653 | yes - 653 available, 50 needed | **28 own questions - 56% of a full exam's worth (50 needed)** |
| Washington (DOL) | 625 | 27 | 652 | yes - 652 available, 40 needed | **27 own questions - 68% of a full exam's worth (40 needed)** |
| Pennsylvania (PennDOT) | 625 | 26 | 651 | yes - 651 available, 18 needed | 26 own questions (144% of a full exam's worth) |
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
| Signs & Signals | 337 | 93 | 93 | 9 |
| Safety & Emergencies | 337 | 98 | 96 | 9 |
| People & Riders | 262 | 68 | 67 | 9 |
| Rules & Penalties | 258 | 74 | 71 | 9 |
| Right of Way | 236 | 63 | 62 | 9 |
| Markings & Lanes | 229 | 59 | 59 | 8 |
| Speed & Distance | 204 | 56 | 54 | 8 |
| Alcohol & Drugs | 196 | 60 | 60 | 7 |
| Parking & Stopping | 179 | 48 | 48 | 7 |
| Vehicle Basics | 152 | 50 | 49 | 6 |

A high concept count with a low "concepts with variation" number means the
topic is broad but shallow: each rule is tested by one question, so a right
answer is evidence about one question, not about the rule.

## Question-form distribution

| Form | Questions | Share |
|---|---|---|
| scenario | 606 | 25.4% |
| what-next | 584 | 24.4% |
| recall | 577 | 24.1% |
| multi-step | 218 | 9.1% |
| sign-combo | 212 | 8.9% |
| diagram | 86 | 3.6% |
| photo | 58 | 2.4% |
| lane-choice | 33 | 1.4% |
| prioritisation | 16 | 0.7% |

Recall and scenario forms dominate. 5 concepts cannot
evidence transfer at all, which limits how well the app can verify that a
learner can apply a rule to an unfamiliar situation rather than recognise a
familiar prompt.

## Concepts that cannot yet evidence transfer

Listed so the gap is visible in review rather than hidden inside a topic total.
A concept appears here when it offers fewer than two questions, or fewer than
two question forms — the same test the mastery engine applies, so this list is
exactly the set of concepts the app can never show transfer for. Add a second
form (not merely a second near-identical question) to clear a row.

| Concept | Questions | Forms | Topic |
|---|---|---|---|
| `signal-distance` | 1 | recall | safety |
| `slower-traffic-keep-right` | 1 | recall | laws |
| `towing-chains` | 1 | recall | vehicle |
| `motorcycle-helmet` | 3 | recall | vulnerable |
| `zero-tolerance` | 6 | recall | alcohol |


## Source provenance

Every question resolves to one of these registered sources. Direct agency
sources are labelled **Official source** in the app; the multi-handbook U.S.
composite is labelled **Reference basis**, because it is not a single official
document.

| Source | Authority | Jurisdiction | Verified | Questions citing it directly | Via category default |
|---|---|---|---|---|---|
| ca-dmv-driver-handbook | California DMV | CA | 2026-08-23 | 38 | 0 |
| tx-dps-driver-handbook | Texas DPS | TX | 2026-08-23 | 37 | 0 |
| ny-dmv-driver-manual | New York DMV | NY | 2026-08-23 | 30 | 0 |
| fl-flhsmv-handbook | FLHSMV | FL | 2026-08-23 | 28 | 0 |
| wa-dol-driver-guide | Washington DOL | WA | 2026-08-23 | 27 | 0 |
| pa-penndot-driver-manual | PennDOT | PA | 2026-08-23 | 26 | 0 |
| uk-highway-code | Department for Transport | UK | 2026-09-22 | 1364 | 0 |
| uk-know-your-traffic-signs | Department for Transport | UK | 2026-09-22 | 215 | 0 |
| uk-theory-test-format | DVSA | UK | 2026-09-22 | 0 | 0 |
| us-dmv-handbooks-composite | Multiple state DMVs (composite) | * | 2026-08-23 | 625 | 0 |

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
