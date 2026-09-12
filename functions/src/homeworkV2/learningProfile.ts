/**
 * LearningProfileUpdater i ReviewPlanner.
 *
 * Profil v2 leży w `users/{uid}/profile/homeworkV2` — **osobno** od
 * `users/{uid}/profile/learningCurve`, z którego korzysta v1.
 *
 * Powód jest jeden i wynika wprost z definicji rollbacku: wyłączenie flagi ma
 * przywracać v1 do stanu sprzed, a nie do stanu „v1 z domieszką liczb, których
 * nigdy nie policzył". Profil v1 jest agregatem — dopisanie do niego wyników v2
 * przesunęłoby wyliczony poziom kursanta bez możliwości cofnięcia.
 *
 * ReviewPlanner niczego nie przydziela. Proponuje, a decyduje lektor (§18).
 */

import {
  AttemptNumber,
  ExerciseContractV2,
  GradingVerdictV2,
  MasteryState,
} from './contracts';
import { getDb } from './db';

/** Ślad po jednej ocenionej odpowiedzi. */
export interface ProfileEntryV2 {
  exerciseId: string;
  learningObjective: string;
  exerciseType: string;
  requiredMaterial: string[];
  masteryState: MasteryState;
  confidence: number;
  attemptNumber: AttemptNumber;
  hintsUsed: number;
  weightedScore: number;
  requiresTeacherReview: boolean;
  gradedAt: string;
}

export interface HomeworkV2Profile {
  studentUid: string;
  teacherId: string;
  /** Cele, które wróciły jako `ćwiczymy` — paliwo dla ReviewPlanner. */
  practicing: string[];
  /** Cele oznaczone jako `opanowane`. */
  mastered: string[];
  /** Ostatnie błędy — wchodzą do kontekstu kolejnego generowania. */
  recentMistakes: string[];
  entries: ProfileEntryV2[];
  updatedAt: string;
}

const profileRef = (studentUid: string) =>
  getDb().collection('users').doc(studentUid).collection('profile').doc('homeworkV2');

/** Ile ostatnich wpisów trzymamy. Profil ma być podpowiedzią, nie archiwum. */
const MAX_ENTRIES = 60;
const MAX_RECENT_MISTAKES = 12;

/**
 * Dopisuje wynik do profilu v2.
 *
 * Nieudany zapis profilu nie może wywrócić oceny — kursant już odpowiedział,
 * werdykt jest zapisany przy próbie, a profil to warstwa pomocnicza. Ta sama
 * zasada, co w `services/learningProfile.ts` dla v1.
 */
export const recordAttemptInProfile = async (
  studentUid: string,
  teacherId: string,
  contract: ExerciseContractV2,
  verdict: GradingVerdictV2,
  attemptNumber: AttemptNumber,
  hintsUsed: number
): Promise<void> => {
  try {
    const snapshot = await profileRef(studentUid).get();
    const current = (snapshot.data() as HomeworkV2Profile | undefined) || {
      studentUid,
      teacherId,
      practicing: [],
      mastered: [],
      recentMistakes: [],
      entries: [],
      updatedAt: new Date().toISOString(),
    };

    const entry: ProfileEntryV2 = {
      exerciseId: contract.id,
      learningObjective: contract.learningObjective,
      exerciseType: contract.exerciseType,
      requiredMaterial: contract.requiredMaterial,
      masteryState: verdict.masteryState,
      confidence: verdict.confidence,
      attemptNumber,
      hintsUsed,
      weightedScore: verdict.weightedScore,
      requiresTeacherReview: verdict.requiresTeacherReview,
      gradedAt: verdict.gradedAt,
    };

    const objective = contract.learningObjective;
    const mastered = new Set(current.mastered || []);
    const practicing = new Set(current.practicing || []);

    if (verdict.masteryState === 'opanowane') {
      mastered.add(objective);
      practicing.delete(objective);
    } else if (verdict.masteryState === 'ćwiczymy') {
      practicing.add(objective);
      // Cel raz opanowany, który wrócił — przestaje być opanowany.
      // Inaczej profil zapamiętałby sukces sprzed miesiąca i przestał
      // proponować powtórkę czegoś, co kursant właśnie pomylił.
      mastered.delete(objective);
    }

    const recentMistakes =
      verdict.masteryState === 'ćwiczymy' && verdict.rationale.targetMaterial
        ? [`${objective}: ${verdict.rationale.targetMaterial}`, ...(current.recentMistakes || [])]
        : current.recentMistakes || [];

    await profileRef(studentUid).set(
      {
        studentUid,
        teacherId,
        practicing: Array.from(practicing),
        mastered: Array.from(mastered),
        recentMistakes: recentMistakes.slice(0, MAX_RECENT_MISTAKES),
        entries: [entry, ...(current.entries || [])].slice(0, MAX_ENTRIES),
        updatedAt: new Date().toISOString(),
      },
      { merge: false }
    );
  } catch (error) {
    // Świadomie połknięte: ocena jest ważniejsza od statystyki o ocenie.
    console.warn('[hw-v2] nie udało się zapisać profilu', error);
  }
};

/** Ostatnie błędy do kontekstu generatora. Puste przy pierwszym zestawie. */
export const getRecentMistakes = async (studentUid: string): Promise<string[]> => {
  try {
    const snapshot = await profileRef(studentUid).get();
    const profile = snapshot.data() as HomeworkV2Profile | undefined;
    return profile?.recentMistakes || [];
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------------------
// ReviewPlanner
// ---------------------------------------------------------------------------

export interface ReviewProposal {
  learningObjective: string;
  /** Ile razy ten cel wracał jako `ćwiczymy`. */
  timesPracticing: number;
  lastSeenAt: string;
  /** Materiał, który warto powtórzyć. */
  requiredMaterial: string[];
}

/**
 * Proponuje, co powinno wrócić do powtórki.
 *
 * **Nie przydziela.** Zwraca listę, którą lektor zatwierdza albo ignoruje.
 * Nieudany element nie dopisuje się też do bieżącego zestawu — zestaw po
 * wysłaniu jest stały (§18).
 *
 * Świadomie bez interwałów 1/3/7 dni: fiszki i SRS zostają bez zmian,
 * a homework v2 nie dostaje własnego harmonogramu.
 */
export const proposeReview = async (studentUid: string, limit = 5): Promise<ReviewProposal[]> => {
  try {
    const snapshot = await profileRef(studentUid).get();
    const profile = snapshot.data() as HomeworkV2Profile | undefined;
    if (!profile) return [];

    const practicing = new Set(profile.practicing || []);
    if (practicing.size === 0) return [];

    const byObjective = new Map<string, ReviewProposal>();

    for (const entry of profile.entries || []) {
      if (!practicing.has(entry.learningObjective)) continue;

      const existing = byObjective.get(entry.learningObjective);
      if (existing) {
        existing.timesPracticing += 1;
        continue;
      }

      byObjective.set(entry.learningObjective, {
        learningObjective: entry.learningObjective,
        timesPracticing: 1,
        lastSeenAt: entry.gradedAt,
        requiredMaterial: entry.requiredMaterial,
      });
    }

    // Najpierw to, co wracało najczęściej — tam kursant realnie utknął.
    return Array.from(byObjective.values())
      .sort((a, b) => b.timesPracticing - a.timesPracticing)
      .slice(0, limit);
  } catch {
    return [];
  }
};
