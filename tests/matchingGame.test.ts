import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRound,
  initialMatchState,
  isRoundComplete,
  matchingScore,
  resolveWrong,
  selectTile,
  shuffle,
  starsFor,
  tileKey,
  MAX_PAIRS_PER_ROUND,
  type MatchCardInput,
  type MatchState,
} from '../utils/matchingGame';

const mkCards = (n: number): MatchCardInput[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, term: `term${i}`, definition: `def${i}` }));

// Deterministyczny generator (LCG) — różne ziarna dają różne kolejności.
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe('starsFor — progi', () => {
  // [pary, błędy, oczekiwane gwiazdki]
  const table: Array<[number, number, 1 | 2 | 3]> = [
    [2, 0, 3], [2, 1, 3], [2, 2, 1],
    [6, 0, 3], [6, 1, 3], [6, 2, 2], [6, 3, 1], [6, 9, 1],
    [10, 0, 3], [10, 1, 3], [10, 2, 2], [10, 3, 2], [10, 4, 1],
    [11, 2, 3], [11, 3, 2], [11, 4, 2], [11, 5, 1],
  ];
  for (const [pairs, mistakes, stars] of table) {
    test(`${pairs} par, ${mistakes} błędów → ${stars}★`, () => {
      assert.equal(starsFor(pairs, mistakes), stars);
    });
  }
  test('wiele błędów zawsze daje co najmniej 1★', () => {
    assert.equal(starsFor(6, 500), 1);
  });
  test('0 błędów daje 3★ dla każdego rozmiaru', () => {
    for (const p of [1, 2, 6, 10, 50]) assert.equal(starsFor(p, 0), 3);
  });
});

describe('matchingScore', () => {
  test('formuła zapisu jak dotąd: 100 − czas − 5·błędy, nie poniżej 0', () => {
    assert.equal(matchingScore(20, 2), 70);
    assert.equal(matchingScore(500, 0), 0);
  });
});

describe('buildRound', () => {
  test('klucze kafelków: left-<id> / right-<id>, po jednym na stronę', () => {
    const tiles = buildRound(mkCards(4), seeded(1));
    assert.equal(tiles.length, 8);
    assert.equal(new Set(tiles.map(t => t.key)).size, 8);
    for (const t of tiles) assert.equal(t.key, tileKey(t.side, t.pairId));
    assert.ok(tiles.every(t => /^(left|right)-c\d$/.test(t.key)));
  });
  test('maksymalnie MAX_PAIRS_PER_ROUND par, bez duplikatów id', () => {
    const cards = [...mkCards(20), ...mkCards(3)];
    const tiles = buildRound(cards, seeded(2));
    assert.equal(tiles.length, MAX_PAIRS_PER_ROUND * 2);
    assert.equal(new Set(tiles.map(t => t.pairId)).size, MAX_PAIRS_PER_ROUND);
  });
  test('wejście nie jest mutowane, a późniejsza zmiana tablicy nie rusza planszy', () => {
    const cards = mkCards(8);
    const snapshot = JSON.stringify(cards);
    const tiles = buildRound(cards, seeded(3));
    const before = tiles.map(t => t.key).join();
    cards.reverse();
    cards.push({ id: 'x', term: 'x', definition: 'y' });
    assert.equal(tiles.map(t => t.key).join(), before);
    assert.notEqual(JSON.stringify(cards), snapshot);
  });
  test('kolejna runda (inne losowanie) daje inną kolejność', () => {
    const a = buildRound(mkCards(6), seeded(4)).map(t => t.key).join();
    const b = buildRound(mkCards(6), seeded(5)).map(t => t.key).join();
    assert.notEqual(a, b);
  });
  test('shuffle zachowuje elementy i nie zmienia oryginału', () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(src, seeded(9));
    assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]);
    assert.deepEqual(src, [1, 2, 3, 4, 5]);
  });
});

describe('selectTile — stan par', () => {
  const tiles = buildRound(mkCards(3), seeded(7));
  const L = (i: number) => tileKey('left', `c${i}`);
  const R = (i: number) => tileKey('right', `c${i}`);

  test('pierwszy klik zaznacza, drugi w ten sam kafelek odznacza', () => {
    const a = selectTile(initialMatchState(), tiles, L(0));
    assert.equal(a.event, 'select');
    assert.equal(a.state.selectedKey, L(0));
    const b = selectTile(a.state, tiles, L(0));
    assert.equal(b.event, 'deselect');
    assert.equal(b.state.selectedKey, null);
  });
  test('dwa terminy to zmiana wyboru, nie błąd', () => {
    const a = selectTile(initialMatchState(), tiles, L(0)).state;
    const b = selectTile(a, tiles, L(1));
    assert.equal(b.event, 'switch');
    assert.equal(b.state.selectedKey, L(1));
    assert.equal(b.state.mistakes, 0);
  });
  test('poprawna para: match, combo rośnie, kafelki nieklikalne', () => {
    let s: MatchState = initialMatchState();
    s = selectTile(s, tiles, L(0)).state;
    const m = selectTile(s, tiles, R(0));
    assert.equal(m.event, 'match');
    assert.deepEqual(m.state.matchedPairIds, ['c0']);
    assert.equal(m.state.combo, 1);
    assert.equal(selectTile(m.state, tiles, L(0)).event, 'ignored');
    const m2 = selectTile(selectTile(m.state, tiles, L(1)).state, tiles, R(1));
    assert.equal(m2.state.combo, 2);
  });
  test('błędna para: licznik błędów +1, combo zerowane, trzeci klik zablokowany do końca animacji', () => {
    let s: MatchState = initialMatchState();
    s = selectTile(s, tiles, L(0)).state;
    const w = selectTile(s, tiles, R(1));
    assert.equal(w.event, 'wrong');
    assert.equal(w.state.mistakes, 1);
    assert.equal(w.state.combo, 0);
    assert.deepEqual(w.state.wrongPair, [L(0), R(1)]);
    const third = selectTile(w.state, tiles, L(2));
    assert.equal(third.event, 'ignored');
    assert.equal(third.state, w.state);
    const after = resolveWrong(w.state);
    assert.equal(after.wrongPair, null);
    assert.equal(after.selectedKey, null);
    assert.equal(selectTile(after, tiles, L(2)).event, 'select');
  });
  test('koniec rundy po dopasowaniu wszystkich par', () => {
    let s: MatchState = initialMatchState();
    for (let i = 0; i < 3; i++) {
      assert.equal(isRoundComplete(s, tiles), false);
      s = selectTile(selectTile(s, tiles, L(i)).state, tiles, R(i)).state;
    }
    assert.equal(isRoundComplete(s, tiles), true);
  });
  test('nieznany klucz jest ignorowany', () => {
    assert.equal(selectTile(initialMatchState(), tiles, 'left-nope').event, 'ignored');
  });
});
