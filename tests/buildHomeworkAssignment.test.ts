import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHomeworkAssignment, formatStudentLabel } from '../utils/buildHomeworkAssignment';
import { taskOwnerFields } from '../utils/homework';
import { HOMEWORK_TYPE_LABELS } from '../services/homeworkGenerator';
import { warmupFieldEntry } from '../utils/warmupField';
import { warmupCardsFieldEntry } from '../utils/warmupCards';
import { HomeworkType, User } from '../types';

// Dokładna replika logiki sprzed wyciągnięcia (z HomeworkComposer.tsx linie 598-628)
function legacyInlineBuilder(params: {
  student: User | null;
  studentId: string;
  title: string;
  usable: Array<{ type: HomeworkType }>;
  items: any[];
  dueDate: string;
  nowIso: string;
  finalWarmup?: any;
  finalCards?: any;
  accessToken: string;
  accessExpiresAt: string;
  accessUrl: string;
}) {
  const {
    student,
    studentId,
    title,
    usable,
    items,
    dueDate,
    nowIso,
    finalWarmup,
    finalCards,
    accessToken,
    accessExpiresAt,
    accessUrl,
  } = params;

  const studentLabel = (s: User): string => {
    const name = `${s.firstName || ''} ${s.lastName || ''}`.trim();
    return name || s.username || s.email || s.id;
  };

  return {
    ...taskOwnerFields(studentId),
    studentName: student ? studentLabel(student) : 'Kursant',
    studentEmail: student?.email || '',
    studentUsername: student?.username || '',
    title,
    type: usable[0].type,
    types: usable.map((section) => section.type),
    instructions: usable
      .map((section) => HOMEWORK_TYPE_LABELS[section.type].hint.pl)
      .join(' '),
    createdAt: nowIso,
    dueDate,
    status: 'pending' as const,
    sentences: items,
    ...warmupFieldEntry(finalWarmup),
    ...warmupCardsFieldEntry(finalCards),
    manualEmailConfirmationRequired: true,
    skipAutoEmail: true,
    emailNotificationSent: false,
    accessToken,
    accessExpiresAt,
    accessUrl,
  };
}

test('GOLDEN: buildHomeworkAssignment produkuje dokładnie identyczny dokument jak legacy HomeworkComposer', () => {
  const mockStudent: User = {
    id: 'usr_student_123',
    firstName: 'Jan',
    lastName: 'Kowalski',
    username: 'jankowalski',
    email: 'jan@example.com',
    role: 'user',
  };

  const usable = [
    { type: 'translation' as HomeworkType },
    { type: 'find_errors' as HomeworkType },
  ];

  const items = [
    { id: '1', polish: 'To jest test', english: 'This is a test', type: 'translation' },
    { id: '2', incorrectSentence: 'She go home', correctSentence: 'She goes home', type: 'find_errors' },
  ];

  const nowIso = '2026-10-10T12:00:00.000Z';
  const dueDate = '2026-10-17';
  const token = 'hw_test_token_456';
  const expiresAt = '2026-10-24T12:00:00.000Z';
  const origin = 'https://app.maciej.pro';
  const accessUrl = `${origin}/hw?token=${token}`;

  const warmup = [
    { chunks: ['I', 'love', 'tests'], correctSentence: 'I love tests', polishTranslation: 'Kocham testy' },
  ];
  const warmupCards = [
    { front: 'test', back: 'badanie / sprawdzian' },
  ];

  const legacyResult = legacyInlineBuilder({
    student: mockStudent,
    studentId: mockStudent.id,
    title: 'Praca domowa: Present Simple',
    usable,
    items,
    dueDate,
    nowIso,
    finalWarmup: warmup,
    finalCards: warmupCards,
    accessToken: token,
    accessExpiresAt: expiresAt,
    accessUrl,
  });

  const newResult = buildHomeworkAssignment({
    student: mockStudent,
    studentId: mockStudent.id,
    title: 'Praca domowa: Present Simple',
    usable,
    items,
    dueDate,
    createdAt: nowIso,
    finalWarmup: warmup,
    finalCards: warmupCards,
    token,
    accessExpiresAt: expiresAt,
    origin,
    includeToken: true,
  });

  assert.deepStrictEqual(newResult, legacyResult);
});

test('GOLDEN fallback: brak studenta, brak kart i rozgrzewki daje identyczny fallback w obu wersjach', () => {
  const usable = [{ type: 'multiple_choice' as HomeworkType }];
  const items = [{ id: '1', question: 'Q?', options: ['A', 'B'], correctIndex: 0, type: 'multiple_choice' }];
  const nowIso = '2026-10-10T15:00:00.000Z';
  const dueDate = '2026-10-15';
  const token = 'hw_abc_789';
  const expiresAt = '2026-10-24T15:00:00.000Z';
  const origin = 'https://app.maciej.pro';
  const accessUrl = `${origin}/hw?token=${token}`;

  const legacyResult = legacyInlineBuilder({
    student: null,
    studentId: 'anon_student_999',
    title: 'Quiz',
    usable,
    items,
    dueDate,
    nowIso,
    finalWarmup: undefined,
    finalCards: undefined,
    accessToken: token,
    accessExpiresAt: expiresAt,
    accessUrl,
  });

  const newResult = buildHomeworkAssignment({
    student: null,
    studentId: 'anon_student_999',
    title: 'Quiz',
    usable,
    items,
    dueDate,
    createdAt: nowIso,
    finalWarmup: undefined,
    finalCards: undefined,
    token,
    accessExpiresAt: expiresAt,
    origin,
    includeToken: true,
  });

  assert.deepStrictEqual(newResult, legacyResult);
  assert.equal(newResult.studentName, 'Kursant');
  assert.equal(newResult.studentEmail, '');
  assert.equal(newResult.studentUid, 'anon_student_999');
  assert.equal(newResult.status, 'pending');
});

test('seria: includeToken=false nie generuje tokenu ani accessUrl', () => {
  const result = buildHomeworkAssignment({
    studentId: 's1',
    title: 'Zadanie z serii',
    usable: [{ type: 'translation' as HomeworkType }],
    items: [{ id: '1', polish: 'Pies', english: 'Dog' }],
    dueDate: '2026-10-20',
    includeToken: false,
  });

  assert.equal('accessToken' in result, false);
  assert.equal('accessExpiresAt' in result, false);
  assert.equal('accessUrl' in result, false);
  assert.equal(result.status, 'pending');
  assert.equal(result.studentUid, 's1');
  assert.equal(result.skipAutoEmail, true);
  assert.equal(result.manualEmailConfirmationRequired, true);
});

test('seria: przełącznik autoEmail=true ustawia flagi wysyłki automatycznej', () => {
  const result = buildHomeworkAssignment({
    studentId: 's1',
    title: 'Zadanie z serii z mailem',
    usable: [{ type: 'translation' as HomeworkType }],
    items: [{ id: '1', polish: 'Kot', english: 'Cat' }],
    dueDate: '2026-10-20',
    includeToken: false,
    skipAutoEmail: false,
    manualEmailConfirmationRequired: false,
    emailNotificationSent: false,
  });

  assert.equal(result.skipAutoEmail, false);
  assert.equal(result.manualEmailConfirmationRequired, false);
  assert.equal(result.emailNotificationSent, false);
});
