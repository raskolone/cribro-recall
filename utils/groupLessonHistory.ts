/**
 * Historia lekcji grupy — złączenie kopii jednej lekcji grupowej.
 *
 * Lekcja grupowa jest zapisywana jako N dokumentów `users/{uid}/lessonRecords`
 * (po jednym na kursanta), połączonych wspólnym `groupLessonId` i `groupId`
 * (AdminPanel → `handleSaveLessonRecord`). Karta grupy czyta lekcje członków
 * z istniejącego cache `getLessonRecordsForStudent` i dopiero tutaj skleja je
 * w jeden wpis na lekcję — bez collectionGroup i bez nowego indeksu Firestore.
 */
import type { LessonRecord, User } from '../types';
import type { Group } from '../types/group';

/**
 * Rozjazd `updatedAt` między kopiami, powyżej którego uznajemy, że kopie były
 * edytowane osobno. Sam zapis grupowy tworzy kopie po kolei (każda ma własne
 * `now`), więc kilka–kilkadziesiąt sekund różnicy to norma, nie edycja.
 */
export const GROUP_COPIES_DIFFER_TOLERANCE_MS = 2 * 60 * 1000;

export interface GroupLessonEntry {
  groupLessonId: string;
  /** Kopia z najnowszym `updatedAt` — ją pokazujemy i ją otwiera edycja. */
  representative: LessonRecord;
  copyCount: number;
  /**
   * Ile kopii zapisano (pole `studentIds` kopii). Może być większe niż
   * `copyCount`, gdy lekcję zapisano też kursantowi spoza obecnego składu
   * grupy — jego kopii nie czytamy (historia idzie po `memberProfileIds`).
   */
  savedCopyCount: number;
  /** Kursanci, u których leży kopia tej lekcji (`studentId` kopii). */
  memberIds: string[];
  /** `updatedAt` kopii rozjeżdża się o więcej niż tolerancja. */
  copiesDiffer: boolean;
}

function timeOf(record: LessonRecord): number {
  const raw = (record as any).updatedAt ?? (record as any).createdAt;
  if (!raw) return 0;
  // Firestore Timestamp (gdyby trafił się w starszym dokumencie) albo ISO string.
  if (typeof raw === 'object' && typeof raw.toMillis === 'function') return raw.toMillis();
  const parsed = Date.parse(String(raw));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Skleja kopie lekcji danej grupy w jeden wpis na `groupLessonId`.
 *
 * - bierze tylko rekordy z `groupId === groupId`,
 * - rekordy bez `groupLessonId` pomija (nie da się ich bezpiecznie złączyć),
 * - ten sam dokument przekazany dwa razy (ten sam kursant + id) liczy raz,
 * - sortuje malejąco po dacie lekcji, potem po `updatedAt`.
 */
export function mergeGroupLessonCopies(records: LessonRecord[], groupId: string): GroupLessonEntry[] {
  if (!groupId || !Array.isArray(records) || records.length === 0) return [];

  const buckets = new Map<string, LessonRecord[]>();
  const seenDocs = new Set<string>();

  for (const record of records) {
    if (!record || record.groupId !== groupId) continue;
    const glid = typeof record.groupLessonId === 'string' ? record.groupLessonId.trim() : '';
    if (!glid) continue;
    const docKey = `${record.studentId || ''}/${record.id}`;
    if (seenDocs.has(docKey)) continue;
    seenDocs.add(docKey);
    const bucket = buckets.get(glid);
    if (bucket) bucket.push(record);
    else buckets.set(glid, [record]);
  }

  const entries: GroupLessonEntry[] = [];
  buckets.forEach((copies, groupLessonId) => {
    let representative = copies[0];
    let minTime = timeOf(copies[0]);
    let maxTime = minTime;
    for (const copy of copies.slice(1)) {
      const t = timeOf(copy);
      if (t > maxTime) {
        maxTime = t;
        representative = copy;
      }
      if (t < minTime) minTime = t;
    }
    entries.push({
      groupLessonId,
      representative,
      copyCount: copies.length,
      savedCopyCount: Math.max(
        copies.length,
        ...copies.map((c) => (Array.isArray(c.studentIds) ? new Set(c.studentIds).size : 0))
      ),
      memberIds: Array.from(new Set(copies.map((c) => c.studentId).filter(Boolean))),
      copiesDiffer: maxTime - minTime > GROUP_COPIES_DIFFER_TOLERANCE_MS,
    });
  });

  return entries.sort((a, b) => {
    const byDate = String(b.representative.date || '').localeCompare(String(a.representative.date || ''));
    if (byDate !== 0) return byDate;
    return timeOf(b.representative) - timeOf(a.representative);
  });
}

type MemberLike = Pick<User, 'id' | 'isArchived' | 'isSuspended' | 'statusWspolpracy'>;

/**
 * Aktywni członkowie grupy — ten sam warunek co lista kursantów do wyboru
 * w `GroupsManager.tsx` (pomija zarchiwizowanych, zawieszonych, nieaktywnych
 * oraz ID, których nie ma na liście kursantów lektora).
 */
export function pickActiveGroupMemberIds(memberProfileIds: string[] | undefined, users: MemberLike[]): string[] {
  return (memberProfileIds || []).filter((id) => {
    const member = users.find((u) => u.id === id);
    return Boolean(member && !member.isArchived && !member.isSuspended && member.statusWspolpracy !== 'Nieaktywny');
  });
}

export interface GroupLessonFormPreset {
  groupId: string;
  groupName: string;
  studentIds: string[];
  primaryStudentId: string;
}

/** Stan formularza lekcji otwieranego z karty grupy („+ Lekcja"). */
export function buildGroupLessonFormPreset(
  group: Pick<Group, 'id' | 'name' | 'memberProfileIds'>,
  users: MemberLike[]
): GroupLessonFormPreset {
  const studentIds = pickActiveGroupMemberIds(group.memberProfileIds, users);
  return {
    groupId: group.id,
    groupName: group.name,
    studentIds,
    primaryStudentId: studentIds[0] || '',
  };
}

/**
 * `groupLessonId` dla zapisu formularza. Edycja kopii, która należy już do
 * tej samej grupy, zachowuje jej identyfikator — inaczej edytowana kopia
 * odpadłaby od pozostałych i w historii grupy pojawiłaby się jako osobna lekcja.
 */
export function resolveGroupLessonIdForSave(
  formGroupId: string,
  editedRecord: Pick<LessonRecord, 'groupId' | 'groupLessonId'> | null | undefined,
  generate: () => string
): string | undefined {
  if (!formGroupId) return undefined;
  if (editedRecord?.groupLessonId && editedRecord.groupId === formGroupId) {
    return editedRecord.groupLessonId;
  }
  return generate();
}

export interface AiSummaryStudents {
  studentIds: string[];
  primaryStudentId: string;
}

/**
 * Kursanci formularza po zastosowaniu wyniku AI (`applySingleSummary`).
 *
 * AI zgaduje kursantów z treści notatek — dla lekcji grupowej to zawsze
 * pojedynczy `studentId`. Gdy formularz ma już wybraną grupę, wygrywa ona
 * i jej zaznaczeni członkowie (lektor mógł odznaczyć nieobecnych); wynik AI
 * zmienia wtedy tylko pola treści. Bez grupy zostaje dotychczasowa kolejność:
 * kursanci z AI.
 */
export function resolveStudentsForAiSummary(input: {
  formGroupId: string;
  currentStudentIds: string[];
  currentPrimaryStudentId: string;
  aiStudentIds: string[];
}): AiSummaryStudents {
  if (input.formGroupId) {
    const studentIds = input.currentStudentIds;
    return { studentIds, primaryStudentId: input.currentPrimaryStudentId || studentIds[0] || '' };
  }
  return { studentIds: input.aiStudentIds, primaryStudentId: input.aiStudentIds[0] || '' };
}
