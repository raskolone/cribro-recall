# Data shapes

Inferred from the mockup's placeholder arrays. Field names are mine, adjust
to match your actual backend/API — this documents shape, not schema.

## Student
- initials: string (avatar fallback, e.g. "AK")
- name: string
- level: 'A1'|'A2'|'B1'|'B2'|'C1'|'C2'
- lessonsCount: number
- wordsCount: number
- lastActive: string (relative, e.g. "dziś 18:40" / "wczoraj")

## Lesson
- number: string ("24")
- date: string ("12.08")
- topic: string
- summary: string (1-2 sentences)
- wordsGenerated: number
- homeworkStatus: string ("Praca domowa wysłana" | "oddana" | ...)

## ExerciseSentence
- index: string ("01")
- pl: string (source sentence)
- en: string (target translation)

## Test
- name: string
- date: string
- score: string ("17/20" or "—" if not yet scored)
- status: 'ok' | 'wait' | 'low' (checked / awaiting / needs review)

## VocabSet
- name: string
- sourceLesson: string ("Lekcja 24")
- wordCount: number
- masteryPct: string ("64%")

## ActivityDay
- date: string (day-of-month label)
- count: number (sentences/reviews done that day, 0 = inactive)

## DashboardTile
- icon: string (phosphor icon name)
- tag: string (small category label)
- title: string
- description: string
- targetSection: string (which sidebar section it links to)

## Section metadata (teacher)
A lookup of { title, subtitle } keyed by section id — drives the content
header. Ten entries, one per sidebar item (see navigation.md for the ids).

## Derived UI values (compute in the frontend, don't fetch)
- Bar chart bar height % = value / max(all values in range)
- Bar highlight color = accent for the max bar, dim accent for others,
  faint line for zero-days
- Status pill bg/border/text = one of 3 fixed triplets keyed by status
