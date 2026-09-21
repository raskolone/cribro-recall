import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanMarkdownArtifacts,
  extractLessonBlocks,
  isRecordNeedsCleanup,
  migrateRecordToBlocks,
  parseNumberedItems,
  splitHomeworkAndAnswerKey,
  isLessonPendingConfirmation,
  isStudentVisibleLesson,
  findDuplicatePendingLessons,
} from '../utils/lessonBlocks';
import { LessonRecord } from '../types';

describe('utils/lessonBlocks', () => {
  it('cleanMarkdownArtifacts zdejmuje znaczniki ~~~markdown oraz ```', () => {
    const raw = '~~~markdown\n1. Pierwsze zdanie.\n2. Drugie zdanie.\n~~~';
    const cleaned = cleanMarkdownArtifacts(raw);
    assert.equal(cleaned, '1. Pierwsze zdanie.\n2. Drugie zdanie.');
  });

  it('splitHomeworkAndAnswerKey dzieli zadanie na treść i klucz odpowiedzi', () => {
    const raw = `Blok 1 — zdania do przetłumaczenia
1. Firma poinformowała klientów o wycieku danych.
2. Zawsze włączam uwierzytelnianie dwuskładnikowe.

Answer Key
Blok 2 — odpowiedzi:
1. The company informed customers about data breach.
2. I always enable two-factor authentication.`;

    const result = splitHomeworkAndAnswerKey(raw);
    assert.ok(result.homework.includes('Firma poinformowała klientów'));
    assert.ok(result.answerKey);
    assert.ok(result.answerKey.includes('The company informed customers'));
  });

  it('extractLessonBlocks poprawnie rozbija surowy wpis ze zrzutu ekranu kursanta', () => {
    const rawScreenshotSample: Partial<LessonRecord> = {
      topic: 'Cybersecurity & Privacy in the AI Era',
      date: '2026-09-07',
      lessonSummary: 'Omówienie wycieków danych, prywatności i szyfrowania.',
      vocabularyText: 'data breach - wyciek danych\nencryption - szyfrowanie',
      thingsToImprove: `Corrections:
- Say: "two weeks later", not "after two weeks".

Zadanie z lekcji:
Zadanie domowe — format obowiązkowy
Blok 1 — zdania do przetłumaczenia
~~~markdown
1. Firma poinformowała klientów o wycieku danych dopiero po dwóch tygodniach.
1. Zawsze włączam uwierzytelnianie dwuskładnikowe na ważnych kontach.
~~~
Answer Key
Blok 2 — odpowiedzi:
~~~markdown
1. The company only informed customers about the data breach two weeks later.
1. I always enable two-factor authentication on important accounts.
~~~`,
      suggestedFollowUp: 'Dalsza analiza phishing attacks na kolejnej lekcji.',
      studentSpeaking: 'Kursant chętnie dzielił się doświadczeniami z pracy w IT.',
    };

    const blocks = extractLessonBlocks(rawScreenshotSample);

    // Blok 1
    assert.equal(blocks.summary, 'Omówienie wycieków danych, prywatności i szyfrowania.');
    // Blok 2a
    assert.equal(blocks.vocabulary, 'data breach - wyciek danych\nencryption - szyfrowanie');
    // Blok 2b: Korekty nie zawierają zadań domowych!
    assert.ok(blocks.corrections.includes('two weeks later'));
    assert.ok(!blocks.corrections.includes('Zadanie domowe'));
    assert.ok(!blocks.corrections.includes('Answer Key'));

    // Blok 3: Zadanie domowe zawiera zdania bez markdown fence
    assert.ok(blocks.homework.includes('Firma poinformowała klientów'));
    assert.ok(!blocks.homework.includes('~~~markdown'));

    // Answer Key jest wyodrębniony
    assert.ok(blocks.answerKey);
    assert.ok(blocks.answerKey.includes('The company only informed customers'));
    assert.ok(!blocks.answerKey.includes('~~~markdown'));

    // Blok 4
    assert.equal(blocks.nextLesson, 'Dalsza analiza phishing attacks na kolejnej lekcji.');
    // Learning curve
    assert.equal(blocks.learningCurve, 'Kursant chętnie dzielił się doświadczeniami z pracy w IT.');
  });

  it('isRecordNeedsCleanup wykrywa zanieczyszczone wpisy historyczne', () => {
    const dirtyRecord = {
      id: 'l-1',
      studentId: 's-1',
      date: '2026-09-07',
      topic: 'Cybersecurity',
      vocabularyText: 'test',
      thingsToImprove: 'Zadanie z lekcji:\nZadanie domowe\n~~~markdown\n1. zdanie',
      createdAt: '',
      updatedAt: '',
    } as LessonRecord;

    const cleanRecord = {
      id: 'l-2',
      studentId: 's-1',
      date: '2026-09-07',
      topic: 'Cybersecurity',
      vocabularyText: 'test',
      corrections: 'Watch pronunciation of "threat"',
      homeworkText: '1. Translate sentence',
      homeworkAnswerKey: '1. Translated',
      createdAt: '',
      updatedAt: '',
    } as LessonRecord;

    assert.equal(isRecordNeedsCleanup(dirtyRecord), true);
    assert.equal(isRecordNeedsCleanup(cleanRecord), false);
  });

  it('migrateRecordToBlocks tworzy zaktualizowany rekord bez utraty danych', () => {
    const dirtyRecord = {
      id: 'l-1',
      studentId: 's-1',
      date: '2026-09-07',
      topic: 'Cybersecurity',
      vocabularyText: 'phishing - wyłudzanie danych',
      lessonSummary: 'Wstęp do cybersecurity.',
      thingsToImprove: 'Poprawić wymowę słowa authentication.\n\nZadanie z lekcji:\n1. Przetłumacz: To był phishing.',
      createdAt: '2026-09-07T10:00:00Z',
      updatedAt: '2026-09-07T10:00:00Z',
    } as LessonRecord;

    const migrated = migrateRecordToBlocks(dirtyRecord);

    assert.equal(migrated.lessonSummary, 'Wstęp do cybersecurity.');
    assert.equal(migrated.corrections, 'Poprawić wymowę słowa authentication.');
    assert.equal(migrated.thingsToImprove, 'Poprawić wymowę słowa authentication.');
    assert.ok(migrated.homeworkText?.includes('To był phishing'));
    assert.ok(migrated.structuredBlocks);
  });

  it('parseNumberedItems wyciąga czyste elementy bez punktorów', () => {
    const text = '1. Zdanie pierwsze.\n2) Zdanie drugie.\n- Zdanie trzecie.';
    const items = parseNumberedItems(text);
    assert.deepEqual(items, ['Zdanie pierwsze.', 'Zdanie drugie.', 'Zdanie trzecie.']);
  });

  it('extractLessonBlocks poprawnie rozbija cały tekst Notion zrzucony do jednego pola', () => {
    const allInOneRecord: Partial<LessonRecord> = {
      topic: 'AI Ethics & Workplace Automation',
      date: '2026-09-08',
      thingsToImprove: `1. Lekcja w skrócie
Konwersacje na temat etyki sztucznej inteligencji i automatyzacji pracy.

2. Key Language & Corrections
Nowe:
- accountability - odpowiedzialność
- bias - stronniczość
Corrections:
- Say: "two months ago", not "before two months".

3. Homework — Cribro Habit
1. Przetłumacz: AI zrewolucjonizuje rynek pracy.
Answer Key:
1. AI will revolutionize the job market.

4. Next Lesson
Dalsza dyskusja o regulacjach prawnych UE (AI Act).`,
    };

    const blocks = extractLessonBlocks(allInOneRecord);

    assert.ok(blocks.summary.includes('etyki sztucznej inteligencji'));
    assert.ok(blocks.vocabulary.includes('accountability'));
    assert.ok(blocks.vocabulary.includes('bias'));
    assert.ok(blocks.corrections.includes('two months ago'));
    assert.ok(blocks.homework.includes('AI zrewolucjonizuje rynek pracy'));
    assert.ok(blocks.answerKey?.includes('AI will revolutionize'));
    assert.ok(blocks.nextLesson.includes('AI Act'));
  });

  it('isLessonPendingConfirmation flaguje wybrakowane wpisy i wpisy z brakującą datą', () => {
    // 1. Jawna flaga
    assert.equal(isLessonPendingConfirmation({ status: 'pending_confirmation', date: '2026-09-07' }), true);
    assert.equal(isLessonPendingConfirmation({ isPendingConfirmation: true, date: '2026-09-07' }), true);
    assert.equal(isLessonPendingConfirmation({ isDateMissing: true, date: '2026-09-07' }), true);
    assert.equal(isLessonPendingConfirmation({ status: 'rejected', date: '2026-09-07' }), true);

    // 2. Tytuł ze zrzutu ekranu Notion z brakiem daty
    const sampleScreenshotRecord: Partial<LessonRecord> = {
      topic: 'Podsumowanie lekcji — brak daty — Cybersecurity & Privacy in the AI Era',
      date: '2026-09-07',
      lessonSummary: 'Omówienie wycieków danych.',
    };
    assert.equal(isLessonPendingConfirmation(sampleScreenshotRecord), true);

    // 3. Niepoprawna lub pusta data
    assert.equal(isLessonPendingConfirmation({ topic: 'Legal English', date: '' }), true);
    assert.equal(isLessonPendingConfirmation({ topic: 'Legal English', date: 'brak daty' }), true);

    // 4. Pusty import Notion
    assert.equal(isLessonPendingConfirmation({ topic: 'Empty lesson', date: '2026-09-07', source: 'notion', vocabularyText: '', lessonSummary: '' }), true);

    // 5. Prawidłowy rekord potwierdzony
    const validRecord: Partial<LessonRecord> = {
      topic: 'Cybersecurity & Privacy in the AI Era',
      date: '2026-09-07',
      status: 'confirmed',
      lessonSummary: 'Lekcja o cyberbezpieczeństwie',
      vocabularyText: 'breach - naruszenie',
    };
    assert.equal(isLessonPendingConfirmation(validRecord), false);
  });

  it('isStudentVisibleLesson blokuje niezatwierdzone lekcje przed kurstantem', () => {
    const pendingRecord: Partial<LessonRecord> = {
      topic: 'Podsumowanie lekcji — brak daty — Cybersecurity & Privacy in the AI Era',
      date: '2026-09-07',
      isPendingConfirmation: true,
    };
    assert.equal(isStudentVisibleLesson(pendingRecord), false);

    const rejectedRecord: Partial<LessonRecord> = {
      topic: 'Odrzucona lekcja',
      date: '2026-09-07',
      status: 'rejected',
    };
    assert.equal(isStudentVisibleLesson(rejectedRecord), false);

    const confirmedRecord: Partial<LessonRecord> = {
      topic: 'Cybersecurity & Privacy in the AI Era',
      date: '2026-09-07',
      status: 'confirmed',
      lessonSummary: 'Podsumowanie',
      vocabularyText: 'słownictwo',
    };
    assert.equal(isStudentVisibleLesson(confirmedRecord), true);
  });

  it('findDuplicatePendingLessons znajduje wpisy Weryfikacja z tego samego dnia co potwierdzona lekcja tego kursanta', () => {
    const confirmed: Partial<LessonRecord> = {
      id: 'confirmed-1',
      studentId: 'student-a',
      topic: 'Business English',
      date: '2026-09-16',
      status: 'confirmed',
      lessonSummary: 'Podsumowanie',
      vocabularyText: 'słownictwo',
    };
    const danglingPending: Partial<LessonRecord> = {
      id: 'pending-1',
      studentId: 'student-a',
      topic: 'Milena Sesniak - 2026-09-16T06:30:00.000Z',
      date: '2026-09-16',
      isPendingConfirmation: true,
    };
    const unrelatedPendingOtherDay: Partial<LessonRecord> = {
      id: 'pending-2',
      studentId: 'student-a',
      topic: 'Podsumowanie lekcji — brak daty — coś',
      date: '2026-09-20',
      isPendingConfirmation: true,
    };
    const pendingOtherStudent: Partial<LessonRecord> = {
      id: 'pending-3',
      studentId: 'student-b',
      topic: 'Inny kursant',
      date: '2026-09-16',
      isPendingConfirmation: true,
    };

    const duplicates = findDuplicatePendingLessons([
      confirmed,
      danglingPending,
      unrelatedPendingOtherDay,
      pendingOtherStudent,
    ]);

    assert.deepEqual(duplicates.map((d) => d.id), ['pending-1']);
  });

  it('findDuplicatePendingLessons nie rusza wpisów bez potwierdzonej lekcji tego dnia', () => {
    const onlyPending: Partial<LessonRecord> = {
      id: 'pending-solo',
      studentId: 'student-a',
      topic: 'Solo pending',
      date: '2026-09-16',
      isPendingConfirmation: true,
    };
    assert.deepEqual(findDuplicatePendingLessons([onlyPending]), []);
  });
});

// ———————————— Lekcje z transkrypcji (Cribro Sift) ————————————

describe('lekcje z transkrypcji (Cribro Sift)', () => {
  const base = {
    date: '2026-09-13',
    topic: 'Small talk',
    vocabularyText: 'commute',
    source: 'live_transcript' as const,
    liveTranscript: 'Teacher: ... Student: ...',
  };

  it('nie trafia do kursanta, dopóki lektor jej nie domknie', () => {
    // Świeżo przysłana — surowy zapis rozmowy, kursant nie widzi.
    assert.equal(isStudentVisibleLesson({ ...base, sessionStatus: 'draft' }), false);
    // W trakcie lekcji — tym bardziej nie.
    assert.equal(isStudentVisibleLesson({ ...base, sessionStatus: 'live' }), false);
    // Bez etapu w ogóle — traktujemy jak niedomkniętą.
    assert.equal(isStudentVisibleLesson(base), false);
  });

  it('domknięta przez lektora jest widoczna', () => {
    assert.equal(isStudentVisibleLesson({ ...base, sessionStatus: 'completed' }), true);
  });

  it('lekcje z Notion nie zmieniły widoczności przy okazji', () => {
    assert.equal(
      isStudentVisibleLesson({
        date: '2026-09-13',
        topic: 'Past simple',
        vocabularyText: 'used to',
        source: 'notion',
      }),
      true
    );
  });
});
