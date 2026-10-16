import crypto from 'node:crypto';
import {
  HomeworkSeriesDocument,
  HomeworkSeriesItemMeta,
  HomeworkSeriesItemPayload,
  buildReleasedTaskDocument,
  buildSeriesTaskId,
  computeSeriesStatus,
  findItemsToRelease,
  getWarsawDateString,
  isDelayedRelease,
  isSlotReadyToRelease,
  PlannedSeriesRelease,
  planCronReleases,
  studentsWithReleaseOn,
  updateSeriesItemAfterRelease,
  updateSeriesItemAfterReleaseError,
  validateCreateSeriesInput,
  validateSeriesItemPayload,
} from './homeworkSeries';
import { stripUndefinedDeep } from './directHomeworkEvaluation';
import { User } from '../types';

/**
 * Admin SDK w server.ts nie ma `ignoreUndefinedProperties` (w przeciwieństwie do
 * klienta w firebase.ts), więc każde pole `undefined` wywraca zapis. Wszystkie
 * zapisy tego modułu przechodzą przez tę funkcję.
 */
const clean = <T>(value: T): T => stripUndefinedDeep(value);

export interface SeriesDb {
  runTransaction<T>(updateFunction: (transaction: SeriesTransaction) => Promise<T>): Promise<T>;
  collection(name: string): SeriesCollectionRef;
}

export interface SeriesCollectionRef {
  doc(id?: string): SeriesDocRef;
  where(field: string, opStr: string, value: any): SeriesQuery;
  get(): Promise<SeriesQuerySnapshot>;
}

export interface SeriesQuery {
  where(field: string, opStr: string, value: any): SeriesQuery;
  get(): Promise<SeriesQuerySnapshot>;
}

export interface SeriesDocRef {
  id: string;
  get(): Promise<SeriesDocSnapshot>;
  set(data: any): Promise<void>;
  update(data: any): Promise<void>;
  delete(): Promise<void>;
  collection(name: string): SeriesCollectionRef;
}

export interface SeriesDocSnapshot {
  id: string;
  exists: boolean;
  data(): any;
}

export interface SeriesQuerySnapshot {
  empty: boolean;
  size: number;
  docs: SeriesDocSnapshot[];
}

export interface SeriesTransaction {
  get(ref: SeriesDocRef): Promise<SeriesDocSnapshot>;
  set(ref: SeriesDocRef, data: any): void;
  update(ref: SeriesDocRef, data: any): void;
  create(ref: SeriesDocRef, data: any): void;
  delete(ref: SeriesDocRef): void;
}

export interface HomeworkSeriesHandlerDeps {
  db: SeriesDb;
  now?: () => Date;
  cronSecret?: string;
  origin?: string;
}

export interface HandlerResult {
  status: number;
  body: Record<string, any>;
}

/**
 * Stałoczasowe porównanie sekretu CRON_SECRET.
 */
export function verifyCronSecret(providedHeader?: string, expectedSecret?: string): { ok: boolean; status: number; error?: string } {
  if (!expectedSecret || expectedSecret.trim().length === 0) {
    return { ok: false, status: 500, error: 'CRON_SECRET is not configured on server' };
  }
  if (!providedHeader || !providedHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Missing Bearer token' };
  }
  const provided = providedHeader.slice(7).trim();
  const bufProvided = Buffer.from(provided, 'utf8');
  const bufExpected = Buffer.from(expectedSecret, 'utf8');

  if (bufProvided.length !== bufExpected.length || !crypto.timingSafeEqual(bufProvided, bufExpected)) {
    return { ok: false, status: 401, error: 'Invalid CRON_SECRET' };
  }
  return { ok: true, status: 200 };
}

/**
 * Obsługa tworzenia nowej serii prac domowych:
 * Zapisuje dokument serii oraz payloady w podkolekcji `homeworkSeries/{id}/items/{itemId}`.
 */
export async function handleCreateSeries(
  deps: HomeworkSeriesHandlerDeps,
  input: {
    callerUid: string;
    body: any;
  }
): Promise<HandlerResult> {
  const { callerUid, body } = input;
  const validation = validateCreateSeriesInput(body);
  if (validation.ok === false) {
    return { status: 400, body: { error: validation.error } };
  }
  const sanitized = validation.sanitized;

  // Sprawdzenie właściciela: lektor może tworzyć serie tylko w swoim imieniu
  if (sanitized.ownerUid !== callerUid) {
    return { status: 403, body: { error: 'Forbidden: ownerUid must match caller UID' } };
  }

  // Walidacja payloadów pozycji
  const rawPayloads = body.itemPayloads;
  if (!rawPayloads || typeof rawPayloads !== 'object') {
    return { status: 400, body: { error: 'Brak payloadów zadań w polu itemPayloads' } };
  }

  const cleanPayloads: HomeworkSeriesItemPayload[] = [];
  for (const itemMeta of sanitized.items) {
    const rawItemPayload = rawPayloads[itemMeta.itemId];
    if (!rawItemPayload) {
      return { status: 400, body: { error: `Brak payloadu dla pozycji ${itemMeta.itemId}` } };
    }
    const itemValidation = validateSeriesItemPayload({ ...rawItemPayload, itemId: itemMeta.itemId });
    if (itemValidation.ok === false) {
      return { status: 400, body: { error: `Pozycja ${itemMeta.itemId}: ${itemValidation.error}` } };
    }
    cleanPayloads.push(itemValidation.sanitized);
  }

  const now = deps.now ? deps.now() : new Date();
  const nowIso = now.toISOString();
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const seriesId = `series_${now.getTime()}_${randomSuffix}`;

  const itemsMeta: HomeworkSeriesItemMeta[] = sanitized.items.map((item) => ({
    itemId: item.itemId,
    slotDate: item.slotDate,
    dueInDays: item.dueInDays,
    state: 'ready',
  }));

  const seriesDoc: HomeworkSeriesDocument = {
    id: seriesId,
    title: sanitized.title,
    studentUid: sanitized.studentUid,
    studentName: sanitized.studentName,
    ownerUid: callerUid,
    status: 'active',
    autoEmail: sanitized.autoEmail === true,
    // Data potwierdzenia jest warunkiem automatycznych maili (isSeriesAutoEmailConfirmed).
    autoEmailConfirmedAt: sanitized.autoEmail === true && sanitized.autoEmailConfirmed === true ? nowIso : undefined,
    items: itemsMeta,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const seriesRef = deps.db.collection('homeworkSeries').doc(seriesId);
  await seriesRef.set(clean(seriesDoc));

  // Zapis payloadów w podkolekcji homeworkSeries/{id}/items/{itemId}
  for (const itemPayload of cleanPayloads) {
    const itemRef = seriesRef.collection('items').doc(itemPayload.itemId);
    await itemRef.set(clean(itemPayload));
  }

  return { status: 201, body: { success: true, series: seriesDoc } };
}

/**
 * Pobiera listę serii należących do zalogowanego lektora.
 */
export async function handleListSeries(
  deps: HomeworkSeriesHandlerDeps,
  input: {
    callerUid: string;
    studentUid?: string;
  }
): Promise<HandlerResult> {
  const { callerUid, studentUid } = input;
  let q: SeriesQuery = deps.db.collection('homeworkSeries').where('ownerUid', '==', callerUid);
  if (studentUid) {
    q = q.where('studentUid', '==', studentUid);
  }
  const snap = await q.get();
  const seriesList = snap.docs.map((d) => d.data() as HomeworkSeriesDocument);
  return { status: 200, body: { series: seriesList } };
}

/**
 * Pobiera szczegóły pojedynczej serii (z autoryzacją SEC1: inny lektor 403).
 */
export async function handleGetSeries(
  deps: HomeworkSeriesHandlerDeps,
  input: {
    callerUid: string;
    seriesId: string;
  }
): Promise<HandlerResult> {
  const { callerUid, seriesId } = input;
  const docRef = deps.db.collection('homeworkSeries').doc(seriesId);
  const snap = await docRef.get();
  if (!snap.exists) {
    return { status: 404, body: { error: 'Seria nie została znaleziona' } };
  }
  const series = snap.data() as HomeworkSeriesDocument;
  if (series.ownerUid !== callerUid) {
    return { status: 403, body: { error: 'Forbidden: access denied' } };
  }

  // Pobranie payloadów z podkolekcji
  const itemsSnap = await docRef.collection('items').get();
  const payloads: Record<string, any> = {};
  itemsSnap.docs.forEach((d) => {
    payloads[d.id] = d.data();
  });

  return { status: 200, body: { series, itemsPayloads: payloads } };
}

/**
 * Usuwa serię (lub ustawia status 'archived') z autoryzacją właściciela.
 */
export async function handleDeleteSeries(
  deps: HomeworkSeriesHandlerDeps,
  input: {
    callerUid: string;
    seriesId: string;
  }
): Promise<HandlerResult> {
  const { callerUid, seriesId } = input;
  const docRef = deps.db.collection('homeworkSeries').doc(seriesId);
  const snap = await docRef.get();
  if (!snap.exists) {
    return { status: 404, body: { error: 'Seria nie została znaleziona' } };
  }
  const series = snap.data() as HomeworkSeriesDocument;
  if (series.ownerUid !== callerUid) {
    return { status: 403, body: { error: 'Forbidden: access denied' } };
  }

  await docRef.delete();
  return { status: 200, body: { success: true } };
}

/**
 * Błąd deterministyczny wydania — ponowienie nic nie zmieni (brak lub niepoprawny
 * payload). Pozycja od razu przechodzi w `failed`.
 */
export class PermanentReleaseError extends Error {
  readonly permanent = true;
}

/**
 * Czy błąd wydania jest deterministyczny. Wszystko inne — DEADLINE_EXCEEDED,
 * UNAVAILABLE, ABORTED, RESOURCE_EXHAUSTED, INTERNAL i błędy nieznane — traktujemy
 * jako przejściowe: pozycja zostaje `ready` do `MAX_RELEASE_ATTEMPTS` prób. Celowo
 * także PERMISSION_DENIED/UNAUTHENTICATED: awaria poświadczeń serwera nie może
 * jednym uruchomieniem oznaczyć wszystkich pozycji jako `failed`.
 */
export function isPermanentReleaseError(err: unknown): boolean {
  return err instanceof PermanentReleaseError;
}

export interface ReleaseItemResult {
  success: boolean;
  taskId?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
  /** Po błędzie: pozycja została `ready` i będzie ponowiona. */
  willRetry?: boolean;
  /** Po błędzie: pozycja przeszła w `failed`. */
  failed?: boolean;
  releaseAttempts?: number;
}

/**
 * Zapisuje nieudaną próbę w metadanych pozycji — w transakcji, żeby nie nadpisać
 * równoległego wydania innej pozycji tej samej serii (tablica `items` jest wspólna).
 */
async function recordReleaseError(
  deps: HomeworkSeriesHandlerDeps,
  seriesRef: SeriesDocRef,
  itemId: string,
  failure: { error: string; permanent: boolean; attemptedAt: string }
): Promise<HomeworkSeriesItemMeta | null> {
  return deps.db.runTransaction(async (transaction) => {
    const snap = await transaction.get(seriesRef);
    if (!snap.exists) return null;
    const seriesData = snap.data() as HomeworkSeriesDocument;
    const items = updateSeriesItemAfterReleaseError(seriesData.items || [], itemId, failure);
    transaction.update(seriesRef, clean({ items, updatedAt: failure.attemptedAt }));
    return items.find((it) => it.itemId === itemId) || null;
  });
}

/**
 * Wydanie pojedynczej pozycji serii w transakcji Firestore (idempotencja: create()).
 * Nie rzuca: każdy błąd kończy się wynikiem `success: false`, więc pętla crona
 * przechodzi do kolejnych pozycji.
 */
export async function releaseSingleSeriesItem(
  deps: HomeworkSeriesHandlerDeps,
  params: {
    seriesId: string;
    itemId: string;
    todayWarsaw: string;
    origin?: string;
  }
): Promise<ReleaseItemResult> {
  const { seriesId, itemId, todayWarsaw, origin } = params;
  const now = deps.now ? deps.now() : new Date();
  const nowIso = now.toISOString();

  const seriesRef = deps.db.collection('homeworkSeries').doc(seriesId);
  const itemPayloadRef = seriesRef.collection('items').doc(itemId);

  const taskId = buildSeriesTaskId(seriesId, itemId);
  const taskRef = deps.db.collection('specialTasks').doc(taskId);

  try {
    const payloadSnap = await itemPayloadRef.get();
    if (!payloadSnap.exists) {
      throw new PermanentReleaseError(`Brak payloadu pozycji ${itemId}`);
    }
    const itemPayload = payloadSnap.data() as HomeworkSeriesItemPayload;
    const payloadCheck = validateSeriesItemPayload({ ...itemPayload, itemId });
    if (payloadCheck.ok === false) {
      throw new PermanentReleaseError(`Niepoprawny payload pozycji ${itemId}: ${payloadCheck.error}`);
    }

    const result = await deps.db.runTransaction(async (transaction) => {
      const currentSeriesSnap = await transaction.get(seriesRef);
      if (!currentSeriesSnap.exists) {
        // Seria usunięta między planem a wydaniem — nie ma czego wydawać ani gdzie zapisać błędu.
        return { skipped: true, reason: 'series_missing' };
      }
      const seriesData = currentSeriesSnap.data() as HomeworkSeriesDocument;
      if (seriesData.status !== 'active') {
        return { skipped: true, reason: 'series_not_active' };
      }

      const itemMeta = seriesData.items.find((it) => it.itemId === itemId);
      if (!itemMeta) {
        return { skipped: true, reason: 'item_missing' };
      }

      if (itemMeta.state !== 'ready') {
        // Pozycja została już wydana lub przetworzona w równoległej transakcji
        return { skipped: true, reason: 'already_processed', taskId: itemMeta.releasedTaskId };
      }

      if (!isSlotReadyToRelease(itemMeta.slotDate, todayWarsaw)) {
        return { skipped: true, reason: 'not_ready_yet' };
      }

      // Sprawdzenie czy zadanie już istnieje (obrona w głębi)
      const existingTaskSnap = await transaction.get(taskRef);
      if (existingTaskSnap.exists) {
        // Jeśli zadanie istnieje, zsynchronizuj stan serii z released
        const updatedItems = updateSeriesItemAfterRelease(seriesData.items, itemId, {
          taskId,
          releasedAt: nowIso,
          delayed: isDelayedRelease(itemMeta.slotDate, todayWarsaw),
          releasedWarsawDate: todayWarsaw,
        });
        const newStatus = computeSeriesStatus(seriesData.status, updatedItems);
        transaction.update(seriesRef, clean({ items: updatedItems, status: newStatus, updatedAt: nowIso }));
        return { skipped: true, reason: 'task_already_exists', taskId };
      }

      // Odczyt profilu kursanta (jeśli istnieje)
      let studentUser: Partial<User> | null = null;
      const userRef = deps.db.collection('users').doc(seriesData.studentUid);
      try {
        const userSnap = await transaction.get(userRef);
        if (userSnap.exists) {
          studentUser = userSnap.data() as Partial<User>;
        }
      } catch {
        // Profil opcjonalny
      }

      const taskDoc = buildReleasedTaskDocument({
        series: seriesData,
        itemMeta,
        itemPayload,
        studentUser,
        releasedAt: nowIso,
        todayWarsaw,
        origin: origin || deps.origin,
      });

      // DECYZJA 6: transakcyjne create() na deterministycznym task_s_{seriesId}_{itemId}
      transaction.create(taskRef, clean(taskDoc));

      const delayed = isDelayedRelease(itemMeta.slotDate, todayWarsaw);
      const updatedItems = updateSeriesItemAfterRelease(seriesData.items, itemId, {
        taskId,
        releasedAt: nowIso,
        delayed,
        releasedWarsawDate: todayWarsaw,
      });
      const newStatus = computeSeriesStatus(seriesData.status, updatedItems);
      transaction.update(seriesRef, clean({ items: updatedItems, status: newStatus, updatedAt: nowIso }));

      // Oznaczenie kursanta flagą hasNewHomework — tylko gdy profil istnieje: update()
      // nieistniejącego dokumentu wywróciłby całą transakcję razem z wydaniem pracy.
      if (studentUser) {
        transaction.update(userRef, { hasNewHomework: true });
      }

      return { success: true, taskId };
    });

    if (result.skipped) {
      return { success: true, skipped: true, reason: result.reason, taskId: result.taskId };
    }
    return { success: true, taskId: result.taskId };
  } catch (err: any) {
    if (
      err?.code === 6 ||
      err?.code === 'already-exists' ||
      String(err?.message).toLowerCase().includes('already exists')
    ) {
      // Zadanie zostało już utworzone (np. w równoległej transakcji) — idempotencja zachowana
      return { success: true, taskId, skipped: true, reason: 'task_already_exists' };
    }
    const permanent = isPermanentReleaseError(err);
    const error = String(err?.message || err || 'Nieznany błąd');
    try {
      const updated = await recordReleaseError(deps, seriesRef, itemId, { error, permanent, attemptedAt: nowIso });
      return {
        success: false,
        error,
        failed: updated?.state === 'failed',
        willRetry: updated?.state === 'ready',
        releaseAttempts: updated?.releaseAttempts,
      };
    } catch {
      // Nie udało się nawet zapisać próby (np. baza niedostępna) — pozycja zostaje `ready`
      // bez zmiany licznika, więc kolejne uruchomienie i tak spróbuje ponownie.
      return { success: false, error, willRetry: true };
    }
  }
}

/**
 * Główna funkcja crona wydająca zaplanowane prace ze wszystkich aktywnych serii:
 * Skanuje serie `status == 'active'` bez zapytań złożonych i wydaje pozycje `slotDate <= todayWarsaw`.
 */
export async function handleCronRelease(
  deps: HomeworkSeriesHandlerDeps,
  input: {
    authHeader?: string;
    todayWarsaw?: string;
  }
): Promise<HandlerResult> {
  const secretCheck = verifyCronSecret(input.authHeader, deps.cronSecret);
  if (!secretCheck.ok) {
    return { status: secretCheck.status, body: { error: secretCheck.error } };
  }

  const now = deps.now ? deps.now() : new Date();
  const todayWarsaw = input.todayWarsaw || getWarsawDateString(now);

  // Skanowanie serii: pojedynczy warunek status == 'active' (brak potrzeby nowego indeksu Firestore)
  const snap = await deps.db.collection('homeworkSeries').where('status', '==', 'active').get();
  const seriesList = snap.docs.map((doc) => {
    const data = doc.data() as HomeworkSeriesDocument;
    return { ...data, id: data.id || doc.id };
  });

  // Najwyżej jeden slot na kursanta na uruchomienie i najwyżej jedna praca na
  // kursanta na dzień (planCronReleases) — reszta zaległych czeka na kolejne dni.
  const candidates = planCronReleases(seriesList, todayWarsaw);
  const dueCount = seriesList.reduce(
    (sum, series) =>
      sum + (series.items || []).filter((it) => it.state === 'ready' && isSlotReadyToRelease(it.slotDate, todayWarsaw)).length,
    0
  );
  const dueStudents = new Set(
    seriesList.filter((s) => findItemsToRelease(s.items || [], todayWarsaw).length > 0).map((s) => s.studentUid)
  );
  const releasedToday = studentsWithReleaseOn(seriesList, todayWarsaw);

  let releasedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let retryCount = 0;
  let failedCount = 0;

  // Limit dzienny także względem serii zakończonych: seria jednopozycyjna po wydaniu
  // od razu przechodzi w `completed` i znika z zapytania o aktywne. Bez tego drugie
  // uruchomienie tego samego dnia wydałoby kursantowi pracę z jego kolejnej serii.
  const plan: PlannedSeriesRelease[] = [];
  for (const candidate of candidates) {
    try {
      const studentSeriesSnap = await deps.db
        .collection('homeworkSeries')
        .where('studentUid', '==', candidate.studentUid)
        .get();
      const studentSeries = studentSeriesSnap.docs.map((d) => d.data() as HomeworkSeriesDocument);
      if (studentsWithReleaseOn(studentSeries, todayWarsaw).has(candidate.studentUid)) {
        releasedToday.add(candidate.studentUid);
        continue;
      }
    } catch {
      // Nie da się sprawdzić limitu — ostrożnie pomijamy kursanta (spróbujemy jutro),
      // zamiast ryzykować drugą pracę tego samego dnia.
      errorCount++;
      retryCount++;
      continue;
    }
    plan.push(candidate);
  }
  const dailyLimitSkippedCount = Array.from(dueStudents).filter((uid) => releasedToday.has(uid)).length;

  // Każda pozycja osobno: błąd jednej (także nieoczekiwany wyjątek) nie zatrzymuje
  // pozostałych — cron kończy się 200 z podsumowaniem.
  for (const planned of plan) {
    let res: ReleaseItemResult;
    try {
      res = await releaseSingleSeriesItem(deps, {
        seriesId: planned.seriesId,
        itemId: planned.itemId,
        todayWarsaw,
      });
    } catch (err: any) {
      res = { success: false, error: String(err?.message || err), willRetry: true };
    }

    if (res.success && !res.skipped) {
      releasedCount++;
    } else if (res.skipped) {
      skippedCount++;
    } else {
      errorCount++;
      if (res.failed) failedCount++;
      else retryCount++;
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      todayWarsaw,
      seriesProcessed: seriesList.length,
      plannedCount: plan.length,
      dailyLimitSkippedCount,
      releasedCount,
      deferredCount: Math.max(0, dueCount - plan.length),
      skippedCount,
      errorCount,
      retryCount,
      failedCount,
    },
  };
}

/**
 * Ręczne „Wydaj teraz” lektora. Z `itemId` — dokładnie ta pozycja (o ile jej
 * termin już nadszedł); bez — najstarsza gotowa, tak samo jak przy cronie
 * (najwyżej jedna na wywołanie).
 */
export async function handleReleaseNow(
  deps: HomeworkSeriesHandlerDeps,
  input: {
    callerUid: string;
    seriesId: string;
    itemId?: unknown;
  }
): Promise<HandlerResult> {
  const { callerUid, seriesId } = input;
  const seriesSnap = await deps.db.collection('homeworkSeries').doc(seriesId).get();
  if (!seriesSnap.exists) {
    return { status: 404, body: { error: 'Seria nie istnieje' } };
  }
  const seriesData = seriesSnap.data() as HomeworkSeriesDocument;
  if (seriesData.ownerUid !== callerUid) {
    return { status: 403, body: { error: 'Forbidden: access denied' } };
  }

  const now = deps.now ? deps.now() : new Date();
  const todayWarsaw = getWarsawDateString(now);

  if (input.itemId !== undefined && input.itemId !== null && input.itemId !== '') {
    if (typeof input.itemId !== 'string') {
      return { status: 400, body: { error: 'Nieprawidłowy itemId' } };
    }
    const releaseRes = await releaseSingleSeriesItem(deps, { seriesId, itemId: input.itemId, todayWarsaw });
    return { status: releaseRes.success ? 200 : 400, body: releaseRes };
  }

  const toRelease = findItemsToRelease(seriesData.items || [], todayWarsaw);
  const results = [];
  for (const it of toRelease) {
    results.push(await releaseSingleSeriesItem(deps, { seriesId, itemId: it.itemId, todayWarsaw }));
  }
  return { status: 200, body: { success: true, released: results } };
}
