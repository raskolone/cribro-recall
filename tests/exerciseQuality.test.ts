import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JudgeVerdict,
  QualityItem,
  buildJudgePrompt,
  checkItemLocally,
  checkSetLocally,
  parseJudgeVerdicts,
  runQualityGate,
} from '../utils/exerciseQuality';
import { checkWarmupExerciseItem } from '../utils/exerciseSentenceChecks';
import { EXERCISE_IRON_RULES } from '../utils/exerciseQualityRules';

const pair = (en: string, pl: string): QualityItem => ({ kind: 'pair', en, pl });

/** Złote przypadki. `local` = łapie je kontrola bez modelu; `judge` = tylko sędzia (sens, nie reguła). */
const BAD: Array<{ name: string; en: string; pl: string; caughtBy: 'local' | 'judge' }> = [
  { name: 'moje/your (objaw z produkcji)', en: 'My office is on your doorstep, which is great.', pl: 'Moje biuro jest bardzo blisko, co jest świetne.', caughtBy: 'local' },
  { name: 'hamak/meble (objaw z produkcji)', en: 'We bought new furniture for the living room.', pl: 'Kupiliśmy nowy hamak do ogrodu.', caughtBy: 'judge' },
  { name: 'kalka „co jest ważne”', en: 'The meeting is tomorrow, and it matters.', pl: 'Spotkanie jest jutro, co jest ważne.', caughtBy: 'local' },
  { name: 'twoja/my', en: 'My sister works at a bank.', pl: 'Twoja siostra pracuje w banku.', caughtBy: 'local' },
  { name: 'ona/he', en: 'He lives in Krakow.', pl: 'Ona mieszka w Krakowie.', caughtBy: 'local' },
  { name: 'nasz/their', en: 'Their house is big.', pl: 'Nasz dom jest duży.', caughtBy: 'local' },
  { name: 'robotyczne „which is great”', en: 'The weather is nice, which is great.', pl: 'Pogoda jest ładna i to świetnie.', caughtBy: 'local' },
  { name: 'kalka „mieć dobry czas”', en: 'I have a good time at work.', pl: 'Mam dobry czas w pracy.', caughtBy: 'local' },
  { name: 'czas przeszły/przyszły', en: 'I will go to the shop tomorrow.', pl: 'Wczoraj poszedłem do sklepu.', caughtBy: 'judge' },
  { name: 'kalka „zrobić decyzję”', en: 'I made a decision to move.', pl: 'Zrobiłem decyzję o przeprowadzce.', caughtBy: 'local' },
];

const GOOD: Array<[string, string]> = [
  ['My brother works at a bank.', 'Mój brat pracuje w banku.'],
  ["Let's meet tomorrow morning.", 'Spotkajmy się jutro rano.'],
  ['She always drinks coffee without sugar.', 'Ona zawsze pije kawę bez cukru.'],
  ['Our neighbour has two dogs.', 'Nasz sąsiad ma dwa psy.'],
  ["My office is really close, and that's great.", 'Moje biuro jest bardzo blisko, i to świetnie.'],
  ['I forgot to take an umbrella.', 'Zapomniałem wziąć parasol.'],
  ['They come home on Friday.', 'Oni wracają do domu w piątek.'],
  ['Can you help me with this report?', 'Czy możesz mi pomóc z tym raportem?'],
  ['We bought a hammock for the garden.', 'Kupiliśmy hamak do ogrodu.'],
  ['Your sister called last night.', 'Twoja siostra dzwoniła wczoraj wieczorem.'],
];

/** Atrapa sędziego: zna werdykt dla złotych par, nigdy nie woła prawdziwego modelu. */
const fakeJudge = (calls: QualityItem[][] = []) => async (items: QualityItem[]): Promise<Array<JudgeVerdict | null>> => {
  calls.push(items);
  return items.map((item) => {
    const text = item.kind === 'pair' ? item.en : '';
    const bad = BAD.find((b) => b.en === text);
    return bad
      ? { ok: false, reason: bad.name, criteria: { equivalence: false } }
      : { ok: true, reason: '', criteria: {} };
  });
};

test('stara kontrola rozgrzewki odrzuca objaw „Moje biuro… / on your doorstep”', () => {
  const check = checkWarmupExerciseItem({
    chunks: ['My office', 'is on your doorstep,', 'which is great.'],
    correctSentence: 'My office is on your doorstep, which is great.',
    polishTranslation: 'Moje biuro jest bardzo blisko, co jest świetne.',
  });
  assert.equal(check.ok, false);
});

for (const bad of BAD) {
  test(`złe: ${bad.name} — ${bad.caughtBy === 'local' ? 'odrzuca kontrola lokalna' : 'przechodzi lokalnie, odrzuca sędzia'}`, async () => {
    const local = checkItemLocally(pair(bad.en, bad.pl));
    if (bad.caughtBy === 'local') {
      assert.notEqual(local, null, 'kontrola lokalna powinna odrzucić');
    } else {
      assert.equal(local, null, 'sensu nie da się sprawdzić regułą — to robota sędziego');
      const [verdict] = await fakeJudge()([pair(bad.en, bad.pl)]);
      assert.equal(verdict?.ok, false);
    }
  });
}

for (const [en, pl] of GOOD) {
  test(`dobre: ${en}`, async () => {
    assert.equal(checkItemLocally(pair(en, pl)), null);
    const [verdict] = await fakeJudge()([pair(en, pl)]);
    assert.equal(verdict?.ok, true);
  });
}

test('pełna bramka: żaden ze złotych złych przypadków nie przechodzi, wszystkie dobre tak', async () => {
  const items = [...BAD.map((b) => ({ en: b.en, pl: b.pl })), ...GOOD.map(([en, pl]) => ({ en, pl }))];
  const result = await runQualityGate({
    items,
    target: GOOD.length,
    toQuality: (i) => pair(i.en, i.pl),
    judge: fakeJudge(),
  });
  assert.deepEqual(
    result.items.map((i) => i.en).sort(),
    GOOD.map(([en]) => en).sort()
  );
  assert.equal(result.unverified.length, 0);
});

test('sędzia dostaje tylko elementy po kontroli lokalnej, jednym zbiorczym wywołaniem', async () => {
  const calls: QualityItem[][] = [];
  await runQualityGate({
    items: [...BAD.map((b) => ({ en: b.en, pl: b.pl })), ...GOOD.map(([en, pl]) => ({ en, pl }))],
    target: 99,
    toQuality: (i) => pair(i.en, i.pl),
    judge: fakeJudge(calls),
  });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].length < BAD.length + GOOD.length);
  assert.ok(!calls[0].some((q) => q.kind === 'pair' && q.en.includes('doorstep')));
});

test('brakujące elementy są dogenerowane — najwyżej 2 razy; potem ćwiczenie ma mniej elementów', async () => {
  let refills = 0;
  const result = await runQualityGate({
    items: [{ en: BAD[1].en, pl: BAD[1].pl }],
    target: 2,
    toQuality: (i) => pair(i.en, i.pl),
    judge: fakeJudge(),
    refill: async () => {
      refills += 1;
      return [{ en: BAD[8].en, pl: BAD[8].pl }];
    },
  });
  assert.equal(refills, 2);
  assert.equal(result.retries, 2);
  assert.equal(result.items.length, 0);
});

test('dogenerowanie uzupełnia braki dobrymi elementami', async () => {
  const result = await runQualityGate({
    items: [{ en: BAD[1].en, pl: BAD[1].pl }, { en: GOOD[0][0], pl: GOOD[0][1] }],
    target: 2,
    toQuality: (i) => pair(i.en, i.pl),
    judge: fakeJudge(),
    refill: async (missing, rejected) => {
      assert.equal(missing, 1);
      assert.ok(rejected.some((r) => r.stage === 'judge'));
      return [{ en: GOOD[1][0], pl: GOOD[1][1] }];
    },
  });
  assert.equal(result.items.length, 2);
  assert.equal(result.retries, 1);
});

test('błąd sędziego: elementy nie trafiają do items (tylko do unverified), bez dogenerowania', async () => {
  let refills = 0;
  const result = await runQualityGate({
    items: GOOD.slice(0, 2).map(([en, pl]) => ({ en, pl })),
    target: 2,
    toQuality: (i) => pair(i.en, i.pl),
    judge: async () => {
      throw new Error('network');
    },
    refill: async () => {
      refills += 1;
      return [];
    },
  });
  assert.equal(result.items.length, 0);
  assert.equal(result.unverified.length, 2);
  assert.equal(refills, 0);
});

test('element bez wyroku sędziego nie przechodzi', async () => {
  const result = await runQualityGate({
    items: GOOD.slice(0, 2).map(([en, pl]) => ({ en, pl })),
    target: 2,
    toQuality: (i) => pair(i.en, i.pl),
    judge: async (items) => items.map((_, i) => (i === 0 ? { ok: true, reason: '', criteria: {} } : null)),
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.unverified.length, 1);
});

test('duplikaty i dwa zdania pod rząd o tej samej strukturze odpadają lokalnie', () => {
  const rejected = checkSetLocally([
    pair('She likes tea.', 'Ona lubi herbatę.'),
    pair('She likes tea.', 'Ona lubi herbatę.'),
    pair('She likes tea every day.', 'Ona codziennie pije herbatę.'),
    pair('We went home early.', 'Wróciliśmy wcześnie do domu.'),
  ]);
  assert.equal(rejected.get(1), 'duplicate');
  assert.equal(rejected.get(2), 'same_structure');
  assert.equal(rejected.has(3), false);
});

test('polskie pole z angielskim tekstem i angielskie z polskimi znakami odpadają', () => {
  assert.equal(checkItemLocally(pair('She likes the tea in the morning.', 'She likes the tea in the morning.')), 'language_mixed');
  assert.equal(checkItemLocally(pair('Ona lubi herbatę.', 'Ona lubi herbatę.')), 'language_mixed');
});

// --- wielokrotny wybór -------------------------------------------------------------------------

const mc = (over: Partial<Extract<QualityItem, { kind: 'multiple_choice' }>> = {}): QualityItem => ({
  kind: 'multiple_choice',
  question: 'She ___ to work every day.',
  options: ['walks', 'walk', 'walking', 'is walk'],
  correctIndex: 0,
  grammarFocus: 'tense',
  ...over,
});

test('MC: poprawny element przechodzi', () => assert.equal(checkItemLocally(mc()), null));
test('MC: dokładnie 4 opcje', () => assert.equal(checkItemLocally(mc({ options: ['a', 'b', 'c'] })), 'bad_option_count'));
test('MC: powtórzona opcja', () => assert.equal(checkItemLocally(mc({ options: ['walks', 'Walks', 'walking', 'is walk'] })), 'duplicate_option'));
test('MC: correctIndex poza zakresem', () => assert.equal(checkItemLocally(mc({ correctIndex: 4 })), 'bad_correct_index'));
test('MC: zdanie bez luki i bez pytania', () => assert.equal(checkItemLocally(mc({ question: 'She walks to work.' })), 'no_blank'));
test('MC: grammarFocus spoza enuma', () => assert.equal(checkItemLocally(mc({ grammarFocus: 'Present Simple' })), 'unknown_grammar_focus'));
test('MC: dwie opcje dają to samo zdanie', () =>
  assert.equal(checkItemLocally(mc({ question: 'I ___ the report.', options: ['read', 'read.', 'reading', 'reads'] })), 'duplicate_option'));

// --- dopasowanie i korekta ---------------------------------------------------------------------

test('dopasowanie: powtórzona prawa strona odpada w zestawie', () => {
  const rejected = checkSetLocally([
    { kind: 'word_pair', left: 'big', right: 'duży' },
    { kind: 'word_pair', left: 'large', right: 'duży' },
    { kind: 'word_pair', left: 'to run', right: 'biegać' },
    { kind: 'word_pair', left: 'to rest', right: 'odpoczywać' },
  ]);
  assert.equal(rejected.get(1), 'duplicate_pair_side');
  assert.equal(rejected.has(2), false);
  assert.equal(rejected.has(3), false, 'to run / to rest to nie „ta sama struktura”');
});
test('dopasowanie: poprawna para przechodzi, puste i identyczne strony nie', () => {
  assert.equal(checkItemLocally({ kind: 'word_pair', left: 'deadline', right: 'termin' }), null);
  assert.equal(checkItemLocally({ kind: 'word_pair', left: 'deadline', right: '' }), 'missing_field');
  assert.equal(checkItemLocally({ kind: 'word_pair', left: 'taxi', right: 'Taxi' }), 'duplicate_pair_side');
});
test('korekta: identyczne zdania nie mają błędu', () =>
  assert.equal(checkItemLocally({ kind: 'fix_sentence', incorrect: 'She likes tea.', correct: 'she likes tea' }), 'no_error'));
test('korekta: zdanie przepisane niemal w całości nie ma „jednego” błędu', () =>
  assert.equal(
    checkItemLocally({ kind: 'fix_sentence', incorrect: 'Tea likes she very much today', correct: 'She likes tea.' }),
    'error_not_single'
  ));
test('korekta: jeden błąd przechodzi', () =>
  assert.equal(checkItemLocally({ kind: 'fix_sentence', incorrect: 'She don’t eat meat.', correct: "She doesn't eat meat." }), null));

// --- sędzia: prompt i parsowanie ---------------------------------------------------------------

test('parseJudgeVerdicts: wszystkie kryteria true = ok; jedno false = odrzucenie; brak kryterium = odrzucenie', () => {
  const full = { index: 0, reason: '', naturalness: true, equivalence: true, uniqueness: true, level_vocab: true, context: true };
  const verdicts = parseJudgeVerdicts(
    { verdicts: [full, { ...full, index: 1, equivalence: false, reason: 'inna sytuacja' }, { index: 2, reason: '', naturalness: true }] },
    4
  );
  assert.equal(verdicts[0]?.ok, true);
  assert.equal(verdicts[1]?.ok, false);
  assert.equal(verdicts[1]?.reason, 'inna sytuacja');
  assert.equal(verdicts[2]?.ok, false);
  assert.equal(verdicts[3], null);
});

test('parseJudgeVerdicts: nieczytelna odpowiedź = brak wyroków', () => {
  assert.deepEqual(parseJudgeVerdicts('nie json', 2), [null, null]);
});

test('prompt sędziego zawiera kryteria a)–e) i wszystkie elementy', () => {
  const prompt = buildJudgePrompt([pair('A b.', 'A b.'), mc()], 'B1');
  for (const key of ['naturalness', 'equivalence', 'uniqueness', 'level_vocab', 'context']) assert.ok(prompt.includes(key), key);
  assert.ok(prompt.includes('0. [para PL↔EN]') && prompt.includes('1. [wielokrotny wybór]'));
});

test('żelazne zasady opisują punkty a)–e)', () => {
  for (const marker of ['a) NATURALNOŚĆ', 'b) RÓWNOWAŻNOŚĆ', 'c) JEDNOZNACZNOŚĆ', 'd) POZIOM', 'e) KONTEKST']) {
    assert.ok(EXERCISE_IRON_RULES.includes(marker), marker);
  }
});

// --- integracja: ćwiczenia dowolne i rozgrzewka (atrapy modelu) -------------------------------

import { JUDGE_SCHEMA } from '../utils/exerciseQuality';
import {
  FREE_PRACTICE_MODEL,
  FreeGenerationError,
  generateFreePracticeExercises,
  type CallModel,
  type FreeGenerationRequest,
  type StudentContext,
} from '../utils/freePracticeGeneration';
import { generateWarmupExercises } from '../services/homeworkGenerator';

const sentenceJson = (rows: Array<[string, string]>) =>
  JSON.stringify({
    sentences: rows.map(([en, pl]) => ({ english_sentence: en, polish_translation: pl, hint: 'hint', puzzleChunks: ['a b', 'c d'] })),
  });

const freeRequest = (count: number): FreeGenerationRequest =>
  ({ format: 'translation', topics: [], words: [], focusWords: [], lessonRecordIds: [], count, excludeSentences: [] }) as unknown as FreeGenerationRequest;
const freeContext = { level: 'B1', lessons: [] } as unknown as StudentContext;

const judgeText = (prompt: string, bad: string[]) => {
  const blocks = prompt.split(/^\d+\. \[/m).slice(1);
  return JSON.stringify({
    verdicts: blocks.map((block, index) => ({
      index,
      reason: bad.some((b) => block.includes(b)) ? 'odrzucone' : '',
      naturalness: true,
      equivalence: !bad.some((b) => block.includes(b)),
      uniqueness: true,
      level_vocab: true,
      context: true,
    })),
  });
};

test('ćwiczenia dowolne: sędzia odrzuca parę hamak/meble, brakujące zdanie jest dogenerowane', async () => {
  const replies = [
    sentenceJson([
      [BAD[1].en, BAD[1].pl],
      [GOOD[0][0], GOOD[0][1]],
    ]),
    sentenceJson([[GOOD[1][0], GOOD[1][1]]]),
  ];
  let generated = 0;
  const callModel: CallModel = async ({ prompt, schema }) => {
    if (schema === JUDGE_SCHEMA) return { text: judgeText(prompt, ['hamak']), modelUsed: FREE_PRACTICE_MODEL };
    return { text: replies[Math.min(generated++, replies.length - 1)], modelUsed: FREE_PRACTICE_MODEL };
  };
  const result = await generateFreePracticeExercises({ request: freeRequest(2), context: freeContext, callModel });
  assert.deepEqual(
    result.exercises.map((e) => e.englishTranslation),
    [GOOD[0][0], GOOD[1][0]]
  );
  assert.equal(generated, 2);
});

test('ćwiczenia dowolne: objaw „Moje biuro… / your doorstep” nie dociera do kursanta nawet bez sędziego', async () => {
  const callModel: CallModel = async ({ schema }) => {
    if (schema === JUDGE_SCHEMA) throw new Error('sędzia niedostępny');
    return { text: sentenceJson([[BAD[0].en, BAD[0].pl]]), modelUsed: FREE_PRACTICE_MODEL };
  };
  await assert.rejects(
    generateFreePracticeExercises({ request: freeRequest(1), context: freeContext, callModel }),
    (err: unknown) => err instanceof FreeGenerationError && err.code === 'invalid_output'
  );
});

test('ćwiczenia dowolne: sędzia niedostępny → kursant nie dostaje niesprawdzonych zdań', async () => {
  const callModel: CallModel = async ({ schema }) => {
    if (schema === JUDGE_SCHEMA) throw new Error('timeout');
    return { text: sentenceJson([[GOOD[0][0], GOOD[0][1]]]), modelUsed: FREE_PRACTICE_MODEL };
  };
  await assert.rejects(generateFreePracticeExercises({ request: freeRequest(1), context: freeContext, callModel }));
});

test('ćwiczenia dowolne: brak czasu w budżecie → bez dogenerowania (zegar atrapy)', async () => {
  let now = 0;
  let generated = 0;
  const callModel: CallModel = async ({ prompt, schema }) => {
    now += 20_000;
    if (schema === JUDGE_SCHEMA) return { text: judgeText(prompt, ['hamak']), modelUsed: FREE_PRACTICE_MODEL };
    generated += 1;
    return { text: sentenceJson([[BAD[1].en, BAD[1].pl], [GOOD[0][0], GOOD[0][1]]]), modelUsed: FREE_PRACTICE_MODEL };
  };
  const result = await generateFreePracticeExercises({ request: freeRequest(2), context: freeContext, callModel, clock: () => now });
  assert.equal(generated, 1, 'po 40 s nie startujemy kolejnego generowania');
  assert.equal(result.exercises.length, 1);
});

test('rozgrzewka: objaw moje/your odpada lokalnie (sędzia go nie widzi), dobre zdania przechodzą sędziego', async () => {
  const warm = (en: string, pl: string, chunks: string[]) => ({ correctSentence: en, chunks, polishTranslation: pl });
  const asked: string[] = [];
  const ask = async (prompt: string, schema?: object) => {
    if (schema === JUDGE_SCHEMA) {
      asked.push(prompt);
      return { parsed: JSON.parse(judgeText(prompt, [])), modelUsed: 'gemini-2.5-flash' };
    }
    return {
      parsed: {
        items: [
          warm('My office is on your doorstep, which is great.', 'Moje biuro jest bardzo blisko, co jest świetne.', ['My office', 'is on your doorstep,', 'which is great.']),
          warm('My brother works at a bank downtown today.', 'Mój brat pracuje dziś w banku w centrum.', ['My brother', 'works at a bank', 'downtown today.']),
        ],
      },
      modelUsed: 'gemini-2.5-flash',
    };
  };
  const result = await generateWarmupExercises('LEKCJA (2026-10-01): Daily routines\nslownictwo: work', [], { ask });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].correctSentence, 'My brother works at a bank downtown today.');
  assert.ok(result.reasons.includes('person_mismatch'), JSON.stringify(result.reasons));
  assert.equal(asked.length >= 1, true);
  assert.ok(!asked[0].includes('EN: My office is on your doorstep'));
});

test('osoba PL↔EN: „swój” i zaimki dopełnienia nie dają fałszywych alarmów', () => {
  assert.equal(checkItemLocally(pair('My brother took his phone.', 'Mój brat zabrał swój telefon.')), null);
  assert.equal(checkItemLocally(pair('My mother likes her a lot.', 'Moja mama bardzo ją lubi.')), null);
  assert.equal(checkItemLocally(pair('I took my umbrella.', 'Wziąłem parasol.')), null);
  assert.equal(checkItemLocally(pair('My office is on your street.', 'Moje biuro jest przy twojej ulicy.')), null);
  assert.notEqual(checkItemLocally(pair('My office is on your street.', 'Moje biuro jest przy ulicy.')), null);
});
