# SoberPal system architecture

Student build for COMP4045 / COMP3075 / ITEC3017.
Product: a companion drinking-safety app, not a per-cup laboratory.

**Constraint this architecture is built around:** while drinking cup by cup, people will not use the app often. Safety cannot depend on frequent logging.

Companion skill for coding agents: `soberpal-app-builder/`.

## Goal

```
Must work if opened twice:
  1. Before going out → set Guardian + I'm-home time
  2. After → tap I'm home
                    OR Guardian is notified of a missed check-in
```

Drink taps, water nudges, and Focus Check are optional extras.

## High-level

```
Demo (two computers, browsers)
  Drinker browser
    SparseLog          ← best-effort, undoable, stays in this browser
    FocusCheck         ← pause only, never a danger input
    SessionWatch       ← in-page timers for the demo
           |
           | session create, I'm home, missed
           v
Thin API + watchdog cron
           |
           | shared status
           v
  Guardian browser (magic link on the second computer)
    status, last ping, Call

Later — Android and iOS
  Flutter or React Native
    SQLite SparseLog, FCM/APNs, on-device notifications
```

## Why not a "monitor every cup" pipeline

| Approach | Works when drunk and busy? | Use in v1 |
|---|---|---|
| Per-cup photo + cloud AI | No | No |
| Per-cup ABV keypad | No | No |
| One-tap +Drink / +2 batch | Sometimes | Yes, optional |
| Lock-screen / widget +1 | Better | Yes, in the later mobile stage |
| Push "time for water?" | System initiates | Yes, capped |
| Missed I'm-home timer | Works with zero drink logs | **Required** |

## Runtime agents

**SessionWatch** (product agent, on device): simple rules, no LLM during the party.

- Water nudge at most once per 45 minutes.
- "Heading home?" once at T−10 minutes.
- After `check_in_at + grace` → notify Guardian once, then at most every 20 minutes.
- Ignores Focus Check results and drink totals.

**PlanAssist** (optional, before going out): static or small-model content for drug–alcohol warnings and refusal scripts. Not used mid-party.

**Watchdog** (server): if the drinker's browser was closed — or, in the later mobile stage, the phone process died — and the session is past grace with no home event, still mark the session missed so the Guardian page can show it.

## Safety vs log

```
Guardian alert  :=  session.active AND now > check_in_at + grace
                    AND NOT home
```

```
logged_at_least := sum(drink events)
```

These formulas do not mix.

## Privacy

- Location only inside an accepted Tonight session.
- Default share is last ping on miss, not a full trail.
- Drink list stays in the drinker's browser for the web demo, and on device in the later mobile apps, unless the drinker opts into sync.
- Guardian does not see the drink diary by default.
- Session artefacts deleted after a short retention (e.g. 7 days).

## Screens mapped to modules

1. **Plan tonight** — session create, Guardian invite, meds ack, primary drink type, check-in clock.
2. **Tonight** — three actions: + Drink, Focus Check, I'm home.
3. **Guardian mode** — looking after X, missed banner, Call.

## Suggested student stack

**Now — two-computer web demo.** Vite + React + TypeScript. Drinker and Guardian each use a browser. The thin API holds the Tonight session; the Guardian joins by magic link. SparseLog stays in the drinker's browser. A watchdog cron marks a missed check-in if that browser was closed. Both pages show status in the demo.

**Later — Android and iOS.** Flutter or React Native. Start only after the web demo works. SQLite for SparseLog; Firebase/APNs for Guardian push; on-device notifications for water nudges; then lock-screen actions, widgets, and Watch complications.

## Explicit non-goals for v1

Cloud cup recognition, eBAC as a leave/drive gate, gating I'm home on a mini-game, always-on family tracking, public drink leaderboards.
