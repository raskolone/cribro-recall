# Cribro English — App Spec for Claude Code

This package describes what the mockup (`Cribro English - Mockup.dc.html`) looks
like and how it behaves, so Claude Code can rebuild the real app's screens to match
it — layout, navigation, states, copy, data shapes. It does NOT include the visual
theme (colors/type/spacing) — that's the separate `theme-handoff/` package
(Nocturne Green), which this app already uses and should keep using.

## Files
- `screens.md` — every screen, its layout, and what's on it
- `navigation.md` — how the app is structured: routes, nav state, transitions
- `data-shapes.md` — the data each screen needs, inferred from the mockup
- `CLAUDE-CODE-PROMPT.md` — paste this into Claude Code to start the rebuild

## How the two packages relate

design/
├─ theme/        (Nocturne Green — colors, type, components — product-agnostic)
└─ app-spec/     (this package — Cribro English screens & behavior — specific to this app)

Theme = the "how it looks" vocabulary, shared across all your apps.
App spec = the "what exists and does what" content, specific to Cribro English.
