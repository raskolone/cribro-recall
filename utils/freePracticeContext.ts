/**
 * Kontekst kursanta do generowania zdań (poziom, krzywa uczenia, słabości, lekcje) odczytany po
 * stronie SERWERA przez Admin SDK — ten sam obraz kursanta, który klient składa z
 * `getStudentAiContext` i `getUserWeaknesses`, tylko bez SDK klienta. Tylko ODCZYT: historia
 * błędów i profil nie są tu zapisywane.
 *
 * Interfejs bazy jest strukturalny (Admin Firestore go spełnia), więc test podaje prostą atrapę.
 * Każdy odczyt jest niezależny i opcjonalny — brak profilu czy błąd odczytu nie blokuje ćwiczenia
 * (zostaje poziom z dokumentu kursanta i pusta historia).
 */
import { buildStudentBriefing } from './learningCurve';
import { hydrateProfile } from './learningProfileHydrate';
import { formatWeaknessesList, NO_WEAKNESSES, type WeaknessRow } from './weaknesses';
import type { LessonNote, StudentContext } from './freePracticeGeneration';

/** Ile ostatnich lekcji dokładamy, gdy kursant nie wskazał żadnej. */
export const DEFAULT_LESSON_CONTEXT = 3;
export const MAX_WEAKNESSES = 15;

type AnyRef = any; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface ContextDb {
  collection(name: string): AnyRef;
}

/** Dokument `users/{uid}` — odczytywany raz w trasie (rola i kontekst). */
export async function readUserDoc(db: ContextDb, uid: string): Promise<Record<string, unknown>> {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? ((snap.data() as Record<string, unknown>) ?? {}) : {};
}

const safe = async <T>(read: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await read();
  } catch {
    return fallback;
  }
};

export async function loadStudentContext(
  db: ContextDb,
  uid: string,
  userData: Record<string, unknown>,
  lessonRecordIds: readonly string[],
  now: Date = new Date(),
): Promise<StudentContext> {
  const userRef = db.collection('users').doc(uid);

  const [profileSnap, weaknessSnap, lessons] = await Promise.all([
    safe(() => userRef.collection('profile').doc('learningCurve').get(), null),
    safe(() => userRef.collection('weaknesses').orderBy('frequency', 'desc').limit(MAX_WEAKNESSES).get(), null),
    safe(async (): Promise<LessonNote[]> => {
      const records = userRef.collection('lessonRecords');
      if (lessonRecordIds.length > 0) {
        // Ścieżka zawiera uid wywołującego — cudze lekcje są nieosiągalne z założenia.
        const snaps = await Promise.all(lessonRecordIds.map((id) => records.doc(id).get()));
        return snaps.filter((s: AnyRef) => s.exists).map((s: AnyRef) => s.data() as LessonNote);
      }
      const latest = await records.orderBy('date', 'desc').limit(DEFAULT_LESSON_CONTEXT).get();
      return latest.docs.map((d: AnyRef) => d.data() as LessonNote);
    }, [] as LessonNote[]),
  ]);

  const baseLevel = typeof userData.level === 'string' ? userData.level : undefined;
  const stored = profileSnap && profileSnap.exists ? profileSnap.data() : null;
  const profile = hydrateProfile(uid, baseLevel, stored, now.toISOString());

  const rows: WeaknessRow[] = weaknessSnap
    ? weaknessSnap.docs.map((d: AnyRef) => ({ ...(d.data() as WeaknessRow), id: d.id }))
    : [];
  const frequentErrors = Array.isArray(userData.frequentErrors)
    ? (userData.frequentErrors as unknown[]).filter((e): e is string => typeof e === 'string')
    : [];

  return {
    level: profile.currentLevel,
    briefing: buildStudentBriefing(profile),
    weaknesses: rows.length || frequentErrors.length ? formatWeaknessesList(rows, frequentErrors) : NO_WEAKNESSES,
    aiPrompt: userData.aiPrompt,
    description: userData.description,
    lessons,
  };
}
