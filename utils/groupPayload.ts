/**
 * Budowa payloadu nowej grupy (kolekcja `groups/{groupId}`).
 *
 * Wydzielone z `server.ts`, żeby dało się to przetestować bez Express/Firestore
 * i żeby przyczyna błędu "Cannot use 'undefined' as a Firestore value" (brak
 * teacherProfileId, gdy middleware nie ustawiło identyfikatora lektora) była
 * sprawdzana w jednym miejscu.
 */
import { Group } from '../types/group';

export class MissingTeacherProfileError extends Error {
  code = 'missing_teacher_profile';
  constructor() {
    super('Nie udało się zidentyfikować profilu lektora. Zaloguj się ponownie.');
    this.name = 'MissingTeacherProfileError';
  }
}

export interface CreateGroupInput {
  name: string;
  level?: string;
  company?: string;
  memberProfileIds?: unknown;
  activeScratchpadId?: string;
}

/**
 * Buduje dokument grupy. Rzuca `MissingTeacherProfileError`, jeśli brak
 * identyfikatora lektora — nigdy nie zwraca payloadu z polem `undefined`
 * (Firestore `.set()` odrzuca taki zapis).
 */
export function buildNewGroupPayload(
  teacherUid: string | undefined | null,
  groupId: string,
  input: CreateGroupInput,
  nowIso: string
): Group {
  if (!teacherUid || typeof teacherUid !== 'string') {
    throw new MissingTeacherProfileError();
  }

  const cleanMemberIds = Array.isArray(input.memberProfileIds)
    ? Array.from(new Set(input.memberProfileIds.map((id: any) => String(id).trim()).filter(Boolean)))
    : [];

  const payload: Group = {
    id: groupId,
    name: input.name.trim(),
    teacherProfileId: teacherUid,
    status: 'active',
    level: (input.level || 'B2').trim(),
    memberProfileIds: cleanMemberIds,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const company = input.company ? String(input.company).trim() : '';
  if (company) {
    payload.company = company;
  }

  const activeScratchpadId = input.activeScratchpadId ? String(input.activeScratchpadId).trim() : '';
  if (activeScratchpadId) {
    payload.activeScratchpadId = activeScratchpadId;
  }

  return payload;
}
