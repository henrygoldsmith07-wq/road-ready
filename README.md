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
- `js/app.js` — quiz/exam/flashcard/stats engine
- `serve.js` — tiny static server for local testing
