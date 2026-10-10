import { doc, getDoc, setDoc } from 'firebase/firestore';
import { hydrateProfile } from '../utils/learningProfileHydrate';
import { db } from '../firebase';
import {
  AttemptRecord,
  CefrLevel,
  LearningProfile,
  LevelDecision,
  buildStudentBriefing,
  createProfile,
  ingestAttempts,
  normalizeLevel,
  serializeLearningProfile,
} from '../utils/learningCurve';

export { serializeLearningProfile };

/**
 * Trwały profil krzywej uczenia kursanta.
 *
 * Ten plik tylko czyta i zapisuje — cała metodyka (kiedy podnieść poziom, co
 * znaczy „za trudne") siedzi w `utils/learningCurve.ts` i jest testowana bez
 * bazy. Tutaj zostaje wyłącznie I/O i sklejenie z resztą aplikacji.
 *
 * Profil to jeden dokument na kursanta, nie kolekcja prób. Każda odpowiedź jako
 * osobny dokument znaczyłaby tysiące zapisów miesięcznie i odczyt całej historii
 * przy każdym układaniu pracy domowej; agregat plus ostatnie błędy dają modelowi
 * dokładnie to, czego potrzebuje, jednym `getDoc`.
 *
 * Ścieżka `users/{studentId}/profile/learningCurve` leży pod profilem kursanta,
 * bo reguły w firestore.rules dają dostęp właśnie na tym poziomie.
 */

const profileRef = (studentId: string) => doc(db, `users/${studentId}/profile/learningCurve`);

/** Pusty profil w pamięci — dla podglądów i kont demo, bez zapisu do bazy. */
export const emptyProfileFor = (studentId: string, baseLevel?: string): LearningProfile =>
  createProfile(studentId, normalizeLevel(baseLevel), new Date().toISOString());

/**
 * Wczytuje profil, zakładając go przy pierwszym użyciu.
 *
 * `baseLevel` (poziom wpisany przez lektora) jest odświeżany przy każdym
 * odczycie: gdy lektor przestawi poziom kursanta, granice dryfu mają iść za
 * jego decyzją, a nie za stanem sprzed miesięcy.
 */
export async function getLearningProfile(
  studentId: string,
  baseLevel?: string
): Promise<LearningProfile> {
  const fallbackLevel = normalizeLevel(baseLevel);
  if (!studentId || studentId === 'demo-id') return emptyProfileFor(studentId, baseLevel);

  try {
    const snapshot = await getDoc(profileRef(studentId));
    if (!snapshot.exists()) return emptyProfileFor(studentId, baseLevel);

    const stored = snapshot.data() as Partial<LearningProfile>;
    return hydrateProfile(studentId, baseLevel, stored, new Date().toISOString());
  } catch (error) {
    // Brak profilu nie może zablokować ćwiczenia — bez niego model dostaje
    // sam poziom od lektora, czyli zachowanie sprzed wprowadzenia krzywej.
    console.error('Nie udało się wczytać profilu krzywej uczenia:', error);
    return emptyProfileFor(studentId, baseLevel);
  }
}


/**
 * Zapisuje wyniki ćwiczenia i przelicza poziom trudności.
 *
 * Wołane po każdym sprawdzonym zadaniu — praca domowa, powtórki, trening z AI.
 * Zwraca decyzję o poziomie, żeby miejsce wywołania mogło ją pokazać kursantowi
 * albo zignorować; sam zapis dzieje się zawsze.
 */
export async function recordExerciseResults(
  studentId: string,
  attempts: AttemptRecord[],
  baseLevel?: string
): Promise<{ profile: LearningProfile; decision: LevelDecision } | null> {
  if (!studentId || studentId === 'demo-id' || attempts.length === 0) return null;

  try {
    const current = await getLearningProfile(studentId, baseLevel);
    const now = new Date().toISOString();
    const { profile, decision } = ingestAttempts(current, attempts, now);
    const payload = serializeLearningProfile(profile, current.createdAt || now);
    await setDoc(profileRef(studentId), payload);
    return { profile, decision };
  } catch (error) {
    // Ćwiczenie jest już zrobione i zapisane w historii sesji — nieudany zapis
    // profilu może kosztować co najwyżej gorsze dobranie kolejnych zadań.
    console.error('Nie udało się zapisać wyników do profilu krzywej uczenia:', error);
    return null;
  }
}

/**
 * Notatka o kursancie do promptu plus poziom, na jakim układać zadania.
 *
 * Jedno wejście dla wszystkich generatorów, żeby każdy z nich dostawał ten sam
 * obraz kursanta — inaczej praca domowa i trening z AI rozjeżdżają się co do
 * trudności, mimo że opisują tego samego człowieka.
 */
export async function getStudentAiContext(
  studentId: string,
  baseLevel?: string
): Promise<{ briefing: string; level: CefrLevel; profile: LearningProfile }> {
  const profile = await getLearningProfile(studentId, baseLevel);
  return { briefing: buildStudentBriefing(profile), level: profile.currentLevel, profile };
}
