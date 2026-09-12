import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, Send, Bot, User as UserIcon, Copy, Check, Clock, 
  BookOpen, Target, Layers, Lightbulb, RefreshCw, ChevronRight, 
  Trash2, AlertCircle, FileText, Brain, MessageSquare,
  Settings2, RotateCcw, History, Paperclip, Play, ArrowRight, X,
  FolderPlus, Wand2
} from 'lucide-react';
import Markdown from 'react-markdown';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { generateLessonPlannerAI } from '../../services/geminiService';
import { 
  User, 
  LessonRecord, 
  LessonModuleConfig, 
  LessonPlanPreset, 
  LessonPlannerCustomSettings,
  GeneratedLessonScenario,
  LessonAttachment
} from '../../types';
import { LessonModulesConfig } from './LessonModulesConfig';
import { LessonScenarioAccordion } from './LessonScenarioAccordion';
import { DEFAULT_LESSON_MODULES, LESSON_PRESETS } from './lessonPlannerPresets';
import { GeneratedScenariosSection } from './GeneratedScenariosSection';
import { saveGeneratedScenario, parseScenarioStages } from '../../services/scenarioService';
import { LessonFileUploader } from './LessonFileUploader';
import { ChooseScenarioModal } from './ChooseScenarioModal';

interface UserWithId extends User {
  id: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  suggestedTopic?: string;
  extractedVocab?: string;
  scenario?: GeneratedLessonScenario;
}

interface LessonPlannerProps {
  selectedUser?: UserWithId | null;
  users: UserWithId[];
  onSelectUser?: (user: UserWithId | null) => void;
  recentLessons?: LessonRecord[];
  onInsertLessonRecord?: (data: { 
    topic: string; 
    summary: string; 
    vocabulary: string; 
    followUp: string;
    scenarioId?: string;
    scenarioTopic?: string;
    scenarioContent?: string;
  }) => void;
  onOpenInPresentation?: (scenario: GeneratedLessonScenario) => void;
}

const LOCAL_STORAGE_PRESETS_KEY = 'cribro_lesson_planner_custom_presets_v2';
const LOCAL_STORAGE_SETTINGS_KEY = 'cribro_lesson_planner_custom_settings_v2';
const LOCAL_STORAGE_MODULES_KEY = 'cribro_lesson_planner_modules_v2';

export const LessonPlanner: React.FC<LessonPlannerProps> = ({
  selectedUser,
  users,
  onSelectUser,
  recentLessons = [],
  onInsertLessonRecord,
  onOpenInPresentation
}) => {
  const { user: currentUser } = useAuth();
  const { language } = useLanguage();
  const isAdmin = currentUser?.role === 'admin';
  const isTeacher = currentUser?.role === 'teacher' || isAdmin;
  const [scenariosTimestamp, setScenariosTimestamp] = useState<number>(Date.now());

  // Form State: Topic description, attachments, CEFR level, duration, type
  const [topicDescription, setTopicDescription] = useState('');
  const [targetLevel, setTargetLevel] = useState<string>(selectedUser?.level || 'B2');
  const [lessonDuration, setLessonDuration] = useState('60 min');
  const [lessonType, setLessonType] = useState('Konwersacje i Płynność');
  const [attachments, setAttachments] = useState<LessonAttachment[]>([]);
  const [selectedBaseScenario, setSelectedBaseScenario] = useState<GeneratedLessonScenario | null>(null);

  // Modals
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isChooseScenarioModalOpen, setIsChooseScenarioModalOpen] = useState(false);

  // Configured modules for lesson generator (with localStorage fallback)
  const [modules, setModules] = useState<LessonModuleConfig[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_MODULES_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load saved modules:', e);
    }
    return DEFAULT_LESSON_MODULES;
  });

  // Custom Prompt & Methodology Settings
  const [customSettings, setCustomSettings] = useState<LessonPlannerCustomSettings>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load saved planner settings:', e);
    }
    return {
      customPrompt: '',
      englishVariety: 'any',
      explanationStyle: 'concise',
      homeworkType: 'translation',
      vocabCount: 8
    };
  });

  // Custom Presets created by teacher
  const [customPresets, setCustomPresets] = useState<LessonPlanPreset[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_PRESETS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load saved custom presets:', e);
    }
    return [];
  });

  const [selectedPresetId, setSelectedPresetId] = useState<string>('preset-standard');

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content: `# Scenariusz: Finishing, Upgrading & Choosing What Deserves Your Time

## 1. Revision and Warm Up (15–20 min)
- **Powtórka poprzednich zwrotów**: Sprawdź, czy kursant pamięta: *to streamline*, *bottleneck*, *to delegate effectively*.
- **Pytania rozgrzewkowe**:
  1. *How do you decide what truly deserves your time when everything feels urgent?*
  2. *Have you ever spent too much time polishing a project that was already good enough?*
  3. *What is one task you completed recently that made a measurable impact?*

## 2. Main Topic (25–30 min)
- **Główna dyskusja**: Koncepcja *"Good enough vs. Perfectionism"* oraz reguła Pareto (80/20).
- **Pytania problemowe**:
  1. *Why is finishing a project often psychologically harder than starting it?*
  2. *How do top executives filter out low-value distractions without feeling guilty?*
  3. *In your opinion, when does upgrading a process become procrastination in disguise?*

## 3. Language Focus (10 min)
Kluczowe zwroty z polskim tłumaczeniem:
1. **to cut your losses** – wycofać się w porę, ograniczyć straty (*"Sometimes the best move is to cut your losses early."*)
2. **diminishing returns** – malejące korzyści krańcowe (*"Working beyond 50 hours a week often yields diminishing returns."*)
3. **to move the needle** – zrobić zauważalną różnicę, posunąć sprawy do przodu (*"Focus only on tasks that genuinely move the needle."*)
4. **a sunk cost fallacy** – pułapka utopionych kosztów (*"Don't cling to a failing tool just because of the sunk cost fallacy."*)
5. **to weed out** – odsiać, wyeliminować (*"We need to weed out low-impact meetings."*)

## 4. Practice Enclosure (10 min)
- **Szybka symulacja decyzyjna (Role-Play)**:
  - *Sytuacja*: Kursant jest liderem projektu i ma 3 godziny na zakończenie kwartału. Do wyboru są 3 zadania.
  - *Zadanie*: Uzasadnij po angielsku, które zadanie wybierasz i dlaczego pozostałe odrzucasz, używając min. 3 zwrotów z dzisiejszej lekcji.

## 5. Homework — Translation PL→EN
1. Musimy odsiać zadania, które nie przynoszą żadnej realnej wartości.
   *(We need to weed out tasks that bring no real value.)*
2. Dalsze dopracowywanie tej prezentacji to typowy przykład malejących korzyści krańcowych.
   *(Further polishing this presentation is a classic example of diminishing returns.)*
3. Zamiast skupiać się na drobiazgach, wybierz działania, które naprawdę posuwają sprawy do przodu.
   *(Instead of focusing on trivial details, choose actions that genuinely move the needle.)*
4. Lepiej wycofać się w porę niż tracić kolejne miesiące przez pułapkę utopionych kosztów.
   *(It is better to cut your losses than waste more months due to the sunk cost fallacy.)*`,
      timestamp: new Date()
    }
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_MODULES_KEY, JSON.stringify(modules));
    } catch (e) {
      console.warn('Failed to save modules to localStorage:', e);
    }
  }, [modules]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(customSettings));
    } catch (e) {
      console.warn('Failed to save settings to localStorage:', e);
    }
  }, [customSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_PRESETS_KEY, JSON.stringify(customPresets));
    } catch (e) {
      console.warn('Failed to save presets to localStorage:', e);
    }
  }, [customPresets]);

  // Update target level when selectedUser changes
  useEffect(() => {
    if (selectedUser?.level) {
      setTargetLevel(selectedUser.level);
    }
  }, [selectedUser]);

  const handleSelectPreset = (preset: LessonPlanPreset) => {
    setSelectedPresetId(preset.id);
    setModules(preset.modules);
    if (preset.defaultDuration) {
      setLessonDuration(preset.defaultDuration);
    }
    if (preset.customPrompt !== undefined) {
      setCustomSettings(prev => ({ ...prev, customPrompt: preset.customPrompt || '' }));
    }
  };

  const handleSaveCustomPreset = (name: string, description: string) => {
    const newPreset: LessonPlanPreset = {
      id: `custom-preset-${Date.now()}`,
      name,
      description,
      defaultDuration: lessonDuration,
      modules: [...modules],
      customPrompt: customSettings.customPrompt,
      isCustom: true
    };
    setCustomPresets(prev => [...prev, newPreset]);
    setSelectedPresetId(newPreset.id);
  };

  const handleDeleteCustomPreset = (presetId: string) => {
    if (window.confirm('Czy na pewno chcesz usunąć ten własny szablon?')) {
      setCustomPresets(prev => prev.filter(p => p.id !== presetId));
      if (selectedPresetId === presetId) {
        setSelectedPresetId('preset-standard');
        setModules(DEFAULT_LESSON_MODULES);
      }
    }
  };

  const handleUpdateMessageContent = (messageId: string, newContent: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        return { ...m, content: newContent };
      }
      return m;
    }));
  };

  const handleDeleteMessage = (messageId: string) => {
    setMessages(prev => {
      const remaining = prev.filter(m => m.id !== messageId);
      if (remaining.length === 0) {
        return [{
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          content: '### 🗑️ Scenariusz usunięty. Wpisz nowy temat powyżej lub wybierz szablon z Bazy Scenariuszy!',
          timestamp: new Date()
        }];
      }
      return remaining;
    });
  };

  // Active student lessons
  const studentLessons = selectedUser
    ? recentLessons.filter(l => l.studentId === selectedUser.id || (l as any).user_id === selectedUser.id || (l as any).userId === selectedUser.id)
    : [];

  const buildSystemPrompt = () => {
    let studentContext = '';
    if (selectedUser) {
      const studentName = selectedUser.firstName || selectedUser.username || 'Kursant';
      studentContext = `
DANE KURSANTA (PROFIL):
- Imię: ${studentName}
- Aktualny poziom CEFR: ${selectedUser.level || targetLevel || 'B2'}
- Cel i opis kursanta: ${selectedUser.description || 'brak dodatkowego opisu'}
${selectedUser.aiPrompt ? `- Specjalne wytyczne nauczyciela dla tego kursanta: ${selectedUser.aiPrompt}` : ''}
`;

      const lessonsToInspect = studentLessons.length > 0 ? studentLessons : recentLessons;
      if (lessonsToInspect && lessonsToInspect.length > 0) {
        const lastFew = lessonsToInspect.slice(0, 5);
        studentContext += `
HISTORIA OSTATNICH LEKCJI KURSANTA:
${lastFew.map((l, i) => `Lekcja ${i + 1} (${l.date || 'ostatnio'}):
  • Temat: "${l.topic}"
  ${l.vocabularyText ? `• Nowe słownictwo: ${l.vocabularyText.replace(/\n/g, ', ')}` : ''}
  ${l.lessonSummary ? `• Przebieg/Podsumowanie: ${l.lessonSummary}` : ''}
  ${l.thingsToImprove ? `• Błędy / Kwestie do poprawy: ${l.thingsToImprove}` : ''}
  ${l.suggestedFollowUp ? `• Rekomendacja na kolejną lekcję: ${l.suggestedFollowUp}` : ''}`).join('\n\n')}
`;
      }
    }

    const activeModules = modules.filter(m => m.enabled);
    const modulesStructurePrompt = activeModules.length > 0
      ? `
WYMAGANA STRUKTURA SCENARIUSZA (Gdy generujesz pełną lekcję, podziel ją DOKŁADNIE na poniższe ${activeModules.length} modułów w podanej kolejności):
Rozpocznij odpowiedź ZAWSZE od nagłówka poziomu pierwszego:
# Scenariusz: [Tytuł tematu po angielsku lub polsku odpowiadający zapytaniu lektora]

Następnie dla KAŻDEGO z poniższych aktywnych modułów utwórz osobny nagłówek poziomu drugiego (## Dokładna Nazwa Modułu) i wygeneruj odpowiednią zawartość:
${activeModules.map((m) => `## ${m.title}
Instrukcje dla tego modułu: ${m.placeholderInstruction || 'Przygotuj zawartość dydaktyczną dla tego etapu lekcji.'}${m.duration ? ` (Czas orientacyjny: ${m.duration})` : ''}`).join('\n\n')}
`
      : '';

    let customDirectives = '';
    if (customSettings.customPrompt) {
      customDirectives += `\nSPECJALNY PROMPT I WYTYCZNE NAUCZYCIELA:\n${customSettings.customPrompt}\n`;
    }

    let englishVarietyText = 'Standardowy uniwersalny angielski (Global English)';
    if (customSettings.englishVariety === 'british') englishVarietyText = 'British English (brytyjski akcent, słownictwo i ortografia UK)';
    if (customSettings.englishVariety === 'american') englishVarietyText = 'American English (amerykańskie słownictwo i idiomy US)';

    let explanationText = customSettings.explanationStyle === 'concise' 
      ? 'Krótkie, zwięzłe w punktach bez zbędnego teoretyzowania' 
      : 'Szczegółowe, z objaśnieniem niuansów językowych i typowych pułapek';

    let homeworkText = 'Zestaw 5-8 zdań do tłumaczenia z polskiego na angielski (PL->EN) sprawdzający nowe słownictwo';
    if (customSettings.homeworkType === 'writing') homeworkText = 'Zadanie pisemne: przygotowanie profesjonalnego maila lub notatki biznesowej z wytycznymi';
    if (customSettings.homeworkType === 'speaking') homeworkText = 'Zadanie ustne: przygotowanie 2-minutowej wypowiedzi z wykorzystaniem 5 poznanych struktur';
    if (customSettings.homeworkType === 'mixed') homeworkText = 'Zadanie mieszane: 4 zdania do tłumaczenia + 1 krótkie pytanie problemowe (mini-case)';

    return `Jesteś doświadczonym metodykiem języka angielskiego, Content Designerem (Senior ESL Curriculum & Content Designer) oraz inteligentnym partnerem do rozmowy dla lektora.
Tworzysz angażujące, przejrzyste, praktyczne i nowoczesne materiały dydaktyczne dla dorosłych kursantów na podstawie pomysłów, screenshotów z podręczników, skanów PDF lub tematów z bazy.

PARAMETRY LEKCJI:
- Czas trwania: ${lessonDuration}
- Poziom docelowy: ${targetLevel}
- Profil/Tryb: ${lessonType}
- Odmiana języka: ${englishVarietyText}
- Liczba kluczowych zwrotów w sekcji słownictwa: ${customSettings.vocabCount || 8}
- Styl objaśnień gramatycznych: ${explanationText}
- Preferowany typ zadania domowego: ${homeworkText}
${studentContext}
${customDirectives}
${modulesStructurePrompt}

WYTYCZNE DLA CONTENT DESIGNERA (EKSTRAKCJA Z PODRĘCZNIKÓW I SKANÓW):
1. EKSTRAKCJA I SYNTEZA:
   - Jeśli załączono screenshoty lub skany podręczników / PDF, dokładnie przeanalizuj ich treść, wyodrębnij z nich kluczowe zagadnienia, słownictwo, kolokacje oraz pytania dyskusyjne.
   - Odsiej przestarzałą gramatykę i nudne teksty – przekształć je w dynamiczne, nowoczesne ćwiczenia konwersacyjne i biznesowe.
2. INTERAKTYWNE ZADANIA Z ODPOWIEDZIAMI:
   - Przy zadaniach i ćwiczeniach (gap-fill, tłumaczenia, pytania kontrolne) ZAWSZE podawaj prawidłową odpowiedź lub modelowe tłumaczenie w nawiasie na końcu linii, np. "(Odpowiedź: ...)" lub "(Tłumaczenie: ...)", co umożliwi lektorowi interaktywne odkrywanie odpowiedzi na slajdach w czasie rzeczywistym.
3. PRZEJRZYSTOŚĆ I MODUŁOWOŚĆ:
   - Zadbaj o czytelny podział na etapy z orientacyjnym czasem trwania (Warm-up, Core Discussion, Vocabulary, Grammar/Pronunciation, Practice/Exit Ticket, Homework).

TRYBY INTERAKCJI Z LEKTOREM:
1. TRYB SUGESTII TEMATÓW (Gdy lektor prosi o sugestie np. "zasugeruj temat", "zaproponuj 3 tematy na podstawie historii"):
   - Przeanalizuj historię lekcji i profil kursanta.
   - Zaproponuj 3-4 angażujące propozycje tematów lekcji z uzasadnieniem i fokusem językowym.

2. TRYB PEŁNEGO KONSPEKTU (Gdy lektor podał konkretny temat lub załączył materiały/pliki):
   - Wygeneruj kompletny scenariusz lekcji z nagłówkiem "# Scenariusz: ..." i modułami "## ...".
   - Jeśli dołączono materiały źródłowe lub screenshoty, oprzyj pytania, słownictwo i ćwiczenia na ich treści.
   - Słownictwo i kolokacje podawaj zawsze z polskim tłumaczeniem i naturalnym przykładem użycia.
   - Zdania na pracę domową powinny być podane po polsku, a pod nimi w nawiasie wzorcowe tłumaczenie na angielski.

3. TRYB ADAPTACJI ISTNIEJĄCEGO MATERIAŁU (Gdy lektor przekazał gotowy szablon):
   - Zachowaj szkielet merytoryczny szablonu, ale dostosuj przykłady, stopień trudności i tematykę rozmów pod specyfikę i błędy wybranego kursanta.`;
  };

  const handleGenerateOrSendMessage = async (customPromptText?: string) => {
    const rawPrompt = (customPromptText || topicDescription).trim();
    if (!rawPrompt && attachments.length === 0 && !selectedBaseScenario) return;

    let finalPrompt = rawPrompt;
    if (selectedBaseScenario) {
      finalPrompt = `DOSTOSOWANIE SCENARIUSZA WZORCOWEGO:
Tytuł bazowy: "${selectedBaseScenario.topic || selectedBaseScenario.title}"
Treść bazowa szablonu:
${selectedBaseScenario.content}

INSTRUKCJA MODYFIKACJI LEKTORA:
${rawPrompt || 'Dostosuj powyższy scenariusz pod profil wybranego kursanta, zachowując jego strukturę, ale wprowadzając przykłady i ćwiczenia adekwatne do jego poziomu i historii.'}`;
    } else if (!rawPrompt && attachments.length > 0) {
      finalPrompt = `Przygotuj kompletny scenariusz lekcji na poziomie ${targetLevel} (${lessonDuration}) na podstawie załączonych materiałów/screenshotów. Wyciągnij z nich kluczowe słownictwo, pytania dyskusyjne oraz ćwiczenie utrwalające.`;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: rawPrompt || (selectedBaseScenario ? `Dostosuj scenariusz: ${selectedBaseScenario.topic}` : 'Generowanie lekcji z załączonych materiałów'),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const systemInstruction = buildSystemPrompt();

      const conversationHistory = messages
        .filter(m => m.id !== 'welcome')
        .slice(-6)
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const response = await generateLessonPlannerAI({
        prompt: finalPrompt,
        systemInstruction,
        conversationHistory,
        attachments
      });

      const responseText = response?.text || 'Przepraszam, nie udało się wygenerować odpowiedzi. Spróbuj ponownie.';

      // Extract vocabulary
      let extractedVocab = '';
      const lines = responseText.split('\n');
      const vocabLines: string[] = [];
      lines.forEach(line => {
        const trimmed = line.trim();
        if ((trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) && (trimmed.includes(' - ') || trimmed.includes(' – ') || trimmed.includes(':'))) {
          const cleanLine = trimmed.replace(/^[-*\d.]+\s*/, '').trim();
          if (cleanLine.length > 3 && cleanLine.length < 120) {
            vocabLines.push(cleanLine);
          }
        }
      });
      if (vocabLines.length >= 3) {
        extractedVocab = vocabLines.join('\n');
      }

      // Save generated scenario
      let savedScenarioObj: GeneratedLessonScenario | undefined;
      if (responseText && responseText.length > 100) {
        const parsed = parseScenarioStages(responseText);
        const presetObj = LESSON_PRESETS.find(p => p.id === selectedPresetId) || customPresets.find(p => p.id === selectedPresetId);
        
        savedScenarioObj = await saveGeneratedScenario({
          title: parsed.title || rawPrompt || 'Scenariusz lekcji',
          topic: parsed.topic || rawPrompt || 'Scenariusz lekcji',
          content: responseText,
          studentId: selectedUser?.id || null,
          studentName: selectedUser ? (selectedUser.firstName ? `${selectedUser.firstName} ${selectedUser.lastName || ''}`.trim() : selectedUser.username) : null,
          targetLevel,
          lessonDuration,
          lessonType,
          vocabularyText: extractedVocab || parsed.vocabularyText,
          stages: parsed.stages,
          sourceFiles: attachments.map(a => a.name),
          attachments: attachments.length > 0 ? attachments : undefined
        });

        setScenariosTimestamp(Date.now());
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        extractedVocab,
        scenario: savedScenarioObj
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Clear base scenario & attachments if generation succeeded
      setSelectedBaseScenario(null);
    } catch (err: any) {
      console.error('Błąd generatora planera lekcji:', err);
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Wystąpił błąd podczas generowania odpowiedzi: ${err.message || 'Brak połączenia z modelem AI'}. Spróbuj ponownie za chwilę.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseCuratedScenarioDirectly = (scenario: GeneratedLessonScenario) => {
    setSelectedBaseScenario(null);
    setTopicDescription(scenario.topic || scenario.title);
    if (scenario.targetLevel) setTargetLevel(scenario.targetLevel);
    if (scenario.lessonDuration) setLessonDuration(scenario.lessonDuration);

    const directMessage: ChatMessage = {
      id: `direct-${Date.now()}`,
      role: 'assistant',
      content: scenario.content,
      timestamp: new Date(),
      extractedVocab: scenario.vocabularyText,
      scenario
    };

    setMessages(prev => [...prev, directMessage]);
  };

  const handleSelectScenarioForAdaptation = (scenario: GeneratedLessonScenario) => {
    setSelectedBaseScenario(scenario);
    setTopicDescription(`Dostosuj scenariusz "${scenario.topic || scenario.title}" z naciskiem na praktyczne ćwiczenia konwersacyjne.`);
    if (scenario.targetLevel) setTargetLevel(scenario.targetLevel);
    if (scenario.lessonDuration) setLessonDuration(scenario.lessonDuration);

    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleClearChat = () => {
    if (window.confirm('Czy na pewno chcesz wyczyścić historię czatu w planerze?')) {
      setMessages([
        {
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          content: '### 💬 Czat wyczyszczony. Wpisz temat powyżej lub wybierz scenariusz z bazy, aby rozpocząć planowanie!',
          timestamp: new Date()
        }
      ]);
      setTopicDescription('');
      setAttachments([]);
      setSelectedBaseScenario(null);
    }
  };

  const activeModulesCount = modules.filter(m => m.enabled).length;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* 1. GŁÓWNY MODUŁ TWORZENIA LEKCJI (PROSTY, INTUICYJNY, FOCUS-FIRST) */}
      <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-base-200/95 via-base-200/85 to-base-100/95 p-5 sm:p-7 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.5)] space-y-5">
        
        {/* Górna belka z tytułem i przyciskiem bazy szablonów */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/20 text-primary border border-primary/40 shadow-[0_0_20px_rgba(114,240,180,0.3)]">
              <Sparkles size={22} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Planer Lekcji
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                  Kreator
                </span>
              </h2>
              <p className="text-xs text-content-muted">
                Opisz własny temat lub wykorzystaj gotowy materiał z bazy i dostosuj go z AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsChooseScenarioModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-primary/15 hover:bg-primary text-primary hover:text-accent-ink border border-primary/40 hover:border-primary font-extrabold text-xs flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(114,240,180,0.2)] hover:shadow-[0_0_22px_rgba(114,240,180,0.4)] hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <Layers size={16} />
              <span>Baza Gotowych Scenariuszy</span>
            </button>

            <button
              type="button"
              onClick={() => setIsConfigModalOpen(true)}
              className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-text-hi border border-white/10 text-xs font-bold transition-all cursor-pointer"
              title="Dostosuj moduły CELTA i metodykę"
            >
              <Settings2 size={16} />
            </button>

            <button
              type="button"
              onClick={handleClearChat}
              className="p-2.5 rounded-2xl bg-white/5 hover:bg-red-500/15 text-content-muted hover:text-red-400 border border-white/10 hover:border-red-500/30 text-xs font-bold transition-all cursor-pointer"
              title="Wyczyść formularz i historię"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        {/* POLE: OPISZ, JAKĄ LEKCJĘ CHCIAŁBYŚ ZROBIĆ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
              <span className="text-primary">1.</span>
              <span>Opisz, jaką lekcję chciałbyś zrobić:</span>
            </label>
            {selectedBaseScenario && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <span>Baza: {selectedBaseScenario.topic || selectedBaseScenario.title}</span>
                <button
                  type="button"
                  onClick={() => setSelectedBaseScenario(null)}
                  className="hover:text-text-hi ml-1 cursor-pointer"
                  title="Anuluj adaptację szablonu"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={topicDescription}
            onChange={(e) => setTopicDescription(e.target.value)}
            placeholder='Wpisz dowolny temat lub wytyczne, np.: "Negocjacje w branży IT, nacisk na asertywność i dyplomatyczne odmawianie", "Mixed Conditionals na podstawie artykułu o AI", "Przygotowanie do trudnej rozmowy z klientem"...'
            rows={3}
            className="w-full p-4 text-sm bg-base-100/90 border border-white/20 hover:border-white/30 focus:border-primary rounded-2xl text-white placeholder-content-muted focus:shadow-[0_0_20px_rgba(114,240,180,0.2)] focus:outline-none resize-none transition-all leading-relaxed"
            disabled={isLoading}
          />
        </div>

        {/* PARAMETRY: WYBÓR KURSANTA, POZIOM CEFR, CZAS TRWANIA, PROFIL */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-content-muted uppercase tracking-wider flex items-center gap-1">
            <span className="text-primary">2.</span>
            <span>Parametry i dopasowanie:</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Wybór kursanta */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-content-muted flex items-center gap-1">
                <UserIcon size={12} className="text-primary" />
                Kursant:
              </span>
              <select
                value={selectedUser?.id || ''}
                onChange={(e) => {
                  const found = users.find(u => u.id === e.target.value);
                  if (onSelectUser) onSelectUser(found || null);
                  if (found?.level) setTargetLevel(found.level);
                }}
                className="w-full px-3 py-2.5 rounded-xl bg-base-100/90 border border-white/15 text-white focus:border-primary focus:outline-none font-semibold cursor-pointer"
              >
                <option value="">-- Tryb ogólny (bez kursanta) --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.firstName || u.username} ({u.level || 'B2'})
                  </option>
                ))}
              </select>
            </div>

            {/* Poziom CEFR */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-content-muted flex items-center gap-1">
                <Target size={12} className="text-primary" />
                Poziom CEFR:
              </span>
              <select
                value={targetLevel}
                onChange={(e) => setTargetLevel(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-base-100/90 border border-white/15 text-primary focus:border-primary focus:outline-none font-extrabold cursor-pointer"
              >
                {['A1', 'A2', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C2'].map(lvl => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>

            {/* Czas trwania */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-content-muted flex items-center gap-1">
                <Clock size={12} className="text-primary" />
                Czas trwania:
              </span>
              <select
                value={lessonDuration}
                onChange={(e) => setLessonDuration(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-base-100/90 border border-white/15 text-white focus:border-primary focus:outline-none cursor-pointer"
              >
                {['30 min', '45 min', '50 min', '60 min', '90 min'].map(dur => (
                  <option key={dur} value={dur}>{dur}</option>
                ))}
              </select>
            </div>

            {/* Profil zajęć */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-content-muted flex items-center gap-1">
                <Layers size={12} className="text-primary" />
                Profil zajęć:
              </span>
              <select
                value={lessonType}
                onChange={(e) => setLessonType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-base-100/90 border border-white/15 text-white focus:border-primary focus:outline-none cursor-pointer"
              >
                {[
                  'Konwersacje i Płynność',
                  'Business English',
                  'Gramatyka w kontekście',
                  'Specjalistyczny / Branżowy',
                  'Przygotowanie do egzaminu',
                  'Powtórka i analiza błędów'
                ].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* POLE: DODAJ PLIKI, KTÓRE CHCESZ WYKORZYSTAĆ DO GENEROWANIA LEKCJI */}
        <div className="space-y-2 pt-1">
          <label className="text-xs font-bold text-content-muted uppercase tracking-wider flex items-center gap-1">
            <span className="text-primary">3.</span>
            <span>Dodaj pliki, które chcesz wykorzystać do generowania lekcji:</span>
          </label>

          <LessonFileUploader
            attachments={attachments}
            onAttachmentsChange={setAttachments}
          />
        </div>

        {/* GŁÓWNY PRZYCISK GENEROWANIA ORAZ SZYBKIE PODPOWIEDZI */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-white/10">
          <div className="flex items-center gap-2 flex-wrap text-xs text-content-muted">
            {selectedUser && (
              <button
                type="button"
                onClick={() => handleGenerateOrSendMessage(`Przeanalizuj historię lekcji kursanta ${selectedUser.firstName || selectedUser.username} i zaproponuj 3 angażujące tematy na kolejną lekcję.`)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 hover:text-text-hi border border-white/10 transition-colors flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Lightbulb size={13} className="text-primary" />
                <span>Podpowiedz z historii kursanta</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 justify-end">
            <button
              type="button"
              onClick={() => handleGenerateOrSendMessage()}
              disabled={(!topicDescription.trim() && attachments.length === 0 && !selectedBaseScenario) || isLoading}
              className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-primary text-accent-ink font-black text-sm hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_25px_rgba(114,240,180,0.4)] hover:shadow-[0_0_35px_rgba(114,240,180,0.6)] flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>AI tworzy scenariusz lekcji...</span>
                </>
              ) : selectedBaseScenario ? (
                <>
                  <Wand2 size={18} />
                  <span>Dostosuj z AI dla {selectedUser ? (selectedUser.firstName || selectedUser.username) : 'kursanta'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Generuj Scenariusz Lekcji</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. OBSZAR PREZENTACJI SCENARIUSZY I HISTORII CZATU */}
      <div className="rounded-3xl border border-white/15 bg-base-200/50 backdrop-blur-md overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-base-200/80">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-primary" />
            <h3 className="text-sm sm:text-base font-extrabold text-white">
              Konspekt i etapy lekcji
            </h3>
            <span className="text-xs text-content-muted font-mono">
              ({messages.filter(m => m.role === 'assistant').length} w tej sesji)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-content-muted font-mono hidden sm:inline">
              Moduły: {activeModulesCount} aktywne
            </span>
          </div>
        </div>

        {/* Messages / Scenarios Container */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto max-h-[800px]">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-primary/20 border border-primary/40 text-primary flex items-center justify-center shrink-0 mt-1 shadow-[0_0_12px_rgba(114,240,180,0.3)]">
                    <Bot size={20} />
                  </div>
                )}

                <div className={`max-w-4xl ${isUser ? 'w-auto' : 'w-full'}`}>
                  <div
                    className={`rounded-3xl p-4 sm:p-5 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-primary text-accent-ink font-bold shadow-[0_0_20px_rgba(114,240,180,0.3)]'
                        : 'bg-base-100/95 border border-white/15 text-content shadow-xl'
                    }`}
                  >
                    {isUser ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      /* RENDER SCENARIO IN ACCORDION BLOCKS WITH D&D, EDIT AND PRESENTATION LINK */
                      <LessonScenarioAccordion
                        content={msg.content}
                        onCopyText={handleCopyText}
                        copiedId={copiedId}
                        extractedVocab={msg.extractedVocab}
                        onInsertLessonRecord={onInsertLessonRecord}
                        onUpdateContent={(newContent) => handleUpdateMessageContent(msg.id, newContent)}
                        onDeleteScenario={() => handleDeleteMessage(msg.id)}
                        onSelectTopicPrompt={(prompt) => handleGenerateOrSendMessage(prompt)}
                        onOpenInPresentation={onOpenInPresentation ? () => {
                          const parsed = parseScenarioStages(msg.content);
                          const sc: GeneratedLessonScenario = msg.scenario || {
                            id: `sc-${Date.now()}`,
                            title: parsed.title,
                            topic: parsed.topic,
                            content: msg.content,
                            targetLevel,
                            lessonDuration,
                            lessonType,
                            vocabularyText: msg.extractedVocab || parsed.vocabularyText,
                            stages: parsed.stages,
                            attachments: msg.scenario?.attachments || (attachments.length > 0 ? attachments : undefined),
                            createdAt: new Date().toISOString()
                          };
                          onOpenInPresentation(sc);
                        } : undefined}
                      />
                    )}
                  </div>

                  {/* Assistant Actions Bar */}
                  {!isUser && (
                    <div className="flex items-center gap-2 mt-2 ml-1 text-xs text-content-muted flex-wrap">
                      <button
                        onClick={() => handleCopyText(msg.id, msg.content)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 hover:text-text-hi transition-colors flex items-center gap-1.5 font-medium cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check size={12} className="text-primary" />
                            <span className="text-primary">Skopiowano!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Kopiuj</span>
                          </>
                        )}
                      </button>

                      {msg.extractedVocab && (
                        <button
                          onClick={() => handleCopyText(`${msg.id}-vocab`, msg.extractedVocab || '')}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 hover:text-text-hi transition-colors flex items-center gap-1.5 font-medium cursor-pointer"
                        >
                          {copiedId === `${msg.id}-vocab` ? (
                            <>
                              <Check size={12} className="text-primary" />
                              <span className="text-primary">Skopiowano słówka!</span>
                            </>
                          ) : (
                            <>
                              <BookOpen size={12} className="text-primary" />
                              <span>Słownictwo</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-red-500/20 text-content-muted hover:text-red-400 transition-colors flex items-center gap-1.5 font-medium ml-1 cursor-pointer"
                        title="Usuń tę wiadomość"
                      >
                        <Trash2 size={12} />
                        <span>Usuń</span>
                      </button>

                      <span className="text-[10px] text-content-muted ml-auto font-mono">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-ink-2 border border-white/15 text-white flex items-center justify-center shrink-0 mt-1 font-black text-xs shadow-md">
                    LEKTOR
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 sm:gap-4 justify-start items-center">
              <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/40 text-primary flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(114,240,180,0.3)]">
                <Bot size={20} className="animate-spin-slow" />
              </div>
              <div className="rounded-2xl bg-base-100 border border-primary/40 p-4 text-xs font-bold text-primary flex items-center gap-3 shadow-[0_0_20px_rgba(114,240,180,0.25)] animate-pulse">
                <Sparkles size={16} />
                <span>AI analizuje historię, załączniki i tworzy konspekt lekcji...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* MODAL: WYBÓR SCENARIUSZA Z BAZY */}
      <ChooseScenarioModal
        isOpen={isChooseScenarioModalOpen}
        onClose={() => setIsChooseScenarioModalOpen(false)}
        selectedUser={selectedUser}
        onSelectScenarioDirectUse={handleUseCuratedScenarioDirectly}
        onSelectScenarioForAdaptation={handleSelectScenarioForAdaptation}
      />

      {/* MODAL: KONFIGURATOR MODUŁÓW I METODYKI */}
      <LessonModulesConfig
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        modules={modules}
        onChangeModules={setModules}
        selectedPresetId={selectedPresetId}
        onSelectPreset={handleSelectPreset}
        customSettings={customSettings}
        onChangeCustomSettings={setCustomSettings}
        customPresets={customPresets}
        onSaveCustomPreset={handleSaveCustomPreset}
        onDeleteCustomPreset={handleDeleteCustomPreset}
      />

      {/* 3. DOLNA SEKCJA: BAZA DOTYCHCZAS WYGENEROWANYCH SCENARIUSZY */}
      <GeneratedScenariosSection
        selectedUser={selectedUser}
        onInsertToLessonRecord={onInsertLessonRecord}
        onSelectTopicPrompt={(prompt) => {
          setTopicDescription(prompt);
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        }}
        lastUpdatedTimestamp={scenariosTimestamp}
      />
    </div>
  );
};

export default LessonPlanner;
