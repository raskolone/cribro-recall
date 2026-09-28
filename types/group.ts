/**
 * Kanoniczny model grup i fan-outu zadań domowych (P1).
 *
 * ŻELAZNY INWARIANT:
 * Jedynym źródłem prawdy dla zajęć grupowych jest kolekcja `groups/{groupId}`.
 * Dokument grupy zawiera wyłącznie identyfikatory `memberProfileIds` (usr_... / auth.uid),
 * bez powielania danych osobowych kursantów.
 */

export type GroupStatus = 'active' | 'archived';

export interface Group {
  id: string;                    // np. "grp_business_b2_mon"
  name: string;                  // np. "Business English B2 — Poniedziałki 18:00"
  teacherProfileId: string;      // UID lektora (właściciela)
  status: GroupStatus;           // Archiwizacja zamiast twardego usuwania
  level: string;                 // np. "B2", "C1"
  company?: string;              // Opcjonalna nazwa firmy (B2B)
  
  // Lista identyfikatorów kanonicznych kursantów (usr_...)
  memberProfileIds: string[];    // max 10-12 osób
  
  activeScratchpadId?: string;   // ID aktualnie przypisanego notatnika A4
  
  createdAt: string;             // ISO Timestamp
  updatedAt: string;             // ISO Timestamp
}

export interface GroupMemberPreview {
  profileId: string;
  name: string;
  email: string;
  isActivated?: boolean;
  isSuspended?: boolean;
  isArchived?: boolean;
}

export interface GroupWithMembers extends Group {
  members: GroupMemberPreview[];
}

export interface CreateGroupPayload {
  name: string;
  level: string;
  company?: string;
  memberProfileIds: string[];
  activeScratchpadId?: string;
}

export interface UpdateGroupPayload {
  name?: string;
  level?: string;
  company?: string;
  status?: GroupStatus;
  memberProfileIds?: string[];
  activeScratchpadId?: string;
}

export interface GroupHomeworkAssignmentItem {
  studentProfileId: string;
  studentName: string;
  studentEmail: string;
  taskId: string;
  accessToken: string;
  directUrl: string;
}

export interface GroupHomeworkFanOutResult {
  groupId: string;
  groupName: string;
  homeworkSetId: string;
  assignedCount: number;
  skippedInactive: string[];
  assignments: GroupHomeworkAssignmentItem[];
  createdAt: string;
}

/**
 * Sprowadza surowy dokument grupy (kanoniczny albo legacy `StudentGroup`,
 * albo częściowo uszkodzony) do kształtu `Group`. Widoki nie mają czytać
 * `memberProfileIds`/`teacherProfileId` bezpośrednio z surowych danych —
 * zawsze przez tę funkcję, żeby legacy pola (`memberIds`/`teacherId`) nie
 * trzeba było znać w każdym miejscu z osobna.
 */
export function normalizeGroup(raw: unknown): Group {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;

  const memberProfileIds = Array.isArray(data.memberProfileIds)
    ? data.memberProfileIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
    : Array.isArray(data.memberIds)
      ? data.memberIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];

  const group: Group = {
    id: typeof data.id === 'string' ? data.id : '',
    name: typeof data.name === 'string' ? data.name : '',
    teacherProfileId:
      typeof data.teacherProfileId === 'string'
        ? data.teacherProfileId
        : typeof data.teacherId === 'string'
          ? data.teacherId
          : '',
    status: data.status === 'archived' ? 'archived' : 'active',
    level: typeof data.level === 'string' ? data.level : '',
    memberProfileIds,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };

  if (typeof data.company === 'string' && data.company.trim()) {
    group.company = data.company;
  }
  if (typeof data.activeScratchpadId === 'string' && data.activeScratchpadId.trim()) {
    group.activeScratchpadId = data.activeScratchpadId;
  }

  return group;
}
