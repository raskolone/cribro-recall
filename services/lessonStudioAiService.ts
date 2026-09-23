import { GoogleGenAI, Type } from '@google/genai';
import type { Firestore } from 'firebase-admin/firestore';
import { LessonBlueprint, PersonalizationSettings, PersonalizableSlot } from '../types/lessonStudio';
import { PRIMARY_MODEL } from './aiModels';

export interface PersonalizeLessonStudioParams {
  adminDb: Firestore;
  geminiApiKey: string;
  studentId?: string;
  blueprint: LessonBlueprint;
  settings: PersonalizationSettings;
  generateContentWithRetry: (aiClient: any, contents: any, config: any, customModels?: string[]) => Promise<any>;
}

export interface StudentProfileContext {
  name: string;
  level: string;
  goals: string;
  industry: string;
  description: string;
  frequentErrors: string[];
  lastLessonNotes?: string;
}

export async function loadStudentLessonStudioContext(
  adminDb: Firestore,
  studentId?: string
): Promise<StudentProfileContext> {
  if (!studentId) {
    return {
      name: 'General Learner',
      level: 'B1',
      goals: 'Improve professional fluency, diplomatic communication and error-free problem framing.',
      industry: 'General Business & Operations',
      description: 'Learner working in international collaboration environments.',
      frequentErrors: []
    };
  }

  const studentSnap = await adminDb.collection('users').doc(studentId).get();
  if (!studentSnap.exists) {
    return {
      name: 'General Learner',
      level: 'B1',
      goals: 'Improve professional fluency and workplace communication.',
      industry: 'General Business',
      description: '',
      frequentErrors: []
    };
  }

  const data = studentSnap.data() || {};
  const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.displayName || data.username || 'Student';
  const level = String(data.level || 'B1').trim();
  const goals = String(data.goals || '').trim();
  const industry = String(data.industry || '').trim();
  const description = String(data.description || '').trim();

  let frequentErrors: string[] = [];
  if (Array.isArray(data.frequentErrors)) {
    frequentErrors = data.frequentErrors.map((e: any) => typeof e === 'string' ? e : e?.text || e?.error || JSON.stringify(e));
  }

  let lastLessonNotes = '';
  try {
    const recordsSnap = await adminDb
      .collection('users').doc(studentId)
      .collection('lessonRecords')
      .orderBy('date', 'desc')
      .limit(3)
      .get();

    if (!recordsSnap.empty) {
      const records = recordsSnap.docs.map(d => d.data());
      lastLessonNotes = records
        .map(r => `• Lekcja (${r.date || 'brak daty'}): Temat "${r.topic || 'brak'}", Słownictwo: ${Array.isArray(r.vocabulary) ? r.vocabulary.slice(0, 5).join(', ') : (r.vocabularyText || '').slice(0, 100)}, Błędy: ${Array.isArray(r.corrections) ? r.corrections.slice(0, 3).map((c: any) => c.original || c.mistake || c).join('; ') : ''}`)
        .join('\n');
    }
  } catch (err) {
    console.warn('[LessonStudioContext] Failed to load previous lesson records:', err);
  }

  return {
    name,
    level,
    goals,
    industry,
    description,
    frequentErrors,
    lastLessonNotes
  };
}

/**
 * Generuje spersonalizowane wartości dla slotów w Blueprintzie lekcji.
 * AI modyfikuje WYŁĄCZNIE wyznaczone sloty, nie zmieniając szkieletu lekcji ani celów.
 */
export async function personalizeLessonStudioBlueprint(
  params: PersonalizeLessonStudioParams
): Promise<Record<string, string>> {
  const { adminDb, geminiApiKey, studentId, blueprint, settings, generateContentWithRetry } = params;

  const studentContext = await loadStudentLessonStudioContext(adminDb, studentId);

  // Zbieramy wszystkie sloty ze wszystkich bloków
  const allSlots: PersonalizableSlot[] = [];
  blueprint.blocks.forEach(block => {
    if (Array.isArray(block.personalizableSlots)) {
      allSlots.push(...block.personalizableSlots);
    }
  });

  if (allSlots.length === 0) {
    return {};
  }

  // Budujemy schemat JSON z dokładnymi kluczami odpowiadającymi slotId
  const properties: Record<string, any> = {};
  const requiredFields: string[] = [];

  allSlots.forEach(slot => {
    properties[slot.slotId] = {
      type: Type.STRING,
      description: `${slot.name}: ${slot.description || ''} (Domyślna wartość bazowa: "${String(slot.defaultValue)}")`
    };
    requiredFields.push(slot.slotId);
  });

  const schema = {
    type: Type.OBJECT,
    properties,
    required: requiredFields
  };

  const prompt = `Jesteś ekspertem metodyki nauczania języka angielskiego w platformie Cribro Recall.
Twoim zadaniem jest SPPERSONALIZOWANIE konkretnych slotów sytuacyjnych i językowych dla poniższego kursanta w ramach szablonu lekcji (Mission Pack).

ZASADA KLUCZOWA:
Nie zmieniasz struktury lekcji, kolejności bloków ani celów komunikacyjnych.
Dostosowujesz WYŁĄCZNIE wartości wskazanych slotów (kluczy JSON), tak aby idealnie rezonowały z pracą, branżą, poziomem zaawansowania oraz zdiagnozowanymi błędami kursanta.

PROFIL KURSANTA:
- Imię: ${studentContext.name}
- Poziom CEFR: ${studentContext.level}
- Branża/Rola: ${studentContext.industry || 'Biznes ogólny / Operacje'}
- Cele nauki: ${studentContext.goals || 'Płynna komunikacja biznesowa i dyplomacja w sytuacjach kryzysowych'}
- Dodatkowy opis: ${studentContext.description || 'Brak'}
- Typowe błędy kursanta: ${studentContext.frequentErrors.length > 0 ? studentContext.frequentErrors.join('; ') : 'Brak odnotowanych'}
- Ostatnie lekcje / notatki:
${studentContext.lastLessonNotes || 'Brak wcześniejszych notatek.'}

USTAWIENIA PERSONALIZACJI LEKTORA:
- Tryb kontekstu (Context Mode): ${settings.contextMode} (${settings.contextMode === 'work' ? 'Środowisko czysto zawodowe/biznesowe' : settings.contextMode === 'life' ? 'Życie codzienne/casual' : 'Automatycznie na podstawie profilu'})
- Obszar skupienia (Focus Area): ${settings.focusArea}
- Głębia lekcji (Depth): ${settings.depthLevel}
${settings.customContextPrompt ? `- Dodatkowa uwaga lektora: ${settings.customContextPrompt}` : ''}
${settings.studentNotes ? `- Notatki lektora o kursancie: ${settings.studentNotes}` : ''}

SZABLON LEKCJI (MISSION PACK):
Tytuł: ${blueprint.title || 'Lesson Blueprint'}
Poziom docelowy: ${blueprint.targetLevel || 'B1'}
Liczba bloków: ${blueprint.blocks.length}

SLOTY DO WYPEŁNIENIA (Wypełnij każdy klucz odpowiednią, wysokiej jakości treścią po angielsku lub polsku, zależnie od typu slotu):
${allSlots.map(s => `• [${s.slotId}] ${s.name} (${s.description || ''}) -> Wartość bazowa: "${s.defaultValue}"`).join('\n')}

WYMAGANIA DOTYCZĄCE WYGENEROWANYCH TREŚCI:
1. Zadbaj o naturalny, wysoce immersyjny język biznesowy / codzienny dopasowany do branży kursanta.
2. Unikaj pustych frazesów (synergy, leverage, headspace). Sytuacja w slotach "delivery_item", "discrepancy", "consequence" musi być konkretna, namacalna i realistyczna.
3. Wartości mają być bezpośrednimi stringami gotowymi do wstrzyknięcia do interfejsu lektora.
4. Zwróć wyłącznie obiekt JSON ściśle zgodny ze schematem.`;

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  const response = await generateContentWithRetry(
    ai,
    prompt,
    {
      responseMimeType: 'application/json',
      responseSchema: schema,
      thinkingConfig: { thinkingBudget: 0 }
    },
    [PRIMARY_MODEL]
  );

  const text = response?.text;
  if (!text) {
    throw new Error('Brak odpowiedzi z modelu Gemini podczas personalizacji lekcji.');
  }

  const cleanText = String(text).replace(/^```json\n?/g, '').replace(/```$/g, '').trim();
  const parsed = JSON.parse(cleanText) as Record<string, string>;

  return parsed;
}
