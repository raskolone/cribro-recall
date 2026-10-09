import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
});
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
});
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).customElements = dom.window.customElements;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { TeacherReviewModal } from '../components/dashboard/TeacherReviewModal';
import { SpecialTask } from '../types';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '<div id="root"></div>';
  document.body.style.overflow = '';
});

const mockTask: SpecialTask = {
  id: 'task-123',
  title: 'Czasy przeszłe — Past Simple vs Present Perfect',
  status: 'submitted',
  type: 'translation',
  studentId: 'stud-1',
  studentName: 'Jan Kowalski',
  createdAt: '2026-10-08T10:00:00Z',
  submittedAt: '2026-10-09T08:30:00Z',
  sentences: [
    {
      polishSentence: 'Wczoraj kupiłem nowy samochód.',
      correctSentence: 'Yesterday I bought a new car.',
      hint: 'Pamiętaj o nieregularnym buy - bought.',
    },
    {
      polishSentence: 'Nigdy nie byłem w Londynie.',
      correctSentence: 'I have never been to London.',
    },
  ],
  studentAnswers: {
    0: 'Yesterday I buyed a new car.',
    1: 'I have never been to London.',
  },
  evaluationResults: [
    {
      score: 70,
      explanation: 'Użyto złej formy przeszłej dla czasownika buy (powinno być bought).',
    },
    {
      score: 100,
      explanation: 'Zdanie bezbłędne.',
    },
  ],
};

describe('TeacherReviewModal (Widok sprawdzania pracy domowej)', () => {
  test('1. Render do document.body: nagłówek, stopka i treść obecne; panel NIE jest potomkiem kontenera sekcji', () => {
    const rootContainer = document.getElementById('root')!;
    const sectionElement = document.createElement('section');
    sectionElement.className = 'glass-tile rounded-2xl overflow-hidden';
    rootContainer.appendChild(sectionElement);

    const { getByTestId, queryByTestId } = render(
      <TeacherReviewModal
        isOpen={true}
        task={mockTask}
        studentName="Jan Kowalski"
        onClose={() => {}}
      />,
      { container: sectionElement }
    );

    const overlay = document.body.querySelector('[data-testid="teacher-review-overlay"]') as HTMLElement;
    const dialog = document.body.querySelector('[data-testid="teacher-review-dialog"]') as HTMLElement;
    const scrollContainer = document.body.querySelector('[data-testid="teacher-review-scroll-container"]') as HTMLElement;
    const footer = document.body.querySelector('[data-testid="teacher-review-footer"]') as HTMLElement;

    assert.ok(overlay, 'Overlay musi istnieć w DOM');
    assert.ok(dialog, 'Dialog musi istnieć w DOM');

    // Panel nie może być potomkiem sectionElement (glass-tile z overflow-hidden i backdrop-filter)
    assert.equal(sectionElement.contains(overlay), false, 'Overlay nie może być potomkiem sekcji glass-tile');
    assert.equal(sectionElement.contains(dialog), false, 'Dialog nie może być potomkiem sekcji glass-tile');
    assert.equal(document.body.contains(overlay), true, 'Overlay musi być potomkiem document.body');
    assert.equal(sectionElement.querySelector('[data-testid="teacher-review-dialog"]'), null, 'Sekcja nie zawiera dialogu');

    // Nagłówek, przewijana treść i stopka obecne
    assert.ok(dialog.querySelector('header'), 'Nagłówek jest obecny');
    assert.ok(scrollContainer, 'Przewijany kontener środkowy jest obecny');
    assert.ok(footer, 'Stała stopka jest obecna');

    // Tytuł i kursant
    assert.ok(dialog.textContent?.includes('Czasy przeszłe'));
    assert.ok(dialog.textContent?.includes('Jan Kowalski'));
  });

  test('2. Esc i klik w tło zamykają modal; kliknięcie wewnątrz panelu NIE zamyka', () => {
    let closedCount = 0;
    const handleClose = () => {
      closedCount += 1;
    };

    const { getByTestId } = render(
      <TeacherReviewModal
        isOpen={true}
        task={mockTask}
        studentName="Jan Kowalski"
        onClose={handleClose}
      />
    );

    const overlay = getByTestId('teacher-review-overlay');
    const dialog = getByTestId('teacher-review-dialog');

    // Klik w dialog nie zamyka
    fireEvent.mouseDown(dialog);
    assert.equal(closedCount, 0, 'Klik w treść nie może wywołać onClose');

    // Klik w tło (overlay) zamyka
    fireEvent.mouseDown(overlay);
    assert.equal(closedCount, 1, 'Klik w tło musi wywołać onClose');

    // Esc zamyka
    fireEvent.keyDown(overlay, { key: 'Escape' });
    assert.equal(closedCount, 2, 'Klawisz Escape musi wywołać onClose');
  });

  test('3. Blokada i przywrócenie body overflow po zamknięciu', () => {
    document.body.style.overflow = 'auto';

    const { unmount } = render(
      <TeacherReviewModal
        isOpen={true}
        task={mockTask}
        studentName="Jan Kowalski"
        onClose={() => {}}
      />
    );

    assert.equal(document.body.style.overflow, 'hidden', 'Otwarty modal blokuje scroll body');

    unmount();

    assert.equal(document.body.style.overflow, 'auto', 'Po zamknięciu modalu overflow body wraca do pierwotnego stanu');
  });

  test('4. Mapowanie statusu w nagłówku: pokazuje czytelną etykietę po polsku, nie surowe "submitted"', () => {
    const { getByTestId, rerender } = render(
      <TeacherReviewModal
        isOpen={true}
        task={{ ...mockTask, status: 'submitted' }}
        onClose={() => {}}
      />
    );

    const dialog = getByTestId('teacher-review-dialog');
    assert.ok(dialog.textContent?.includes('Do sprawdzenia'), 'submitted mapuje na "Do sprawdzenia"');

    rerender(
      <TeacherReviewModal
        isOpen={true}
        task={{ ...mockTask, status: 'graded' }}
        onClose={() => {}}
      />
    );
    assert.ok(dialog.textContent?.includes('Sprawdzona'), 'graded mapuje na "Sprawdzona"');

    rerender(
      <TeacherReviewModal
        isOpen={true}
        task={{ ...mockTask, status: 'custom_status_xyz' as any }}
        onClose={() => {}}
      />
    );
    assert.ok(dialog.textContent?.includes('custom_status_xyz'), 'Nieznany status jest pokazywany jak dotąd');
  });

  test('5. Przyciski oceny widoczne niezależnie od liczby zadań (test strukturalny stopki poza przewijaną częścią)', () => {
    // Utwórz zadanie z 40 pytaniami
    const longSentences = Array.from({ length: 40 }, (_, i) => ({
      polishSentence: `Zdanie testowe numer ${i + 1}`,
      correctSentence: `Test sentence number ${i + 1}`,
    }));

    const longTask: SpecialTask = {
      ...mockTask,
      sentences: longSentences,
      studentAnswers: {},
    };

    let saved = false;
    let analyzed = false;

    const { getByTestId } = render(
      <TeacherReviewModal
        isOpen={true}
        task={longTask}
        onClose={() => {}}
        onSaveReview={() => { saved = true; }}
        onAnalyzeWithAI={() => { analyzed = true; }}
      />
    );

    const scrollContainer = getByTestId('teacher-review-scroll-container');
    const footer = getByTestId('teacher-review-footer');
    const saveBtn = getByTestId('teacher-review-save-btn');
    const aiBtn = getByTestId('teacher-review-ai-btn');
    const closeBtn = getByTestId('teacher-review-close-footer-btn');

    // Stopka i przyciski akcji są POZA kontenerem przewijanym (sibling)
    assert.equal(scrollContainer.contains(footer), false, 'Stopka nie może być dzieckiem kontenera przewijanego');
    assert.equal(scrollContainer.contains(saveBtn), false, 'Przycisk zapisu oceny nie może być w przewijanej części');
    assert.equal(scrollContainer.contains(aiBtn), false, 'Przycisk propozycji AI nie może być w przewijanej części');

    assert.equal(footer.contains(saveBtn), true, 'Przycisk zapisu oceny znajduje się w stałej stopce');
    assert.equal(footer.contains(aiBtn), true, 'Przycisk propozycji AI znajduje się w stałej stopce');
    assert.equal(footer.contains(closeBtn), true, 'Przycisk zamknięcia znajduje się w stałej stopce');

    // Kliknięcie działa bez względu na przewinięcie
    fireEvent.click(saveBtn);
    assert.equal(saved, true);
    fireEvent.click(aiBtn);
    assert.equal(analyzed, true);
  });

  test('6. a11y: role="dialog", aria-modal="true" i aria-labelledby wskazujące na tytuł', () => {
    const { getByTestId } = render(
      <TeacherReviewModal
        isOpen={true}
        task={mockTask}
        onClose={() => {}}
      />
    );

    const dialog = getByTestId('teacher-review-dialog');
    assert.equal(dialog.getAttribute('role'), 'dialog');
    assert.equal(dialog.getAttribute('aria-modal'), 'true');

    const labelledBy = dialog.getAttribute('aria-labelledby');
    assert.ok(labelledBy, 'aria-labelledby musi być ustawione');

    const titleEl = document.getElementById(labelledBy!);
    assert.ok(titleEl, 'Element wskazany przez aria-labelledby musi istnieć');
    assert.ok(titleEl!.textContent?.includes('Czasy przeszłe'));
  });

  test('7. Przywrócenie fokusu na element otwierający po zamknięciu modalu', async () => {
    const openButton = document.createElement('button');
    openButton.textContent = 'Sprawdź / Oceń';
    document.body.appendChild(openButton);
    openButton.focus();
    assert.equal(document.activeElement, openButton, 'Przycisk otwierający ma początkowy fokus');

    const { unmount } = render(
      <TeacherReviewModal
        isOpen={true}
        task={mockTask}
        onClose={() => {}}
      />
    );

    unmount();

    assert.equal(document.activeElement, openButton, 'Fokus wraca na przycisk otwierający po odmontowaniu modalu');
  });

  test('8. Render v2: stały przycisk Zamknij w stopce', () => {
    let closed = false;
    const { getByTestId } = render(
      <TeacherReviewModal
        isOpen={true}
        task={{ ...mockTask, id: '', engineVersion: 2 }}
        isV2={true}
        onClose={() => { closed = true; }}
      />
    );

    const footer = getByTestId('teacher-review-footer');
    const closeBtn = getByTestId('teacher-review-close-footer-btn');

    assert.equal(footer.contains(closeBtn), true, 'Stopka v2 zawiera przycisk Zamknij');
    fireEvent.click(closeBtn);
    assert.equal(closed, true, 'Kliknięcie w Zamknij wywołuje onClose');
  });
});



