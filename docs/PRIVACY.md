# Privacy

*What Road Ready stores, what it sends, and what it cannot tell you. This file
is a claim about the code in this repository, and the checks under "How to
verify this" exist so the claim can be re-tested rather than trusted.*

## Summary

Road Ready has no analytics, no telemetry, no advertising or tracking
identifiers, no third-party fonts or CDNs, and no account requirement. Study in
a normal private window and nothing about you leaves the device.

| Question | Answer |
|---|---|
| Is an account required? | No. Every feature works without one. |
| Where is study data stored? | This browser's `localStorage`, under the single key `roadready.v1`. |
| Does anything leave the device by itself? | No. No request is made at startup or during study. |
| Does anything leave the device if I sign in? | Only what you explicitly press **Save** to upload — and only on deployments that configure accounts. |
| Can I get my data out? | Yes — **Export** writes a plain JSON file you can re-import anywhere. |
| Can I delete it? | Yes — one button, with the full scope listed before it runs. |

## What is stored on this device

One key: `roadready.v1`. There is no cookie and no IndexedDB store.

Everything is in that one record, which means deletion is complete by
construction: erasing resets the whole state object, so there is no second
location a field could quietly survive in.

| Category | Examples |
|---|---|
| Mastery evidence | per question: attempts, correct/wrong, first and last seen, **when it was last answered correctly**, answer-fluency flags, spaced-review schedule |
| Exam history | dates, scores, pass/fail, durations, which questions were in each exam |
| Study activity | day streak, per-day answer counts, total study time, XP, achievement unlock times |
| Preferences | selected jurisdiction, pass mark, exam length, feedback on/off, read-aloud on/off, theme |
| Your test date | used only on-device to size the daily plan |
| Flagged questions | which questions you flagged |
| Snoozed weaknesses | Weakness-Centre items you marked for later, with when you snoozed them (auto-cleared when repaired or after 30 days) |
| Sign flashcards | known / still-learning per sign |
| Hazard best score | from the hazard-perception trainer |
| Outcome journal | real test results you chose to log, and pre-test snapshots taken before them |
| Drive Log | supervised sessions: duration, conditions, road types, per-skill ratings, **instructor notes** |
| Research study | participation id, confidence survey answers, retention log |

`service-worker` Cache Storage holds only app code and content — the same bytes
the server shipped. It never contains user data. The service worker is
explicitly configured to send `/api/*` requests straight to the network and to
refuse to cache them, so a signed-in backup can never be left in Cache Storage
for a later user of the same browser to read.

## What leaves the device

**Nothing, unless you make it happen.**

There is no request at startup: the app renders fully from cache with no network
access. The optional account feature is the only part that talks to a server,
and it is not contacted until you open Settings — where its panel lives — for
the first time in a session.

On deployments with **no accounts configured** (including opening `index.html`
straight from disk, as the README describes):

- the account panel never renders,
- no API request is ever made,
- the app functions fully offline.

On deployments **with** accounts configured, `/api/` requests are made only in
response to you pressing a button:

| Action | Request | Data sent |
|---|---|---|
| Opening Settings | `GET /api/auth/session` | nothing beyond what any page load carries (your IP, your user-agent) |
| Signing in | navigation to `/api/auth/google` | handled by Google's consent screen; Road Ready never sees your password |
| Pressing **Save** | `POST /api/sync` | the same JSON bundle **Export** writes — practice and exam history, outcomes, Drive Log sessions and notes — plus the email and profile name Google returns to the server |
| Pressing **Restore** | `GET /api/sync` | nothing; the body comes back |
| **Delete copy** | `DELETE /api/sync` | nothing |
| **Delete account** | `DELETE /api/account` | nothing |

Note what sign-in does **not** do: it does not enable background sync, does not
upload automatically, and does not turn local-only storage into storage
somewhere else. Upload is a button you press.

**Third-party links are navigations you make.** Explanations and the study guide
link out to DMV and gov.uk source pages. Those are ordinary links to public
government sites — Road Ready does not embed those pages, load their scripts,
or receive anything from you visiting them. No URL is loaded before you ask.

## Google Fonts, analytics and other common leaks

Deliberately absent, and checkable in the source:

- no Google Fonts / font CDN: theming is local CSS
- no analytics or tag-manager script of any kind
- no `/api` call at boot
- no `preconnect` or `dns-prefetch` to any third-party host in
  `index.html`. Preconnecting is a request-adjacent signal — it tells a host
  you are arriving *before* you have chosen to go there — so even the optional
  Google sign-in host is not preconnected until sign-in is genuinely offered.
- no error-reporting service

## Deleting

**Settings Ôå Delete your data on this device.** Two paths:

- **Export, then erase** — writes the JSON backup first and only proceeds if the
  file was built successfully, so a failed export can never leave you with
  neither your data nor a copy.
- **Erase all progress** — the confirmation enumerates every category that
  goes, including Drive Log sessions and instructor notes, before you press
  confirm.

Erasing keeps your selected jurisdiction and theme so the app still opens
correctly; everything else is dropped.

Deleting the **account** is separate and lives in the account panel, because
they are different things:

- erase removes this device's history,
- delete-account removes the server-side copy and the account itself, leaving
  this device's progress untouched,
- **signing out does neither.** It ends the session. This is stated in the
  settings text on purpose, because expecting sign-out to be a delete button is
  the common version of this mistake.

## What Road Ready cannot promise

- **A browser you share is a browser that shares your progress.** Data lives in
  `localStorage`, so anyone with access to that browser profile can read it.
  Export and erase are the tools for that situation.
- **Clearing site data deletes it.** Browser "clear browsing data" removes
  `localStorage` and Cache Storage with no confirmation from us. There is no
  backup of your own, so export before you clear.
- **Sync stores a copy on someone else's computer.** If you press **Save**, the
  backup lives on the deployment's server and in its Postgres database. That is
  the entire point of the feature, and the reason it is off by default and
  manual when on.
- **A private window keeps nothing.** Study in private mode is private, and the
  data is gone when the window closes.
- **We cannot recover erased data.** There is no backup taken on your behalf.

The verification dates in `js/state-packs.js` are a **content** freshness
contract, not a privacy one: they force a reviewer to re-check the rules a
question cites within 365 days. They are unrelated to anything described above.

## How to verify this

```bash
# every claim above corresponds to something greppable
grep -rn "localStorage" js/            # storage: one key, in app.js only
grep -rn "fetch(" js/                  # network: only js/account.js, only /api/*
grep -rn "analytics\|gtag\|sentry\|datadog" js/ index.html   # expect: nothing
grep -rn "preconnect\|dns-prefetch" index.html                # expect: nothing
```

Settings is the only screen that can make a request; study cannot. The
content-inventory generator is reproducible, so nothing in this document relies
on a number you have to take on trust:

```bash
node scripts/content-coverage.mjs --write
node scripts/validate-content.mjs --strict
```

## Changes to this policy

This file describes the current code. If a change adds a network call, a storage
key, or a third-party host, it belongs here in the same commit, because the
value of this document is that it was true when written.
