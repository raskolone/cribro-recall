import { db } from '../firebase';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { GeneratedLessonScenario, LessonScenarioStage, LessonAttachment } from '../types';

const LOCAL_STORAGE_SCENARIOS_KEY = 'cribro_generated_lesson_scenarios_v1';

export function parseScenarioStages(content: string): {
  title: string;
  topic: string;
  stages: LessonScenarioStage[];
  vocabularyText: string;
  summary: string;
  followUp: string;
} {
  if (!content) {
    return {
      title: 'Scenariusz lekcji',
      topic: 'Scenariusz lekcji',
      stages: [],
      vocabularyText: '',
      summary: '',
      followUp: ''
    };
  }

  const lines = content.split('\n');
  let title = '';
  let topic = '';
  const stages: LessonScenarioStage[] = [];
  let currentStage: LessonScenarioStage | null = null;
  const bodyLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for main title
    if (!title && (trimmed.startsWith('# ') || trimmed.toLowerCase().startsWith('scenariusz:') || trimmed.toLowerCase().startsWith('**scenariusz:'))) {
      const rawTitle = trimmed
        .replace(/^#+\s*/, '')
        .replace(/^\*\*scenariusz:\*\*/i, '')
        .replace(/^scenariusz:\s*/i, '')
        .replace(/\*\*/g, '')
        .trim();
      title = rawTitle.toLowerCase().startsWith('scenariusz') ? rawTitle : `Scenariusz: ${rawTitle}`;
      topic = rawTitle.replace(/^scenariusz:\s*/i, '').trim();
      continue;
    }

    // Check for section header
    const isHeaderMatch = 
      trimmed.startsWith('## ') || 
      trimmed.startsWith('### ') || 
      /^(\*\*)?\s*(\d+\.|\d+\))\s+[A-Za-zĄ-ź\s–-]+(\(\d+.*?\))?(\*\*)?:?$/.test(trimmed) ||
      (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length < 80 && (trimmed.includes('min') || /^\*\*\d+\./.test(trimmed)));

    if (isHeaderMatch) {
      if (currentStage) {
        currentStage.body = bodyLines.join('\n').trim();
        stages.push(currentStage);
        bodyLines.length = 0;
      }

      const rawTitle = trimmed
        .replace(/^#+\s*/, '')
        .replace(/\*\*/g, '')
        .replace(/:$/, '')
        .trim();

      const durationMatch = rawTitle.match(/\((.*?min.*?)\)/i);
      const duration = durationMatch ? durationMatch[1] : undefined;

      currentStage = {
        id: `stage-${stages.length + 1}-${rawTitle.slice(0, 15).replace(/\s+/g, '-')}`,
        title: rawTitle,
        duration,
        body: ''
      };
      continue;
    }

    if (currentStage) {
      bodyLines.push(line);
    } else if (trimmed && !title) {
      title = `Scenariusz: ${trimmed.slice(0, 50)}`;
      topic = trimmed.slice(0, 50);
    }
  }

  if (currentStage) {
    currentStage.body = bodyLines.join('\n').trim();
    stages.push(currentStage);
  }

  if (!title) {
    title = 'Scenariusz lekcji';
    topic = 'Scenariusz lekcji';
  }
  if (!topic) {
    topic = title.replace(/^Scenariusz:\s*/i, '').trim();
  }

  // Extract vocabulary
  let vocabularyText = '';
  const vocabStage = stages.find(s => 
    s.title.toLowerCase().includes('language focus') || 
    s.title.toLowerCase().includes('słownictwo') || 
    s.title.toLowerCase().includes('vocabulary') ||
    s.title.toLowerCase().includes('idiom') ||
    s.title.toLowerCase().includes('zwroty')
  );
  if (vocabStage) {
    const vocabLines = vocabStage.body.split('\n')
      .map(l => l.trim())
      .filter(l => (l.startsWith('-') || l.startsWith('*') || /^\d+\./.test(l)) && (l.includes(' - ') || l.includes(' – ') || l.includes(':') || l.includes('—')));
    vocabularyText = vocabLines.map(l => l.replace(/^[-*\d.]+\s*/, '').replace(/\*\*/g, '').trim()).join('\n');
  }

  // Extract summary and follow up
  let summary = '';
  const warmUp = stages.find(s => s.title.toLowerCase().includes('warm up') || s.title.toLowerCase().includes('revision'));
  const mainTopic = stages.find(s => s.title.toLowerCase().includes('main topic') || s.title.toLowerCase().includes('główny'));
  const practice = stages.find(s => s.title.toLowerCase().includes('practice') || s.title.toLowerCase().includes('ćwiczeni') || s.title.toLowerCase().includes('role-play'));

  const summaryParts: string[] = [];
  if (warmUp) summaryParts.push(`• Warm Up: ${warmUp.body.slice(0, 150)}...`);
  if (mainTopic) summaryParts.push(`• Main Topic: ${mainTopic.body.slice(0, 200)}...`);
  if (practice) summaryParts.push(`• Practice: ${practice.body.slice(0, 150)}...`);
  summary = summaryParts.join('\n');

  let followUp = '';
  const hwStage = stages.find(s => s.title.toLowerCase().includes('homework') || s.title.toLowerCase().includes('praca domowa') || s.title.toLowerCase().includes('zadanie'));
  if (hwStage) {
    followUp = hwStage.body;
  }

  return { title, topic, stages, vocabularyText, summary, followUp };
}

export function getLocalCachedScenarios(): GeneratedLessonScenario[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SCENARIOS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to read scenarios from localStorage:', e);
  }
  return [];
}

export function saveLocalCachedScenarios(scenarios: GeneratedLessonScenario[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_SCENARIOS_KEY, JSON.stringify(scenarios));
  } catch (e) {
    console.warn('Failed to save scenarios to localStorage:', e);
  }
}

export async function saveGeneratedScenario(
  input: {
    id?: string;
    title?: string;
    topic?: string;
    content: string;
    studentId?: string | null;
    studentName?: string | null;
    targetLevel?: string;
    lessonDuration?: string;
    lessonType?: string;
    vocabularyText?: string;
    stages?: LessonScenarioStage[];
    tags?: string[];
    sourceFiles?: string[];
    attachments?: LessonAttachment[];
    isTemplate?: boolean;
    category?: string;
    planJson?: string;
    format?: string;
    goal?: string;
    sourceMaterialDescription?: string;
  }
): Promise<GeneratedLessonScenario> {
  const parsed = parseScenarioStages(input.content);
  const now = new Date().toISOString();
  const scenarioId = input.id || `scenario-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const scenario: GeneratedLessonScenario = {
    id: scenarioId,
    title: input.title || parsed.title,
    topic: input.topic || parsed.topic,
    content: input.content,
    studentId: input.studentId || null,
    studentName: input.studentName || null,
    targetLevel: input.targetLevel || 'B2',
    lessonDuration: input.lessonDuration || '60 min',
    lessonType: input.lessonType || 'Konwersacje i Płynność',
    vocabularyText: input.vocabularyText || parsed.vocabularyText,
    stages: input.stages && input.stages.length > 0 ? input.stages : parsed.stages,
    createdAt: now,
    updatedAt: now,
    tags: input.tags || [],
    sourceFiles: input.sourceFiles || [],
    attachments: input.attachments,
    isTemplate: input.isTemplate || false,
    category: input.category,
    planJson: input.planJson,
    format: input.format,
    goal: input.goal,
    sourceMaterialDescription: input.sourceMaterialDescription,
  };

  // 1. Update local cache first
  const localList = getLocalCachedScenarios();
  const existingIdx = localList.findIndex(s => s.id === scenario.id);
  let updatedLocal: GeneratedLessonScenario[];
  if (existingIdx >= 0) {
    updatedLocal = [...localList];
    updatedLocal[existingIdx] = scenario;
  } else {
    updatedLocal = [scenario, ...localList];
  }
  saveLocalCachedScenarios(updatedLocal);

  // 2. Persist to Firestore
  try {
    const docRef = doc(db, 'lessonScenarios', scenario.id);
    await setDoc(docRef, {
      ...scenario,
      updatedAt: now,
      serverCreatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn('Could not save scenario to Firestore (using local cache):', err);
  }

  return scenario;
}

export async function getGeneratedScenarios(studentId?: string | null): Promise<GeneratedLessonScenario[]> {
  const localList = getLocalCachedScenarios();

  try {
    const scenariosRef = collection(db, 'lessonScenarios');
    const q = query(scenariosRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const firestoreList: GeneratedLessonScenario[] = [];

    snapshot.forEach(docSnap => {
      firestoreList.push({ id: docSnap.id, ...docSnap.data() } as GeneratedLessonScenario);
    });

    if (firestoreList.length > 0) {
      // Merge with local list (prefer newest)
      const mergedMap = new Map<string, GeneratedLessonScenario>();
      firestoreList.forEach(s => mergedMap.set(s.id, s));
      localList.forEach(s => {
        if (!mergedMap.has(s.id)) {
          mergedMap.set(s.id, s);
        }
      });
      const combined = Array.from(mergedMap.values());
      combined.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      saveLocalCachedScenarios(combined);

      if (studentId) {
        return combined.filter(s => !s.studentId || s.studentId === studentId);
      }
      return combined;
    }
  } catch (err) {
    console.warn('Could not load scenarios from Firestore (using local cache):', err);
  }

  if (studentId) {
    return localList.filter(s => !s.studentId || s.studentId === studentId);
  }
  return localList;
}

export async function getScenarioById(id: string): Promise<GeneratedLessonScenario | null> {
  const localList = getLocalCachedScenarios();
  const localFound = localList.find(s => s.id === id);
  if (localFound) return localFound;

  try {
    const docRef = doc(db, 'lessonScenarios', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as GeneratedLessonScenario;
    }
  } catch (err) {
    console.warn('Could not fetch scenario by id:', err);
  }
  return null;
}

export const DEFAULT_CURATED_SCENARIOS: GeneratedLessonScenario[] = [
  {
    id: 'curated-negotiations-b2',
    title: 'Business Negotiations & Diplomatic Language',
    topic: 'Business Negotiations & Diplomatic Language',
    category: 'Business English',
    isTemplate: true,
    targetLevel: 'B2/C1',
    lessonDuration: '60 min',
    lessonType: 'Business English',
    tags: ['Business', 'Negotiations', 'Diplomacy', 'Idioms'],
    vocabularyText: `to cut your losses - wycofać się w porę, ograniczyć straty
diminishing returns - malejące korzyści krańcowe
to move the needle - zrobić zauważalną różnicę, posunąć sprawy do przodu
a sunk cost fallacy - pułapka utopionych kosztów
to weed out - odsiać, wyeliminować
with all due respect - z całym szacunkiem (dyplomatyczna odmowa)
to play devil's advocate - być adwokatem diabła
to meet halfway - pójść na kompromis`,
    content: `# Scenariusz: Business Negotiations & Diplomatic Language

## 1. Revision and Warm Up (12 min)
- **Powtórka poprzednich zwrotów**: Sprawdź, czy kursant pamięta: *to streamline*, *bottleneck*, *to delegate effectively*.
- **Pytania rozgrzewkowe**:
  1. *How do you handle situations when you completely disagree with a client or partner without causing tension?*
  2. *Have you ever had to say "no" to an aggressive timeline? What phrases did you use?*
  3. *In your experience, is extreme directness respected or counterproductive in international negotiations?*

## 2. Main Topic: Diplomatic Pushback & Pareto Rule (20 min)
- **Główna dyskusja**: Koncepcja *"Good enough vs. Perfectionism"* w biznesie oraz asertywne odmawianie z zachowaniem relacji (diplomatic pushback).
- **Pytania problemowe**:
  1. *Why do people often say "yes" too quickly in meetings and regret it later?*
  2. *How can you soften negative news (hedging) without sounding unconfident?*
  3. *When does upgrading an agreement become a sunk cost fallacy?*

## 3. Language Focus & Key Collocations (10 min)
Kluczowe zwroty z polskim tłumaczeniem i naturalnym kontekstem:
1. **to cut your losses** – wycofać się w porę, ograniczyć straty (*"Sometimes the best commercial move is to cut your losses early."*)
2. **diminishing returns** – malejące korzyści krańcowe (*"Spending another week renegotiating this clause brings diminishing returns."*)
3. **to move the needle** – zrobić zauważalną różnicę (*"We should focus exclusively on concessions that genuinely move the needle."*)
4. **a sunk cost fallacy** – pułapka utopionych kosztów (*"Don't cling to a losing contract just because of the sunk cost fallacy."*)
5. **to weed out** – odsiać, wyeliminować (*"We need to weed out unviable terms before signing."*)
6. **with all due respect** – z całym szacunkiem (*"With all due respect, this deadline does not match our scope."*)
7. **to meet halfway** – pójść na kompromis (*"If you can expedite payment, we are happy to meet you halfway on the license fee."*)

## 4. Practice Enclosure (10 min)
- **Szybka symulacja decyzyjna (Role-Play)**:
  - *Sytuacja*: Kursant negocjuje warunki wdrożenia oprogramowania. Klient domaga się 30% obniżki ceny i skrócenia czasu realizacji o połowę.
  - *Zadanie*: Wyraź dyplomatyczny sprzeciw, zaproponuj alternatywne rozwiązanie (np. ograniczenie zakresu pierwszej fazy) i użyj minimum 3 zwrotów z dzisiejszej lekcji.

## 5. Homework — Translation PL→EN
1. Z całym szacunkiem, dalsze negocjacje w tym tonie przyniosą jedynie malejące korzyści.
   *(With all due respect, further negotiations in this tone will only yield diminishing returns.)*
2. Zamiast godzić się na nierealistyczne terminy, powinniśmy spotkać się w połowie drogi.
   *(Instead of agreeing to unrealistic deadlines, we should meet halfway.)*
3. Musimy odsiać nieistotne punkty sporu i skupić się na tym, co naprawdę posuwa sprawy do przodu.
   *(We need to weed out trivial points of contention and focus on what genuinely moves the needle.)*
4. Lepiej wycofać się w porę z tej transakcji, niż tkwić w pułapce utopionych kosztów.
   *(It is better to cut our losses on this deal than stay trapped in a sunk cost fallacy.)*`,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z'
  },
  {
    id: 'curated-smalltalk-b1',
    title: 'Mastering Small Talk & Business Networking',
    topic: 'Mastering Small Talk & Business Networking',
    category: 'Konwersacje i Płynność',
    isTemplate: true,
    targetLevel: 'B1/B2',
    lessonDuration: '45 min',
    lessonType: 'Konwersacje i Płynność',
    tags: ['Networking', 'Small Talk', 'Confidence', 'Speaking'],
    vocabularyText: `to break the ice - przełamać pierwsze lody
to strike up a conversation - nawiązać rozmowę
to keep the ball rolling - podtrzymać rozmowę / kontynuować płynnie
to find common ground - znaleźć wspólny język / wspólny punkt
by the way / speaking of which - przy okazji / nawiasem mówiąc
it slipped my mind - wyleciało mi z głowy
to wrap things up - zmierzać do brzegu, powoli kończyć spotkanie`,
    content: `# Scenariusz: Mastering Small Talk & Business Networking

## 1. Revision and Warm Up (8 min)
- **Pytania rozgrzewkowe**:
  1. *Do you enjoy small talk before a business meeting, or does it feel awkward?*
  2. *What is your go-to question when you meet an international colleague for the first time?*
  3. *What topics are completely off-limits in professional small talk?*

## 2. Main Topic: The Art of Keeping the Conversation Alive (15 min)
- **Technika "Answer + Add + Ask" (A+A+A)**: Jak unikać jednozdaniowych odpowiedzi kończących rozmowę.
- **Pytania do przećwiczenia**:
  - *"How was your weekend?"* -> zamiast *"Fine"*, model: *"It was pretty relaxing, actually — I tried that new running route near the river. Do you do any sports yourself?"*
  - Jak elegancko zakończyć rozmowę na konferencji i wymienić się kontaktami (graceful exit).

## 3. Language Focus & Connectors (10 min)
1. **to break the ice** – przełamać lody (*"A quick compliment on their keynote is great to break the ice."*)
2. **to strike up a conversation** – zagadać, nawiązać rozmowę (*"It’s always easier to strike up a conversation near the coffee stand."*)
3. **to keep the ball rolling** – podtrzymać dynamikę rozmowy (*"Asking open questions helps keep the ball rolling."*)
4. **to find common ground** – znaleźć wspólny mianownik (*"We quickly found common ground talking about agile management."*)
5. **speaking of which...** – nawiasem mówiąc, nawiązując do tego (*"Speaking of product launches, did you see their newest demo?"*)
6. **I don't want to monopolize your time...** – nie chcę zabierać całego Twojego czasu (eleganckie wyjście z rozmowy).

## 4. Practice Enclosure: The 3-Minute Networking Challenge (7 min)
- **Symulacja**: Spotykacie się w kuluarach międzynarodowej konferencji po prezentacji o trendach AI w edukacji.
- **Zadanie**: Nawiąż kontakt, znajdź wspólny punkt zawodowy, a po 3 minutach elegancko zakończ rozmowę, proponując wymianę profili na LinkedIn.

## 5. Homework — Translation & Dialogue
1. Zawsze trudno jest przełamać pierwsze lody, gdy nikt w pokoju się nie zna.
   *(It is always hard to break the ice when nobody in the room knows each other.)*
2. Nawiązaliśmy rozmowę w kolejce po kawę i natychmiast znaleźliśmy wspólny język.
   *(We struck up a conversation in the coffee queue and immediately found common ground.)*
3. Nie chcę zabierać całego Twojego czasu, ale z przyjemnością połączę się na LinkedIn.
   *(I don't want to monopolize your time, but I'd love to connect on LinkedIn.)*`,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z'
  },
  {
    id: 'curated-job-interview-c1',
    title: 'Job Interview Mastery & The STAR Technique',
    topic: 'Job Interview Mastery & The STAR Technique',
    category: 'Kariera i Praca',
    isTemplate: true,
    targetLevel: 'B2/C1',
    lessonDuration: '60 min',
    lessonType: 'Specjalistyczny / Branżowy',
    tags: ['Interview', 'Career', 'STAR Method', 'Leadership'],
    vocabularyText: `to spearhead - przewodzić inicjatywie, stać na czele projektu
to turn things around - odwrócić złą passę, doprowadzić do sukcesu
a proven track record - udokumentowane osiągnięcia i sukcesy
to liaise with - współpracować i utrzymywać kontakt między działami
to think on one's feet - szybko reagować i podejmować decyzje pod presją
room for improvement - pole do poprawy / obszar do rozwoju`,
    content: `# Scenariusz: Job Interview Mastery & The STAR Technique

## 1. Revision and Warm Up (10 min)
- **Pytania rozgrzewkowe**:
  1. *What is the hardest question you have ever faced in a professional interview?*
  2. *How do you talk about past professional failures without undermining your credibility?*
  3. *Why do interviewers value specific metrics over general claims?*

## 2. Main Topic: The STAR Framework (25 min)
- **Struktura odpowiedzi na pytania behawioralne**:
  - **S**ituation (Kontekst i tło sytuacji)
  - **T**ask (Jakie wyzwanie stało przed Tobą)
  - **A**ction (Jakie konkretne kroki podjąłeś — używaj *"I"*, a nie tylko *"we"*)
  - **R**esult (Wymierny wynik: oszczędność czasu, zysk, wyeliminowany błąd)
- Analiza pytań: *"Tell me about a time you managed a project that was falling behind schedule."*

## 3. Language Focus: Power Verbs (10 min)
1. **to spearhead an initiative** – stanąć na czele inicjatywy (*"I spearheaded the transition to microservices."*)
2. **to turn things around** – naprawić sytuację (*"We turned the project around within six weeks."*)
3. **a proven track record** – potwierdzone sukcesy (*"I have a proven track record in scaling B2B sales teams."*)
4. **to liaise with cross-functional stakeholders** – koordynować współpracę z różnymi zespołami.
5. **to think on your feet** – myśleć błyskawicznie (*"When the server crashed during the pitch, I had to think on my feet."*)

## 4. Practice Enclosure: Mock Interview Simulation (10 min)
- **Zadanie**: Lektor wciela się w rekrutera pytającego: *"What would your previous manager describe as your biggest area for improvement, and how did you address it?"* Kursant odpowiada strukturą STAR, demonstrując dojrzałość i samorefleksję.

## 5. Homework — Translation PL→EN
1. Stanąłem na czele zespołu, który wdrożył nowy system CRM przed wyznaczonym terminem.
   *(I spearheaded the team that implemented the new CRM system ahead of schedule.)*
2. Pod presją czasu musiałem błyskawicznie podejmować decyzje, aby uspokoić klienta.
   *(Under time pressure, I had to think on my feet to reassure the client.)*
3. Posiadam udokumentowane sukcesy w optymalizacji procesów i redukcji kosztów operacyjnych.
   *(I have a proven track record in optimizing processes and reducing operational costs.)*`,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z'
  },
  {
    id: 'curated-mixed-conditionals-b2',
    title: 'Hypothetical Thinking & Mixed Conditionals in Real Life',
    topic: 'Hypothetical Thinking & Mixed Conditionals in Real Life',
    category: 'Gramatyka w kontekście',
    isTemplate: true,
    targetLevel: 'B2/C1',
    lessonDuration: '50 min',
    lessonType: 'Gramatyka w kontekście',
    tags: ['Grammar', 'Conditionals', 'Regrets', 'Advanced'],
    vocabularyText: `in hindsight - z perspektywy czasu
had it not been for - gdyby nie (formalna inwersja)
if I hadn't made that decision, I wouldn't be here now - gdybym nie podjął tamtej decyzji, nie byłoby mnie tu dzisiaj
a blessing in disguise - nieszczęście, które wyszło na dobre
to dwell on the past - rozpamiętywać przeszłość`,
    content: `# Scenariusz: Hypothetical Thinking & Mixed Conditionals in Real Life

## 1. Revision and Warm Up (10 min)
- **Pytania rozgrzewkowe**:
  1. *Looking back at your career, what is one decision that changed everything for you?*
  2. *Have you ever experienced an apparent failure that turned out to be a blessing in disguise?*
  3. *Do you often find yourself thinking: "If only I had known that earlier..."?*

## 2. Main Topic: Mixed Conditionals (Past Cause -> Present Result & Vice Versa) (20 min)
- **Typ 1 (Przeszła przyczyna -> Teraźniejszy skutek)**:
  - *If I **had studied** computer science (w przeszłości), I **would be** working in AI today (teraz).*
  - Zastosowanie: refleksje nad ścieżką życiową, biznesowe retrospekcje.
- **Typ 2 (Stała cecha/teraźniejszy stan -> Przeszły skutek)**:
  - *If he **weren't** so stubborn (ogólnie/teraz), he **would have accepted** their offer yesterday (wtedy).*

## 3. Language Focus & Idioms of Reflection (10 min)
1. **in hindsight** – z perspektywy czasu (*"In hindsight, declining that position was the right call."*)
2. **had it not been for...** – gdyby nie... (*"Had it not been for their mentorship, I wouldn't run my own agency today."*)
3. **a blessing in disguise** – nieszczęście, które okazało się zbawienne.
4. **to dwell on the past** – rozpamiętywać przeszłość (*"It's healthy to analyze mistakes, but don't dwell on the past."*)

## 4. Practice Enclosure: Alternate History Timeline (5 min)
- **Ćwiczenie**: Kursant tworzy 3 zdania w trybie mieszanym (Mixed Conditionals) o historii swojej firmy lub kariery: 2 prawdziwe i 1 zmyślone. Lektor musi odgadnąć, które jest zmyślone.

## 5. Homework — Translation PL→EN
1. Gdybym nie zmienił pracy trzy lata temu, nie zarządzałbym dzisiaj międzynarodowym zespołem.
   *(If I hadn't changed jobs three years ago, I wouldn't be managing an international team today.)*
2. Z perspektywy czasu tamto odwołane wdrożenie okazało się zbawienne dla całej firmy.
   *(In hindsight, that canceled deployment turned out to be a blessing in disguise for the whole company.)*
3. Gdyby nie jej wsparcie techniczne, nie zamknęlibyśmy tego projektu w zeszłym miesiącu.
   *(Had it not been for her technical support, we wouldn't have closed that project last month.)*`,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z'
  }
];

export async function getCuratedLessonScenarios(): Promise<GeneratedLessonScenario[]> {
  return DEFAULT_CURATED_SCENARIOS;
}

export async function deleteGeneratedScenario(scenarioId: string): Promise<void> {
  // 1. Remove from local cache
  const localList = getLocalCachedScenarios().filter(s => s.id !== scenarioId);
  saveLocalCachedScenarios(localList);

  // 2. Delete from Firestore
  try {
    const docRef = doc(db, 'lessonScenarios', scenarioId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Could not delete scenario from Firestore:', err);
  }
}

