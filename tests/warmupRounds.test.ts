import { test } from 'node:test';
import assert from 'node:assert/strict';
// Import poboczny — inicjalizuje singleton i18next, z którego korzysta
// `normalizeExercise.ts`.
import '../i18n';
import { buildWarmupRounds } from '../utils/warmupRounds';
import { checkWarmupExerciseItem } from '../utils/exerciseSentenceChecks';

/**
 * Rozgrzewka: polecenie to ZAWSZE polskie zdanie, kafelki to angielskie
 * słowa/fragmenty poprawnej wersji. Element bez polskiego odpowiednika jest
 * pomijany — nigdy nie pokazujemy angielskiego zdania (w tym z błędem) jako
 * polecenia.
 */

const HEADING = 'Ułóż zdanie';
const INSTRUCTION = 'Ułóż zdanie po angielsku z kafelków.';

test('stary find_errors: polskie polecenie, poprawne zdanie jako cel, zdanie z błędem nigdzie nie jest poleceniem', () => {
  const rounds = buildWarmupRounds([
    {
      incorrectSentence: 'I would to have a spacious living room in my ideal home.',
      correctSentence: 'I would like to have a spacious living room in my ideal home.',
      polishHint: 'Chciałbym mieć przestronny salon w moim wymarzonym domu.',
    },
  ]);
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].heading, HEADING);
  assert.equal(rounds[0].instruction, INSTRUCTION);
  assert.equal(rounds[0].sourceLabel, 'Chciałbym mieć przestronny salon w moim wymarzonym domu.');
  assert.equal(rounds[0].targetSentence, 'I would like to have a spacious living room in my ideal home.');
  assert.notEqual(rounds[0].sourceLabel, 'I would to have a spacious living room in my ideal home.');
  assert.ok(!/popraw|znajdź błąd/i.test(`${rounds[0].heading} ${rounds[0].instruction}`));
});

test('stary find_errors bez polskiego znaczenia jest pomijany', () => {
  const rounds = buildWarmupRounds([
    {
      incorrectSentence: 'I have meet the deadline yesterday.',
      correctSentence: 'I met the deadline yesterday.',
    },
  ]);
  assert.equal(rounds.length, 0);
});

test('stare tłumaczenie: polskie zdanie jako polecenie, angielskie jako cel', () => {
  const rounds = buildWarmupRounds(
    [{ polishSentence: 'Muszę dotrzymać terminu.', englishTranslation: 'I have to meet the deadline.' }],
    { type: 'translation' }
  );
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].sourceLabel, 'Muszę dotrzymać terminu.');
  assert.equal(rounds[0].targetSentence, 'I have to meet the deadline.');
  assert.equal(rounds[0].heading, HEADING);
});

test('stare tłumaczenie bez angielskiej wersji jest pomijane', () => {
  const rounds = buildWarmupRounds([{ polishSentence: 'Muszę dotrzymać terminu.' }], { type: 'translation' });
  assert.equal(rounds.length, 0);
});

test('stary word_order z polishHint działa, bez polishHint jest pomijany', () => {
  const withHint = buildWarmupRounds([
    { chunks: ['I', 'have', 'to', 'meet', 'the', 'deadline'], correctSentence: 'I have to meet the deadline', polishHint: 'Muszę dotrzymać terminu.' },
  ]);
  assert.equal(withHint.length, 1);
  assert.equal(withHint[0].sourceLabel, 'Muszę dotrzymać terminu.');
  assert.equal(withHint[0].heading, HEADING);
  assert.ok(withHint[0].chunks.length >= 2 && withHint[0].chunks.every((c) => c.split(' ').length >= 2), 'lista słów dała frazy');
  assert.equal(withHint[0].chunks.join(' '), 'I have to meet the deadline');

  const withoutHint = buildWarmupRounds([
    { chunks: ['I', 'have', 'to', 'meet', 'the', 'deadline'], correctSentence: 'I have to meet the deadline' },
  ]);
  assert.equal(withoutHint.length, 0);
});

test('wstrzyknięta instrukcja AI w polu polishHint nie jest poleceniem — runda pominięta', () => {
  const rounds = buildWarmupRounds([
    {
      chunks: ['I', 'have', 'to', 'meet', 'the', 'deadline'],
      correctSentence: 'I have to meet the deadline',
      polishHint: 'Popraw zdanie. Zwróć uwagę na czas.',
    },
  ]);
  assert.equal(rounds.length, 0);
});

test('fill_in_the_blank i element bez derywowalnego zdania nie tworzą rundy', () => {
  assert.equal(buildWarmupRounds([{ textWithBlanks: 'She [BLANK_1] to school.', availableWords: ['goes'] }]).length, 0);
});

test('zdanie za krótkie nie trafia do rozgrzewki', () => {
  const rounds = buildWarmupRounds([{ chunks: ['Hi', 'there'], correctSentence: 'Hi there', polishHint: 'Cześć.' }]);
  assert.equal(rounds.length, 0);
});

test('maksymalnie 3 rundy starej rozgrzewki', () => {
  const items = Array.from({ length: 6 }, (_, i) => ({
    chunks: ['I', 'like', 'sentence', String(i)],
    correctSentence: `I like sentence ${i}`,
    polishHint: `Lubię zdanie ${i}.`,
  }));
  assert.equal(buildWarmupRounds(items).length, 3);
});

test('warmup niepusty z polskim tłumaczeniem: polecenie polskie, kafelki angielskie', () => {
  const rounds = buildWarmupRounds([], {
    warmup: [
      {
        chunks: ['I have to', 'meet the deadline', 'by tomorrow'],
        correctSentence: 'I have to meet the deadline by tomorrow',
        polishTranslation: 'Muszę dotrzymać terminu do jutra.',
      },
    ],
  });
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].type, 'warmup_chunk');
  assert.equal(rounds[0].heading, HEADING);
  assert.equal(rounds[0].instruction, INSTRUCTION);
  assert.equal(rounds[0].sourceLabel, 'Muszę dotrzymać terminu do jutra.');
  assert.notEqual(rounds[0].sourceLabel, rounds[0].targetSentence);
  assert.deepEqual(rounds[0].chunks, ['I have to', 'meet the deadline', 'by tomorrow']);
});

test('warmup bez polskiego tłumaczenia: runda pominięta, indeksy pozostałych zachowane', () => {
  const rounds = buildWarmupRounds([], {
    warmup: [
      { chunks: ['A b', 'c d', 'e f'], correctSentence: 'A b c d e f', polishHint: 'stare pole' },
      { chunks: ['A b', 'c d', 'e f'], correctSentence: 'A b c d e f', polishTranslation: 'Pełne tłumaczenie.' },
    ],
  });
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].itemIndex, 1);
});

test('task.warmup === [] daje brak rozgrzewki', () => {
  const rounds = buildWarmupRounds(
    [{ chunks: ['I', 'like', 'sentence'], correctSentence: 'I like sentence', polishHint: 'Lubię zdanie.' }],
    { warmup: [] }
  );
  assert.equal(rounds.length, 0);
});

test('task.warmup === undefined wraca do starej rozgrzewki ze sentences', () => {
  const rounds = buildWarmupRounds(
    [{ chunks: ['I', 'really', 'like', 'this', 'sentence'], correctSentence: 'I really like this sentence', polishHint: 'Naprawdę lubię to zdanie.' }],
    { warmup: undefined, type: 'word_order' }
  );
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].targetSentence, 'I really like this sentence');
  assert.ok(rounds[0].chunks.every((c) => c.split(' ').length >= 2), 'kafelki to frazy, nie pojedyncze słowa');
  assert.equal(rounds[0].chunks.join(' '), 'I really like this sentence');
});

test('walidacja generatora: element bez polskiego tłumaczenia jest odrzucany', () => {
  const base = { chunks: ['I have to', 'meet the deadline', 'by tomorrow'], correctSentence: 'I have to meet the deadline by tomorrow' };
  const missing = checkWarmupExerciseItem(base);
  assert.equal(missing.ok, false);
  const ok = checkWarmupExerciseItem({ ...base, polishTranslation: 'Muszę dotrzymać terminu do jutra.' });
  assert.equal(ok.ok, true);
  const oldField = checkWarmupExerciseItem({ ...base, polishHint: 'Termin.' });
  assert.equal(oldField.ok, false);
});

// --- Kawałki, dystraktory i stany pola warmup ---------------------------------------------------

const noSingleWords = (rounds: ReturnType<typeof buildWarmupRounds>) =>
  rounds.every((r) => [...r.chunks, ...r.distractors].every((c) => c.trim().split(/\s+/).length >= 2));

test('warmup z pojedynczym słowem w danych („I"): słowo scalone z sąsiadem, treść zdania bez zmian', () => {
  const rounds = buildWarmupRounds([], {
    warmup: [{ chunks: ['I', 'have to', 'meet the deadline'], correctSentence: 'I have to meet the deadline', polishTranslation: 'Muszę dotrzymać terminu.' }],
  });
  assert.equal(rounds.length, 1);
  assert.deepEqual(rounds[0].chunks, ['I have to', 'meet the deadline']);
  assert.ok(noSingleWords(rounds));
});

test('warmup, w którym kawałki to same słowa, dostaje podział zdania na frazy', () => {
  const sentence = 'She usually walks to work with her sister';
  const rounds = buildWarmupRounds([], {
    warmup: [{ chunks: sentence.split(' '), correctSentence: sentence, polishTranslation: 'Zwykle chodzi do pracy z siostrą.' }],
  });
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].chunks.join(' '), sentence);
  assert.ok(rounds[0].chunks.length >= 3 && noSingleWords(rounds));
});

test('warmup z kawałkami niepasującymi do zdania nie psuje rundy — podział zdania', () => {
  const rounds = buildWarmupRounds([], {
    warmup: [{ chunks: ['totally', 'different words'], correctSentence: 'I have to meet the deadline', polishTranslation: 'Muszę dotrzymać terminu.' }],
  });
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].chunks.join(' '), 'I have to meet the deadline');
});

test('zdanie z generatora zdań: puzzleChunks są używane, gdy składają się w zdanie', () => {
  const rounds = buildWarmupRounds([
    { polishSentence: 'Zarezerwowałem lot na piątek.', englishTranslation: 'I booked a flight for Friday.', puzzleChunks: ['I booked', 'a flight', 'for Friday.'] },
  ], { type: 'translation' });
  assert.deepEqual(rounds[0].chunks, ['I booked', 'a flight', 'for Friday.']);
  const broken = buildWarmupRounds([
    { polishSentence: 'Zarezerwowałem lot na piątek.', englishTranslation: 'I booked a flight for Friday.', puzzleChunks: ['coś', 'innego'] },
  ], { type: 'translation' });
  assert.equal(broken[0].chunks.join(' '), 'I booked a flight for Friday.');
});

test('zdanie z mniej niż czterema słowami nie tworzy rundy (nie da się ułożyć z fraz)', () => {
  assert.equal(buildWarmupRounds([{ polishSentence: 'Lubię herbatę.', englishTranslation: 'I like tea.' }], { type: 'translation' }).length, 0);
  assert.equal(buildWarmupRounds([], { warmup: [{ chunks: ['I like', 'tea'], correctSentence: 'I like tea', polishTranslation: 'Lubię herbatę.' }] }).length, 0);
});

test('dystraktory: najwyżej jeden, CAŁY kawałek z INNEJ rundy tego samego zadania, nigdy z tej samej rundy ani nowe słowa', () => {
  const task = {
    warmup: [
      { chunks: ['I have to', 'meet the deadline', 'by tomorrow'], correctSentence: 'I have to meet the deadline by tomorrow', polishTranslation: 'a' },
      { chunks: ['She usually', 'walks to work', 'with her sister'], correctSentence: 'She usually walks to work with her sister', polishTranslation: 'b' },
      { chunks: ['We often', 'eat lunch', 'in the park'], correctSentence: 'We often eat lunch in the park', polishTranslation: 'c' },
    ],
  };
  const rounds = buildWarmupRounds([], task);
  assert.equal(rounds.length, 3);
  const all = rounds.flatMap((r) => r.chunks);
  for (const round of rounds) {
    assert.ok(round.distractors.length <= 1);
    for (const d of round.distractors) {
      assert.ok(!round.chunks.includes(d), 'dystraktor nie dubluje kawałka tej rundy');
      assert.ok(all.includes(d), 'to cały kawałek z danych zadania');
      assert.ok(rounds.filter((r) => r !== round).some((r) => r.chunks.includes(d)), 'z innej rundy tego samego zadania');
    }
  }
  assert.ok(rounds.every((r) => r.distractors.length === 1));
  assert.ok(noSingleWords(rounds));
  // jedna runda → brak dystraktorów (nie ma skąd)
  assert.deepEqual(buildWarmupRounds([], { warmup: [task.warmup[0]] })[0].distractors, []);
});

test('trzy stany pola warmup: undefined = stara rozgrzewka ze zdań, [] = brak, lista = nowa', () => {
  const sentences = [{ polishSentence: 'Muszę dotrzymać terminu jutro rano.', englishTranslation: 'I have to meet the deadline tomorrow morning.' }];
  const listItem = { chunks: ['I have to', 'meet the deadline', 'by tomorrow'], correctSentence: 'I have to meet the deadline by tomorrow', polishTranslation: 'Muszę dotrzymać terminu do jutra.' };
  assert.equal(buildWarmupRounds(sentences, { type: 'translation' }).length, 1, 'undefined');
  assert.equal(buildWarmupRounds(sentences, { type: 'translation', warmup: undefined })[0].type, 'translation');
  assert.equal(buildWarmupRounds(sentences, { type: 'translation', warmup: [] }).length, 0, '[]');
  const fromList = buildWarmupRounds(sentences, { type: 'translation', warmup: [listItem] });
  assert.equal(fromList.length, 1, 'lista');
  assert.equal(fromList[0].type, 'warmup_chunk');
  // stary kształt (polishHint zamiast polishTranslation) = brak pola → stara rozgrzewka
  const legacyShape = buildWarmupRounds(sentences, { type: 'translation', warmup: [{ chunks: ['a b', 'c d'], correctSentence: 'a b c d', polishHint: 'x' }] });
  assert.equal(legacyShape[0].type, 'translation');
});

test('ścieżka tokenowa /hw?token=: odpowiedź serwera bez angielskich zdań — rozgrzewka z listy warmup działa, bez listy jej nie ma (jak dotąd)', () => {
  // Kształt z /api/homework/direct/:token: zdania BEZ odpowiedzi, `warmup` z kawałkami i polskim poleceniem.
  const directTask = {
    id: 't1',
    type: 'translation',
    sentences: [
      { id: 's0', type: 'translation', polishSentence: 'Muszę dotrzymać terminu jutro rano.', polishHint: 'since' },
      { id: 's1', type: 'translation', polishSentence: 'Zwykle chodzi do pracy z siostrą.' },
    ],
  };
  const listItem = { chunks: ['I have to', 'meet the deadline', 'by tomorrow'], correctSentence: 'I have to meet the deadline by tomorrow', polishTranslation: 'Muszę dotrzymać terminu do jutra.' };
  assert.equal(buildWarmupRounds(directTask.sentences, { ...directTask, warmup: [listItem] }).length, 1);
  assert.equal(buildWarmupRounds(directTask.sentences, { ...directTask, warmup: undefined }).length, 0, 'bez odpowiedzi na linku nie ma starej rozgrzewki');
  assert.equal(buildWarmupRounds(directTask.sentences, { ...directTask, warmup: [] }).length, 0);
});
