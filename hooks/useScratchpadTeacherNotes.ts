import { useEffect, useState } from 'react';
import { subscribeScratchpadTeacherNotes } from '../services/scratchpadService';
import { resolveTeacherNotes } from '../utils/teacherNotes';

/**
 * Prywatne notatki lektora dla notatnika `scratchpadId`.
 *
 * `enabled` musi być `false` u kursanta — reguły i tak odmówią odczytu
 * `private/teacher`, a subskrypcja tylko zaśmiecałaby konsolę błędami.
 * `legacyNotes` to pole `teacherNotes` z dokumentu nadrzędnego (sprzed
 * migracji), używane, dopóki nie ma dokumentu prywatnego.
 */
export function useScratchpadTeacherNotes(
  scratchpadId: string | undefined,
  enabled: boolean,
  legacyNotes: string | undefined
): string {
  const [privateNotes, setPrivateNotes] = useState<string | null>(null);

  useEffect(() => {
    setPrivateNotes(null);
    if (!enabled || !scratchpadId) return;
    return subscribeScratchpadTeacherNotes(scratchpadId, setPrivateNotes);
  }, [scratchpadId, enabled]);

  return resolveTeacherNotes(enabled ? privateNotes : null, enabled ? legacyNotes : undefined);
}
