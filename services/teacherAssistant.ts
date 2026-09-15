import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { LessonRecord } from '../types';
import { getLessonRecordsForStudent } from './lessonRecord';
import { extractLessonBlocks } from '../utils/lessonBlocks';
import { generateTextWithUnifiedFallback } from './geminiService';

/**
 * Asystent lektora — PROTOTYP.
 *
 * ══ CO TO JEST ══
 *
 * Okno, w którym można zapytać o własnych kursantów zwykłym zdaniem:
 * „co ostatnio robiłem z Bartkiem", „kto nie miał lekcji od dwóch tygodni",
 * „jakie słownictwo przerabiałem z Moniką". Odpowiedź powstaje z notatek
 * lekcyjnych, które i tak są w bazie.
 *
 * ══ JAK WYBIERA, O KIM MÓWIĆ ══
 *
 * Nie wysyłamy modelowi wszystkich lekcji wszystkich kursantów — to byłyby
 * setki tysięcy znaków przy każdym pytaniu. Zamiast tego imiona kursantów są
 * dopasowywane do treści pytania TUTAJ, w przeglądarce, a do modelu jadą
 * lekcje tylko tych osób, o które faktycznie zapytano. Gdy w pytaniu nie ma
 * żadnego nazwiska, model dostaje sam spis kursantów z datą ostatniej lekcji —
 * to wystarcza na pytania typu „kto dawno nie miał zajęć", a nie kosztuje
 * jednego pytania za całą bazę.
 *
 * ══ CZEGO TO NIE ROBI ══
 *
 * Nie ma dostępu do prac domowych, testów ani statystyk; nie zmienia niczego
 * w bazie. Czyta notatki z lekcji i tyle. To jest świadomy zakres prototypu,
 * a nie brak do nadrobienia po cichu.
 */

export interface AssistantAction {
  type: 'homework' | 'planner' | 'scratchpad' | 'mailing' | 'profile';
  label: string;
  studentId?: string;
  studentName?: string;
  topic?: string;
}

export interface AssistantMessage {
  role: 'user' | 'assistant';
  text: string;
  actions?: AssistantAction[];
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
 *
 * Buduje się raz na otwarcie okna: jedno zapytanie o konta i po jednym
 * o lekcje każdego kursanta. Przy kilkunastu kontach to kilkanaście odczytów,
 * czyli tyle, co jedno wejście w bazę kursantów.
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
      // Krótsze niż trzy znaki dopasowywałyby się do przypadkowych sylab.
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

const SYSTEM_INSTRUCTION = `Jesteś asystentem lektora języka angielskiego. Odpowiadasz na pytania o jego własnych kursantów na podstawie NOTATEK Z LEKCJI, które dostajesz w kontekście.

ZASADY:
- Odpowiadasz PO POLSKU, krótko i konkretnie. Kilka zdań albo lista punktów — nigdy esej.
- Opierasz się WYŁĄCZNIE na przekazanych danych. Jeżeli czegoś w nich nie ma, mówisz wprost: „Tego nie ma w notatkach".
- Nie zmyślasz dat, tematów ani słownictwa.
- Gdy pytanie dotyczy konkretnej osoby, a jej danych nie ma w kontekście, mówisz, że nie znalazłeś takiego kursanta.
- Terminy angielskie zostawiasz po angielsku.
- Nie doradzasz metodyki, o którą nikt nie pytał.`;

/**
 * Odpowiedź na jedno pytanie. `history` to poprzednie tury tej rozmowy —
 * dzięki nim działa „a co z nią dalej?" bez powtarzania imienia.
 */
export const askTeacherAssistant = async (
  question: string,
  index: StudentIndexEntry[],
  history: AssistantMessage[]
): Promise<{ text: string; usedStudents: string[]; actions: AssistantAction[] }> => {
  const mentioned = matchStudents(question, index);

  // Gdy w pytaniu nie padło imię, patrzymy wstecz w rozmowę — „a co dalej?"
  // dotyczy osoby z poprzedniej tury.
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

  const prompt = `DANE Z BAZY:
${context}

${conversation ? `WCZEŚNIEJSZA ROZMOWA:\n${conversation}\n` : ''}
PYTANIE LEKTORA: ${question}`;

  const { text } = await generateTextWithUnifiedFallback(
    prompt,
    SYSTEM_INSTRUCTION,
    undefined,
    undefined,
    undefined,
    { taskName: 'Asystent lektora', category: 'general' }
  );

  // Generuj inteligentne przyciski akcji przenoszące bezpośrednio do modułów
  const actions: AssistantAction[] = [];
  if (fallback.length > 0) {
    const primaryStudent = fallback[0];
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

  return { text: text.trim(), usedStudents: fallback.map(entry => entry.name), actions };
};
