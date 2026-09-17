import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deriveLessonWorkflowStatus, getIsoDateOnly } from '../services/teacherCockpitService';
import { LessonRecord } from '../types';

describe('teacherCockpitService', () => {
  describe('deriveLessonWorkflowStatus', () => {
    it('respects explicitly set workflowStatus', () => {
      const lesson: Partial<LessonRecord> = {
        id: 'l1',
        workflowStatus: 'in_progress',
        date: '2026-09-17',
      };
      assert.equal(deriveLessonWorkflowStatus(lesson as LessonRecord), 'in_progress');
    });

    it('returns draft for pending confirmation lessons', () => {
      const lesson: Partial<LessonRecord> = {
        id: 'l2',
        isPendingConfirmation: true,
        date: '2026-09-17',
      };
      assert.equal(deriveLessonWorkflowStatus(lesson as LessonRecord), 'draft');
    });

    it('returns scheduled for future date lessons', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const isoFuture = futureDate.toISOString().split('T')[0];

      const lesson: Partial<LessonRecord> = {
        id: 'l3',
        date: isoFuture,
      };
      assert.equal(deriveLessonWorkflowStatus(lesson as LessonRecord), 'scheduled');
    });

    it('returns completed when vocabulary and summary are empty for past lessons', () => {
      const pastDate = '2026-01-10';
      const lesson: Partial<LessonRecord> = {
        id: 'l4',
        date: pastDate,
        topic: 'Business English meeting',
        vocabularyText: '',
      };
      assert.equal(deriveLessonWorkflowStatus(lesson as LessonRecord), 'completed');
    });

    it('returns closed when lesson has full content and vocabulary', () => {
      const pastDate = '2026-01-10';
      const lesson: Partial<LessonRecord> = {
        id: 'l5',
        date: pastDate,
        topic: 'Business English meeting',
        vocabularyText: 'negotiate - negocjować\noutcome - rezultat',
        lessonSummary: 'Omówiliśmy techniki negocjacji.',
      };
      assert.equal(deriveLessonWorkflowStatus(lesson as LessonRecord), 'closed');
    });
  });

  describe('getIsoDateOnly', () => {
    it('handles null and undefined', () => {
      assert.equal(getIsoDateOnly(null), '');
      assert.equal(getIsoDateOnly(undefined), '');
    });

    it('formats YYYY-MM-DD string correctly', () => {
      assert.equal(getIsoDateOnly('2026-09-17'), '2026-09-17');
    });

    it('formats full ISO string correctly', () => {
      assert.equal(getIsoDateOnly('2026-09-17T14:30:00.000Z'), '2026-09-17');
    });

    it('formats Date instance correctly', () => {
      const d = new Date(2026, 8, 17); // month is 0-indexed: 8 = Sept
      const res = getIsoDateOnly(d);
      assert.match(res, /^2026-09-1/);
    });
  });
});
