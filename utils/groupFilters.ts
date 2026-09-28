/**
 * Filtrowanie kanonicznych grup (`types/group.ts` → `Group`) dla widoków,
 * które łączą je z legacy pseudo-kursantami (`users/{uid}` z `isGroup`) —
 * CRM (`StandaloneStudentDatabaseScreen.tsx`) i pasek wyboru notatnika
 * (`ScratchpadStudentPicker.tsx`). Wydzielone z tych komponentów, żeby dało
 * się to przetestować bez renderowania Reacta (w repo nie ma
 * @testing-library/react — tylko czyste funkcje w `tests/*.test.ts`).
 */
import { Group } from '../types/group';

export type GroupCrmTabFilter = 'all' | 'active' | 'individual' | 'group';

interface LegacyGroupLikeUser {
  id?: string;
  isGroup?: boolean;
  lessonType?: string;
  displayName?: string;
  name?: string;
  username?: string;
}

/**
 * ID-ki legacy pseudo-kursantów (`users/{uid}` z `isGroup`/`lessonType==='Group'`),
 * które mają już odpowiednik w kanonicznej kolekcji `groups` (po ID albo po
 * nazwie, bez rozróżniania wielkości liter) — do wykluczenia z CRM, żeby ta
 * sama grupa nie pokazywała się dwa razy (raz jako karta grupy, raz jako
 * stary pseudo-kursant). Legacy dokument NIE jest usuwany, tylko pomijany
 * w renderze.
 */
export function findLegacyGroupUserIdsCoveredByCanonical(
  users: LegacyGroupLikeUser[],
  canonicalGroups: Group[]
): Set<string> {
  const covered = new Set<string>();
  (users || []).forEach((s) => {
    if (!s || !(s.isGroup || s.lessonType === 'Group')) return;
    const legacyName = (s.displayName || s.name || s.username || '').trim().toLowerCase();
    const matches = (canonicalGroups || []).some(
      (g) => (g.id && g.id === s.id) || (legacyName.length > 0 && g.name.trim().toLowerCase() === legacyName)
    );
    if (matches && s.id) covered.add(s.id);
  });
  return covered;
}

/**
 * Grupy kanoniczne widoczne w danej zakładce CRM, po zastosowaniu wyszukiwania.
 * "Indywidualni (1:1)" nie pokazuje grup w ogóle; "Aktywni" pokazuje tylko
 * grupy o statusie `active`; "Wszyscy" i "Grupy & Pary" pokazują wszystkie
 * (łącznie z zarchiwizowanymi, tak jak `GroupsManager`).
 */
export function filterCanonicalGroupsForCrm(
  groups: Group[],
  activeTab: GroupCrmTabFilter,
  searchQuery: string
): Group[] {
  if (activeTab === 'individual') return [];
  let list = groups || [];
  if (activeTab === 'active') list = list.filter((g) => g.status === 'active');

  const q = (searchQuery || '').trim().toLowerCase();
  if (q) {
    list = list.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.company || '').toLowerCase().includes(q) ||
        (g.level || '').toLowerCase().includes(q)
    );
  }
  return list;
}

/** Grupy widoczne w pasku wyboru notatnika (`ScratchpadStudentPicker`), filtrowane po nazwie. */
export function filterGroupsForPicker(groups: Group[], searchQuery: string): Group[] {
  const q = (searchQuery || '').trim().toLowerCase();
  if (!q) return groups || [];
  return (groups || []).filter((g) => g.name.toLowerCase().includes(q));
}
