/**
 * Reguły zdań w ćwiczeniach — jedno źródło dla promptów generatora.
 *
 * Silnik prac domowych v2 (`functions/`) jest osobnym pakietem i nie może
 * importować z katalogu głównego, więc trzyma lustrzaną kopię w
 * `functions/src/homeworkV2/coreKnowledge.ts`. Zgodność obu kopii pilnuje
 * `tests/cribroSentenceRules.test.ts` — zmieniasz tu, zmieniasz tam.
 */

import { FIX_SENTENCE_ERROR_TYPES, FixSentenceErrorType } from '../utils/exerciseSentenceChecks';

/** Opis typów błędu dla modelu — z przykładem, bo sama nazwa bywa dwuznaczna. */
export const FIX_SENTENCE_ERROR_TYPE_GUIDE: Readonly<Record<FixSentenceErrorType, string>> = {
  verb_tense: 'zły czas („I have seen him yesterday")',
  subject_verb_agreement: 'brak zgody podmiotu z orzeczeniem („She work from home on Fridays")',
  auxiliary_verb: 'zły czasownik posiłkowy („She don\'t eat meat", „Did you went there?")',
  article: 'brak lub zły przedimek („I\'m teacher")',
  preposition: 'zły przyimek („It depends from the weather")',
  word_order: 'zły szyk („I like very much coffee")',
  word_form: 'zła forma słowa („It was a really interest meeting")',
  plural_or_countable: 'liczba mnoga / policzalność („Can you send me the informations?")',
  false_friend: 'fałszywy przyjaciel („Please control the report before you send it")',
  collocation: 'zła kolokacja („I did a mistake in the email")',
};

/**
 * Jak ułożyć zadanie „Popraw zdanie" (find_errors / fix_sentence).
 *
 * Kolejność kroków jest celowa: najpierw naturalne zdanie poprawne, potem
 * błąd dobrany DO niego. Odwrotnie model buduje zdanie wokół błędu, który
 * chce pokazać — i zdanie robi się sztuczne.
 */
export const FIX_SENTENCE_RULES = `ZASADY ZADANIA „POPRAW ZDANIE" — kolejność kroków jest obowiązkowa:
1. correct_sentence — najpierw ułóż naturalne, w pełni poprawne zdanie.
2. error_type — wybierz JEDEN typ błędu, który pasuje do tego zdania i który Polak na tym poziomie naprawdę popełnia:
${FIX_SENTENCE_ERROR_TYPES.map((type) => `   - ${type}: ${FIX_SENTENCE_ERROR_TYPE_GUIDE[type]}`).join('\n')}
3. error_sentence — przepisz correct_sentence, psując DOKŁADNIE JEDNO miejsce zgodnie z error_type. Reszta zdania zostaje słowo w słowo.

WARUNEK KONIECZNY: error_sentence musi zawierać prawdziwy błąd. Nie może być identyczne z correct_sentence ani różnić się od niego tylko interpunkcją, wielką literą albo innym, równie poprawnym sformułowaniem. Takie zadanie jest nierozwiązywalne i zostanie odrzucone.
Jeśli do zdania nie pasuje żaden naturalny błąd z listy — ułóż inne zdanie. Nie wymyślaj błędu na siłę.`;

/** Mocniejsza instrukcja do jedynej powtórki po odrzuceniu zadań bez błędu. */
export const buildFixSentenceRetryNote = (missing: number, rejectedErrorSentences: string[]): string => `
POPRZEDNIA PRÓBA ZAWIODŁA. ${
  rejectedErrorSentences.length > 0
    ? `Te „zdania z błędem" nie miały żadnego błędu albo nie miały poprawnego error_type:\n${rejectedErrorSentences.map((s) => `- ${s}`).join('\n')}\n`
    : ''
}Ułóż ${missing} ${missing === 1 ? 'NOWE zadanie' : 'NOWYCH zadań'} (inne zdania niż powyżej).
Przed zwróceniem KAŻDEGO zadania porównaj error_sentence z correct_sentence słowo po słowie.
Muszą różnić się dokładnie jednym miejscem — tym, które opisuje error_type. Jeśli są takie same, zadanie jest bezwartościowe.`;
