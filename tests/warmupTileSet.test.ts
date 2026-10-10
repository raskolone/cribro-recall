import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distortionsOf, findConflictingPrompts, pickSafeDistractor, validateTileSet } from '../utils/warmupTileSet';

const HAMMOCK = 'I would like to have a hammock on my spacious balcony.';
const HAMMOCK_CHUNKS = ['I would like', 'to have a hammock', 'on my spacious balcony.'];
const FURNITURE_CHUNKS = ['We chose', 'simple furniture', 'for our small,', 'cramped apartment.'];

const check = (tiles: string[], chunks = HAMMOCK_CHUNKS, targetSentence = HAMMOCK) =>
  validateTileSet({ targetSentence, chunks, tiles });

test('niezmiennik: dokładnie kawałki zdania — poprawny zestaw przechodzi (bez dystraktora i z dystraktorem)', () => {
  assert.deepEqual(check([...HAMMOCK_CHUNKS]), { ok: true, distractor: null });
  assert.deepEqual(check([...HAMMOCK_CHUNKS, 'to has a hammock']), { ok: true, distractor: 'to has a hammock' });
  // kolejność w puli nie ma znaczenia
  assert.deepEqual(check(['on my spacious balcony.', 'I would likes', ...HAMMOCK_CHUNKS.slice(1, 2), 'I would like']), { ok: true, distractor: 'I would likes' });
});

test('niezmiennik: brakujący kafelek → odrzucone', () => {
  assert.deepEqual(check(HAMMOCK_CHUNKS.slice(1)), { ok: false, reason: 'missing_tile' });
});

test('niezmiennik: kafelki z INNEGO zdania (objaw z telefonu) → odrzucone', () => {
  // z poprawnego zdania tylko „I would like”, reszta to kawałki zdania o meblach
  assert.deepEqual(check(['I would like', ...FURNITURE_CHUNKS]), { ok: false, reason: 'missing_tile' });
  // komplet kawałków + jeden kafelek z obcego zdania
  assert.deepEqual(check([...HAMMOCK_CHUNKS, 'We chose']), { ok: false, reason: 'foreign_tile' });
  // komplet kawałków + dwa kafelki ponad
  assert.deepEqual(check([...HAMMOCK_CHUNKS, 'We chose', 'simple furniture']), { ok: false, reason: 'too_many_extra_tiles' });
});

test('niezmiennik: zdublowany kafelek → odrzucone (ukryłby błąd i dał drugie „poprawne” ułożenie)', () => {
  assert.deepEqual(check([...HAMMOCK_CHUNKS, 'to have a hammock']), { ok: false, reason: 'duplicate_tile' });
  assert.deepEqual(check([...HAMMOCK_CHUNKS, 'To have a hammock']), { ok: false, reason: 'duplicate_tile' });
});

test('niezmiennik: kawałki, które nie składają się w zdanie, odrzucone', () => {
  assert.deepEqual(check([...FURNITURE_CHUNKS], FURNITURE_CHUNKS, HAMMOCK), { ok: false, reason: 'chunks_dont_form_sentence' });
});

test('niezmiennik: dystraktor spoza reguł (przyimek, który może dać drugie poprawne zdanie) odrzucony', () => {
  assert.deepEqual(check([...HAMMOCK_CHUNKS, 'in my spacious balcony.']), { ok: false, reason: 'foreign_tile' });
});

test('dystraktor: zniekształcenie kawałka TEGO SAMEGO zdania, nigdy obcy kawałek', () => {
  const d = pickSafeDistractor(HAMMOCK_CHUNKS, HAMMOCK);
  assert.ok(d);
  assert.ok(HAMMOCK_CHUNKS.some((c) => distortionsOf(c).includes(d!)));
  assert.ok(!HAMMOCK_CHUNKS.includes(d!));
  assert.ok(!FURNITURE_CHUNKS.includes(d!));
  assert.equal(pickSafeDistractor(HAMMOCK_CHUNKS, HAMMOCK), d, 'deterministycznie');
});

test('dystraktor: brak bezpiecznego kandydata = brak dystraktora', () => {
  assert.equal(pickSafeDistractor(FURNITURE_CHUNKS, 'We chose simple furniture for our small, cramped apartment.'), null);
  assert.equal(pickSafeDistractor([], ''), null);
});

test('dystraktor nie tworzy drugiego poprawnego ułożenia: niegramatyczny w każdym miejscu, inny niż każdy kawałek', () => {
  const samples: Array<[string[], string]> = [
    [HAMMOCK_CHUNKS, HAMMOCK],
    [['I have to', 'meet the deadline', 'by tomorrow morning.'], 'I have to meet the deadline by tomorrow morning.'],
    [['She would love', 'to visit Paris', 'in the spring.'], 'She would love to visit Paris in the spring.'],
    [['They want', 'to buy a house', 'near the sea.'], 'They want to buy a house near the sea.'],
  ];
  for (const [chunks, sentence] of samples) {
    const d = pickSafeDistractor(chunks, sentence);
    if (!d) continue;
    const key = (t: string) => t.toLowerCase().replace(/[.,!?]/g, '');
    assert.ok(!chunks.some((c) => key(c) === key(d)), `„${d}” nie dubluje kawałka`);
    // każda reguła zostawia w kafelku formę, której nie ma w poprawnym zdaniu
    assert.ok(!key(sentence).includes(key(d)), `„${d}” nie występuje w poprawnym zdaniu`);
    assert.match(d, /\b(to (has|goes|does|sees|meets|buys|makes|takes|gets|finds|learns|speaks|tries|eats|drinks|reads|writes|knows|says|tells|gives|comes|brings|chooses|spends|builds|finishes|forgets|remembers|decides|enjoys|sends|keeps|feels|thinks)|(would|could|should) \w+s|an? \w+s)\b/i, `„${d}” ma jawny błąd formy`);
    // podobna liczba słów i długość do pozostałych kafelków
    assert.ok(chunks.some((c) => c.split(' ').length === d.split(' ').length));
  }
});

test('para (polecenie, zdanie) rozjechana: to samo polecenie, różne angielskie zdania → obie rundy w konflikcie', () => {
  const conflicting = findConflictingPrompts([
    { itemIndex: 0, sourceLabel: 'Chciałbym mieć hamak.', targetSentence: 'We chose simple furniture.' },
    { itemIndex: 1, sourceLabel: 'Chciałbym mieć hamak.', targetSentence: HAMMOCK },
    { itemIndex: 2, sourceLabel: 'Co innego.', targetSentence: 'Something else entirely here.' },
  ]);
  assert.deepEqual([...conflicting].sort(), [0, 1]);
  // zwykły duplikat (to samo polecenie, to samo zdanie) nie jest konfliktem
  assert.equal(findConflictingPrompts([
    { itemIndex: 0, sourceLabel: 'A.', targetSentence: 'Same one here now.' },
    { itemIndex: 1, sourceLabel: 'a', targetSentence: 'same one here now' },
  ]).size, 0);
});
