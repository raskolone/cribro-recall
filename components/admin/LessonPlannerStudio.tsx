import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Copy,
  GraduationCap,
  Lightbulb,
  Loader2,
  MessageSquare,
  Save,
  Sparkles,
  Users,
  Wand2,
  X,
  Edit3,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  BookOpen,
  Folder,
  Play,
  Airplay,
  Rocket,
  CheckSquare,
  Square,
  RefreshCw,
  Send,
  Layers,
  ExternalLink,
  SlidersHorizontal,
  FileText,
  Eye,
  HelpCircle,
  Volume2,
  Music,
  UploadCloud,
  Search,
  CheckCircle2,
  Zap,
  Tv,
  Presentation,
  ListOrdered,
  RotateCcw,
} from 'lucide-react';
import { GeneratedLessonScenario, LessonAttachment, LessonRecord, User } from '../../types';
import { LessonFileUploader } from './LessonFileUploader';
import {
  CRIBRO_METHOD_SYSTEM,
  LessonBrief,
  briefGate,
  buildRevisionPrompt,
  buildScenarioPrompt,
  buildTopicProposalPrompt,
  PlanItem,
  PlanSection,
  LessonPlan,
  InteractiveExercise,
  PlanItemKind,
  extractHomeworkTask,
  extractVocabularyList,
} from '../../services/lessonPlannerMethod';
import { CouncilEvent, DEFAULT_COUNCIL, runCouncil } from '../../services/aiCouncil';
import { getAiConfig, peekCouncil } from '../../services/aiConfigService';
import {
  saveGeneratedScenario,
  getGeneratedScenarios,
  deleteGeneratedScenario,
} from '../../services/scenarioService';
import {
  updateScratchpadPresentation,
} from '../../services/scratchpadService';
import {
  createPresentationFromScenario,
  savePresentationToStorage,
  getSavedPresentationsList,
  deleteSavedPresentation,
} from '../../services/presentationService';
import { LessonPresentation, PresentationSlide } from '../../types';
import { PresentationState } from '../scratchpad/ScratchpadPresentationOverlay';
import { FlipCardItem, ProcessStepItem } from '../presentation/InteractiveSlideDeck';
import { LessonPresentationView } from './presentation/LessonPresentationView';
import { formatAIModelName } from '../../services/geminiService';
import { extractLessonBlocks } from '../../utils/lessonBlocks';
import { formatStudentDisplayName } from '../../utils/studentFormat';
import { confirmAsync } from '../../utils/appAlert';
import { LessonPlannerStudio as BlockLessonPlanner } from '../planner/LessonPlannerStudio';
import { ListOrdered as PlannerBlocksIcon } from 'lucide-react';

interface ParsedTeacherNotes {
  goal?: string;
  scaffolding?: string;
  followUp?: string;
  otherLines: string[];
}

const parseTeacherNotes = (raw: string): ParsedTeacherNotes => {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  let goal: string | undefined;
  let scaffolding: string | undefined;
  let followUp: string | undefined;
  const otherLines: string[] = [];

  for (const line of lines) {
    const clean = line.replace(/^[•*\-\d.]+\s*/, '').trim();
    const lower = clean.toLowerCase();

    if (lower.startsWith('cel:') || lower.startsWith('**cel:**') || lower.startsWith('cel ')) {
      goal = clean.replace(/^(\*\*)?cel:?(\*\*)?\s*/i, '').trim();
    } else if (
      lower.startsWith('scaffolding:') ||
      lower.startsWith('**scaffolding:**') ||
      lower.startsWith('sugerowane:') ||
      lower.startsWith('sugerowane odpowiedzi:') ||
      lower.startsWith('podpowiedź:')
    ) {
      scaffolding = clean.replace(/^(\*\*)?(scaffolding|sugerowane odpowiedzi|sugerowane|podpowiedź):?(\*\*)?\s*/i, '').trim();
    } else if (
      lower.startsWith('follow-up:') ||
      lower.startsWith('**follow-up:**') ||
      lower.startsWith('follow up:') ||
      lower.startsWith('pytanie pomocnicze:')
    ) {
      followUp = clean.replace(/^(\*\*)?(follow-up|follow up|pytanie pomocnicze):?(\*\*)?\s*/i, '').trim();
    } else {
      otherLines.push(clean);
    }
  }

  return { goal, scaffolding, followUp, otherLines };
};

interface UserWithId extends User {
  id: string;
}

interface TopicVariant {
  title: string;
  angle?: string;
  material?: string;
  why?: string;
  sampleQuestion?: string;
}

interface ChatTurn {
  id: string;
  role: 'teacher' | 'planner';
  text: string;
  targets?: string[];
}

export interface LessonPlannerStudioProps {
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
  initialScenario?: GeneratedLessonScenario | null;
  onCreateHomework?: (data: {
    student: UserWithId;
    topic: string;
    words: string[];
    guidelines?: string;
  }) => void;
  initialStudioMode?: 'scenario' | 'presentation' | 'blocks';
}

const PRESET_TOPICS = [
  { label: 'Negocjacje & Obiekcje (B2)', topic: 'Business English: Handling Objections & Negotiating Contract Terms', level: 'B2' },
  { label: 'Small Talk & Networking (B1/B2)', topic: 'Small Talk, Networking & Building Rapport with International Clients', level: 'B2' },
  { label: 'Trendy & Wykresy (B2/C1)', topic: 'Describing Trends, Graphs & Forecasting Financial Performance', level: 'C1' },
  { label: 'Trudny Klient / Reklamacje (B2)', topic: 'De-escalating Conflict and Resolving Difficult Customer Complaints', level: 'B2' },
  { label: 'Kondycjonale & Hipotezy (B2)', topic: 'Grammar in Context: 3rd & Mixed Conditionals in Decision Making', level: 'B2' },
];

const PRESET_ACTIVITIES: Array<{
  title: string;
  type: PresentationState['type'];
  question?: string;
  prompt?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioName?: string;
  hints: string[];
  cards?: FlipCardItem[];
  steps?: ProcessStepItem[];
  options?: string[];
  correctAnswer?: string | number;
  explanation?: string;
}> = [
  {
    title: '🎴 Interaktywne Fiszki 3D (Flip Cards E-Learning)',
    type: 'flip_cards',
    question: 'Obracaj karty, aby poznać kluczowe zwroty w kontekście.',
    prompt: 'Dotknij karty, aby sprawdzić znaczenie, wymowę i autentyczne zdanie przykładowe.',
    hints: ['Tap to flip...', 'Repeat out loud...', 'Use in a sentence...'],
    cards: [
      {
        term: 'Leverage synergy',
        definition: 'Wykorzystać synergię / połączyć siły dla lepszego rezultatu',
        example: 'By merging our teams, we can leverage synergy to deliver the project twice as fast.',
        hint: 'Biznesowy czasownik oznaczający efektywne wykorzystanie zasobów',
      },
      {
        term: 'Double-edged sword',
        definition: 'Broń obosieczna / rozwiązanie niosące zarówno korzyści, jak i ryzyka',
        example: 'Rapid AI adoption is a double-edged sword: it boosts speed but requires strict oversight.',
        hint: 'Popularny idiom opisujący niejednoznaczne zjawiska',
      },
      {
        term: 'Streamline operations',
        definition: 'Usprawnić i zoptymalizować procesy operacyjne',
        example: 'Our primary goal this quarter is to streamline operations and eliminate bottlenecks.',
        hint: 'Często używane w kontekście optymalizacji pracy i automatyzacji',
      },
      {
        term: 'Radical candour',
        definition: 'Radykalna szczerość / bezpośredni, ale życzliwy feedback',
        example: 'Practicing radical candour helps build trust without sugarcoating important issues.',
        hint: 'Koncepcja otwartej i konstruktywnej komunikacji w zespole',
      },
    ],
  },
  {
    title: '📋 Sekcje i Kroki Lekcji (Interactive Process Steps)',
    type: 'process_tabs',
    question: 'Przechodź krok po kroku przez strukturę zagadnienia.',
    prompt: 'Interaktywny moduł w stylu Articulate 360: analiza studium przypadku i argumentacji.',
    hints: ['Review each step...', 'Synthesize arguments...', 'Prepare concluding remarks...'],
    steps: [
      {
        title: 'Krok 1: Wprowadzenie i Diagnoza',
        subtitle: 'Context & Problem Statement',
        content: 'Klient stoi przed wyzwaniem spadku zaangażowania użytkowników o 15% po ostatniej aktualizacji platformy. Zespół musi zidentyfikować przyczyny i zaproponować plan naprawczy.',
        keyPoints: ['Spadek wskaźnika retencji w kluczowym segmencie', 'Brak intuicyjnej nawigacji w nowym interfejsie', 'Wymóg szybkiej reakcji w ciągu 48h'],
      },
      {
        title: 'Krok 2: Burza Mózgów i Opcje',
        subtitle: 'Proposed Interventions',
        content: 'Dyskutujemy trzy możliwe ścieżki: szybki rollback, wdrożenie przewodnika onboardingowego lub bezpośrednie konsultacje dla klientów.',
        keyPoints: ['Opcja A: Rollback (bezpieczna, lecz kosztowna)', 'Opcja B: Interactive Onboarding (rekomendowana)', 'Opcja C: Direct Consultations'],
      },
      {
        title: 'Krok 3: Decyzja i Plan Wdrożenia',
        subtitle: 'Actionable Execution Plan',
        content: 'Formułujemy ostateczną rekomendację w języku angielskim z użyciem zaawansowanych struktur warunkowych i czasowników modalnych.',
        keyPoints: ['Przygotowanie executive summary dla zarządu', 'Wdrożenie mikro-samouczków', 'Pomiar efektów po 7 dniach'],
      },
    ],
  },
  {
    title: '🎧 Słuchanie & Audio (Listening comprehension)',
    type: 'listening',
    question: 'Odsłuchaj nagranie i wynotuj kluczowe argumenty.',
    prompt: 'Zwróć uwagę na ton wypowiedzi mówcy, użyte kolokacje oraz kluczowe wnioski.',
    hints: ['Focus on the main idea first...', 'Note down specific keywords...', 'Listen for transition words...'],
  },
  {
    title: '🎡 Koło Fortuny (Warm-up Wheel / Rozgrzewka)',
    type: 'wheel_of_fortune',
    question: 'Zakręć kołem i wylosuj pytanie rozgrzewkowe na start lekcji.',
    prompt: 'Interaktywne koło pytań rozgrzewkowych. Wybierz źródło pytań i wylosuj temat do swobodnej rozmowy.',
    hints: ['Give a concrete example from your work...', 'From my perspective...', 'If I had to choose...'],
  },
  {
    title: '📸 Opisanie obrazka (Describe the picture)',
    type: 'image_prompt',
    question: 'Describe what you see in the image and compare with your experience.',
    prompt: 'Use prepositions of place, describe actions using Present Continuous, and speculate about what will happen next.',
    imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
    hints: ['In the foreground...', 'It looks like...', 'They might be discussing...', 'On the one hand...'],
  },
  {
    title: '💬 Pytanie dyskusyjne (Discussion prompt)',
    type: 'slide',
    question: 'How has remote work transformed team communication in your industry?',
    prompt: 'Discuss advantages, drawbacks, and the impact of asynchronous communication tools on productivity and relationships.',
    hints: ['From my perspective...', 'A double-edged sword...', 'Streamlining workflows...', 'Maintaining cohesion...'],
  },
  {
    title: '🎯 Szybkie wyzwanie językowe (Quick challenge)',
    type: 'scenario_item',
    question: 'Rephrase using advanced vocabulary and conditionals.',
    prompt: 'Express the following idea without using the words "good", "bad", or "important": "If we don’t fix this problem now, we will lose a lot of clients."',
    hints: ['Had we not addressed...', 'Unless we mitigate...', 'Critical juncture...', 'Detrimental impact...'],
  },
];

/** Zamiana planu na markdown do eksportu i zapisu. */
const planToMarkdown = (plan: LessonPlan): string => {
  const lines: string[] = [`# ${plan.title}`, ''];
  if (plan.format) lines.push(`**Format:** ${plan.format}`, '');
  if (plan.goal) lines.push(`**Cel:** ${plan.goal}`, '');
  if (plan.sourceMaterialDescription) lines.push(`**Materiał źródłowy:** ${plan.sourceMaterialDescription}`, '');
  if (plan.summary) lines.push(plan.summary, '');

  for (const section of plan.sections) {
    lines.push(`## ${section.title}`, '');
    if (section.topicMaterialDescription) {
      lines.push(`_${section.topicMaterialDescription}_`, '');
    }
    if (section.thoughtProvokingDescription) {
      lines.push(`_${section.thoughtProvokingDescription}_`, '');
    }
    if (section.methodologicalTip) {
      lines.push(`> **Metodycznie:** ${section.methodologicalTip}`, '');
    }

    if (section.items.length === 0) {
      lines.push('_Sekcja celowo pusta._', '');
      continue;
    }
    for (const item of section.items) {
      if (item.kind === 'question' || item.kind === 'topic_material' || item.kind === 'lead_in') {
        lines.push(`- [${item.checked ? 'x' : ' '}] ${item.text}`);
        if (item.notes) lines.push('', `  > **Teacher's Notes:** ${item.notes}`, '');
      } else if (item.kind === 'vocab' || item.kind === 'correction') {
        lines.push(`- ${item.text}`);
      } else if (item.kind === 'answerKey') {
        lines.push('', '**Answer Key**', '', '```markdown', item.text, '```', '');
      } else if (item.kind === 'task') {
        lines.push('', `### ${item.text}`, '');
        if (item.notes) lines.push(`> ${item.notes}`, '');
      } else if (item.kind === 'interactive' && item.exercise) {
        lines.push(`- [ ] **Quiz:** ${item.exercise.question}`);
        if (item.exercise.options) {
          item.exercise.options.forEach((opt, idx) => lines.push(`    ${idx + 1}. ${opt}`));
        }
      } else {
        lines.push(item.text, '');
      }
    }
    lines.push('');
  }

  return lines.join('\n');
};

/** Wyciąga słownictwo do wklejenia w notatkę z lekcji. */
const planVocabulary = (plan: LessonPlan): string => {
  const lines: string[] = [];
  for (const section of plan.sections) {
    for (const item of section.items) {
      if (item.kind === 'vocab') lines.push(item.text);
    }
  }
  return lines.join('\n');
};

export const LessonPlannerStudio: React.FC<LessonPlannerStudioProps> = ({
  selectedUser,
  users,
  onSelectUser,
  recentLessons = [],
  onInsertLessonRecord,
  onOpenInPresentation,
  initialScenario,
  onCreateHomework,
  initialStudioMode = 'scenario',
}) => {
  // Główne 3 tryby: Konspekt blokowy 2.0 vs Kreator AI vs Nowa prezentacja
  const [studioMode, setStudioMode] = useState<'scenario' | 'presentation' | 'blocks'>(initialStudioMode);

  // Krok kreatora scenariusza
  const [step, setStep] = useState<'brief' | 'topics' | 'plan'>('brief');

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Brief state
  const [brief, setBrief] = useState<LessonBrief>({
    mode: '1:1',
    audience: selectedUser ? formatStudentDisplayName(selectedUser) : '',
    date: todayStr,
    level: selectedUser?.level || 'B2',
    grammarTopic: '',
    sourceMaterial: '',
    history: '',
    notes: '',
  });

  // Student selector dropdown state
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [isCustomAudience, setIsCustomAudience] = useState(false);
  const studentDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(e.target as Node)) {
        setIsStudentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [attachments, setAttachments] = useState<LessonAttachment[]>([]);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 15 * 1024 * 1024) {
      alert(`Plik "${file.name}" przekracza maksymalny limit 15 MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newAtt: LessonAttachment = {
        id: `att-audio-${Date.now()}`,
        name: file.name,
        type: 'audio',
        size: file.size,
        mimeType: file.type || 'audio/mpeg',
        dataUrl,
      };
      setAttachments(prev => [...prev, newAtt]);
      setLaunchFeedback(`Dodano nagranie audio: ${file.name}`);
      setTimeout(() => setLaunchFeedback(null), 3500);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveAttachment = (attId: string) => {
    setAttachments(prev => prev.filter(a => a.id !== attId));
  };

  const [suggestion, setSuggestion] = useState('');
  const [variantCount, setVariantCount] = useState(3);
  const [variants, setVariants] = useState<TopicVariant[]>([]);
  const [chosenVariant, setChosenVariant] = useState<TopicVariant | null>(null);

  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Accordion collapsed state per section
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    warmup: false,
    grammar: false,
    maintopic: false,
    focus: false,
    practice: false,
    homework: false,
    extra: true,
  });

  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [chatDraft, setChatDraft] = useState('');

  // Inline edit state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingNotes, setEditingNotes] = useState('');

  // Library modal (Moje scenariusze)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [savedScenariosList, setSavedScenariosList] = useState<GeneratedLessonScenario[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'student'>('all');

  // Presentation View embedded
  const [showPresentationView, setShowPresentationView] = useState(false);
  const [launchFeedback, setLaunchFeedback] = useState<string | null>(null);

  // Presentation Studio State
  const [presentationTab, setPresentationTab] = useState<'ai_generator' | 'presets' | 'quick_paste' | 'custom' | 'assigned_decks'>('ai_generator');
  const [savedStudentDecks, setSavedStudentDecks] = useState<LessonPresentation[]>([]);
  const [isLoadingSavedDecks, setIsLoadingSavedDecks] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiNotes, setAiNotes] = useState('');
  const [aiLevel, setAiLevel] = useState(selectedUser?.level || 'B2');
  const [aiSlideCount, setAiSlideCount] = useState(4);
  const [isGeneratingAiDeck, setIsGeneratingAiDeck] = useState(false);
  const [generatedDeck, setGeneratedDeck] = useState<{
    deckTitle: string;
    slides: Array<NonNullable<PresentationState['slides']>[number]>;
  } | null>(null);
  const [previewSlideIdx, setPreviewSlideIdx] = useState(0);

  // Quick Paste state
  const [quickPasteText, setQuickPasteText] = useState('');
  const [quickPasteType, setQuickPasteType] = useState<'discussion' | 'flip_cards' | 'quiz' | 'process'>('discussion');
  const [isProcessingQuickPaste, setIsProcessingQuickPaste] = useState(false);

  // Custom slide state
  const [customTitle, setCustomTitle] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [customAudioUrl, setCustomAudioUrl] = useState('');
  const [customAudioName, setCustomAudioName] = useState('');
  const [customHints, setCustomHints] = useState('');
  const customAudioInputRef = useRef<HTMLInputElement>(null);

  const [transcript, setTranscript] = useState<CouncilEvent[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [savedScenarioId, setSavedScenarioId] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync user change into brief and presentation level
  useEffect(() => {
    if (selectedUser) {
      setBrief(prev => ({
        ...prev,
        audience: formatStudentDisplayName(selectedUser),
        level: selectedUser.level || prev.level || 'B2',
      }));
      setAiLevel(selectedUser.level || 'B2');
    }
  }, [selectedUser]);

  // Load Saved Presentations for student
  const refreshStudentPresentations = useCallback(async () => {
    setIsLoadingSavedDecks(true);
    try {
      const list = await getSavedPresentationsList(selectedUser?.id);
      setSavedStudentDecks(list);
    } catch (e) {
      console.warn('Błąd wczytywania przypisanych prezentacji:', e);
    } finally {
      setIsLoadingSavedDecks(false);
    }
  }, [selectedUser?.id]);

  useEffect(() => {
    refreshStudentPresentations();
  }, [refreshStudentPresentations]);

  // Handlers for student selection
  const handleSelectStudent = (u: UserWithId) => {
    onSelectUser?.(u);
    setBrief(prev => ({
      ...prev,
      audience: formatStudentDisplayName(u),
      level: u.level || 'B2',
    }));
    setAiLevel(u.level || 'B2');
    setIsStudentDropdownOpen(false);
    setIsCustomAudience(false);
  };

  const toggleNote = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNotes(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const toggleSectionCollapse = (sectionId: string) => {
    setCollapsedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const toggleItemCheck = (sectionId: string, itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!plan) return;
    setPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map(sec => {
          if (sec.id !== sectionId) return sec;
          return {
            ...sec,
            items: sec.items.map(it => (it.id === itemId ? { ...it, checked: !it.checked } : it)),
          };
        }),
      };
    });
  };

  const handleCopyNoteScaffolding = (id: string, text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedNoteId(id);
    setTimeout(() => setCopiedNoteId(null), 2000);
  };

  // Inline editing handlers
  const handleStartEdit = (item: PlanItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItemId(item.id);
    setEditingText(item.text);
    setEditingNotes(item.notes || '');
  };

  const handleSaveEdit = (sectionId: string, itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!plan) return;
    setPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map(sec => {
          if (sec.id !== sectionId) return sec;
          return {
            ...sec,
            items: sec.items.map(it => {
              if (it.id !== itemId) return it;
              return {
                ...it,
                text: editingText.trim() || it.text,
                notes: editingNotes.trim() ? editingNotes.trim() : undefined,
              };
            }),
          };
        }),
      };
    });
    setEditingItemId(null);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItemId(null);
  };

  const handleDeleteItem = (sectionId: string, itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!plan) return;
    setPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map(sec => {
          if (sec.id !== sectionId) return sec;
          return {
            ...sec,
            items: sec.items.filter(it => it.id !== itemId),
          };
        }),
      };
    });
    setSelectedIds(prev => prev.filter(id => id !== itemId));
  };

  const handleMoveItem = (sectionId: string, itemId: string, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!plan) return;
    setPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map(sec => {
          if (sec.id !== sectionId) return sec;
          const idx = sec.items.findIndex(it => it.id === itemId);
          if (idx < 0) return sec;
          if (direction === 'up' && idx === 0) return sec;
          if (direction === 'down' && idx === sec.items.length - 1) return sec;

          const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
          const newItems = [...sec.items];
          const temp = newItems[idx];
          newItems[idx] = newItems[targetIdx];
          newItems[targetIdx] = temp;

          return { ...sec, items: newItems };
        }),
      };
    });
  };

  const handleAddItem = (sectionId: string, kind: PlanItemKind = 'question') => {
    if (!plan) return;
    const newItemId = `${sectionId}-${Date.now().toString(36)}`;
    const newItem: PlanItem = {
      id: newItemId,
      kind,
      text: kind === 'question' ? 'Nowe pytanie dyskusyjne...' : kind === 'task' ? 'Sugerowane zadanie do przećwiczenia...' : 'Nowa treść...',
      notes: kind === 'question' ? '• Cel: ...\n• Scaffolding: ...\n• Follow-up: ...' : undefined,
      checked: false,
    };

    setPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map(sec => {
          if (sec.id !== sectionId) return sec;
          return { ...sec, items: [...sec.items, newItem] };
        }),
      };
    });

    setEditingItemId(newItemId);
    setEditingText(newItem.text);
    setEditingNotes(newItem.notes || '');
  };

  // Launch interactive exercise live for student scratchpad
  const handleLaunchExerciseLive = async (exercise: InteractiveExercise, sectionTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedUser?.id) {
      setLaunchFeedback('Wybierz najpierw kursanta w nagłówku, aby uruchomić dla niego ćwiczenie na żywo.');
      setTimeout(() => setLaunchFeedback(null), 4000);
      return;
    }

    const scratchpadId = `sp_${selectedUser.id}`;
    try {
      await updateScratchpadPresentation(scratchpadId, {
        active: true,
        title: exercise.question || sectionTitle,
        type:
          exercise.type === 'quiz' || exercise.type === 'interactive_quiz'
            ? 'interactive_quiz'
            : exercise.type === 'sentence_scramble'
            ? 'sentence_scramble'
            : 'error_hunt',
        question: exercise.question,
        options: exercise.options,
        correctAnswer: exercise.correctAnswer,
        revealedAnswer: false,
        studentAnswer: null,
        explanation: exercise.explanation,
      });

      setLaunchFeedback(`🚀 Uruchomiono ćwiczenie dla ${selectedUser.firstName || selectedUser.username}! Kursant widzi teraz interaktywny quiz zamiast notatnika.`);
      setTimeout(() => setLaunchFeedback(null), 5000);
    } catch (err: any) {
      setLaunchFeedback(`Błąd uruchamiania ćwiczenia: ${err?.message || 'Spróbuj ponownie'}`);
      setTimeout(() => setLaunchFeedback(null), 4000);
    }
  };

  // 1-Click Launch of Homework creation from plan
  const handleLaunchCreateHomework = () => {
    if (!plan) return;
    const targetStudent = selectedUser || (users.find(u => formatStudentDisplayName(u).toLowerCase() === brief.audience.toLowerCase()) || users[0]);
    if (!targetStudent) {
      setLaunchFeedback('Wybierz kursanta, aby utworzyć dla niego zadanie domowe ze zdań.');
      setTimeout(() => setLaunchFeedback(null), 4000);
      return;
    }

    const hwTask = extractHomeworkTask(plan);
    const vocabList = extractVocabularyList(plan);

    if (onCreateHomework) {
      onCreateHomework({
        student: targetStudent,
        topic: plan.title,
        words: vocabList,
        guidelines: hwTask?.taskText || plan.summary,
      });
      setLaunchFeedback(`📝 Otwarto generator zadań domowych dla ${targetStudent.firstName || targetStudent.username}!`);
      setTimeout(() => setLaunchFeedback(null), 4000);
    }
  };

  // Open / fetch scenarios library
  const handleOpenLibrary = async () => {
    setIsLibraryOpen(true);
    setIsLoadingLibrary(true);
    try {
      const list = await getGeneratedScenarios();
      setSavedScenariosList(list);
    } catch (err) {
      console.warn('Błąd wczytywania biblioteki scenariuszy:', err);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  const handleLoadScenarioFromLibrary = (scenario: GeneratedLessonScenario) => {
    let loadedPlan: LessonPlan | null = null;
    if (scenario.planJson) {
      try {
        const parsed = JSON.parse(scenario.planJson);
        if (parsed && (parsed.sections?.length > 0 || parsed.title)) {
          loadedPlan = parsed;
        }
      } catch (e) {
        console.warn('Błąd parsowania planJson ze scenariusza:', e);
      }
    }

    if (!loadedPlan) {
      loadedPlan = {
        title: scenario.title || scenario.topic,
        summary: scenario.goal || scenario.topic,
        format: scenario.format || '60 minut',
        goal: scenario.goal,
        sourceMaterialDescription: scenario.sourceMaterialDescription,
        sections: [
          {
            id: 'maintopic',
            title: scenario.topic,
            items: [
              {
                id: 'item-1',
                kind: 'question',
                text: scenario.content,
              },
            ],
          },
        ],
      };
    }

    setPlan(loadedPlan);
    setSavedScenarioId(scenario.id);
    if (scenario.attachments && scenario.attachments.length > 0) {
      setAttachments(scenario.attachments);
    }
    setBrief(prev => ({
      ...prev,
      audience: scenario.studentName || prev.audience,
      level: scenario.targetLevel || prev.level,
      mode: scenario.lessonType?.includes('Grupa') ? 'grupa' : '1:1',
    }));
    setStep('plan');
    setIsLibraryOpen(false);
  };

  const handleDeleteScenario = async (scenarioId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!(await confirmAsync('Czy na pewno chcesz usunąć ten scenariusz z bazy?'))) return;
    try {
      await deleteGeneratedScenario(scenarioId);
      setSavedScenariosList(prev => prev.filter(s => s.id !== scenarioId));
    } catch (err) {
      console.error('Błąd usuwania scenariusza:', err);
    }
  };

  // Launch embedded presentation view
  const handleOpenPresentationMode = async () => {
    if (!plan) return;
    try {
      const sName = selectedUser ? formatStudentDisplayName(selectedUser) : brief.audience;

      const pres = createPresentationFromScenario(
        {
          id: savedScenarioId || `scenario-pres-${Date.now()}`,
          title: plan.title,
          topic: plan.title,
          content: planToMarkdown(plan),
          targetLevel: brief.level,
          createdAt: new Date().toISOString(),
          format: plan.format,
          goal: plan.goal,
          sourceMaterialDescription: plan.sourceMaterialDescription,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
        selectedUser?.id,
        sName
      );

      await savePresentationToStorage(pres);
      await refreshStudentPresentations();
      setShowPresentationView(true);
    } catch (err) {
      console.error('Błąd generowania prezentacji:', err);
      setShowPresentationView(true);
    }
  };

  const historyDigest = useMemo(() => {
    if (brief.history?.trim()) return brief.history.trim();
    if (!recentLessons || recentLessons.length === 0) return '';
    const last = recentLessons[0];
    const chunks: string[] = [];
    if (last.topic) chunks.push(`Temat: ${last.topic}`);
    if (last.vocabularyText) chunks.push(`Słownictwo:\n${last.vocabularyText}`);
    if (last.suggestedFollowUp) chunks.push(`Follow-up: ${last.suggestedFollowUp}`);
    if (last.thingsToImprove) chunks.push(`Do poprawy: ${last.thingsToImprove}`);
    return chunks.join('\n');
  }, [brief.history, recentLessons]);

  const fullBrief = useCallback((): LessonBrief => ({ ...brief, history: historyDigest }), [
    brief,
    historyDigest,
  ]);

  const ask = async <T,>(prompt: string, busyLabel: string): Promise<T> => {
    setBusy(busyLabel);
    setError('');
    const config = await getAiConfig();
    try {
      const result = await runCouncil<T>({
        prompt,
        systemInstruction: CRIBRO_METHOD_SYSTEM,
        config: config.council || DEFAULT_COUNCIL,
        onEvent: event => setTranscript(prev => [...prev, event]),
      });
      return result.data;
    } finally {
      setBusy('');
    }
  };

  const handleProposeTopics = async () => {
    const missing = briefGate(brief);
    if (missing.length > 0) {
      setError(`Uzupełnij brakujące dane: ${missing.join(', ')}.`);
      return;
    }
    try {
      const data = await ask<{ variants: TopicVariant[] }>(
        buildTopicProposalPrompt(fullBrief(), variantCount, suggestion),
        `Przygotowuję ${variantCount} ${variantCount === 1 ? 'wariant' : 'warianty'} tematu…`
      );
      if (!Array.isArray(data?.variants) || data.variants.length === 0) {
        throw new Error('Model nie zwrócił propozycji tematów. Spróbuj ponownie.');
      }
      setVariants(data.variants);
      setStep('topics');
    } catch (err: any) {
      setError(err?.message || 'Nie udało się zaproponować tematów.');
    }
  };

  const handleGeneratePlan = async (variant: TopicVariant) => {
    setChosenVariant(variant);
    try {
      const data = await ask<LessonPlan>(
        buildScenarioPrompt(fullBrief(), {
          title: variant.title,
          angle: variant.angle,
          material: variant.material,
        }),
        `Układam pełny scenariusz lekcji dla ${brief.audience}…`
      );
      if (!data || !Array.isArray(data.sections)) {
        throw new Error('Model nie zwrócił poprawnego planu lekcji.');
      }

      // Add checked=false to all items
      const enrichedSections = data.sections.map(sec => ({
        ...sec,
        items: (sec.items || []).map(it => ({ ...it, checked: false })),
      }));

      setPlan({ ...data, sections: enrichedSections });
      setStep('plan');
    } catch (err: any) {
      setError(err?.message || 'Nie udało się wygenerować scenariusza.');
    }
  };

  const toggleItemSelect = (id: string) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const handleRevise = async () => {
    const instruction = chatDraft.trim();
    if (!instruction || !plan) return;

    const targets = [...selectedIds];
    setChat(prev => [
      ...prev,
      { id: `turn-${Date.now()}`, role: 'teacher', text: instruction, targets },
    ]);
    setChatDraft('');

    try {
      const data = await ask<{
        updates?: { id: string; text: string; notes?: string; exercise?: InteractiveExercise }[];
        addedItems?: { sectionId: string; item: PlanItem }[];
        deletedIds?: string[];
        comment?: string;
      }>(
        buildRevisionPrompt(fullBrief(), JSON.stringify(plan), targets, instruction),
        targets.length > 0 ? `Przerabiam ${targets.length} ${targets.length === 1 ? 'element' : 'elementy'}…` : 'Wprowadzam zmiany w scenariuszu…'
      );

      const updates = Array.isArray(data?.updates) ? data.updates : [];
      const added = Array.isArray(data?.addedItems) ? data.addedItems : [];
      const deleted = Array.isArray(data?.deletedIds) ? data.deletedIds : [];

      setPlan(prev => {
        if (!prev) return prev;
        const updatesMap = new Map(updates.map(u => [u.id, u]));

        let updatedSections = prev.sections.map(section => {
          let items = section.items
            .filter(it => !deleted.includes(it.id))
            .map(item => {
              const u = updatesMap.get(item.id);
              if (!u) return item;
              return {
                ...item,
                text: u.text || item.text,
                notes: typeof u.notes === 'string' ? u.notes : item.notes,
                exercise: u.exercise || item.exercise,
              };
            });

          const toAdd = added.filter(a => a.sectionId === section.id).map(a => a.item);
          if (toAdd.length > 0) {
            items = [...items, ...toAdd];
          }

          return { ...section, items };
        });

        return { ...prev, sections: updatedSections };
      });

      setChat(prev => [
        ...prev,
        {
          id: `turn-${Date.now()}`,
          role: 'planner',
          text: data?.comment || (updates.length > 0 ? `Zaktualizowano ${updates.length} elementów.` : 'Wprowadzono modyfikacje zgodnie z poleceniem.'),
        },
      ]);
      setSelectedIds([]);
    } catch (err: any) {
      setError(err?.message || 'Nie udało się przerobić zaznaczonych pytań.');
    }
  };

  const handleSave = async () => {
    if (!plan) return;
    setBusy('Zapisuję scenariusz w bazie…');
    setError('');
    try {
      const saved = await saveGeneratedScenario({
        title: plan.title,
        topic: plan.title,
        content: planToMarkdown(plan),
        studentId: selectedUser?.id || null,
        studentName: brief.audience || null,
        targetLevel: brief.level,
        lessonDuration: '60 min',
        lessonType: brief.mode === 'grupa' ? 'Grupa 2–4 os.' : 'Konwersacje 1:1',
        vocabularyText: planVocabulary(plan),
        tags: brief.grammarTopic?.trim() ? ['gramatyka', brief.grammarTopic.trim()] : [],
        planJson: JSON.stringify(plan),
        format: plan.format,
        goal: plan.goal,
        sourceMaterialDescription: plan.sourceMaterialDescription,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      setSavedScenarioId(saved.id);
      setLaunchFeedback('Scenariusz został pomyślnie zapisany w bazie „Moje scenariusze”!');
      setTimeout(() => setLaunchFeedback(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Nie udało się zapisać scenariusza.');
    } finally {
      setBusy('');
    }
  };

  const resetToBrief = () => {
    setStep('brief');
    setVariants([]);
    setChosenVariant(null);
    setPlan(null);
    setSelectedIds([]);
    setChat([]);
    setError('');
  };

  // ── Presentation Studio Actions ──
  const handleGenerateAiDeck = async () => {
    if (!aiTopic.trim()) return;
    setIsGeneratingAiDeck(true);
    setGeneratedDeck(null);

    try {
      const prompt = `Jesteś metodykiem języka angielskiego i ekspertem tworzenia nowoczesnych, interaktywnych slajdów e-learningowych w platformie CRIBRO Recall.
Twoim zadaniem jest wygenerować kompletną lekcję w slajdach na podany temat:

TEMAT: "${aiTopic}"
POZIOM CEFR: ${aiLevel}
LICZBA SLAJDÓW: ${aiSlideCount}
KURSANT: "${selectedUser ? formatStudentDisplayName(selectedUser) : 'Uczeń'}"
DODATKOWE MATERIAŁY/NOTATKI LEKTORA:
"${aiNotes || 'Brak dodatkowych notatek, wygeneruj na podstawie wiedzy metodycznej dla wskazanego tematu i poziomu.'}"

Zbuduj dokładnie ${aiSlideCount} zróżnicowanych metodycznie slajdów o strukturze:
1. Slajd 1: Rozgrzewka i dyskusja ("type": "slide") — chwytliwe pytanie po angielsku, prompt do rozmowy i 4 zwroty w "hints".
2. Slajd 2: Struktura/Reguła lub Etapy procesu ("type": "process_tabs") — zawiera tablicę "steps" (2-3 etapy z title, subtitle, content, keyPoints).
3. Slajd 3: Kluczowe zwroty w kontekście ("type": "flip_cards") — zawiera tablicę "cards" (3-4 karty 3D z term, definition, example, hint).
4. Slajd 4 (jeśli >=4): Interaktywny Quiz ("type": "interactive_quiz") — question, 4 options, correctAnswer, explanation.
5. Slajd 5 (jeśli >=5): Podsumowanie / Wyzwanie komunikacyjne ("type": "slide" lub "scenario_item").

Zwróć WYŁĄCZNIE poprawny obiekt JSON:
{
  "deckTitle": "Tytuł całej talii slajdów",
  "slides": [
    {
      "title": "Tytuł slajdu",
      "type": "slide",
      "question": "Pytanie po angielsku",
      "prompt": "Instrukcja",
      "hints": ["zwrot 1", "zwrot 2"],
      "cards": [{ "term": "...", "definition": "...", "example": "...", "hint": "..." }],
      "steps": [{ "title": "...", "subtitle": "...", "content": "...", "keyPoints": ["..."] }],
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "explanation": "..."
    }
  ]
}`;

      const res = await runCouncil<{
        deckTitle: string;
        slides: Array<NonNullable<PresentationState['slides']>[number]>;
      }>({
        prompt,
        systemInstruction: 'Jesteś czołowym metodykiem nauczania języka angielskiego w biznesie. Generujesz wyłącznie perfekcyjny JSON.',
      });

      if (res && res.data && Array.isArray(res.data.slides) && res.data.slides.length > 0) {
        setGeneratedDeck(res.data);
        setPreviewSlideIdx(0);
      }
    } catch (err) {
      console.error('[AI Slide Generator Error]:', err);
    } finally {
      setIsGeneratingAiDeck(false);
    }
  };

  const handleSaveAndAssignDeck = async (deckToSave: {
    deckTitle: string;
    slides: Array<NonNullable<PresentationState['slides']>[number]>;
  }) => {
    try {
      const sName = selectedUser ? formatStudentDisplayName(selectedUser) : brief.audience;
      const pres: LessonPresentation = {
        id: `pres-${Date.now()}`,
        title: deckToSave.deckTitle || aiTopic || 'Lekcja w slajdach',
        topic: aiTopic || deckToSave.deckTitle || 'Prezentacja lekcyjna',
        targetLevel: aiLevel,
        studentId: selectedUser?.id || null,
        studentName: sName,
        slides: deckToSave.slides.map((s, idx) => ({
          id: `slide-${idx + 1}`,
          type: s.type as any,
          title: s.title || `Slajd ${idx + 1}`,
          subtitle: s.prompt || '',
          content: s.prompt || '',
          speakerNotes: s.explanation || '',
          cards: s.cards,
          steps: s.steps,
          options: s.options,
          correctAnswer: s.correctAnswer,
          explanation: s.explanation,
        })),
        liveCorrections: [],
        liveVocab: [],
        liveNotes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await savePresentationToStorage(pres);
      await refreshStudentPresentations();
      setLaunchFeedback(`💾 Zapisano i przypisano prezentację dla ${sName}!`);
      setTimeout(() => setLaunchFeedback(null), 4000);
    } catch (e) {
      console.error('Błąd zapisu prezentacji:', e);
    }
  };

  const handleBroadcastDeckToScratchpad = async (deckToBroadcast: {
    deckTitle: string;
    slides: Array<NonNullable<PresentationState['slides']>[number]>;
  }) => {
    if (!selectedUser?.id) {
      setLaunchFeedback('Wybierz kursanta, aby transmitować slajdy do jego notatnika.');
      setTimeout(() => setLaunchFeedback(null), 4000);
      return;
    }
    const scratchpadId = `sp_${selectedUser.id}`;
    const firstSlide = deckToBroadcast.slides[0];
    try {
      await updateScratchpadPresentation(scratchpadId, {
        active: true,
        title: deckToBroadcast.deckTitle || aiTopic || 'Lekcja w Slajdach',
        type: firstSlide.type,
        question: firstSlide.question,
        prompt: firstSlide.prompt,
        hints: firstSlide.hints,
        cards: firstSlide.cards,
        steps: firstSlide.steps,
        options: firstSlide.options,
        correctAnswer: firstSlide.correctAnswer,
        explanation: firstSlide.explanation,
        slideIndex: 0,
        totalSlides: deckToBroadcast.slides.length,
        slides: deckToBroadcast.slides,
      });

      // Auto-save to student storage
      await handleSaveAndAssignDeck(deckToBroadcast);

      setLaunchFeedback(`🚀 Slajdy zostały uruchomione w notatniku dla ${selectedUser.firstName || selectedUser.username}!`);
      setTimeout(() => setLaunchFeedback(null), 5000);
    } catch (err: any) {
      setLaunchFeedback(`Błąd transmisji: ${err?.message || 'Spróbuj ponownie'}`);
      setTimeout(() => setLaunchFeedback(null), 4000);
    }
  };

  const handleDeleteSavedDeck = async (deckId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!(await confirmAsync('Czy na pewno chcesz usunąć tę prezentację?'))) return;
    try {
      await deleteSavedPresentation(deckId, selectedUser?.id);
      await refreshStudentPresentations();
      setLaunchFeedback('Prezentacja została usunięta.');
      setTimeout(() => setLaunchFeedback(null), 3000);
    } catch (err) {
      console.error('Błąd usuwania prezentacji:', err);
    }
  };

  /* ── Widok wbudowanej Prezentacji ── */
  if (showPresentationView && plan) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line max-w-5xl mx-auto w-full">
          <button
            type="button"
            onClick={() => setShowPresentationView(false)}
            className="px-3.5 py-2 rounded-xl bg-base-100/60 border border-line-strong text-xs font-bold text-text-hi hover:border-primary/50 transition-all flex items-center gap-2 cursor-pointer shadow-ambient-sm"
          >
            <ArrowLeft size={14} /> Wróć do edycji scenariusza lekcji
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase bg-primary/20 text-primary border border-primary/30 px-2.5 py-0.5 rounded-full font-bold">
              Tryb Prezentacji
            </span>
            <span className="text-xs text-content-muted truncate max-w-xs">{plan.title}</span>
          </div>
        </div>

        <LessonPresentationView
          selectedUser={selectedUser}
          lessonRecords={recentLessons}
          onOpenLessonFormWithData={onInsertLessonRecord ? (data) => onInsertLessonRecord({
            topic: data.topic,
            summary: data.summary,
            vocabulary: data.words,
            followUp: data.followUp,
          }) : undefined}
          onClose={() => setShowPresentationView(false)}
        />
      </div>
    );
  }

  const StepBar = () => (
    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
      {(
        [
          ['brief', 'Ustalenia'],
          ['topics', 'Temat'],
          ['plan', 'Scenariusz'],
        ] as const
      ).map(([id, label], index) => {
        const order = ['brief', 'topics', 'plan'];
        const isCurrent = step === id;
        const isDone = order.indexOf(step) > index;
        return (
          <React.Fragment key={id}>
            {index > 0 && <span className="text-text-faint">·</span>}
            <span
              className={
                isCurrent ? 'text-primary' : isDone ? 'text-text-hi' : 'text-content-muted'
              }
            >
              {isDone && <Check size={11} className="inline mr-0.5 -mt-0.5" />}
              {label}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );

  const BusyOverlay = () =>
    busy ? (
      <div className="rounded-xl border border-primary/30 bg-primary/8 px-4 py-3 flex items-center gap-2.5 animate-fadeIn">
        <Loader2 size={16} className="text-primary animate-spin shrink-0" />
        <span className="text-sm font-semibold text-text-hi">{busy}</span>
      </div>
    ) : null;

  /* ── Pasek narady ── */
  const CouncilStrip = () => {
    if (transcript.length === 0) return null;
    const seats = Array.from(new Set(transcript.map(event => event.model)));
    const totalSeconds = transcript.reduce((sum, event) => sum + event.seconds, 0);

    return (
      <div className="rounded-xl border border-line bg-base-100/25 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTranscript(prev => !prev)}
          className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-base-100/40 transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0 text-[11px] text-content-muted">
            <Users size={13} className="text-primary shrink-0" />
            <span className="font-bold uppercase tracking-wider">Narada</span>
            <span className="truncate">
              {seats.map(formatAIModelName).join(' · ')} — {transcript.length}{' '}
              {transcript.length === 1 ? 'tura' : 'tury'}, {totalSeconds.toFixed(1)} s
            </span>
          </span>
          <ChevronDown
            size={14}
            className={`shrink-0 text-content-muted transition-transform ${showTranscript ? 'rotate-180' : ''}`}
          />
        </button>

        {showTranscript && (
          <div className="p-3 space-y-2 border-t border-line bg-base-200/40 text-[11px]">
            {transcript.map((event, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-content-muted text-[10px]">
                  <span className="font-bold text-white">{formatAIModelName(event.model)} ({event.role})</span>
                  <span>{event.seconds.toFixed(1)} s</span>
                </div>
                <p className="text-content whitespace-pre-wrap">{event.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const filteredUsers = useMemo(() => {
    if (!studentSearchTerm.trim()) return users;
    const q = studentSearchTerm.toLowerCase();
    return users.filter(
      u =>
        formatStudentDisplayName(u).toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.level && u.level.toLowerCase().includes(q))
    );
  }, [users, studentSearchTerm]);

  return (
    <div className="space-y-5">
      {/* ── GŁÓWNY PRZEŁĄCZNIK TRYBÓW: KONSPEKT BLOKOWY 2.0 vs KREATOR AI vs PREZENTACJA ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-base-300/60 border border-line-strong shadow-ambient-sm">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setStudioMode('blocks')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              studioMode === 'blocks'
                ? 'bg-primary text-black shadow-md ring-1 ring-primary/40'
                : 'text-content-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <PlannerBlocksIcon size={15} />
            <span>Konspekt Blokowy 2.0</span>
          </button>

          <button
            type="button"
            onClick={() => setStudioMode('scenario')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              studioMode === 'scenario'
                ? 'bg-primary text-black shadow-md ring-1 ring-primary/40'
                : 'text-content-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles size={15} />
            <span>Kreator AI (Scenariusz)</span>
          </button>

          <button
            type="button"
            onClick={() => setStudioMode('presentation')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              studioMode === 'presentation'
                ? 'bg-primary text-black shadow-md ring-1 ring-primary/40'
                : 'text-content-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <Airplay size={15} />
            <span>Nowa prezentacja & slajdy</span>
            {savedStudentDecks.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                {savedStudentDecks.length}
              </span>
            )}
          </button>
        </div>

        {/* Informacja o wybranym kursancie w nagłówku */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-content-muted">Kursant:</span>
          {selectedUser ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-base-100/80 border border-line-strong">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <strong className="text-white">{formatStudentDisplayName(selectedUser)}</strong>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-bold">
                {selectedUser.level || brief.level || 'B2'}
              </span>
            </div>
          ) : (
            <span className="text-content-muted italic">Nie wybrano (ogólny)</span>
          )}
        </div>
      </div>

      {launchFeedback && (
        <div className="p-3.5 rounded-2xl bg-primary/15 border border-primary/40 text-primary text-xs font-bold flex items-center gap-2.5 animate-fadeIn shadow-lg">
          <Sparkles size={16} className="shrink-0" />
          <span>{launchFeedback}</span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TRYB 0: PLANER LEKCJI 2.0 (BLOKOWY KONSPEKT CZASOWY)
          ═══════════════════════════════════════════════════════════════════ */}
      {studioMode === 'blocks' && (
        <div className="animate-fadeIn">
          <BlockLessonPlanner
            selectedUser={selectedUser}
            users={users}
            onSelectUser={onSelectUser}
            onOpenPresentationStudio={() => setStudioMode('presentation')}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TRYB 1: PLANER SCENARIUSZA LEKCJI (AI)
          ═══════════════════════════════════════════════════════════════════ */}
      {studioMode === 'scenario' && (
        <>
          {/* ═══ KROK 1 — USTALENIA ═══ */}
          {step === 'brief' && (
            <div className="max-w-3xl space-y-4">
              <div className="flex items-center justify-between gap-3">
                <StepBar />
                <button
                  type="button"
                  onClick={handleOpenLibrary}
                  className="px-3 py-1.5 rounded-xl border border-line-strong bg-base-100/50 text-xs font-bold text-text-hi hover:border-primary/50 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <BookOpen size={13} className="text-primary" /> Moje scenariusze
                </button>
              </div>

              <div className="rounded-2xl border border-line-strong bg-base-200/60 p-5 space-y-4 shadow-ambient-sm">
                <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
                  <h3 className="text-base font-bold text-text-hi flex items-center gap-2">
                    <Sparkles size={16} className="text-primary" /> Ustalenia lekcji
                  </h3>
                  <span className="text-xs text-content-muted font-mono">Krok 1 / 3</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Inteligentny selektor kursanta / grupy */}
                  <div className="relative" ref={studentDropdownRef}>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                      Kursant / Grupa (wybór z bazy)
                    </label>

                    {!isCustomAudience ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => setIsStudentDropdownOpen(prev => !prev)}
                          className="w-full bg-base-100/60 border border-line-strong rounded-xl px-3.5 py-2.5 text-sm text-left text-text-hi outline-none focus:border-primary font-medium flex items-center justify-between gap-2 cursor-pointer hover:border-primary/40 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Users size={14} className="text-primary shrink-0" />
                            <span className="truncate">
                              {brief.audience || 'Wybierz kursanta z listy...'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {brief.level && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-bold">
                                {brief.level}
                              </span>
                            )}
                            <ChevronDown size={14} className="text-content-muted" />
                          </div>
                        </button>

                        {isStudentDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-base-200 border-2 border-primary/40 rounded-2xl shadow-2xl p-2.5 space-y-2 max-h-72 flex flex-col animate-in fade-in">
                            <div className="relative">
                              <Search size={13} className="absolute left-2.5 top-2.5 text-content-muted" />
                              <input
                                type="text"
                                value={studentSearchTerm}
                                onChange={e => setStudentSearchTerm(e.target.value)}
                                placeholder="Szukaj kursanta..."
                                className="w-full bg-base-100/80 border border-line-strong rounded-xl pl-8 pr-3 py-1.5 text-xs text-text-hi outline-none focus:border-primary"
                                autoFocus
                              />
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                              {filteredUsers.map(u => {
                                const isSelected = selectedUser?.id === u.id || brief.audience === formatStudentDisplayName(u);
                                return (
                                  <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => handleSelectStudent(u)}
                                    className={`w-full p-2 rounded-xl text-left text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                                      isSelected
                                        ? 'bg-primary/20 border border-primary/40 text-primary font-bold'
                                        : 'hover:bg-white/5 text-content hover:text-white'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="font-bold truncate">{formatStudentDisplayName(u)}</div>
                                      {u.email && (
                                        <div className="text-[10px] text-content-muted truncate">{u.email}</div>
                                      )}
                                    </div>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-base-100 border border-line text-text-hi shrink-0">
                                      {u.level || 'B2'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            <div className="pt-1.5 border-t border-white/10">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCustomAudience(true);
                                  setIsStudentDropdownOpen(false);
                                }}
                                className="w-full py-1.5 text-center text-[11px] font-bold text-primary hover:underline cursor-pointer"
                              >
                                + Wpisz własną nazwę grupy / kursanta
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={brief.audience}
                          onChange={e => setBrief(prev => ({ ...prev, audience: e.target.value }))}
                          placeholder="np. Grupa DSV B2, Tomasz..."
                          className="flex-1 bg-base-100/60 border border-line-strong rounded-xl px-3.5 py-2.5 text-sm text-text-hi outline-none focus:border-primary font-medium"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setIsCustomAudience(false)}
                          className="px-2.5 py-2 rounded-xl bg-white/5 border border-line-strong text-xs text-content-muted hover:text-white shrink-0"
                          title="Wróć do wyboru z listy"
                        >
                          Lista
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-content-muted">
                        Poziom CEFR
                      </label>
                      {selectedUser && (
                        <span className="text-[10px] text-primary/80 font-medium">
                          Z profilu kursanta ✓
                        </span>
                      )}
                    </div>
                    <select
                      value={brief.level}
                      onChange={e => setBrief(prev => ({ ...prev, level: e.target.value }))}
                      className="w-full bg-base-100/60 border border-line-strong rounded-xl px-3.5 py-2.5 text-sm text-text-hi outline-none focus:border-primary font-medium"
                    >
                      {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lvl => (
                        <option key={lvl} value={lvl}>
                          Poziom {lvl}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                      Tryb zajęć
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBrief(prev => ({ ...prev, mode: '1:1' }))}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          brief.mode === '1:1'
                            ? 'bg-primary text-black border-primary shadow-xs'
                            : 'bg-base-100/50 border-line-strong text-content hover:text-white'
                        }`}
                      >
                        Lekcja 1:1
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrief(prev => ({ ...prev, mode: 'grupa' }))}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          brief.mode === 'grupa'
                            ? 'bg-primary text-black border-primary shadow-xs'
                            : 'bg-base-100/50 border-line-strong text-content hover:text-white'
                        }`}
                      >
                        Grupa (2–4 os.)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                      Data lekcji
                    </label>
                    <input
                      type="date"
                      value={brief.date}
                      onChange={e => setBrief(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full bg-base-100/60 border border-line-strong rounded-xl px-3.5 py-2 text-sm text-text-hi outline-none focus:border-primary font-mono"
                    />
                  </div>
                </div>

                {/* Opcjonalna gramatyka i materiał źródłowy */}
                <div className="pt-2 border-t border-line space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                      Temat gramatyczny (opcjonalny — dodaje sekcję Grammar Review)
                    </label>
                    <input
                      type="text"
                      value={brief.grammarTopic || ''}
                      onChange={e => setBrief(prev => ({ ...prev, grammarTopic: e.target.value }))}
                      placeholder="np. There is / There are, Present Perfect, Conditionals..."
                      className="w-full bg-base-100/60 border border-line-strong rounded-xl px-3.5 py-2.5 text-sm text-text-hi outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                      Wklej artykuł / materiał źródłowy (opcjonalnie)
                    </label>
                    <textarea
                      value={brief.sourceMaterial || ''}
                      onChange={e => setBrief(prev => ({ ...prev, sourceMaterial: e.target.value }))}
                      rows={2}
                      placeholder="Wklej tekst, fragment artykułu lub opis sytuacji zawodowej..."
                      className="w-full bg-base-100/60 border border-line-strong rounded-xl px-3.5 py-2 text-xs text-text-hi outline-none focus:border-primary resize-none"
                    />
                  </div>

                  <LessonFileUploader
                    attachments={attachments}
                    onAttachmentsChange={setAttachments}
                  />
                </div>
              </div>

              {/* Propozycje tematów */}
              <div className="rounded-2xl border border-primary/35 bg-primary/8 p-5 space-y-3.5">
                <div className="flex items-start gap-2.5">
                  <span className="p-1.5 rounded-lg bg-primary/15 text-primary border border-primary/30 shrink-0">
                    <Sparkles size={15} />
                  </span>
                  <p className="text-sm text-text-hi leading-relaxed">
                    Zanim zacznę układać — <strong>masz sugestie co do tematu</strong>, czy mam poszukać sam?
                    I <strong>ile wariantów</strong> mam przygotować do wyboru?
                  </p>
                </div>

                <input
                  type="text"
                  value={suggestion}
                  onChange={e => setSuggestion(e.target.value)}
                  placeholder="Sugestia tematu — zostaw puste, jeśli mam poszukać sam"
                  className="w-full bg-base-100/60 border border-line-strong rounded-xl px-3.5 py-2.5 text-sm text-text-hi outline-none focus:border-primary"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-content-muted mr-1">
                      Warianty
                    </span>
                    {[2, 3, 4].map(count => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setVariantCount(count)}
                        className={`w-9 h-9 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${
                          variantCount === count
                            ? 'border-primary/60 bg-primary text-black font-bold'
                            : 'border-line-strong bg-base-100/40 text-content-muted hover:border-primary/35'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleProposeTopics}
                    disabled={Boolean(busy)}
                    className="px-4 py-2.5 rounded-xl bg-primary text-black font-bold text-sm hover:brightness-110 transition-all flex items-center gap-2 cursor-pointer shadow-btn disabled:opacity-50"
                  >
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    Zaproponuj tematy
                  </button>
                </div>
              </div>

              <BusyOverlay />
              {error && (
                <p className="text-xs font-semibold text-danger bg-danger/10 border border-danger/25 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}
              <CouncilStrip />

              {/* Modal Biblioteki Scenariuszy */}
              {isLibraryOpen && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-base-200 border border-primary/30 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <div className="flex items-center gap-2.5">
                        <BookOpen size={18} className="text-primary" />
                        <h3 className="text-lg font-bold text-white">Baza „Moje scenariusze”</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsLibraryOpen(false)}
                        className="p-1.5 rounded-lg text-content-muted hover:text-white cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLibraryFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          libraryFilter === 'all'
                            ? 'bg-primary text-black'
                            : 'bg-white/5 text-content-muted hover:text-white'
                        }`}
                      >
                        Wszystkie scenariusze ({savedScenariosList.length})
                      </button>
                      {selectedUser && (
                        <button
                          type="button"
                          onClick={() => setLibraryFilter('student')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            libraryFilter === 'student'
                              ? 'bg-primary text-black'
                              : 'bg-white/5 text-content-muted hover:text-white'
                          }`}
                        >
                          Dla: {formatStudentDisplayName(selectedUser)}
                        </button>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                      {isLoadingLibrary ? (
                        <div className="py-8 text-center text-xs text-content-muted">Wczytuję scenariusze...</div>
                      ) : savedScenariosList.length === 0 ? (
                        <div className="py-8 text-center text-xs text-content-muted">Brak zapisanych scenariuszy. Wygeneruj i zapisz pierwszy!</div>
                      ) : (
                        savedScenariosList
                          .filter(s => (libraryFilter === 'student' && selectedUser ? s.studentId === selectedUser.id : true))
                          .map(scenario => (
                            <div
                              key={scenario.id}
                              className="p-4 rounded-2xl bg-black/40 border border-white/10 hover:border-primary/40 transition-all space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="text-sm font-bold text-white">{scenario.title}</h4>
                                  <p className="text-[11px] text-content-muted mt-0.5">{scenario.topic}</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-bold">
                                    {scenario.targetLevel || 'B2'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteScenario(scenario.id, e)}
                                    className="p-1.5 text-content-muted hover:text-rose-400 cursor-pointer"
                                    title="Usuń scenariusz"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>

                              {scenario.goal && (
                                <p className="text-[11px] text-content leading-relaxed">
                                  <strong>Cel:</strong> {scenario.goal}
                                </p>
                              )}

                              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                <span className="text-[10px] text-content-muted">
                                  Kursant: <strong className="text-white">{scenario.studentName || 'Wszyscy'}</strong>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleLoadScenarioFromLibrary(scenario)}
                                  className="px-3 py-1 rounded-xl bg-primary text-black text-xs font-bold hover:brightness-110 transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <Play size={11} /> Wczytaj do lekcji
                                </button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ KROK 2 — WARIANTY TEMATU ═══ */}
          {step === 'topics' && (
            <div className="max-w-4xl space-y-4">
              <div className="flex items-center justify-between gap-3">
                <StepBar />
                <button
                  type="button"
                  onClick={resetToBrief}
                  className="text-[11px] font-bold text-content-muted hover:text-text-hi flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft size={12} /> Ustalenia
                </button>
              </div>

              <p className="text-sm text-text-hi">
                Mam {variants.length} {variants.length === 1 ? 'propozycję' : 'propozycje'} dla{' '}
                <strong>{brief.audience}</strong> ({brief.level}):
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {variants.map((variant, index) => (
                  <div
                    key={index}
                    className="p-5 rounded-2xl border border-line-strong bg-base-200/70 hover:border-primary/60 transition-all space-y-3 flex flex-col justify-between shadow-ambient-sm group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-bold">
                          Wariant {index + 1}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-text-hi group-hover:text-primary transition-colors">
                        {variant.title}
                      </h4>
                      {variant.angle && (
                        <p className="text-xs text-content-muted leading-relaxed">
                          <strong>Kąt:</strong> {variant.angle}
                        </p>
                      )}
                      {variant.material && (
                        <p className="text-xs text-content-muted leading-relaxed">
                          <strong>Materiał:</strong> {variant.material}
                        </p>
                      )}
                      {variant.why && (
                        <p className="text-xs text-content leading-relaxed">
                          <strong>Dlaczego:</strong> {variant.why}
                        </p>
                      )}
                      {variant.sampleQuestion && (
                        <div className="p-2.5 rounded-xl bg-base-100/60 border border-line text-xs italic text-purple-300">
                          „{variant.sampleQuestion}”
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleGeneratePlan(variant)}
                      disabled={Boolean(busy)}
                      className="w-full py-2.5 rounded-xl bg-primary text-black font-bold text-xs hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-btn disabled:opacity-50"
                    >
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                      Wybierz i stwórz scenariusz
                    </button>
                  </div>
                ))}
              </div>

              <BusyOverlay />
              {error && (
                <p className="text-xs font-semibold text-danger bg-danger/10 border border-danger/25 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}
              <CouncilStrip />
            </div>
          )}

          {/* ═══ KROK 3 — PEŁNY SCENARIUSZ LEKCJI (BLOKI WG SZABLONU) ═══ */}
          {step === 'plan' && plan && (
            <div className="space-y-4">
              {/* Pasek akcji u góry */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <StepBar />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('topics')}
                    className="text-[11px] font-bold text-content-muted hover:text-text-hi flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft size={12} /> Inny temat
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenLibrary}
                    className="px-3 py-1.5 rounded-xl border border-line-strong bg-base-100/50 text-xs font-bold text-text-hi hover:border-primary/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <BookOpen size={13} className="text-primary" /> Moje scenariusze
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={Boolean(busy)}
                    className="px-3 py-1.5 rounded-xl border border-line-strong bg-base-100/50 text-xs font-bold text-text-hi hover:border-primary/40 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {savedScenarioId ? <Check size={13} className="text-primary" /> : <Save size={13} />}
                    {savedScenarioId ? 'Zapisany ✓' : 'Zapisz scenariusz'}
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenPresentationMode}
                    className="px-3 py-1.5 rounded-xl bg-primary/15 border border-primary/35 text-xs font-bold text-primary hover:bg-primary/25 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Airplay size={13} /> Tryb Prezentacji
                  </button>
                  <button
                    type="button"
                    onClick={handleLaunchCreateHomework}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Edit3 size={13} /> Stwórz pracę domową
                  </button>
                  {onInsertLessonRecord && plan && (
                    <button
                      type="button"
                      onClick={() =>
                        onInsertLessonRecord({
                          topic: plan.title,
                          summary: plan.summary,
                          vocabulary: planVocabulary(plan),
                          followUp: '',
                          scenarioId: savedScenarioId,
                          scenarioTopic: plan.title,
                          scenarioContent: planToMarkdown(plan),
                        })
                      }
                      className="px-3 py-1.5 rounded-xl border border-line-strong bg-base-100/50 text-xs font-bold text-text-hi hover:border-primary/40 transition-colors cursor-pointer"
                    >
                      Do notatki z lekcji
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-4 items-start">
                {/* ── Główny widok Scenariusza ── */}
                <div className="space-y-4 min-w-0">
                  {/* KARTA WSTĘPNA LEKCJI — Format, Cel, Materiał źródłowy */}
                  <div className="rounded-2xl border border-white/10 bg-base-200/90 p-5 space-y-4 shadow-xl">
                    <div className="flex items-start gap-2.5 text-sm">
                      <span className="text-base select-none">🏭</span>
                      <div>
                        <strong className="text-white font-bold">Format: </strong>
                        <span className="text-content font-medium">
                          {plan?.format || `indywidualna lekcja General English, 60 minut, poziom ${brief.level} Medium.`}
                        </span>
                      </div>
                    </div>

                    <div className="text-sm">
                      <strong className="text-white font-bold">Cel: </strong>
                      <span className="text-content">
                        {plan?.goal || plan?.summary}
                      </span>
                    </div>

                    <div className="text-sm leading-relaxed">
                      <strong className="text-white font-bold">Materiał źródłowy: </strong>
                      <span className="text-content">
                        {plan?.sourceMaterialDescription || chosenVariant?.material || 'ESL Conversation Questions. Zachowujemy konwersacyjny format pytań.'}
                      </span>
                    </div>
                  </div>

                  {/* KARTA AUDIO & ZAŁĄCZNIKÓW DO PREZENTACJI W NOTEBOOKU */}
                  {(() => {
                    const audioAtts = attachments.filter(a => a.type === 'audio' && a.dataUrl);
                    return (
                      <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-3 shadow-lg">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0">
                              <Volume2 size={16} />
                            </div>
                            <div>
                              <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                                Materiały Audio i Rozumienie ze Słuchu
                                {audioAtts.length > 0 && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 font-mono font-bold">
                                    {audioAtts.length}
                                  </span>
                                )}
                              </h4>
                              <p className="text-[11px] text-purple-200/70">
                                Wgrane nagrania zostaną automatycznie włączone do slajdów prezentacji w notatniku
                              </p>
                            </div>
                          </div>
                          <div>
                            <input
                              ref={audioFileInputRef}
                              type="file"
                              accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac"
                              className="hidden"
                              onChange={handleAudioUpload}
                            />
                            <button
                              type="button"
                              onClick={() => audioFileInputRef.current?.click()}
                              className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 text-xs font-bold text-purple-200 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              <UploadCloud size={13} />
                              Wgraj plik audio (.mp3, .wav)
                            </button>
                          </div>
                        </div>

                        {audioAtts.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                            {audioAtts.map((att) => (
                              <div
                                key={att.id}
                                className="p-3 rounded-xl bg-base-300/80 border border-purple-500/30 space-y-2 flex flex-col justify-between"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Music size={14} className="text-purple-400 shrink-0" />
                                    <span className="text-xs font-bold text-white truncate" title={att.name}>
                                      {att.name}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAttachment(att.id)}
                                    className="p-1 rounded-lg text-content-muted hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                                    title="Usuń plik audio"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                                <audio
                                  controls
                                  src={att.dataUrl}
                                  className="w-full h-8 rounded-lg accent-primary"
                                  preload="metadata"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl border border-dashed border-purple-500/30 bg-purple-950/10 text-center">
                            <p className="text-xs text-purple-200/60">
                              Brak załączonych plików audio. Kliknij „Wgraj plik audio”, aby dodać ścieżkę MP3/WAV do tego scenariusza.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* 6 ZWIJANYCH BLOKÓW AKORDEONU WG SZABLONU */}
                  <div className="space-y-2.5">
                    {plan?.sections.map((section, sIndex) => {
                      const isCollapsed = collapsedSections[section.id] ?? false;
                      const isMainTopic = section.id === 'maintopic' || section.id === 'main-topic' || sIndex === 2;
                      const isPractice = section.id === 'practice' || section.id === 'practice-enclosure' || sIndex === 4;
                      const isHomework = section.id === 'homework' || section.id === 'wrap-up' || section.title.toLowerCase().includes('homework') || section.title.toLowerCase().includes('wrap');

                      return (
                        <div
                          key={section.id}
                          className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                            !isCollapsed && isMainTopic
                              ? 'border-primary/50 ring-2 ring-primary/40 bg-base-200/90 shadow-xl'
                              : isHomework
                              ? 'border-amber-500/35 bg-base-200/80 shadow-md'
                              : 'border-white/10 bg-base-200/60'
                          }`}
                        >
                          {/* Wiersz nagłówka sekcji akordeonu */}
                          <header
                            onClick={() => toggleSectionCollapse(section.id)}
                            className="px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-base-100/40 transition-colors select-none"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-content-muted">
                                {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                              </span>
                              <h4 className="text-sm font-bold text-white truncate flex items-center gap-2">
                                {section.title}
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-content-muted">
                                  {section.items.length} {section.items.length === 1 ? 'poz.' : 'poz.'}
                                </span>
                              </h4>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddItem(section.id);
                                }}
                                className="p-1 rounded-lg text-content-muted hover:text-primary hover:bg-white/5 transition-colors cursor-pointer"
                                title="Dodaj punkt do sekcji"
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          </header>

                          {/* Zawartość sekcji po rozwinięciu */}
                          {!isCollapsed && (
                            <div className="p-4 pt-1 space-y-4 border-t border-white/5">
                              {/* Sub-bloki dla Main Topic */}
                              {isMainTopic ? (
                                <div className="space-y-4">
                                  {/* 1. TOPIC AND MATERIAL */}
                                  <div className="space-y-2">
                                    <div className="inline-block px-3 py-1 rounded-lg bg-sky-950/80 border border-sky-500/40 text-sky-300 text-xs font-bold tracking-wide">
                                      Topic and Material
                                    </div>

                                    <div className="space-y-1.5 pl-1">
                                      {section.items
                                        .filter(it => it.kind === 'topic_material')
                                        .map(item => (
                                          <div
                                            key={item.id}
                                            onClick={(e) => toggleItemCheck(section.id, item.id, e)}
                                            className="flex items-start gap-2.5 text-xs text-content cursor-pointer hover:text-white py-1 group"
                                          >
                                            <span className="mt-0.5 text-content-muted group-hover:text-primary shrink-0">
                                              {item.checked ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
                                            </span>
                                            <span className={item.checked ? 'line-through text-content-muted' : ''}>
                                              {item.text}
                                            </span>
                                          </div>
                                        ))}
                                    </div>

                                    {section.topicMaterialDescription && (
                                      <p className="text-[11px] text-content-muted italic leading-relaxed pt-1">
                                        {section.topicMaterialDescription}
                                      </p>
                                    )}
                                  </div>

                                  {/* 2. LEAD-IN */}
                                  <div className="space-y-2 pt-2 border-t border-white/5">
                                    <div className="inline-block px-3 py-1 rounded-lg bg-sky-950/80 border border-sky-500/40 text-sky-300 text-xs font-bold tracking-wide">
                                      Lead-in
                                    </div>

                                    <div className="space-y-1.5 pl-1">
                                      {section.items
                                        .filter(it => it.kind === 'lead_in')
                                        .map(item => (
                                          <div
                                            key={item.id}
                                            onClick={(e) => toggleItemCheck(section.id, item.id, e)}
                                            className="flex items-start gap-2.5 text-xs text-content cursor-pointer hover:text-white py-1 group"
                                          >
                                            <span className="mt-0.5 text-content-muted group-hover:text-primary shrink-0">
                                              {item.checked ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
                                            </span>
                                            <span className={item.checked ? 'line-through text-content-muted' : ''}>
                                              {item.text}
                                            </span>
                                          </div>
                                        ))}
                                    </div>
                                  </div>

                                  {/* 3. THOUGHT-PROVOKING QUESTIONS */}
                                  <div className="space-y-2 pt-2 border-t border-white/5">
                                    <div className="inline-block px-3 py-1 rounded-lg bg-[#3b1933] border border-purple-500/40 text-purple-300 text-xs font-bold tracking-wide">
                                      Thought-Provoking Questions (Safety Bank)
                                    </div>

                                    {section.thoughtProvokingDescription && (
                                      <p className="text-[11px] text-content-muted leading-relaxed">
                                        {section.thoughtProvokingDescription}
                                      </p>
                                    )}

                                    {section.methodologicalTip && (
                                      <p className="text-[11px] text-content leading-relaxed">
                                        <strong className="text-white">Metodycznie: </strong>
                                        {section.methodologicalTip}
                                      </p>
                                    )}

                                    {/* Pytania z checkboxami i Teacher's Notes */}
                                    <div className="space-y-3 pt-2">
                                      {section.items
                                        .filter(it => it.kind === 'question' || it.kind === 'text')
                                        .map(item => {
                                          const isNoteOpen = expandedNotes[item.id] ?? false;
                                          const isEditing = editingItemId === item.id;
                                          const isSelected = selectedIds.includes(item.id);

                                          if (isEditing) {
                                            return (
                                              <div key={item.id} className="p-3 rounded-xl bg-black/60 border border-primary/50 space-y-2">
                                                <textarea
                                                  value={editingText}
                                                  onChange={e => setEditingText(e.target.value)}
                                                  rows={2}
                                                  className="w-full bg-base-100/70 border border-line-strong rounded-lg p-2 text-xs text-white outline-none focus:border-primary"
                                                />
                                                <textarea
                                                  value={editingNotes}
                                                  onChange={e => setEditingNotes(e.target.value)}
                                                  rows={3}
                                                  placeholder="Teacher's Notes (Cel, Scaffolding, Follow-up)..."
                                                  className="w-full bg-base-100/70 border border-line-strong rounded-lg p-2 text-[11px] text-purple-300 outline-none focus:border-purple-500"
                                                />
                                                <div className="flex justify-end gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={handleCancelEdit}
                                                    className="px-2.5 py-1 rounded-lg bg-white/10 text-xs text-content hover:text-white"
                                                  >
                                                    Anuluj
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => handleSaveEdit(section.id, item.id, e)}
                                                    className="px-3 py-1 rounded-lg bg-primary text-black text-xs font-bold"
                                                  >
                                                    Zapisz
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          }

                                          return (
                                            <div key={item.id} className="space-y-1.5">
                                              <div className="flex items-start justify-between gap-2 group">
                                                <div
                                                  onClick={(e) => toggleItemCheck(section.id, item.id, e)}
                                                  className="flex items-start gap-2.5 text-xs text-white font-medium cursor-pointer flex-1"
                                                >
                                                  <span className="mt-0.5 text-content-muted group-hover:text-primary shrink-0">
                                                    {item.checked ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
                                                  </span>
                                                  <span className={item.checked ? 'line-through text-content-muted' : ''}>
                                                    {item.text}
                                                  </span>
                                                </div>

                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                  <button
                                                    type="button"
                                                    onClick={() => toggleItemSelect(item.id)}
                                                    className={`p-1 rounded text-[10px] ${isSelected ? 'text-primary font-bold' : 'text-content-muted'}`}
                                                    title="Zaznacz do modyfikacji AI"
                                                  >
                                                    {isSelected ? '✓' : 'Zaznacz'}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => handleMoveItem(section.id, item.id, 'up', e)}
                                                    className="p-1 text-content-muted hover:text-white"
                                                    title="W górę"
                                                  >
                                                    <ArrowUp size={11} />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => handleMoveItem(section.id, item.id, 'down', e)}
                                                    className="p-1 text-content-muted hover:text-white"
                                                    title="W dół"
                                                  >
                                                    <ArrowDown size={11} />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => handleStartEdit(item, e)}
                                                    className="p-1 text-content-muted hover:text-primary"
                                                    title="Edytuj"
                                                  >
                                                    <Edit3 size={11} />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => handleDeleteItem(section.id, item.id, e)}
                                                    className="p-1 text-content-muted hover:text-rose-400"
                                                    title="Usuń"
                                                  >
                                                    <Trash2 size={11} />
                                                  </button>
                                                </div>
                                              </div>

                                              {/* Budka Suflera (Teacher's Notes) */}
                                              {item.notes && (
                                                <div className="pl-6">
                                                  <button
                                                    type="button"
                                                    onClick={(e) => toggleNote(item.id, e)}
                                                    className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer transition-colors"
                                                  >
                                                    {isNoteOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                                    <span>Teacher's Notes</span>
                                                  </button>

                                                  {isNoteOpen && (() => {
                                                    const parsed = parseTeacherNotes(item.notes);
                                                    return (
                                                      <div className="mt-1.5 p-3.5 rounded-xl bg-[#2b162e]/90 border border-purple-500/35 shadow-lg space-y-2 text-xs animate-fadeIn">
                                                        {parsed.goal && (
                                                          <div className="flex items-start gap-2">
                                                            <span className="text-content-muted font-bold shrink-0">• Cel:</span>
                                                            <p className="text-content">{parsed.goal}</p>
                                                          </div>
                                                        )}

                                                        {parsed.scaffolding && (
                                                          <div className="flex items-start gap-2">
                                                            <span className="text-content-muted font-bold shrink-0">• Scaffolding:</span>
                                                            <p className="text-white italic flex-1">{parsed.scaffolding}</p>
                                                            <button
                                                              type="button"
                                                              onClick={(e) => handleCopyNoteScaffolding(item.id, parsed.scaffolding!, e)}
                                                              className="p-1 text-content-muted hover:text-white"
                                                              title="Kopiuj do schowka"
                                                            >
                                                              {copiedNoteId === item.id ? <CheckCheck size={12} className="text-primary" /> : <Copy size={12} />}
                                                            </button>
                                                          </div>
                                                        )}

                                                        {parsed.followUp && (
                                                          <div className="flex items-start gap-2">
                                                            <span className="text-content-muted font-bold shrink-0">• Follow-up:</span>
                                                            <p className="text-amber-400 font-semibold">{parsed.followUp}</p>
                                                          </div>
                                                        )}
                                                      </div>
                                                    );
                                                  })()}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                    </div>
                                  </div>
                                </div>
                              ) : isPractice ? (
                                /* SEKCJA 5: PRACTICE ENCLOSURE — ĆWICZENIA INTERAKTYWNE LIVE */
                                <div className="space-y-3">
                                  <p className="text-xs text-content-muted leading-relaxed">
                                    Ćwiczenia interaktywne możesz uruchomić dla kursanta 1 kliknięciem. Kursantowi na chwilę pojawi się interaktywny quiz zamiast notatnika, a po zakończeniu płynnie wróci do notatek.
                                  </p>

                                  <div className="grid grid-cols-1 gap-2.5">
                                    {section.items
                                      .filter(it => it.kind === 'interactive' && it.exercise)
                                      .map(item => {
                                        const ex = item.exercise!;
                                        return (
                                          <div
                                            key={item.id}
                                            className="p-4 rounded-xl bg-black/40 border border-primary/30 space-y-2.5 shadow-md"
                                          >
                                            <div className="flex items-start justify-between gap-2">
                                              <div>
                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 uppercase font-bold">
                                                  {ex.type === 'quiz' || ex.type === 'interactive_quiz' ? 'Quiz jednokrotnego wyboru' : ex.type === 'sentence_scramble' ? 'Układanie zdania' : 'Polowanie na błąd'}
                                                </span>
                                                <h5 className="text-sm font-bold text-white mt-1">{ex.question}</h5>
                                              </div>

                                              <button
                                                type="button"
                                                onClick={(e) => handleLaunchExerciseLive(ex, section.title, e)}
                                                className="px-3 py-1.5 rounded-xl bg-primary text-black text-xs font-bold hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                                              >
                                                <Rocket size={12} /> Uruchom dla kursanta
                                              </button>
                                            </div>

                                            {Array.isArray(ex.options) && ex.options.length > 0 && (
                                              <div className="grid grid-cols-2 gap-1.5 pt-1">
                                                {ex.options.map((opt, oIdx) => (
                                                  <div
                                                    key={oIdx}
                                                    className={`p-2 rounded-lg text-xs font-medium border ${
                                                      ex.correctAnswer === oIdx || ex.correctAnswer === opt
                                                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                                        : 'bg-white/5 border-white/10 text-content'
                                                    }`}
                                                  >
                                                    <span className="text-content-muted font-bold mr-1.5">{oIdx + 1}.</span>
                                                    {opt}
                                                  </div>
                                                ))}
                                              </div>
                                            )}

                                            {ex.explanation && (
                                              <p className="text-[11px] text-content-muted pt-1 border-t border-white/5">
                                                💡 {ex.explanation}
                                              </p>
                                            )}
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              ) : isHomework ? (
                                /* SEKCJA 6: WRAP-UP & SUGEROWANA PRACA DOMOWA */
                                <div className="space-y-3.5">
                                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex items-center gap-2">
                                        <Sparkles size={16} className="text-amber-400" />
                                        <h5 className="text-sm font-bold text-amber-200">
                                          Sugerowana Praca Domowa (Obszar do przećwiczenia)
                                        </h5>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={handleLaunchCreateHomework}
                                        className="px-3.5 py-1.5 rounded-xl bg-amber-400 text-black font-bold text-xs hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                                      >
                                        <Edit3 size={13} /> Stwórz pracę domową ze zdań
                                      </button>
                                    </div>

                                    {section.items.map(item => (
                                      <div key={item.id} className="p-2.5 rounded-xl bg-black/40 border border-amber-500/20 space-y-1">
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="text-xs font-semibold text-white">{item.text}</p>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              type="button"
                                              onClick={(e) => handleStartEdit(item, e)}
                                              className="p-1 text-content-muted hover:text-primary"
                                            >
                                              <Edit3 size={11} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => handleDeleteItem(section.id, item.id, e)}
                                              className="p-1 text-content-muted hover:text-rose-400"
                                            >
                                              <Trash2 size={11} />
                                            </button>
                                          </div>
                                        </div>
                                        {item.notes && (
                                          <p className="text-[11px] text-amber-300/80 italic">{item.notes}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                /* INNE SEKCJE (Warm-up, Grammar, Language Focus) */
                                <div className="space-y-2">
                                  {section.items.map(item => {
                                    const isEditing = editingItemId === item.id;
                                    const isNoteOpen = expandedNotes[item.id] ?? false;

                                    if (isEditing) {
                                      return (
                                        <div key={item.id} className="p-3 rounded-xl bg-black/60 border border-primary/50 space-y-2">
                                          <textarea
                                            value={editingText}
                                            onChange={e => setEditingText(e.target.value)}
                                            rows={2}
                                            className="w-full bg-base-100/70 border border-line-strong rounded-lg p-2 text-xs text-white outline-none focus:border-primary"
                                          />
                                          <div className="flex justify-end gap-2">
                                            <button
                                              type="button"
                                              onClick={handleCancelEdit}
                                              className="px-2.5 py-1 rounded-lg bg-white/10 text-xs text-content hover:text-white"
                                            >
                                              Anuluj
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => handleSaveEdit(section.id, item.id, e)}
                                              className="px-3 py-1 rounded-lg bg-primary text-black text-xs font-bold"
                                            >
                                              Zapisz
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div key={item.id} className="p-2 rounded-xl bg-black/20 hover:bg-black/40 transition-colors group">
                                        <div className="flex items-start justify-between gap-2">
                                          <div
                                            onClick={(e) => toggleItemCheck(section.id, item.id, e)}
                                            className="flex items-start gap-2.5 text-xs text-content cursor-pointer flex-1"
                                          >
                                            <span className="mt-0.5 text-content-muted group-hover:text-primary shrink-0">
                                              {item.checked ? <CheckSquare size={13} className="text-primary" /> : <Square size={13} />}
                                            </span>
                                            <span className={item.checked ? 'line-through text-content-muted' : 'text-text-hi'}>
                                              {item.text}
                                            </span>
                                          </div>

                                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            <button
                                              type="button"
                                              onClick={(e) => handleStartEdit(item, e)}
                                              className="p-1 text-content-muted hover:text-primary cursor-pointer"
                                            >
                                              <Edit3 size={11} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => handleDeleteItem(section.id, item.id, e)}
                                              className="p-1 text-content-muted hover:text-rose-400 cursor-pointer"
                                            >
                                              <Trash2 size={11} />
                                            </button>
                                          </div>
                                        </div>

                                        {item.notes && (
                                          <div className="pl-6 pt-1">
                                            <button
                                              type="button"
                                              onClick={(e) => toggleNote(item.id, e)}
                                              className="text-[10px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                                            >
                                              {isNoteOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                              Teacher's Notes
                                            </button>
                                            {isNoteOpen && (
                                              <p className="text-[11px] text-content-muted italic bg-black/30 p-2 rounded-lg mt-1 whitespace-pre-wrap">
                                                {item.notes}
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => handleAddItem(section.id)}
                                className="w-full py-1.5 rounded-xl border border-dashed border-white/15 text-xs text-content-muted hover:text-primary hover:border-primary/40 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Plus size={12} /> Dodaj element do sekcji
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Czat interaktywny AI w Planerze ── */}
                <div className="lg:sticky lg:top-4 space-y-3">
                  <div className="rounded-2xl border border-line-strong bg-base-200/90 overflow-hidden shadow-ambient-sm flex flex-col max-h-[38rem]">
                    <header className="px-4 py-3 border-b border-line-strong bg-base-100/60 flex items-center gap-2.5">
                      <span className="p-1.5 rounded-lg bg-primary/15 text-primary border border-primary/25">
                        <MessageSquare size={14} />
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-text-hi">Asystent Scenariusza</h4>
                        <p className="text-[10px] text-content-muted truncate">
                          {selectedIds.length > 0
                            ? `Zaznaczono ${selectedIds.length} element(y)`
                            : 'Napisz, co zmienić lub dodać w scenariuszu'}
                        </p>
                      </div>
                      {selectedIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedIds([])}
                          className="ml-auto text-content-muted hover:text-text-hi cursor-pointer"
                          title="Wyczyść zaznaczenie"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </header>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[12rem]">
                      {chat.map(turn => (
                        <div
                          key={turn.id}
                          className={`rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                            turn.role === 'teacher'
                              ? 'bg-primary/15 border border-primary/30 text-white'
                              : 'bg-base-100/50 border border-line-strong text-content'
                          }`}
                        >
                          {turn.targets && turn.targets.length > 0 && (
                            <span className="block text-[9px] font-mono text-content-muted mb-1 truncate">
                              {turn.targets.join(', ')}
                            </span>
                          )}
                          {turn.text}
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>

                    <div className="p-3 border-t border-line-strong bg-base-100/40 space-y-2">
                      <textarea
                        value={chatDraft}
                        onChange={e => setChatDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRevise();
                        }}
                        rows={3}
                        placeholder="Napisz polecenie dla AI: np. „uprość pytania w sekcji 3 dla A2”, „dodaj zadanie o negocjacjach”..."
                        className="w-full bg-base-100/80 border border-line-strong rounded-xl px-3 py-2.5 text-[12px] text-text-hi outline-none focus:border-primary resize-none"
                      />
                      <button
                        type="button"
                        onClick={handleRevise}
                        disabled={Boolean(busy) || !chatDraft.trim()}
                        className="w-full px-3 py-2.5 rounded-xl bg-primary text-black text-xs font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-btn disabled:opacity-40"
                      >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                        Wprowadź zmiany przez AI
                      </button>
                    </div>
                  </div>

                  <BusyOverlay />
                  {error && (
                    <p className="text-xs font-semibold text-danger bg-danger/10 border border-danger/25 rounded-xl px-3 py-2">
                      {error}
                    </p>
                  )}
                  <CouncilStrip />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TRYB 2: CENTRUM PREZENTACJI & SLAJDÓW AI (KREATOR JAK W NOTEBOOKU)
          ═══════════════════════════════════════════════════════════════════ */}
      {studioMode === 'presentation' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Header Centrum Prezentacji */}
          <div className="p-5 rounded-3xl bg-base-200 border border-primary/35 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(114,240,180,0.25)] shrink-0">
                  <Airplay size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-text-hi">
                      Centrum Prezentacji & Slajdów AI
                    </h3>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-extrabold">
                      Live Classroom
                    </span>
                  </div>
                  <p className="text-xs text-content-muted">
                    Generuj całe lekcje w slajdach z AI, przypisuj je do kursanta lub transmituj do notatnika
                  </p>
                </div>
              </div>

              {selectedUser && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-content-muted">Przypisano do:</span>
                  <div className="px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/30 text-xs font-bold text-primary flex items-center gap-1.5">
                    <Users size={13} /> {formatStudentDisplayName(selectedUser)} ({selectedUser.level || 'B2'})
                  </div>
                </div>
              )}
            </div>

            {/* Zakładki Centrum Prezentacji */}
            <div className="flex items-center gap-1.5 bg-base-300/60 p-1.5 rounded-2xl border border-line-soft overflow-x-auto">
              <button
                type="button"
                onClick={() => setPresentationTab('ai_generator')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                  presentationTab === 'ai_generator'
                    ? 'bg-primary text-black shadow-md'
                    : 'text-content-muted hover:text-white hover:bg-white/5'
                }`}
              >
                <Sparkles size={15} /> Generator Slajdów AI (Lekcja)
              </button>
              <button
                type="button"
                onClick={() => setPresentationTab('presets')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                  presentationTab === 'presets'
                    ? 'bg-primary text-black shadow-md'
                    : 'text-content-muted hover:text-white hover:bg-white/5'
                }`}
              >
                <Layers size={15} /> Gotowe Wzorce
              </button>
              <button
                type="button"
                onClick={() => setPresentationTab('quick_paste')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                  presentationTab === 'quick_paste'
                    ? 'bg-primary text-black shadow-md'
                    : 'text-content-muted hover:text-white hover:bg-white/5'
                }`}
              >
                <Zap size={15} /> Szybki Wklejacz
              </button>
              <button
                type="button"
                onClick={() => setPresentationTab('assigned_decks')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                  presentationTab === 'assigned_decks'
                    ? 'bg-primary text-black shadow-md'
                    : 'text-content-muted hover:text-white hover:bg-white/5'
                }`}
              >
                <BookOpen size={15} /> Przypisane Prezentacje ({savedStudentDecks.length})
              </button>
            </div>

            {/* TAB 1: GENERATOR SLAJDÓW AI */}
            {presentationTab === 'ai_generator' && (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-2xl bg-primary/8 border border-primary/25 space-y-2">
                  <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Sparkles size={14} /> Podrzuć temat i materiały — odbierz kompletną lekcję w slajdach:
                  </h4>
                  <p className="text-[12px] text-content leading-relaxed">
                    Sztuczna inteligencja stworzy zrównoważoną metodycznie talię (Rozgrzewka, Etapy procesu, Fiszki 3D, Interaktywny Quiz i Wyzwanie komunikacyjne) z pełną synchronizacją dla kursanta.
                  </p>
                </div>

                {/* Szybkie tematy */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-2">
                    Wybierz gotowy temat lub wpisz własny:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_TOPICS.map((pt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setAiTopic(pt.topic);
                          setAiLevel(pt.level);
                        }}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          aiTopic === pt.topic
                            ? 'bg-primary text-black border-primary font-bold'
                            : 'bg-base-100/50 border-line text-content hover:text-white hover:border-primary/40'
                        }`}
                      >
                        {pt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                      Temat lekcji / Cel językowy *
                    </label>
                    <input
                      type="text"
                      value={aiTopic}
                      onChange={e => setAiTopic(e.target.value)}
                      placeholder="np. Business English: Cross-cultural Negotiations & Defending Price"
                      className="w-full bg-base-100/60 border border-line-strong rounded-xl px-3.5 py-2.5 text-sm text-text-hi outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                      Poziom zaawansowania (CEFR)
                    </label>
                    <select
                      value={aiLevel}
                      onChange={e => setAiLevel(e.target.value)}
                      className="w-full bg-base-100/60 border border-line-strong rounded-xl px-3.5 py-2.5 text-sm text-text-hi outline-none focus:border-primary"
                    >
                      {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lvl => (
                        <option key={lvl} value={lvl}>
                          Poziom {lvl}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                      Liczba slajdów w talii
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[3, 4, 5, 6].map(count => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setAiSlideCount(count)}
                          className={`py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            aiSlideCount === count
                              ? 'bg-primary text-black border-primary'
                              : 'bg-base-100/50 border-line text-content hover:text-white'
                          }`}
                        >
                          {count} slajdy
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                      Materiały wyjściowe / Wklejony tekst / Notatki z notatnika (opcjonalne)
                    </label>
                    <textarea
                      value={aiNotes}
                      onChange={e => setAiNotes(e.target.value)}
                      rows={3}
                      placeholder="Wklej artykuł, słówka z notatnika lub zagadnienia, na których AI ma oprzeć treść slajdów..."
                      className="w-full bg-base-100/60 border border-line-strong rounded-xl px-3.5 py-2 text-xs text-text-hi outline-none focus:border-primary resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleGenerateAiDeck}
                    disabled={isGeneratingAiDeck || !aiTopic.trim()}
                    className="px-5 py-3 rounded-2xl bg-primary text-black font-bold text-sm hover:brightness-110 transition-all flex items-center gap-2 cursor-pointer shadow-btn disabled:opacity-40"
                  >
                    {isGeneratingAiDeck ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    Generuj kompletną lekcję w slajdach (AI)
                  </button>
                </div>

                {/* Podgląd wygenerowanej talii */}
                {generatedDeck && (
                  <div className="p-5 rounded-3xl bg-black/40 border border-primary/40 space-y-4 animate-fadeIn">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                      <div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 uppercase font-bold">
                          Wygenerowano {generatedDeck.slides.length} slajdów
                        </span>
                        <h4 className="text-base font-bold text-white mt-1">
                          {generatedDeck.deckTitle || aiTopic}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveAndAssignDeck(generatedDeck)}
                          className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Save size={13} /> Zapisz dla kursanta
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBroadcastDeckToScratchpad(generatedDeck)}
                          className="px-4 py-2 rounded-xl bg-primary text-black font-bold text-xs hover:brightness-110 flex items-center gap-1.5 cursor-pointer shadow-btn"
                        >
                          <Rocket size={13} /> Transmituj do notatnika kursanta
                        </button>
                      </div>
                    </div>

                    {/* Slajdy w miniaturkach */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                      {generatedDeck.slides.map((s, idx) => (
                        <div
                          key={idx}
                          onClick={() => setPreviewSlideIdx(idx)}
                          className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                            previewSlideIdx === idx
                              ? 'bg-primary/15 border-primary text-white'
                              : 'bg-base-100/40 border-line text-content hover:border-primary/40'
                          }`}
                        >
                          <span className="text-[10px] font-mono opacity-60 block">Slajd {idx + 1} • {s.type}</span>
                          <strong className="text-xs font-bold block truncate mt-0.5">{s.title || s.question}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: GOTOWE WZORCE */}
            {presentationTab === 'presets' && (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-content-muted">
                  Wybierz interaktywną aktywność, aby natychmiast uruchomić ją dla kursanta:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {PRESET_ACTIVITIES.map((act, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-base-100/50 border border-line-strong hover:border-primary/50 transition-all space-y-2.5 flex flex-col justify-between"
                    >
                      <div>
                        <h4 className="text-sm font-bold text-white">{act.title}</h4>
                        {act.question && (
                          <p className="text-xs text-purple-300 italic mt-1">„{act.question}”</p>
                        )}
                        {act.prompt && (
                          <p className="text-[11px] text-content-muted mt-1">{act.prompt}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <span className="text-[10px] font-mono text-content-muted">{act.type}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedUser?.id) {
                              updateScratchpadPresentation(`sp_${selectedUser.id}`, {
                                active: true,
                                ...act,
                              });
                              setLaunchFeedback(`🚀 Uruchomiono "${act.title}" w notatniku kursanta!`);
                              setTimeout(() => setLaunchFeedback(null), 4000);
                            } else {
                              setLaunchFeedback('Wybierz kursanta w nagłówku, aby uruchomić wzorzec na żywo.');
                              setTimeout(() => setLaunchFeedback(null), 4000);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-primary text-black font-bold text-xs hover:brightness-110 flex items-center gap-1 cursor-pointer"
                        >
                          <Rocket size={11} /> Uruchom na żywo
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: SZYBKI WKLEJACZ */}
            {presentationTab === 'quick_paste' && (
              <div className="space-y-3.5 pt-2">
                <p className="text-xs text-content-muted">
                  Wklej surowe notatki lub słówka z lekcji — automatycznie przekształcimy je w fiszki 3D lub etapy procesu:
                </p>

                <div className="flex gap-2">
                  {[
                    ['discussion', 'Pytanie dyskusyjne'],
                    ['flip_cards', 'Fiszki 3D (Słówka)'],
                    ['process', 'Kroki procesu'],
                  ].map(([type, label]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setQuickPasteType(type as any)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        quickPasteType === type
                          ? 'bg-primary text-black border-primary'
                          : 'bg-base-100/50 border-line text-content hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={quickPasteText}
                  onChange={e => setQuickPasteText(e.target.value)}
                  rows={5}
                  placeholder={
                    quickPasteType === 'flip_cards'
                      ? 'Wklej listę słówek (np. "leverage synergy - połączyć siły\ndouble-edged sword - broń obosieczna")'
                      : 'Wklej tekst lub pytania do omówienia...'
                  }
                  className="w-full bg-base-100/60 border border-line-strong rounded-2xl p-3.5 text-xs text-text-hi outline-none focus:border-primary"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!quickPasteText.trim()) return;
                      if (!selectedUser?.id) {
                        setLaunchFeedback('Wybierz kursanta w nagłówku, aby uruchomić prezentację.');
                        setTimeout(() => setLaunchFeedback(null), 4000);
                        return;
                      }

                      if (quickPasteType === 'flip_cards') {
                        const lines = quickPasteText.split('\n').filter(Boolean);
                        const cards: FlipCardItem[] = lines.map((l) => {
                          if (l.includes(' - ') || l.includes(' – ') || l.includes(':')) {
                            const parts = l.split(/\s*[-–:]\s*/);
                            return {
                              term: parts[0].trim(),
                              definition: parts.slice(1).join(' – ').trim(),
                              example: `We should consider ${parts[0].trim().toLowerCase()} in our daily communication.`,
                            };
                          }
                          return {
                            term: l.trim(),
                            definition: 'Kluczowe pojęcie do omówienia',
                            example: `Let's discuss how "${l.trim()}" applies to our context.`,
                          };
                        });

                        updateScratchpadPresentation(`sp_${selectedUser.id}`, {
                          active: true,
                          title: '🎴 Interaktywne Fiszki Słówek',
                          type: 'flip_cards',
                          question: 'Obracaj karty, aby przećwiczyć nowe słownictwo.',
                          prompt: 'Dotknij karty, aby sprawdzić polskie znaczenie i zdanie przykładowe.',
                          cards: cards.slice(0, 8),
                          hints: ['Repeat after the teacher...', 'Make your own sentence...'],
                        });
                        setLaunchFeedback('🚀 Fiszki zostały uruchomione w notatniku kursanta!');
                        setTimeout(() => setLaunchFeedback(null), 4000);
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-primary text-black font-bold text-xs hover:brightness-110 flex items-center gap-1.5 cursor-pointer shadow-btn"
                  >
                    <Zap size={14} /> Konwertuj i uruchom dla kursanta
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: PRZYPISANE PREZENTACJE DLA KURSANTA */}
            {presentationTab === 'assigned_decks' && (
              <div className="space-y-3.5 pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-content-muted">
                    Prezentacje przypisane do tego kursanta, widoczne również w jego notatniku:
                  </p>
                  <button
                    type="button"
                    onClick={refreshStudentPresentations}
                    className="px-2.5 py-1 rounded-lg bg-white/5 border border-line text-[11px] font-bold text-content hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={11} /> Odśwież
                  </button>
                </div>

                {isLoadingSavedDecks ? (
                  <div className="py-8 text-center text-xs text-content-muted">Wczytuję zapisane prezentacje...</div>
                ) : savedStudentDecks.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-dashed border-line text-center space-y-2">
                    <Airplay size={24} className="mx-auto text-content-muted opacity-40" />
                    <p className="text-xs text-content-muted">
                      Brak przypisanych prezentacji dla tego profilu. Wygeneruj lub zapisz pierwszą w Generatorze Slajdów!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {savedStudentDecks.map(deck => (
                      <div
                        key={deck.id}
                        className="p-4 rounded-2xl bg-base-100/60 border border-line-strong hover:border-primary/50 transition-all space-y-3 flex flex-col justify-between shadow-sm"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-bold">
                              {deck.targetLevel || 'B2'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSavedDeck(deck.id, e)}
                              className="p-1 text-content-muted hover:text-rose-400 cursor-pointer"
                              title="Usuń prezentację"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <h4 className="text-sm font-bold text-white">{deck.title}</h4>
                          <p className="text-[11px] text-content-muted line-clamp-2">{deck.topic}</p>
                          <span className="text-[10px] text-content-muted font-mono block">
                            Slajdów: {deck.slides?.length || 0}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-white/5 space-y-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              if (selectedUser?.id && deck.slides?.length > 0) {
                                await updateScratchpadPresentation(`sp_${selectedUser.id}`, {
                                  active: true,
                                  title: deck.title,
                                  type: deck.slides[0].type as any,
                                  question: deck.slides[0].title,
                                  prompt: deck.slides[0].subtitle,
                                  slideIndex: 0,
                                  totalSlides: deck.slides.length,
                                  slides: deck.slides as any,
                                });
                                setLaunchFeedback(`🚀 Uruchomiono "${deck.title}" w notatniku kursanta!`);
                                setTimeout(() => setLaunchFeedback(null), 4000);
                              }
                            }}
                            className="w-full py-1.5 rounded-xl bg-primary text-black font-bold text-xs hover:brightness-110 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Rocket size={11} /> Transmituj do notatnika
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonPlannerStudio;
