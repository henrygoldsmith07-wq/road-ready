# Road Ready â€” Pass Your Driving Test

A self-contained driving-theory study app. No build step, no dependencies, no internet needed â€” just open `index.html` in any browser.

## What Road Ready is (product decision)

**Jurisdiction-pluggable driving-theory trainer. Launching with one jurisdiction done extremely well: the United States** (universal bank + CA, TX, NY, FL, WA, PA region packs with official exam simulations).

The architecture is built for expansion to other countries: concepts, terminology, signs, scoring and test formats are jurisdiction modules (`js/jurisdictions.js` defines the contract; `js/state-packs.js`, `js/exam-blueprints.js` and the source registry are the U.S. module's data). The content QA system enforces the contract â€” packs and blueprints must be registered regions or CI fails.

Two honest scoping calls that follow from this:
- **Hazard Perception is labeled bonus training**, not "the real test" â€” most U.S. knowledge exams don't include it (it's a UK-style section). The trainer stays because early hazard spotting is universally valuable; when a jurisdiction module includes it in its exam (e.g., UK), its module declares `hazardPerception.includedInExam: true` and the UI copy updates itself.
- **"DMV" wording is jurisdiction terminology**, driven by `terminology` in the active country module â€” not a hardcoded assumption.

**Design:** minimal, monochrome, icon-driven â€” a hand-drawn stroke icon set (no emojis), flat surfaces with hairline borders, inverted primary actions, and dark/light themes. Road signs keep their real-world colors because they're the teaching content.

## Run it

- **Easiest:** double-click `index.html`
- **Or serve it** (nicer URLs): `node serve.js` â†’ http://localhost:8321

## What's inside

| Feature | What it does |
|---|---|
| Onboarding | A 4-step first-run intro: what's inside, theme + read-aloud setup, and how the daily habit works â€” skippable, shown once |
| Adaptive Practice | 246 questions across 10 topics, organized into **concepts**, spanning multiple **question forms** â€” junction-priority road-layout scenes, lane-selection diagrams, sign combinations, what-happens-next chains, prioritisation drills and deliberately similar alternatives, alongside classic recall; mastery aggregates per concept (coverage Ã— depth), then topic, then overall score, so memorizing a single question can't max out a concept |
| Marathon Mode | The full 186-question bank in one run â€” anything you miss comes back until you've seen it through |
| Mock Exams | Quick Check (10), Standard (20), Full (46), or a Weak-Topics exam â€” timed at 1 min/question, DMV-style pass mark, no feedback until you submit |
| Official Simulations | Pick your state and the exam locks to its real spec â€” CA 46/38, TX 30/21, NY 20/14, FL 50/40 in 60 min, WA 40/32, PA 18/15. Jurisdiction pool only, official pass bar, feedback at the end (`js/exam-blueprints.js`, source-cited) |
| Hazard Perception | Interactive trainer with 6 animated scenarios (children, doors, deer, cyclistsâ€¦) â€” honestly labeled bonus training (most U.S. exams don't include it); jurisdiction modules declare whether their exam does |
| Sign Flashcards | 31 hand-drawn SVG road signs with flip animation and known/still-learning tracking |
| Study Guide | Cheat sheets (sign system, markings, right-of-way, emergencies, hill parking, key numbers) plus a full behind-the-wheel road test guide |
| Read Aloud | Text-to-speech for questions, choices, and explanations â€” great for commutes and accessibility |
| XP & Achievements | Earn XP for every answer, climb levels, and unlock 12 achievements from First Steps to Hawk Eye |
| Review Missed | Every question you've ever missed, with the correct answer and why â€” plus one-tap drills |
| Progress | Study-progress score, per-topic mastery, accuracy, day streak, daily goal, study time, exam history |
| Drive Log *(new)* | Log supervised sessions (duration, conditions, road types, ✓/△/✗ per skill, instructor notes); skills roll up into 7 competencies (Observation, Vehicle control, Junctions, Roundabouts, Lane discipline, Parking, Independent driving) with a next-lesson-focus recommendation |
| Driving Readiness | Theory progress + practical competency blend into one heuristic score — clearly labeled as uncalibrated until real outcome data exists |
| Outcome Journal *(beta)* | The progress % is an **uncalibrated heuristic**, not a predicted pass probability. Log your real test result (opt-in, on-device only) â€” progress %, mock average, questions seen and study time are snapshotted with the outcome to ground a future P(pass) model |
| Test Day Plan | Save your knowledge-test date and get an adaptive daily question target plus the best next action; private and fully offline |
| Official Sources | State-rule explanations and Study Guide facts link directly to the issuing DMV/DPS/DOL handbook; dedicated State Rules drills keep the cited material together |
| Settings | Pass mark (75/80/85%), exam length, instant-feedback toggle, full progress reset |

Everything is stored locally in your browser (localStorage) â€” nothing leaves your machine.

## Keyboard shortcuts

- `1`â€“`4` â€” answer the question
- `Enter` â€” next question (practice) / flip flashcard
- `F` â€” flag the current question
- `â†`/`â†’` â€” flashcard navigation Â· `K` know it / `L` still learning

## Content notes

Questions follow general U.S. rules of the road common across state DMV handbooks. Limits and specific distances vary by state â€” always confirm with your official driver handbook. (The app says so on the home screen.)

## Files

- `index.html` â€” app shell, views, and the study guide content
- `css/styles.css` â€” monochrome dark/light theming, minimal component styles
- `js/icons.js` â€” stroke icon set (~34 icons, currentColor)
- `js/questions.js` â€” the question bank (186 Qs with explanations)
- `js/signs.js` â€” SVG road-sign library (31 signs)
- `js/core.js` â€” pure engine: scoring, readiness, adaptive selection, spaced scheduling, exam assembly/grading, hazard scoring, XP/levels, achievements, state migration, import/export
- `js/state-packs.js` â€” state-specific content packs (CA, TX, NY, FL, WA, PA)
- `js/app.js` â€” views and DOM wiring
- `serve.js` â€” tiny static server for local testing

## Development

No build step â€” the app is plain HTML/CSS/JS. Tooling is dev-only:

```bash
npm install          # dev dependencies only
npm test             # unit tests + strict content QA
npm run test:watch   # vitest in watch mode
npm run validate     # content QA system (schema, dupes, balance, explanations, signs, provenance)
npm run provenance:update   # regenerate content-manifest.json after content changes
npm run test:e2e     # Playwright E2E (desktop + mobile projects)
```

## Automated QA & testing

**Unit tests (`tests/`, Vitest)** cover question scoring/mastery, pass/fail grading,
exam timing, adaptive selection, missed-question resurfacing, weak-topic
scheduling (SM-2-lite), progress statistics/readiness, XP & levels,
achievements, hazard scoring, localStorage migration/versioning, import/export
and state packs.

**Content QA system (`scripts/`)** validates every commit's content:
question-bank schema, duplicate questions (prompt+sign identity), duplicate
answers within a question, topic-balance floor, broken-explanation heuristics
(placeholders, answer echoes), sign-data completeness + balanced SVG markup.

**Provenance is factual QA, not change tracking.** Every question must resolve
to a registered official source (`SOURCE_REGISTRY` in `js/state-packs.js` â€”
issuing agency, document title, URL on an approved `.gov`-class host,
verification date); universal questions resolve through explicit per-category
defaults. CI fails when: a question has no resolvable source; a source's
jurisdiction doesn't cover the question; verification goes stale (>365 days);
or a state-specific answer/explanation contradicts the pack's fact table
(numbers compared numerically â€” "four" == "4", BAC decimals exact).
`content-manifest.json` stores the resolved provenance snapshot (authority,
document, section, verifiedAt) alongside each question's content hash;
uncommitted bank drift fails the build until you regenerate it.

**E2E (`e2e/`, Playwright)** runs real journeys â€” onboarding, practice,
timed mock exam, flashcards, import/export round-trip, PWA offline reload,
accessibility checks â€” on desktop Chrome plus iPhone and Pixel profiles.

## PWA / offline

Installable (`manifest.webmanifest`) with a service worker (`sw.js`) that
pre-caches the full shell and serves stale-while-revalidate â€” the whole app
works offline after one visit. Progress lives in versioned localStorage
(`v2` schema) with a migration pipeline; Settings can export/import it as a
JSON backup.

## State packs

Settings â†’ "Your state's rules" selects a jurisdiction (CA, TX, NY, FL, WA, PA).
Each non-generic pack ships its own jurisdiction-tagged questions
(`jurisdiction:["XX"]`, `concept`, `sourceId`, `sourceSection`) that merge into
practice and exams when the pack is selected, plus a key-facts card (BAC limits,
school-bus rules, phone lawsâ€¦) at the top of the Study Guide. Universal
questions apply to every pack. Add a pack by appending an entry to
`js/state-packs.js` â€” the content QA system validates its questions, facts and
provenance fields. `SOURCE_REGISTRY` maps every jurisdiction pack to a verified
HTTPS resource on its issuing agency's official domain; broken, missing, or
third-party source records fail validation.
