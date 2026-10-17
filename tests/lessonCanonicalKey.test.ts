import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCanonicalLessonRecordId,
  isLessonVocabularySet,
  getLessonSetAliases,
  areLessonSetAliases,
  deduplicateFlashcardSets,
  compareLessonSetsNewestFirst,
} from '../utils/lessonCanonicalKey';
import { FlashcardSet, StudySession } from '../types';

test('A) getCanonicalLessonRecordId: prawidłowe wyznaczanie klucza dla wszystkich formatów ID', () => {
  // 1. Wirtualne ID z lessonRecords (prefiksy lesson_)
  assert.equal(
    getCanonicalLessonRecordId('lesson_7ff9e99b-2628-4502-80b2-5b8834284636'),
    '7ff9e99b-2628-4502-80b2-5b8834284636'
  );
  assert.equal(
    getCanonicalLessonRecordId('lesson_lesson-1792227283563-569854'),
    'lesson-1792227283563-569854'
  );

  // 2. Fizyczne ID z bazy Firestore /sets (set-lesson- z UUID)
  assert.equal(
    getCanonicalLessonRecordId('set-lesson-7ff9e99b-2628-4502-80b2-5b8834284636'),
    '7ff9e99b-2628-4502-80b2-5b8834284636'
  );

  // 3. Fizyczne ID z bazy Firestore /sets (set-lesson-lesson-...)
  assert.equal(
    getCanonicalLessonRecordId('set-lesson-lesson-1792227283563-569854'),
    'lesson-1792227283563-569854'
  );

  // 4. Bezpośrednie pole lessonRecordId na obiekcie (priorytet)
  assert.equal(
    getCanonicalLessonRecordId('set-custom-something', { lessonRecordId: 'lesson-custom-123' }),
    'lesson-custom-123'
  );

  // 5. Historyczny format set-lesson-<timestamp> dopasowany po dacie i temacie z lekcji
  const knownLessons = [
    { id: 'lesson-1785949714244', date: '2026-08-05', topic: 'Silo and Fallout: Safety, Freedom' },
    { id: 'lesson-1785854172295', date: '2026-08-04', topic: 'Codzienne nawyki i jedzenie' },
    { id: 'lesson-1785854064199', date: '2026-07-28', topic: 'Motivation and Communication' },
  ];

  assert.equal(
    getCanonicalLessonRecordId('set-lesson-1785949714914', {
      lessonTopic: 'Silo and Fallout: Safety, Freedom',
      lessonDate: '2026-08-05',
      knownLessonRecords: knownLessons,
    }),
    'lesson-1785949714244'
  );

  assert.equal(
    getCanonicalLessonRecordId('set-lesson-1785854174197', {
      lessonTopic: 'Codzienne nawyki i jedzenie',
      lessonDate: '2026-08-04',
      knownLessonRecords: knownLessons,
    }),
    'lesson-1785854172295'
  );

  // 6. Jeśli klucza nie da się dopasować dla zestawu nie-lekcyjnego, zwraca null
  assert.equal(getCanonicalLessonRecordId('set-1789372119099-qi52a5kmc'), null);
  assert.equal(getCanonicalLessonRecordId('gen-b1-travel'), null);
  assert.equal(getCanonicalLessonRecordId('basket'), null);
  assert.equal(getCanonicalLessonRecordId(null), null);
});

test('A) areLessonSetAliases: poprawne rozpoznawanie aliasów tej samej lekcji', () => {
  // Para z problemu użytkownika: Powtarzanie Present Simple
  assert.equal(
    areLessonSetAliases(
      'set-lesson-lesson-1792227283563-569854',
      'lesson_lesson-1792227283563-569854'
    ),
    true
  );

  // Para z problemu użytkownika: Digital Tools
  assert.equal(
    areLessonSetAliases(
      'set-lesson-7ff9e99b-2628-4502-80b2-5b8834284636',
      'lesson_7ff9e99b-2628-4502-80b2-5b8834284636'
    ),
    true
  );

  // Stara sesja z prefixem vocab-
  assert.equal(
    areLessonSetAliases(
      'vocab-81ba7016-ac26-44d5-9960-d9f5a33e7ca4',
      'set-lesson-81ba7016-ac26-44d5-9960-d9f5a33e7ca4'
    ),
    true
  );

  // Różne lekcje nie są aliasami
  assert.equal(
    areLessonSetAliases(
      'set-lesson-7ff9e99b-2628-4502-80b2-5b8834284636',
      'set-lesson-81ba7016-ac26-44d5-9960-d9f5a33e7ca4'
    ),
    false
  );
});

test('B) deduplicateFlashcardSets: pary lekcji redukują się do 1 pozycji, preferując zestaw z bazy (/sets)', () => {
  const dbSets: FlashcardSet[] = [
    {
      id: 'set-lesson-lesson-1792227283563-569854',
      userId: 'u1',
      title: 'Powtarzanie Present Simple (wszystkie formy)',
      isLessonVocabulary: true,
      cardCount: 14,
      createdAt: '2026-10-17T08:54:44.772Z',
      lessonDate: '2024-05-16',
      lessonTopic: 'Powtarzanie Present Simple (wszystkie formy)',
    } as any,
    {
      id: 'set-lesson-7ff9e99b-2628-4502-80b2-5b8834284636',
      userId: 'u1',
      title: 'Digital Tools, Focus & Everyday Choices',
      isLessonVocabulary: true,
      cardCount: 5,
      createdAt: '2026-09-13T16:46:42.047Z',
      lessonDate: '2026-09-11',
      lessonTopic: 'Digital Tools, Focus & Everyday Choices',
    } as any,
    // Zestaw własny użytkownika (nie-lekcyjny)
    {
      id: 'set-custom-own-1',
      userId: 'u1',
      title: 'Mój prywatny zestaw słówek',
      isLessonVocabulary: false,
      cardCount: 10,
      createdAt: '2026-09-14T07:48:39.569Z',
    } as any,
  ];

  const virtualLessonSets: FlashcardSet[] = [
    {
      id: 'lesson_lesson-1792227283563-569854',
      userId: 'u1',
      title: 'Powtarzanie Present Simple (wszystkie formy)',
      isLessonVocabulary: true,
      cardCount: 14,
      createdAt: '2024-05-16',
      lessonDate: '2024-05-16',
      lessonTopic: 'Powtarzanie Present Simple (wszystkie formy)',
      flashcards: Array(14).fill({ term: 'w', definition: 't' }) as any,
    } as any,
    {
      id: 'lesson_7ff9e99b-2628-4502-80b2-5b8834284636',
      userId: 'u1',
      title: 'Digital Tools, Focus & Everyday Choices',
      isLessonVocabulary: true,
      cardCount: 5,
      createdAt: '2026-09-11',
      lessonDate: '2026-09-11',
      lessonTopic: 'Digital Tools, Focus & Everyday Choices',
      flashcards: Array(5).fill({ term: 'w2', definition: 't2' }) as any,
    } as any,
  ];

  const result = deduplicateFlashcardSets(dbSets, virtualLessonSets);

  // Oczekujemy 3 zestawów: 2 deduplikowane lekcje + 1 własny
  assert.equal(result.length, 3);

  // Sprawdzamy czy został zestaw z bazy (/sets)
  const psSet = result.find((s) => s.title.includes('Present Simple'));
  assert.ok(psSet);
  assert.equal(psSet.id, 'set-lesson-lesson-1792227283563-569854', 'Preferowany zestaw z bazy');
  assert.equal(psSet.flashcards?.length, 14, 'Wzbogacony o flashcards z zestawu wirtualnego');

  const dtSet = result.find((s) => s.title.includes('Digital Tools'));
  assert.ok(dtSet);
  assert.equal(dtSet.id, 'set-lesson-7ff9e99b-2628-4502-80b2-5b8834284636', 'Preferowany zestaw z bazy');
  assert.equal(dtSet.flashcards?.length, 5);

  const customSet = result.find((s) => s.id === 'set-custom-own-1');
  assert.ok(customSet, 'Zestaw własny nie-lekcyjny pozostał nienaruszony');
});

test('B) deduplicateFlashcardSets: singletony wirtualne i z bazy zostają zachowane', () => {
  const dbSets: FlashcardSet[] = [
    {
      id: 'set-lesson-singleton-db',
      userId: 'u1',
      title: 'Lekcja tylko w bazie',
      isLessonVocabulary: true,
      cardCount: 7,
    } as any,
  ];

  const virtualSets: FlashcardSet[] = [
    {
      id: 'lesson_singleton-virtual',
      userId: 'u1',
      title: 'Lekcja tylko wirtualna',
      isLessonVocabulary: true,
      cardCount: 8,
    } as any,
  ];

  const result = deduplicateFlashcardSets(dbSets, virtualSets);
  assert.equal(result.length, 2);
  assert.ok(result.some((s) => s.id === 'set-lesson-singleton-db'));
  assert.ok(result.some((s) => s.id === 'lesson_singleton-virtual'));
});

test('C) Agregacja sesji: sesje zapisane z różnych aliasów liczą się wspólnie', () => {
  const canonId = 'lesson-1792227283563-569854';
  const targetSetId = 'set-lesson-lesson-1792227283563-569854';

  const mockSessions: StudySession[] = [
    // Sesja zarejestrowana na ID z bazy
    { id: 's1', setId: 'set-lesson-lesson-1792227283563-569854', scorePercent: 100, completedAt: new Date('2026-10-17T08:40:00Z') } as any,
    // Sesja zarejestrowana na ID wirtualne
    { id: 's2', setId: 'lesson_lesson-1792227283563-569854', scorePercent: 80, completedAt: new Date('2026-10-17T08:50:00Z') } as any,
    // Sesja innej lekcji
    { id: 's3', setId: 'set-lesson-other-999', scorePercent: 50 } as any,
  ];

  const matched = mockSessions.filter((s) => s.setId === targetSetId || areLessonSetAliases(s.setId, targetSetId));
  assert.equal(matched.length, 2);
  assert.deepEqual(matched.map((m) => m.id), ['s1', 's2']);
});

test('D) Stabilność numeracji lekcji: dodanie nowej lekcji nie zmienia numerów wcześniejszych lekcji', () => {
  const lessonsT1 = [
    { id: 'lesson-1', date: '2024-05-16', topic: 'Present Simple' },
    { id: 'lesson-2', date: '2026-07-28', topic: 'Motivation' },
    { id: 'lesson-3', date: '2026-08-04', topic: 'Nawyki' },
  ];

  const numbersT1 = new Map<string, number>();
  [...lessonsT1]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach((l, idx) => numbersT1.set(l.id, idx + 1));

  assert.equal(numbersT1.get('lesson-1'), 1);
  assert.equal(numbersT1.get('lesson-2'), 2);
  assert.equal(numbersT1.get('lesson-3'), 3);

  // T2: Dodajemy nową lekcję (najnowszą z 2026-10-17)
  const lessonsT2 = [
    ...lessonsT1,
    { id: 'lesson-4', date: '2026-10-17', topic: 'Nowa lekcja' },
  ];

  const numbersT2 = new Map<string, number>();
  [...lessonsT2]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach((l, idx) => numbersT2.set(l.id, idx + 1));

  // Numery wcześniejszych lekcji NIE ULEGAJĄ ZMIANIE!
  assert.equal(numbersT2.get('lesson-1'), 1, 'Lekcja 1 nadal ma numer 1');
  assert.equal(numbersT2.get('lesson-2'), 2, 'Lekcja 2 nadal ma numer 2');
  assert.equal(numbersT2.get('lesson-3'), 3, 'Lekcja 3 nadal ma numer 3');
  assert.equal(numbersT2.get('lesson-4'), 4, 'Nowa lekcja otrzymuje kolejny numer 4');
});

test('Deduplikacja: idempotentność — ponowne wywołanie zwraca ten sam wynik', () => {
  const dbSets: FlashcardSet[] = [
    { id: 'set-lesson-1', isLessonVocabulary: true, title: 'L1' } as any,
  ];
  const virtualSets: FlashcardSet[] = [
    { id: 'lesson_1', isLessonVocabulary: true, title: 'L1' } as any,
  ];

  const run1 = deduplicateFlashcardSets(dbSets, virtualSets);
  const run2 = deduplicateFlashcardSets(run1, virtualSets);

  assert.equal(run1.length, 1);
  assert.equal(run2.length, 1);
  assert.equal(run1[0].id, run2[0].id);
});

// --- VOCAB-DUP-4: utwardzenie heurystyki set-lesson-<timestamp> i kolejność ---

const lessonRec = (id: string, date: string, topic: string) => ({ id, date, topic });
const dbHistorical = (ts: string, date: string, topic: string, cards = 6) =>
  ({ id: `set-lesson-${ts}`, userId: 'u1', title: topic, isLessonVocabulary: true, cardCount: cards, createdAt: '2026-10-17T08:00:00.000Z', lessonDate: date, lessonTopic: topic }) as any as FlashcardSet;
const virtualLesson = (id: string, date: string, topic: string, n: number) =>
  ({ id: `lesson_${id}`, userId: 'u1', title: topic, isLessonVocabulary: true, cardCount: 5, createdAt: date, lessonDate: date, lessonTopic: topic, lessonNumber: n }) as any as FlashcardSet;

test('C-a) dwie lekcje o tym samym temacie i dacie + jeden stary zestaw: nie paruj, żadna lekcja nie znika', () => {
  const known = [
    lessonRec('lesson-1700000000000-aaaaaa', '2026-08-04', 'Codzienne nawyki'),
    lessonRec('lesson-1700000900000-bbbbbb', '2026-08-04', 'Codzienne nawyki'),
  ];
  const result = deduplicateFlashcardSets(
    [dbHistorical('1785854174197', '2026-08-04', 'Codzienne nawyki')],
    [virtualLesson(known[0].id, '2026-08-04', 'Codzienne nawyki', 1), virtualLesson(known[1].id, '2026-08-04', 'Codzienne nawyki', 2)],
    known
  );
  assert.equal(result.length, 3, 'dwie lekcje + osobny stary zestaw');
  const keys = result.map((s: any) => s.lessonRecordId);
  assert.ok(keys.includes('lesson-1700000000000-aaaaaa'));
  assert.ok(keys.includes('lesson-1700000900000-bbbbbb'));
  assert.ok(result.some((s) => s.id === 'set-lesson-1785854174197'));
});

test('C-b) jeden jednoznaczny kandydat: zestaw scala się z lekcją', () => {
  const known = [
    lessonRec('lesson-1785854172295', '2026-08-04', 'Codzienne nawyki i jedzenie'),
    lessonRec('lesson-1785949714244', '2026-08-05', 'Silo and Fallout'),
  ];
  const result = deduplicateFlashcardSets(
    [dbHistorical('1785854174197', '2026-08-04', 'Codzienne nawyki i jedzenie')],
    [virtualLesson(known[0].id, '2026-08-04', 'Codzienne nawyki i jedzenie', 1), virtualLesson(known[1].id, '2026-08-05', 'Silo and Fallout', 2)],
    known
  );
  assert.equal(result.length, 2);
  const merged = result.find((s: any) => s.lessonRecordId === 'lesson-1785854172295')!;
  assert.equal(merged.id, 'set-lesson-1785854174197', 'zostaje zestaw z bazy');
});

test('C-c) brak kandydata: zestaw zostaje, nic nie jest ukrywane', () => {
  const known = [lessonRec('lesson-1785949714244', '2026-08-05', 'Silo and Fallout')];
  const result = deduplicateFlashcardSets(
    [dbHistorical('1111111111111', '2025-01-02', 'Zupełnie inny temat')],
    [virtualLesson(known[0].id, '2026-08-05', 'Silo and Fallout', 1)],
    known
  );
  assert.equal(result.length, 2);
  assert.ok(result.some((s) => s.id === 'set-lesson-1111111111111'));
});

test('C-d) ten sam temat, inna data: to nie ten sam zestaw (data musi się zgadzać, gdy obie są znane)', () => {
  const id = getCanonicalLessonRecordId('set-lesson-1785854174197', {
    lessonTopic: 'Codzienne nawyki',
    lessonDate: '2026-08-04',
    knownLessonRecords: [lessonRec('lesson-1500000000000-x', '2026-01-01', 'Codzienne nawyki')],
  });
  assert.equal(id, '1785854174197');
});

test('C-e) aliasy po timestampie dotyczą tylko historycznego set-lesson-<ts>, nie dwóch lekcji obok siebie', () => {
  assert.equal(areLessonSetAliases('set-lesson-1785854174197', 'lesson_lesson-1785854172295'), true);
  assert.equal(areLessonSetAliases('lesson_lesson-1785854172295', 'lesson_lesson-1785854175000'), false);
});

test('D) kolejność: data lekcji malejąco, przy remisie numer lekcji malejąco', () => {
  const mk = (id: string, lessonDate: string, lessonNumber?: number, createdAt = '2026-10-17T08:00:00.000Z') =>
    ({ id, lessonDate, lessonNumber, createdAt }) as any as FlashcardSet;
  const sets = [mk('a', '2026-08-04', 1, '2026-10-17T09:00:00.000Z'), mk('b', '2026-09-11', 3), mk('c', '2026-09-11', 5), mk('d', '2026-10-16', 9), mk('e', '', undefined)];
  const order = [...sets].sort(compareLessonSetsNewestFirst).map((s) => s.id);
  assert.deepEqual(order, ['d', 'c', 'b', 'a', 'e']);
});
