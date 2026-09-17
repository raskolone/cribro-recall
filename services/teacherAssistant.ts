import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { LessonRecord, LessonAttachment } from '../types';
import { getLessonRecordsForStudent } from './lessonRecord';
import { getAllUsers } from './userService';
import { extractLessonBlocks } from '../utils/lessonBlocks';
import { generateTextWithUnifiedFallback, getAI } from './geminiService';
import { runCouncil, DEFAULT_COUNCIL } from './aiCouncil';

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
  modelUsed?: string;
  isCouncil?: boolean;
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

export interface AssistantSkill {
  id: string;
  command: string;
  name: string;
  description: string;
  icon: string;
  category: 'Planowanie' | 'Analiza' | 'Ćwiczenia' | 'Komunikacja';
  template: string;
  badge?: string;
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
5. Obsługa szybkich komend lektora (np. /konspekt, /podsumowanie, /zadanie, /fiszki, /slajdy, /bledy, /kolo, /email, /analiza).

ZASADY ODPOWIADANIA I FORMATOWANIA (BARDZO WAŻNE):
- Odpowiadasz PO POLSKU, nowocześnie, przejrzyście, z zachowaniem nienagannej estetyki wizualnej.
- Gdy zwracasz się po polsku do lektora lub kursanta po imieniu, ZAWSZE odmieniaj imię przez przypadki i używaj naturalnego WOŁACZA (np. „Macieju”, „Anno”, „Piotrze”, „Kasiu”, „Michale”, „Janie”, „Dariuszu”), nigdy mianownika.
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

- Gdy pytanie dotyczy faktów z bazy CRM („z kim była ostatnia lekcja”, „kto ma zaległości”), odpowiedz zwięźle i konkretnie w punktach, bez zbędnego bloku lesson_json.
- Nie zmyślasz faktów z przeszłości. Jeśli czegoś nie ma w historii kursanta, poinformuj o tym wprost.`;

export const TEACHER_ASSISTANT_REVIEW_SYSTEM = `
Jesteś starszym metodykiem języka angielskiego w platformie CRIBRO ENGLISH recenzującym odpowiedź Asystenta Lektora.
Twoim celem jest zagwarantowanie najwyższej jakości merytorycznej, poprawności językowej oraz elegancji formatowania.

Sprawdź w szczególności:
1. AUTENTYCZNOŚĆ I NATURALNOŚĆ: Wszystkie zdania angielskie i polskie muszą brzmieć w 100% naturalnie dla native speakerów. Bezwzględny zakaz sztucznych zdań czy niegramatycznych kalk językowych.
2. DOPASOWANIE DO KURSANTA: Czy słownictwo i poziom gramatyki odpowiadają poziomowi CEFR i historii kursanta (jeśli został wskazany)?
3. FORMATOWANIE: Czy odpowiedź jest czytelnie podzielona na sekcje Markdown z nagłówkami, listami punktowanymi i wytłuszczeniami? Jeśli to propozycja lekcji, czy na końcu znajduje się poprawny blok \`\`\`lesson_json\`\`\`?
4. DOKŁADNOŚĆ: Czy nie ma zmyślonych faktów o kursancie, które nie wynikają z przekazanej bazy CRM?

Wypisz maksymalnie 4 zwięzłe uwagi do poprawy lub napisz dokładnie: „Brak zastrzeżeń."
`.trim();

export type AIAssistantMode = 'flash' | 'thinking';

/**
 * Odpowiedź asystenta lektora z obsługą kontekstu bazy CRM, załączników multimedialnych, komend / oraz trybów Flash (szybki) i Thinking (Rada Modeli AI).
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
  modelUsed?: string;
  isCouncil?: boolean;
}> => {
  const cleanQ = question.trim().toLowerCase();
  if (cleanQ === '/help' || cleanQ === 'help' || cleanQ === '/pomoc' || cleanQ === 'pomoc') {
    return {
      text: `### 💡 Asystent Lektora CRIBRO — Przewodnik i Możliwości

Jestem Twoim asystentem AI zintegrowanym z bazą CRM kursantów, historią lekcji oraz modułami platformy CRIBRO.

#### 🎯 Do czego możesz mnie użyć?
* 📚 **Konspekty lekcji 4-blokowych** (\`/konspekt\`): Generowanie 4-częściowych konspektów Notion (Words, Grammar, Pronunciation, Homework) z natychmiastowym 1-klikowym zapisem.
* 👥 **Analiza kursantów i CRM** (\`/podsumowanie\` lub *@Kursant*): Szybki dostęp do historii lekcji, poziomu CEFR, notatek i najczęstszych trudności.
* 🎯 **Zadania domowe i ćwiczenia** (\`/zadanie\`, \`/fiszki\`): Kreatywne prace domowe, zestawy słówek do powtórek i zadania gramatyczne.
* 🎡 **Warm-up & Koło fortuny** (\`/kolo\`): Angażujące pytania rozgrzewkowe na 60–90 sekund do dyskusji na zajęciach.
* 📎 **Analiza materiałów (Multimodal)** (\`/analiza\`): Przeciągnij screenshot, zdjęcie zadania lub plik PDF, aby wyodrębnić słówka i ułożyć ćwiczenia.
* 📺 **Prezentacja Live** (\`/slajdy\`): Scenariusze i interaktywne slajdy do tablicy lekcyjnej na żywo.
* ✉️ **E-maile do kursantów** (\`/email\`): Profesjonalne i ciepłe podsumowania zajęć dla kursantów.

#### ⚡ Skróty i komendy:
* **\`@\`** — Wskaż kursanta z bazy CRM (np. *@Dariusz*), aby automatycznie załadować jego kontekst.
* **\`/\`** — Wybierz gotowy szablon komendy (np. \`/konspekt\`, \`/zadanie\`, \`/fiszki\`).
* **⚡ Flash** — Błyskawiczna odpowiedź jednomodelowa w ułamku sekundy.
* **🧠 Thinking** — Głęboka narada Rady Modeli AI (Autor + Recenzenci).`,
      usedStudents: [],
      actions: [],
      modelUsed: 'CRIBRO System',
      isCouncil: false,
    };
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
      modelUsed = 'Gemini 2.5 Flash (Multimodal)';
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
      modelUsed = fallbackRes.modelUsed || 'Gemini 2.5 Flash';
    }
  } else if (aiMode === 'thinking') {
    // 🧠 TRYB THINKING: Uruchomienie pełnej deliberacji Rady Modeli AI (Autor + Recenzenci + Konsensus)
    try {
      const councilRes = await runCouncil<string>({
        config: DEFAULT_COUNCIL,
        systemInstruction: SYSTEM_INSTRUCTION,
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
        SYSTEM_INSTRUCTION,
        undefined,
        undefined,
        undefined,
        { taskName: 'Asystent lektora (Thinking fallback)', category: 'general' }
      );
      rawResponseText = text;
      modelUsed = singleModel || 'Gemini 2.5 Flash';
    }
  } else {
    // ⚡ TRYB FLASH: Błyskawiczna, bezpośrednia generacja (najniższa latencja)
    try {
      const { text, modelUsed: singleModel } = await generateTextWithUnifiedFallback(
        prompt,
        SYSTEM_INSTRUCTION,
        undefined,
        undefined,
        undefined,
        { taskName: 'Asystent lektora (Flash Mode)', category: 'general' }
      );
      rawResponseText = text;
      modelUsed = singleModel || 'Gemini 2.5 Flash';
      isCouncil = false;
    } catch (flashErr) {
      console.warn('[TeacherAssistant] Flash mode direct error:', flashErr);
      const res = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });
      rawResponseText = res?.text || '';
      modelUsed = 'Gemini 2.5 Flash';
    }
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
    modelUsed,
    isCouncil,
  };
};

