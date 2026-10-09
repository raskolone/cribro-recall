// Render + interakcja dla masowego usuwania: okno potwierdzenia (ConfirmModal),
// pola wyboru w wierszu grupowym i w liście. Samo usuwanie testują czyste
// funkcje w homeworkBulkDelete.test.ts — tu nic nie dotyka Firestore.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).customElements = dom.window.customElements;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import '../i18n';
import HomeworkBulkDeleteDialog from '../components/dashboard/HomeworkBulkDeleteDialog';
import ConfirmModal from '../components/ui/ConfirmModal';
import HomeworkGroupRow from '../components/dashboard/HomeworkGroupRow';
import HomeworkTaskList from '../components/dashboard/HomeworkTaskList';
import { buildHomeworkRows, GroupHomeworkRow, HomeworkRow } from '../utils/groupHomeworkRows';
import { BulkDeleteItem, BulkSelectionState } from '../utils/homeworkBulkDelete';
import { SpecialTask } from '../types';

afterEach(() => cleanup());

const item = (key: string, over: Partial<BulkDeleteItem> = {}): BulkDeleteItem => ({
  key,
  kind: 'homework',
  id: key,
  title: `Praca ${key}`,
  studentName: `Kursant ${key}`,
  handedIn: false,
  ...over,
});

const noop = () => {};
const dialog = (props: Partial<React.ComponentProps<typeof HomeworkBulkDeleteDialog>>) =>
  render(
    <HomeworkBulkDeleteDialog
      phase="confirm"
      items={[]}
      progress={{ done: 0, total: 0 }}
      report={null}
      onConfirm={noop}
      onCancel={noop}
      onClose={noop}
      {...props}
    />
  );

test('potwierdzenie: dokładna liczba, pierwsze pozycje (zestaw jako jedna linia), „…i jeszcze N", fokus na Anuluj', () => {
  const items = [
    item('a', { setId: 's1', groupName: 'Grupa Wtorek', title: 'Travel' }),
    item('b', { setId: 's1', groupName: 'Grupa Wtorek', title: 'Travel' }),
    item('t1', { kind: 'test', title: 'Unit 3', studentName: 'Jan Kowalski' }),
    ...['c', 'd', 'e', 'f', 'g'].map((k) => item(k)),
  ];
  const { getByText, getByTestId, getByRole } = dialog({ items });

  getByText('Usunąć zaznaczone pozycje?');
  getByText(/^Do usunięcia: 8\. Tej operacji nie można cofnąć/);
  const summary = getByTestId('bulk-delete-summary');
  const lines = Array.from(summary.querySelectorAll('li')).map((li) => li.textContent);
  assert.equal(lines.length, 5);
  assert.equal(lines[0], '„Travel" — Grupa Wtorek · cały zestaw: 2');
  assert.equal(lines[1], 'Test „Unit 3" — Jan Kowalski');
  getByText('…i jeszcze 2');

  const cancel = getByRole('button', { name: 'Anuluj' });
  assert.equal(document.activeElement, cancel, 'domyślnie fokus na „Anuluj"');
  assert.equal((getByRole('button', { name: 'Usuń (8)' }) as HTMLButtonElement).disabled, false);
  assert.equal(getByRole('dialog').getAttribute('aria-modal'), 'true');
});

test('potwierdzenie: oddane/ocenione → ostrzeżenie z liczbą i „Usuń" zablokowane do zaznaczenia „Rozumiem"', () => {
  let confirmed = 0;
  const items = [item('a', { handedIn: true }), item('b', { handedIn: true }), item('c')];
  const { getByTestId, getByRole, getByLabelText } = dialog({ items, onConfirm: () => confirmed++ });

  assert.match(getByTestId('bulk-delete-handed-in').textContent ?? '', /Oddane lub ocenione: 2\./);
  const confirm = getByRole('button', { name: 'Usuń (3)' }) as HTMLButtonElement;
  assert.equal(confirm.disabled, true);
  fireEvent.click(confirm);
  assert.equal(confirmed, 0);

  fireEvent.click(getByLabelText('Rozumiem, usuwam także oddane i ocenione prace'));
  assert.equal(confirm.disabled, false);
  fireEvent.click(confirm);
  assert.equal(confirmed, 1);
});

test('potwierdzenie: bez oddanych nie ma ostrzeżenia ani dodatkowego pola; Anuluj woła onCancel', () => {
  let cancelled = 0;
  const { queryByTestId, getByRole } = dialog({ items: [item('a')], onCancel: () => cancelled++ });
  assert.equal(queryByTestId('bulk-delete-handed-in'), null);
  assert.equal(queryByTestId('bulk-delete-ack'), null);
  fireEvent.click(getByRole('button', { name: 'Anuluj' }));
  assert.equal(cancelled, 1);
});

test('postęp: pasek z aria-valuenow, licznik i brak możliwości zamknięcia w trakcie', () => {
  const { getByRole, getByText } = dialog({ phase: 'running', progress: { done: 3, total: 10 } });
  const bar = getByRole('progressbar');
  assert.equal(bar.getAttribute('aria-valuenow'), '3');
  assert.equal(bar.getAttribute('aria-valuemax'), '10');
  assert.equal((bar.firstElementChild as HTMLElement).style.width, '30%');
  getByText('Usunięto 3 z 10');
  assert.equal((getByRole('button', { name: 'Proszę czekać…' }) as HTMLButtonElement).disabled, true);
});

test('raport: usunięto N, błędy M z powodem (znany przetłumaczony, inny surowy); Zamknij z fokusem', () => {
  let closed = 0;
  const report = {
    deleted: [item('a'), item('b')],
    failed: [
      { item: item('c', { title: 'Travel', studentName: 'Ola' }), reason: 'brak uprawnień' },
      { item: item('d', { title: 'Unit 3', studentName: 'Jan' }), reason: 'FirebaseError: quota' },
    ],
  };
  const { getByText, getByTestId, getByRole } = dialog({ phase: 'done', report, onClose: () => closed++ });
  getByText('Usuwanie zakończone z błędami');
  const text = getByTestId('bulk-delete-report').textContent ?? '';
  assert.ok(text.includes('Usunięto: 2'));
  assert.ok(text.includes('Błędy: 2'));
  assert.ok(text.includes('„Travel" — Ola: brak uprawnień'));
  assert.ok(text.includes('„Unit 3" — Jan: FirebaseError: quota'));
  const close = getByRole('button', { name: 'Zamknij' });
  assert.equal(document.activeElement, close);
  fireEvent.click(close);
  assert.equal(closed, 1);
});

test('raport bez błędów: tytuł „Usuwanie zakończone"', () => {
  const { getByText, queryByText } = dialog({ phase: 'done', report: { deleted: [item('a')], failed: [] } });
  getByText('Usuwanie zakończone');
  getByText('Usunięto: 1');
  assert.equal(queryByText(/Błędy:/), null);
});

test('ConfirmModal bez nowych propsów działa jak dotąd: dwa przyciski, bez fokusu startowego', () => {
  let confirmed = 0;
  const { getByRole } = render(
    <ConfirmModal isOpen title="Usunąć?" message="Na pewno?" confirmText="Usuń" onConfirm={() => confirmed++} onCancel={noop} />
  );
  const confirm = getByRole('button', { name: 'Usuń' }) as HTMLButtonElement;
  getByRole('button', { name: 'Anuluj' });
  assert.equal(confirm.disabled, false);
  assert.equal(document.activeElement, document.body);
  fireEvent.click(confirm);
  assert.equal(confirmed, 1);
});

// --- pola wyboru w wierszach ------------------------------------------------

const groupTask = (id: string, status: string): SpecialTask =>
  ({
    id, studentId: id, studentUid: id, studentName: `Kursant ${id}`, title: 'Travel', type: 'translation', sentences: [],
    status, homeworkSetId: 'hwset_grp_1', groupId: 'g', groupName: 'Grupa Wtorek', createdAt: '2026-10-01T10:00:00.000Z',
  }) as unknown as SpecialTask;

const groupRow = (): GroupHomeworkRow =>
  buildHomeworkRows([groupTask('a', 'assigned'), groupTask('b', 'submitted'), groupTask('c', 'graded')])[0] as GroupHomeworkRow;

test('wiersz grupowy w trybie zaznaczania: jedno pole = cały zestaw, liczba widoczna, stan pośredni', () => {
  let toggled = 0;
  const row = groupRow();
  const { getByText, getByLabelText, rerender } = render(
    <HomeworkGroupRow row={row} formatDate={() => ''} onPreview={noop} onReview={noop} selection={{ state: 'none', onToggle: () => toggled++ }} />
  );
  getByText('Cały zestaw: 3');
  const box = getByLabelText('Zaznacz cały zestaw: „Travel" — Grupa Wtorek (3)') as HTMLInputElement;
  assert.equal(box.checked, false);
  fireEvent.click(box);
  assert.equal(toggled, 1);

  rerender(
    <HomeworkGroupRow row={row} formatDate={() => ''} onPreview={noop} onReview={noop} selection={{ state: 'some', onToggle: noop }} />
  );
  assert.equal(box.indeterminate, true);
  rerender(
    <HomeworkGroupRow row={row} formatDate={() => ''} onPreview={noop} onReview={noop} selection={{ state: 'all', onToggle: noop }} />
  );
  assert.equal(box.checked, true);
  assert.equal(box.indeterminate, false);
});

test('wiersz grupowy bez trybu zaznaczania: bez pola wyboru (jak dotąd)', () => {
  const { queryByTestId } = render(<HomeworkGroupRow row={groupRow()} formatDate={() => ''} onPreview={noop} onReview={noop} />);
  assert.equal(queryByTestId('bulk-select-checkbox'), null);
});

test('lista prac: pole wyboru przy wierszu pojedynczym i grupowym; klik przekazuje cały wiersz', () => {
  const single = { ...groupTask('s', 'assigned'), homeworkSetId: undefined, groupId: undefined, groupName: undefined, title: 'Phrasal verbs' } as unknown as SpecialTask;
  const rows = buildHomeworkRows([groupTask('a', 'assigned'), groupTask('b', 'submitted'), single]);
  const toggledRows: HomeworkRow[] = [];
  const state = new Map<HomeworkRow, BulkSelectionState>();
  const { getAllByTestId, getByLabelText } = render(
    <HomeworkTaskList
      tasks={[]}
      rows={rows}
      onPreview={noop}
      formatDate={() => ''}
      getStudentName={(t) => t.studentName || ''}
      selection={{ stateOf: (row) => state.get(row) ?? 'none', toggle: (row) => toggledRows.push(row) }}
    />
  );
  assert.equal(getAllByTestId('bulk-select-checkbox').length, 2);
  fireEvent.click(getByLabelText('Zaznacz: „Phrasal verbs" — Kursant s'));
  fireEvent.click(getByLabelText('Zaznacz cały zestaw: „Travel" — Grupa Wtorek (2)'));
  assert.deepEqual(
    toggledRows.map((r) => r.kind),
    ['single', 'group']
  );
});

test('lista prac bez trybu zaznaczania: bez pól wyboru', () => {
  const rows = buildHomeworkRows([groupTask('a', 'assigned'), groupTask('b', 'assigned')]);
  const { queryAllByTestId } = render(<HomeworkTaskList tasks={[]} rows={rows} onPreview={noop} formatDate={() => ''} />);
  assert.equal(queryAllByTestId('bulk-select-checkbox').length, 0);
});
