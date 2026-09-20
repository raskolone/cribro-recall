import type { Firestore } from 'firebase-admin/firestore';
import { ScenarioMode } from '../types/scenario';

/**
 * Błąd z kodem, żeby wywołujący (endpoint HTTP, tool czatu) mógł zmapować go
 * na właściwy status/komunikat bez parsowania treści wiadomości.
 */
export class ScenarioContextError extends Error {
  code: 'not-found' | 'insufficient-profile';
  constructor(code: 'not-found' | 'insufficient-profile', message: string) {
    super(message);
    this.code = code;
  }
}

function isCompletedLessonRecord(data: any): boolean {
  if (!data) return false;
  if (data.status === 'pending_confirmation' || data.status === 'rejected') return false;
  if (data.sessionStatus === 'draft' || data.sessionStatus === 'live') return false;
  return true;
}

export interface ScenarioStudentContext {
  mode: ScenarioMode;
  cefr: string;
  profileContext: string;
  lastLessonContext: string;
  errorWorkInstruction: string;
  /** Dodane dla Canvasu 2.0 (`scenarioCanvasAiService`) — reużywa ten sam odczyt, zero dublowania. */
  hasGrammarContext: boolean;
  grammarContext: string;
}

/**
 * Czyta profil kursanta i ostatnią ukończoną lekcję z Firestore i buduje
 * gotowe fragmenty promptu dla Etapu 1 potoku Gemini. Wyodrębnione z
 * `/api/scenario/generate`, żeby ten sam odczyt kontekstu obsługiwał też
 * narzędzie generatora scenariuszy w czacie — zero dublowania logiki.
 */
export async function loadScenarioStudentContext(
  adminDb: Firestore,
  studentId: string
): Promise<ScenarioStudentContext> {
  const studentSnap = await adminDb.collection('users').doc(studentId).get();
  if (!studentSnap.exists) {
    throw new ScenarioContextError('not-found', 'Nie znaleziono kursanta.');
  }
  const studentData = studentSnap.data() || {};
  const cefr = String(studentData.level || '').trim();
  if (!cefr) {
    throw new ScenarioContextError('insufficient-profile', 'insufficient-profile');
  }
  const goals = String(studentData.goals || '').trim();
  const industry = String(studentData.industry || '').trim();

  let lastLesson: any = null;
  try {
    const recordsSnap = await adminDb
      .collection('users').doc(studentId)
      .collection('lessonRecords')
      .orderBy('date', 'desc')
      .limit(10)
      .get();
    for (const docSnap of recordsSnap.docs) {
      const data = docSnap.data();
      if (isCompletedLessonRecord(data)) {
        lastLesson = data;
        break;
      }
    }
  } catch (queryErr) {
    console.warn('[scenarioContextService] nie udało się odczytać lessonRecords:', queryErr);
  }

  const mode: ScenarioMode = lastLesson ? 'returning' : 'cold_start';

  const lastLessonContext = lastLesson
    ? `Temat ostatniej lekcji: ${lastLesson.topic || 'brak'}
Konkretne sytuacje zawodowe poruszone na lekcji: ${lastLesson.summary || lastLesson.topic || 'brak'}
Słownictwo z ostatniej lekcji: ${lastLesson.vocabularyText || 'brak'}
DOKŁADNE błędy/korekty z ostatniej lekcji (do recyklingu): ${lastLesson.corrections || lastLesson.thingsToImprove || 'brak'}
Plan/kierunek na kolejną lekcję (z poprzedniej notatki): ${lastLesson.nextLessonPlan || lastLesson.suggestedFollowUp || 'brak'}`
    : 'Brak historii lekcji tego kursanta — to pierwszy scenariusz (cold_start).';

  const profileContext = `Poziom CEFR: ${cefr}
Branża / kontekst zawodowy: ${industry || 'brak danych — nie zgaduj konkretnej branży, trzymaj się ogólnego kontekstu zawodowego'}
Cele edukacyjne/zawodowe kursanta: ${goals || 'brak danych'}
Preferencje korekty błędów: brak wyodrębnionego pola w profilu — koryguj na bieżąco w module "error_work", bez nachalności w pozostałych modułach`;

  const errorWorkInstruction = mode === 'returning'
    ? 'moduł "error_work" musi ćwiczyć DOKŁADNIE te błędy i to słownictwo, które padły na OSTATNIEJ lekcji kursanta (patrz kontekst niżej) — konkretne zdania/sytuacje do poprawy, nie ogólna gramatyka.'
    : 'kursant nie ma jeszcze historii lekcji, więc moduł "error_work" zamienia się w ćwiczenia DIAGNOSTYCZNE — krótkie zadania sprawdzające realny poziom względem deklarowanego CEFR.';

  const grammarContext = String(lastLesson?.corrections || lastLesson?.thingsToImprove || '').trim();
  const hasGrammarContext = grammarContext.length > 0;

  return { mode, cefr, profileContext, lastLessonContext, errorWorkInstruction, hasGrammarContext, grammarContext };
}
