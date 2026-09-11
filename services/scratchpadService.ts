import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  increment,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ScratchpadDocument } from '../types';
import {
  generateAccessCode,
  normalizeAccessCode,
  formatAccessCode,
} from '../utils/accessCode';

export const scratchpadDocRef = (id: string) => doc(db, 'scratchpads', id);

/**
 * Zwraca bazowy szablon HTML dla nowo tworzonego dokumentu brudnopisu.
 */
export function getInitialScratchpadContent(studentName: string): {
  html: string;
  text: string;
} {
  const today = new Date().toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const html = `<h2>📝 Lekcja — ${today}</h2><p>Wspólny brudnopis notatek z zajęć z <strong>${studentName}</strong>.</p><h3>💡 Nowe słownictwo i zwroty</h3><ul><li>...</li></ul><h3>⚡ Poprawki i wymowa</h3><ul><li>...</li></ul><h3>🎯 Ustalenia i praca własna</h3><p>...</p>`;

  const text = `## Lekcja — ${today}\nWspólny brudnopis notatek z zajęć z ${studentName}.\n\n### Nowe słownictwo i zwroty\n- ...\n\n### Poprawki i wymowa\n- ...\n\n### Ustalenia i praca własna\n...`;

  return { html, text };
}

/**
 * Pobiera istniejący stały brudnopis kursanta lub tworzy dokładnie jeden unikalny
 * dokument dla danej osoby. Gwarantuje, że kursant ma 1 stały link / PIN na całą naukę.
 */
export async function getOrCreateStudentScratchpad(
  student: { id?: string | null; name: string },
  teacher: { uid: string; name: string }
): Promise<ScratchpadDocument> {
  const studentId = student.id?.trim() || null;
  const docId = studentId ? `sp_${studentId}` : `sp_${Date.now()}`;
  const ref = scratchpadDocRef(docId);

  // 1. Sprawdź, czy dokument już istnieje
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data() as ScratchpadDocument;
  }

  // 2. Jeśli nie istnieje, wygeneruj unikalny kod PIN
  let pin = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = normalizeAccessCode(generateAccessCode(6));
    // Sprawdź unikalność PIN-u w kolekcji
    const q = query(
      collection(db, 'scratchpads'),
      where('pin', '==', candidate)
    );
    const existing = await getDocs(q);
    if (existing.empty) {
      pin = candidate;
      break;
    }
  }

  if (!pin) {
    pin = normalizeAccessCode(generateAccessCode(6));
  }

  const now = new Date().toISOString();
  const initial = getInitialScratchpadContent(student.name);

  const newDoc: ScratchpadDocument = {
    id: docId,
    pin,
    studentId: studentId || undefined,
    studentName: student.name || 'Kursant',
    teacherUid: teacher.uid,
    teacherName: teacher.name || 'Lektor CRIBRO',
    title: `Brudnopis lekcyjny — ${student.name}`,
    contentHtml: initial.html,
    contentText: initial.text,
    allowStudentEdit: false, // Domyślnie bezpieczny tryb podglądu na żywo dla kursanta
    createdAt: now,
    updatedAt: now,
    lastEditedBy: {
      uid: teacher.uid,
      name: teacher.name || 'Lektor',
      role: 'teacher',
    },
    version: 1,
  };

  await setDoc(ref, newDoc);
  return newDoc;
}

/**
 * Wyszukuje dokument Scratchpada po kodzie PIN (wpisanym przez ucznia lub z linku).
 */
export async function findScratchpadByPin(
  rawPin: string
): Promise<ScratchpadDocument | null> {
  if (!rawPin) return null;
  const pin = normalizeAccessCode(rawPin);

  // Najpierw zapytanie po indeksie pola `pin`
  const q = query(collection(db, 'scratchpads'), where('pin', '==', pin));
  const snap = await getDocs(q);

  if (!snap.empty) {
    return snap.docs[0].data() as ScratchpadDocument;
  }

  // Sprawdź czy ID to `sp_${pin}`
  const directSnap = await getDoc(scratchpadDocRef(`sp_${pin}`));
  if (directSnap.exists()) {
    return directSnap.data() as ScratchpadDocument;
  }

  return null;
}

/**
 * Subskrypcja zmian dokumentu w czasie rzeczywistym (Real-time onSnapshot).
 */
export function subscribeScratchpad(
  id: string,
  onUpdate: (doc: ScratchpadDocument | null) => void,
  onError?: (err: Error) => void
): () => void {
  const ref = scratchpadDocRef(id);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as ScratchpadDocument);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.error('Błąd subskrypcji Scratchpada:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Zapisuje zaktualizowaną treść HTML i tekstową dokumentu z metadanymi edytora.
 */
export async function saveScratchpadContent(
  id: string,
  contentHtml: string,
  contentText: string,
  editorMeta?: { uid: string; name: string; role: 'teacher' | 'student' }
): Promise<void> {
  const ref = scratchpadDocRef(id);
  const patch: any = {
    contentHtml,
    contentText,
    updatedAt: new Date().toISOString(),
    version: increment(1),
  };

  if (editorMeta) {
    patch.lastEditedBy = editorMeta;
  }

  await updateDoc(ref, patch);
}

/**
 * Aktualizuje metadane i uprawnienia dokumentu (np. tytuł, allowStudentEdit).
 */
export async function updateScratchpadSettings(
  id: string,
  patch: Partial<ScratchpadDocument>
): Promise<void> {
  const ref = scratchpadDocRef(id);
  await updateDoc(ref, {
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Generuje pełny bezpośredni link do Scratchpada z kodem PIN.
 */
export function buildScratchpadUrl(pin: string): string {
  const formatted = formatAccessCode(pin);
  if (typeof window === 'undefined') {
    return `https://cribro.pl/scratchpad?pin=${formatted}`;
  }
  return `${window.location.origin}/scratchpad?pin=${formatted}`;
}
