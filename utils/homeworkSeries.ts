import { HomeworkType, User } from '../types';
import { buildHomeworkAssignment } from './buildHomeworkAssignment';
import { isRegeneratedItemValid } from './homeworkItems';
import { sanitizeWarmup } from './warmupSanitize';
import { sanitizeWarmupCards } from './warmupCards';

export type HomeworkSeriesItemState = 'ready' | 'released' | 'failed';
export type HomeworkSeriesStatus = 'active' | 'completed' | 'paused' | 'archived';

export const MAX_SERIES_ITEMS = 5;
export const MAX_ITEM_PAYLOAD_BYTES = 200 * 1024; // 200 KB
/** Po tylu nieudanych próbach wydania z błędem przejściowym pozycja przechodzi w `failed`. */
export const MAX_RELEASE_ATTEMPTS = 5;
const MAX_STORED_ERROR_LENGTH = 500;

export interface HomeworkSeriesItemMeta {
  itemId: string;
  slotDate: string; // YYYY-MM-DD (Warszawa)
  dueInDays: number;
  state: HomeworkSeriesItemState;
  releasedAt?: string;
  releasedTaskId?: string;
  releasedDelayed?: boolean;
  /** Dzień warszawski wydania (YYYY-MM-DD) — podstawa dziennego limitu crona. */
  releasedWarsawDate?: string;
  /** Liczba nieudanych prób wydania (błędy przejściowe i deterministyczne). */
  releaseAttempts?: number;
  lastAttemptAt?: string;
  lastError?: string;
}

export interface HomeworkSeriesDocument {
  id: string;
  title: string;
  studentUid: string;
  studentName?: string;
  ownerUid: string;
  status: HomeworkSeriesStatus;
  /**
   * Automatyczny e-mail do kursanta po każdym wydaniu. Domyślnie wyłączony; włączony
   * działa tylko razem z `autoEmailConfirmedAt` (jawne potwierdzenie lektora przy
   * tworzeniu serii) — patrz `isSeriesAutoEmailConfirmed`.
   */
  autoEmail: boolean;
  autoEmailConfirmedAt?: string;
  items: HomeworkSeriesItemMeta[];
  createdAt: string;
  updatedAt: string;
}

export interface HomeworkSeriesItemPayload {
  itemId: string;
  title?: string;
  type: HomeworkType;
  types?: HomeworkType[];
  instructions?: string;
  sentences: any[];
  warmup?: any;
  warmupCards?: any;
}

/**
 * Deterministyczny identyfikator dokumentu pracy w `specialTasks`.
 *
 * Zapobiega podwójnemu wydaniu tego samego zadania w razie ponowienia crona
 * lub równoległych żądań.
 */
export function buildSeriesTaskId(seriesId: string, itemId: string): string {
  const cleanSeries = String(seriesId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanItem = String(itemId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `task_s_${cleanSeries}_${cleanItem}`;
}

/**
 * Zwraca dzisiejszą datę w strefie czasowej Europe/Warsaw w formacie YYYY-MM-DD.
 */
export function getWarsawDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Oblicza datę końcową zadania (YYYY-MM-DD) na podstawie daty wydania i liczby dni.
 */
export function computeDueDate(releaseDate: string | Date, dueInDays: number): string {
  const base = typeof releaseDate === 'string' ? new Date(releaseDate) : new Date(releaseDate.getTime());
  if (isNaN(base.getTime())) {
    throw new Error('Niepoprawna data wydania');
  }
  const days = Math.max(1, Math.round(dueInDays || 7));
  base.setDate(base.getDate() + days);
  return getWarsawDateString(base);
}

/**
 * Czy dany slot kwalifikuje się do wydania w zadanym dniu warszawskim (slotDate <= todayWarsaw).
 */
export function isSlotReadyToRelease(slotDate: string, todayWarsaw: string): boolean {
  if (!slotDate || !todayWarsaw) return false;
  return slotDate <= todayWarsaw;
}

/**
 * Czy wydanie jest opóźnione (slotDate wcześniejszy niż dzisiejszy dzień w Warszawie).
 */
export function isDelayedRelease(slotDate: string, todayWarsaw: string): boolean {
  if (!slotDate || !todayWarsaw) return false;
  return slotDate < todayWarsaw;
}

/**
 * Najstarsza pozycja serii gotowa do wydania (state === 'ready' oraz slotDate <= todayWarsaw)
 * — zwracana jako lista z najwyżej jednym elementem.
 *
 * Limit jednego slotu na uruchomienie jest celowy: po pauzie serii albo kilku dniach
 * bez crona zaległości nie spadają na kursanta hurtem, tylko wychodzą po jednej
 * przy kolejnych uruchomieniach. Ćwiczenia nie wygasają — zaległy slot czeka,
 * aż przyjdzie jego kolej. Przy równych datach decyduje kolejność w serii.
 */
export function findItemsToRelease(
  items: HomeworkSeriesItemMeta[],
  todayWarsaw: string
): HomeworkSeriesItemMeta[] {
  if (!Array.isArray(items)) return [];
  let oldest: HomeworkSeriesItemMeta | null = null;
  for (const item of items) {
    if (item.state !== 'ready' || !isSlotReadyToRelease(item.slotDate, todayWarsaw)) continue;
    if (!oldest || item.slotDate < oldest.slotDate) oldest = item;
  }
  return oldest ? [oldest] : [];
}

export interface PlannedSeriesRelease {
  seriesId: string;
  studentUid: string;
  itemId: string;
  slotDate: string;
}

/**
 * Dzień warszawski, w którym pozycję wydano, albo `null`, gdy nie jest wydana.
 * Pozycje sprzed pola `releasedWarsawDate` liczone z `releasedAt`.
 */
export function itemReleaseWarsawDate(item: HomeworkSeriesItemMeta): string | null {
  if (!item || item.state !== 'released') return null;
  if (item.releasedWarsawDate) return item.releasedWarsawDate;
  if (item.releasedAt) {
    const d = new Date(item.releasedAt);
    if (!isNaN(d.getTime())) return getWarsawDateString(d);
  }
  return null;
}

/**
 * Kursanci, którzy w danym dniu warszawskim dostali już pracę z którejkolwiek
 * z przekazanych serii (cron albo ręczne „Wydaj”), niezależnie od statusu serii.
 */
export function studentsWithReleaseOn(
  seriesList: Array<Pick<HomeworkSeriesDocument, 'studentUid' | 'items'>>,
  dayWarsaw: string
): Set<string> {
  const result = new Set<string>();
  for (const series of seriesList || []) {
    if (!series?.studentUid || !Array.isArray(series.items)) continue;
    if (series.items.some((item) => itemReleaseWarsawDate(item) === dayWarsaw)) {
      result.add(series.studentUid);
    }
  }
  return result;
}

/**
 * Plan jednego uruchomienia crona: najwyżej jeden slot na kursanta, także gdy ma
 * kilka aktywnych serii. Wygrywa najstarszy zaległy slot spośród jego serii (przy
 * równych datach — seria wcześniejsza na liście). Pozostałe czekają na kolejne
 * uruchomienia.
 *
 * Limit dzienny: kursant, który dziś (dzień warszawski) dostał już pracę z którejś
 * z przekazanych serii, jest pomijany — drugie uruchomienie tego samego dnia
 * (ponowne dostarczenie zdarzenia przez Vercel, ręczny POST) nic mu nie wyda.
 * Serie zakończone nie przychodzą w zapytaniu o aktywne, więc handler sprawdza
 * je osobno przed wydaniem.
 */
export function planCronReleases(
  seriesList: Array<Pick<HomeworkSeriesDocument, 'id' | 'studentUid' | 'status' | 'items'>>,
  todayWarsaw: string
): PlannedSeriesRelease[] {
  const releasedToday = studentsWithReleaseOn(seriesList, todayWarsaw);
  const byStudent = new Map<string, PlannedSeriesRelease>();
  for (const series of seriesList || []) {
    if (!series || series.status !== 'active' || !series.studentUid) continue;
    if (releasedToday.has(series.studentUid)) continue;
    const [candidate] = findItemsToRelease(series.items, todayWarsaw);
    if (!candidate) continue;
    const current = byStudent.get(series.studentUid);
    if (!current || candidate.slotDate < current.slotDate) {
      byStudent.set(series.studentUid, {
        seriesId: series.id,
        studentUid: series.studentUid,
        itemId: candidate.itemId,
        slotDate: candidate.slotDate,
      });
    }
  }
  return Array.from(byStudent.values());
}

/**
 * Aktualizuje listę metadanych pozycji po udanym wydaniu zadania.
 */
export function updateSeriesItemAfterRelease(
  items: HomeworkSeriesItemMeta[],
  itemId: string,
  update: { taskId: string; releasedAt: string; delayed: boolean; releasedWarsawDate?: string }
): HomeworkSeriesItemMeta[] {
  return items.map((item) => {
    if (item.itemId !== itemId) return item;
    return {
      ...item,
      state: 'released',
      releasedTaskId: update.taskId,
      releasedAt: update.releasedAt,
      releasedDelayed: update.delayed,
      releasedWarsawDate: update.releasedWarsawDate,
      lastError: undefined,
    };
  });
}

/**
 * Aktualizuje listę metadanych pozycji po nieudanej próbie wydania.
 *
 * Błąd deterministyczny (`permanent`: brak lub niepoprawny payload) od razu kończy
 * pozycję stanem `failed`. Każdy inny (przejściowy albo nieznany) zostawia ją `ready`
 * — kolejne uruchomienie spróbuje ponownie — aż do `MAX_RELEASE_ATTEMPTS` prób.
 * Pozycji, która nie jest już `ready` (np. wydana równolegle), nie rusza.
 */
export function updateSeriesItemAfterReleaseError(
  items: HomeworkSeriesItemMeta[],
  itemId: string,
  failure: { error: string; permanent: boolean; attemptedAt: string }
): HomeworkSeriesItemMeta[] {
  return items.map((item) => {
    if (item.itemId !== itemId || item.state !== 'ready') return item;
    const releaseAttempts = (item.releaseAttempts || 0) + 1;
    return {
      ...item,
      state: failure.permanent || releaseAttempts >= MAX_RELEASE_ATTEMPTS ? 'failed' : 'ready',
      releaseAttempts,
      lastAttemptAt: failure.attemptedAt,
      lastError: String(failure.error || 'Nieznany błąd').slice(0, MAX_STORED_ERROR_LENGTH),
    };
  });
}

/**
 * Oblicza nowy status serii na podstawie stanów pozycji.
 * Jeśli wszystkie pozycje zostały wydane, seria przechodzi w stan 'completed'.
 */
export function computeSeriesStatus(
  currentStatus: HomeworkSeriesStatus,
  items: HomeworkSeriesItemMeta[]
): HomeworkSeriesStatus {
  if (currentStatus === 'paused' || currentStatus === 'archived') {
    return currentStatus;
  }
  if (!Array.isArray(items) || items.length === 0) {
    return currentStatus;
  }
  const allReleased = items.every((item) => item.state === 'released');
  return allReleased ? 'completed' : 'active';
}

/**
 * Waliduje poprawność formatu daty slotu (YYYY-MM-DD).
 */
export function validateSlotDate(slotDate: string): boolean {
  if (typeof slotDate !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(slotDate.trim());
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/**
 * Walidacja i sanityzacja payloadu pojedynczej pozycji serii prac domowych.
 * Zapewnia limit rozmiaru (200 KB) oraz zgodność ze standardowymi walidatorami zadań i rozgrzewki.
 */
export function validateSeriesItemPayload(
  rawPayload: unknown
): { ok: true; sanitized: HomeworkSeriesItemPayload } | { ok: false; error: string } {
  if (!rawPayload || typeof rawPayload !== 'object') {
    return { ok: false, error: 'Payload pozycji musi być obiektem JSON' };
  }

  const rawJson = JSON.stringify(rawPayload);
  const byteLength = typeof Buffer !== 'undefined' ? Buffer.byteLength(rawJson, 'utf8') : rawJson.length;
  if (byteLength > MAX_ITEM_PAYLOAD_BYTES) {
    return {
      ok: false,
      error: `Rozmiar pozycji przekracza dozwolony limit ${MAX_ITEM_PAYLOAD_BYTES / 1024} KB (${Math.round(byteLength / 1024)} KB)`,
    };
  }

  const p = rawPayload as Record<string, any>;
  const itemId = String(p.itemId || '').trim();
  if (!itemId || !/^[a-zA-Z0-9_-]+$/.test(itemId) || itemId.length > 64) {
    return { ok: false, error: 'Niepoprawny itemId pozycji (dozwolone znaki alfanumeryczne, _, -, max 64 znaki)' };
  }

  const type = p.type as HomeworkType;
  if (!type || typeof type !== 'string') {
    return { ok: false, error: 'Brak lub niepoprawny typ zadania (type)' };
  }

  if (!Array.isArray(p.sentences) || p.sentences.length === 0) {
    return { ok: false, error: 'Pozycja musi zawierać co najmniej jedno ćwiczenie w tablicy sentences' };
  }

  // Walidacja kształtu każdego ćwiczenia tymi samymi regułami co w kreatorze
  for (let i = 0; i < p.sentences.length; i++) {
    const item = p.sentences[i];
    const itemType = item?.type || type;
    if (!isRegeneratedItemValid(itemType, item)) {
      return { ok: false, error: `Ćwiczenie #${i + 1} (${itemType}) nie spełnia kryteriów poprawności` };
    }
  }

  // Sanityzacja rozgrzewki (warmup)
  let cleanWarmup: any = undefined;
  if (p.warmup !== undefined) {
    cleanWarmup = sanitizeWarmup(p.warmup);
  }

  // Sanityzacja fiszek rozgrzewkowych (warmupCards)
  let cleanCards: any = undefined;
  if (p.warmupCards !== undefined) {
    cleanCards = sanitizeWarmupCards(p.warmupCards);
  }

  const types = Array.isArray(p.types)
    ? (p.types.filter((t) => typeof t === 'string') as HomeworkType[])
    : [type];

  const sanitized: HomeworkSeriesItemPayload = {
    itemId,
    title: typeof p.title === 'string' && p.title.trim() ? p.title.trim() : undefined,
    type,
    types,
    instructions: typeof p.instructions === 'string' ? p.instructions.trim() : undefined,
    sentences: p.sentences,
    warmup: cleanWarmup,
    warmupCards: cleanCards,
  };

  return { ok: true, sanitized };
}

export interface CreateSeriesInput {
  title: string;
  studentUid: string;
  studentName?: string;
  ownerUid: string;
  autoEmail?: boolean;
  /** Jawne potwierdzenie lektora w modalu; bez niego `autoEmail: true` jest odrzucane. */
  autoEmailConfirmed?: boolean;
  items: Array<{
    itemId: string;
    slotDate: string;
    dueInDays: number;
  }>;
}

/**
 * Waliduje dane wejściowe tworzenia nowej serii prac domowych.
 */
export function validateCreateSeriesInput(
  input: unknown,
  options: {
    /**
     * Dzisiejszy dzień warszawski. Podany = sloty muszą być najwcześniej jutro: cron
     * wydaje rano, więc slot na dziś (albo z przeszłości) wyszedłby dopiero następnego
     * dnia, jako opóźniony.
     */
    todayWarsaw?: string;
  } = {}
): { ok: true; sanitized: CreateSeriesInput } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Dane serii muszą być obiektem JSON' };
  }

  const data = input as Record<string, any>;
  const title = String(data.title || '').trim();
  if (!title || title.length > 200) {
    return { ok: false, error: 'Tytuł serii jest wymagany i nie może przekraczać 200 znaków' };
  }

  const studentUid = String(data.studentUid || '').trim();
  if (!studentUid) {
    return { ok: false, error: 'Pole studentUid jest wymagane' };
  }

  const ownerUid = String(data.ownerUid || '').trim();
  if (!ownerUid) {
    return { ok: false, error: 'Pole ownerUid jest wymagane' };
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    return { ok: false, error: 'Seria musi zawierać co najmniej jedną pozycję' };
  }

  if (data.items.length > MAX_SERIES_ITEMS) {
    return {
      ok: false,
      error: `Wersja pilotażowa pozwala na maksymalnie ${MAX_SERIES_ITEMS} pozycji w serii (przekazano ${data.items.length})`,
    };
  }

  const seenIds = new Set<string>();
  const sanitizedItems: CreateSeriesInput['items'] = [];

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (!item || typeof item !== 'object') {
      return { ok: false, error: `Pozycja #${i + 1} nie jest prawidłowym obiektem` };
    }
    const itemId = String(item.itemId || '').trim();
    if (!itemId || !/^[a-zA-Z0-9_-]+$/.test(itemId)) {
      return { ok: false, error: `Pozycja #${i + 1}: nieprawidłowy itemId` };
    }
    if (seenIds.has(itemId)) {
      return { ok: false, error: `Zdublowany itemId: ${itemId}` };
    }
    seenIds.add(itemId);

    const slotDate = String(item.slotDate || '').trim();
    if (!validateSlotDate(slotDate)) {
      return { ok: false, error: `Pozycja #${i + 1} (${itemId}): niepoprawny format daty slotDate (wymagany YYYY-MM-DD)` };
    }
    if (options.todayWarsaw && slotDate <= options.todayWarsaw) {
      return {
        ok: false,
        error: `Pozycja #${i + 1} (${itemId}): dzień wydania musi być najwcześniej jutro (dziś w Warszawie: ${options.todayWarsaw})`,
      };
    }

    const dueInDays = Number(item.dueInDays);
    if (!Number.isInteger(dueInDays) || dueInDays < 1 || dueInDays > 60) {
      return { ok: false, error: `Pozycja #${i + 1} (${itemId}): dueInDays musi być liczbą całkowitą z zakresu 1–60` };
    }

    sanitizedItems.push({
      itemId,
      slotDate,
      dueInDays,
    });
  }

  // Automatyczne maile wychodzą bez modala potwierdzenia przy każdym wydaniu, więc
  // włączenie musi być świadome: tylko dosłowne `true` razem z potwierdzeniem.
  const autoEmail = data.autoEmail === true;
  if (autoEmail && data.autoEmailConfirmed !== true) {
    return {
      ok: false,
      error: 'Automatyczne e-maile wymagają potwierdzenia lektora (autoEmailConfirmed: true)',
    };
  }

  return {
    ok: true,
    sanitized: {
      title,
      studentUid,
      studentName: typeof data.studentName === 'string' && data.studentName.trim() ? data.studentName.trim() : undefined,
      ownerUid,
      autoEmail,
      autoEmailConfirmed: autoEmail,
      items: sanitizedItems,
    },
  };
}

/**
 * Czy profil z `users/{uid}` może dostać serię: istnieje, jest kontem kursanta
 * (nie lektora ani administratora) i nie jest dawnym pseudo-kursantem grupy
 * (`isGroup` / `lessonType: 'Group'`) — analogicznie do SEC2 dla v2 `assign`.
 */
export function checkSeriesStudentProfile(
  profile: Record<string, any> | null | undefined
): { ok: true } | { ok: false; error: string } {
  if (!profile) return { ok: false, error: 'Wskazany kursant nie istnieje.' };
  if (profile.isGroup === true || profile.lessonType === 'Group') {
    return { ok: false, error: 'Serię można zaplanować tylko pojedynczemu kursantowi, nie grupie.' };
  }
  if (profile.role && profile.role !== 'user') {
    return { ok: false, error: 'Wskazane konto nie jest kontem kursanta.' };
  }
  return { ok: true };
}

/**
 * Czy wydania tej serii mogą wysyłać e-mail automatycznie: przełącznik włączony
 * i potwierdzony przez lektora. Stare serie z samym `autoEmail: true` (bez daty
 * potwierdzenia) traktujemy jak wyłączone.
 */
export function isSeriesAutoEmailConfirmed(
  series: Pick<HomeworkSeriesDocument, 'autoEmail' | 'autoEmailConfirmedAt'>
): boolean {
  return series.autoEmail === true && typeof series.autoEmailConfirmedAt === 'string' && series.autoEmailConfirmedAt.length > 0;
}

/**
 * Buduje finalny dokument zadania `specialTasks` do zapisu przy wydaniu pozycji serii.
 * Zgodny z `buildHomeworkAssignment` z flagą `includeToken: false`.
 */
export function buildReleasedTaskDocument(params: {
  series: HomeworkSeriesDocument;
  itemMeta: HomeworkSeriesItemMeta;
  itemPayload: HomeworkSeriesItemPayload;
  studentUser?: Partial<User> | null;
  releasedAt?: string;
  todayWarsaw?: string;
  origin?: string;
}): Record<string, any> {
  const { series, itemMeta, itemPayload, studentUser, origin } = params;
  const releasedAt = params.releasedAt || new Date().toISOString();
  const todayWarsaw = params.todayWarsaw || getWarsawDateString(new Date(releasedAt));
  const delayed = isDelayedRelease(itemMeta.slotDate, todayWarsaw);

  const dueDate = computeDueDate(releasedAt, itemMeta.dueInDays);
  const taskTitle = itemPayload.title || `${series.title} (${itemMeta.slotDate})`;

  const autoEmail = isSeriesAutoEmailConfirmed(series);

  const usable = (itemPayload.types && itemPayload.types.length > 0)
    ? itemPayload.types.map((type) => ({ type }))
    : [{ type: itemPayload.type }];

  const taskDoc = buildHomeworkAssignment({
    student: studentUser,
    studentId: series.studentUid,
    title: taskTitle,
    usable,
    items: itemPayload.sentences,
    dueDate,
    createdAt: releasedAt,
    finalWarmup: itemPayload.warmup,
    finalCards: itemPayload.warmupCards,
    origin,
    includeToken: false, // DECYZJA 4: brak tokenu /hw?token= i brak directHomeworkTokens
    skipAutoEmail: !autoEmail, // DECYZJA 5: skipAutoEmail, gdy przełącznik wyłączony lub niepotwierdzony
    manualEmailConfirmationRequired: !autoEmail,
    emailNotificationSent: false,
    status: 'pending', // DECYZJA 3: status pending (jak w kreatorze)
  });

  // Dodatkowe metadane śledzenia serii
  taskDoc.seriesId = series.id;
  taskDoc.seriesItemId = itemMeta.itemId;
  // Czytane przez Cloud Function `notifyStudentOnHomework`: praca z serii dostaje
  // automatyczny e-mail wyłącznie z tą flagą.
  taskDoc.seriesAutoEmailConfirmed = autoEmail;
  if (delayed) {
    taskDoc.releasedDelayed = true;
  }

  return taskDoc;
}
