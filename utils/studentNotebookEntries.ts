/**
 * Które wejścia do notatników pokazać na stronie głównej kursanta.
 *
 * Kursant z aktywną grupą dostaje jedno wejście na grupę („Notatnik grupy")
 * w miejscu kafelka „Mój notatnik". Notatnik indywidualny nie znika — zostaje
 * dostępny wewnątrz „Moich zasobów" (flaga `individualNotebookInResources`).
 * Grupy zarchiwizowane i grupy bez notatnika nie dają żadnego wejścia.
 */

export interface StudentGroupInput {
  id: string;
  name: string;
  status: 'active' | 'archived';
  /** Grupa ma już założony notatnik (`activeScratchpadId`). */
  hasNotebook: boolean;
}

export type StudentNotebookTile =
  | { kind: 'individual' }
  | { kind: 'group'; groupId: string; name: string };

export interface StudentNotebookEntries {
  /** Kafelki notatników, w kolejności wyświetlania (po „Moich zasobach" i „Historii"). */
  tiles: StudentNotebookTile[];
  /** Notatnik indywidualny przeniesiony z kafelka do „Moich zasobów". */
  individualNotebookInResources: boolean;
}

export function resolveStudentNotebookEntries(groups: StudentGroupInput[]): StudentNotebookEntries {
  const groupTiles: StudentNotebookTile[] = (groups || [])
    .filter((g) => g && g.status === 'active' && g.hasNotebook)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => ({ kind: 'group', groupId: g.id, name: g.name }));

  if (groupTiles.length === 0) {
    return { tiles: [{ kind: 'individual' }], individualNotebookInResources: false };
  }
  return { tiles: groupTiles, individualNotebookInResources: true };
}
