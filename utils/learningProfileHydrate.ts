/**
 * Składanie profilu krzywej uczenia z dokumentu zapisanego w bazie — wspólne dla klienta
 * (`services/learningProfile.ts`, SDK klienta) i serwera (generowanie zdań w Ćwiczeniach
 * dowolnych, Admin SDK). Czysta funkcja: odczyt dokumentu robi wywołujący.
 *
 * `baseLevel` (poziom wpisany przez lektora) jest odświeżany przy każdym odczycie: gdy lektor
 * przestawi poziom kursanta, granice dryfu mają iść za jego decyzją, a nie za stanem sprzed miesięcy.
 */
import { LearningProfile, createProfile, normalizeLevel } from './learningCurve';

export function hydrateProfile(
  studentId: string,
  baseLevel: string | undefined,
  stored: Partial<LearningProfile> | null | undefined,
  now: string,
): LearningProfile {
  const fallbackLevel = normalizeLevel(baseLevel);
  if (!stored) return createProfile(studentId, fallbackLevel, now);

  const profile = createProfile(studentId, fallbackLevel, stored.lastUpdated || stored.updatedAt || now);
  return {
    ...profile,
    ...stored,
    studentId,
    baseLevel: fallbackLevel,
    currentLevel: normalizeLevel(stored.currentLevel, fallbackLevel),
    byLevel: stored.byLevel || {},
    byExerciseType: stored.byExerciseType || {},
    recentOutcomes: stored.recentOutcomes || [],
    recentMistakes: stored.recentMistakes || [],
    levelHistory: stored.levelHistory || [],
    lastUpdated: stored.lastUpdated || stored.updatedAt || now,
    createdAt: stored.createdAt || now,
  };
}
