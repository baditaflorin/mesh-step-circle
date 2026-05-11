---
status: accepted
date: 2026-05-12
---

# 0003 — Why signed-by-name here (vs anonymous in mesh-mood-check)

## Context

Two of my mesh apps publish per-peer state that could in principle be anonymized or attributed. `mesh-mood-check` (a mood barometer in a meeting) publishes anonymous bucket counts because the social contract there is "I want to share my mood without it being attributed to me." `mesh-step-circle` is the opposite case.

## Decision

`mesh-step-circle` publishes a per-walker `{name, steps, lastStepAt, cadenceSpm}` entry in a `Y.Map`. The leaderboard is visible, sorted by step count, signed by user-chosen name.

## Consequences

- Walking together explicitly invites comparison and gentle competition. Hiding who's at 3,000 vs. 5,000 steps defeats the point of the room. The group walks; the group wants to see how it's doing per body.
- Names are user-editable in Settings. Anyone uncomfortable can switch to a playful nickname ("Sloth"), a single emoji, or an empty string. The peer identity used as the Yjs map key is a `crypto.randomUUID()` persisted to localStorage, separate from the display name, so changing your name doesn't lose your step count or create a duplicate entry.
- We contrast with [`mesh-mood-check`'s ADR 0003](https://github.com/baditaflorin/mesh-mood-check/blob/main/docs/adr/0003-anonymous-aggregation.md): mood disclosure benefits from anonymity because the negative externality of "Alex feels sad" being attributable to Alex is real. Step disclosure has no analogous risk — being seen as the slow walker by the friends you're literally walking with is part of the social fabric.

## Alternatives considered

- **Anonymous aggregate only.** Rejected — defeats the "see who's contributing" goal.
- **Opt-in attribution.** Considered. The "edit your name" Settings flow gives near-equivalent flexibility (set yourself to "Walker" if you want to opt out of attribution) without adding a second toggle. We kept the simpler model.
- **Stable identity tied to device.** Rejected — peer UUID is per-installation, so wiping localStorage gives you a clean slate. Tying it to a hardware fingerprint would be more privacy-hostile than the problem warrants.
