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

/** Kursanci wymienieni w pytaniu — dopasowanie po imieniu, nazwisku lub loginie z uwzględnieniem odmiany w języku polskim. */
export const matchStudents = (
  question: string,
  index: StudentIndexEntry[]
): StudentIndexEntry[] => {
  const haystack = fold(question);
  
  // Rozbijamy pytanie na tokeny słowne
  const questionTokens = haystack
    .split(/[\s,.;:?!()"'-]+/)
    .filter(t => t.length >= 3);

  return index.filter(entry =>
    entry.aliases.some(alias => {
      const needle = fold(alias.trim());
      if (needle.length < 3) return false;

      // 1. Dokładne lub podciągowe dopasowanie (np. "Dariusz" w "dariusza", "dariuszem")
      if (haystack.includes(needle)) return true;

      // 2. Rdzeń imienia / fleksja (np. Paweł -> Pawła/Pawłem, Michał -> Michale)
      const stem = needle.length > 4 ? needle.slice(0, -1) : needle;
      if (stem.length >= 3 && haystack.includes(stem)) return true;

      // Specjalne formy nieregularne dla popularnych imion
      if (needle === 'pawel' && (haystack.includes('pawl') || haystack.includes('pawla') || haystack.includes('pawlem'))) return true;
      if (needle === 'piotr' && (haystack.includes('piotr') || haystack.includes('piotrk') || haystack.includes('piotrem'))) return true;
      if (needle === 'jan' && (haystack.includes('jan') || haystack.includes('jank') || haystack.includes('jas'))) return true;
      if (needle === 'aleksander' && (haystack.includes('olek') || haystack.includes('aleksandr'))) return true;

      // 3. Sprawdzenie tokenów pytania pod kątem podobieństwa rdzenia
      return questionTokens.some(tok => {
        if (tok.startsWith(stem) || needle.startsWith(tok)) return true;
        return false;
      });
    })
  );
};

const clip = (text: string | undefined, limit: number): string =>
  !text ? '' : text.length > limit ? `${text.slice(0, limit)}…` : text;

const lessonToPrompt = (lesson: LessonRecord, idx: number): string => {
  const blocks = extractLessonBlocks(lesson);
  const isLatest = idx === 0;

  return [
    `### LEKCJA ${lesson.date || 'bez daty'} — „${lesson.topic || 'bez tematu'}" ${isLatest ? '(OSTATNIA LEKCJA)' : ''}`,
    blocks.summary ? `* Podsumowanie / Przebieg:\n${isLatest ? blocks.summary : clip(blocks.summary, 800)}` : '',
    blocks.vocabulary ? `* Słownictwo i zwroty (Vocabulary):\n${isLatest ? blocks.vocabulary : clip(blocks.vocabulary, 600)}` : '',
    blocks.corrections || lesson.thingsToImprove
      ? `* Korekty językowe i błędy do poprawy (Corrections):\n${isLatest ? (blocks.corrections || lesson.thingsToImprove) : clip(blocks.corrections || lesson.thingsToImprove, 400)}`
      : '',
    blocks.homework ? `* Zadanie domowe:\n${isLatest ? blocks.homework : clip(blocks.homework, 300)}` : '',
    blocks.nextLesson ? `* Rekomendowany kolejny krok:\n${isLatest ? blocks.nextLesson : clip(blocks.nextLesson, 200)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
};

const SYSTEM_INSTRUCTION = `Jesteś zaawansowanym Asystentem Lektora Języka Angielskiego i Workspace AI (w stylu Notion AI) platformy CRIBRO ENGLISH.

Twoje możliwości:
1. Odpowiadanie na pytania o kursantów na podstawie ich historii lekcji, poziomu i notatek w CRM.
2. Tworzenie czytelnych, estetycznych podsumowań ostatnich lekcji i analizy postępów językowych.
3. Analiza załączonych materiałów: screenshotów, zdjęć zadań, plików PDF, artykułów i dokumentów.
4. PRZYGOTOWYWANIE TEMATÓW LEKCJI, SCENARIUSZY I POWTÓREK dla kursantów.

ZASADY ODPOWIADANIA I FORMATOWANIA (BARDZO WAŻNE):
- Odpowiadasz PO POLSKU, nowocześnie, przejrzyście, z zachowaniem nienagannej estetyki wizualnej.
- Terminy angielskie, zwroty i przykłady zostawiasz po angielsku z polskim tłumaczeniem lub kontekstem.
- Gdy lektor pyta o podsumowanie ostatniej lekcji lub postępów kursanta (np. „podsumuj ostatnią lekcję z kursantem X”):
  • Przedstaw odpowiedź w postaci czytelnych, elegancko sformatowanych sekcji Markdown.
  • Użyj logicznego układu z nagłówkami i emoji:
    ### 📅 Lekcja: [Tytuł lekcji] ([Data])
    📖 **Przebieg i omówione zagadnienia**
    🧠 **Kluczowe słownictwo i zwroty** (w punktach: **słówko** — znaczenie)
    ✍️ **Korekty językowe i gramatyka** (wyraźnie wskaż: *Say:* ... zamiast *Not:* ...)
    🏠 **Zadanie domowe**
    🔮 **Rekomendowany follow-up na następne zajęcia**
  • Dbaj o przejrzyste odstępy, punktory i wyróżnienia (**bold** dla ważnych terminów).
  • NIGDY nie generuj surowego, zlanego bloku tekstu ze znakami ucieczki (np. \\n, \", ~~~).

- Gdy lektor prosi o przygotowanie tematu lekcji, powtórki lub nowego konspektu:
  1. Zaproponuj chwytliwy temat i poziom.
  2. Wskaż cel i kluczowe słownictwo (**słowo** - znaczenie).
  3. Opisz przebieg / ćwiczenia konwersacyjne i gramatyczne.
  4. Zaproponuj zadanie domowe.
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

- Gdy pytanie dotyczy wyłącznie faktów z bazy („z kim była ostatnia lekcja”, „kto ma zaległości”), odpowiedz zwięźle i konkretnie w punktach, bez zbędnego bloku lesson_json.
- Nie zmyślasz faktów z przeszłości. Jeśli czegoś nie ma w historii, poinformuj o tym wprost.`;

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
        return `## Kursant: ${entry.name} (poziom: ${entry.level || 'A2-B1'}, firma: ${entry.company || '-'}, łączna liczba lekcji: ${entry.lessonCount})\n${
          lessons.slice(0, 6).map((l, lIdx) => lessonToPrompt(l, lIdx)).join('\n\n') || 'Brak zapisanych lekcji w historii.'
        }`;
      })
    );
    context = details.join('\n\n====================\n\n');
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

  let prompt = `DANE Z BAZY CRM I HISTORII LEKCJI KURSANTÓW:\n${context}\n\n`;

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

  // Czyścimy ewentualne otaczające znaczniki markdown
  cleanText = cleanText
    .replace(/^~~~[a-zA-Z]*\s*/gm, '')
    .replace(/~~~$/gm, '')
    .trim();

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

