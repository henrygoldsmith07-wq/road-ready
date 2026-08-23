# Road Ready — Pass Your Driving Test

A self-contained driving-test study app. No build step, no dependencies, no internet needed — just open `index.html` in any browser.

**Design:** minimal, monochrome, icon-driven — a hand-drawn stroke icon set (no emojis), flat surfaces with hairline borders, inverted primary actions, and dark/light themes. Road signs keep their real-world colors because they're the teaching content.

## Run it

- **Easiest:** double-click `index.html`
- **Or serve it** (nicer URLs): `node serve.js` → http://localhost:8321

## What's inside

| Feature | What it does |
|---|---|
| Onboarding | A 4-step first-run intro: what's inside, theme + read-aloud setup, and how the daily habit works — skippable, shown once |
| Adaptive Practice | 186 questions across 10 topics; misses and unseen questions resurface more often, with instant explanations |
| Marathon Mode | The full 186-question bank in one run — anything you miss comes back until you've seen it through |
| Mock Exams | Quick Check (10), Standard (20), Full (46), or a Weak-Topics exam — timed at 1 min/question, DMV-style pass mark, no feedback until you submit |
| Hazard Perception | An interactive trainer with 6 animated scenarios (children, doors, deer, cyclists…) — react early, score more, chase your best out of 30 |
| Sign Flashcards | 31 hand-drawn SVG road signs with flip animation and known/still-learning tracking |
| Study Guide | Cheat sheets (sign system, markings, right-of-way, emergencies, hill parking, key numbers) plus a full behind-the-wheel road test guide |
| Read Aloud | Text-to-speech for questions, choices, and explanations — great for commutes and accessibility |
| XP & Achievements | Earn XP for every answer, climb levels, and unlock 12 achievements from First Steps to Hawk Eye |
| Review Missed | Every question you've ever missed, with the correct answer and why — plus one-tap drills |
| Progress | Readiness score, per-topic mastery, accuracy, day streak, daily goal, study time, exam history |
| Settings | Pass mark (75/80/85%), exam length, instant-feedback toggle, full progress reset |

Everything is stored locally in your browser (localStorage) — nothing leaves your machine.

## Keyboard shortcuts

- `1`–`4` — answer the question
- `Enter` — next question (practice) / flip flashcard
- `F` — flag the current question
- `←`/`→` — flashcard navigation · `K` know it / `L` still learning

## Content notes

Questions follow general U.S. rules of the road common across state DMV handbooks. Limits and specific distances vary by state — always confirm with your official driver handbook. (The app says so on the home screen.)

## Files

- `index.html` — app shell, views, and the study guide content
- `css/styles.css` — monochrome dark/light theming, minimal component styles
- `js/icons.js` — stroke icon set (~34 icons, currentColor)
- `js/questions.js` — the question bank (186 Qs with explanations)
- `js/signs.js` — SVG road-sign library (31 signs)
- `js/core.js` — pure engine: scoring, readiness, adaptive selection, spaced scheduling, exam assembly/grading, hazard scoring, XP/levels, achievements, state migration, import/export
- `js/state-packs.js` — state-specific content packs (CA, TX, NY, FL, WA, PA)
- `js/app.js` — views and DOM wiring
- `serve.js` — tiny static server for local testing

## Development

No build step — the app is plain HTML/CSS/JS. Tooling is dev-only:

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
It also maintains **automated provenance**: `content-manifest.json` records a
content hash per question with source attribution — uncommitted bank drift
fails the build until you regenerate the manifest.

**E2E (`e2e/`, Playwright)** runs real journeys — onboarding, practice,
timed mock exam, flashcards, import/export round-trip, PWA offline reload,
accessibility checks — on desktop Chrome plus iPhone and Pixel profiles.

## PWA / offline

Installable (`manifest.webmanifest`) with a service worker (`sw.js`) that
pre-caches the full shell and serves stale-while-revalidate — the whole app
works offline after one visit. Progress lives in versioned localStorage
(`v2` schema) with a migration pipeline; Settings can export/import it as a
JSON backup.

## State packs

Settings → "Your state's rules" selects a jurisdiction (CA, TX, NY, FL, WA, PA).
Each non-generic pack ships its own jurisdiction-tagged questions
(`jurisdiction:["XX"]`, `concept`, `sourceId`, `sourceSection`) that merge into
practice and exams when the pack is selected, plus a key-facts card (BAC limits,
school-bus rules, phone laws…) at the top of the Study Guide. Universal
questions apply to every pack. Add a pack by appending an entry to
`js/state-packs.js` — the content QA system validates its questions, facts and
provenance fields.
