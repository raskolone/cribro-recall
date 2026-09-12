import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ScratchpadTemplate } from '../types';

/**
 * Szablony treści do wstawiania we wspólny notatnik.
 *
 * Kolekcja `scratchpadTemplates` jest osobna od `scratchpads`/`scratchpadPins`
 * i zarządza nią wyłącznie lektor/admin (`firestore.rules`) — kursant nigdy
 * nie czyta jej bezpośrednio, widzi tylko wynik wstawienia szablonu w
 * `contentHtml` własnego notatnika.
 */

const templatesCollectionRef = () => collection(db, 'scratchpadTemplates');
const templateDocRef = (id: string) => doc(db, 'scratchpadTemplates', id);

/** Lista wszystkich zapisanych szablonów, najnowsze na górze. */
export async function listScratchpadTemplates(): Promise<ScratchpadTemplate[]> {
  const snap = await getDocs(query(templatesCollectionRef(), orderBy('updatedAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ScratchpadTemplate, 'id'>) }));
}

/** Tworzy nowy szablon i zwraca jego pełny zapis (z wygenerowanym ID). */
export async function createScratchpadTemplate(
  data: { title: string; contentHtml: string },
  createdBy: string
): Promise<ScratchpadTemplate> {
  const now = new Date().toISOString();
  const ref = doc(templatesCollectionRef());
  const template: ScratchpadTemplate = {
    id: ref.id,
    title: data.title.trim() || 'Bez tytułu',
    contentHtml: data.contentHtml,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(ref, {
    title: template.title,
    contentHtml: template.contentHtml,
    createdBy: template.createdBy,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  });
  return template;
}

/** Aktualizuje tytuł i/lub treść istniejącego szablonu. */
export async function updateScratchpadTemplate(
  id: string,
  patch: Partial<Pick<ScratchpadTemplate, 'title' | 'contentHtml'>>
): Promise<void> {
  await updateDoc(templateDocRef(id), {
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

/** Usuwa szablon. */
export async function deleteScratchpadTemplate(id: string): Promise<void> {
  await deleteDoc(templateDocRef(id));
}

/**
 * Szablon domyślny — wstawiany automatycznie do treści KAŻDEGO nowego
 * notatnika (patrz `getOrCreateStudentScratchpad` w `scratchpadService.ts`).
 * Odczyt może się nie udać kursantowi (reguła `isAdmin()`-only) — wołający
 * ma na to gotowy fallback, więc funkcja celowo nie łyka błędu tutaj.
 */
export async function getDefaultTemplate(): Promise<ScratchpadTemplate | null> {
  const snap = await getDocs(query(templatesCollectionRef(), where('isDefault', '==', true)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<ScratchpadTemplate, 'id'>) };
}

/**
 * Ustawia dany szablon jako domyślny i odznacza pozostałe — jeden batch,
 * żeby nigdy nie było dwóch domyślnych naraz (co dałoby niezdeterminowany
 * wybór w `getDefaultTemplate`, bo zapytanie nie sortuje wyników).
 */
export async function setDefaultTemplate(id: string): Promise<void> {
  const snap = await getDocs(query(templatesCollectionRef(), where('isDefault', '==', true)));
  const batch = writeBatch(db);
  snap.docs.forEach(d => {
    if (d.id !== id) batch.update(d.ref, { isDefault: false });
  });
  batch.update(templateDocRef(id), { isDefault: true, updatedAt: new Date().toISOString() });
  await batch.commit();
}

/** Odznacza dany szablon jako domyślny (bez wskazywania nowego). */
export async function clearDefaultTemplate(id: string): Promise<void> {
  await updateDoc(templateDocRef(id), { isDefault: false, updatedAt: new Date().toISOString() });
}
