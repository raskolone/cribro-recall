import test from 'node:test';
import assert from 'node:assert/strict';
import i18n from '../i18n';
import {
  MOTIVATION_EMPTY_KEY,
  buildMotivationItems,
  computeMotivationCounts,
  logItemCount,
  mergeMotivationCounts,
  nextIndex,
  pluralCategory,
  pluralKeyFor,
  startIndexForVisit,
} from '../utils/motivationStats';
import pl from '../pl.json';
import en from '../en.json';

const ex = (count: number) => buildMotivationItems({ exercises: count })[0];

test('odmiana polska przez Intl.PluralRules: 1, 2, 5, 12, 22, 25, 112', () => {
  const expected: Record<number, string> = { 1: 'one', 2: 'few', 5: 'many', 12: 'many', 22: 'few', 25: 'many', 112: 'many' };
  for (const [n, category] of Object.entries(expected)) {
    assert.equal(pluralCategory(Number(n), 'pl'), category, String(n));
    assert.equal(pluralKeyFor(ex(Number(n)), 'pl'), `motivation.exercises_${category}`);
  }
});

test('teksty polskie z i18n (klucze plural) — poprawna odmiana „ćwiczenie/ćwiczenia/ćwiczeń” i neutralność rodzajowa', async () => {
  await i18n.changeLanguage('pl');
  const say = (n: number, key = 'motivation.exercises') => i18n.t(key, { count: n }) as string;
  assert.equal(say(1), 'Masz już za sobą 1 ćwiczenie');
  assert.equal(say(2), 'Masz już za sobą 2 ćwiczenia');
  assert.equal(say(5), 'Masz już za sobą 5 ćwiczeń');
  assert.equal(say(12), 'Masz już za sobą 12 ćwiczeń');
  assert.equal(say(22), 'Masz już za sobą 22 ćwiczenia');
  assert.equal(say(23), 'Masz już za sobą 23 ćwiczenia');
  assert.equal(say(25), 'Masz już za sobą 25 ćwiczeń');
  assert.equal(say(112), 'Masz już za sobą 112 ćwiczeń');
  assert.equal(say(23, 'motivation.congrats'), 'Gratulacje! 23 ćwiczenia za Tobą');
  assert.equal(say(5, 'motivation.congrats'), 'Gratulacje! 5 ćwiczeń za Tobą');
  assert.equal(say(148, 'motivation.translated'), 'Przetłumaczone zdania: 148');
  assert.equal(say(37, 'motivation.corrected'), 'Poprawione zdania: 37');
  assert.equal(say(412, 'motivation.flashcards'), 'Powtórzone fiszki: 412');
  assert.equal(say(6, 'motivation.homework'), 'Ukończone prace domowe: 6');
  // brak form rodzajowych typu „wykonałeś/wykonałaś”
  assert.ok(!/(łeś|łaś|eś\/|aś\/)/.test(JSON.stringify((pl as any).motivation)));
});

test('teksty angielskie: liczba pojedyncza i mnoga', async () => {
  await i18n.changeLanguage('en');
  assert.equal(i18n.t('motivation.exercises', { count: 1 }), "You've completed 1 exercise");
  assert.equal(i18n.t('motivation.exercises', { count: 23 }), "You've completed 23 exercises");
  assert.equal(i18n.t('motivation.congrats', { count: 1 }), 'Congrats! 1 exercise done');
  assert.equal(i18n.t('motivation.translated', { count: 148 }), 'Translated sentences: 148');
  assert.equal(pluralCategory(1, 'en'), 'one');
  assert.equal(pluralCategory(2, 'en'), 'other');
  await i18n.changeLanguage('pl');
});

test('klucze pl i en mają te same statystyki (bez rozjazdu)', () => {
  const ids = ['exercises', 'congrats', 'translated', 'corrected', 'flashcards', 'homework', 'pairs', 'empty', 'next'];
  for (const id of ids) {
    const inPl = Object.keys((pl as any).motivation).some((k) => k === id || k.startsWith(`${id}_`));
    const inEn = Object.keys((en as any).motivation).some((k) => k === id || k.startsWith(`${id}_`));
    assert.ok(inPl && inEn, id);
  }
});

test('filtrowanie: pokazujemy tylko liczby >= 1; zera, ujemne, NaN i braki odpadają', () => {
  const items = buildMotivationItems({ exercises: 0, translatedSentences: 148, correctedSentences: -3, flashcards: Number.NaN, homework: 6, pairs: undefined });
  assert.deepEqual(items.map((i) => [i.id, i.count]), [['translated', 148], ['homework', 6]]);
  assert.deepEqual(buildMotivationItems({ flashcards: 2.9 }).map((i) => i.count), [2]);
});

test('kolejność stała: ćwiczenia → zdania → korekta → fiszki → prace → pary → gratulacje', () => {
  const items = buildMotivationItems({ exercises: 23, translatedSentences: 148, correctedSentences: 37, flashcards: 412, homework: 6, pairs: 30 });
  assert.deepEqual(items.map((i) => i.id), ['exercises', 'translated', 'corrected', 'flashcards', 'homework', 'pairs', 'congrats']);
  assert.ok(items.every((i) => i.i18nKey === `motivation.${i.id}`));
});

test('brak danych: pusta lista (komponent pokazuje jedną statyczną linię zachęty z i18n)', () => {
  assert.deepEqual(buildMotivationItems(null), []);
  assert.deepEqual(buildMotivationItems(undefined), []);
  assert.deepEqual(buildMotivationItems({}), []);
  assert.deepEqual(buildMotivationItems({ exercises: 0, flashcards: 0 }), []);
  assert.equal(MOTIVATION_EMPTY_KEY, 'motivation.empty');
  assert.ok(!/\d/.test((pl as any).motivation.empty) && !/\d/.test((en as any).motivation.empty), 'linia zachęty bez liczb');
});

test('żadnych streaków: ani w pozycjach, ani w kluczach i18n, ani w liczniku', () => {
  const items = buildMotivationItems({ exercises: 5, translatedSentences: 5, correctedSentences: 5, flashcards: 5, homework: 5, pairs: 5, streak: 99, streakCount: 99 } as any);
  assert.ok(!items.some((i) => /streak|passa|dni z rz/i.test(i.id + i.i18nKey)));
  const all = JSON.stringify((pl as any).motivation) + JSON.stringify((en as any).motivation);
  assert.ok(!/streak|passa|z rzędu|in a row/i.test(all));
});

test('rotacja: następny indeks zawija się; pusta lista → 0; reduced-motion = kolejna statystyka przy każdym wejściu', () => {
  assert.deepEqual([0, 1, 2, 3].map((i) => nextIndex(i, 3)), [1, 2, 0, 1]);
  assert.equal(nextIndex(4, 0), 0);
  assert.deepEqual([0, 1, 2, 3, 4].map((v) => startIndexForVisit(v, 3)), [0, 1, 2, 0, 1]);
  assert.equal(startIndexForVisit(7, 0), 0);
});

// --- liczniki z istniejących danych ------------------------------------------------------------

test('computeMotivationCounts: ćwiczenia = wpisy poza pracą domową i testem + sesje; zdania i korekta z wpisów; fiszki i pary z sesji', () => {
  const logs = [
    { exerciseType: 'ai_translation', totalWords: 5 },
    { exerciseType: 'ai_translation', totalWords: 3 },
    { exerciseType: 'sentence_correction', totalWords: 4 },
    { exerciseType: 'homework', totalWords: 8 },
    { exerciseType: 'test', totalWords: 10 },
    { exerciseType: 'Aktywność' },
    { exerciseType: 'recall' },
  ];
  const sessions = [
    { mode: 'flashcards', totalCards: 12 },
    { mode: 'quiz', totalCards: 10 },
    { mode: 'writing', totalCards: 5 },
    { mode: 'matching', totalCards: 5 },
    { mode: 'matching', totalCards: 4 },
    { mode: 'flashcards', totalCards: 0 },
  ];
  const counts = computeMotivationCounts({ logs, sessions, homeworkDone: 6 });
  assert.equal(counts.translatedSentences, 8);
  assert.equal(counts.correctedSentences, 4);
  assert.equal(counts.flashcards, 27, '12 + 10 + 5');
  assert.equal(counts.pairs, 9);
  assert.equal(counts.homework, 6);
  assert.equal(counts.exercises, 4 + 6, '4 wpisy ćwiczeń (3 + recall) + 6 sesji z trybem');
});

test('computeMotivationCounts: źródło niedostępne = licznik pominięty, nie zero i nie zaniżenie', () => {
  const counts = computeMotivationCounts({ logs: [{ exerciseType: 'ai_translation', totalWords: 2 }] });
  assert.equal(counts.exercises, undefined, 'bez sesji nie znamy pełnej liczby ćwiczeń');
  assert.equal(counts.flashcards, undefined);
  assert.equal(counts.homework, undefined);
  assert.deepEqual(buildMotivationItems(counts).map((i) => i.id), ['translated']);
});

test('logItemCount: totalWords, potem długość listy, potem 1; śmieci → 0', () => {
  assert.equal(logItemCount({ totalWords: 7 }), 7);
  assert.equal(logItemCount({ exercisesData: [1, 2, 3] }), 3);
  assert.equal(logItemCount({ detailedFeedback: [1] }), 1);
  assert.equal(logItemCount({}), 1);
  assert.equal(logItemCount({ totalWords: 'abc' }), 0);
  assert.equal(logItemCount({ totalWords: -4 }), 0);
});

test('mergeMotivationCounts: dla każdego pola większa wartość; brak w obu = brak', () => {
  assert.deepEqual(mergeMotivationCounts({ exercises: 5, homework: 2 }, { exercises: 9, flashcards: 3 }), { exercises: 9, homework: 2, flashcards: 3 });
  assert.deepEqual(mergeMotivationCounts(null, undefined), {});
});
