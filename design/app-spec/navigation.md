# Navigation & state

## Top-level app state
One root switch across 5 views: landing | teacher | student | mobile | panel.
In the mockup this is a demo tab row; in the real app it's role-based routing
(landing = public, teacher/student = authenticated roles) — mobile and panel
are not separate roles, they're viewport/redesign references and should not
become real routes.

## Teacher panel — sub-navigation (sidebar, one active item at a time)
1. Panel nauczyciela (dashboard) — t-dash
2. Kursanci (student roster) — t-students
3. Profil kursanta (student profile) — t-profile — reached also by
   selecting a student from the roster
4. AI Lesson Generator — t-lesson
5. Generator ćwiczeń — t-exercise
6. Statystyki — t-stats
7. Historia lekcji — t-history
8. Testy — t-tests
9. Słownictwo — t-vocab
10. Ustawienia — t-settings

Dashboard tiles are shortcuts into the other sections (clicking a tile sets
the active section). No breadcrumb; header title/subtitle updates from a
per-section metadata lookup.

## Student panel — sub-navigation (linear flow, not a persistent menu)
1. Dashboard — s-dash (entry point)
2. Puzzle — s-puzzle
3. Challenge — s-challenge
4. Flashcards — s-flash
5. Matching — s-match
6. Result — s-result

Each exercise mode has its own "back to dashboard" action; there's no
forward/back history stack in the mockup — every screen can return to
s-dash directly. A real app likely wants each mode to end at Result,
then Result returns to Dashboard.

## Transitions
No page-level transition animation between sub-views (instant swap). The
landing page has scroll-triggered entrance animations (fade/rise, GSAP
ScrollTrigger) — those stay specific to the landing page's marketing
sections and don't need to be replicated inside the app shell.
