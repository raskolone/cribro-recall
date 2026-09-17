import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateNextInterval,
  INTERVAL_DAYS_MAP,
  addDaysToDate,
} from '../services/recallService';

describe('Spaced Repetition (Recall Engine)', () => {
  it('INTERVAL_DAYS_MAP ma zdefiniowane progi od poziomu 0 do 5', () => {
    assert.strictEqual(INTERVAL_DAYS_MAP[0], 0);
    assert.strictEqual(INTERVAL_DAYS_MAP[1], 1);
    assert.strictEqual(INTERVAL_DAYS_MAP[2], 3);
    assert.strictEqual(INTERVAL_DAYS_MAP[3], 7);
    assert.strictEqual(INTERVAL_DAYS_MAP[4], 14);
    assert.strictEqual(INTERVAL_DAYS_MAP[5], 30);
  });

  it('addDaysToDate poprawnie dodaje dni i obsługuje przejście miesiąca', () => {
    assert.strictEqual(addDaysToDate('2026-09-17', 1), '2026-09-18');
    assert.strictEqual(addDaysToDate('2026-09-17', 14), '2026-10-01');
    assert.strictEqual(addDaysToDate('2026-09-30', 3), '2026-10-03');
  });

  it('ocena "hard" resetuje interwał do poziomu 1 (powtórka jutro)', () => {
    const baseDate = '2026-09-17';
    const resultFromLvl4 = calculateNextInterval(4, 'hard', baseDate);
    assert.strictEqual(resultFromLvl4.nextLevel, 1);
    assert.strictEqual(resultFromLvl4.nextReviewDate, '2026-09-18');

    const resultFromLvl0 = calculateNextInterval(0, 'hard', baseDate);
    assert.strictEqual(resultFromLvl0.nextLevel, 1);
    assert.strictEqual(resultFromLvl0.nextReviewDate, '2026-09-18');
  });

  it('ocena "good" podnosi poziom o 1 aż do poziomu 5 (maksymalnego)', () => {
    const baseDate = '2026-09-17';

    const res1 = calculateNextInterval(0, 'good', baseDate);
    assert.strictEqual(res1.nextLevel, 1);
    assert.strictEqual(res1.nextReviewDate, '2026-09-18'); // 1 dzień

    const res2 = calculateNextInterval(1, 'good', baseDate);
    assert.strictEqual(res2.nextLevel, 2);
    assert.strictEqual(res2.nextReviewDate, '2026-09-20'); // 3 dni

    const res3 = calculateNextInterval(4, 'good', baseDate);
    assert.strictEqual(res3.nextLevel, 5);
    assert.strictEqual(res3.nextReviewDate, '2026-10-17'); // 30 dni

    const res4 = calculateNextInterval(5, 'good', baseDate);
    assert.strictEqual(res4.nextLevel, 5); // Nie przekracza 5
    assert.strictEqual(res4.nextReviewDate, '2026-10-17');
  });

  it('ocena "easy" podnosi poziom o 2 z limitem 5', () => {
    const baseDate = '2026-09-17';

    const res1 = calculateNextInterval(0, 'easy', baseDate);
    assert.strictEqual(res1.nextLevel, 2);
    assert.strictEqual(res1.nextReviewDate, '2026-09-20');

    const res2 = calculateNextInterval(2, 'easy', baseDate);
    assert.strictEqual(res2.nextLevel, 4);
    assert.strictEqual(res2.nextReviewDate, '2026-10-01');

    const res3 = calculateNextInterval(4, 'easy', baseDate);
    assert.strictEqual(res3.nextLevel, 5);
    assert.strictEqual(res3.nextReviewDate, '2026-10-17');
  });
});
