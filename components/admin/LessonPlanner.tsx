import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, Send, Bot, User as UserIcon, Copy, Check, Clock, 
  BookOpen, Target, Layers, Lightbulb, RefreshCw, ChevronRight, 
  Trash2, AlertCircle, ArrowRight, FileText, Zap, Brain, MessageSquare,
  ListPlus, Settings2, Sliders, RotateCcw, History, ArrowUpRight
} from 'lucide-react';
import Markdown from 'react-markdown';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { generateLessonPlannerAI } from '../../services/geminiService';
import { User, LessonRecord, LessonModuleConfig, LessonPlanPreset, LessonPlannerCustomSettings } from '../../types';
import { LessonModulesConfig } from './LessonModulesConfig';
import { LessonScenarioAccordion } from './LessonScenarioAccordion';
import { DEFAULT_LESSON_MODULES, LESSON_PRESETS } from './lessonPlannerPresets';

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
}

interface LessonPlannerProps {
  selectedUser?: UserWithId | null;
  users: UserWithId[];
  onSelectUser?: (user: UserWithId | null) => void;
  recentLessons?: LessonRecord[];
  onInsertLessonRecord?: (data: { topic: string; summary: string; vocabulary: string; followUp: string }) => void;
}

const QUICK_PROMPTS = [
  {
    title: 'Finishing, Upgrading & Choices',
    desc: 'Wzór 5 modułów: Warm-up, Main Topic, Language Focus, Practice, Homework',
    prompt: 'Przygotuj kompletny scenariusz lekcji na temat "Finishing, Upgrading & Choosing What Deserves Your Time" (zarządzanie czasem, selekcja priorytetów i jakość realizacji zadań). Zbuduj lekcję ściśle według skonfigurowanych modułów.'
  },
  {
    title: 'Business English: Negocjacje',
    desc: 'Zwroty dyplomatyczne, argumentacja i symulacja spotkania',
    prompt: 'Stwórz scenariusz lekcji Business English na temat "Wpływowe negocjacje i dyplomatyczny język w relacjach z klientem". Przygotuj zwroty z polskim tłumaczeniem oraz zadania praktyczne.'
  },
  {
    title: 'Sztuczna Inteligencja i Rynek Pracy',
    desc: 'Dyskusja, zaawansowane kolokacje C1 i debata',
    prompt: 'Przygotuj scenariusz lekcji konwersacyjnej na temat "Sztuczna inteligencja, automatyzacja i przyszłość rynku pracy". Skup się na naturalnych kolokacjach i angażującej dyskusji.'
  },
  {
    title: 'Gramatyka: Mixed Conditionals',
    desc: 'Okresy warunkowe mieszane w żywym dialogu i ćwiczeniach',
    prompt: 'Przygotuj scenariusz lekcji skupionej na "Mixed Conditionals (okresy warunkowe mieszane)". Wyjaśnij zasady zwięźle po polsku, podaj przykłady, pytania do rozmowy oraz zdania do tłumaczenia PL->EN.'
  }
];

const LOCAL_STORAGE_PRESETS_KEY = 'cribro_lesson_planner_custom_presets_v2';
const LOCAL_STORAGE_SETTINGS_KEY = 'cribro_lesson_planner_custom_settings_v2';
const LOCAL_STORAGE_MODULES_KEY = 'cribro_lesson_planner_modules_v2';

export const LessonPlanner: React.FC<LessonPlannerProps> = ({
  selectedUser,
  users,
  onSelectUser,
  recentLessons = [],
  onInsertLessonRecord
}) => {
  const { user: currentUser } = useAuth();
  const { language } = useLanguage();
  const isAdmin = currentUser?.role === 'admin';

  // Configured modules for lesson generator (with localStorage fallback)
  const [modules, setModules] = useState<LessonModuleConfig[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_MODULES_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load saved modules:', e);
    }
    return DEFAULT_LESSON_MODULES;
  });

  // Custom Prompt & Methodology Settings
  const [customSettings, setCustomSettings] = useState<LessonPlannerCustomSettings>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
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
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load saved custom presets:', e);
    }
    return [];
  });

  const [selectedPresetId, setSelectedPresetId] = useState<string>('preset-standard');

  // Modal Window state for Curriculum & Modules Configurator
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

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
  - *Sytuacja*: Kursant jest liderem projektu i ma 3 godziny na zakończenie kwartału. Do wyboru są 3 zadania (jedno kluczowe dla klienta, drugie to poprawka drobnego błędu, trzecie to raport).
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

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lessonDuration, setLessonDuration] = useState('60 min');
  const [targetLevel, setTargetLevel] = useState<string>(selectedUser?.level || 'B2');
  const [lessonType, setLessonType] = useState('Konwersacje i Płynność');

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

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

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

  // Update specific message content (e.g. after deleting or editing a block)
  const handleUpdateMessageContent = (messageId: string, newContent: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        return { ...m, content: newContent };
      }
      return m;
    }));
  };

  // Delete an entire message/scenario from chat
  const handleDeleteMessage = (messageId: string) => {
    setMessages(prev => {
      const remaining = prev.filter(m => m.id !== messageId);
      if (remaining.length === 0) {
        return [{
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          content: '### 🗑️ Scenariusz usunięty. Wpisz nowy temat poniżej lub poproś AI o sugestię tematów na podstawie profilu kursanta!',
          timestamp: new Date()
        }];
      }
      return remaining;
    });
  };

  // If not admin, show draft banner
  if (!isAdmin) {
    return (
      <div className="rounded-3xl border border-white/10 bg-base-200/50 p-8 text-center max-w-xl mx-auto my-8 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-warn/15 border border-warn/30 text-warn flex items-center justify-center mx-auto mb-4 shadow-[0_0_15px_rgba(251,191,36,0.2)]">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-lg font-extrabold text-white mb-2">Planer lekcji (Dostęp lektorski)</h3>
        <p className="text-sm text-content-muted">
          Ten moduł jest obecnie w fazie przygotowania i jest dostępny wyłącznie dla Administratora systemu. Wkrótce zostanie udostępniony wszystkim lektorom.
        </p>
      </div>
    );
  }

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

    // Specific user methodology directives
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

    return `Jesteś doświadczonym metodykiem języka angielskiego (Senior ESL Curriculum Designer & Master Teacher) oraz inteligentnym partnerem do rozmowy dla lektora.
Tworzysz angażujące, praktyczne i nowoczesne materiały dydaktyczne dla dorosłych kursantów.

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

TRYBY INTERAKCJI Z LEKTOREM:
1. TRYB SUGESTII TEMATÓW (Gdy lektor prosi o sugestie np. "zasugeruj temat", "co robimy dzisiaj?", "zaproponuj 3 tematy na podstawie historii", "jaki kolejny krok?"):
   - Przeanalizuj historię lekcji i profil kursanta.
   - Zaproponuj 3-4 angażujące, świeże propozycje tematów lekcji, które logicznie rozwijają kompetencje kursanta i nie powielają poprzednich tematów.
   - Dla każdej propozycji podaj:
     1. **[Tytuł tematu po angielsku lub polsku]**
     2. Uzasadnienie metodyczne (dlaczego to pasuje po ostatnich lekcjach)
     3. Główny focus gramatyczny i słownikowy
   - Zakończ zachętą: "Wybierz jeden z powyższych tematów lub wpisz własny, a przygotuję pełny konspekt według Twoich modułów!"

2. TRYB PEŁNEGO KONSPEKTU (Gdy lektor podał konkretny temat lub kliknął generowanie scenariusza):
   - Wygeneruj kompletny, bogaty merytorycznie scenariusz lekcji z nagłówkiem "# Scenariusz: ..." i modułami "## ...".
   - Słownictwo i kolokacje podawaj zawsze z polskim tłumaczeniem i naturalnym przykładem użycia w nawiasie lub nowej linii.
   - Zdania na pracę domową powinny być podane po polsku, a pod nimi w nawiasie lub kursywą wzorcowe tłumaczenie na angielski.

3. TRYB ROZMOWY I MODYFIKACJI (Gdy lektor pyta o porady metodyczne, modyfikacje ćwiczeń, dodatkowe pytania itp.):
   - Odpowiadaj zwięźle, profesjonalnie i konwersacyjnie, proponując natychmiastowe rozwiązania.`;
  };

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const systemInstruction = buildSystemPrompt();

      // Format conversation history
      const conversationHistory = messages
        .filter(m => m.id !== 'welcome')
        .slice(-8)
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const response = await generateLessonPlannerAI({
        prompt,
        systemInstruction,
        conversationHistory
      });

      const responseText = response?.text || 'Przepraszam, nie udało się wygenerować odpowiedzi. Spróbuj ponownie.';

      // Extract vocabulary if present
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

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        extractedVocab
      };

      setMessages(prev => [...prev, assistantMessage]);
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
          content: '### 💬 Czat wyczyszczony. Wybierz kursanta lub wpisz temat, aby rozpocząć planowanie kolejnej lekcji!',
          timestamp: new Date()
        }
      ]);
    }
  };

  const currentPresetName = LESSON_PRESETS.find(p => p.id === selectedPresetId)?.name || 
    customPresets.find(p => p.id === selectedPresetId)?.name || 'Układ własny';

  const activeModulesCount = modules.filter(m => m.enabled).length;

  return (
    <div className="space-y-5 animate-fade-in font-sans">
      {/* Top Header Card with Neon Glow */}
      <div className="rounded-3xl border border-primary/25 bg-gradient-to-r from-base-200/95 via-base-200/80 to-base-100/95 p-5 sm:p-6 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-2.5 rounded-2xl bg-primary/20 text-primary border border-primary/40 shadow-[0_0_20px_rgba(114,240,180,0.35)]">
                <Sparkles size={22} className="animate-pulse" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                Interaktywny Planer Lekcji AI
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-warn/15 text-warn border border-warn/40 text-[10px] font-mono font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(251,191,36,0.2)]">
                PRO / Modułowy
              </span>
            </div>
            <p className="text-xs sm:text-sm text-content-muted max-w-3xl leading-relaxed">
              Zaawansowany generator scenariuszy lekcji z analizą historii kursanta, pełną edycją modułów, przeciąganiem Drag & Drop oraz transferem do historii lekcji.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setIsConfigModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-primary/20 hover:bg-primary text-primary hover:text-accent-ink border border-primary/40 hover:border-primary font-extrabold text-xs flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(114,240,180,0.2)] hover:shadow-[0_0_22px_rgba(114,240,180,0.4)] hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <Settings2 size={16} />
              <span>Dostosuj moduły i metodykę</span>
              <span className="px-2 py-0.5 rounded-md bg-black/30 font-mono text-[11px] font-black">
                {activeModulesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={handleClearChat}
              className="px-3.5 py-2.5 rounded-2xl bg-white/5 hover:bg-red-500/15 text-content-muted hover:text-red-400 border border-white/10 hover:border-red-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all hover:shadow-[0_0_12px_rgba(248,113,113,0.25)] cursor-pointer"
              title="Wyczyść czat"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">Wyczyść</span>
            </button>
          </div>
        </div>

        {/* Global Context Bar: Student, Level, Duration, Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-5 mt-5 border-t border-white/10 text-xs">
          {/* Student picker */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider flex items-center gap-1">
              <UserIcon size={12} className="text-primary" />
              Kursant:
            </label>
            <select
              value={selectedUser?.id || ''}
              onChange={(e) => {
                const found = users.find(u => u.id === e.target.value);
                if (onSelectUser) onSelectUser(found || null);
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-base-100/90 border border-white/15 text-white focus:border-primary focus:shadow-[0_0_12px_rgba(114,240,180,0.25)] focus:outline-none font-semibold cursor-pointer"
            >
              <option value="">-- Tryb ogólny (bez profilu kursanta) --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.firstName || u.username} ({u.level || 'B2'})
                </option>
              ))}
            </select>
          </div>

          {/* Level picker */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider flex items-center gap-1">
              <Target size={12} className="text-primary" />
              Poziom CEFR:
            </label>
            <select
              value={targetLevel}
              onChange={(e) => setTargetLevel(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-base-100/90 border border-white/15 text-primary focus:border-primary focus:shadow-[0_0_12px_rgba(114,240,180,0.25)] focus:outline-none font-extrabold cursor-pointer"
            >
              {['A1', 'A2', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C2'].map(lvl => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider flex items-center gap-1">
              <Clock size={12} className="text-primary" />
              Czas trwania:
            </label>
            <select
              value={lessonDuration}
              onChange={(e) => setLessonDuration(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-base-100/90 border border-white/15 text-white focus:border-primary focus:shadow-[0_0_12px_rgba(114,240,180,0.25)] focus:outline-none cursor-pointer"
            >
              {['30 min', '45 min', '50 min', '60 min', '90 min'].map(dur => (
                <option key={dur} value={dur}>{dur}</option>
              ))}
            </select>
          </div>

          {/* Lesson Type */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider flex items-center gap-1">
              <Layers size={12} className="text-primary" />
              Profil zajęć:
            </label>
            <select
              value={lessonType}
              onChange={(e) => setLessonType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-base-100/90 border border-white/15 text-white focus:border-primary focus:shadow-[0_0_12px_rgba(114,240,180,0.25)] focus:outline-none cursor-pointer"
            >
              {[
                'Konwersacje i Płynność',
                'Business English',
                'Gramatyka w kontekście',
                'Przygotowanie do egzaminu',
                'Specjalistyczny / Branżowy',
                'Powtórka i analiza błędów'
              ].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* CURRICULUM CONFIGURATION STATUS BAR WITH NEON ACCENTS */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-base-200/60 border border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-extrabold text-white flex items-center gap-1.5">
            <Layers size={14} className="text-primary" />
            <span>Aktywny profil:</span>
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-primary/15 border border-primary/30 text-primary font-extrabold shadow-[0_0_10px_rgba(114,240,180,0.15)]">
            {currentPresetName} ({activeModulesCount} modułów)
          </span>
          {customSettings.customPrompt && (
            <span className="px-2.5 py-1 rounded-xl bg-warn/15 text-warn border border-warn/40 text-[11px] font-bold shadow-[0_0_10px_rgba(251,191,36,0.15)]">
              ✓ Własny Master Prompt
            </span>
          )}
          {customSettings.englishVariety !== 'any' && (
            <span className="px-2.5 py-1 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30 text-[11px] font-bold">
              {customSettings.englishVariety === 'british' ? 'UK' : 'US'} English
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsConfigModalOpen(true)}
          className="text-primary hover:text-white font-extrabold flex items-center gap-1 transition-colors self-end sm:self-center cursor-pointer hover:drop-shadow-[0_0_8px_rgba(114,240,180,0.6)]"
        >
          <span>Konfiguruj moduły i wytyczne</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* DYNAMIC TOPIC SUGGESTIONS / CONTEXT CHIPS (WHEN STUDENT SELECTED) */}
      {selectedUser && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-primary/15 via-base-200/90 to-base-200/90 border border-primary/35 space-y-3 animate-fade-in shadow-[0_0_20px_rgba(114,240,180,0.15)]">
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-primary animate-pulse" />
              <span className="font-extrabold text-white text-sm">
                Rekomendacje AI dla kursanta: {selectedUser.firstName || selectedUser.username}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-primary border border-primary/30 text-[11px] font-mono font-bold">
                {studentLessons.length > 0 ? `${studentLessons.length} lekcji w historii` : 'Nowy kursant'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => handleSendMessage(`Przeanalizuj historię lekcji kursanta ${selectedUser.firstName || selectedUser.username} i zaproponuj 3-4 intrygujące tematy na kolejną lekcję, które naturalnie rozwiną jego umiejętności.`)}
              disabled={isLoading}
              className="px-3.5 py-2.5 rounded-xl bg-primary text-accent-ink font-extrabold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(114,240,180,0.35)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <Lightbulb size={14} />
              <span>Zaproponuj nowy temat z historii kursanta</span>
            </button>

            <button
              type="button"
              onClick={() => handleSendMessage(`Przygotuj propozycję lekcji powtórkowej i konsolidacyjnej skupionej na trudniejszych zagadnieniach i błędach kursanta ${selectedUser.firstName || selectedUser.username} z ostatnich lekcji.`)}
              disabled={isLoading}
              className="px-3.5 py-2.5 rounded-xl bg-base-100 hover:bg-base-100/90 border border-white/20 hover:border-primary/40 text-white font-bold text-xs flex items-center gap-1.5 transition-all hover:shadow-[0_0_12px_rgba(114,240,180,0.2)] cursor-pointer"
            >
              <History size={14} className="text-primary" />
              <span>Lekcja powtórkowa z ostatnich tematów</span>
            </button>

            <button
              type="button"
              onClick={() => handleSendMessage(`Jakie zwroty i ćwiczenia konwersacyjne będą najbardziej praktyczne dla kursanta ${selectedUser.firstName || selectedUser.username} na poziomie ${targetLevel}?`)}
              disabled={isLoading}
              className="px-3.5 py-2.5 rounded-xl bg-base-100 hover:bg-base-100/90 border border-white/20 hover:border-primary/40 text-white font-bold text-xs flex items-center gap-1.5 transition-all hover:shadow-[0_0_12px_rgba(114,240,180,0.2)] cursor-pointer"
            >
              <MessageSquare size={14} className="text-primary" />
              <span>Konsultacja metodyczna z AI</span>
            </button>
          </div>
        </div>
      )}

      {/* Quick Prompts Chips when no student is chosen */}
      {!selectedUser && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-content-muted uppercase tracking-wider">
            <Lightbulb size={13} className="text-warn" />
            <span>Szybkie propozycje tematów:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(qp.prompt)}
                disabled={isLoading}
                className="p-3.5 rounded-2xl bg-base-200/70 hover:bg-base-200 border border-white/10 hover:border-primary/50 text-left transition-all group active:scale-[0.98] flex flex-col justify-between hover:shadow-[0_0_16px_rgba(114,240,180,0.2)] cursor-pointer"
              >
                <div>
                  <h4 className="font-black text-white text-xs group-hover:text-primary transition-colors flex items-center justify-between">
                    <span>{qp.title}</span>
                    <Zap size={12} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h4>
                  <p className="text-[11px] text-content-muted mt-1.5 line-clamp-2 leading-relaxed">
                    {qp.desc}
                  </p>
                </div>
                <span className="text-[10px] text-primary font-bold mt-2.5 flex items-center gap-1">
                  Generuj scenariusz <ArrowRight size={11} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Chat Stream Container */}
      <div className="rounded-3xl border border-white/15 bg-base-200/50 backdrop-blur-md overflow-hidden flex flex-col min-h-[480px] shadow-2xl">
        {/* Messages List */}
        <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto max-h-[750px]">
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
                      /* RENDER SCENARIO IN ACCORDION BLOCKS WITH DRAG & DROP AND EDITING */
                      <LessonScenarioAccordion
                        content={msg.content}
                        onCopyText={handleCopyText}
                        copiedId={copiedId}
                        extractedVocab={msg.extractedVocab}
                        onInsertLessonRecord={onInsertLessonRecord}
                        onUpdateContent={(newContent) => handleUpdateMessageContent(msg.id, newContent)}
                        onDeleteScenario={() => handleDeleteMessage(msg.id)}
                        onSelectTopicPrompt={(prompt) => handleSendMessage(prompt)}
                      />
                    )}
                  </div>

                  {/* Assistant Actions Bar */}
                  {!isUser && (
                    <div className="flex items-center gap-2 mt-2 ml-1 text-xs text-content-muted flex-wrap">
                      <button
                        onClick={() => handleCopyText(msg.id, msg.content)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1.5 font-medium cursor-pointer"
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
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1.5 font-medium cursor-pointer"
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
                        title="Usuń tę wiadomość z historii"
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
                <span>AI analizuje historię, metodykę i generuje konspekt lekcji...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Interactive Chat Input Bar with Neon Green Send Glow */}
        <div className="p-4 bg-base-100/95 border-t border-white/10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5"
          >
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  selectedUser 
                    ? `Wpisz temat, poproś o sugestię ("zaproponuj temat na podstawie historii") lub zadaj pytanie metodyczne...`
                    : `Wpisz temat zajęć lub poproś AI o przygotowanie scenariusza...`
                }
                rows={2}
                className="w-full p-3.5 pr-10 text-sm bg-base-200 border border-white/20 rounded-2xl text-white placeholder-content-muted focus:border-primary focus:shadow-[0_0_16px_rgba(114,240,180,0.25)] focus:outline-none resize-none transition-all"
                disabled={isLoading}
              />
              <div className="absolute right-3 bottom-3 text-[10px] text-content-muted hidden sm:block">
                Enter ↵ wyślij • Shift+Enter nowa linia
              </div>
            </div>

            <button
              type="submit"
              disabled={!inputPrompt.trim() || isLoading}
              className="px-6 py-3.5 rounded-2xl bg-primary text-accent-ink font-black text-sm hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(114,240,180,0.45)] hover:shadow-[0_0_25px_rgba(114,240,180,0.65)] flex items-center justify-center gap-2 shrink-0 active:scale-95 cursor-pointer"
            >
              {isLoading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              <span>Wyślij</span>
            </button>
          </form>
        </div>
      </div>

      {/* DEDICATED SETTINGS MODAL WINDOW */}
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
    </div>
  );
};

export default LessonPlanner;
