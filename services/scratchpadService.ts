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
import { ScratchpadDocument, ScratchpadRevision } from '../types';
import {
  generateAccessCode,
  normalizeAccessCode,
  formatAccessCode,
  isValidAccessCode,
} from '../utils/accessCode';
import { getDefaultTemplate } from './scratchpadTemplateService';
import { buildLessonTemplate } from '../utils/lessonTemplate';

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
  /*
   * Nowy notatnik zaczyna się od PIERWSZEGO wpisu lekcyjnego, a nie od opisu
   * tego, czym jest notatnik. Instrukcja w dokumencie roboczym to tekst, który
   * lektor i tak kasuje przy pierwszym pisaniu — a kursant, który zajrzy
   * wcześniej, zobaczy wtedy instrukcję obsługi zamiast swoich zajęć.
   *
   * Numer kolejnych lekcji dopisuje się sam z nagłówków (patrz
   * `utils/lessonTemplate.ts`), więc pierwszy wpis to zawsze „Lesson 1".
   */
  const html = buildLessonTemplate({ previousHtml: '' });
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
    /*
     * Kursant może pisać OD RAZU.
     *
     * Domyślne „tylko podgląd" wychodziło z założenia, że wspólny dokument
     * trzeba przed kursantem zabezpieczyć. W praktyce notatnik jest narzędziem
     * do pracy WE DWOJE na lekcji — kursant ma w nim uzupełniać zdania,
     * poprawiać własne błędy i dopisywać słówka. Zamknięty na wejściu znaczył
     * tyle, że na każdej pierwszej lekcji trzeba było o tym pamiętać, wejść
     * w menu udostępniania i odblokować; a że nikt o tym nie pamięta, kursant
     * pisał „nie mogę nic wpisać" i lekcja stawała.
     *
     * Wyłączyć nadal można — jednym przełącznikiem w menu „Udostępnij".
     */
    allowStudentEdit: true,
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
 * Błąd sieci lub pojedynczy wyjątek nie ubija listenera — dodano automatyczny reconnect.
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

  let activeUnsubscribe: (() => void) | null = null;
  let reconnectTimeout: any = null;
  let isCancelled = false;

  const startListening = () => {
    if (isCancelled) return;

    try {
      activeUnsubscribe = onSnapshot(
        ref,
        (snap) => {
          if (isCancelled) return;
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
          console.warn('[Scratchpad] Błąd subskrypcji Firestore (próba ponownego połączenia):', err?.message || err);
          const fallback = getLocalScratchpad(id);
          if (fallback) {
            onUpdate(fallback);
          }
          if (onError) onError(err);

          // Automatyczny reconnect w razie zerwania subskrypcji
          if (!isCancelled) {
            if (activeUnsubscribe) {
              try {
                activeUnsubscribe();
              } catch {}
              activeUnsubscribe = null;
            }
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(() => {
              startListening();
            }, 2000);
          }
        }
      );
    } catch (err: any) {
      console.warn('[Scratchpad] Nie udało się zainicjować subskrypcji:', err);
      if (!isCancelled) {
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(() => {
          startListening();
        }, 2000);
      }
    }
  };

  startListening();

  return () => {
    isCancelled = true;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (activeUnsubscribe) {
      try {
        activeUnsubscribe();
      } catch {}
      activeUnsubscribe = null;
    }
  };
}

export interface ScratchpadSaveResult {
  local: boolean;
  cloud: boolean;
  cloudError?: string;
  /** Rozmiar zapisanej treści w bajtach — do licznika w stopce edytora. */
  bytes?: number;
}

/**
 * ══ TWARDY LIMIT DOKUMENTU ══
 *
 * Dokument Firestore nie może przekroczyć 1 MiB. Przekroczenie nie kończy się
 * ostrzeżeniem — kończy się odmową zapisu, czyli notatnik przestaje się
 * zapisywać w środku lekcji i nikt tego nie zauważa, dopóki nie jest za późno.
 * Dlatego limit jest pilnowany PRZED wysłaniem, z zapasem na metadane,
 * historię wersji i narzut kodowania.
 *
 * 700 kB treści zostawia ~300 kB na resztę dokumentu. Przy zwykłym tekście to
 * jakieś sto stron; limit ma znaczenie wyłącznie przy wklejanych obrazach
 * i dlatego wklejanie obrazu je sprawdza.
 */
export const SCRATCHPAD_MAX_CONTENT_BYTES = 700 * 1024;

/** Ile bajtów zajmie ten HTML po zapisaniu. */
export const scratchpadContentBytes = (html: string): number =>
  typeof TextEncoder === 'undefined' ? html.length : new TextEncoder().encode(html).length;

/**
 * ══ HISTORIA WERSJI — ZABEZPIECZENIE PRZED UTRATĄ ══
 *
 * Notatnik zapisuje CAŁĄ treść przy każdej zmianie, więc jedno nieszczęśliwe
 * zaznaczenie i naciśnięcie klawisza potrafi skasować godzinę pracy — a zapis
 * pójdzie w 600 ms, zanim ktokolwiek zdąży cofnąć. „Cofnij" działa tylko
 * w obrębie jednej karty i ginie razem z jej odświeżeniem.
 *
 * Dlatego dokument nosi ze sobą do pięciu migawek. Nie w osobnej kolekcji,
 * tylko w tym samym dokumencie: osobna kolekcja wymagałaby własnej reguły
 * w `firestore.rules`, a tam nie wchodzimy przy okazji — migawka w dokumencie
 * podlega dokładnie tym samym uprawnieniom, co treść, której dotyczy.
 *
 * Migawka powstaje najwyżej raz na pięć minut i tylko wtedy, gdy treść
 * naprawdę się zmieniła. Migawka przy każdym zapisie znaczyłaby pięć kopii
 * z ostatnich trzydziestu sekund, czyli pięć kopii tej samej pomyłki.
 *
 * ══ I DLACZEGO TYLKO LEKTOR JE ZAPISUJE ══
 *
 * `firestore.rules` pozwala kursantowi z linkiem zapisywać WYŁĄCZNIE pola
 * `contentHtml`, `contentText`, `updatedAt`, `version` i `lastEditedBy`
 * (`affectedKeys().hasOnly([...])`). Dołożenie `revisions` do jego zapisu
 * odrzuciłoby CAŁY zapis — kursant pisałby w notatniku, który po cichu
 * przestał docierać do chmury. Migawka jest więc robiona tylko wtedy, gdy
 * zapisuje lektor lub admin; że notatnik i tak otwiera lektor na każdej
 * lekcji, historia powstaje mimo to.
 *
 * Alternatywą byłoby dopisanie `revisions` do listy w regułach — czyli
 * poszerzenie uprawnień gościa bez logowania. Nie za cenę wygody.
 */
const REVISION_INTERVAL_MS = 5 * 60 * 1000;
const MAX_REVISIONS = 5;

const buildRevisions = (
  current: ScratchpadDocument | null,
  nextHtml: string,
  now: string,
  editorRole: 'teacher' | 'student' | undefined
): ScratchpadRevision[] | null => {
  // Patrz nagłówek: zapis kursanta nie może nieść tego pola.
  if (editorRole === 'student') return null;

  const previousHtml = (current?.contentHtml || '').trim();
  // Nie ma czego archiwizować: pusty dokument albo treść bez zmian.
  if (!previousHtml || previousHtml === nextHtml.trim()) return null;

  const existing = Array.isArray(current?.revisions) ? current!.revisions! : [];
  const newest = existing[0];
  if (newest && Date.now() - new Date(newest.at).getTime() < REVISION_INTERVAL_MS) {
    return null;
  }

  // Migawka nie może sama wypchnąć dokumentu poza limit.
  if (scratchpadContentBytes(previousHtml) > SCRATCHPAD_MAX_CONTENT_BYTES / 4) {
    return null;
  }

  return [
    {
      at: now,
      html: previousHtml,
      by: current?.lastEditedBy?.name || 'nieznany',
    },
    ...existing,
  ].slice(0, MAX_REVISIONS);
};

/**
 * Zapisuje zaktualizowaną treść HTML i tekstową dokumentu z metadanymi edytora.
 * W razie chwilowego błędu sieci ponawia próbę zapisu (retry po 1.5s).
 */
export async function saveScratchpadContent(
  id: string,
  contentHtml: string,
  contentText: string,
  editorMeta?: { uid: string; name: string; role: 'teacher' | 'student' }
): Promise<ScratchpadSaveResult> {
  const now = new Date().toISOString();
  const current = getLocalScratchpad(id);
  const bytes = scratchpadContentBytes(contentHtml);

  // Odmowa PRZED wysłaniem, z czytelnym powodem. Bez tego Firestore odrzuciłby
  // zapis sam, a lektor zobaczyłby tylko „tylko lokalnie" bez wyjaśnienia.
  if (bytes > SCRATCHPAD_MAX_CONTENT_BYTES) {
    return {
      local: false,
      cloud: false,
      bytes,
      cloudError:
        'Notatnik przekroczył dopuszczalny rozmiar dokumentu. Usuń część wklejonych obrazów — ' +
        'bez tego zmiany nie zapiszą się w chmurze.',
    };
  }

  const revisions = buildRevisions(current, contentHtml, now, editorMeta?.role);
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
    revisions: revisions || current?.revisions,
  };

  saveLocalScratchpad(updatedDoc);
  const result: ScratchpadSaveResult = { local: true, cloud: false, bytes };

  const attemptCloudSave = async (): Promise<boolean> => {
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

    if (revisions) {
      patch.revisions = revisions;
    }

    try {
      await updateDoc(ref, patch);
      return true;
    } catch (err: any) {
      if (err?.code === 'not-found') {
        try {
          await setDoc(ref, updatedDoc);
          return true;
        } catch (createErr: any) {
          result.cloudError = createErr?.message || String(createErr);
          throw createErr;
        }
      }
      result.cloudError = err?.message || String(err);
      throw err;
    }
  };

  try {
    await attemptCloudSave();
    result.cloud = true;
  } catch (firstErr: any) {
    console.warn('[Scratchpad] Pierwsza próba zapisu do chmury nie powiodła się, ponawiam za 1.5s...', firstErr?.message || firstErr);
    // Ponowienie zapisu po 1.5s w razie chwilowego zerwania połączenia
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      await attemptCloudSave();
      result.cloud = true;
      result.cloudError = undefined;
    } catch (retryErr: any) {
      result.cloud = false;
      result.cloudError = retryErr?.message || String(retryErr);
      console.warn('[Scratchpad] Zapis do Cloud Firestore po ponowieniu nie powiódł się (zapisano w pamięci lokalnej):', retryErr?.message || retryErr);
    }
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

/**
 * Otwarcie notatnika w NOWEJ KARCIE przeglądarki.
 *
 * Jedno miejsce na tę czynność, bo wejść do notatnika jest kilka (kafelek
 * pulpitu, profil kursanta, baza kursantów, pasek prezentacji) i wszystkie mają
 * trafiać pod ten sam adres. Bez identyfikatora karta zakłada notatnik roboczy
 * i sama dopisuje go do adresu.
 *
 * `noopener` jest konieczne: bez niego nowa karta dostaje uchwyt do okna, które
 * ją otworzyło (`window.opener`), a to jest dziura, przez którą treść z jednej
 * karty może sterować drugą.
 */
export function openScratchpadTab(scratchpadId?: string | null): void {
  if (typeof window === 'undefined') return;
  const url = scratchpadId ? `/scratchpad?id=${encodeURIComponent(scratchpadId)}` : '/scratchpad';
  window.open(url, '_blank', 'noopener');
}

/**
 * Przypisanie roboczego notatnika do kursanta.
 *
 * ══ SKĄD SIĘ BIERZE TEN PRZYPADEK ══
 *
 * Notatnik otwiera się teraz pusty, bez pytania „z kim dzisiaj" — bo lektor
 * zaczyna pisać, zanim to pytanie jest istotne, a wybieranie kursanta przed
 * pierwszym zdaniem było bramką przed niczym. Kursant dochodzi w trakcie.
 *
 * ══ DLACZEGO PRZENOSIMY TREŚĆ, A NIE DOPINAMY POLA ══
 *
 * Kursant ma dokładnie JEDEN stały notatnik o identyfikatorze `sp_<uid>` —
 * tak go znajduje ekran kursanta i tak go znajduje lektor następnym razem.
 * Dopisanie `studentId` do dokumentu roboczego (`sp_<czas>`) zrobiłoby
 * notatnik, który wygląda na przypisany, a którego kursant nigdy nie zobaczy:
 * jego ekran sięgnąłby po `sp_<uid>` i dostał pustą kartkę.
 *
 * Dlatego treść robocza wędruje do właściwego notatnika kursanta.
 *
 * ══ I DLACZEGO DOPISUJEMY, A NIE NADPISUJEMY ══
 *
 * Notatnik kursanta może już mieć treść z poprzednich lekcji. Nadpisanie
 * skasowałoby ją bezpowrotnie i bez pytania. Świeży notatnik (nietknięty
 * szablon startowy) podmieniamy, bo tam nie ma czego stracić; notatnik
 * z historią dostaje dzisiejszą treść na końcu, po kresce.
 */
export async function adoptScratchpadForStudent(
  draft: ScratchpadDocument,
  student: { id: string; name: string },
  teacher: { uid: string; name: string }
): Promise<ScratchpadDocument> {
  const target = await getOrCreateStudentScratchpad(student, teacher);

  // Ten sam dokument — nie ma czego przenosić.
  if (target.id === draft.id) return target;

  const draftHtml = (draft.contentHtml || '').trim();
  if (!draftHtml) return target;

  /*
   * „Świeży" znaczy: treść jest nadal szablonem startowym. Porównujemy po
   * samym tekście, bez znaczników — szablon bywa zapisany z innym HTML-em
   * (przeglądarka normalizuje `contentEditable`), a chodzi o to, czy
   * człowiek cokolwiek dopisał.
   */
  const untouched = (() => {
    const targetText = stripHtmlToText(target.contentHtml || '').replace(/\s+/g, ' ').trim();
    if (!targetText) return true;
    const template = stripHtmlToText(
      getInitialScratchpadContent(target.studentName || student.name).html
    )
      .replace(/\s+/g, ' ')
      .trim();
    return targetText === template;
  })();

  const mergedHtml = untouched
    ? draftHtml
    : `${target.contentHtml}<hr /><p><em>Dopisane z notatnika roboczego — ${new Date().toLocaleString('pl-PL')}</em></p>${draftHtml}`;

  await saveScratchpadContent(target.id, mergedHtml, stripHtmlToText(mergedHtml), {
    uid: teacher.uid,
    name: teacher.name,
    role: 'teacher',
  });

  return {
    ...target,
    contentHtml: mergedHtml,
    contentText: stripHtmlToText(mergedHtml),
  };
}

/**
 * Aktualizacja współrzędnych lasera w czasie rzeczywistym.
 * Zapisywana w Firestore oraz stanie lokalnym z bezpieczną obsługą błędów.
 */
export async function updateScratchpadLaser(
  id: string,
  laser: { xPercent?: number; yPercent?: number; active: boolean; user?: string } | null
): Promise<void> {
  if (!id) return;
  const local = getLocalScratchpad(id);
  if (local) {
    const updated = {
      ...local,
      laserPointer: laser ? { ...laser, updatedAt: Date.now() } : undefined,
    };
    saveLocalScratchpad(updated);
  }

  try {
    const ref = scratchpadDocRef(id);
    await updateDoc(ref, {
      laserPointer: laser ? { ...laser, updatedAt: Date.now() } : null,
    });
  } catch (err) {
    // Nie wywalaj UI przy throttling/błędzie sieci
    // console.debug('[Scratchpad Laser Sync error]:', err);
  }
}

/**
 * Aktualizacja stanu aktywnej prezentacji / interaktywnego ćwiczenia w notatniku.
 */
export async function updateScratchpadPresentation(
  id: string,
  presentation: ScratchpadDocument['presentationState'] | null
): Promise<void> {
  if (!id) return;
  const local = getLocalScratchpad(id);
  if (local) {
    const updated = {
      ...local,
      presentationState: presentation || undefined,
    };
    saveLocalScratchpad(updated);
  }

  try {
    const ref = scratchpadDocRef(id);
    await updateDoc(ref, {
      presentationState: presentation || null,
    });
  } catch (err) {
    console.warn('[Scratchpad Presentation Sync error]:', err);
  }
}

/**
 * Ujawnienie poprawnej odpowiedzi w interaktywnym ćwiczeniu live (dla lektora).
 */
export async function revealScratchpadExerciseAnswer(id: string): Promise<void> {
  if (!id) return;
  const local = getLocalScratchpad(id);
  if (local?.presentationState) {
    const updated = {
      ...local,
      presentationState: {
        ...local.presentationState,
        revealedAnswer: true,
      },
    };
    saveLocalScratchpad(updated);
  }

  try {
    const ref = scratchpadDocRef(id);
    await updateDoc(ref, {
      'presentationState.revealedAnswer': true,
    });
  } catch (err) {
    console.warn('[Scratchpad Reveal Answer error]:', err);
  }
}

/**
 * Zapis odpowiedzi kursanta w interaktywnym ćwiczeniu live.
 */
export async function submitStudentExerciseAnswer(
  id: string,
  answer: string | number
): Promise<void> {
  if (!id) return;
  const local = getLocalScratchpad(id);
  if (local?.presentationState) {
    const updated = {
      ...local,
      presentationState: {
        ...local.presentationState,
        studentAnswer: answer,
      },
    };
    saveLocalScratchpad(updated);
  }

  try {
    const ref = scratchpadDocRef(id);
    await updateDoc(ref, {
      'presentationState.studentAnswer': answer,
    });
  } catch (err) {
    console.warn('[Scratchpad Submit Answer error]:', err);
  }
}

/**
 * Zapis prywatnych notatek lektora (Side Notes) w notatniku.
 * Niewidoczne dla kursanta — służą do śledzenia uwag i zasilania AI.
 */
export async function updateScratchpadTeacherNotes(
  id: string,
  notes: string
): Promise<void> {
  if (!id) return;
  const local = getLocalScratchpad(id);
  if (local) {
    saveLocalScratchpad({ ...local, teacherNotes: notes });
  }

  try {
    const ref = scratchpadDocRef(id);
    await updateDoc(ref, { teacherNotes: notes });
  } catch (err) {
    console.warn('[Scratchpad Teacher Notes Sync error]:', err);
  }
}

/**
 * Przypisanie aktywnego scenariusza lekcji do notatnika.
 */
export async function updateScratchpadActiveScenario(
  id: string,
  scenarioId: string | null
): Promise<void> {
  if (!id) return;
  const local = getLocalScratchpad(id);
  if (local) {
    saveLocalScratchpad({ ...local, activeScenarioId: scenarioId || undefined });
  }

  try {
    const ref = scratchpadDocRef(id);
    await updateDoc(ref, { activeScenarioId: scenarioId || null });
  } catch (err) {
    console.warn('[Scratchpad Active Scenario Sync error]:', err);
  }
}

/**
 * Zapis orientacji strony A4 (portrait / landscape).
 */
export async function updateScratchpadOrientation(
  id: string,
  orientation: 'portrait' | 'landscape'
): Promise<void> {
  if (!id) return;
  const local = getLocalScratchpad(id);
  if (local) {
    saveLocalScratchpad({ ...local, pageOrientation: orientation });
  }

  try {
    const ref = scratchpadDocRef(id);
    await updateDoc(ref, { pageOrientation: orientation });
  } catch (err) {
    console.warn('[Scratchpad Orientation Sync error]:', err);
  }
}

