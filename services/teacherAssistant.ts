import { collection, getDocs, query } from 'firebase/firestore';
import { Type } from '@google/genai';
import { db, auth } from '../firebase';
import { LessonRecord, LessonAttachment, GeneratedLessonScenario, LessonScenarioStage } from '../types';
import { LessonScenario } from '../types/scenario';
import { getLessonRecordsForStudent } from './lessonRecord';
import { getAllUsers } from './userService';
import { extractLessonBlocks } from '../utils/lessonBlocks';
import { generateTextWithUnifiedFallback, getAI } from './geminiService';
import { runCouncil, DEFAULT_COUNCIL } from './aiCouncil';
import { parseScenarioStages } from './scenarioService';
import { getAiConfig, peekChatConfig } from './aiConfigService';

export interface LessonDraftProposal {
  topic: string;
  summary: string;
  vocabulary: string;
  grammar?: string;
  homework?: string;
  studentId?: string;
  studentName?: string;
}

export interface StudentImportCandidate {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  password?: string;
  level?: string;
  company?: string;
  notes?: string;
}

export interface StudentsImportProposal {
  students: StudentImportCandidate[];
  summary?: string;
}

export interface HtmlReportProposal {
  title: string;
  html: string;
  summary?: string;
}

export interface WebGroundingSource {
  title: string;
  url: string;
  snippet?: string;
}

/**
 * Wynik toola czatu `generate_lesson_scenario` — scenariusz 2.0 (4 moduły,
 * budżety 45/60/90) wygenerowany dla kursanta rozstrzygniętego po stronie
 * backendu z `studentRef`. Osobny typ od starego `GeneratedLessonScenario`
 * (5-etapowy, `types.ts`) — to inny kontrakt/inny generator.
 */
export interface ScenarioToolResult {
  scenario: LessonScenario;
  studentId: string;
  studentName: string;
}

export interface AssistantAction {
  type: 'insert_lesson' | 'planner' | 'presentation' | 'homework' | 'scratchpad' | 'mailing' | 'profile' | 'bulk_import' | 'html_pdf';
  label: string;
  studentId?: string;
  studentName?: string;
  topic?: string;
  lessonDraft?: LessonDraftProposal;
  lessonScenario?: GeneratedLessonScenario;
  studentsImport?: StudentsImportProposal;
  htmlReport?: HtmlReportProposal;
}

export interface AssistantMessage {
  role: 'user' | 'assistant';
  text: string;
  attachments?: LessonAttachment[];
  actions?: AssistantAction[];
  lessonDraft?: LessonDraftProposal;
  lessonScenario?: GeneratedLessonScenario;
  scenarioToolResult?: ScenarioToolResult;
  studentsImport?: StudentsImportProposal;
  htmlReport?: HtmlReportProposal;
  webSources?: WebGroundingSource[];
  followUpSuggestions?: string[];
  timestamp?: number;
  modelUsed?: string;
  isCouncil?: boolean;
}

/**
 * Sanityzacja odpowiedzi modelu — usuwa wycieki techniczne (followups_json, tagi <followup>, itp.)
 * i ekstrahuje listę sugerowanych pytań.
 */
export const extractFollowUpsAndCleanText = (rawContent: string): { cleanedText: string; followUps: string[] } => {
  let cleanText = rawContent || '';
  let extractedFollowUps: string[] = [];

  // 1. Dopasowanie followups_json [...] (z lub bez backticków)
  const jsonBlockMatch = cleanText.match(/```followups_json\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        extractedFollowUps = parsed.map((s) => String(s).trim()).filter(Boolean);
      }
    } catch (e) {
      console.warn('Nie udało się sparsować bloku followups_json:', e);
    }
  }

  const jsonRawMatch = cleanText.match(/followups_json\s*(\[[^\]]*\])/i);
  if (jsonRawMatch && jsonRawMatch[1] && extractedFollowUps.length === 0) {
    try {
      const parsed = JSON.parse(jsonRawMatch[1]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        extractedFollowUps = parsed.map((s) => String(s).trim()).filter(Boolean);
      }
    } catch (e) {
      console.warn('Nie udało się sparsować followups_json:', e);
    }
  }

  // Wyczyść wszystkie warianty followups_json z tekstu
  cleanText = cleanText.replace(/```followups_json[\s\S]*?```/gi, '');
  cleanText = cleanText.replace(/followups_json\s*\[[^\]]*\]/gi, '');
  cleanText = cleanText.replace(/followups_json/gi, '');

  // 2. Dopasowanie znaczników <followup>...</followup>
  const tagMatches = [...cleanText.matchAll(/<followup>(.*?)<\/followup>/gi)];
  if (tagMatches.length > 0) {
    const tags = tagMatches.map((m) => m[1].trim()).filter(Boolean);
    if (tags.length > 0) {
      extractedFollowUps = [...extractedFollowUps, ...tags];
    }
    cleanText = cleanText.replace(/<followup>.*?<\/followup>/gi, '');
  }

  // 3. Dopasowanie listy pytań na końcu odpowiedzi jeśli brak powyższych
  if (extractedFollowUps.length === 0) {
    const followUpSectionMatch = cleanText.match(/(?:Sugerowane akcje|Pytania follow-up|Propozycje kolejnych kroków|Follow-up):\s*\n((?:[-*•\d\.]+\s*.+\n?)+)$/i);
    if (followUpSectionMatch) {
      const lines = followUpSectionMatch[1].split('\n').map((l) => l.replace(/^[-*•\d\.]+\s*/, '').trim()).filter((l) => l.length > 3);
      if (lines.length > 0) {
        extractedFollowUps = lines.slice(0, 3);
      }
    }
  }

  return {
    cleanedText: cleanText.trim(),
    followUps: Array.from(new Set(extractedFollowUps)).filter(Boolean),
  };
};

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

export interface AssistantSkill {
  id: string;
  command: string;
  name: string;
  description: string;
  icon?: string;
  category: 'Planowanie' | 'Analiza' | 'Ćwiczenia' | 'Komunikacja' | string;
  template: string;
  badge?: string;
  adminOnly?: boolean;
  enabled?: boolean;
  instructions?: string;
}

export const ASSISTANT_SKILLS: AssistantSkill[] = [
  {
    id: 'help',
    command: '/help',
    name: 'Pomoc i spis możliwości',
    description: 'Pokaż pełną listę komend, skilli oraz sposoby wykorzystania asystenta',
    icon: 'help',
    category: 'Analiza',
    template: '/help',
    badge: 'Pomoc',
  },
  {
    id: 'import',
    command: '/import',
    name: 'Import kursantów do CRM',
    description: 'Dodaj wielu kursantów naraz z listy, tabeli lub innej aplikacji (Tylko Admin)',
    icon: 'users',
    category: 'Planowanie',
    template: 'Dodaj do bazy CRM następujących kursantów:\n1. Jan Kowalski (B2, InPost, jan@inpost.pl)\n2. Anna Nowak (C1, Allegro)',
    badge: 'Admin',
    adminOnly: true,
  },
  {
    id: 'research',
    command: '/research',
    name: 'Research w internecie & Scraping',
    description: 'Przeszukaj Google lub pobierz treść ze strony WWW i przygotuj analizę',
    icon: 'globe',
    category: 'Analiza',
    template: '/research Zrób research w internecie na temat: ',
    badge: 'Google',
  },
  {
    id: 'raport',
    command: '/raport',
    name: 'Raport HTML & Eksport PDF',
    description: 'Stwórz profesjonalny raport lub podsumowanie w HTML z gotowym plikiem PDF',
    icon: 'pdf',
    category: 'Analiza',
    template: 'Przygotuj raport postępów w formacie HTML do wydruku PDF dla kursanta ',
    badge: 'PDF',
  },
  {
    id: 'plan',
    command: '/plan',
    name: 'Plan implementacji w PDF',
    description: 'Przygotuj szczegółowy plan wdrożenia, harmonogram lub strategię w dokumencie PDF',
    icon: 'document',
    category: 'Planowanie',
    template: 'Przygotuj plan implementacji w formacie HTML i PDF dla tematu: ',
    badge: 'PDF',
  },
  {
    id: 'konspekt',
    command: '/konspekt',
    name: 'Konspekt lekcji',
    description: 'Przygotuj 4-częściowy scenariusz lekcji z celami i słownictwem Notion',
    icon: 'book',
    category: 'Planowanie',
    template: 'Przygotuj 4-częściowy konspekt lekcji dla ',
    badge: '4 Bloki',
  },
  {
    id: 'podsumowanie',
    command: '/podsumowanie',
    name: 'Podsumowanie kursanta',
    description: 'Raport postępów, ostatnia lekcja i kluczowe trudności z bazy CRM',
    icon: 'summary',
    category: 'Analiza',
    template: 'Podsumuj postępy, ostatnią lekcję i trudności językowe dla ',
    badge: 'CRM',
  },
  {
    id: 'zadanie',
    command: '/zadanie',
    name: 'Zadanie domowe',
    description: 'Zaproponuj angażującą i praktyczną pracę domową z kontekstem',
    icon: 'homework',
    category: 'Ćwiczenia',
    template: 'Zaproponuj kreatywne i praktyczne zadanie domowe dopasowane do poziomu dla ',
    badge: 'Zadania',
  },
  {
    id: 'fiszki',
    command: '/fiszki',
    name: 'Zestaw fiszek',
    description: 'Wygeneruj 8-10 kluczowych słówek i zwrotów z przykładowymi zdaniami',
    icon: 'flashcards',
    category: 'Ćwiczenia',
    template: 'Wygeneruj zestaw 10 kluczowych fiszek (słowo - znaczenie - naturalne zdanie kontekstowe) dla ',
    badge: 'Słownictwo',
  },
  {
    id: 'slajdy',
    command: '/slajdy',
    name: 'Slajdy do Prezentacji Live',
    description: 'Przygotuj serię slajdów i interaktywnych ćwiczeń do lekcji na żywo',
    icon: 'slides',
    category: 'Planowanie',
    template: 'Utwórz konspekt i interaktywne slajdy do Prezentacji Live na temat ',
    badge: 'Live',
  },
  {
    id: 'bledy',
    command: '/bledy',
    name: 'Analiza błędów & wymowa',
    description: 'Zestawienie powtarzających się błędów gramatycznych i akcentu',
    icon: 'grammar',
    category: 'Analiza',
    template: 'Przeanalizuj historię błędów, gramatykę i wymowę dla kursanta ',
    badge: 'Gramatyka',
  },
  {
    id: 'kolo',
    command: '/kolo',
    name: 'Koło fortuny & Warm-up',
    description: 'Zestaw 6-8 pytań rozgrzewkowych do dyskusji na 60-90 sekund',
    icon: 'wheel',
    category: 'Ćwiczenia',
    template: 'Zaproponuj 6 angażujących pytań rozgrzewkowych (Warm-up / Koło Fortuny) dla ',
    badge: 'Warm-up',
  },
  {
    id: 'email',
    command: '/email',
    name: 'E-mail do kursanta',
    description: 'Szkic eleganckiego podsumowania zajęć lub powiadomienia e-mail',
    icon: 'mail',
    category: 'Komunikacja',
    template: 'Napisz profesjonalny i ciepły e-mail podsumowujący zajęcia dla ',
    badge: 'Resend',
  },
  {
    id: 'analiza',
    command: '/analiza',
    name: 'Analiza załącznika / tekstu',
    description: 'Ekstrakcja słownictwa, pytań i ćwiczeń z wklejonego tekstu lub PDF',
    icon: 'analysis',
    category: 'Analiza',
    template: 'Przeanalizuj poniższy materiał i stwórz z niego ćwiczenia lekcyjne: ',
    badge: 'Multimodal',
  },
];

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
  const allUsers = await getAllUsers();
  const students = allUsers
    .filter(u => !u.isArchived && (!u.role || u.role === 'user'));

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

/** Kursanci wymienieni w pytaniu — dopasowanie po wzmiance @, imieniu, nazwisku lub loginie */
export const matchStudents = (
  question: string,
  index: StudentIndexEntry[]
): StudentIndexEntry[] => {
  const haystack = fold(question);
  
  // 1. Sprawdzenie jawnych wzmianek ze znakiem @ (np. @Dariusz, @Jan Kowalski)
  const mentionMatches = question.match(/@([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ0-9_\-\.\s]+?)(?=[\s,.;:?!()"']|$)/gi);
  if (mentionMatches && mentionMatches.length > 0) {
    const directMatches: StudentIndexEntry[] = [];
    for (const rawMention of mentionMatches) {
      const cleanMention = fold(rawMention.replace(/^@/, '').trim());
      if (cleanMention.length >= 2) {
        const found = index.find(entry =>
          entry.aliases.some(alias => fold(alias.trim()).includes(cleanMention) || cleanMention.includes(fold(alias.trim())))
        );
        if (found && !directMatches.some(d => d.id === found.id)) {
          directMatches.push(found);
        }
      }
    }
    if (directMatches.length > 0) {
      return directMatches;
    }
  }

  // 2. Rozbijamy pytanie na tokeny słowne pod kątem fleksji języka polskiego
  const questionTokens = haystack
    .split(/[\s,.;:?!()"'-]+/)
    .filter(t => t.length >= 3);

  return index.filter(entry =>
    entry.aliases.some(alias => {
      const needle = fold(alias.trim());
      if (needle.length < 3) return false;

      // Dokładne lub podciągowe dopasowanie (np. "Dariusz" w "dariusza", "dariuszem")
      if (haystack.includes(needle)) return true;

      // Rdzeń imienia / fleksja (np. Paweł -> Pawła/Pawłem, Michał -> Michale)
      const stem = needle.length > 4 ? needle.slice(0, -1) : needle;
      if (stem.length >= 3 && haystack.includes(stem)) return true;

      // Specjalne formy nieregularne dla popularnych imion
      if (needle === 'pawel' && (haystack.includes('pawl') || haystack.includes('pawla') || haystack.includes('pawlem'))) return true;
      if (needle === 'piotr' && (haystack.includes('piotr') || haystack.includes('piotrk') || haystack.includes('piotrem'))) return true;
      if (needle === 'jan' && (haystack.includes('jan') || haystack.includes('jank') || haystack.includes('jas'))) return true;
      if (needle === 'aleksander' && (haystack.includes('olek') || haystack.includes('aleksandr'))) return true;

      // Sprawdzenie tokenów pytania pod kątem podobieństwa rdzenia
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
Działasz w ramach Rady Modeli AI i odpowiadasz na pytania lektora z najwyższą precyzją, naturalnością językową i estetyką.

Twoje możliwości:
1. Odpowiadanie na pytania o kursantów na podstawie ich historii lekcji, poziomu CEFR i notatek w CRM.
2. Tworzenie czytelnych, estetycznych podsumowań ostatnich lekcji i analizy postępów językowych.
3. Analiza załączonych materiałów: screenshotów, zdjęć zadań, plików PDF, artykułów i dokumentów.
4. PRZYGOTOWYWANIE TEMATÓW LEKCJI, SCENARIUSZY I POWTÓREK dla kursantów.
5. DODAWANIE I IMPORT KURSANTÓW DO BAZY CRM (pojedynczo lub hurtowo z list, CSV i tabel z innych aplikacji).
6. TWORZENIE RAPORTÓW, PLANÓW IMPLEMENTACJI I DOKUMENTÓW W HTML GOTOWYCH DO DRUKU PDF.
7. RESEARCH W INTERNECIE I ANALIZA STRON WWW z cytowaniem źródeł.
8. Obsługa szybkich komend lektora (np. /konspekt, /import, /research, /raport, /plan, /podsumowanie, /zadanie, /fiszki, /slajdy, /bledy, /kolo, /email, /analiza).

ZASADY ODPOWIADANIA I FORMATOWANIA (BARDZO WAŻNE):
- Jesteś asystentem lektora. MASZ ZAKAZ tworzenia ścian tekstu. Odpowiadaj maksymalnie zwięźle, używaj krótkich podsumowań i punktorów. Rozbudowane odpowiedzi generuj TYLKO na wyraźne polecenie użytkownika.
- Na końcu swojej odpowiedzi ZAWSZE zaproponuj 2-3 krótkie pytania/akcje typu follow-up dla lektora. Dołącz je na samym końcu w dedykowanym bloku maszynowym \`\`\`followups_json ["Pytanie 1", "Pytanie 2", "Pytanie 3"] \`\`\` (lub jako zwięzłą listę na końcu).
- Odpowiadasz PO POLSKU, nowocześnie, przejrzyście, z zachowaniem nienagannej estetyki wizualnej.
- BEZWZGLĘDNA ZASADA ADRESOWANIA I IMION: Nigdy nie adresuj lektora ani kursanta z nazwiskiem — samo imię w zupełności wystarczy! ZAWSZE odmieniaj polskie imiona przez przypadki (wołacz przy powitaniu: np. „Macieju”, „Anno”, „Piotrze”, „Kasiu”, „Michale”, „Janie”, „Dariuszu”, nigdy mianownik ani imię z nazwiskiem; narzędnik przy zwrotach typu „z Mileną”, „z Maciejem”, „z Anną”, „z Piotrem”).
- Terminy angielskie, zwroty i przykłady zostawiasz po angielsku z polskim tłumaczeniem lub naturalnym kontekstem.
- Dbaj o autentyczność i życiowy kontekst zdań (BEZWZGLĘDNY ZAKAZ sztucznych, nielogicznych zdań czy kalk językowych).

- Gdy lektor prosi o podsumowanie lekcji lub postępów kursanta:
  • Użyj logicznego układu z nagłówkami Markdown i emoji:
    ### 📅 Lekcja: [Tytuł lekcji] ([Data])
    📖 **Przebieg i omówione zagadnienia**
    🧠 **Kluczowe słownictwo i zwroty** (w punktach: **słówko** — znaczenie)
    ✍️ **Korekty językowe i gramatyka** (wyraźnie wskaż: *Say:* ... zamiast *Not:* ...)
    🏠 **Zadanie domowe**
    🔮 **Rekomendowany follow-up na następne zajęcia**

- Gdy lektor prosi o przygotowanie tematu lekcji, powtórki, scenariusza lub nowego konspektu (np. komendą /konspekt):
  1. Zaproponuj chwytliwy temat, poziom CEFR oraz szacowany czas (np. 60 min).
  2. Wskaż cel komunikacyjny lekcji i kluczowe słownictwo (**słowo** - znaczenie).
  3. Rozpisz czytelny scenariusz w podziale na 5 standardowych etapów lekcji CRIBRO:
     - 1. Warm-up & Koło Fortuny (10 min) – pytania do dyskusji / icebreaker
     - 2. Language Focus & Vocabulary (15 min) – nowe zwroty, wymowa, naturalny kontekst
     - 3. Main Discussion & Case Study (20 min) – pytania pogłębiające, analiza sytuacji
     - 4. Controlled Practice & Role-play (10 min) – scenka, zadanie komunikacyjne
     - 5. Wrap-up & Homework (5 min) – podsumowanie, zadanie domowe
  4. NA SAMYM KOŃCU odpowiedzi dołącz blok maszynowy w formacie JSON w tagach \`\`\`lesson_json ... \`\`\`:
\`\`\`lesson_json
{
  "topic": "Tytuł lekcji",
  "summary": "Zwięzłe podsumowanie i cel dydaktyczny lekcji",
  "vocabulary": "word 1 - znaczenie 1\\nword 2 - znaczenie 2",
  "grammar": "Zagadnienie gramatyczne / struktura",
  "homework": "Zadanie domowe",
  "level": "B2",
  "duration": "60 min",
  "goal": "Główny cel komunikacyjny lekcji",
  "stages": [
    { "title": "1. Warm-up & Koło Fortuny (10 min)", "duration": "10 min", "body": "Pytania rozgrzewkowe..." },
    { "title": "2. Language Focus (15 min)", "duration": "15 min", "body": "Kluczowe zwroty..." },
    { "title": "3. Main Discussion (20 min)", "duration": "20 min", "body": "Pytania i case study..." },
    { "title": "4. Controlled Practice (10 min)", "duration": "10 min", "body": "Scenka role-play..." },
    { "title": "5. Wrap-up & Homework (5 min)", "duration": "5 min", "body": "Podsumowanie i zadanie..." }
  ]
}
\`\`\`

- Gdy lektor prosi o DODANIE KURSANTA LUB IMPORT WIELU KURSANTÓW (np. wkleja listę, CSV, tabelę lub wpisuje komendę /import):
  1. Krótko i elegancko podsumuj w punktach rozpoznanych kursantów, ich poziomy i firmy.
  2. NA SAMYM KOŃCU odpowiedzi dołącz blok maszynowy w tagach \`\`\`students_import_json ... \`\`\`:
\`\`\`students_import_json
{
  "summary": "Przygotowano listę kursantów do zaimportowania do bazy CRM.",
  "students": [
    {
      "firstName": "Jan",
      "lastName": "Kowalski",
      "username": "Jan Kowalski",
      "email": "jan.kowalski@example.com",
      "level": "B2",
      "company": "Nazwa Firmy",
      "notes": "Dodatkowe uwagi"
    }
  ]
}
\`\`\`

- Gdy lektor prosi o STWORZENIE RAPORTU, PLANU IMPLEMENTACJI LUB DOKUMENTU W HTML DO DRUKU / PDF (np. komendą /raport, /plan lub poleceniem "wygeneruj w HTML / PDF"):
  1. Opisz syntetycznie kluczowe wnioski i strukturę w Markdown.
  2. NA SAMYM KOŃCU odpowiedzi dołącz pełny, semantyczny kod HTML dokumentu w tagach \`\`\`html_report ... \`\`\`.
     Kod HTML musi zawierać czystą strukturę z nagłówkami <h1>, <h2>, czytelnymi tabelami (z obramowaniem i nagłówkami th), listami <ul>/<ol> oraz ramkami blokowymi:
\`\`\`html_report
<div class="cribro-document">
  <h1>Tytuł Dokumentu lub Raportu</h1>
  <p><strong>Cel i podsumowanie:</strong> Wprowadzenie do dokumentu...</p>
  <h2>1. Szczegółowy Plan i Zakres</h2>
  <ul>
    <li>Punkt 1 - opis</li>
    <li>Punkt 2 - opis</li>
  </ul>
</div>
\`\`\`

- Gdy pytanie dotyczy faktów z bazy CRM („z kim była ostatnia lekcja”, „kto ma zaległości”), odpowiedz zwięźle i konkretnie w punktach.
- Nie zmyślasz faktów z przeszłości. Jeśli czegoś nie ma w historii kursanta, poinformuj o tym wprost.
- Gdy lektor prosi o WYGENEROWANIE/PRZYGOTOWANIE SCENARIUSZA LEKCJI 2.0 (4 moduły: warm-up, praca na błędach, główny temat, podsumowanie) dla konkretnego kursanta — użyj narzędzia \`generate_lesson_scenario\` zamiast wymyślać scenariusz samodzielnie. Podaj w nim \`studentRef\` dokładnie tak, jak lektor nazwał kursanta.`;

export const TEACHER_ASSISTANT_REVIEW_SYSTEM = `
Jesteś starszym metodykiem języka angielskiego w platformie CRIBRO ENGLISH recenzującym odpowiedź Asystenta Lektora.
Twoim celem jest zagwarantowanie najwyższej jakości merytorycznej, poprawności językowej oraz elegancji formatowania.

Sprawdź w szczególności:
1. AUTENTYCZNOŚĆ I NATURALNOŚĆ: Wszystkie zdania angielskie i polskie muszą brzmieć w 100% naturalnie dla native speakerów. Bezwzględny zakaz sztucznych zdań czy niegramatycznych kalk językowych.
2. DOPASOWANIE DO KURSANTA: Czy słownictwo i poziom gramatyki odpowiadają poziomowi CEFR i historii kursanta (jeśli został wskazany)?
3. FORMATOWANIE: Czy odpowiedź jest czytelnie podzielona na sekcje Markdown z nagłówkami, listami punktowanymi i wytłuszczeniami?
4. DOKŁADNOŚĆ: Czy nie ma zmyślonych faktów o kursancie, które nie wynikają z przekazanej bazy CRM?

Wypisz maksymalnie 4 zwięzłe uwagi do poprawy lub napisz dokładnie: „Brak zastrzeżeń."
`.trim();

export type AIAssistantMode = 'flash' | 'thinking';

/**
 * Deklaracja toola Gemini function-calling dla generatora scenariusza 2.0.
 * Gemini NIE ma dostępu do bazy — podaje wyłącznie `studentRef` (imię/nazwę
 * tak jak wspomniał ją lektor), a backend (`/api/scenario/generate-for-chat`)
 * sam rozstrzyga go do konkretnego kursanta i woła dokładnie tę samą funkcję
 * generatora co `POST /api/scenario/generate` (`services/scenarioAiService.ts`).
 */
const GENERATE_SCENARIO_TOOL_DECLARATION = {
  name: 'generate_lesson_scenario',
  description:
    'Generuje strukturalny scenariusz lekcji 2.0 (4 moduły: warm-up/follow-up, praca na błędach, główny temat, podsumowanie i feedback) dla konkretnego kursanta, na podstawie jego profilu i historii lekcji z bazy CRM. Użyj, gdy lektor prosi o przygotowanie/wygenerowanie scenariusza, planu albo konspektu kolejnej lekcji dla konkretnego kursanta.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentRef: {
        type: Type.STRING,
        description: 'Imię/nazwa wyświetlana kursanta dokładnie tak, jak wspomniał ją lektor w rozmowie. Nigdy nie zgaduj ani nie wymyślaj ID z bazy.',
      },
      durationMin: {
        type: Type.STRING,
        enum: ['45', '60', '90'],
        description: 'Długość lekcji w minutach. Jeśli lektor nie podał, pomiń to pole — backend przyjmie domyślnie 45 minut.',
      },
      customTopicFocus: {
        type: Type.STRING,
        description: 'Opcjonalne doprecyzowanie głównego tematu lekcji (moduł main_topic), jeśli lektor wskazał konkretną sytuację/temat. Maks. 150 znaków.',
      },
    },
    required: ['studentRef'],
  },
};

/** Wyciąga pierwsze wywołanie funkcji z odpowiedzi Gemini (proxy zwraca surowe `candidates`). */
const extractFunctionCall = (response: any): { name: string; args: any } | undefined => {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return undefined;
  const part = parts.find((p: any) => p?.functionCall?.name);
  return part?.functionCall;
};

/**
 * Wykonuje tool `generate_lesson_scenario`: woła autoryzowany endpoint
 * backendu, który rozstrzyga `studentRef` (wyłącznie w zbiorze aktywnych
 * kursantów, patrz `services/studentResolver.ts`) i generuje scenariusz.
 */
const callGenerateScenarioTool = async (args: {
  studentRef?: string;
  durationMin?: string | number;
  customTopicFocus?: string;
}): Promise<ScenarioToolResult> => {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch('/api/scenario/generate-for-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      studentRef: args?.studentRef,
      durationMin: args?.durationMin !== undefined ? Number(args.durationMin) : undefined,
      customTopicFocus: args?.customTopicFocus,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Błąd generowania scenariusza (status ${res.status}).`);
  }
  return { scenario: data.scenario as LessonScenario, studentId: data.studentId, studentName: data.studentName };
};

/**
 * Odpowiedź asystenta lektora z obsługą kontekstu bazy CRM, załączników multimedialnych, komend /,
 * importu kursantów, web researchu / scrapingu oraz generowania raportów HTML i PDF.
 */
export const askTeacherAssistant = async (
  question: string,
  index: StudentIndexEntry[],
  history: AssistantMessage[],
  attachments?: LessonAttachment[],
  aiMode: AIAssistantMode = 'flash'
): Promise<{
  text: string;
  usedStudents: string[];
  actions: AssistantAction[];
  lessonDraft?: LessonDraftProposal;
  lessonScenario?: GeneratedLessonScenario;
  scenarioToolResult?: ScenarioToolResult;
  studentsImport?: StudentsImportProposal;
  htmlReport?: HtmlReportProposal;
  webSources?: WebGroundingSource[];
  followUpSuggestions?: string[];
  modelUsed?: string;
  isCouncil?: boolean;
}> => {
  const cleanQ = question.trim().toLowerCase();
  if (cleanQ === '/help' || cleanQ === 'help' || cleanQ === '/pomoc' || cleanQ === 'pomoc') {
    return {
      text: `### 💡 Asystent Lektora CRIBRO — Przewodnik i Możliwości

Jestem Twoim asystentem AI zintegrowanym z bazą CRM kursantów, historią lekcji oraz modułami platformy CRIBRO.

#### 🎯 Do czego możesz mnie użyć?
* 👥 **Hurtowe dodawanie kursantów** (\`/import\`): Wklej listę, CSV lub tabelę, a asystent przygotuje konta do bazy CRM jednym kliknięciem (Tylko Admin).
* 🌐 **Research w internecie & Scraping** (\`/research\`): Przeszukuj Google lub wklej dowolny link WWW, aby wyciągnąć kluczowe fakty i słownictwo.
* 📄 **Raporty HTML & Generator PDF** (\`/raport\`, \`/plan\`): Generuj gotowe do druku pliki PDF z planami wdrożeń, raportami postępów i konspektami A4.
* 📚 **Konspekty lekcji 4-blokowych** (\`/konspekt\`): 4-częściowe scenariusze Notion (Words, Grammar, Pronunciation, Homework).
* 👥 **Analiza kursantów i CRM** (\`/podsumowanie\` lub *@Kursant*): Szybki dostęp do historii lekcji, poziomu CEFR, notatek i trudności.
* 🎯 **Zadania domowe i ćwiczenia** (\`/zadanie\`, \`/fiszki\`): Kreatywne prace domowe i zestawy fiszek.
* 🎡 **Warm-up & Koło fortuny** (\`/kolo\`): Pytania rozgrzewkowe do dyskusji na zajęciach.
* 📎 **Analiza materiałów (Multimodal)** (\`/analiza\`): Przeciągnij screenshot, zdjęcie zadania lub plik PDF.
* 📺 **Prezentacja Live** (\`/slajdy\`): Scenariusze i interaktywne slajdy do lekcji na żywo.
* ✉️ **E-maile do kursantów** (\`/email\`): Profesjonalne podsumowania zajęć dla kursantów.

#### ⚡ Skróty i komendy:
* **\`@\`** — Wskaż kursanta z bazy CRM (np. *@Dariusz*), aby automatycznie załadować jego kontekst.
* **\`/\`** — Wybierz gotowy szablon komendy (np. \`/konspekt\`, \`/import\`, \`/research\`, \`/raport\`, \`/plan\`).
* **⚡ Flash** — Błyskawiczna odpowiedź jednomodelowa w ułamku sekundy.
* **🧠 Thinking** — Głęboka narada Rady Modeli AI (Autor + Recenzenci).`,
      usedStudents: [],
      actions: [],
      modelUsed: 'CRIBRO System',
      isCouncil: false,
    };
  }

  // 1. Scraping stron WWW jeśli lektor podał linki URL w pytaniu
  const detectedWebSources: WebGroundingSource[] = [];
  const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
  const urlsInPrompt = question.match(urlRegex) || [];
  let scrapedWebText = '';

  if (urlsInPrompt.length > 0) {
    for (const u of urlsInPrompt.slice(0, 2)) {
      try {
        const token = await auth.currentUser?.getIdToken();
        const scrapeRes = await fetch('/api/web-research/scrape', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ url: u }),
        });
        if (scrapeRes.ok) {
          const sData = await scrapeRes.json();
          if (sData.textContent) {
            scrapedWebText += `\n=== POBRANA TREŚĆ STRONY WWW (${sData.title || u}) ===\nURL: ${u}\n\n${sData.textContent}\n=== KONIEC POBRANEJ STRONY ===\n\n`;
            if (!detectedWebSources.some(s => s.url === u)) {
              detectedWebSources.push({
                title: sData.title || u,
                url: u,
              });
            }
          }
        }
      } catch (err) {
        console.warn('[TeacherAssistant] Scraping error:', u, err);
      }
    }
  }

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

  if (scrapedWebText) {
    prompt += `${scrapedWebText}\n\n`;
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
  let modelUsed = aiMode === 'thinking' ? 'Rada Modeli AI (Thinking)' : 'Gemini 2.5 Flash';
  let isCouncil = false;
  let scenarioToolResult: ScenarioToolResult | undefined;

  const isWebResearchIntent =
    cleanQ.startsWith('/research') ||
    cleanQ.includes('research') ||
    cleanQ.includes('przeszukaj') ||
    cleanQ.includes('wyszukaj w internecie') ||
    cleanQ.includes('wyszukaj w google');

  // Pobierz konfigurację Czatu AI (custom system prompt + skills)
  let customChatInstruction = '';
  try {
    const aiCfg = peekChatConfig() || (await getAiConfig()).chatConfig;
    if (aiCfg) {
      if (aiCfg.customSystemPrompt && aiCfg.customSystemPrompt.trim()) {
        customChatInstruction += `\n\n=== DODATKOWE WYTYCZNE LEKTORA / SYSTEM PROMPT ===\n${aiCfg.customSystemPrompt.trim()}\n`;
      }
      if (aiCfg.customSkills && aiCfg.customSkills.length > 0) {
        const activeSkills = aiCfg.customSkills.filter(s => s.enabled !== false);
        if (activeSkills.length > 0) {
          customChatInstruction += `\n\n=== AKTYWNE UMIEJĘTNOŚCI (SKILLS) ASYSTENTA ===\n` +
            activeSkills.map(s => `* [${s.name} (${s.command})]: ${s.description}${s.instructions ? ` -> Wytyczne: ${s.instructions}` : ''}`).join('\n');
        }
      }
    }
  } catch (cfgErr) {
    console.warn('[TeacherAssistant] Error loading AI chat config:', cfgErr);
  }

  const effectiveSystemInstruction = customChatInstruction
    ? `${SYSTEM_INSTRUCTION}\n${customChatInstruction}`
    : SYSTEM_INSTRUCTION;

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
          systemInstruction: effectiveSystemInstruction,
        },
      });

      rawResponseText = res?.text || '';
      modelUsed = 'Gemini 2.5 Flash (Multimodal)';
    } catch (multimodalErr) {
      console.warn('[TeacherAssistant] Multimodal generation fallback to text:', multimodalErr);
      const fallbackRes = await generateTextWithUnifiedFallback(
        prompt,
        effectiveSystemInstruction,
        undefined,
        undefined,
        undefined,
        { taskName: 'Asystent lektora (Multimodal fallback)', category: 'general' }
      );
      rawResponseText = fallbackRes.text;
      modelUsed = fallbackRes.modelUsed || 'Gemini 2.5 Flash';
    }
  } else if (aiMode === 'thinking') {
    // 🧠 TRYB THINKING: Uruchomienie pełnej deliberacji Rady Modeli AI (Autor + Recenzenci + Konsensus)
    try {
      const councilRes = await runCouncil<string>({
        config: DEFAULT_COUNCIL,
        systemInstruction: effectiveSystemInstruction,
        prompt,
        reviewerSystemInstruction: TEACHER_ASSISTANT_REVIEW_SYSTEM,
        expectJson: false,
      });

      rawResponseText = councilRes.raw || (typeof councilRes.data === 'string' ? councilRes.data : '');
      modelUsed = councilRes.finalModel || 'Rada Modeli AI (Thinking)';
      isCouncil = true;
    } catch (councilErr) {
      console.warn('[TeacherAssistant] Rada modeli fallback do unified cascade:', councilErr);
      const { text, modelUsed: singleModel } = await generateTextWithUnifiedFallback(
        prompt,
        effectiveSystemInstruction,
        undefined,
        undefined,
        undefined,
        { taskName: 'Asystent lektora (Thinking fallback)', category: 'general' }
      );
      rawResponseText = text;
      modelUsed = singleModel || 'Gemini 2.5 Flash';
    }
  } else {
    // ⚡ TRYB FLASH: Błyskawiczna, bezpośrednia generacja
    try {
      const contents: any[] = [{ role: 'user', parts: [{ text: prompt }] }];
      let res = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: effectiveSystemInstruction,
          tools: [{ functionDeclarations: [GENERATE_SCENARIO_TOOL_DECLARATION] }],
        },
      });

      const call = extractFunctionCall(res);
      if (call?.name === 'generate_lesson_scenario') {
        let functionResponsePayload: any;
        try {
          scenarioToolResult = await callGenerateScenarioTool(call.args || {});
          functionResponsePayload = {
            result: 'ok',
            studentName: scenarioToolResult.studentName,
            durationMin: scenarioToolResult.scenario.durationMin,
            mode: scenarioToolResult.scenario.mode,
          };
        } catch (toolErr: any) {
          functionResponsePayload = { error: toolErr?.message || 'Nie udało się wygenerować scenariusza.' };
        }

        contents.push({ role: 'model', parts: [{ functionCall: call }] });
        contents.push({
          role: 'user',
          parts: [{ functionResponse: { name: call.name, response: functionResponsePayload } }],
        });

        res = await getAI().models.generateContent({
          model: 'gemini-2.5-flash',
          contents,
          config: { systemInstruction: effectiveSystemInstruction },
        });
      }

      rawResponseText = res?.text || '';
      modelUsed = 'Gemini 2.5 Flash';
      isCouncil = false;
    } catch (flashErr) {
      console.warn('[TeacherAssistant] Flash mode direct error:', flashErr);
      const { text, modelUsed: singleModel } = await generateTextWithUnifiedFallback(
        prompt,
        effectiveSystemInstruction,
        undefined,
        undefined,
        undefined,
        { taskName: 'Asystent lektora (Flash Mode, fallback bez toola)', category: 'general' }
      );
      rawResponseText = text;
      modelUsed = singleModel || 'Gemini 2.5 Flash';
      isCouncil = false;
    }
  }

  // Rozpoznaj blok lesson_json
  let lessonDraft: LessonDraftProposal | undefined;
  let lessonScenario: GeneratedLessonScenario | undefined;
  let studentsImport: StudentsImportProposal | undefined;
  let htmlReport: HtmlReportProposal | undefined;
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

        const parsedStagesRaw: LessonScenarioStage[] =
          parsed.stages && Array.isArray(parsed.stages) && parsed.stages.length > 0
            ? parsed.stages.map((st: any, sIdx: number) => ({
                id: st.id || `stage_${sIdx + 1}`,
                title: st.title || `Moduł ${sIdx + 1}`,
                duration: st.duration || '10 min',
                body: st.body || '',
              }))
            : parseScenarioStages(cleanText).stages;

        const stages =
          parsedStagesRaw.length > 0
            ? parsedStagesRaw
            : [
                { id: 'stage_1', title: '1. Warm-up & Koło Fortuny (10 min)', duration: '10 min', body: 'Rozgrzewka i pytania wprowadzające' },
                { id: 'stage_2', title: '2. Language Focus (15 min)', duration: '15 min', body: parsed.vocabulary || 'Kluczowe słownictwo i struktury' },
                { id: 'stage_3', title: '3. Main Discussion (20 min)', duration: '20 min', body: parsed.summary || 'Dyskusja i analiza zagadnienia' },
                { id: 'stage_4', title: '4. Controlled Practice & Role-play (10 min)', duration: '10 min', body: parsed.grammar || 'Ćwiczenia utrwalające' },
                { id: 'stage_5', title: '5. Wrap-up & Homework (5 min)', duration: '5 min', body: parsed.homework || 'Podsumowanie i zadanie domowe' },
              ];

        const targetLevel = parsed.level || fallback[0]?.level || 'B2';
        const duration = parsed.duration || '60 min';
        const goal = parsed.goal || parsed.summary || parsed.topic || 'Scenariusz lekcji';

        lessonScenario = {
          id: `scen_ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: parsed.topic || 'Scenariusz lekcji',
          topic: parsed.topic || 'Scenariusz lekcji',
          content: cleanText,
          studentId: fallback[0]?.id || null,
          studentName: fallback[0]?.name || null,
          targetLevel,
          lessonDuration: duration,
          lessonType: 'Scenariusz AI CRIBRO',
          vocabularyText: parsed.vocabulary || '',
          stages,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          goal,
          format: `indywidualna lekcja, ${duration}, poziom ${targetLevel}`,
          sourceMaterialDescription: 'Wygenerowano z Asystenta Lektora CRIBRO',
          planJson: JSON.stringify({
            title: parsed.topic || 'Scenariusz lekcji',
            summary: parsed.summary || '',
            format: `indywidualna lekcja, ${duration}, poziom ${targetLevel}`,
            goal,
            sourceMaterialDescription: 'Wygenerowano z Asystenta Lektora CRIBRO',
            sections: stages.map((st, sIdx) => ({
              id: st.id || `sec_${sIdx + 1}`,
              title: st.title,
              duration: st.duration,
              items: [
                {
                  id: `item_${sIdx + 1}_1`,
                  kind: 'text',
                  text: st.body,
                },
              ],
            })),
          }),
        };
      }
    } catch (e) {
      console.warn('Could not parse lesson_json from assistant:', e);
    }
    cleanText = rawResponseText.replace(/```lesson_json[\s\S]*?```/g, '').trim();
  }

  // Rozpoznaj blok students_import_json
  const studentsImportMatch = rawResponseText.match(/```students_import_json\s*([\s\S]*?)\s*```/);
  if (studentsImportMatch) {
    try {
      const parsed = JSON.parse(studentsImportMatch[1]);
      const list = Array.isArray(parsed) ? parsed : parsed.students;
      if (Array.isArray(list) && list.length > 0) {
        studentsImport = {
          students: list.map((st: any) => ({
            firstName: st.firstName || '',
            lastName: st.lastName || '',
            username: st.username || `${st.firstName || ''} ${st.lastName || ''}`.trim() || 'Kursant',
            email: st.email || '',
            password: st.password || '',
            level: st.level || 'A2-B1',
            company: st.company || '',
            notes: st.notes || '',
          })),
          summary: parsed.summary || `Rozpoznano ${list.length} kursantów gotowych do zaimportowania do CRM.`,
        };
      }
    } catch (e) {
      console.warn('Could not parse students_import_json from assistant:', e);
    }
    cleanText = cleanText.replace(/```students_import_json[\s\S]*?```/g, '').trim();
  }

  // Sanityzacja i ekstrakcja pytań follow-up
  const { cleanedText: sanitizedText, followUps: extractedFollowups } = extractFollowUpsAndCleanText(cleanText);
  cleanText = sanitizedText;
  let followUpSuggestions: string[] | undefined = extractedFollowups.length > 0 ? extractedFollowups : undefined;

  // Rozpoznaj blok html_report
  const htmlReportMatch = rawResponseText.match(/```html_report\s*([\s\S]*?)\s*```/);
  if (htmlReportMatch) {
    try {
      const rawHtml = htmlReportMatch[1].trim();
      const titleMatch = rawHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Raport CRIBRO';

      htmlReport = {
        title,
        html: rawHtml,
        summary: 'Wygenerowano sformatowany dokument HTML z opcją pobrania jako plik PDF A4.',
      };
    } catch (e) {
      console.warn('Could not parse html_report from assistant:', e);
    }
    cleanText = cleanText.replace(/```html_report[\s\S]*?```/g, '').trim();
  }

  // Fallback: jeśli lektor pytał o konspekt/scenariusz, a model wypluł tylko etapy w tekście
  if (
    !lessonScenario &&
    (cleanQ.includes('/konspekt') || cleanQ.includes('konspekt') || cleanQ.includes('scenariusz') || cleanQ.includes('/slajdy'))
  ) {
    const autoStages = parseScenarioStages(cleanText);
    if (autoStages.stages && autoStages.stages.length >= 2) {
      const targetLevel = fallback[0]?.level || 'B2';
      const duration = '60 min';
      lessonDraft = {
        topic: autoStages.topic || autoStages.title || 'Scenariusz lekcji',
        summary: autoStages.title || '',
        vocabulary: autoStages.vocabularyText || '',
        studentId: fallback[0]?.id,
        studentName: fallback[0]?.name,
      };
      lessonScenario = {
        id: `scen_ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: autoStages.title || 'Scenariusz lekcji',
        topic: autoStages.topic || 'Scenariusz lekcji',
        content: cleanText,
        studentId: fallback[0]?.id || null,
        studentName: fallback[0]?.name || null,
        targetLevel,
        lessonDuration: duration,
        lessonType: 'Scenariusz AI CRIBRO',
        vocabularyText: autoStages.vocabularyText || '',
        stages: autoStages.stages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        goal: autoStages.topic,
        format: `indywidualna lekcja, ${duration}, poziom ${targetLevel}`,
        sourceMaterialDescription: 'Wygenerowano z Asystenta Lektora CRIBRO',
        planJson: JSON.stringify({
          title: autoStages.title || 'Scenariusz lekcji',
          summary: autoStages.title || '',
          format: `indywidualna lekcja, ${duration}, poziom ${targetLevel}`,
          goal: autoStages.topic,
          sections: autoStages.stages.map((st, sIdx) => ({
            id: st.id || `sec_${sIdx + 1}`,
            title: st.title,
            duration: st.duration,
            items: [
              {
                id: `item_${sIdx + 1}_1`,
                kind: 'text',
                text: st.body,
              },
            ],
          })),
        }),
      };
    }
  }

  // Czyścimy ewentualne otaczające znaczniki markdown
  cleanText = cleanText
    .replace(/^~~~[a-zA-Z]*\s*/gm, '')
    .replace(/~~~$/gm, '')
    .trim();

  // Generuj inteligentne przyciski akcji (Notion AI style)
  const actions: AssistantAction[] = [];
  const primaryStudent = fallback[0];

  if (studentsImport) {
    actions.push({
      type: 'bulk_import',
      label: `👥 Dodaj ${studentsImport.students.length} kursantów do CRM`,
      studentsImport,
    });
  }

  if (htmlReport) {
    actions.push({
      type: 'html_pdf',
      label: `📄 Pobierz PDF: ${htmlReport.title.slice(0, 30)}`,
      htmlReport,
    });
  }

  if (scenarioToolResult) {
    actions.push({
      type: 'profile',
      label: `Przejdź do profilu kursanta (${scenarioToolResult.studentName})`,
      studentId: scenarioToolResult.studentId,
      studentName: scenarioToolResult.studentName,
    });
  }

  if (lessonScenario || lessonDraft) {
    actions.push({
      type: 'planner',
      label: '🚀 Otwórz w Studio Planera',
      studentId: primaryStudent?.id,
      studentName: primaryStudent?.name,
      topic: lessonScenario?.topic || lessonDraft?.topic,
      lessonDraft,
      lessonScenario,
    });
    actions.push({
      type: 'presentation',
      label: '📡 Uruchom Sesję Live (Slajdy)',
      studentId: primaryStudent?.id,
      studentName: primaryStudent?.name,
      topic: lessonScenario?.topic || lessonDraft?.topic,
      lessonDraft,
      lessonScenario,
    });
    actions.push({
      type: 'insert_lesson',
      label: '💾 Zapisz w Dzienniku lekcji',
      studentId: primaryStudent?.id,
      studentName: primaryStudent?.name,
      topic: lessonDraft?.topic || lessonScenario?.topic,
      lessonDraft,
      lessonScenario,
    });
    actions.push({
      type: 'homework',
      label: '📝 Zadaj jako Pracę domową',
      studentId: primaryStudent?.id,
      studentName: primaryStudent?.name,
      topic: lessonDraft?.topic || lessonScenario?.topic,
      lessonDraft,
      lessonScenario,
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
  } else if (!studentsImport && !htmlReport) {
    actions.push({ type: 'planner', label: 'Otwórz Planer lekcji' });
    actions.push({ type: 'homework', label: 'Zadania i testy' });
    actions.push({ type: 'mailing', label: 'Otwórz Mailing' });
  }

  return {
    text: cleanText.trim(),
    usedStudents: fallback.map(entry => entry.name),
    actions,
    lessonDraft,
    lessonScenario,
    scenarioToolResult,
    studentsImport,
    htmlReport,
    webSources: detectedWebSources.length > 0 ? detectedWebSources : undefined,
    followUpSuggestions,
    modelUsed,
    isCouncil,
  };
};

