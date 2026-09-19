import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  approveTranscriptLesson,
  buildTranscriptLessonPrompt,
  parseTranscriptLesson,
  TranscriptLessonError,
} from '../utils/transcriptLesson';
import { isStudentVisibleLesson } from '../utils/lessonBlocks';

/**
 * Transkrypcja → cztery bloki lekcji.
 *
 * Testowana jest treść polecenia dla modelu i rozbiór jego odpowiedzi —
 * bez sieci i bez modelu. To jest ta część, która decyduje, czy lekcja
 * z transkrypcji wygląda dla reszty aplikacji identycznie jak lekcja
 * z Notion; gdyby nie wyglądała, fiszki i prace domowe czytałyby puste pola.
 */

const full = JSON.stringify({
  topic: 'Praca i codzienne dojazdy',
  summary: 'Rozmowa o tygodniu i o dojazdach do pracy.',
  vocabulary: 'commute — dojeżdżać\nrush hour — godziny szczytu',
  corrections: 'I was commuting a lot → I commuted a lot (past simple)',
  homework: '1. Dojeżdżam do pracy pociągiem.\n2. Unikam godzin szczytu.',
  answerKey: '1. I commute to work by train.\n2. I avoid rush hour.',
  nextLesson: 'Powtórzyć past simple, wprowadzić present perfect.',
  learningCurve: 'Mówi śmielej niż tydzień temu, unika czasów przeszłych.',
});

describe('polecenie dla modelu', () => {
  it('niesie zapis rozmowy i kontekst kursanta', () => {
    const prompt = buildTranscriptLessonPrompt({
      transcript: 'Teacher: how was your week?',
      studentName: 'Ala Kowalska',
      level: 'B1',
      date: '2026-09-13',
      topic: 'Small talk',
    });

    assert.match(prompt, /Teacher: how was your week\?/);
    assert.match(prompt, /Ala Kowalska/);
    assert.match(prompt, /B1/);
    assert.match(prompt, /2026-09-13/);
    assert.match(prompt, /Small talk/);
  });

  it('bez kontekstu nie zostawia pustych etykiet', () => {
    const prompt = buildTranscriptLessonPrompt({ transcript: 'cokolwiek' });

    assert.doesNotMatch(prompt, /Kursant:\s*$/m);
    assert.doesNotMatch(prompt, /Poziom kursanta:/);
    assert.doesNotMatch(prompt, /Data lekcji:/);
  });

  it('prosi o wszystkie cztery bloki kontraktu', () => {
    const prompt = buildTranscriptLessonPrompt({ transcript: 'x' });

    for (const field of ['summary', 'vocabulary', 'corrections', 'homework', 'answerKey', 'nextLesson']) {
      assert.match(prompt, new RegExp(`"${field}"`), `brak pola ${field}`);
    }
  });
});

describe('rozbiór odpowiedzi modelu', () => {
  it('wypełnia bloki i pola płaskie tą samą treścią', () => {
    const update = parseTranscriptLesson(full);

    assert.equal(update.topic, 'Praca i codzienne dojazdy');
    assert.equal(update.structuredBlocks?.vocabulary, 'commute — dojeżdżać\nrush hour — godziny szczytu');
    // Część ekranów czyta pola płaskie wprost, bez extractLessonBlocks.
    assert.equal(update.vocabularyText, update.structuredBlocks?.vocabulary);
    assert.equal(update.lessonSummary, update.structuredBlocks?.summary);
    assert.equal(update.homeworkText, update.structuredBlocks?.homework);
    assert.equal(update.homeworkAnswerKey, update.structuredBlocks?.answerKey);
    assert.equal(update.nextLessonPlan, update.structuredBlocks?.nextLesson);
    assert.equal(update.studentSpeaking, update.structuredBlocks?.learningCurve);
  });

  it('nie publikuje lekcji kursantowi przy samym wygenerowaniu', () => {
    const update = parseTranscriptLesson(full);

    // Wygenerowanie bloków to nie zatwierdzenie — zatwierdza człowiek.
    assert.equal(update.sessionStatus, undefined);
    assert.equal(update.status, undefined);
    assert.equal(update.isPendingConfirmation, undefined);
  });

  it('brakujące pola stają się pustymi łańcuchami, nie zniknięciem pól', () => {
    const update = parseTranscriptLesson(
      JSON.stringify({ summary: 'Krótka rozmowa.', vocabulary: 'word — słowo' })
    );

    assert.equal(update.structuredBlocks?.homework, '');
    assert.equal(update.structuredBlocks?.nextLesson, '');
  });

  it('odmawia, gdy model nie zwrócił ani podsumowania, ani słownictwa', () => {
    // Cztery puste bloki wyglądają w panelu jak udany wynik — a nie są.
    assert.throws(
      () => parseTranscriptLesson(JSON.stringify({ topic: 'Cokolwiek', homework: '1. Zdanie.' })),
      TranscriptLessonError
    );
  });

  it('odmawia na odpowiedzi, która nie jest JSON-em', () => {
    assert.throws(() => parseTranscriptLesson('Oto twoja lekcja:'), TranscriptLessonError);
  });

  it('liczby i obiekty w polach tekstowych nie przechodzą jako treść', () => {
    const update = parseTranscriptLesson(
      JSON.stringify({ summary: 'Rozmowa.', vocabulary: 'a — b', homework: 42, nextLesson: { a: 1 } })
    );

    assert.equal(update.structuredBlocks?.homework, '');
    assert.equal(update.structuredBlocks?.nextLesson, '');
  });

  it('wypełnia trzy ustrukturyzowane sekcje historii kursanta obok pól tekstowych', () => {
    const update = parseTranscriptLesson(
      JSON.stringify({
        summary: 'Rozmowa o dojazdach.',
        vocabulary: 'commute — dojeżdżać',
        corrections: '❌ I was commuting a lot → ✅ I commuted a lot — past simple',
        summaryPoints: ['Rozmawialiśmy o dojazdach do pracy.', 'Przećwiczyliśmy past simple.', 'Wprowadziliśmy nowe słownictwo.'],
        vocabularyItems: [
          {
            term: 'commute',
            translation: 'dojeżdżać',
            contextSentence: 'I commute to work by train.',
            category: 'general',
          },
        ],
        areasForImprovement: [
          {
            originalError: 'I was commuting a lot',
            correctedForm: 'I commuted a lot',
            ruleExplanation: 'Past simple do zakończonych czynności w przeszłości.',
          },
        ],
      })
    );

    assert.deepEqual(update.summaryPoints, [
      'Rozmawialiśmy o dojazdach do pracy.',
      'Przećwiczyliśmy past simple.',
      'Wprowadziliśmy nowe słownictwo.',
    ]);
    assert.deepEqual(update.vocabularyItems, [
      { term: 'commute', translation: 'dojeżdżać', contextSentence: 'I commute to work by train.', category: 'general' },
    ]);
    assert.deepEqual(update.areasForImprovement, [
      {
        originalError: 'I was commuting a lot',
        correctedForm: 'I commuted a lot',
        ruleExplanation: 'Past simple do zakończonych czynności w przeszłości.',
      },
    ]);
  });

  it('pomija niekompletne pozycje ustrukturyzowane i nie ustawia pustych tablic', () => {
    const update = parseTranscriptLesson(
      JSON.stringify({
        summary: 'Rozmowa.',
        vocabulary: 'a — b',
        vocabularyItems: [{ term: 'word' /* brak translation */ }, { term: 'ok', translation: 'dobrze', category: 'nonsense' }],
        areasForImprovement: [{ originalError: 'x' /* brak correctedForm */ }],
        summaryPoints: ['', '   '],
      })
    );

    assert.equal(update.summaryPoints, undefined);
    assert.equal(update.areasForImprovement, undefined);
    assert.deepEqual(update.vocabularyItems, [
      { term: 'ok', translation: 'dobrze', contextSentence: '' },
    ]);
  });
});

describe('zatwierdzenie lekcji przez lektora', () => {
  it('zdejmuje wszystkie flagi niewidoczności naraz', () => {
    const update = approveTranscriptLesson();

    assert.equal(update.sessionStatus, 'completed');
    assert.equal(update.status, 'confirmed');
    assert.equal(update.isPendingConfirmation, false);
    assert.equal(update.pendingReason, '');
  });

  it('po zatwierdzeniu lekcja jest widoczna dla kursanta', () => {
    // Ten test jest spojrzeniem z drugiej strony: po zatwierdzeniu
    // isStudentVisibleLesson musi przepuścić lekcję, inaczej lektor
    // zatwierdza w panelu coś, czego kursant nadal nie widzi.
    const record = {
      date: '2026-09-13',
      topic: 'Praca i dojazdy',
      vocabularyText: 'commute — dojeżdżać',
      source: 'live_transcript' as const,
      liveTranscript: 'Teacher: ...',
      ...approveTranscriptLesson(),
    };

    assert.equal(isStudentVisibleLesson(record), true);
  });
});
