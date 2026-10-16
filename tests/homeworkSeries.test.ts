import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSeriesTaskId,
  computeDueDate,
  computeSeriesStatus,
  findItemsToRelease,
  getWarsawDateString,
  isDelayedRelease,
  isSlotReadyToRelease,
  updateSeriesItemAfterRelease,
  updateSeriesItemAfterReleaseError,
  MAX_RELEASE_ATTEMPTS,
  validateCreateSeriesInput,
  validateSeriesItemPayload,
  validateSlotDate,
  buildReleasedTaskDocument,
  HomeworkSeriesDocument,
  HomeworkSeriesItemMeta,
  HomeworkSeriesItemPayload,
  MAX_ITEM_PAYLOAD_BYTES,
  MAX_SERIES_ITEMS,
  planCronReleases,
  isSeriesAutoEmailConfirmed,
} from '../utils/homeworkSeries';
import { HomeworkType, User } from '../types';

test('strefa czasowa: getWarsawDateString liczy czas warszawski przed i po zmianie czasu 25.10.2026', () => {
  // Przed zmianą czasu (CEST = UTC+2): 2026-10-24 23:30:00 UTC to 2026-10-25 01:30 w Warszawie
  const beforeChange = new Date('2026-10-24T23:30:00.000Z');
  assert.equal(getWarsawDateString(beforeChange), '2026-10-25');

  // Po zmianie czasu (CET = UTC+1): 2026-10-25 23:30:00 UTC to 2026-10-26 00:30 w Warszawie
  const afterChange = new Date('2026-10-25T23:30:00.000Z');
  assert.equal(getWarsawDateString(afterChange), '2026-10-26');

  // Rano w UTC (05:00 UTC):
  // Przed zmianą (UTC+2): 05:00 UTC = 07:00 w Warszawie
  // Po zmianie (UTC+1): 05:00 UTC = 06:00 w Warszawie
  // W obu przypadkach jest to ten sam dzień i poranek w Warszawie
  const morningSummer = new Date('2026-10-10T05:00:00.000Z');
  assert.equal(getWarsawDateString(morningSummer), '2026-10-10');

  const morningWinter = new Date('2026-11-10T05:00:00.000Z');
  assert.equal(getWarsawDateString(morningWinter), '2026-11-10');
});

test('slotDate i zaległość: isSlotReadyToRelease oraz isDelayedRelease', () => {
  const today = '2026-10-10';

  // Dzisiejsza pozycja -> ready, nie opóźniona
  assert.equal(isSlotReadyToRelease('2026-10-10', today), true);
  assert.equal(isDelayedRelease('2026-10-10', today), false);

  // Przyszła pozycja -> not ready, nie opóźniona
  assert.equal(isSlotReadyToRelease('2026-10-11', today), false);
  assert.equal(isDelayedRelease('2026-10-11', today), false);

  // Zaległa pozycja (wczoraj) -> ready, OPÓŹNIONA
  assert.equal(isSlotReadyToRelease('2026-10-09', today), true);
  assert.equal(isDelayedRelease('2026-10-09', today), true);

  // Zaległa sprzed tygodnia -> ready, OPÓŹNIONA
  assert.equal(isSlotReadyToRelease('2026-10-03', today), true);
  assert.equal(isDelayedRelease('2026-10-03', today), true);
});

test('computeDueDate: oblicza poprawną datę zakończenia', () => {
  assert.equal(computeDueDate('2026-10-10T05:00:00.000Z', 3), '2026-10-13');
  assert.equal(computeDueDate('2026-10-10T05:00:00.000Z', 7), '2026-10-17');
});

test('findItemsToRelease: najwyżej jeden slot — najstarszy gotowy z slotDate <= dziś', () => {
  const items: HomeworkSeriesItemMeta[] = [
    { itemId: 'item_2', slotDate: '2026-10-10', dueInDays: 3, state: 'ready' }, // dzisiejsza
    { itemId: 'item_1', slotDate: '2026-10-08', dueInDays: 3, state: 'ready' }, // zaległa (najstarsza)
    { itemId: 'item_3', slotDate: '2026-10-12', dueInDays: 3, state: 'ready' }, // przyszła
    { itemId: 'item_4', slotDate: '2026-10-07', dueInDays: 3, state: 'released' }, // już wydana
    { itemId: 'item_5', slotDate: '2026-10-06', dueInDays: 3, state: 'failed' }, // błąd
  ];

  const ready = findItemsToRelease(items, '2026-10-10');
  assert.deepEqual(ready.map((r) => r.itemId), ['item_1']);

  // Nic gotowego -> pusta lista
  assert.deepEqual(findItemsToRelease(items, '2026-10-05'), []);
  assert.deepEqual(findItemsToRelease(undefined as any, '2026-10-10'), []);
});

test('findItemsToRelease: równe daty -> decyduje kolejność w serii', () => {
  const items: HomeworkSeriesItemMeta[] = [
    { itemId: 'a', slotDate: '2026-10-09', dueInDays: 3, state: 'ready' },
    { itemId: 'b', slotDate: '2026-10-09', dueInDays: 3, state: 'ready' },
  ];
  assert.deepEqual(findItemsToRelease(items, '2026-10-10').map((r) => r.itemId), ['a']);
});

test('limit: zaległości wychodzą po jednej na kolejnych uruchomieniach, bez wygasania', () => {
  // Seria wstrzymana na ponad dwa tygodnie: pięć slotów zaległych naraz.
  let items: HomeworkSeriesItemMeta[] = ['01', '02', '03', '04', '05'].map((d, i) => ({
    itemId: `it_${i + 1}`,
    slotDate: `2026-10-${d}`,
    dueInDays: 3,
    state: 'ready' as const,
  }));

  const releasedOrder: string[] = [];
  for (const day of ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24']) {
    const toRelease = findItemsToRelease(items, day);
    assert.equal(toRelease.length, 1, `uruchomienie ${day} wydaje dokładnie jeden slot`);
    releasedOrder.push(toRelease[0].itemId);
    items = updateSeriesItemAfterRelease(items, toRelease[0].itemId, {
      taskId: `task_${toRelease[0].itemId}`,
      releasedAt: `${day}T05:00:00.000Z`,
      delayed: true,
    });
  }

  // Żaden slot nie przepadł mimo wielodniowego opóźnienia.
  assert.deepEqual(releasedOrder, ['it_1', 'it_2', 'it_3', 'it_4', 'it_5']);
  assert.equal(findItemsToRelease(items, '2026-10-25').length, 0);
  assert.equal(computeSeriesStatus('active', items), 'completed');
});

test('planCronReleases: najwyżej jeden slot na kursanta także przy kilku seriach', () => {
  const plan = planCronReleases(
    [
      {
        id: 'ser_a',
        studentUid: 'stu_1',
        status: 'active',
        items: [
          { itemId: 'a1', slotDate: '2026-10-09', dueInDays: 3, state: 'ready' },
          { itemId: 'a2', slotDate: '2026-10-10', dueInDays: 3, state: 'ready' },
        ],
      },
      {
        id: 'ser_b',
        studentUid: 'stu_1',
        status: 'active',
        // Starszy zaległy slot w drugiej serii tego samego kursanta wygrywa.
        items: [{ itemId: 'b1', slotDate: '2026-10-07', dueInDays: 3, state: 'ready' }],
      },
      {
        id: 'ser_c',
        studentUid: 'stu_2',
        status: 'active',
        items: [{ itemId: 'c1', slotDate: '2026-10-10', dueInDays: 3, state: 'ready' }],
      },
      {
        id: 'ser_d',
        studentUid: 'stu_3',
        status: 'paused',
        items: [{ itemId: 'd1', slotDate: '2026-10-01', dueInDays: 3, state: 'ready' }],
      },
      {
        id: 'ser_e',
        studentUid: 'stu_4',
        status: 'active',
        items: [{ itemId: 'e1', slotDate: '2026-10-11', dueInDays: 3, state: 'ready' }], // jutro
      },
    ],
    '2026-10-10'
  );

  const byStudent = Object.fromEntries(plan.map((p) => [p.studentUid, `${p.seriesId}/${p.itemId}`]));
  assert.deepEqual(byStudent, { stu_1: 'ser_b/b1', stu_2: 'ser_c/c1' });
});

test('planCronReleases: równe daty u jednego kursanta -> seria wcześniejsza na liście', () => {
  const plan = planCronReleases(
    [
      { id: 'ser_1', studentUid: 'stu', status: 'active', items: [{ itemId: 'x', slotDate: '2026-10-10', dueInDays: 1, state: 'ready' }] },
      { id: 'ser_2', studentUid: 'stu', status: 'active', items: [{ itemId: 'y', slotDate: '2026-10-10', dueInDays: 1, state: 'ready' }] },
    ],
    '2026-10-10'
  );
  assert.deepEqual(plan.map((p) => p.seriesId), ['ser_1']);
});

test('aktualizacja pozycji: release oraz failure', () => {
  const items: HomeworkSeriesItemMeta[] = [
    { itemId: 'item_1', slotDate: '2026-10-08', dueInDays: 3, state: 'ready' },
    { itemId: 'item_2', slotDate: '2026-10-10', dueInDays: 3, state: 'ready' },
  ];

  const afterRelease = updateSeriesItemAfterRelease(items, 'item_1', {
    taskId: 'task_s_ser1_item_1',
    releasedAt: '2026-10-10T05:00:00.000Z',
    delayed: true,
  });

  assert.equal(afterRelease[0].state, 'released');
  assert.equal(afterRelease[0].releasedTaskId, 'task_s_ser1_item_1');
  assert.equal(afterRelease[0].releasedDelayed, true);
  assert.equal(afterRelease[1].state, 'ready');

  // Błąd deterministyczny: od razu `failed`.
  const afterPermanent = updateSeriesItemAfterReleaseError(items, 'item_2', {
    error: 'Brak payloadu pozycji item_2',
    permanent: true,
    attemptedAt: '2026-10-10T05:00:00.000Z',
  });
  assert.equal(afterPermanent[1].state, 'failed');
  assert.equal(afterPermanent[1].releaseAttempts, 1);
  assert.equal(afterPermanent[1].lastError, 'Brak payloadu pozycji item_2');
});

test('błąd przejściowy: pozycja zostaje ready z licznikiem prób, failed dopiero po MAX_RELEASE_ATTEMPTS', () => {
  let items: HomeworkSeriesItemMeta[] = [{ itemId: 'a', slotDate: '2026-10-08', dueInDays: 3, state: 'ready' }];
  assert.equal(MAX_RELEASE_ATTEMPTS, 5);
  for (let attempt = 1; attempt < MAX_RELEASE_ATTEMPTS; attempt++) {
    items = updateSeriesItemAfterReleaseError(items, 'a', {
      error: 'DEADLINE_EXCEEDED',
      permanent: false,
      attemptedAt: `2026-10-1${attempt}T05:00:00.000Z`,
    });
    assert.equal(items[0].state, 'ready', `próba ${attempt}: nadal ready`);
    assert.equal(items[0].releaseAttempts, attempt);
  }
  items = updateSeriesItemAfterReleaseError(items, 'a', { error: 'UNAVAILABLE', permanent: false, attemptedAt: 'x' });
  assert.equal(items[0].state, 'failed');
  assert.equal(items[0].releaseAttempts, MAX_RELEASE_ATTEMPTS);
  assert.equal(items[0].lastError, 'UNAVAILABLE');

  // Pozycji, która nie jest już ready (np. wydana równolegle), błąd nie rusza.
  const released: HomeworkSeriesItemMeta[] = [{ itemId: 'b', slotDate: '2026-10-08', dueInDays: 3, state: 'released' }];
  assert.deepEqual(
    updateSeriesItemAfterReleaseError(released, 'b', { error: 'x', permanent: true, attemptedAt: 'x' }),
    released
  );
  // Długi komunikat przycinany przed zapisem.
  const long = updateSeriesItemAfterReleaseError(
    [{ itemId: 'c', slotDate: '2026-10-08', dueInDays: 3, state: 'ready' }],
    'c',
    { error: 'e'.repeat(5000), permanent: false, attemptedAt: 'x' }
  );
  assert.equal(long[0].lastError!.length, 500);
});

test('status serii: przejście active -> completed gdy wszystkie pozycje wydane', () => {
  const items: HomeworkSeriesItemMeta[] = [
    { itemId: 'item_1', slotDate: '2026-10-08', dueInDays: 3, state: 'released' },
    { itemId: 'item_2', slotDate: '2026-10-10', dueInDays: 3, state: 'ready' },
  ];

  assert.equal(computeSeriesStatus('active', items), 'active');

  const allReleased: HomeworkSeriesItemMeta[] = [
    { itemId: 'item_1', slotDate: '2026-10-08', dueInDays: 3, state: 'released' },
    { itemId: 'item_2', slotDate: '2026-10-10', dueInDays: 3, state: 'released' },
  ];
  assert.equal(computeSeriesStatus('active', allReleased), 'completed');
  assert.equal(computeSeriesStatus('paused', allReleased), 'paused');
});

test('idempotencja: deterministyczny buildSeriesTaskId', () => {
  assert.equal(buildSeriesTaskId('series123', 'item_1'), 'task_s_series123_item_1');
  assert.equal(buildSeriesTaskId('ser_abc', 'item-42'), 'task_s_ser_abc_item-42');
  // Sanityzacja znaków specjalnych
  assert.equal(buildSeriesTaskId('ser/123', 'it.4'), 'task_s_ser_123_it_4');
});

test('walidacja payloadu pozycji: limit 200 KB i kształt ćwiczeń', () => {
  const validPayload = {
    itemId: 'item_1',
    type: 'translation',
    sentences: [
      { id: '1', polishSentence: 'Kot śpi', englishTranslation: 'The cat is sleeping', type: 'translation' },
    ],
  };

  const res = validateSeriesItemPayload(validPayload);
  assert.equal(res.ok, true);

  // Brak sentences
  const noSentences = { itemId: 'item_1', type: 'translation', sentences: [] };
  assert.equal(validateSeriesItemPayload(noSentences).ok, false);

  // Błędny element ćwiczenia (brak wymaganych pól)
  const invalidExercise = {
    itemId: 'item_1',
    type: 'translation',
    sentences: [{ id: '1', polish: '', english: '' }],
  };
  assert.equal(validateSeriesItemPayload(invalidExercise).ok, false);

  // Przekroczenie limitu 200 KB
  const hugeString = 'x'.repeat(MAX_ITEM_PAYLOAD_BYTES + 100);
  const oversizedPayload = {
    itemId: 'item_1',
    type: 'translation',
    sentences: [
      { id: '1', polish: 'Kot', english: 'Cat', extra: hugeString },
    ],
  };
  const overRes = validateSeriesItemPayload(oversizedPayload);
  assert.equal(overRes.ok, false);
  if (!overRes.ok) {
    assert.match(overRes.error, /Rozmiar pozycji przekracza dozwolony limit/);
  }
});

test('walidacja tworzenia serii: limit 5 pozycji w pilocie i duplikaty', () => {
  const validSeriesInput = {
    title: 'Moja seria testowa',
    studentUid: 'student_1',
    ownerUid: 'teacher_1',
    autoEmail: false,
    items: [
      { itemId: 'item_1', slotDate: '2026-10-12', dueInDays: 3 },
      { itemId: 'item_2', slotDate: '2026-10-14', dueInDays: 3 },
    ],
  };

  const okRes = validateCreateSeriesInput(validSeriesInput);
  assert.equal(okRes.ok, true);

  // Ponad limit 5 pozycji
  const overLimitInput = {
    ...validSeriesInput,
    items: [
      { itemId: 'item_1', slotDate: '2026-10-12', dueInDays: 3 },
      { itemId: 'item_2', slotDate: '2026-10-13', dueInDays: 3 },
      { itemId: 'item_3', slotDate: '2026-10-14', dueInDays: 3 },
      { itemId: 'item_4', slotDate: '2026-10-15', dueInDays: 3 },
      { itemId: 'item_5', slotDate: '2026-10-16', dueInDays: 3 },
      { itemId: 'item_6', slotDate: '2026-10-17', dueInDays: 3 },
    ],
  };
  const limitRes = validateCreateSeriesInput(overLimitInput);
  assert.equal(limitRes.ok, false);
  if (!limitRes.ok) {
    assert.match(limitRes.error, /maksymalnie 5 pozycji/);
  }

  // Zdublowany itemId
  const duplicateIdInput = {
    ...validSeriesInput,
    items: [
      { itemId: 'item_1', slotDate: '2026-10-12', dueInDays: 3 },
      { itemId: 'item_1', slotDate: '2026-10-14', dueInDays: 3 },
    ],
  };
  assert.equal(validateCreateSeriesInput(duplicateIdInput).ok, false);
});

test('walidacja autoEmail: domyślnie wyłączony, włączenie tylko z jawnym potwierdzeniem', () => {
  const base = {
    title: 'Seria',
    studentUid: 'student_1',
    ownerUid: 'teacher_1',
    items: [{ itemId: 'item_1', slotDate: '2026-10-12', dueInDays: 3 }],
  };

  // Brak pola -> wyłączony
  const noFlag = validateCreateSeriesInput(base);
  assert.equal(noFlag.ok, true);
  if (noFlag.ok) {
    assert.equal(noFlag.sanitized.autoEmail, false);
    assert.equal(noFlag.sanitized.autoEmailConfirmed, false);
  }

  // Włączony bez potwierdzenia -> odrzucony
  const unconfirmed = validateCreateSeriesInput({ ...base, autoEmail: true });
  assert.equal(unconfirmed.ok, false);
  if (!unconfirmed.ok) assert.match(unconfirmed.error, /potwierdzenia/);
  assert.equal(validateCreateSeriesInput({ ...base, autoEmail: true, autoEmailConfirmed: 'yes' }).ok, false);

  // Wartość „prawdziwa”, ale nie dosłowne true -> traktowana jako wyłączona
  const truthy = validateCreateSeriesInput({ ...base, autoEmail: 'true', autoEmailConfirmed: true });
  assert.equal(truthy.ok, true);
  if (truthy.ok) assert.equal(truthy.sanitized.autoEmail, false);

  // Włączony i potwierdzony -> przechodzi
  const confirmed = validateCreateSeriesInput({ ...base, autoEmail: true, autoEmailConfirmed: true });
  assert.equal(confirmed.ok, true);
  if (confirmed.ok) {
    assert.equal(confirmed.sanitized.autoEmail, true);
    assert.equal(confirmed.sanitized.autoEmailConfirmed, true);
  }
});

test('DECYZJA 3, 4, 5: buildReleasedTaskDocument buduje dokument zadania', () => {
  const mockSeries: HomeworkSeriesDocument = {
    id: 'series_alpha',
    title: 'Seria Business English',
    studentUid: 'usr_student_42',
    ownerUid: 'usr_teacher_99',
    status: 'active',
    autoEmail: false,
    items: [
      { itemId: 'it_1', slotDate: '2026-10-09', dueInDays: 3, state: 'ready' },
    ],
    createdAt: '2026-10-08T10:00:00.000Z',
    updatedAt: '2026-10-08T10:00:00.000Z',
  };

  const itemMeta: HomeworkSeriesItemMeta = mockSeries.items[0];
  const itemPayload: HomeworkSeriesItemPayload = {
    itemId: 'it_1',
    type: 'translation',
    sentences: [
      { id: '1', polishSentence: 'Negocjacje zakończyły się sukcesem', englishTranslation: 'Negotiations ended successfully', type: 'translation' },
    ],
  };

  const studentUser: Partial<User> = {
    id: 'usr_student_42',
    firstName: 'Piotr',
    lastName: 'Nowak',
    email: 'piotr@example.com',
  };

  const taskDoc = buildReleasedTaskDocument({
    series: mockSeries,
    itemMeta,
    itemPayload,
    studentUser,
    releasedAt: '2026-10-10T05:00:00.000Z',
    todayWarsaw: '2026-10-10',
  });

  // DECYZJA 3: status pending (jak w kreatorze)
  assert.equal(taskDoc.status, 'pending');

  // DECYZJA 4: brak tokenu /hw?token= i brak directHomeworkTokens
  assert.equal('accessToken' in taskDoc, false);
  assert.equal('accessExpiresAt' in taskDoc, false);
  assert.equal('accessUrl' in taskDoc, false);

  // DECYZJA 5: autoEmail=false -> skipAutoEmail=true
  assert.equal(taskDoc.skipAutoEmail, true);
  assert.equal(taskDoc.manualEmailConfirmationRequired, true);

  // Opóźnione wydanie (slotDate 2026-10-09 < 2026-10-10)
  assert.equal(taskDoc.releasedDelayed, true);

  // Identyfikatory serii
  assert.equal(taskDoc.seriesId, 'series_alpha');
  assert.equal(taskDoc.seriesItemId, 'it_1');
  assert.equal(taskDoc.studentUid, 'usr_student_42');

  // DECYZJA 3 weryfikacja filtrów StudentHomeworkScreen:
  // Helper isDateOverdue z StudentHomeworkScreen, z zegarem wstrzykniętym na chwilę
  // wydania — porównanie z Date.now() sprawiało, że test wygasał 3 dni po releasedAt.
  const NOW_AT_RELEASE = Date.parse('2026-10-10T05:00:00.000Z');
  const isDateOverdue = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (dateStr.length === 10) d.setHours(23, 59, 59, 999);
      return d.getTime() < NOW_AT_RELEASE;
    } catch {
      return false;
    }
  };

  // Filtr 1: pending i nie zaległe -> widoczne w Do zrobienia
  const isPendingInTime = (taskDoc.status === 'pending' || !taskDoc.status) && !isDateOverdue(taskDoc.dueDate);
  assert.equal(isPendingInTime, true, 'Wydana praca domowa musi przechodzić filtr pendingTests');

  // Gdyby praca była po terminie dueDate:
  const overdueDoc: Record<string, any> = { ...taskDoc, dueDate: '2020-01-01' };
  const isOverdue = (overdueDoc.status === 'pending' || !overdueDoc.status) && isDateOverdue(overdueDoc.dueDate);
  assert.equal(isOverdue, true, 'Praca ze statusem pending po terminie przechodzi filtr overdueTests');
});

test('DECYZJA 5: autoEmail włącza wysyłkę tylko z potwierdzeniem lektora (autoEmailConfirmedAt)', () => {
  const seriesWithEmail: HomeworkSeriesDocument = {
    id: 'series_beta',
    title: 'Seria z mailem',
    studentUid: 'usr_student_1',
    ownerUid: 'usr_teacher_1',
    status: 'active',
    autoEmail: true,
    autoEmailConfirmedAt: '2026-10-10T10:00:00.000Z',
    items: [
      { itemId: 'it_1', slotDate: '2026-10-10', dueInDays: 2, state: 'ready' },
    ],
    createdAt: '2026-10-10T10:00:00.000Z',
    updatedAt: '2026-10-10T10:00:00.000Z',
  };
  const build = (series: HomeworkSeriesDocument) =>
    buildReleasedTaskDocument({
      series,
      itemMeta: series.items[0],
      itemPayload: {
        itemId: 'it_1',
        type: 'translation',
        sentences: [{ id: '1', polishSentence: 'Test', englishTranslation: 'Test', type: 'translation' }],
      },
      releasedAt: '2026-10-10T05:00:00.000Z',
      todayWarsaw: '2026-10-10',
    });

  const confirmed = build(seriesWithEmail);
  assert.equal(isSeriesAutoEmailConfirmed(seriesWithEmail), true);
  assert.equal(confirmed.skipAutoEmail, false);
  assert.equal(confirmed.manualEmailConfirmationRequired, false);
  assert.equal(confirmed.emailNotificationSent, false);
  assert.equal(confirmed.seriesAutoEmailConfirmed, true);

  // Stara seria: autoEmail: true bez daty potwierdzenia -> ręczne potwierdzenie jak w kreatorze
  const { autoEmailConfirmedAt: _drop, ...legacy } = seriesWithEmail;
  const unconfirmed = build(legacy as HomeworkSeriesDocument);
  assert.equal(isSeriesAutoEmailConfirmed(legacy), false);
  assert.equal(unconfirmed.skipAutoEmail, true);
  assert.equal(unconfirmed.manualEmailConfirmationRequired, true);
  assert.equal(unconfirmed.seriesAutoEmailConfirmed, false);
});
