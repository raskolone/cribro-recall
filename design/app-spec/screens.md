# Screens

The mockup has three roles behind one shell: **Landing** (marketing/auth),
**Teacher panel**, **Student panel**. A **Mobile** view and **Panel v2** are
alternate takes on the student side, kept as references for responsive
behavior — they are not separate roles.

---

## 1. Landing page (public, unauthenticated)

Sticky header: logo (CRIBRO / ENGLISH lockup, 2-line), 4 nav links (Jak to
działa / Funkcje / Tryby / Cennik), a PL|EN language toggle, and a
"Wejdź do aplikacji" button. A 2px progress bar tracks scroll position at
the very top of the viewport.

Hero (2-column, content left / auth card right):
- Left: icon mark, "CRIBRO" / "ENGLISH" two-line display heading, a
  typewriter-animated tagline ("Your personal st...|"), a one-paragraph pitch,
  and a 2×2 grid of 4 feature cards (AI Generation, Smart Sync, Live Feedback,
  Lekcje 1:1 — icon + title + mono caption each).
- Right: a glass auth card — "Login with Google" button, an "or email /
  username" divider, an email/username sign-in button, a "Register here"
  link, and below a divider two demo buttons: **DEMO NAUCZYCIEL** (teacher)
  and **DEMO KURSANT** (student) — these are how the mockup's role switch
  works; a real app would gate these behind actual auth.

Below the hero: a stat band, then sections for "how it works," feature
detail, learning-mode showcase, and pricing (anchors match the nav: #jak,
#funkcje, #tryby, #cennik) — treat these as marketing content the copy
owner will fill in; the mockup's job here is the visual rhythm, not final copy.

## 2. Teacher panel

Persistent left sidebar nav, 10 sections (see navigation.md for the list),
with a header above the content area showing the active section's title +
one-line subtitle (from a per-section metadata table).

Sections:
- **Panel nauczyciela (dashboard)** — landing tile grid linking into the
  other sections (Profil kursanta, Statystyki, AI Lesson Generator,
  Generator ćwiczeń, etc.), each tile: icon, small tag, title, one-line desc.
- **Kursanci** — a roster: avatar initials, name, level (A1–C2), lesson
  count, word count, last-active timestamp. Selecting a student opens
  their profile.
- **Profil kursanta** — the student's data and the guidance fed to the AI
  (level, goals, notes).
- **AI Lesson Generator** — input (transcript or notes) → generated lesson
  entry (topic, summary, word count, homework status). One "generate" action
  (runGen) that increments a counter to re-trigger the demo output.
- **Generator ćwiczeń** — a numbered list of PL→EN sentence pairs generated
  from a lesson, for building translation exercises.
- **Statystyki** — a 14-day activity bar chart (per-day count, tallest bar
  highlighted) plus summary numbers.
- **Historia lekcji** — past lessons: number, date, topic, summary, word
  count, homework status.
- **Testy** — a list of tests/quizzes with a status pill: Sprawdzony
  (checked, green), Oczekuje (waiting, amber), Do omówienia (needs review,
  red) — and a score where applicable.
- **Słownictwo** — vocabulary sets by source lesson: name, count, mastery
  percentage.
- **Ustawienia** — teacher/account settings (not detailed in the mockup;
  placeholder section).

## 3. Student panel

Same shell pattern (sidebar or top nav → content), organized as one flow
rather than free sections:
- **Dashboard (s-dash)** — entry point: today's word set summary, a
  "start" call to action, recent activity.
- **Puzzle (s-puzzle)** — a sentence/word-order exercise, with a "back to
  dashboard" pill button.
- **Challenge (s-challenge)**, **Flashcards (s-flash)**, **Matching
  (s-match)** — three learning-mode variants, switched between via the same
  shell (functionally parallel: same data, different interaction).
- **Result (s-result)** — end-of-session summary/score.

## 4. Mobile view

A responsive take on the student flow at phone width — same screens,
stacked/condensed layout, larger touch targets.

## 5. Panel v2 (student settings + start, mobile-first reference)

The redesign target for the student "before you start a session" screen:
one scrollable-free view (fits 844px height) with, top to bottom:
a compact settings area (two rows of mode/difficulty options instead of
four large cards), a clean row-list of what's included in the session
(replacing 4 separate glowing cards), and a bottom-anchored start button
with a one-line summary of what's about to start. Selected options get a
stronger glow/outline; hover = slight lift + green outline, 0.2s ease.
Use this as the reference for how dense settings screens should compress
on mobile across the app.

---

## Cross-cutting UI patterns to preserve

- Role switcher: a small pill-tab row (Landing / Nauczyciel / Kursant /
  Mobile / Panel v2 in the mockup) — in the real app this maps to actual
  route/role, not a demo switch.
- Sidebar nav item: icon + label, active state = tinted accent background,
  accent border, accent text; inactive = muted gray text, transparent.
- Section header: display-serif title + one-line mono/gray subtitle,
  driven by the active section (a lookup table of title/subtitle per
  section — see data-shapes.md).
- Status pills reuse one pattern (colored bg/border/text triplet) across
  different meanings (test status, mastery, activity) — keep it one
  component with a status prop, not one-off styles per screen.
