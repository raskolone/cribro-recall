/**
 * Lista rozwijana „Kursant" w „Zadania i testy" filtruje prace albo po
 * kursancie, albo po grupie lektora — nigdy po obu naraz. Stan filtra to
 * JEDNA wartość tekstowa (taka sama jak `value` w `<select>`):
 *
 *   `all`            — wszyscy kursanci,
 *   `student:<id>`   — prace jednego kursanta,
 *   `group:<id>`     — prace grupy (dokumenty z `groupId` równym grupie).
 *
 * Chip „Grupa: …" z karty grupy i wybór z listy to ten sam stan: wybór
 * kursanta czyści grupę, wybór grupy czyści kursanta, „Wszyscy" czyści oba.
 *
 * Funkcje są czyste — nie dotykają Firestore ani UI.
 */

export type RecipientFilterValue = string;

export const ALL_RECIPIENTS: RecipientFilterValue = 'all';

const STUDENT_PREFIX = 'student:';
const GROUP_PREFIX = 'group:';

export type RecipientFilterKind = 'all' | 'student' | 'group';

export interface ParsedRecipientFilter {
  kind: RecipientFilterKind;
  /** Id kursanta albo grupy; `null` dla „Wszyscy". */
  id: string | null;
}

export const studentFilterValue = (studentId: string | null | undefined): RecipientFilterValue =>
  studentId && studentId !== 'all' ? `${STUDENT_PREFIX}${studentId}` : ALL_RECIPIENTS;

export const groupFilterValue = (groupId: string | null | undefined): RecipientFilterValue =>
  groupId ? `${GROUP_PREFIX}${groupId}` : ALL_RECIPIENTS;

/** Wartość → rodzaj + id. Pusta, nieznana albo z pustym id → „Wszyscy". */
export const parseRecipientFilter = (value: string | null | undefined): ParsedRecipientFilter => {
  if (value && value.startsWith(STUDENT_PREFIX) && value.length > STUDENT_PREFIX.length) {
    return { kind: 'student', id: value.slice(STUDENT_PREFIX.length) };
  }
  if (value && value.startsWith(GROUP_PREFIX) && value.length > GROUP_PREFIX.length) {
    return { kind: 'group', id: value.slice(GROUP_PREFIX.length) };
  }
  return { kind: 'all', id: null };
};

/**
 * Filtr w kształcie, którego używa reszta ekranu: `studentId` (`'all'` gdy
 * brak — jak dotychczasowy `filterStudentId`) i `groupId` (`null` gdy brak).
 * Najwyżej jedno z nich jest ustawione.
 */
export const recipientFilterParts = (
  value: string | null | undefined
): { studentId: string; groupId: string | null } => {
  const parsed = parseRecipientFilter(value);
  return {
    studentId: parsed.kind === 'student' && parsed.id ? parsed.id : 'all',
    groupId: parsed.kind === 'group' ? parsed.id : null,
  };
};

/** Wartość startowa: wejście z karty grupy wygrywa z kursantem (jak dotąd). */
export const initialRecipientFilter = (
  initialStudentId: string | null | undefined,
  initialGroupId: string | null | undefined
): RecipientFilterValue =>
  initialGroupId ? groupFilterValue(initialGroupId) : studentFilterValue(initialStudentId);

// ---------------------------------------------------------------------------
// Opcje listy rozwijanej
// ---------------------------------------------------------------------------

export interface RecipientGroupLike {
  id: string;
  name?: string | null;
  status?: string | null;
  memberProfileIds?: string[] | null;
}

export interface RecipientStudentLike {
  id?: string | null;
}

export interface RecipientGroupOption {
  value: RecipientFilterValue;
  name: string;
  memberCount: number;
}

export interface RecipientStudentOption {
  value: RecipientFilterValue;
  label: string;
}

export interface RecipientFilterOptions {
  /** Sekcja „Grupy": tylko aktywne, alfabetycznie. Pusta → sekcji nie rysujemy. */
  groups: RecipientGroupOption[];
  /** Sekcja „Kursanci": w kolejności wejścia (jak dotąd). */
  students: RecipientStudentOption[];
}

export interface BuildRecipientFilterOptionsInput<S extends RecipientStudentLike> {
  /** Grupy lektora; `null`/`undefined` = lista się nie wczytała. */
  groups?: RecipientGroupLike[] | null;
  students: S[];
  studentLabel: (student: S) => string;
  /** Bieżąca wartość filtra — wybrana grupa spoza listy dostaje własną opcję. */
  selected?: RecipientFilterValue | null;
  /** Nazwa wybranej grupy, gdy nie ma jej na liście (np. lista się nie wczytała). */
  selectedGroupName?: string | null;
}

const groupName = (g: RecipientGroupLike): string => (g.name || '').trim() || g.id;

export const buildRecipientFilterOptions = <S extends RecipientStudentLike>({
  groups,
  students,
  studentLabel,
  selected,
  selectedGroupName,
}: BuildRecipientFilterOptionsInput<S>): RecipientFilterOptions => {
  const groupOptions: RecipientGroupOption[] = (groups || [])
    .filter((g) => Boolean(g && g.id) && g.status !== 'archived')
    .map((g) => ({
      value: groupFilterValue(g.id),
      name: groupName(g),
      memberCount: Array.isArray(g.memberProfileIds) ? g.memberProfileIds.length : 0,
    }));

  // Wejście z karty grupy, której nie ma na liście (archiwalna, świeża albo
  // lista grup się nie wczytała) — bez tej opcji `<select>` pokazałby
  // „Wszyscy kursanci", choć lista jest przefiltrowana.
  const parsed = parseRecipientFilter(selected);
  if (parsed.kind === 'group' && parsed.id && !groupOptions.some((o) => o.value === selected)) {
    const known = (groups || []).find((g) => g && g.id === parsed.id);
    groupOptions.push({
      value: groupFilterValue(parsed.id),
      name: known ? groupName(known) : (selectedGroupName || '').trim() || parsed.id,
      memberCount: known && Array.isArray(known.memberProfileIds) ? known.memberProfileIds.length : 0,
    });
  }

  groupOptions.sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }));

  const studentOptions: RecipientStudentOption[] = students
    .filter((s) => Boolean(s.id))
    .map((s) => ({ value: studentFilterValue(s.id as string), label: studentLabel(s) }));

  return { groups: groupOptions, students: studentOptions };
};

/**
 * Testy kursantów nie są przypisywane grupom (nie mają `groupId`), więc przy
 * filtrze grupy nie należą do widoku — także do „Zaznacz wszystko w widoku".
 * Przy kursancie i „Wszyscy" lista bez zmian (testy pobiera się już per kursant).
 */
export const filterTestsForRecipient = <T>(tests: T[], value: string | null | undefined): T[] =>
  parseRecipientFilter(value).kind === 'group' ? [] : tests;
