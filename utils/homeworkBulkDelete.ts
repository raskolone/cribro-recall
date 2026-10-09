import type { SpecialTask, StudentTest } from '../types';
import type { GroupHomeworkRow, HomeworkRow } from './groupHomeworkRows';

/**
 * Masowe usuwanie w „Zadaniach i testach" — czysta logika, bez Firestore i UI.
 *
 * Zaznaczenie trzyma pojedyncze DOKUMENTY (praca = `specialTasks/{id}`, test =
 * `users/{studentId}/tests/{id}`), a nie wiersze listy: wiersz grupowy to N
 * dokumentów ze wspólnym `homeworkSetId`, a ten sam dokument przy filtrze na
 * kursanta pokazuje się jako wiersz pojedynczy. Klucz dokumentu łączy oba widoki.
 *
 * Samo usuwanie robi funkcja wstrzyknięta przez wywołującego (istniejące
 * `deleteHomeworkTask` / `deleteStudentTest` z services/homeworkDeletion.ts) —
 * tu jest tylko kolejność, partie i zbieranie wyników.
 */

export type BulkDeleteKind = 'homework' | 'test';

export interface BulkDeleteItem {
  /** `hw:{taskId}` albo `test:{studentId}/{testId}`. */
  key: string;
  kind: BulkDeleteKind;
  /** Id dokumentu pracy albo testu. */
  id: string;
  /** Właściciel testu — część ścieżki `users/{studentId}/tests/{id}`. */
  studentId?: string;
  title: string;
  /** Kursant, którego dotyczy dokument. */
  studentName: string;
  /** Zestaw grupowy — w potwierdzeniu jego dokumenty są jedną linią z liczbą. */
  setId?: string;
  groupName?: string;
  /** Oddana lub oceniona: w dokumencie są odpowiedzi kursanta albo wynik. */
  handedIn: boolean;
}

export type BulkSelection = ReadonlyMap<string, BulkDeleteItem>;
export type BulkSelectionState = 'none' | 'some' | 'all';

export const homeworkItemKey = (taskId: string): string => `hw:${taskId}`;
export const testItemKey = (studentId: string, testId: string): string => `test:${studentId}/${testId}`;

const HANDED_IN_HOMEWORK = new Set(['submitted', 'graded', 'completed']);

/**
 * Praca oddana lub oceniona: status, data oddania albo dodatkowy sygnał od
 * wywołującego (zadania silnika v2 trzymają oddanie w `attempts`, nie w `status`).
 */
export const isHomeworkHandedIn = (task: SpecialTask, extra?: (task: SpecialTask) => boolean): boolean =>
  HANDED_IN_HOMEWORK.has(String(task.status ?? '')) || Boolean(task.submittedAt) || Boolean(extra?.(task));

export const isTestHandedIn = (test: StudentTest): boolean =>
  test.status === 'completed' || test.status === 'graded' || Boolean(test.completedAt);

export interface HomeworkItemOptions {
  /** Imię i nazwisko kursanta dla dokumentu (domyślnie `studentName`). */
  getName?: (task: SpecialTask) => string;
  /** Dodatkowy sygnał „oddana" (np. próba v2 czekająca na ocenę). */
  isHandedIn?: (task: SpecialTask) => boolean;
}

const homeworkItem = (
  task: SpecialTask,
  options: HomeworkItemOptions,
  set?: { setId: string; groupName: string; name: string }
): BulkDeleteItem | null => {
  if (!task.id) return null;
  return {
    key: homeworkItemKey(task.id),
    kind: 'homework',
    id: task.id,
    title: task.title || 'Praca domowa',
    studentName: set?.name || (options.getName ? options.getName(task) : task.studentName) || 'Kursant',
    setId: set?.setId,
    groupName: set?.groupName,
    handedIn: isHomeworkHandedIn(task, options.isHandedIn),
  };
};

/** Wiersz listy → dokumenty do usunięcia. Wiersz grupowy rozwija się do WSZYSTKICH swoich dokumentów. */
export const expandHomeworkRow = (row: HomeworkRow, options: HomeworkItemOptions = {}): BulkDeleteItem[] => {
  if (row.kind === 'single') {
    const item = homeworkItem(row.task, options);
    return item ? [item] : [];
  }
  return expandGroupRow(row, options);
};

const expandGroupRow = (row: GroupHomeworkRow, options: HomeworkItemOptions): BulkDeleteItem[] =>
  row.members
    .map((m) => homeworkItem(m.task, options, { setId: row.homeworkSetId, groupName: row.groupName, name: m.name }))
    .filter((item): item is BulkDeleteItem => item !== null);

export const testBulkItem = (test: StudentTest): BulkDeleteItem | null => {
  if (!test.id || !test.studentId) return null;
  return {
    key: testItemKey(test.studentId, test.id),
    kind: 'test',
    id: test.id,
    studentId: test.studentId,
    title: test.title || 'Test',
    studentName: test.studentName || 'Kursant',
    handedIn: isTestHandedIn(test),
  };
};

/**
 * Wszystkie dokumenty bieżącego widoku. Wejściem są wiersze i testy JUŻ po
 * filtrach (kursant, status) i wyszukiwarce — dzięki temu „Zaznacz wszystko w
 * widoku" nie łapie niczego, czego lektor nie widzi.
 */
export const collectViewItems = (
  rows: HomeworkRow[],
  tests: StudentTest[],
  options: HomeworkItemOptions = {}
): BulkDeleteItem[] => {
  const seen = new Set<string>();
  const out: BulkDeleteItem[] = [];
  const push = (item: BulkDeleteItem | null) => {
    if (!item || seen.has(item.key)) return;
    seen.add(item.key);
    out.push(item);
  };
  rows.forEach((row) => expandHomeworkRow(row, options).forEach(push));
  tests.forEach((test) => push(testBulkItem(test)));
  return out;
};

/** Ile z podanych dokumentów jest zaznaczonych: żaden / część / wszystkie. */
export const selectionState = (selection: BulkSelection, items: BulkDeleteItem[]): BulkSelectionState => {
  if (items.length === 0) return 'none';
  const count = items.filter((item) => selection.has(item.key)).length;
  if (count === 0) return 'none';
  return count === items.length ? 'all' : 'some';
};

export const setItemsSelected = (
  selection: BulkSelection,
  items: BulkDeleteItem[],
  selected: boolean
): Map<string, BulkDeleteItem> => {
  const next = new Map(selection);
  items.forEach((item) => {
    if (selected) next.set(item.key, item);
    else next.delete(item.key);
  });
  return next;
};

/**
 * Kliknięcie pola wyboru (wiersz, cały zestaw, „wszystko w widoku"): gdy
 * wszystkie podane są zaznaczone — odznacza je; inaczej dozaznacza brakujące.
 * Zaznaczenia spoza podanych dokumentów zostają nietknięte.
 */
export const toggleItems = (selection: BulkSelection, items: BulkDeleteItem[]): Map<string, BulkDeleteItem> =>
  setItemsSelected(selection, items, selectionState(selection, items) !== 'all');

export const countHandedIn = (items: BulkDeleteItem[]): number => items.filter((item) => item.handedIn).length;

export interface BulkSummaryLine {
  kind: BulkDeleteKind;
  title: string;
  /** Kursant albo nazwa grupy (dla zestawu). */
  who: string;
  /** Ile dokumentów stoi za linią — >1 tylko dla zestawu grupowego. */
  count: number;
}

/**
 * Wypis do potwierdzenia: dokumenty jednego zestawu grupowego jako jedna linia
 * z liczbą, reszta po jednej. Zwraca pierwsze `limit` linii i ile zostało.
 */
export const summarizeSelection = (
  items: BulkDeleteItem[],
  limit = 5
): { lines: BulkSummaryLine[]; moreLines: number } => {
  const lines: BulkSummaryLine[] = [];
  const bySet = new Map<string, BulkSummaryLine>();
  items.forEach((item) => {
    if (item.kind === 'homework' && item.setId) {
      const existing = bySet.get(item.setId);
      if (existing) {
        existing.count += 1;
        return;
      }
      const line: BulkSummaryLine = { kind: 'homework', title: item.title, who: item.groupName || 'Grupa', count: 1 };
      bySet.set(item.setId, line);
      lines.push(line);
      return;
    }
    lines.push({ kind: item.kind, title: item.title, who: item.studentName, count: 1 });
  });
  const safeLimit = Math.max(0, limit);
  return { lines: lines.slice(0, safeLimit), moreLines: Math.max(0, lines.length - safeLimit) };
};

/** Ile usunięć leci naraz — partie po kolei, w partii równolegle. */
export const BULK_DELETE_CHUNK_SIZE = 10;

export const chunkItems = <T>(items: T[], size = BULK_DELETE_CHUNK_SIZE): T[][] => {
  const step = Math.max(1, Math.floor(size) || 1);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += step) out.push(items.slice(i, i + step));
  return out;
};

/** Powody, które mają tłumaczenie w i18n; inne powody to surowy komunikat błędu. */
export const KNOWN_DELETE_ERROR_REASONS: ReadonlySet<string> = new Set([
  'brak uprawnień',
  'brak połączenia z bazą',
  'dokument już nie istnieje',
  'nieznany błąd',
]);

/** Powód błędu do raportu — klucz i18n (Polski tekst) albo surowy komunikat. */
export const describeDeleteError = (err: unknown): string => {
  const code = String((err as { code?: unknown })?.code ?? '');
  if (code.endsWith('permission-denied')) return 'brak uprawnień';
  if (code.endsWith('unavailable')) return 'brak połączenia z bazą';
  if (code.endsWith('not-found')) return 'dokument już nie istnieje';
  const message = (err as { message?: unknown })?.message;
  if (typeof message === 'string' && message.trim()) return message.trim();
  return 'nieznany błąd';
};

export interface BulkDeleteFailure {
  item: BulkDeleteItem;
  reason: string;
}

export interface BulkDeleteReport {
  deleted: BulkDeleteItem[];
  failed: BulkDeleteFailure[];
}

/** Wynik usunięcia jednej pozycji. */
export type BulkDeleteOutcome = { ok: true } | { ok: false; reason: string };

/**
 * Usuwa partiami: w partii równolegle, partie jedna po drugiej. Błąd jednej
 * pozycji nie przerywa reszty. `onProgress(done, total)` po każdej pozycji.
 * Raport zachowuje kolejność wejścia.
 */
export async function runBulkDelete(
  items: BulkDeleteItem[],
  deleteOne: (item: BulkDeleteItem) => Promise<void>,
  options: { chunkSize?: number; onProgress?: (done: number, total: number) => void } = {}
): Promise<BulkDeleteReport> {
  const outcomes: BulkDeleteOutcome[] = new Array(items.length);
  let done = 0;
  const indexed = items.map((item, index) => ({ item, index }));
  for (const chunk of chunkItems(indexed, options.chunkSize)) {
    await Promise.all(
      chunk.map(async ({ item, index }) => {
        try {
          await deleteOne(item);
          outcomes[index] = { ok: true };
        } catch (err) {
          outcomes[index] = { ok: false, reason: describeDeleteError(err) };
        } finally {
          done += 1;
          options.onProgress?.(done, items.length);
        }
      })
    );
  }
  return aggregateBulkResults(items, outcomes);
}

/** Wyniki pojedynczych usunięć → raport (usunięte, błędy z powodem). */
export const aggregateBulkResults = (
  items: BulkDeleteItem[],
  outcomes: Array<BulkDeleteOutcome | undefined>
): BulkDeleteReport => {
  const report: BulkDeleteReport = { deleted: [], failed: [] };
  items.forEach((item, index) => {
    const outcome = outcomes[index];
    if (outcome?.ok) report.deleted.push(item);
    else report.failed.push({ item, reason: outcome && 'reason' in outcome ? outcome.reason : 'nieznany błąd' });
  });
  return report;
};
