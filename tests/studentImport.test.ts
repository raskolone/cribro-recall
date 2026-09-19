import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeParsedLessons, normalizeStudentImportAnalysis } from '../utils/studentImportNormalize';

/**
 * "Smart Student Onboarding": analiza pliku z profilem i historią lekcji
 * nowego kursanta. Model bywa niekonsekwentny w wyznaczaniu status/missingFields,
 * więc te testy pilnują, że to my ustalamy je deterministycznie — nie model.
 */

const TODAY = '2026-09-19';

test('pełne dane bez braków dają status READY', () => {
  const analysis = normalizeStudentImportAnalysis({
    extractedData: {
      fullName: 'Jan Kowalski',
      email: 'jan.kowalski@example.com',
      level: 'B1',
      historicalLessons: [],
    },
    aiComment: 'Znaleziono kompletny profil.',
  }, TODAY);

  assert.equal(analysis.status, 'READY');
  assert.equal(analysis.missingFields.length, 0);
  assert.equal(analysis.extractedData.fullName, 'Jan Kowalski');
  assert.equal(analysis.extractedData.email, 'jan.kowalski@example.com');
  assert.equal(analysis.extractedData.level, 'B1');
});

test('brak e-maila i imienia to krytyczne braki i NEEDS_REVIEW', () => {
  const analysis = normalizeStudentImportAnalysis({
    extractedData: { historicalLessons: [] },
    aiComment: 'Brak podstawowych danych.',
  }, TODAY);

  assert.equal(analysis.status, 'NEEDS_REVIEW');
  const fields = analysis.missingFields.map((f) => f.field);
  assert.ok(fields.includes('fullName'));
  assert.ok(fields.includes('email'));
  assert.ok(analysis.missingFields.every((f) => f.field !== 'fullName' && f.field !== 'email' ? true : f.severity === 'critical'));
});

test('niepoprawny format e-maila jest odrzucany jak brak', () => {
  const analysis = normalizeStudentImportAnalysis({
    extractedData: { fullName: 'Jan Kowalski', email: 'nie-to-jest-email', historicalLessons: [] },
    aiComment: '',
  }, TODAY);

  assert.equal(analysis.extractedData.email, undefined);
  assert.ok(analysis.missingFields.some((f) => f.field === 'email'));
});

test('poziom spoza CEFR jest pomijany, a brak poziomu to tylko ostrzeżenie', () => {
  const analysis = normalizeStudentImportAnalysis({
    extractedData: { fullName: 'Jan Kowalski', email: 'jan@example.com', level: 'zaawansowany', historicalLessons: [] },
    aiComment: '',
  }, TODAY);

  assert.equal(analysis.extractedData.level, undefined);
  const levelIssue = analysis.missingFields.find((f) => f.field === 'level');
  assert.equal(levelIssue?.severity, 'warning');
  // Brak poziomu nie może sam z siebie zablokować zapisu (nie jest krytyczny).
  assert.equal(analysis.status, 'READY');
});

test('data lekcji bez roku dostaje dateAmbiguous i nie blokuje statusu', () => {
  const lessons = normalizeParsedLessons([
    { date: '15 maja', summary: 'Present Perfect', vocabulary: [], corrections: [] },
  ], TODAY);

  assert.equal(lessons[0].dateAmbiguous, true);

  const analysis = normalizeStudentImportAnalysis({
    extractedData: {
      fullName: 'Jan Kowalski',
      email: 'jan@example.com',
      level: 'B1',
      historicalLessons: [{ date: '15 maja', summary: 'Present Perfect', vocabulary: [], corrections: [] }],
    },
    aiComment: '',
  }, TODAY);

  assert.equal(analysis.status, 'READY');
  assert.ok(analysis.missingFields.some((f) => f.field === 'lessonDates' && f.severity === 'warning'));
});

test('data lekcji w formacie ISO nie jest oznaczana jako niepewna', () => {
  const lessons = normalizeParsedLessons([
    { date: '2024-03-12', summary: 'Past Simple', vocabulary: ['deadline - termin'], corrections: [] },
  ], TODAY);

  assert.equal(lessons[0].date, '2024-03-12');
  assert.equal(lessons[0].dateAmbiguous, false);
});

test('pusta lekcja (bez treści) jest odrzucana', () => {
  const lessons = normalizeParsedLessons([
    { date: '2024-03-12', summary: '', vocabulary: [], corrections: [] },
    { date: '2024-03-13', summary: 'Business English', vocabulary: [], corrections: [] },
  ], TODAY);

  assert.equal(lessons.length, 1);
  assert.equal(lessons[0].summary, 'Business English');
});

test('brak jakiejkolwiek daty w lekcji ustawia dzisiejszą datę i dateAmbiguous', () => {
  const lessons = normalizeParsedLessons([
    { date: '', summary: 'Rozmowa kwalifikacyjna', vocabulary: [], corrections: [] },
  ], TODAY);

  assert.equal(lessons[0].date, TODAY);
  assert.equal(lessons[0].dateAmbiguous, true);
});

test('historicalLessons jako coś innego niż tablica nie wywala funkcji', () => {
  const lessons = normalizeParsedLessons(undefined, TODAY);
  assert.deepEqual(lessons, []);
});

test('vocabulary/corrections nie-tekstowe elementy są odfiltrowane', () => {
  const lessons = normalizeParsedLessons([
    { date: '2024-03-12', summary: 'Test', vocabulary: [123, null, '  ', 'ok - ok'], corrections: [456] },
  ], TODAY);

  assert.deepEqual(lessons[0].vocabulary, ['123', 'ok - ok']);
  assert.deepEqual(lessons[0].corrections, ['456']);
});

test('brak wywołania z payloadem, który nie jest obiektem, nie crashuje', () => {
  const analysis = normalizeStudentImportAnalysis(null, TODAY);
  assert.equal(analysis.status, 'NEEDS_REVIEW');
  assert.deepEqual(analysis.extractedData.historicalLessons, []);
});
