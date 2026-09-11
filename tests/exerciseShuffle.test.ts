import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  shuffleArray,
  shuffleDistinct,
  splitSentenceIntoTiles,
  buildShuffledTiles,
} from '../utils/exerciseShuffle';

/** Generator o zadanej sekwencji — testy mają być powtarzalne. */
const sequence = (values: number[]) => {
  let index = 0;
  return () => values[index++ % values.length];
};

describe('shuffleArray', () => {
  test('zachowuje wszystkie elementy', () => {
    const input = ['a', 'b', 'c', 'd'];
    const result = shuffleArray(input, sequence([0.1, 0.9, 0.5, 0.3]));
    assert.equal(result.length, input.length);
    assert.deepEqual([...result].sort(), [...input].sort());
  });

  test('nie zmienia oryginału', () => {
    const input = ['a', 'b', 'c'];
    shuffleArray(input, sequence([0.9, 0.1]));
    assert.deepEqual(input, ['a', 'b', 'c']);
  });

  test('pusta lista nie wywraca tasowania', () => {
    assert.deepEqual(shuffleArray([]), []);
  });
});

describe('shuffleDistinct', () => {
  test('zwraca inną kolejność niż wejściowa', () => {
    const input = ['one', 'two', 'three', 'four'];
    // Generator zwracający zawsze 0.999 zostawia kolejność bez zmian,
    // więc wchodzi zapasowa zamiana sąsiadów.
    const result = shuffleDistinct(input, () => 0.999);
    assert.notDeepEqual(result, input);
    assert.deepEqual([...result].sort(), [...input].sort());
  });

  test('dwa elementy zawsze zamieniają się miejscami', () => {
    const result = shuffleDistinct(['left', 'right'], () => 0.999);
    assert.deepEqual(result, ['right', 'left']);
  });

  test('lista identycznych elementów zwracana bez zmian', () => {
    const input = ['same', 'same', 'same'];
    assert.deepEqual(shuffleDistinct(input, () => 0.999), input);
  });

  test('pojedynczy element przechodzi bez zmian', () => {
    assert.deepEqual(shuffleDistinct(['only']), ['only']);
  });
});

describe('splitSentenceIntoTiles', () => {
  test('krótkie zdanie tnie na pojedyncze słowa', () => {
    assert.deepEqual(splitSentenceIntoTiles('I have been there', 6), [
      'I',
      'have',
      'been',
      'there',
    ]);
  });

  test('długie zdanie grupuje słowa, żeby nie było kilkunastu klocków', () => {
    const sentence = 'She has been working in this office since the beginning of last year';
    const tiles = splitSentenceIntoTiles(sentence, 6);
    assert.ok(tiles.length <= 7, `spodziewano się najwyżej 7 klocków, było ${tiles.length}`);
    assert.equal(tiles.join(' '), sentence);
  });

  test('kolejność słów zostaje zachowana', () => {
    const sentence = 'one two three four five six seven eight';
    assert.equal(splitSentenceIntoTiles(sentence, 4).join(' '), sentence);
  });

  test('puste zdanie daje pustą listę', () => {
    assert.deepEqual(splitSentenceIntoTiles('   '), []);
  });
});

describe('buildShuffledTiles', () => {
  test('rozwiązanie odtwarza oryginalne zdanie', () => {
    const sentence = 'He does not like spicy food';
    const { tiles, solution } = buildShuffledTiles(sentence, 6, () => 0.999);
    assert.equal(solution.join(' '), sentence);
    assert.deepEqual([...tiles].sort(), [...solution].sort());
  });

  test('klocki nie są podane w gotowej kolejności', () => {
    const { tiles, solution } = buildShuffledTiles('I will call you tomorrow', 6, () => 0.999);
    assert.notDeepEqual(tiles, solution);
  });
});
