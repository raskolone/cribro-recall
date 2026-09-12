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
  isValidAccessCode,
} from '../utils/accessCode';
import { getDefaultTemplate } from './scratchpadTemplateService';

/** Usuwa znaczniki HTML dla wersji tekstowej — wystarczające dla podglądu/wyszukiwania. */
const stripHtmlToText = (html: string): string =>
  html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const scratchpadDocRef = (id: string) => doc(db, 'scratchpads', id);

/** Wpis indeksu PIN → notatnik. Pozwala wejść po kodzie bez `list` na kolekcji. */
const scratchpadPinRef = (pin: string) => doc(db, 'scratchpadPins', normalizeAccessCode(pin));

/**
 * Zapisuje (lub odświeża) wpis w indeksie PIN-ów.
 *
 * Wołane przy tworzeniu notatnika oraz przy każdym otwarciu go przez lektora —
 * dzięki temu dokumenty założone przed wprowadzeniem indeksu dorabiają sobie
 * wpis same, bez osobnej migracji.
 */
export async function ensureScratchpadPinIndex(pin: string, scratchpadId: string): Promise<void> {
  if (!pin || !scratchpadId) return;
  try {
    await setDoc(
      scratchpadPinRef(pin),
      { scratchpadId, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (err: any) {
    console.warn('[Scratchpad] Nie udało się zapisać indeksu PIN:', err?.message || err);
  }
}

/**
 * Czy Firestore odmówił dostępu, czy dokumentu naprawdę nie ma.
 *
 * Rozróżnienie jest istotne, bo objaw jest ten sam — pusty wynik — a przyczyna
 * zupełnie inna. Odmowa oznacza niewdrożone reguły bezpieczeństwa i kursant
 * dostawał wtedy komunikat „nie znaleziono notatnika", który wysyłał lektora
 * w pogoń za nieistniejącym błędem w linku.
 */
export class ScratchpadAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScratchpadAccessError';
  }
}

const isPermissionDenied = (err: any): boolean =>
  err?.code === 'permission-denied' || err?.code === 'firestore/permission-denied';

const ACCESS_DENIED_MESSAGE =
  'Brak dostępu do notatnika w chmurze. Reguły bezpieczeństwa Firestore nie zostały jeszcze wdrożone ' +
  '— uruchom `npm run deploy:rules`. Dopóki tego nie zrobisz, notatnik widzi wyłącznie osoba, która go utworzyła.';

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
 * Zwraca bazowy szablon HTML dla nowo tworzonego dokumentu notatnika.
 *
 * Odzwierciedla strukturę, której Maciej używał ręcznie w Google Docs przed
 * każdą lekcją (zgłoszenie 2026-09-12) — pięć sekcji z kolorowymi nagłówkami.
 * To jest wyłącznie STATYCZNY fallback "w kodzie": jeśli lektor ustawi
 * własny szablon jako domyślny w `scratchpadTemplates` (`isDefault: true`),
 * `getOrCreateStudentScratchpad` użyje JEGO treści zamiast tej — patrz niżej.
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

  const html = `<h2>Lesson Template — ${today}</h2><p>Wspólny notatnik z zajęć z <strong>${studentName}</strong>.</p>` +
    `<h3 style="color:#db2777">Revision</h3><p>Tutaj wklejam powtórkę z poprzedniej lekcji lub robimy zadanie domowe, jeżeli nie zostało wykonane.</p>` +
    `<h3 style="color:#0d9488">Main topic / Practice</h3><p>Tutaj wklejam pytania, które zadaję kursantowi, sugerowane odpowiedzi oraz ewentualne ćwiczenia z tematu lekcji.</p>` +
    `<h3 style="color:#2563eb">Lesson Summary</h3><p>Po spotkaniu wklejam podsumowanie w kilku zwięzłych zdaniach.</p>` +
    `<h3 style="color:#dc2626">Key Language &amp; Corrections (New words)</h3><p>W tym miejscu wrzucam listę słownictwa użytego podczas lekcji i wszystkie poprawki z delayed feedback.</p>` +
    `<h3 style="color:#7c3aed">Homework</h3><p>Zadanie domowe w postaci tłumaczenia zdań lub przypisane zadanie w aplikacji Recall.</p>`;

  const text = stripHtmlToText(html);

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
      // Notatniki założone przed wprowadzeniem indeksu dorabiają wpis przy
      // pierwszym otwarciu przez lektora — bez tego wejście po PIN-ie
      // przestałoby działać po zamknięciu `list`.
      ensureScratchpadPinIndex(cloudDoc.pin, cloudDoc.id);
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

  // Szablon domyślny lektora (jeśli ustawiony) wygrywa ze statycznym
  // fallbackiem w kodzie. Odczyt `scratchpadTemplates` odmówi kursantowi
  // (reguła `isAdmin()`-only) — to oczekiwane, nie błąd do zgłaszania:
  // kursant zakładający swój notatnik jako pierwszy po prostu dostaje
  // wbudowaną treść, tak jak dotychczas.
  let initial: { html: string; text: string };
  try {
    const defaultTemplate = await getDefaultTemplate();
    initial = defaultTemplate
      ? { html: defaultTemplate.contentHtml, text: stripHtmlToText(defaultTemplate.contentHtml) }
      : getInitialScratchpadContent(student.name);
  } catch {
    initial = getInitialScratchpadContent(student.name);
  }

  const newDoc: ScratchpadDocument = {
    id: docId,
    pin,
    studentId: studentId || undefined,
    studentName: student.name || 'Kursant',
    teacherUid: teacher.uid,
    teacherName: teacher.name || 'Lektor CRIBRO',
    title: `Notatnik — ${student.name}`,
    contentHtml: initial.html,
    contentText: initial.text,
    allowStudentEdit: false, // Domyślnie bezpieczny tryb podglądu na żywo dla kursanta
    requirePin: false, // Domyślnie link bezpośredni nie wymaga PINu (PIN opcjonalny na życzenie nauczyciela)
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
    await ensureScratchpadPinIndex(newDoc.pin, newDoc.id);
  } catch (cloudErr: any) {
    // Bez dokumentu w chmurze notatnik istnieje wyłącznie w tej przeglądarce,
    // więc kursant otwierający link zobaczy pustkę. To nie jest szczegół do
    // ukrycia w konsoli — lektor musi wiedzieć, zanim wyśle link.
    console.warn(
      '[Scratchpad] Zapis nowego dokumentu do chmury nie powiódł się (zapisano lokalnie):',
      cloudErr?.message || cloudErr
    );
    if (isPermissionDenied(cloudErr)) {
      newDoc.cloudBlockedReason = ACCESS_DENIED_MESSAGE;
    }
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

  // 2. Indeks PIN → identyfikator. Zwykły `get` po znanym kluczu, dzięki czemu
  //    kolekcja `scratchpads` nie musi być otwarta na listowanie.
  try {
    const indexSnap = await getDoc(scratchpadPinRef(pin));
    if (indexSnap.exists()) {
      const targetId = indexSnap.data()?.scratchpadId;
      if (targetId) {
        const target = await getDoc(scratchpadDocRef(targetId));
        if (target.exists()) {
          const cloudDoc = target.data() as ScratchpadDocument;
          saveLocalScratchpad(cloudDoc);
          return cloudDoc;
        }
      }
    }

    // Zapas dla notatników sprzed wprowadzenia indeksu, których lektor jeszcze
    // nie otworzył (otwarcie dorabia wpis). Zapytanie kolekcyjne zadziała
    // tylko przy starych, otwartych regułach — po wdrożeniu nowych po prostu
    // odmówi i zejdziemy do `null`, zamiast wywracać ekran.
    try {
      const q = query(collection(db, 'scratchpads'), where('pin', '==', pin));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const cloudDoc = snap.docs[0].data() as ScratchpadDocument;
        saveLocalScratchpad(cloudDoc);
        ensureScratchpadPinIndex(cloudDoc.pin, cloudDoc.id);
        return cloudDoc;
      }
    } catch {
      // Oczekiwane po zamknięciu `list` — nie jest błędem wartym zgłoszenia.
    }
  } catch (err: any) {
    console.warn('[Scratchpad] Błąd wyszukiwania po PIN w chmurze:', err?.message || err);
    if (isPermissionDenied(err)) throw new ScratchpadAccessError(ACCESS_DENIED_MESSAGE);
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
      title: 'Notatnik',
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
    // `updateDoc` wymaga istniejącego dokumentu. Gdy pierwszy zapis do chmury
    // się nie udał (np. reguły nie były jeszcze wdrożone), brudnopis istnieje
    // tylko lokalnie i każdy kolejny zapis leciałby na `not-found` w kółko —
    // notatki nigdy nie trafiłyby do kursanta. Zakładamy wtedy dokument od nowa
    // z pełnej kopii lokalnej, zamiast zostawiać lektora z samą pamięcią karty.
    if (err?.code === 'not-found') {
      try {
        await setDoc(scratchpadDocRef(id), updatedDoc);
        result.cloud = true;
        return result;
      } catch (createErr: any) {
        result.cloudError = createErr?.message || String(createErr);
        console.warn('[Scratchpad] Odtworzenie dokumentu w chmurze nie powiodło się:', createErr?.message || createErr);
        return result;
      }
    }

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
  const updated = current
    ? { ...current, ...patch, updatedAt: new Date().toISOString() }
    : null;
  if (updated) {
    saveLocalScratchpad(updated);
  }

  try {
    const ref = scratchpadDocRef(id);
    await updateDoc(ref, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    // Tak samo jak przy treści: bez dokumentu w chmurze przełącznik uprawnień
    // zmieniałby wyłącznie stan w przeglądarce lektora, a kursant po drugiej
    // stronie linku nigdy nie dostałby prawa zapisu.
    if (err?.code === 'not-found' && updated) {
      try {
        await setDoc(scratchpadDocRef(id), updated);
        return;
      } catch (createErr: any) {
        console.warn('[Scratchpad] Odtworzenie dokumentu przy zmianie ustawień nie powiodło się:', createErr?.message || createErr);
        return;
      }
    }
    console.warn('[Scratchpad] Błąd aktualizacji ustawień w chmurze:', err?.message || err);
  }
}

/**
 * Pobiera dokument Scratchpada bezpośrednio po unikalnym identyfikatorze dokumentu.
 */
export async function getScratchpadById(
  id: string
): Promise<ScratchpadDocument | null> {
  if (!id) return null;
  const cleanId = id.trim();

  // 1. Sprawdź pamięć lokalną
  const local = getLocalScratchpad(cleanId);
  if (local) return local;

  // 2. Pobierz z Firestore
  try {
    const snap = await getDoc(scratchpadDocRef(cleanId));
    if (snap.exists()) {
      const cloudDoc = snap.data() as ScratchpadDocument;
      saveLocalScratchpad(cloudDoc);
      return cloudDoc;
    }
  } catch (err: any) {
    console.warn('[Scratchpad] Błąd pobierania po ID z chmury:', err?.message || err);
    // Odmowa dostępu to nie „brak dokumentu". Zwracanie `null` w obu
    // przypadkach dawało kursantowi komunikat „nie znaleziono notatnika",
    // choć notatnik istniał i problem leżał w niewdrożonych regułach.
    if (isPermissionDenied(err)) throw new ScratchpadAccessError(ACCESS_DENIED_MESSAGE);
  }

  return null;
}

/**
 * Generuje unikalny bezpośredni link do konkretnego brudnopisu.
 * Domyślnie link otwiera dokument bezpośrednio bez wymogu wpisywania PINu.
 * PIN jest opcjonalną formą ochrony, jeśli nauczyciel go włączy.
 */
export function buildScratchpadUrl(
  idOrPin: string,
  options?: { pin?: string }
): string {
  const origin = typeof window === 'undefined' ? 'https://cribro.pl/scratchpad' : `${window.location.origin}/scratchpad`;
  const clean = (idOrPin || '').trim();

  // Wsteczna kompatybilność: jeśli przekazano sam 6-znakowy PIN bez 'sp_'
  if (isValidAccessCode(clean) && !clean.startsWith('sp_')) {
    return `${origin}?pin=${formatAccessCode(clean)}`;
  }

  const url = new URL(origin);
  url.searchParams.set('id', clean);
  if (options?.pin) {
    url.searchParams.set('pin', formatAccessCode(options.pin));
  }
  return url.toString();
}
