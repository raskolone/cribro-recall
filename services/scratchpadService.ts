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

const LOCAL_STORAGE_PREFIX = 'cribro_scratchpad_';
const PIN_MAP_PREFIX = 'cribro_sp_pin_';
const INDEX_KEY = 'cribro_scratchpads_index';

export function getLocalScratchpad(id: string): ScratchpadDocument | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${id}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('LocalStorage read error:', e);
  }
  return null;
}

export function saveLocalScratchpad(docData: ScratchpadDocument): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${docData.id}`, JSON.stringify(docData));
    if (docData.pin) {
      localStorage.setItem(`${PIN_MAP_PREFIX}${normalizeAccessCode(docData.pin)}`, docData.id);
    }
    const indexRaw = localStorage.getItem(INDEX_KEY);
    const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
    if (!index.includes(docData.id)) {
      index.push(docData.id);
      localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    }
  } catch (e) {
    console.warn('LocalStorage write error:', e);
  }
}

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
 * dokument dla danej osoby. Działa local-first z automatyczną odpornością na błędy uprawnień Firestore.
 */
export async function getOrCreateStudentScratchpad(
  student: { id?: string | null; name: string },
  teacher: { uid: string; name: string }
): Promise<ScratchpadDocument> {
  const studentId = student.id?.trim() || null;
  const docId = studentId ? `sp_${studentId}` : `sp_${Date.now()}`;
  const ref = scratchpadDocRef(docId);

  // 1. Sprawdź lokalną kopię brudnopisu (dla odporności i natychmiastowego startu)
  const localDoc = getLocalScratchpad(docId);

  // 2. Spróbuj pobrać z Firestore
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const cloudDoc = snap.data() as ScratchpadDocument;
      saveLocalScratchpad(cloudDoc);
      return cloudDoc;
    }
  } catch (firestoreErr: any) {
    console.warn(
      '[Scratchpad] Błąd odczytu z Cloud Firestore (używam lokalnej pamięci podręcznej):',
      firestoreErr?.message || firestoreErr
    );
    if (localDoc) {
      return localDoc;
    }
  }

  // Jeśli mamy już dokument w pamięci lokalnej, zwróć go i w tle ponów próbę zapisu do chmury
  if (localDoc) {
    try {
      await setDoc(ref, localDoc, { merge: true });
    } catch (e: any) {
      console.warn('[Scratchpad] Cicha synchronizacja do chmury nie powiodła się:', e?.message || e);
    }
    return localDoc;
  }

  // 3. Jeśli dokument nie istnieje nigdzie, wygeneruj nowy z unikalnym kodem PIN
  const pin = normalizeAccessCode(generateAccessCode(6));
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

  // Zapisz lokalnie od razu, by użytkownik mógł natychmiast edytować
  saveLocalScratchpad(newDoc);

  // Spróbuj zapisać w chmurze
  try {
    await setDoc(ref, newDoc);
  } catch (cloudErr: any) {
    console.warn(
      '[Scratchpad] Zapis nowego dokumentu do chmury nie powiódł się (zapisano lokalnie):',
      cloudErr?.message || cloudErr
    );
  }

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

  // 1. Sprawdź lokalną pamięć
  if (typeof window !== 'undefined') {
    const mappedId = localStorage.getItem(`${PIN_MAP_PREFIX}${pin}`);
    if (mappedId) {
      const local = getLocalScratchpad(mappedId);
      if (local) return local;
    }

    try {
      const indexRaw = localStorage.getItem(INDEX_KEY);
      if (indexRaw) {
        const ids: string[] = JSON.parse(indexRaw);
        for (const id of ids) {
          const docItem = getLocalScratchpad(id);
          if (docItem && normalizeAccessCode(docItem.pin) === pin) {
            return docItem;
          }
        }
      }
    } catch (e) {}
  }

  // 2. Sprawdź bezpośrednio po ID w Firestore
  try {
    const directSnap = await getDoc(scratchpadDocRef(`sp_${pin}`));
    if (directSnap.exists()) {
      const cloudDoc = directSnap.data() as ScratchpadDocument;
      saveLocalScratchpad(cloudDoc);
      return cloudDoc;
    }

    const q = query(collection(db, 'scratchpads'), where('pin', '==', pin));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const cloudDoc = snap.docs[0].data() as ScratchpadDocument;
      saveLocalScratchpad(cloudDoc);
      return cloudDoc;
    }
  } catch (err: any) {
    console.warn('[Scratchpad] Błąd wyszukiwania po PIN w chmurze:', err?.message || err);
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

  // Natychmiast zasil widok danymi lokalnymi
  const local = getLocalScratchpad(id);
  if (local) {
    onUpdate(local);
  }

  try {
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const cloudDoc = snap.data() as ScratchpadDocument;
          saveLocalScratchpad(cloudDoc);
          onUpdate(cloudDoc);
        } else {
          const fallback = getLocalScratchpad(id);
          if (fallback) {
            onUpdate(fallback);
          } else {
            onUpdate(null);
          }
        }
      },
      (err) => {
        console.warn('[Scratchpad] Błąd subskrypcji Firestore (używam stanu lokalnego):', err?.message || err);
        const fallback = getLocalScratchpad(id);
        if (fallback) {
          onUpdate(fallback);
        }
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    console.warn('[Scratchpad] Nie udało się zainicjować subskrypcji:', err);
    return () => {};
  }
}

export interface ScratchpadSaveResult {
  local: boolean;
  cloud: boolean;
  cloudError?: string;
}

/**
 * Zapisuje zaktualizowaną treść HTML i tekstową dokumentu z metadanymi edytora.
 */
export async function saveScratchpadContent(
  id: string,
  contentHtml: string,
  contentText: string,
  editorMeta?: { uid: string; name: string; role: 'teacher' | 'student' }
): Promise<ScratchpadSaveResult> {
  const now = new Date().toISOString();
  const current = getLocalScratchpad(id);
  const updatedDoc: ScratchpadDocument = {
    ...(current || {
      id,
      pin: '',
      studentName: 'Kursant',
      teacherUid: 'teacher',
      teacherName: 'Lektor',
      title: 'Brudnopis lekcyjny',
      allowStudentEdit: false,
      createdAt: now,
      version: 1,
    }),
    contentHtml,
    contentText,
    updatedAt: now,
    version: (current?.version || 1) + 1,
    lastEditedBy: editorMeta || current?.lastEditedBy,
  };

  saveLocalScratchpad(updatedDoc);
  const result: ScratchpadSaveResult = { local: true, cloud: false };

  try {
    const ref = scratchpadDocRef(id);
    const patch: any = {
      contentHtml,
      contentText,
      updatedAt: now,
      version: increment(1),
    };

    if (editorMeta) {
      patch.lastEditedBy = editorMeta;
    }

    await updateDoc(ref, patch);
    result.cloud = true;
  } catch (err: any) {
    result.cloudError = err?.message || String(err);
    console.warn('[Scratchpad] Zapis do Cloud Firestore nie powiódł się (zapisano w pamięci lokalnej):', err?.message || err);
  }

  return result;
}

/**
 * Aktualizuje metadane i uprawnienia dokumentu (np. tytuł, allowStudentEdit).
 */
export async function updateScratchpadSettings(
  id: string,
  patch: Partial<ScratchpadDocument>
): Promise<void> {
  const current = getLocalScratchpad(id);
  if (current) {
    const updated = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    saveLocalScratchpad(updated);
  }

  try {
    const ref = scratchpadDocRef(id);
    await updateDoc(ref, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.warn('[Scratchpad] Błąd aktualizacji ustawień w chmurze:', err?.message || err);
  }
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
