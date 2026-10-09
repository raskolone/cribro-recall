import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDisplayDateValue } from '../utils/displayDate';

test('ISO z godziną wraca jako czytelna data bez ciągu znaków', () => {
  const out = formatDisplayDateValue('2026-10-02T17:07:27.000Z', 'pl-PL');
  assert.match(out, /2026/);
  assert.doesNotMatch(out, /T\d{2}:/);
  assert.ok(out.length < 30);
});

test('sama data to dzień lokalny, bez przesunięcia strefy', () => {
  const out = formatDisplayDateValue('2026-10-02', 'pl-PL');
  assert.match(out, /2/);
  assert.match(out, /2026/);
  assert.equal(out, new Date(2026, 9, 2).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }));
});

test('znacznik Firestore i Date dają ten sam wynik', () => {
  const d = new Date(2026, 5, 15, 12);
  const expected = formatDisplayDateValue(d, 'en-GB');
  assert.equal(formatDisplayDateValue({ toDate: () => d }, 'en-GB'), expected);
  assert.equal(formatDisplayDateValue({ seconds: d.getTime() / 1000 }, 'en-GB'), expected);
});

test('pusta wartość to pusty tekst, a nieczytelny tekst zostaje bez zmian', () => {
  assert.equal(formatDisplayDateValue(null), '');
  assert.equal(formatDisplayDateValue(''), '');
  assert.equal(formatDisplayDateValue('Lekcja nr 4'), 'Lekcja nr 4');
});

test('niepoprawna data ISO wraca jako oryginał', () => {
  assert.equal(formatDisplayDateValue('2026-13-45T00:00:00Z'), '2026-13-45T00:00:00Z');
});
