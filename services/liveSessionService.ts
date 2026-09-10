import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  LiveSession,
  LiveSessionStudent,
  LessonPresentation,
  LiveVocabItem,
  LiveCorrectionItem,
} from '../types';
import {
  generateAccessCode,
  normalizeAccessCode,
  formatAccessCode,
  isValidAccessCode,
} from '../utils/accessCode';
import { openPresenterLink, readLastPresenterState } from '../utils/presenterChannel';

const MAX_PIN_ATTEMPTS = 5;

/**
 * Zwraca referencję do dokumentu sesji w Firestore.
 */
export const liveSessionDocRef = (pin: string) =>
  doc(db, 'liveSessions', normalizeAccessCode(pin));

export interface CreateLiveSessionInput {
  teacherUid: string;
  teacherName: string;
  deck: LessonPresentation;
  initialSlideIndex?: number;
}

/**
 * Tworzy nową sesję prezentacji na żywo z unikalnym kodem PIN.
 */
export async function createLiveSession(
  input: CreateLiveSessionInput
): Promise<LiveSession> {
  const { teacherUid, teacherName, deck, initialSlideIndex = 0 } = input;

  let pin = '';
  for (let attempt = 0; attempt < MAX_PIN_ATTEMPTS; attempt++) {
    const candidate = generateAccessCode(6);
    const existing = await getDoc(liveSessionDocRef(candidate));
    if (!existing.exists()) {
      pin = candidate;
      break;
    }
  }

  if (!pin) {
    throw new Error('Nie udało się wygenerować unikalnego kodu PIN dla sesji.');
  }

  const now = new Date().toISOString();
  const session: LiveSession = {
    pin,
    sessionId: `ls_${pin}_${Date.now()}`,
    teacherUid,
    teacherName,
    deckTitle: deck.title || 'Prezentacja lekcyjna',
    deck,
    currentSlideIndex: initialSlideIndex,
    totalSlides: deck.slides?.length || 1,
    interaction: {
      revealedAnswers: {},
      highlightedItemId: null,
      randomQuestionIndex: null,
    },
    whiteboard: null,
    timerEndsAt: null,
    liveNotebook: {
      vocab: deck.liveVocab || [],
      corrections: deck.liveCorrections || [],
    },
    laserPos: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    connectedStudents: [],
    revision: 1,
  };

  await setDoc(liveSessionDocRef(pin), session);

  // Zsynchronizuj również lokalny BroadcastChannel dla wstecznej kompatybilności
  try {
    const link = openPresenterLink();
    link.send({
      slide: deck.slides[initialSlideIndex] || null,
      slideIndex: initialSlideIndex,
      totalSlides: deck.slides.length,
      deckTitle: deck.title || 'Prezentacja',
      interaction: session.interaction,
      whiteboard: session.whiteboard,
      timerEndsAt: session.timerEndsAt,
      liveNotebook: session.liveNotebook,
    });
  } catch (e) {
    console.warn('Lokalny presenter channel sync pominęty:', e);
  }

  return session;
}

/**
 * Pobiera aktualny stan sesji na podstawie kodu PIN.
 */
export async function getLiveSession(pin: string): Promise<LiveSession | null> {
  const normPin = normalizeAccessCode(pin);
  if (!isValidAccessCode(normPin)) return null;

  try {
    const snap = await getDoc(liveSessionDocRef(normPin));
    if (!snap.exists()) return null;
    return snap.data() as LiveSession;
  } catch (err) {
    console.error('Błąd pobierania sesji live:', err);
    return null;
  }
}

/**
 * Subskrybuje zmiany w sesji w czasie rzeczywistym (Firestore onSnapshot).
 */
export function subscribeLiveSession(
  pin: string,
  onUpdate: (session: LiveSession | null) => void,
  onError?: (err: Error) => void
): () => void {
  const normPin = normalizeAccessCode(pin);
  if (!isValidAccessCode(normPin)) {
    onUpdate(null);
    return () => {};
  }

  const docRef = liveSessionDocRef(normPin);
  return onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      const data = snap.data() as LiveSession;
      onUpdate(data);
    },
    (err) => {
      console.warn('Błąd subskrypcji Firestore liveSession:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Aktualizuje stan sesji z poziomu panelu lektora.
 */
export async function updateLiveSessionState(
  pin: string,
  updates: Partial<LiveSession>
): Promise<void> {
  const normPin = normalizeAccessCode(pin);
  const docRef = liveSessionDocRef(normPin);

  const payload: Record<string, any> = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const currentRev = (snap.data() as LiveSession).revision || 0;
      payload.revision = currentRev + 1;
      await updateDoc(docRef, payload);
    }
  } catch (err) {
    console.error('Błąd aktualizacji stanu sesji live w Firestore:', err);
    throw err;
  }
}

/**
 * Dołączanie kursanta do sesji na podstawie PINu i imienia.
 */
export async function joinLiveSession(
  pin: string,
  studentName: string,
  existingStudentId?: string
): Promise<{ studentId: string; session: LiveSession }> {
  const normPin = normalizeAccessCode(pin);
  const docRef = liveSessionDocRef(normPin);

  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('Nie znaleziono aktywnej lekcji o podanym kodzie PIN.');
  }

  const session = snap.data() as LiveSession;
  if (session.status === 'ended') {
    throw new Error('Ta sesja została już zakończona przez lektora.');
  }

  const studentId = existingStudentId || `stu_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const studentEntry: LiveSessionStudent = {
    id: studentId,
    name: studentName.trim() || 'Kursant',
    joinedAt: now,
    lastSeenAt: now,
  };

  const currentStudents = (session.connectedStudents || []).filter((s) => s.id !== studentId);
  currentStudents.push(studentEntry);

  try {
    await updateDoc(docRef, {
      connectedStudents: currentStudents,
      updatedAt: now,
    });
  } catch (e) {
    console.warn('Nie udało się zapisać listy kursantów do Firestore:', e);
  }

  return {
    studentId,
    session: {
      ...session,
      connectedStudents: currentStudents,
    },
  };
}

/**
 * Wysyła puls obecności (heartbeat) kursanta.
 */
export async function heartbeatLiveSession(
  pin: string,
  studentId: string
): Promise<void> {
  const normPin = normalizeAccessCode(pin);
  const docRef = liveSessionDocRef(normPin);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const session = snap.data() as LiveSession;
    if (!session.connectedStudents) return;

    const now = new Date().toISOString();
    let changed = false;
    const updated = session.connectedStudents.map((s) => {
      if (s.id === studentId) {
        changed = true;
        return { ...s, lastSeenAt: now };
      }
      return s;
    });

    if (changed) {
      await updateDoc(docRef, { connectedStudents: updated });
    }
  } catch {
    // Ignoruj błędy heartbeatu
  }
}

/**
 * Kończy sesję na żywo.
 */
export async function endLiveSession(pin: string): Promise<void> {
  const normPin = normalizeAccessCode(pin);
  const docRef = liveSessionDocRef(normPin);
  try {
    await updateDoc(docRef, {
      status: 'ended',
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Błąd kończenia sesji live:', err);
  }
}

/**
 * Buduje pełny link do dołączenia do sesji na żywo.
 */
export function buildLiveSessionUrl(pin: string, origin?: string): string {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const cleanPin = normalizeAccessCode(pin);
  return `${base}/live?pin=${cleanPin}`;
}
