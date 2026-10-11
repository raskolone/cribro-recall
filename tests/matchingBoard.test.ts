import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PAIRS_PER_ROUND, boardSeed, cleanPairs, hashSeed, layoutRound, pairShade, seededShuffle, splitRounds, type BoardPair } from '../utils/matchingBoard';

const mk = (n: number): BoardPair[] => Array.from({ length: n }, (_, i) => ({ id: `pair-${i}`, left: `word${i}`, right: `słowo${i}` }));

test('seededShuffle: ten sam wynik dla tego samego ziarna, inny dla innego, bez utraty elementów', () => {
  const items = [1, 2, 3, 4, 5, 6, 7];
  assert.deepEqual(seededShuffle(items, 'a'), seededShuffle(items, 'a'));
  assert.notDeepEqual(seededShuffle(items, 'a'), seededShuffle(items, 'b'));
  assert.deepEqual([...seededShuffle(items, 'a')].sort(), items);
  assert.deepEqual(items, [1, 2, 3, 4, 5, 6, 7], 'wejście nietknięte');
  assert.equal(hashSeed('x'), hashSeed('x'));
});

test('układ rundy: stabilny dla tej samej treści, lewa w kolejności zadania, prawa nigdy identyczna z lewą', () => {
  for (let n = 2; n <= 5; n++) {
    for (let s = 0; s < 60; s++) {
      const pairs = mk(n);
      const a = layoutRound(pairs, `seed-${s}`);
      const b = layoutRound(pairs.map((p) => ({ ...p })), `seed-${s}`);
      assert.deepEqual(a, b, 'te same dane i ziarno = ten sam układ');
      assert.deepEqual(a.left.map((p) => p.id), pairs.map((p) => p.id));
      assert.notDeepEqual(a.right.map((p) => p.id), a.left.map((p) => p.id), `n=${n}, ziarno ${s}: rozwiązanie byłoby widać`);
      assert.deepEqual([...a.right.map((p) => p.id)].sort(), pairs.map((p) => p.id).sort());
    }
  }
});

test('ziarno z treści zadania nie zależy od referencji tablicy', () => {
  assert.equal(boardSeed(mk(4)), boardSeed(mk(4)));
  assert.notEqual(boardSeed(mk(4)), boardSeed(mk(5)));
});

test('rundy: najwyżej 5 par, wyrównane, żadna runda nie ma jednej pary', () => {
  assert.equal(MAX_PAIRS_PER_ROUND, 5);
  const sizes = (n: number) => splitRounds(mk(n)).map((r) => r.length);
  assert.deepEqual(sizes(2), [2]);
  assert.deepEqual(sizes(5), [5]);
  assert.deepEqual(sizes(6), [3, 3]);
  assert.deepEqual(sizes(7), [4, 3]);
  assert.deepEqual(sizes(10), [5, 5]);
  assert.deepEqual(sizes(11), [4, 4, 3]);
  for (let n = 2; n <= 40; n++) {
    const rounds = splitRounds(mk(n));
    assert.ok(rounds.every((r) => r.length >= 2 && r.length <= 5), `n=${n}`);
    assert.equal(rounds.flat().length, n);
  }
  assert.deepEqual(splitRounds([]), []);
});

test('odcienie par: kolejne trafienia mają różne odcienie, a niedopasowana para nie ma żadnego', () => {
  const hits = ['pair-3', 'pair-0', 'pair-4'];
  assert.equal(pairShade(hits, 'pair-1'), undefined, 'kolor nie zdradza rozwiązania przed trafieniem');
  assert.deepEqual(hits.map((id) => pairShade(hits, id)), [1, 2, 3]);
  const five = ['a', 'b', 'c', 'd', 'e'];
  assert.equal(new Set(five.map((id) => pairShade(five, id))).size, 5);
});

test('cleanPairs odrzuca puste pola i powtórzone id', () => {
  const cleaned = cleanPairs([
    { id: 'a', left: 'x', right: 'y' },
    { id: 'a', left: 'z', right: 'w' },
    { id: 'b', left: ' ', right: 'w' },
    { id: 'c', left: 'q' },
    null,
    { id: 'd', left: 'm', right: 'n' },
  ]);
  assert.deepEqual(cleaned.map((p) => p.id), ['a', 'd']);
  assert.deepEqual(cleanPairs('nie lista'), []);
});
