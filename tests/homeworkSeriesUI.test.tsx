import { dom } from './helpers/jsdomEnv';

import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import i18n from '../i18n';
import { auth } from '../firebase';
import ScheduleSeriesModal from '../components/admin/ScheduleSeriesModal';
import HomeworkSeriesScreen from '../components/admin/HomeworkSeriesScreen';
import { HomeworkSeriesDocument, addDaysToDateString, getWarsawDateString } from '../utils/homeworkSeries';

const realFetch = globalThis.fetch;
let fetchCalls: Array<{ url: string; init?: any }> = [];

function setMockFetch(fn: (url: string, init?: any) => Promise<any>) {
  const wrapped = (url: string, init?: any) => {
    fetchCalls.push({ url: String(url), init });
    return fn(url, init);
  };
  (globalThis as any).fetch = wrapped;
  (dom.window as any).fetch = wrapped;
}

/** Zalogowany lektor — komponenty nie podstawiają już tokenu awaryjnego. */
function signIn(user: { uid: string; token: string } | null) {
  Object.defineProperty(auth, 'currentUser', {
    configurable: true,
    get: () => (user ? { uid: user.uid, getIdToken: async () => user.token } : null),
  });
}

beforeEach(async () => {
  fetchCalls = [];
  signIn({ uid: 'teacher_1', token: 'teacher-token' });
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  cleanup();
  (globalThis as any).fetch = realFetch;
});

const renderModal = (overrides: Partial<React.ComponentProps<typeof ScheduleSeriesModal>> = {}) =>
  render(
    <ScheduleSeriesModal
      isOpen={true}
      studentId="student_123"
      student={{ firstName: 'Jan', lastName: 'Kowalski' }}
      title="Czasy przeszłe"
      usable={[{ type: 'translation' }]}
      items={[{ polishSentence: 'Poszedłem do sklepu', englishTranslation: 'I went to the store' }]}
      onClose={() => {}}
      {...overrides}
    />
  );

const captureSeriesPost = () => {
  let sentBody: any = null;
  let sentAuth: string | undefined;
  setMockFetch(async (url: string, init: any) => {
    if (String(url).includes('/api/homework-series') && init?.method === 'POST') {
      sentBody = JSON.parse(init.body);
      sentAuth = init.headers?.Authorization;
      return { ok: true, json: async () => ({ success: true, series: { id: 'series_created_999' } }) };
    }
    return { ok: true, json: async () => ({}) };
  });
  return { body: () => sentBody, auth: () => sentAuth };
};

test('ScheduleSeriesModal: domyślnie e-mail wyłączony, POST na /api/homework-series z tokenem lektora', async () => {
  const sent = captureSeriesPost();
  let closed = false;
  const { getByTestId } = renderModal({ onClose: () => (closed = true) });

  const slotDateInput = getByTestId('schedule-slot-date') as HTMLInputElement;
  const dueInDaysInput = getByTestId('schedule-due-in-days') as HTMLInputElement;
  const autoEmailToggle = getByTestId('schedule-auto-email-toggle') as HTMLInputElement;

  assert.ok(slotDateInput.value.length > 0, 'Powinna być zainicjalizowana data jutrzejsza');
  assert.equal(dueInDaysInput.value, '3', 'Domyślny czas na wykonanie to 3 dni');
  assert.equal(autoEmailToggle.checked, false, 'Przełącznik e-mail domyślnie WYŁĄCZONY');

  fireEvent.click(getByTestId('schedule-confirm-btn'));
  await waitFor(() => assert.ok(sent.body() !== null, 'Powinien zostać wysłany request POST'));

  const body = sent.body();
  assert.equal(sent.auth(), 'Bearer teacher-token');
  assert.equal(fetchCalls[0].url, '/api/homework-series');
  assert.equal(body.studentUid, 'student_123');
  assert.equal(body.ownerUid, 'teacher_1');
  assert.equal(body.autoEmail, false);
  assert.equal(body.autoEmailConfirmed, false);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(body.items[0].slotDate), 'slotDate w formacie YYYY-MM-DD');
  assert.equal(body.items[0].dueInDays, 3);
  assert.ok(body.itemPayloads[body.items[0].itemId], 'Payload pozycji w itemPayloads');

  fireEvent.click(getByTestId('schedule-close-x-btn'));
  assert.equal(closed, true);
});

test('ScheduleSeriesModal: włączenie e-maili wymaga potwierdzenia z liczbą kursantów; „Zostaw wyłączone” cofa przełącznik', async () => {
  const sent = captureSeriesPost();
  const { getByTestId, queryByTestId } = renderModal({ recipientCount: 1 });
  const toggle = getByTestId('schedule-auto-email-toggle') as HTMLInputElement;

  fireEvent.click(toggle);
  const confirm = getByTestId('auto-email-confirm');
  assert.match(getByTestId('auto-email-confirm-count').textContent || '', /Liczba kursantów: 1/);
  assert.match(confirm.textContent || '', /automatycznie/);
  assert.equal((getByTestId('schedule-confirm-btn') as HTMLButtonElement).disabled, true, 'bez decyzji nie da się zapisać serii');

  fireEvent.click(getByTestId('auto-email-confirm-cancel'));
  assert.equal(queryByTestId('auto-email-confirm'), null);
  assert.equal(toggle.checked, false);

  fireEvent.click(getByTestId('schedule-confirm-btn'));
  await waitFor(() => assert.ok(sent.body()));
  assert.equal(sent.body().autoEmail, false);
  assert.equal(sent.body().autoEmailConfirmed, false);
});

test('ScheduleSeriesModal: po „Włącz automatyczne e-maile” payload niesie autoEmail i autoEmailConfirmed', async () => {
  const sent = captureSeriesPost();
  const { getByTestId } = renderModal();

  fireEvent.click(getByTestId('schedule-auto-email-toggle'));
  fireEvent.click(getByTestId('auto-email-confirm-accept'));
  assert.equal((getByTestId('schedule-auto-email-toggle') as HTMLInputElement).checked, true);

  fireEvent.click(getByTestId('schedule-confirm-btn'));
  await waitFor(() => assert.ok(sent.body()));
  assert.equal(sent.body().autoEmail, true);
  assert.equal(sent.body().autoEmailConfirmed, true);
});

test('ScheduleSeriesModal: bez zalogowanego lektora — komunikat o sesji, żadnego żądania z podstawionym tokenem', async () => {
  captureSeriesPost();
  signIn(null);
  const { getByTestId, findByText } = renderModal();
  fireEvent.click(getByTestId('schedule-confirm-btn'));
  assert.ok(await findByText('Sesja wygasła — zaloguj się ponownie.'));
  assert.equal(fetchCalls.length, 0);
});

test('HomeworkSeriesScreen: nagłówek, przycisk kreatora i pusty stan, gdy brak serii', async () => {
  setMockFetch(async () => ({ ok: true, json: async () => ({ series: [] }) }));
  let creatorOpened = false;
  const { getByTestId, getByText } = render(
    <HomeworkSeriesScreen initialStudents={[]} initialSeries={[]} onOpenCreator={() => (creatorOpened = true)} />
  );

  assert.ok(getByText('Serie prac domowych'));
  await waitFor(() => assert.ok(getByTestId('series-empty-state')));
  fireEvent.click(getByTestId('series-open-creator-btn'));
  assert.equal(creatorOpened, true);
});

const seriesFixture = (): HomeworkSeriesDocument[] => [
  {
    id: 'series_123',
    title: 'Tygodniowa seria gramatyki',
    studentUid: 'student_1',
    studentName: 'Tomasz Nowak',
    ownerUid: 'teacher_1',
    status: 'active',
    autoEmail: true, // bez autoEmailConfirmedAt — stara, niepotwierdzona seria
    items: [
      {
        itemId: 'item_1',
        slotDate: '2026-10-10',
        dueInDays: 7,
        state: 'released',
        releasedAt: '2026-10-10T07:00:00.000Z',
        releasedTaskId: 'task_s_series_123_item_1',
      },
      // Daty stałe, ale jednoznacznie w przeszłości / dalekiej przyszłości — test nie wygasa.
      { itemId: 'item_2', slotDate: '2026-10-12', dueInDays: 7, state: 'ready' },
      { itemId: 'item_3', slotDate: '2999-01-01', dueInDays: 7, state: 'ready' },
    ],
    createdAt: '2026-10-10T06:00:00.000Z',
    updatedAt: '2026-10-10T07:00:00.000Z',
  },
];

const students = [
  { id: 'student_1', username: 'tnowak', firstName: 'Tomasz', lastName: 'Nowak', email: 't@nowak.pl', role: 'user', createdAt: '' },
] as any;

test('HomeworkSeriesScreen: karta serii; „Wydaj” tylko dla pozycji, których dzień już nadszedł; e-mail wg potwierdzenia', async () => {
  setMockFetch(async () => ({ ok: true, json: async () => ({ series: seriesFixture() }) }));
  const { getByText, getAllByText, getByTestId, queryByTestId } = render(
    <HomeworkSeriesScreen initialStudents={students} initialSeries={seriesFixture()} onOpenCreator={() => {}} />
  );

  await waitFor(() => {
    assert.ok(getByText('Tygodniowa seria gramatyki'));
    assert.ok(getAllByText('Tomasz Nowak').length > 0);
    assert.ok(getByText('Aktywna'));
  });
  assert.ok(getByTestId('release-btn-item_2'), 'zaległa pozycja ma przycisk');
  assert.equal(queryByTestId('release-btn-item_3'), null, 'pozycja z przyszłości nie ma przycisku');
  assert.ok(getByText('Automatyczny e-mail: wyłączony'), 'autoEmail bez potwierdzenia nie jest pokazywany jako włączony');
  assert.ok(getByText('Wydaj kolejną'));
});

test('HomeworkSeriesScreen: „Wydaj” bez wydania (skipped) nie udaje sukcesu', async () => {
  setMockFetch(async (url: string, init: any) => {
    if (String(url).endsWith('/release-now') && init?.method === 'POST') {
      return { ok: true, json: async () => ({ success: true, skipped: true }) };
    }
    return { ok: true, json: async () => ({ series: seriesFixture() }) };
  });
  const { getByTestId, findByText } = render(
    <HomeworkSeriesScreen initialStudents={students} initialSeries={seriesFixture()} onOpenCreator={() => {}} />
  );
  fireEvent.click(getByTestId('release-btn-item_2'));
  assert.ok(await findByText('Nic nie wydano — termin pozycji jeszcze nie nadszedł albo już ją wydano.'));
  const releaseCall = fetchCalls.find((c) => c.url.endsWith('/release-now'))!;
  assert.equal(releaseCall.url, '/api/homework-series/series_123/release-now');
  assert.equal(releaseCall.init.headers.Authorization, 'Bearer teacher-token');
});

test('HomeworkSeriesScreen i modal: teksty z en.json po zmianie języka', async () => {
  await i18n.changeLanguage('en');
  setMockFetch(async () => ({ ok: true, json: async () => ({ series: seriesFixture() }) }));
  const screen = render(
    <HomeworkSeriesScreen initialStudents={students} initialSeries={seriesFixture()} onOpenCreator={() => {}} />
  );
  assert.ok(screen.getByText('Homework series'));
  assert.ok(screen.getByText('Release next'));
  assert.ok(screen.getByText('Automatic email: off'));
  cleanup();

  const modal = renderModal();
  assert.ok(modal.getByText('Schedule for a day in a series'));
  fireEvent.click(modal.getByTestId('schedule-auto-email-toggle'));
  assert.match(modal.getByTestId('auto-email-confirm-count').textContent || '', /Students: 1/);
});

test('ScheduleSeriesModal: najwcześniej jutro — min i domyślna data to jutro, dzisiejsza data daje role="alert" bez żądania', async () => {
  setMockFetch(async () => ({ ok: true, json: async () => ({}) }));
  const { getByTestId, getByText } = renderModal();
  const tomorrow = addDaysToDateString(getWarsawDateString(new Date()), 1);
  const slotDateInput = getByTestId('schedule-slot-date') as HTMLInputElement;
  assert.equal(slotDateInput.min, tomorrow);
  assert.equal(slotDateInput.value, tomorrow);

  // Bez potwierdzonego e-maila: kursant zobaczy pracę po zalogowaniu, maila nie będzie.
  assert.ok(getByText('Domyślnie wyłączone — kursant zobaczy pracę po zalogowaniu, e-mail nie zostanie wysłany.'));

  fireEvent.change(slotDateInput, { target: { value: getWarsawDateString(new Date()) } });
  fireEvent.submit(slotDateInput.closest('form')!);
  const alert = await waitFor(() => getByTestId('schedule-error'));
  assert.equal(alert.getAttribute('role'), 'alert');
  assert.match(alert.textContent || '', /najwcześniej jutro/);
  assert.equal(fetchCalls.length, 0, 'bez żądania do API');
});
