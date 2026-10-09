import { SpecialTask } from '../types';
import {
  buildHomeworkRows,
  filterTasksByGroup,
  HomeworkRow,
  isActiveRow,
  isArchivedRow,
} from './groupHomeworkRows';
import { filterHomeworkRows } from './homeworkSearch';

/**
 * Lista prac lektora ma dwa widoki — Lista i Kafelki. Oba rysują TE SAME
 * wiersze: wybór widoku zmienia wyłącznie sposób rysowania, nigdy zestaw.
 * Wszystkie filtry (grupa, kursant, status, wyszukiwarka) i zwijanie wierszy
 * grupowych po `homeworkSetId` dzieją się tutaj, raz, a `HomeworkScreen` oddaje
 * wynik obu rendererom.
 */

export interface HomeworkViewRowsInput {
  tasks: SpecialTask[];
  /** Filtr karty grupy; `null` = wszystkie grupy. */
  groupId: string | null;
  /** Czy dokument należy do wybranego kursanta; brak = filtr „Wszyscy". */
  matchesStudent?: (task: SpecialTask) => boolean;
  /** Zwijać prace wspólne w wiersz grupowy (wyłączone przy wybranym kursancie). */
  collapseGroups: boolean;
  /** Filtr statusu zakładki „Prace domowe" (`all` / `pending` / `submitted`). */
  status: string;
  /** Fraza wyszukiwarki. */
  search: string;
  getName: (task: SpecialTask) => string;
  /** Czy dokument wolno zwinąć do grupy (nie dla zadań silnika v2). */
  canGroup?: (task: SpecialTask) => boolean;
}

export interface HomeworkViewRows {
  /** Wszystkie wiersze po filtrze grupy i kursanta, przed statusem i wyszukiwarką. */
  all: HomeworkRow[];
  /** Zakładka „Prace domowe" po statusie, bez wyszukiwarki. */
  active: HomeworkRow[];
  /** Zakładka „Sprawdzone przez nauczyciela" po wyszukiwarce, bez statusu. */
  archived: HomeworkRow[];
  /** Co widać w „Prace domowe": to rysują Lista i Kafelki. */
  visibleActive: HomeworkRow[];
  /** Co widać w „Sprawdzone przez nauczyciela". */
  visibleArchived: HomeworkRow[];
}

export const selectHomeworkViewRows = ({
  tasks,
  groupId,
  matchesStudent,
  collapseGroups,
  status,
  search,
  getName,
  canGroup,
}: HomeworkViewRowsInput): HomeworkViewRows => {
  const scoped = filterTasksByGroup(tasks, groupId).filter((t) => (matchesStudent ? matchesStudent(t) : true));
  const all = buildHomeworkRows(scoped, { getName, canGroup, group: collapseGroups });
  const active = all.filter((r) => isActiveRow(r, status));
  const archivedAll = all.filter(isArchivedRow).sort((a, b) => b.activityMs - a.activityMs);
  return {
    all,
    active,
    archived: archivedAll,
    visibleActive: filterHomeworkRows(active, search, getName),
    visibleArchived: filterHomeworkRows(archivedAll, search, getName),
  };
};

/** Klucz wiersza do porównań: ten sam zestaw = te same klucze w tej samej kolejności. */
export const homeworkRowKey = (row: HomeworkRow): string =>
  row.kind === 'group' ? `set:${row.homeworkSetId}` : `task:${row.task.id}`;

// ---------------------------------------------------------------------------
// Zapamiętany widok (Lista / Kafelki) — osobno dla każdej sekcji.
// ---------------------------------------------------------------------------

export type HomeworkViewScope = 'work-center' | 'student-profile';
export type HomeworkViewMode = 'list' | 'tiles';

/** Dawny, wspólny dla wszystkich ekranów klucz — czytany już tylko jako wartość startowa. */
export const LEGACY_VIEW_MODE_KEY = 'cribro:homework-view';

export const viewModeStorageKey = (scope: HomeworkViewScope): string => `${LEGACY_VIEW_MODE_KEY}:${scope}`;

/** Sekcja ekranu: moduł „Zadania i testy" (`headless`) albo zakładka prac w profilu kursanta. */
export const viewScopeFor = (headless: boolean): HomeworkViewScope => (headless ? 'work-center' : 'student-profile');

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

/**
 * Zapisany widok sekcji. Gdy sekcja nie ma jeszcze własnego wyboru, bierze
 * dawny wspólny klucz (żeby po wdrożeniu nikt nie tracił swojego widoku);
 * pierwsze kliknięcie zapisze już klucz sekcji. Błąd dostępu → Lista.
 */
export const readViewMode = (storage: ReadableStorage | null | undefined, scope: HomeworkViewScope): HomeworkViewMode => {
  try {
    const own = storage?.getItem(viewModeStorageKey(scope));
    if (own === 'tiles' || own === 'list') return own;
    return storage?.getItem(LEGACY_VIEW_MODE_KEY) === 'tiles' ? 'tiles' : 'list';
  } catch {
    return 'list';
  }
};

export const writeViewMode = (
  storage: WritableStorage | null | undefined,
  scope: HomeworkViewScope,
  mode: HomeworkViewMode
): void => {
  try {
    storage?.setItem(viewModeStorageKey(scope), mode);
  } catch {
    /* Tryb prywatny — wybór zadziała, tylko go nie zapamiętamy. */
  }
};
