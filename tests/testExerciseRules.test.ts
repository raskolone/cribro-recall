import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FIELD_LANGUAGES,
  TYPE_RULES,
  detectLanguage,
  rulesForTypes,
  validateExerciseLanguage,
  validateTestLanguage,
} from '../utils/testExerciseRules';

/**
 * Testy odtwarzają realną awarię: generator produkował ćwiczenia po polsku
 * w aplikacji do nauki angielskiego. Treści poniżej to dosłowne cytaty
 * z wygenerowanego testu, który to ujawnił.
 */

// --- wykrywanie języka -------------------------------------------------------

test('rozpoznaje polski po słowach funkcyjnych, nawet bez ogonków', () => {
  // Zdanie z realnego testu. Ani jednego ogonka, a bezdyskusyjnie polskie.
  assert.equal(detectLanguage('Monika pracuje w HR i czesto korzysta z roznych aplikacji'), 'pl');
});

test('rozpoznaje polski po diakrytyce', () => {
  assert.equal(detectLanguage('Kiedy Monika napotyka ___, zawsze szuka źródeł informacji.'), 'pl');
});

test('rozpoznaje angielski', () => {
  assert.equal(detectLanguage('Last summer Anna ___ (go) to Italy with her friends.'), 'en');
  assert.equal(detectLanguage('She has been working here for three years.'), 'en');
});

test('za krótki fragment nie jest oskarżany o żaden język', () => {
  // Pojedyncze słowo nie niesie sygnału — lepiej przepuścić niż fałszywie oskarżyć.
  assert.equal(detectLanguage('commute'), null);
  assert.equal(detectLanguage(''), null);
  assert.equal(detectLanguage('___'), null);
});

// --- realna awaria z produkcji ----------------------------------------------

test('AWARIA: tekst z lukami po polsku jest wyłapany', () => {
  const problems = validateExerciseLanguage({
    type: 'fill_in_blank',
    instruction: 'Uzupełnij poniższy tekst odpowiednimi słowami:',
    prompt:
      'Monika pracuje w HR i często korzysta z różnych aplikacji, aby ___ (1) czas przed ekranem. ' +
      'Czasami ___ (2) poczucie czasu, gdy zbyt długo przegląda internet.',
    correctAnswer: '1. kontrolować\n2. traci\n3. mieć',
  });

  assert.ok(problems.length >= 1, 'polski tekst z lukami miał zostać wyłapany');
  assert.ok(problems.some((p) => p.field === 'prompt' && p.found === 'pl'));
});

test('AWARIA: polski bank słów jest wyłapany', () => {
  const problems = validateExerciseLanguage({
    type: 'fill_in_blank_bank',
    instruction: 'Uzupełnij poniższy tekst używając słów z banku:',
    prompt: 'Kiedy Monika napotyka ___ (1), zawsze szuka ___ (2) źródeł informacji.',
    wordBank: ['kroki', 'wiarygodne', 'problem', 'rozwiązanie', 'rozpraszać'],
    correctAnswer: '1. problem\n2. wiarygodne',
  });

  assert.ok(problems.some((p) => p.field === 'prompt'), 'polski tekst miał zostać wyłapany');
});

// --- poprawne zadania przechodzą --------------------------------------------

test('poprawne ćwiczenie gramatyczne po angielsku przechodzi', () => {
  const problems = validateExerciseLanguage({
    type: 'fill_in_blank',
    instruction: 'Uzupełnij tekst poprawnymi formami czasowników:',
    prompt:
      'Last summer Anna ___ (go) to Italy with her friends. They ___ (stay) in a small hotel ' +
      'near the beach and ___ (spend) every morning swimming in the sea.',
    correctAnswer: '1. went\n2. stayed\n3. spent',
  });

  assert.deepEqual(problems, []);
});

test('tłumaczenie ma polski prompt i angielską odpowiedź — i tak ma być', () => {
  const problems = validateExerciseLanguage({
    type: 'translation',
    instruction: 'Przetłumacz poniższe zdania na język angielski:',
    prompt: '1. Kiedyś dojeżdżałem do pracy rowerem. (used to)\n2. Ona pracuje tu od trzech lat.',
    correctAnswer: '1. I used to commute to work by bike.\n2. She has been working here for three years.',
  });

  assert.deepEqual(problems, [], 'polski w prompcie tłumaczenia jest poprawny');
});

test('odwrotność też jest błędem: angielski tam, gdzie ma być polski', () => {
  const problems = validateExerciseLanguage({
    type: 'translation',
    prompt: '1. I used to commute to work by bike every single morning.',
    correctAnswer: '1. I used to commute to work by bike every single morning.',
  });

  assert.ok(problems.some((p) => p.field === 'prompt' && p.found === 'en'));
});

test('bank słów po angielsku przechodzi', () => {
  const problems = validateExerciseLanguage({
    type: 'fill_in_blank_bank',
    prompt: 'When Anna faces a ___ at work, she always looks for reliable sources of information.',
    wordBank: ['reliable', 'problem', 'solution', 'steps', 'distract'],
    correctAnswer: '1. problem\n2. reliable',
  });

  assert.deepEqual(problems, []);
});

test('matching dopuszcza oba języki, bo pary są dwujęzyczne z definicji', () => {
  const problems = validateExerciseLanguage({
    type: 'matching',
    prompt: 'Połącz słowa z tłumaczeniami',
    options: ['dojeżdżać = commute', 'termin = deadline', 'wiarygodny = reliable'],
    correctAnswer: 'dojeżdżać = commute',
  });

  assert.deepEqual(problems, []);
});

// --- cały test ---------------------------------------------------------------

test('walidacja całego testu zbiera problemy ze wszystkich zadań', () => {
  const problems = validateTestLanguage([
    { type: 'translation', prompt: '1. Kiedyś dojeżdżałem rowerem.', correctAnswer: '1. I used to commute.' },
    { type: 'fill_in_blank', prompt: 'Monika pracuje w HR i często korzysta z aplikacji ___.', correctAnswer: '1. codziennie' },
    { type: 'fill_in_blank_bank', prompt: 'Kiedy Monika napotyka ___ zawsze szuka rozwiązania.', wordBank: ['problem'] },
  ]);

  assert.ok(problems.length >= 2, 'dwa złe zadania miały zostać wyłapane');
  assert.ok(!problems.some((p) => p.type === 'translation'), 'poprawne tłumaczenie nie może być zgłoszone');
});

test('nieznany typ zadania nie wywraca walidacji', () => {
  assert.deepEqual(validateExerciseLanguage({ type: 'cokolwiek', prompt: 'x' }), []);
  assert.deepEqual(validateExerciseLanguage(null), []);
  assert.deepEqual(validateTestLanguage([]), []);
});

// --- reguły promptu ----------------------------------------------------------

test('każdy typ zadania ma regułę i deklarację języka', () => {
  for (const type of Object.keys(FIELD_LANGUAGES)) {
    assert.ok(TYPE_RULES[type as keyof typeof TYPE_RULES], `brak reguły dla typu ${type}`);
  }
});

test('reguła każdego typu nazywa język wprost — to była przyczyna awarii', () => {
  // find_mistake działał, bo mówił „w języku angielskim". Pozostałe milczały.
  for (const [type, rule] of Object.entries(TYPE_RULES)) {
    assert.match(
      rule,
      /ANGIELSK|POLSK|angielsk|polsk/,
      `reguła typu ${type} nie mówi, w jakim języku ma być treść`
    );
  }
});

test('reguły składają się tylko z typów wybranych przez lektora', () => {
  const rules = rulesForTypes(['translation', 'fill_in_blank']);
  assert.ok(rules.includes('translation'));
  assert.ok(rules.includes('fill_in_blank'));
  assert.ok(!rules.includes('find_mistake'));
});
