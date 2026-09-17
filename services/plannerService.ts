import { db } from '../firebase';
import { collection, doc, getDocs, setDoc, query, where, orderBy } from 'firebase/firestore';
import { LessonScenario, LessonBlock } from '../types/planner';

const LOCAL_STORAGE_KEY = 'cribro_lesson_planner_scenarios_v1';

/**
 * Generator domyślnego konspektu lekcji 45-60 min:
 * - Warm-up (5 min)
 * - Recall poprzedniej lekcji (10 min)
 * - Core Speaking / Praktyka (25 min)
 * - Podsumowanie i Feedback (5 min)
 */
export function getDefaultScenarioTemplate(studentId: string, teacherId: string): LessonScenario {
  const defaultBlocks: LessonBlock[] = [
    {
      id: `block-${Date.now()}-1`,
      type: 'warmup',
      title: 'Warm-up & Context Activation',
      durationMinutes: 5,
      content: 'Swobodna rozgrzewka językowa, krótkie pytania wprowadzające w kontekst tematu i nawiązanie do bieżących wydarzeń.',
    },
    {
      id: `block-${Date.now()}-2`,
      type: 'recall',
      title: 'Active Recall & Pronunciation Drill',
      durationMinutes: 10,
      content: 'Przypomnienie i utrwalenie kluczowych zwrotów oraz korekt z poprzedniej lekcji. Krótkie zdania do przeformułowania.',
    },
    {
      id: `block-${Date.now()}-3`,
      type: 'speaking',
      title: 'Core Speaking & Practical Scenario',
      durationMinutes: 25,
      content: 'Główna część konwersacyjna: symulacja sytuacji biznesowej / case study / negocjacje. Ciągła informacja zwrotna na bieżąco w notatniku.',
    },
    {
      id: `block-${Date.now()}-4`,
      type: 'feedback',
      title: 'Recap, Feedback & Next Steps',
      durationMinutes: 5,
      content: 'Wskazanie najsilniejszych momentów wypowiedzi, omówienie 2-3 typowych błędów do wyeliminowania i zadanie follow-up.',
    },
  ];

  const totalDuration = defaultBlocks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);

  return {
    id: `plan-${Date.now()}`,
    teacherId,
    studentId,
    date: new Date().toISOString().slice(0, 10),
    topic: 'Nowy konspekt lekcji',
    mainGoal: 'Płynne stosowanie kluczowych struktur i precyzyjne formułowanie myśli w kontekście zawodowym.',
    blocks: defaultBlocks,
    totalDurationMinutes: totalDuration,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Zapis scenariusza do kolekcji Firestore `teachers/{teacherId}/lesson_plans/{scenarioId}`
 * wraz z lokalną pamięcią podręczną dla odporności offline.
 */
export async function saveLessonScenario(scenario: LessonScenario): Promise<string> {
  const planId = scenario.id || `plan-${Date.now()}`;
  const now = new Date().toISOString();
  const totalDuration = scenario.blocks.reduce((sum, b) => sum + (Number(b.durationMinutes) || 0), 0);

  const payload: LessonScenario = {
    ...scenario,
    id: planId,
    totalDurationMinutes: totalDuration,
    updatedAt: now,
    createdAt: scenario.createdAt || now,
  };

  // 1. Zapis offline do LocalStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list: LessonScenario[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((p) => p.id !== planId);
    filtered.unshift(payload);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered.slice(0, 100)));
  } catch (err) {
    console.warn('[PlannerService] Błąd zapisu LocalStorage:', err);
  }

  // 2. Zapis w Firestore w kolekcji `teachers/{teacherId}/lesson_plans/{planId}`
  try {
    const docRef = doc(db, `teachers/${scenario.teacherId}/lesson_plans`, planId);
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.error('[PlannerService] Błąd zapisu w Firestore:', err);
    throw err;
  }

  return planId;
}

/**
 * Pobranie scenariuszy przypisanych do danego kursanta (`studentId`) przez danego lektora (`teacherId`).
 */
export async function getLessonPlansForStudent(
  teacherId: string,
  studentId: string
): Promise<LessonScenario[]> {
  const results: LessonScenario[] = [];

  // 1. Pamięć podręczna LocalStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const list: LessonScenario[] = JSON.parse(raw);
      results.push(
        ...list.filter(
          (p) => p.teacherId === teacherId && (!studentId || p.studentId === studentId)
        )
      );
    }
  } catch (err) {
    console.warn('[PlannerService] Błąd odczytu LocalStorage:', err);
  }

  // 2. Firestore query
  try {
    const plansColl = collection(db, `teachers/${teacherId}/lesson_plans`);
    let q;
    if (studentId) {
      q = query(plansColl, where('studentId', '==', studentId));
    } else {
      q = query(plansColl);
    }
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      const data = docSnap.data() as LessonScenario;
      if (!results.some((r) => r.id === data.id)) {
        results.push(data);
      }
    });
  } catch (err) {
    console.warn('[PlannerService] Błąd odczytu z Firestore:', err);
  }

  // Sortowanie malejąco wg daty lekcji
  results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return results;
}
