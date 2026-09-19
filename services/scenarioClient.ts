import { auth } from '../firebase';
import {
  GenerateScenarioResponse,
  LessonScenario,
  SaveScenarioResponse,
  ScenarioDurationMin,
} from '../types/scenario';

async function authHeaders(): Promise<Record<string, string>> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Generator Scenariusza Lekcji 2.0 — klient wysyła wyłącznie
 * { studentId, durationMin }, całą resztę (profil, ostatnia lekcja, wołanie
 * Gemini) robi backend. Patrz `types/scenario.ts`.
 */
export async function generateScenario(
  studentId: string,
  durationMin: ScenarioDurationMin
): Promise<LessonScenario> {
  const res = await fetch('/api/scenario/generate', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ studentId, durationMin }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Nie udało się wygenerować scenariusza.');
  }
  return (data as GenerateScenarioResponse).scenario;
}

export async function saveScenario(
  studentId: string,
  targetLessonId: string,
  scenario: LessonScenario
): Promise<SaveScenarioResponse> {
  const res = await fetch('/api/scenario/save', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ studentId, targetLessonId, scenario }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Nie udało się zapisać scenariusza.');
  }
  return data as SaveScenarioResponse;
}
