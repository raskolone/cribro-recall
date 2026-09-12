import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
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
