import type { Firestore } from 'firebase-admin/firestore';

/**
 * Rzucany, gdy Gemini poda `studentRef`, który nie da się jednoznacznie
 * rozstrzygnąć do jednego kursanta. `code` pozwala wywołującemu (endpoint
 * HTTP) zmapować błąd na właściwy status, a `candidates` daje modelowi
 * czytelną listę do doprecyzowania pytania do lektora.
 */
export class StudentResolutionError extends Error {
  code: 'not-found' | 'ambiguous';
  candidates?: Array<{ id: string; displayName: string }>;
  constructor(code: 'not-found' | 'ambiguous', message: string, candidates?: Array<{ id: string; displayName: string }>) {
    super(message);
    this.code = code;
    this.candidates = candidates;
  }
}

function isActiveStudent(data: any): boolean {
  if (!data) return false;
  if (data.isArchived) return false;
  return !data.role || data.role === 'user';
}

/**
 * Rozstrzyga `studentRef` (imię/nazwa wyświetlana LUB ID dokumentu) do
 * konkretnego kursanta, wyłącznie w zbiorze aktywnych, niearchiwizowanych
 * kursantów (`role` puste lub `'user'`) — dokładnie ten sam, globalny zbiór,
 * jakiego już dziś używa `/api/scenario/generate` i `buildStudentIndex()`
 * w czacie po stronie klienta. W bazie nie istnieje żadne pole wiążące
 * kursanta z konkretnym lektorem (`teacherUid`/`teacherId` występują tylko
 * na grupach/scratchpadach/sesjach, nigdy na dokumencie kursanta) — apka
 * działa w modelu jeden-lektor-na-wdrożenie, więc dowolny zalogowany,
 * uwierzytelniony lektor/admin widzi tu ten sam zbiór, co już widzi w
 * innych miejscach aplikacji. Żadnej niejednoznaczności nie zgadujemy:
 * brak dopasowania lub kilka dopasowań kończy się jawnym błędem.
 */
export async function resolveStudentRef(
  adminDb: Firestore,
  studentRef: string
): Promise<{ studentId: string; displayName: string }> {
  const ref = studentRef.trim();
  if (!ref) {
    throw new StudentResolutionError('not-found', 'Nie podano kursanta.');
  }

  // Najpierw spróbuj bezpośrednio jako ID dokumentu — jednoznaczne z definicji.
  const directSnap = await adminDb.collection('users').doc(ref).get();
  if (directSnap.exists && isActiveStudent(directSnap.data())) {
    const data = directSnap.data() || {};
    return { studentId: directSnap.id, displayName: String(data.displayName || data.name || ref) };
  }

  const usersSnap = await adminDb.collection('users').get();
  const activeStudents = usersSnap.docs
    .map(doc => ({ id: doc.id, data: doc.data() || {} }))
    .filter(({ data }) => isActiveStudent(data));

  const refFold = ref.toLocaleLowerCase('pl');
  const exactMatches = activeStudents.filter(({ data }) => {
    const name = String(data.displayName || data.name || '').trim();
    return name.toLocaleLowerCase('pl') === refFold;
  });

  let matches = exactMatches;
  if (matches.length === 0) {
    matches = activeStudents.filter(({ data }) => {
      const name = String(data.displayName || data.name || '').trim();
      return name.toLocaleLowerCase('pl').includes(refFold);
    });
  }

  if (matches.length === 0) {
    throw new StudentResolutionError('not-found', `Nie znaleziono kursanta pasującego do „${ref}".`);
  }

  if (matches.length > 1) {
    const candidates = matches.map(({ id, data }) => ({
      id,
      displayName: String(data.displayName || data.name || id),
    }));
    throw new StudentResolutionError(
      'ambiguous',
      `Kilku kursantów pasuje do „${ref}" (${candidates.map(c => c.displayName).join(', ')}) — doprecyzuj imię/nazwisko albo podaj ID kursanta.`,
      candidates
    );
  }

  const { id, data } = matches[0];
  return { studentId: id, displayName: String(data.displayName || data.name || id) };
}
