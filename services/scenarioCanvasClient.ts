import { auth } from '../firebase';
import { ScenarioDurationMin } from '../types/scenario';
import {
  GenerateScenarioCanvasResponse,
  LessonRefreshResponse,
  LessonRefreshTeacherNote,
  SaveScenarioCanvasResponse,
  ScenarioCanvasV2,
} from '../types/scenarioCanvas';

async function authHeaders(): Promise<Record<string, string>> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Kreator Scenariuszy Canvas 2.0 — klient wysyła wyłącznie
 * { studentId, durationMin }, tak jak generator scenariusza 1.0. Patrz
 * `types/scenarioCanvas.ts`.
 */
export async function generateScenarioCanvas(studentId: string, durationMin: ScenarioDurationMin): Promise<ScenarioCanvasV2> {
  const res = await fetch('/api/scenario/canvas/generate', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ studentId, durationMin }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Nie udało się wygenerować canvasu scenariusza.');
  }
  return (data as GenerateScenarioCanvasResponse).canvas;
}

export async function saveScenarioCanvas(studentId: string, targetLessonId: string, canvas: ScenarioCanvasV2): Promise<SaveScenarioCanvasResponse> {
  const res = await fetch('/api/scenario/canvas/save', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ studentId, targetLessonId, canvas }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Nie udało się zapisać canvasu scenariusza.');
  }
  return data as SaveScenarioCanvasResponse;
}

export interface LessonRefreshParams {
  studentId: string;
  targetLessonId: string;
  scenarioId: string;
  expectedRevision: number;
  mutationId: string;
  teacherNotes: LessonRefreshTeacherNote[];
}

/**
 * Lesson Refresh — chroniony przez `expectedRevision`/`mutationId` przed
 * podwójnym kliknięciem i równoległym zapisem. 409 = ktoś zapisał nowszą
 * rewizję canvasu w międzyczasie.
 */
export async function refreshScenarioCanvas(params: LessonRefreshParams): Promise<ScenarioCanvasV2> {
  const res = await fetch('/api/scenario/canvas/refresh', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(params),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data?.error || 'Nie udało się odświeżyć canvasu scenariusza.');
    err.status = res.status;
    err.canvas = data?.canvas;
    throw err;
  }
  return (data as LessonRefreshResponse).canvas;
}
