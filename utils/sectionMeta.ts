/**
 * Tytuł i podtytuł na sekcję — tabela z design/app-spec/navigation.md
 * („header title/subtitle updates from a per-section metadata lookup").
 *
 * Klucze to identyfikatory widoków, których aplikacja faktycznie używa
 * (typ View w components/dashboard/Dashboard.tsx), a nie identyfikatory
 * z makiety (t-dash, t-students…) — makieta opisuje te same sekcje pod
 * innymi nazwami.
 */

export type SectionId =
  | 'dashboard' | 'practice' | 'settings'
  | 'flashcard-sets' | 'flashcard-edit' | 'flashcard-study' | 'flashcard-stats'
  | 'admin' | 'admin-stats' | 'admin-history' | 'admin-profile' | 'admin-tests'
  | 'admin-debugging' | 'presentation' | 'ai-generator' | 'lesson-history'
  | 'tests' | 'topic-database' | 'student-stats' | 'homework';

export interface SectionCopy {
  title: string;
  subtitle: string;
}

type Lang = 'pl' | 'en';

const META: Record<SectionId, Record<Lang, SectionCopy>> = {
  'dashboard': {
    pl: { title: 'Pulpit', subtitle: 'Twoje słownictwo na dziś i to, co czeka na powtórkę.' },
    en: { title: 'Dashboard', subtitle: "Today's vocabulary and what is due for review." },
  },
  'practice': {
    pl: { title: 'Ćwiczenia', subtitle: 'Fiszki, dopasowywanie, luki i quizy na jednym zestawie.' },
    en: { title: 'Practice', subtitle: 'Flashcards, matching, gap-fill and quizzes over one set.' },
  },
  'settings': {
    pl: { title: 'Ustawienia', subtitle: 'Konto, język interfejsu i sposób prowadzenia sesji.' },
    en: { title: 'Settings', subtitle: 'Account, interface language and how sessions run.' },
  },
  'flashcard-sets': {
    pl: { title: 'Słownictwo', subtitle: 'Zestawy słów z lekcji wraz z poziomem opanowania.' },
    en: { title: 'Vocabulary', subtitle: 'Word sets by source lesson, with mastery level.' },
  },
  'flashcard-edit': {
    pl: { title: 'Edycja zestawu', subtitle: 'Popraw hasła, tłumaczenia i przykłady użycia.' },
    en: { title: 'Edit set', subtitle: 'Adjust terms, translations and usage examples.' },
  },
  'flashcard-study': {
    pl: { title: 'Nauka', subtitle: 'Powtórka rozłożona w czasie — słowa wracają, zanim je zapomnisz.' },
    en: { title: 'Study', subtitle: 'Spaced repetition — words return before you forget them.' },
  },
  'flashcard-stats': {
    pl: { title: 'Statystyki zestawu', subtitle: 'Skuteczność i tempo nauki w tym zestawie.' },
    en: { title: 'Set statistics', subtitle: 'Accuracy and pace within this set.' },
  },
  'admin': {
    pl: { title: 'Panel nauczyciela', subtitle: 'Skróty do sekcji, z których korzystasz najczęściej.' },
    en: { title: 'Teacher panel', subtitle: 'Shortcuts into the sections you use most.' },
  },
  'admin-stats': {
    pl: { title: 'Statystyki', subtitle: 'Aktywność kursantów w ostatnich dniach i wyniki zbiorcze.' },
    en: { title: 'Statistics', subtitle: 'Student activity over recent days and aggregate results.' },
  },
  'admin-history': {
    pl: { title: 'Historia lekcji', subtitle: 'Przebyte lekcje: temat, podsumowanie i status pracy domowej.' },
    en: { title: 'Lesson history', subtitle: 'Past lessons: topic, summary and homework status.' },
  },
  'admin-profile': {
    pl: { title: 'Profil kursanta', subtitle: 'Poziom, cele i notatki, którymi karmimy AI.' },
    en: { title: 'Student profile', subtitle: 'Level, goals and the notes that guide the AI.' },
  },
  'admin-tests': {
    pl: { title: 'Testy', subtitle: 'Sprawdziany kursantów wraz ze statusem i wynikiem.' },
    en: { title: 'Tests', subtitle: 'Student tests with their status and score.' },
  },
  'admin-debugging': {
    pl: { title: 'Diagnostyka', subtitle: 'Zgłoszenia błędów i podgląd zachowania aplikacji.' },
    en: { title: 'Diagnostics', subtitle: 'Bug reports and a view into how the app behaves.' },
  },
  'presentation': {
    pl: { title: 'Prezentacja', subtitle: 'Zestaw na pełnym ekranie — do prowadzenia zajęć.' },
    en: { title: 'Presentation', subtitle: 'The set full-screen, for running a lesson.' },
  },
  'ai-generator': {
    pl: { title: 'Generator ćwiczeń', subtitle: 'Pary zdań PL→EN budowane z materiału lekcji.' },
    en: { title: 'Exercise generator', subtitle: 'PL→EN sentence pairs built from lesson material.' },
  },
  'lesson-history': {
    pl: { title: 'Historia i postępy', subtitle: 'Przeglądaj historię lekcji i sesji ćwiczeniowych.' },
    en: { title: 'History & progress', subtitle: 'Review lesson and practice session history.' },
  },
  'tests': {
    pl: { title: 'Testy', subtitle: 'Sprawdziany przydzielone przez lektora.' },
    en: { title: 'Tests', subtitle: 'Tests assigned by your tutor.' },
  },
  'topic-database': {
    pl: { title: 'Baza tematów', subtitle: 'Materiał źródłowy, z którego powstają zestawy i ćwiczenia.' },
    en: { title: 'Topic database', subtitle: 'The source material behind sets and exercises.' },
  },
  'student-stats': {
    pl: { title: 'Statystyki i podsumowanie pracy', subtitle: 'Wyniki wszystkich ćwiczeń i podsumowanie przygotowane przez AI.' },
    en: { title: 'Statistics & work summary', subtitle: 'All exercise results and an AI-written summary of your work.' },
  },
  'homework': {
    pl: { title: 'Prace domowe', subtitle: 'Zadania od lektora wraz z terminem i statusem.' },
    en: { title: 'Homework', subtitle: 'Tasks from your tutor, with deadline and status.' },
  },
};

/** Zwraca tytuł i podtytuł sekcji; nieznany identyfikator daje undefined. */
export function sectionMeta(id: string, language: string): SectionCopy | undefined {
  const entry = META[id as SectionId];
  if (!entry) return undefined;
  return entry[language === 'en' ? 'en' : 'pl'];
}
