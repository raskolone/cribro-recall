import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isJunkIsoTopic,
  formatLessonDateDDMMYYYY,
  getDisplayLessonTopic,
} from '../utils/lessonDisplay';
import { LessonRecord } from '../types';

describe('utils/lessonDisplay', () => {
  describe('isJunkIsoTopic', () => {
    it('wykrywa surowy znacznik ISO z godziną doklejony do imienia', () => {
      assert.equal(isJunkIsoTopic('Milena Sesniak - 2026-09-16T06:30:00.000Z'), true);
    });

    it('wykrywa temat będący wyłącznie datą', () => {
      assert.equal(isJunkIsoTopic('2026-09-16'), true);
    });

    it('nie oznacza realnego tematu jako śmieciowego', () => {
      assert.equal(isJunkIsoTopic('Present Perfect vs Past Simple'), false);
    });

    it('pusty/brakujący temat jest śmieciowy', () => {
      assert.equal(isJunkIsoTopic(''), true);
      assert.equal(isJunkIsoTopic(undefined), true);
    });
  });

  describe('getDisplayLessonTopic — hierarchia', () => {
    it('1. Zwraca realny topic bez zmian', () => {
      const record: Partial<LessonRecord> = {
        topic: 'Business English — negocjacje',
        date: '2026-09-16',
      };
      assert.equal(getDisplayLessonTopic(record), 'Business English — negocjacje');
    });

    it('2. Gdy topic jest śmieciowym ISO, bierze pierwszą linijkę streszczenia (Blok 1)', () => {
      const record: Partial<LessonRecord> = {
        topic: 'Milena Sesniak - 2026-09-16T06:30:00.000Z',
        date: '2026-09-16',
        lessonSummary: 'Rozmawialiśmy o negocjacjach handlowych.\nDrugi wiersz.',
      };
      assert.equal(
        getDisplayLessonTopic(record),
        'Rozmawialiśmy o negocjacjach handlowych.'
      );
    });

    it('2b. Przycina pierwszą linijkę streszczenia do 60 znaków', () => {
      const longLine = 'A'.repeat(80);
      const record: Partial<LessonRecord> = {
        topic: '',
        date: '2026-09-16',
        lessonSummary: longLine,
      };
      const result = getDisplayLessonTopic(record);
      assert.equal(result.length, 61); // 60 znaków + wielokropek
      assert.ok(result.endsWith('…'));
    });

    it('3. Gdy brak topic i streszczenia, używa nazwy kursanta oczyszczonej z ISO', () => {
      const record: Partial<LessonRecord> = {
        topic: '2026-09-16',
        date: '2026-09-16',
        studentName: 'Dorota Komar-Janiszek (Media Saturn) - 2026-09-16T06:30:00.000Z',
      };
      assert.equal(getDisplayLessonTopic(record), 'Dorota Komar-Janiszek (Media Saturn)');
    });

    it('3b. Używa fallbackStudentName, gdy record.studentName brak', () => {
      const record: Partial<LessonRecord> = {
        topic: '',
        date: '2026-09-16',
      };
      assert.equal(
        getDisplayLessonTopic(record, 'Jan Kowalski'),
        'Jan Kowalski'
      );
    });

    it('4. Ostateczny fallback to "Lekcja z dnia DD.MM.YYYY"', () => {
      const record: Partial<LessonRecord> = {
        topic: '',
        date: '2026-09-16',
      };
      assert.equal(getDisplayLessonTopic(record), `Lekcja z dnia ${formatLessonDateDDMMYYYY('2026-09-16')}`);
    });

    it('Zupełny brak danych zwraca "Lekcja bez tematu"', () => {
      assert.equal(getDisplayLessonTopic(null), 'Lekcja bez tematu');
      assert.equal(getDisplayLessonTopic({}), 'Lekcja bez tematu');
    });
  });
});
