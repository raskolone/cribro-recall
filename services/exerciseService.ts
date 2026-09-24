import { doc, getDoc, setDoc, getDocs, collection, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { ExerciseDefinition, ExerciseStudioType, RandomWheelPayload } from '../types/exerciseStudio';
import { exerciseRegistry, DEFAULT_WHEEL_ITEMS } from './exerciseRegistry';

const EXERCISE_STORAGE_KEY = 'cribro_exercises_store';

const SEED_EXERCISES: ExerciseDefinition<RandomWheelPayload>[] = [
  {
    id: 'seed-wheel-warmup',
    title: 'Warm-up Questions Wheel',
    type: 'random_wheel',
    cefr: 'B1-B2',
    language: 'English',
    instructions: 'Zakręć kołem i odpowiedz pełnymi zdaniami na wylosowane pytanie rozgrzewkowe.',
    status: 'ready',
    payload: {
      title: 'Warm-up Questions Wheel',
      items: DEFAULT_WHEEL_ITEMS,
      removeOnHit: false,
      spinDuration: 4.5,
      questionSource: 'custom',
    },
    createdBy: 'system',
    createdAt: '2026-09-24T12:00:00.000Z',
    updatedAt: '2026-09-24T12:00:00.000Z',
    version: 1,
  },
  {
    id: 'seed-wheel-business',
    title: 'Business Idioms & Expressions',
    type: 'random_wheel',
    cefr: 'B2-C1',
    language: 'English',
    instructions: 'Wylosuj zwrot biznesowy, wyjaśnij jego znaczenie i użyj go w realistycznym kontekście korporacyjnym.',
    status: 'ready',
    payload: {
      title: 'Business Idioms & Expressions',
      items: [
        { id: 'bi-1', label: 'Touch base', prompt: 'Use "touch base" in an email to a busy executive.', category: 'Communication' },
        { id: 'bi-2', label: 'Ballpark figure', prompt: 'Give an estimate using "ballpark figure" during budget planning.', category: 'Finance' },
        { id: 'bi-3', label: 'Cut corners', prompt: 'Explain the risks of "cutting corners" in product quality.', category: 'Operations' },
        { id: 'bi-4', label: 'On the same page', prompt: 'How do you ensure your entire team is "on the same page"?', category: 'Leadership' },
        { id: 'bi-5', label: 'Call it a day', prompt: 'Politely wrap up a late meeting using "call it a day".', category: 'Meetings' },
        { id: 'bi-6', label: 'Play it by ear', prompt: 'Describe a situation where you had to "play it by ear".', category: 'Flexibility' },
      ],
      removeOnHit: true,
      spinDuration: 4.5,
      questionSource: 'custom',
    },
    createdBy: 'system',
    createdAt: '2026-09-24T12:00:00.000Z',
    updatedAt: '2026-09-24T12:00:00.000Z',
    version: 1,
  }
];

let memoryExercises: ExerciseDefinition[] = [...SEED_EXERCISES];

export function getLocalExercises(): ExerciseDefinition[] {
  if (typeof window === 'undefined') return memoryExercises;
  try {
    const raw = localStorage.getItem(EXERCISE_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(EXERCISE_STORAGE_KEY, JSON.stringify(SEED_EXERCISES));
      return SEED_EXERCISES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_EXERCISES;
  } catch (err) {
    console.warn('[ExerciseService] Error reading local exercises:', err);
    return SEED_EXERCISES;
  }
}

export function saveLocalExercises(exercises: ExerciseDefinition[]): void {
  if (typeof window === 'undefined') {
    memoryExercises = exercises;
    return;
  }
  try {
    localStorage.setItem(EXERCISE_STORAGE_KEY, JSON.stringify(exercises));
  } catch (err) {
    console.warn('[ExerciseService] Error saving local exercises:', err);
  }
}

export async function fetchAllExercises(): Promise<ExerciseDefinition[]> {
  const local = getLocalExercises();
  try {
    const col = collection(db, 'exercises');
    const snap = await getDocs(col);
    if (!snap.empty) {
      const cloudExercises: ExerciseDefinition[] = [];
      snap.forEach((docSnap) => {
        cloudExercises.push(docSnap.data() as ExerciseDefinition);
      });
      // Scalanie lokalnych i chmurowych z unikaniem duplikatów
      const map = new Map<string, ExerciseDefinition>();
      SEED_EXERCISES.forEach(e => map.set(e.id, e));
      local.forEach(e => map.set(e.id, e));
      cloudExercises.forEach(e => map.set(e.id, e));
      const combined = Array.from(map.values());
      saveLocalExercises(combined);
      return combined;
    }
  } catch (err) {
    console.warn('[ExerciseService] Firestore read fallback to local storage:', err);
  }
  return local;
}

export async function getExerciseById(id: string): Promise<ExerciseDefinition | null> {
  const all = getLocalExercises();
  const found = all.find(e => e.id === id);
  if (found) return found;

  try {
    const docRef = doc(db, 'exercises', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as ExerciseDefinition;
    }
  } catch (err) {
    console.warn('[ExerciseService] Error fetching exercise by ID:', err);
  }
  return null;
}

export async function saveExercise(exercise: ExerciseDefinition): Promise<ExerciseDefinition> {
  const now = new Date().toISOString();
  const updated: ExerciseDefinition = {
    ...exercise,
    updatedAt: now,
    createdAt: exercise.createdAt || now,
    version: (exercise.version || 0) + 1,
  };

  const all = getLocalExercises();
  const index = all.findIndex(e => e.id === updated.id);
  if (index >= 0) {
    all[index] = updated;
  } else {
    all.unshift(updated);
  }
  saveLocalExercises(all);

  try {
    const docRef = doc(db, 'exercises', updated.id);
    await setDoc(docRef, updated, { merge: true });
  } catch (err) {
    console.warn('[ExerciseService] Cloud save failed, saved locally:', err);
  }

  return updated;
}

export async function deleteExercise(id: string): Promise<boolean> {
  const all = getLocalExercises().filter(e => e.id !== id);
  saveLocalExercises(all);

  try {
    const docRef = doc(db, 'exercises', id);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('[ExerciseService] Cloud delete failed, deleted locally:', err);
    return true;
  }
}

export function createNewExercise<TPayload = any>(
  type: ExerciseStudioType,
  title: string,
  createdBy: string = 'teacher',
  cefr: string = 'B1-B2'
): ExerciseDefinition<TPayload> {
  const entry = exerciseRegistry[type] || exerciseRegistry.random_wheel;
  const now = new Date().toISOString();
  const id = `ex_${type}_${Date.now()}`;
  return {
    id,
    title: title || entry.label,
    type,
    cefr,
    language: 'English',
    instructions: entry.description,
    payload: entry.createDefaultPayload(title) as TPayload,
    status: 'draft',
    createdBy,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}
