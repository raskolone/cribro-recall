import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { LessonRecord, LessonAttachment } from '../types';
import { getLessonRecordsForStudent } from './lessonRecord';
import { extractLessonBlocks } from '../utils/lessonBlocks';
import { generateTextWithUnifiedFallback, getAI, PREFERRED_AI_MODELS, formatAIModelName } from './geminiService';

export interface LessonDraftProposal {
  topic: string;
  summary: string;
  vocabulary: string;
  grammar?: string;
  homework?: string;
  studentId?: string;
  studentName?: string;
}

export interface AssistantAction {
  type: 'insert_lesson' | 'planner' | 'presentation' | 'homework' | 'scratchpad' | 'mailing' | 'profile';
  label: string;
  studentId?: string;
  studentName?: string;
  topic?: string;
  lessonDraft?: LessonDraftProposal;
}

export interface AssistantMessage {
  role: 'user' | 'assistant';
  text: string;
  attachments?: LessonAttachment[];
  actions?: AssistantAction[];
  lessonDraft?: LessonDraftProposal;
  timestamp?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  messages: AssistantMessage[];
}

export interface StudentIndexEntry {
  id: string;
  name: string;
  /** Wszystkie warianty zapisu, po których szukamy imienia w pytaniu. */
  aliases: string[];
  level?: string;
  company?: string;
  contractor?: string;
  lastLessonDate?: string;
  lastLessonTopic?: string;
  lessonCount: number;
}

/** Normalizacja pod dopasowanie: bez ogonków, bez wielkości liter. */
const fold = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l');

/**
 * Spis kursantów z datą ostatniej lekcji.
 */
export const buildStudentIndex = async (): Promise<StudentIndexEntry[]> => {
  const snapshot = await getDocs(query(collection(db, 'users')));
  const students = snapshot.docs
    .map(d => ({ id: d.id, ...(d.data() as any) }))
    .filter(u => !u.isArchived && (!u.role || u.role === 'user'))
    .filter(u => u.username !== 'Demo User' && u.username !== 'Demo User (Offline)');

  const entries = await Promise.all(
    students.map(async (student: any) => {
      const name =
        `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.username || '';
      let lessons: LessonRecord[] = [];
      try {
        lessons = await getLessonRecordsForStudent(student.id);
      } catch {
        /* brak dostępu do lekcji jednej osoby nie może wywrócić całego spisu */
      }
      const last = lessons[0];
      return {
        id: student.id,
        name,
        aliases: [name, student.firstName, student.lastName, student.username]
          .filter(Boolean)
          .map(String),
        level: student.level,
        company: student.company,
        contractor: student.contractor,
        lastLessonDate: last?.date,
        lastLessonTopic: last?.topic,
        lessonCount: lessons.length,
      } as StudentIndexEntry;
    })
  );

  return entries.filter(entry => entry.name.length > 0);
};

/** Kursanci wymienieni w pytaniu — dopasowanie po imieniu, nazwisku lub loginie. */
export const matchStudents = (
  question: string,
  index: StudentIndexEntry[]
): StudentIndexEntry[] => {
  const haystack = fold(question);
  return index.filter(entry =>
    entry.aliases.some(alias => {
      const needle = fold(alias);
      return needle.length >= 3 && haystack.includes(needle);
    })
  );
};

const clip = (text: string | undefined, limit: number): string =>
  !text ? '' : text.length > limit ? `${text.slice(0, limit)}…` : text;

const lessonToPrompt = (lesson: LessonRecord): string => {
  const blocks = extractLessonBlocks(lesson);
  return [
    `- ${lesson.date || 'bez daty'} — „${lesson.topic || 'bez tematu'}"`,
    blocks.summary ? `  przebieg: ${clip(blocks.summary, 700)}` : '',
    blocks.vocabulary ? `  słownictwo: ${clip(blocks.vocabulary, 400)}` : '',
    blocks.corrections || lesson.thingsToImprove
      ? `  do poprawy: ${clip(blocks.corrections || lesson.thingsToImprove, 300)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
};

const SYSTEM_INSTRUCTION = `Jesteś zaawansowanym Asystentem Lektora Języka Angielskiego i Workspace AI (w stylu Notion AI) platformy CRIBRO ENGLISH.

Twoje możliwości:
1. Odpowiadanie na pytania o kursantów na podstawie ich historii lekcji, poziomu i notatek w CRM.
2. Analiza załączonych materiałów: screenshotów, zdjęć zadań, plików PDF, artykułów i dokumentów.
3. PRZYGOTOWYWANIE TEMATÓW LEKCJI, SCENARIUSZY I POWTÓREK dla kursantów.

ZASADY ODPOWIADANIA:
- Odpowiadasz PO POLSKU, nowocześnie, przejrzyście i profesjonalnie. Terminy angielskie, zwroty i przykłady zostawiasz po angielsku.
- Gdy lektor prosi o przygotowanie tematu lekcji, powtórki lub scenariusza (np. „Przygotuj temat lekcji dla Dariusza”, „Zaplanuj lekcję na podstawie załączonego PDF-a / zdjęcia”):
  1. Zaproponuj chwytliwy temat i poziom.
  2. Wskaż cel i kluczowe słownictwo (angielski + polskie znaczenie w formacie „słowo - znaczenie”).
  3. Opisz przebieg / ćwiczenia konwersacyjne i gramatyczne.
  4. Zaproponuj zwięzłe zadanie domowe.
  5. NA SAMYM KOŃCU odpowiedzi dołącz blok maszynowy w formacie JSON w tagach \`\`\`lesson_json ... \`\`\`:
\`\`\`lesson_json
{
  "topic": "Tytuł lekcji",
  "summary": "Zwięzłe podsumowanie i przebieg lekcji",
  "vocabulary": "word 1 - znaczenie 1\\nword 2 - znaczenie 2",
  "grammar": "Zagadnienie gramatyczne / do poprawy",
  "homework": "Zadanie domowe"
}
\`\`\`
- Gdy pytanie dotyczy wyłącznie faktów z bazy („z kim była ostatnia lekcja”, „kto nie miał zajęć”), odpowiedz krótko i zwięźle (kilka zdań lub punkty), bez bloku lesson_json.
- Nie zmyślasz faktów z przeszłości. Jeśli czegoś nie ma w historii, mówisz wprost: „Tego nie ma w notatkach”.`;

/**
 * Odpowiedź asystenta lektora z obsługą kontekstu bazy CRM, załączników multimedialnych oraz automatycznych akcji Notion AI.
 */
export const askTeacherAssistant = async (
  question: string,
  index: StudentIndexEntry[],
  history: AssistantMessage[],
  attachments?: LessonAttachment[]
): Promise<{
  text: string;
  usedStudents: string[];
  actions: AssistantAction[];
  lessonDraft?: LessonDraftProposal;
}> => {
  const mentioned = matchStudents(question, index);

  const fallback =
    mentioned.length === 0
      ? history
          .slice()
          .reverse()
          .map(message => matchStudents(message.text, index))
          .find(matches => matches.length > 0) || []
      : mentioned;

  let context: string;
  if (fallback.length > 0) {
    const details = await Promise.all(
      fallback.slice(0, 3).map(async entry => {
        let lessons: LessonRecord[] = [];
        try {
          lessons = await getLessonRecordsForStudent(entry.id);
        } catch {
          /* pojedynczy kursant bez dostępu nie blokuje odpowiedzi */
        }
        return `## ${entry.name} (poziom: ${entry.level || 'A2-B1'}, firma: ${entry.company || '-'}, lekcji: ${entry.lessonCount})\n${
          lessons.slice(0, 5).map(lessonToPrompt).join('\n') || 'Brak zapisanych lekcji.'
        }`;
      })
    );
    context = details.join('\n\n');
  } else {
    context = `## Spis kursantów (bez szczegółów lekcji)\n${index
      .map(
        entry =>
          `- ${entry.name} [${entry.level || 'A2-B1'}]: lekcji ${entry.lessonCount}, ostatnia ${
            entry.lastLessonDate || 'brak'
          }${entry.lastLessonTopic ? ` — „${entry.lastLessonTopic}"` : ''}`
      )
      .join('\n')}`;
  }

  const conversation = history
    .slice(-6)
    .map(message => `${message.role === 'user' ? 'LEKTOR' : 'ASYSTENT'}: ${message.text}`)
    .join('\n');

  let prompt = `DANE Z BAZY CRM KURRO:\n${context}\n\n`;

  if (conversation) {
    prompt += `WCZEŚNIEJSZA ROZMOWA:\n${conversation}\n\n`;
  }

  // Dołącz materiały tekstowe/dokumenty
  if (attachments && attachments.length > 0) {
    const textAttachments = attachments.filter(a => a.textContent && a.textContent.trim().length > 0);
    if (textAttachments.length > 0) {
      prompt += `=== DOŁĄCZONE MATERIAŁY I DOKUMENTY LEKTORA ===\n`;
      textAttachments.forEach((att, idx) => {
        prompt += `\n--- Załącznik ${idx + 1}: ${att.name} (${att.type.toUpperCase()}) ---\n${att.textContent}\n`;
      });
      prompt += `=== KONIEC DOŁĄCZONYCH MATERIAŁÓW ===\n\n`;
    }
  }

  prompt += `PYTANIE / POLECENIE LEKTORA: ${question}`;

  // Przygotuj części multimodalne dla Gemini (zdjęcia, screenshoty, pliki PDF z dataUrl)
  const mediaAttachments = (attachments || []).filter(
    a => a.dataUrl && (a.type === 'image' || a.type === 'pdf')
  );

  let rawResponseText = '';

  if (mediaAttachments.length > 0) {
    try {
      const geminiParts: any[] = [{ text: prompt }];
      mediaAttachments.forEach(att => {
        const base64Data = att.dataUrl!.includes(',') ? att.dataUrl!.split(',')[1] : att.dataUrl!;
        geminiParts.push({
          inlineData: {
            mimeType: att.mimeType || (att.type === 'pdf' ? 'application/pdf' : 'image/png'),
            data: base64Data,
          },
        });
      });

      const res = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: geminiParts,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });

      rawResponseText = res?.text || '';
    } catch (multimodalErr) {
      console.warn('[TeacherAssistant] Multimodal generation fallback to text:', multimodalErr);
      const fallbackRes = await generateTextWithUnifiedFallback(
        prompt,
        SYSTEM_INSTRUCTION,
        undefined,
        undefined,
        undefined,
        { taskName: 'Asystent lektora (Multimodal fallback)', category: 'general' }
      );
      rawResponseText = fallbackRes.text;
    }
  } else {
    const { text } = await generateTextWithUnifiedFallback(
      prompt,
      SYSTEM_INSTRUCTION,
      undefined,
      undefined,
      undefined,
      { taskName: 'Asystent lektora', category: 'general' }
    );
    rawResponseText = text;
  }

  // Rozpoznaj blok lesson_json
  let lessonDraft: LessonDraftProposal | undefined;
  let cleanText = rawResponseText;
  const jsonMatch = rawResponseText.match(/```lesson_json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed && (parsed.topic || parsed.summary || parsed.vocabulary)) {
        lessonDraft = {
          topic: parsed.topic || 'Temat lekcji',
          summary: parsed.summary || '',
          vocabulary: parsed.vocabulary || '',
          grammar: parsed.grammar || '',
          homework: parsed.homework || '',
          studentId: fallback[0]?.id,
          studentName: fallback[0]?.name,
        };
      }
    } catch (e) {
      console.warn('Could not parse lesson_json from assistant:', e);
    }
    cleanText = rawResponseText.replace(/```lesson_json[\s\S]*?```/g, '').trim();
  }

  // Generuj inteligentne przyciski akcji (Notion AI style)
  const actions: AssistantAction[] = [];
  const primaryStudent = fallback[0];

  if (lessonDraft) {
    actions.push({
      type: 'insert_lesson',
      label: 'Utwórz lekcję w Dzienniku',
      studentId: primaryStudent?.id,
      studentName: primaryStudent?.name,
      topic: lessonDraft.topic,
      lessonDraft,
    });
    actions.push({
      type: 'planner',
      label: 'Dopracuj w Planerze lekcji',
      studentId: primaryStudent?.id,
      studentName: primaryStudent?.name,
      topic: lessonDraft.topic,
      lessonDraft,
    });
    actions.push({
      type: 'presentation',
      label: 'Uruchom w Prezentacji Live',
      studentId: primaryStudent?.id,
      studentName: primaryStudent?.name,
      topic: lessonDraft.topic,
      lessonDraft,
    });
    actions.push({
      type: 'homework',
      label: 'Zadaj jako Pracę domową',
      studentId: primaryStudent?.id,
      studentName: primaryStudent?.name,
      topic: lessonDraft.topic,
      lessonDraft,
    });
    if (primaryStudent) {
      actions.push({
        type: 'scratchpad',
        label: `Notatnik (${primaryStudent.name})`,
        studentId: primaryStudent.id,
        studentName: primaryStudent.name,
      });
    }
  } else if (primaryStudent) {
    actions.push({
      type: 'homework',
      label: `Zadaj pracę domową (${primaryStudent.name})`,
      studentId: primaryStudent.id,
      studentName: primaryStudent.name,
    });
    actions.push({
      type: 'planner',
      label: `Zaplanuj lekcję (${primaryStudent.name})`,
      studentId: primaryStudent.id,
      studentName: primaryStudent.name,
      topic: primaryStudent.lastLessonTopic,
    });
    actions.push({
      type: 'scratchpad',
      label: `Otwórz notatnik (${primaryStudent.name})`,
      studentId: primaryStudent.id,
      studentName: primaryStudent.name,
    });
    actions.push({
      type: 'profile',
      label: `Profil kursanta`,
      studentId: primaryStudent.id,
      studentName: primaryStudent.name,
    });
  } else {
    actions.push({ type: 'planner', label: 'Otwórz Planer lekcji' });
    actions.push({ type: 'homework', label: 'Zadania i testy' });
    actions.push({ type: 'mailing', label: 'Otwórz Mailing' });
  }

  return {
    text: cleanText.trim(),
    usedStudents: fallback.map(entry => entry.name),
    actions,
    lessonDraft,
  };
};

