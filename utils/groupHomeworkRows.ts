import { SpecialTask } from '../types';
import { isPendingStatus } from './homework';

/**
 * Lista prac lektora: jedna praca przypisana wielu kursantom naraz (grupa albo
 * „kilku kursantów") to N dokumentów w `specialTasks` ze wspólnym
 * `homeworkSetId`. Lektor chce widzieć ją jako jeden wiersz.
 *
 * Funkcje są czyste — nie dotykają Firestore ani UI. Podgląd, ocena i edycja
 * dalej działają na pojedynczych dokumentach (`GroupHomeworkMember.task`).
 */

/** Stan pojedynczego dokumentu z punktu widzenia listy lektora. */
export type HomeworkMemberState = 'pending' | 'submitted' | 'graded';

export interface GroupHomeworkMember {
  task: SpecialTask;
  studentUid: string;
  name: string;
  state: HomeworkMemberState;
}

export interface SingleHomeworkRow {
  kind: 'single';
  task: SpecialTask;
  createdMs: number;
  activityMs: number;
}

export interface GroupHomeworkRow {
  kind: 'group';
  homeworkSetId: string;
  /** Nazwa grupy; dla `hwset_multi_` (bez `groupId`) „Kilku kursantów". */
  groupName: string;
  title: string;
  createdAt: string;
  dueDate?: string;
  members: GroupHomeworkMember[];
  /** Ilu kursantów oddało pracę (submitted, graded albo completed). */
  submittedCount: number;
  /** Ilu kursantów czeka na sprawdzenie (submitted bez `teacherRead`). */
  toCheckCount: number;
  total: number;
  /** Status zbiorczy: wszyscy sprawdzeni → graded; ktokolwiek czeka → submitted; reszta → pending. */
  status: HomeworkMemberState;
  createdMs: number;
  activityMs: number;
}

export type HomeworkRow = SingleHomeworkRow | GroupHomeworkRow;

export const MULTI_RECIPIENTS_LABEL = 'Kilku kursantów';
const DEFAULT_GROUP_LABEL = 'Grupa';

const toMillis = (val: any): number => {
  if (!val) return 0;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (val.seconds !== undefined) return val.seconds * 1000;
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'string' || typeof val === 'number') {
    const t = new Date(val).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
};

/** Sprawdzone, ocenione albo odznaczone przez lektora — trafia do zakładki „Sprawdzone". */
export const isArchivedTask = (t: Pick<SpecialTask, 'status' | 'teacherRead'>): boolean =>
  t.status === 'graded' || t.status === 'completed' || t.teacherRead === true;

/** Odesłane i jeszcze nieodznaczone przez lektora. */
export const isAwaitingCheck = (t: Pick<SpecialTask, 'status' | 'teacherRead'>): boolean =>
  t.status === 'submitted' && t.teacherRead !== true;

export const memberState = (t: Pick<SpecialTask, 'status' | 'teacherRead'>): HomeworkMemberState => {
  if (isArchivedTask(t)) return 'graded';
  if (t.status === 'submitted') return 'submitted';
  return 'pending';
};

const activityOf = (t: SpecialTask): number =>
  toMillis(t.reviewedAt || t.submittedAt || t.createdAt);

const toSingle = (task: SpecialTask): SingleHomeworkRow => ({
  kind: 'single',
  task,
  createdMs: toMillis(task.createdAt),
  activityMs: activityOf(task),
});

export interface BuildHomeworkRowsOptions {
  /** Imię kursanta dla dokumentu (domyślnie `studentName`). */
  getName?: (task: SpecialTask) => string;
  /** Czy dokument wolno zwinąć do grupy (np. nie dla zadań silnika v2). */
  canGroup?: (task: SpecialTask) => boolean;
  /** Bez zwijania — każdy dokument osobno (np. wybrany konkretny kursant). */
  group?: boolean;
}

/**
 * Zamienia listę dokumentów na wiersze. Dokumenty o wspólnym `homeworkSetId`
 * (co najmniej 2) → jeden wiersz grupowy; pozostałe (bez setId albo jedyny
 * w zestawie) zostają pojedyncze. Kolejność wejścia nie ma znaczenia —
 * wynik jest posortowany po dacie zadania, od najnowszych.
 */
export const buildHomeworkRows = (
  tasks: SpecialTask[],
  options: BuildHomeworkRowsOptions = {}
): HomeworkRow[] => {
  const { getName, canGroup, group = true } = options;
  const nameOf = (t: SpecialTask) => (getName ? getName(t) : t.studentName) || 'Kursant';

  const bySet = new Map<string, SpecialTask[]>();
  if (group) {
    tasks.forEach((t) => {
      if (!t.homeworkSetId || (canGroup && !canGroup(t))) return;
      const list = bySet.get(t.homeworkSetId) || [];
      list.push(t);
      bySet.set(t.homeworkSetId, list);
    });
  }

  const rows: HomeworkRow[] = [];
  const emitted = new Set<string>();

  tasks.forEach((t) => {
    const setId = t.homeworkSetId;
    const members = setId ? bySet.get(setId) : undefined;
    if (!setId || !members || members.length < 2) {
      rows.push(toSingle(t));
      return;
    }
    if (emitted.has(setId)) return;
    emitted.add(setId);

    const first = members[0];
    const groupMembers: GroupHomeworkMember[] = members
      .map((task) => ({
        task,
        studentUid: task.studentUid || task.studentId,
        name: nameOf(task),
        state: memberState(task),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pl'));

    const named = members.find((m) => m.groupName)?.groupName;
    const isMulti = setId.startsWith('hwset_multi_') || !members.some((m) => m.groupId || m.groupName);
    const toCheckCount = members.filter(isAwaitingCheck).length;
    const allDone = groupMembers.every((m) => m.state === 'graded');

    rows.push({
      kind: 'group',
      homeworkSetId: setId,
      groupName: named || (isMulti ? MULTI_RECIPIENTS_LABEL : DEFAULT_GROUP_LABEL),
      title: first.title,
      createdAt: first.createdAt,
      dueDate: first.dueDate,
      members: groupMembers,
      submittedCount: members.filter(
        (m) => m.status === 'submitted' || m.status === 'graded' || m.status === 'completed'
      ).length,
      toCheckCount,
      total: members.length,
      status: allDone ? 'graded' : toCheckCount > 0 ? 'submitted' : 'pending',
      createdMs: Math.max(...members.map((m) => toMillis(m.createdAt))),
      activityMs: Math.max(...members.map(activityOf)),
    });
  });

  return rows.sort((a, b) => b.createdMs - a.createdMs);
};

export type HomeworkStatusFilter = 'all' | 'pending' | 'submitted' | 'graded' | string;

/**
 * Czy wiersz należy do zakładki „Prace domowe" przy danym filtrze statusu.
 * Pojedyncze dokumenty — dokładnie jak dotąd. Grupa tu zostaje, dopóki nie
 * wszystkie jej dokumenty są sprawdzone; filtr statusu pyta, czy KTÓRYKOLWIEK
 * dokument grupy pasuje.
 */
export const isActiveRow = (row: HomeworkRow, filter: HomeworkStatusFilter): boolean => {
  if (row.kind === 'single') {
    const t = row.task;
    if (filter === 'submitted') return isAwaitingCheck(t);
    if (filter === 'pending') return isPendingStatus(t.status);
    if (filter === 'graded') return false;
    return isPendingStatus(t.status) || isAwaitingCheck(t);
  }
  if (row.status === 'graded') return false;
  const tasks = row.members.map((m) => m.task);
  if (filter === 'submitted') return tasks.some(isAwaitingCheck);
  if (filter === 'pending') return tasks.some((t) => isPendingStatus(t.status));
  if (filter === 'graded') return false;
  return true;
};

/** Czy wiersz należy do zakładki „Sprawdzone": pojedynczy sprawdzony albo grupa w całości sprawdzona. */
export const isArchivedRow = (row: HomeworkRow): boolean =>
  row.kind === 'single' ? isArchivedTask(row.task) : row.status === 'graded';
