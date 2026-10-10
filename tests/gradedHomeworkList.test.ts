import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FRESH_DAYS, formatReviewDate, gradeTone, isFreshlyReviewed, sortNewestReviewed, splitVisible, stripHomeworkPrefix, toMillis,
} from '../utils/gradedHomeworkList';

const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);
const DAY = 86400000;
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

test('świeże: granica 7 dni włącznie, 7 dni i 1 ms już nie', () => {
  assert.equal(FRESH_DAYS, 7);
  assert.equal(isFreshlyReviewed({ reviewedAt: iso(0) }, NOW), true);
  assert.equal(isFreshlyReviewed({ reviewedAt: iso(6.99) }, NOW), true);
  assert.equal(isFreshlyReviewed({ reviewedAt: NOW - 7 * DAY }, NOW), true);
  assert.equal(isFreshlyReviewed({ reviewedAt: NOW - 7 * DAY - 1 }, NOW), false);
  assert.equal(isFreshlyReviewed({ reviewedAt: iso(30) }, NOW), false);
});
test('świeże: obejrzane (pole w danych albo lokalnie) nie jest świeże; false/brak pola jest nieobejrzane', () => {
  assert.equal(isFreshlyReviewed({ reviewedAt: iso(1), feedbackReadByStudent: true }, NOW), false);
  assert.equal(isFreshlyReviewed({ reviewedAt: iso(1), feedbackReadByStudent: false }, NOW), true);
  assert.equal(isFreshlyReviewed({ reviewedAt: iso(1) }, NOW, true), false);
  assert.equal(isFreshlyReviewed({ reviewedAt: iso(1) }, NOW, false), true);
});
test('świeże: brak daty sprawdzenia, nieczytelna data i data z przyszłości nigdy nie są świeże', () => {
  assert.equal(isFreshlyReviewed({}, NOW), false);
  assert.equal(isFreshlyReviewed({ reviewedAt: 'nie-data' }, NOW), false);
  assert.equal(isFreshlyReviewed({ reviewedAt: iso(-2) }, NOW), false);
});
test('toMillis: ISO, liczba, Timestamp Firestore (toMillis i seconds), śmieci', () => {
  assert.equal(toMillis(iso(1)), NOW - DAY);
  assert.equal(toMillis(5), 5);
  assert.equal(toMillis({ toMillis: () => 7 }), 7);
  assert.equal(toMillis({ seconds: 3 }), 3000);
  assert.equal(toMillis(null), null);
  assert.equal(toMillis(''), null);
  assert.equal(toMillis({}), null);
});
test('kolejność: od najnowszej sprawdzonej, bez daty na końcu, stabilnie', () => {
  const t = [{ id: 'a', reviewedAt: iso(5) }, { id: 'n1' }, { id: 'b', reviewedAt: iso(1) }, { id: 'n2' }, { id: 'c', reviewedAt: iso(9) }];
  assert.deepEqual(sortNewestReviewed(t).map((x) => x.id), ['b', 'a', 'c', 'n1', 'n2']);
  const before = t.map((x) => x.id).join();
  sortNewestReviewed(t);
  assert.equal(t.map((x) => x.id).join(), before, 'nie zmienia wejścia');
});
test('widoczne: 0 / 1 / 3 / 4+ prac', () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => i);
  assert.deepEqual(splitVisible(mk(0), false), { visible: [], older: [], hiddenCount: 0, canToggle: false });
  assert.deepEqual(splitVisible(mk(1), false).visible, [0]);
  const three = splitVisible(mk(3), true);
  assert.equal(three.canToggle, false); assert.deepEqual(three.older, []);
  const four = splitVisible(mk(4), false);
  assert.deepEqual(four.visible, [0, 1, 2]); assert.equal(four.hiddenCount, 1); assert.deepEqual(four.older, []);
  const ten = splitVisible(mk(10), true);
  assert.equal(ten.hiddenCount, 7); assert.equal(ten.older.length, 7); assert.equal(ten.canToggle, true);
});
test('tytuł: przedrostek znika, ale nie gdy zostałby pusty', () => {
  assert.equal(stripHomeworkPrefix('Praca domowa: Past Simple'), 'Past Simple');
  assert.equal(stripHomeworkPrefix('praca domowa – Conditionals'), 'Conditionals');
  assert.equal(stripHomeworkPrefix('Homework: Phrasal verbs'), 'Phrasal verbs');
  assert.equal(stripHomeworkPrefix('Praca domowa:'), 'Praca domowa:');
  assert.equal(stripHomeworkPrefix('Praca domowa po lekcji 3'), 'Praca domowa po lekcji 3');
  assert.equal(stripHomeworkPrefix(undefined), '');
});
test('data po polsku DD.MM.RRRR, bez godziny; brak daty → pusty napis', () => {
  assert.equal(formatReviewDate('2026-10-10T08:30:00.000Z'), '10.10.2026');
  assert.equal(formatReviewDate(undefined), '');
  assert.equal(formatReviewDate('xx'), '');
});
test('ton wyniku z progów 85/50 i brak tonu bez oceny', () => {
  assert.equal(gradeTone(90), 'success'); assert.equal(gradeTone(70), 'warn'); assert.equal(gradeTone(20), 'danger'); assert.equal(gradeTone(undefined), null);
});
test('ekran: kafelki zamiast jednego kontenera, bez nowych zapisów do bazy (tylko istniejące feedbackReadByStudent)', () => {
  const src = readFileSync(new URL('../components/dashboard/StudentHomeworkScreen.tsx', import.meta.url), 'utf8');
  assert.match(src, /<GradedHomeworkTiles/);
  assert.equal((src.match(/feedbackReadByStudent: true/g) || []).length >= 2, true);
  const tiles = readFileSync(new URL('../components/dashboard/GradedHomeworkTiles.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(tiles, /firebase|updateDoc|setDoc/);
  assert.match(tiles, /aria-expanded/);
  assert.match(tiles, /motion-reduce/);
});
