import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).customElements = dom.window.customElements;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import HomeworkGroupRow from '../components/dashboard/HomeworkGroupRow';
import { buildHomeworkRows, GroupHomeworkRow } from '../utils/groupHomeworkRows';
import { SpecialTask } from '../types';

const mk = (id: string, name: string, status: string): SpecialTask =>
  ({
    id, studentId: id, studentUid: id, studentName: name, title: 'Travel', type: 'translation', sentences: [],
    status, homeworkSetId: 'hwset_grp_1', groupId: 'g', groupName: 'Grupa Wtorek', createdAt: '2026-10-01T10:00:00.000Z',
  }) as unknown as SpecialTask;

const groupRow = (statuses: string[]): GroupHomeworkRow =>
  buildHomeworkRows(statuses.map((s, i) => mk(`t${i}`, `Kursant ${i}`, s)))[0] as GroupHomeworkRow;

test('wiersz grupowy: nazwa grupy, X/N oddało i status zbiorczy z licznikiem', () => {
  const row = groupRow(['submitted', 'pending', 'submitted']);
  const { getByText } = render(<HomeworkGroupRow row={row} formatDate={() => 'data'} onPreview={() => {}} onReview={() => {}} />);
  getByText('Grupa Wtorek');
  getByText('2/3 oddało');
  getByText('Do sprawdzenia (2)');
  cleanup();
});

test('rozwinięcie pokazuje kursantów; Podgląd i Sprawdź działają na pojedynczym dokumencie', () => {
  const row = groupRow(['submitted', 'pending']);
  const previewed: string[] = [];
  const reviewed: string[] = [];
  const { getByRole, getAllByText, queryAllByText } = render(
    <HomeworkGroupRow row={row} formatDate={() => 'data'} onPreview={(t) => previewed.push(t.id!)} onReview={(t) => reviewed.push(t.id!)} />
  );
  assert.equal(queryAllByText('Podgląd').length, 0);
  fireEvent.click(getByRole('button', { expanded: false }));
  assert.equal(getAllByText('Podgląd').length, 2);
  fireEvent.click(getAllByText('Podgląd')[0]);
  fireEvent.click(getAllByText('Sprawdź / Oceń')[0]);
  assert.deepEqual(previewed, ['t0']);
  assert.deepEqual(reviewed, ['t0']);
  assert.equal(queryAllByText('Sprawdź / Oceń').length, 1);
  cleanup();
});

test('wszyscy sprawdzeni: status zbiorczy "Sprawdzone"', () => {
  const row = groupRow(['graded', 'completed']);
  const { getByText } = render(<HomeworkGroupRow row={row} formatDate={() => 'data'} onPreview={() => {}} onReview={() => {}} />);
  getByText('Sprawdzone');
  getByText('2/2 oddało');
  cleanup();
});
