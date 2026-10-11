/**
 * Zagadnienia gramatyczne pytań wielokrotnego wyboru — stała lista (enum).
 *
 * Model zwraca TYLKO identyfikator z tej listy (structured output). Etykieta dla kursanta
 * pochodzi z i18n (`grammarFocus.<id>` w pl.json / en.json), nigdy z modelu.
 */
export const GRAMMAR_FOCUS_IDS = [
  'tense',
  'article',
  'preposition',
  'collocation',
  'word_form',
  'word_order',
  'modal_verb',
  'conditional',
  'quantifier',
  'phrasal_verb',
] as const;

export type GrammarFocusId = (typeof GRAMMAR_FOCUS_IDS)[number];

export const isGrammarFocusId = (value: unknown): value is GrammarFocusId =>
  typeof value === 'string' && (GRAMMAR_FOCUS_IDS as readonly string[]).includes(value);

/** Klucz i18n etykiety zagadnienia. */
export const grammarFocusLabelKey = (id: GrammarFocusId): string => `grammarFocus.${id}`;
