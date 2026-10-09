// Kafelek akcji w nagłówku kursanta: wejście do „Ćwiczeń dowolnych" jest widoczne zawsze
// (z pracą domową i bez), a praca domowa wygląda i działa jak dotąd.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).customElements = dom.window.customElements;
(globalThis as any).getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import test, { afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import i18n from '../i18n';
import StudentHeroAction from '../components/dashboard/StudentHeroAction';
import FreePracticeEntry from '../components/dashboard/FreePracticeEntry';

// i18n inicjalizuje się asynchronicznie — bez czekania pierwszy render kończy się aktualizacją poza act().
before(async () => {
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
});

afterEach(() => cleanup());

const tasks = [
  { id: 't1', title: 'Past Simple — powtórka', dueDate: '2026-10-20' },
  { id: 't2', title: 'Phrasal verbs', dueDate: undefined },
];

const setup = (pendingTasks: typeof tasks, language: 'pl' | 'en' = 'pl') => {
  const calls = { homework: [] as Array<string | undefined>, free: 0 };
  const utils = render(
    <StudentHeroAction
      pendingTasks={pendingTasks}
      language={language}
      onOpenHomework={(id) => calls.homework.push(id)}
      onOpenFreePractice={() => calls.free++}
    />,
  );
  return { ...utils, calls, entries: () => utils.queryAllByTestId('free-practice-entry') };
};

test('bez żadnej pracy domowej: wejście widoczne, informacja „nic nie czeka", brak kafelka pracy', () => {
  const { entries, queryByTestId, getByTestId, container } = setup([]);
  assert.equal(entries().length, 1);
  assert.ok(getByTestId('hero-no-homework'));
  assert.equal(queryByTestId('hero-homework-card'), null);
  assert.ok(container.textContent!.includes('Brak nowych zadań od lektora'));
  assert.ok(container.textContent!.includes('Ćwiczenia dowolne'));
  assert.equal(container.textContent!.includes('Wykonaj ćwiczenia'), false, 'stary przycisk zastąpiony wejściem');
});

test('z pracą domową: kafelek pracy bez zmian i to samo wejście obok', () => {
  const { entries, getByTestId, queryByTestId, container } = setup(tasks);
  assert.equal(entries().length, 1, 'jedno wejście, nie dwa');
  assert.equal(queryByTestId('hero-no-homework'), null);
  const card = getByTestId('hero-homework-card');
  const text = card.textContent!;
  assert.ok(text.includes('Zadania od lektora'));
  assert.ok(text.includes('2 zadania'));
  assert.ok(text.includes('Past Simple — powtórka'), 'pokazuje najnowszą pracę');
  assert.ok(text.includes('Termin:'));
  assert.ok(text.includes('Rozwiąż zadania'));
  assert.ok(container.textContent!.includes('Ćwiczenia dowolne'));
});

test('praca domowa nadal otwiera się kliknięciem kafelka i dostaje id najnowszej pracy', () => {
  const { getByTestId, calls } = setup(tasks);
  fireEvent.click(getByTestId('hero-homework-card'));
  assert.deepEqual(calls.homework, ['t1']);
  assert.equal(calls.free, 0);
});

test('kliknięcie wejścia otwiera Ćwiczenia dowolne i NIE rusza pracy domowej (z pracą i bez)', () => {
  for (const pending of [tasks, []]) {
    const { entries, calls } = setup(pending);
    fireEvent.click(entries()[0]);
    assert.equal(calls.free, 1);
    assert.deepEqual(calls.homework, [], 'wejście nie jest częścią kafelka pracy');
    cleanup();
  }
});

test('wejście to przycisk dostępny z klawiatury z czytelną nazwą i opisem, bez ozdobnych ikon w nazwie', () => {
  const { entries } = setup([]);
  const entry = entries()[0];
  assert.equal(entry.tagName, 'BUTTON');
  assert.equal(entry.getAttribute('type'), 'button');
  assert.match(entry.textContent!, /Ćwiczenia dowolne/);
  assert.match(entry.textContent!, /bez pracy domowej/);
  for (const icon of Array.from(entry.querySelectorAll('svg'))) assert.equal(icon.getAttribute('aria-hidden'), 'true');
});

test('wersja angielska: wejście i kafelek pracy przełączają język', async () => {
  await i18n.changeLanguage('en');
  try {
    const { container, getByTestId } = setup(tasks, 'en');
    assert.ok(getByTestId('hero-homework-card').textContent!.includes('Teacher assignments'));
    assert.ok(container.textContent!.includes('Free practice'));
    cleanup();
    const empty = setup([], 'en');
    assert.ok(empty.container.textContent!.includes('No new homework from your teacher'));
  } finally {
    cleanup(); // odmontować przed zmianą języka — inaczej aktualizacja leci poza act()
    await i18n.changeLanguage('pl');
  }
});

test('FreePracticeEntry samodzielnie: wywołuje onOpen raz na kliknięcie', () => {
  let opened = 0;
  const { getByTestId } = render(<FreePracticeEntry onOpen={() => opened++} />);
  fireEvent.click(getByTestId('free-practice-entry'));
  fireEvent.click(getByTestId('free-practice-entry'));
  assert.equal(opened, 2);
});
