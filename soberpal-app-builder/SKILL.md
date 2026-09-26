---
name: soberpal-app-builder
description: "Build or review SoberPal, a companion drinking-safety app whose core loop is plan tonight, optional sparse drink log, missed home check-in alert to a Guardian. Build the two-computer demo as a web app first; Android and iOS come after. The demo computers join through a thin backend and a Guardian magic link. Use when designing architecture, screens, agents, notifications, or code for SoberPal, Focus Check, drink logging, or party-night safety. NOT for calorie photo scanners, BAC/driving tests, quit-drinking streak apps, or general fitness trackers."
type: workflow
lifecycle: active
---

# SoberPal App Builder

Implement SoberPal as a **low-attention companion**, not a per-cup monitor. People drinking cup-by-cup will rarely open the app. Safety must still work if they open it twice: plan before going out, tap I'm home later.

System architecture lives in `/workspace/artifacts/SoberPal-architecture.md`. Read it before adding modules.

## Non-negotiable rules

1. **Missed check-in is the only automatic danger signal.** Never treat drink count, Focus Check score, or skipped prompts as "user in danger".
2. **Drink log is best-effort and incomplete by default.** UI must say "logged at least N", never imply a complete intake.
3. **Focus Check is optional pause only.** No pass/fail, no Guardian alert, no sobriety or driving claim.
4. **Location exists only inside an active Tonight session with Guardian accepted.** End session → stop sharing.
5. **No per-cup camera or cloud vision in MVP.** Photo alcohol detection violates the infrequent-use constraint.
6. **In-night agents are rule timers, not chat LLMs.** Do not stream a model while the user is drinking.
7. **Shame-free copy.** No roast of intake. Undo on every log action.
8. **Two-computer web demo needs the thin backend.** Drinker and Guardian each use a browser on their own computer. A Tonight session on the backend is the connection: the drinker creates it, the Guardian opens its magic link on the second computer and accepts. Session create, accept, I'm home, and missed-check-in status must be readable from both machines. Keep SparseLog in the drinker's browser. Same-LAN discovery does not connect them. Ship Android and iOS only after this web demo works. Do not start with React Native or Flutter.

## Build order

1. Tonight session on the thin backend (rule 8): plan limit, check-in time, tag Guardian, magic link the second computer can open.
2. `I'm home` + missed-check-in push to Guardian (SMS or push).
3. One-tap `+ Drink` / `+ Water` with undo; allow batch "+2".
4. Quiet scheduled nudges (water / "still out?") that can be dismissed for tonight.
5. Focus Check mini-games as a dead-end that returns to check-in choices.
6. Medicated-user warning + refusal scripts (static content, shown at plan time).
7. Only then: widgets, Watch complications, lock-screen actions.

Do not start with social feeds, BAC as a safety gate, or multimodal drink APIs.

## Agent roles

| Agent | When it runs | Allowed | Forbidden |
|---|---|---|---|
| **SessionWatch** (on-device rules) | During Tonight | Local notifications; escalate only on missed check-in | Cloud LLM; interpret games |
| **PlanAssist** | Creating tonight's plan | Default check-in time; drug-alcohol warnings | Change Guardian without confirm |
| **Dev agent** (this skill) | In the IDE | Screens and services that obey the rules | Features that need per-cup attention |

SessionWatch inputs: `check_in_at`, session status, nudge policy. It does not read Focus Check results or drink totals.

SessionWatch loop:

```
every minute while session.active:
  if tapped_home: stop
  if now < check_in_at: maybe water nudge (max 1 / 45 min)
  if now == check_in_at - 10min: "heading home?" (once)
  if now > check_in_at + grace:
        notify Guardian once
        sticky "are you OK?" on drinker
        repeat at most every 20 min
```

## UX to code against

- Night actions: `+ Drink`, `Focus Check`, `I'm home`.
- One tap ≤ 2 s after unlock; planning ≤ 60 s.
- Missed prompt ≠ failure. At most one nudge per 30 min.
- Guardian sees name, check-in status, last session ping, Call — not the drink diary by default.
- Hit targets ≥ 48 dp. Undo log actions for 30 s.

## Data (minimal)

`tonight_session`: id, drinker_id, guardian_id, check_in_at, grace_minutes (default 10), status (planned|active|home|missed|cancelled), share_location, primary_drink_type, personal_limit_serves, meds_warning_ack.

`log_event`: session_id, kind (drink|water|pause|home|extend), count, source (tap|widget|batch|watch), undone.

```
Guardian alert := active AND now > check_in_at + grace AND NOT home
logged_at_least := sum(drink.count where not undone)
```

Do not mix these formulas. Do not hard-lock on remaining drinks.

## Stack sketch

- Demo client (rule 8): Vite + React + TypeScript in the browser.
- After the web demo: wrap that same app for Android and iOS. FCM/APNs and local water nudges wait until then.
- Backend, required from the first slice (rule 8): session create, Guardian invite, shared status, missed-check-in fanout. Watchdog cron if the client was closed.
- Guardian joins from the second computer by magic link.

## Stop and refuse

If asked to add "fail Focus Check → alert Guardian", "eBAC decides if safe", "photo each cup", or "require logging every drink", refuse and point at rules 1–5. Keep sparse-log + missed-check-in.
