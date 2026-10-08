import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizeWarmupCards } from '../utils/warmupCards';
import { plZadania } from '../utils/taskCountLabel';

test('karty z dokumentu bez contextSentence przechodzą sanityzację ekranu kursanta (hasCards = true)', () => {
  const stored = [
    { term: 'take off', definition: 'zdjąć' },
    { term: 'look for', definition: 'szukać' },
    { term: 'give up', definition: 'poddać się' },
    { term: 'carry on', definition: 'kontynuować' },
    { term: 'find out', definition: 'dowiedzieć się' },
    { term: 'set up', definition: 'założyć' },
  ];
  const cards = sanitizeWarmupCards(stored) ?? [];
  assert.equal(cards.length, 6);
  assert.ok(cards.every((c) => c.contextSentence === undefined));
});

test('przyciski rozgrzewki: strzałka tylko jako ikona, nie w tekście', () => {
  const src = readFileSync('components/dashboard/HomeworkWarmupScrambler.tsx', 'utf8');
  assert.ok(!/Rozpocznij pracę domową\s*→/.test(src));
  assert.ok(!/Następne zdanie\s*→/.test(src));
});

test('plakietka zadań: liczba tylko raz, bez słowa „wykonane"', () => {
  assert.equal(plZadania(1), '1 zadanie');
  assert.equal(plZadania(3), '3 zadania');
  assert.equal(plZadania(8), '8 zadań');
  assert.equal(plZadania(12), '12 zadań');
  assert.equal(plZadania(8, 'en'), '8 tasks');
  assert.equal((plZadania(8).match(/8/g) || []).length, 1);
});
