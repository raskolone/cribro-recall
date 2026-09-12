import assert from 'node:assert/strict';
import test from 'node:test';

import { extractListFromModelJson } from '../utils/modelJsonList';

/**
 * Odtworzenie realnej awarii: generator testów zwracał lektorowi
 * „Model nie zwrócił poprawnej listy zadań", mimo że model odpowiadał
 * poprawnie — tylko w kształcie obiektu, bo tryb `json_object` OpenAI
 * innego nie potrafi.
 */

test('goła tablica — tak odpowiada Gemini z responseSchema', () => {
  const result = extractListFromModelJson('[{"type":"translation"},{"type":"matching"}]');
  assert.equal(result?.length, 2);
});

test('obiekt z tablicą — tak odpowiada OpenAI w trybie json_object', () => {
  // To jest dokładnie ta odpowiedź, którą stary kod odrzucał.
  const result = extractListFromModelJson('{"questions":[{"type":"translation"}]}');
  assert.equal(result?.length, 1);
  assert.equal(result?.[0].type, 'translation');
});

test('nazwa klucza nie ma znaczenia', () => {
  assert.equal(extractListFromModelJson('{"tasks":[{"a":1}]}')?.length, 1);
  assert.equal(extractListFromModelJson('{"items":[{"a":1},{"b":2}]}')?.length, 2);
  assert.equal(extractListFromModelJson('{"zadania":[{"a":1}]}')?.length, 1);
});

test('płot ```json nie przeszkadza', () => {
  assert.equal(extractListFromModelJson('```json\n[{"a":1}]\n```')?.length, 1);
  assert.equal(extractListFromModelJson('```\n{"questions":[{"a":1}]}\n```')?.length, 1);
});

test('pusta lista to brak listy — nie ma po co budować testu z zera zadań', () => {
  assert.equal(extractListFromModelJson('[]'), null);
  assert.equal(extractListFromModelJson('{"questions":[]}'), null);
});

test('obiekt z kilkoma tablicami jest odrzucany, zamiast zgadywać', () => {
  // Zgadywanie oznaczałoby test złożony z przypadkowego pola.
  assert.equal(extractListFromModelJson('{"questions":[{"a":1}],"wordBank":["x","y"]}'), null);
});

test('śmieci i brak odpowiedzi nie wywracają generowania', () => {
  assert.equal(extractListFromModelJson(''), null);
  assert.equal(extractListFromModelJson(null), null);
  assert.equal(extractListFromModelJson(undefined), null);
  assert.equal(extractListFromModelJson('przepraszam, nie mogę'), null);
  assert.equal(extractListFromModelJson('{"questions": "to nie tablica"}'), null);
  assert.equal(extractListFromModelJson('{niepoprawny json'), null);
});

test('pojedynczy obiekt bez tablicy nie udaje listy', () => {
  assert.equal(extractListFromModelJson('{"type":"translation","prompt":"x"}'), null);
});
