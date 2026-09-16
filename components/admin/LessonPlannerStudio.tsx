import React, { useMemo, useRef, useState, useEffect } from 'react';
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
} from '../../services/presentationService';
import { LessonPresentationView } from './presentation/LessonPresentationView';
import { formatAIModelName } from '../../services/geminiService';
import { extractLessonBlocks } from '../../utils/lessonBlocks';

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

interface LessonPlannerStudioProps {
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

const KIND_LABEL: Record<PlanItemKind, string> = {
  question: 'Pytanie',
  text: 'Tekst',
  vocab: 'Słownictwo',
  correction: 'Korekta',
  task: 'Zadanie',
  answerKey: 'Klucz',
  note: 'Notatka',
  topic_material: 'Cel lekcji',
  lead_in: 'Lead-in',
  thought_provoking_questions: 'Pytania rozwijające (Safety Bank)',
  interactive: 'Ćwiczenie live',
};

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
}) => {
  const [step, setStep] = useState<'brief' | 'topics' | 'plan'>('brief');

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [brief, setBrief] = useState<LessonBrief>({
    mode: '1:1',
    audience: selectedUser?.firstName
      ? `${selectedUser.firstName} ${selectedUser.lastName || ''}`.trim()
      : selectedUser?.username || '',
    date: todayStr,
    level: selectedUser?.level || 'B2',
    grammarTopic: '',
    sourceMaterial: '',
    history: '',
    notes: '',
  });
  const [showOptional, setShowOptional] = useState(false);

  const [attachments, setAttachments] = useState<LessonAttachment[]>([]);
  const [suggestion, setSuggestion] = useState('');
  const [variantCount, setVariantCount] = useState(3);
  const [variants, setVariants] = useState<TopicVariant[]>([]);
  const [chosenVariant, setChosenVariant] = useState<TopicVariant | null>(null);

  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Accordion collapsed state per section (section 3 open by default)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    warmup: true,
    grammar: true,
    maintopic: false,
    focus: true,
    practice: false,
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

  const [transcript, setTranscript] = useState<CouncilEvent[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [savedScenarioId, setSavedScenarioId] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync user change into brief
  useEffect(() => {
    if (selectedUser) {
      setBrief(prev => ({
        ...prev,
        audience: selectedUser.firstName
          ? `${selectedUser.firstName} ${selectedUser.lastName || ''}`.trim()
          : selectedUser.username,
        level: selectedUser.level || prev.level,
      }));
    }
  }, [selectedUser]);

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
      text: kind === 'question' ? 'Nowe pytanie dyskusyjne...' : 'Nowa treść...',
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
          exercise.type === 'quiz'
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
    if (scenario.planJson) {
      try {
        const parsed = JSON.parse(scenario.planJson);
        setPlan(parsed);
      } catch {
        // Fallback to basic structure
        setPlan({
          title: scenario.title,
          summary: scenario.topic,
          format: scenario.format,
          goal: scenario.goal,
          sourceMaterialDescription: scenario.sourceMaterialDescription,
          sections: [],
        });
      }
    }
    setSavedScenarioId(scenario.id);
    setIsLibraryOpen(false);
    setStep('plan');
  };

  const handleDeleteScenario = async (scenarioId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Czy na pewno chcesz usunąć ten scenariusz z bazy?')) return;
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
      const sName = selectedUser?.firstName
        ? `${selectedUser.firstName} ${selectedUser.lastName || ''}`.trim()
        : brief.audience;

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
        },
        selectedUser?.id,
        sName
      );

      await savePresentationToStorage(pres);
      setShowPresentationView(true);
    } catch (err) {
      console.error('Błąd generowania prezentacji:', err);
      setShowPresentationView(true);
    }
  };

  const historyDigest = useMemo(() => {
    const forStudent = selectedUser
      ? recentLessons.filter(record => record.studentId === selectedUser.id)
      : recentLessons;
    return forStudent
      .slice(0, 3)
      .map((record, index) => {
        const blocks = extractLessonBlocks(record);
        const parts = [
          `--- ${index === 0 ? 'OSTATNIA LEKCJA' : `Lekcja -${index}`} (${record.date || 'brak daty'}): ${record.topic || 'bez tematu'}`,
          blocks.summary ? `Przebieg: ${blocks.summary.slice(0, 400)}` : '',
          blocks.vocabulary ? `Słownictwo: ${blocks.vocabulary.slice(0, 500)}` : '',
          blocks.corrections ? `Korekty: ${blocks.corrections.slice(0, 300)}` : '',
        ];
        return parts.filter(Boolean).join('\n');
      })
      .join('\n\n');
  }, [recentLessons, selectedUser]);

  const fullBrief = (): LessonBrief => {
    const attachmentDigest = attachments
      .map(att => {
        const title = (att as any).fileName || att.name || 'Załącznik';
        const body = att.textContent ? att.textContent.slice(0, 2000) : '';
        return `[${title}]\n${body}`.trim();
      })
      .filter(Boolean)
      .join('\n\n');

    const combinedSource = [attachmentDigest, brief.sourceMaterial?.trim()]
      .filter(Boolean)
      .join('\n\n');

    return {
      ...brief,
      sourceMaterial: combinedSource || undefined,
      history: brief.history?.trim() || historyDigest || undefined,
    };
  };

  const ask = async <T,>(prompt: string, busyLabel: string, isJson: boolean = true): Promise<T> => {
    setBusy(busyLabel);
    setError('');
    try {
      const councilConfig = peekCouncil() ?? (await getAiConfig()).council ?? DEFAULT_COUNCIL;
      const result = await runCouncil<T>({
        config: councilConfig,
        systemInstruction: CRIBRO_METHOD_SYSTEM,
        prompt,
        expectJson: isJson,
      });
      setTranscript(result.transcript);
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
        `Szukam ${variantCount} ${variantCount === 1 ? 'wariantu' : 'wariantów'} tematu…`
      );
      const list = Array.isArray(data?.variants) ? data.variants.filter(v => v?.title) : [];
      if (list.length === 0) throw new Error('Model nie zaproponował żadnego tematu. Spróbuj ponownie.');
      setVariants(list);
      setStep('topics');
    } catch (err: any) {
      setError(err?.message || 'Nie udało się przygotować propozycji tematu.');
    }
  };

  const handleBuildScenario = async (variant: TopicVariant) => {
    setChosenVariant(variant);
    try {
      const data = await ask<LessonPlan>(
        buildScenarioPrompt(fullBrief(), variant),
        'Układam scenariusz według metody Cribro…'
      );
      if (!data?.sections?.length) throw new Error('Model zwrócił scenariusz bez sekcji. Spróbuj ponownie.');
      setPlan(data);
      setSelectedIds([]);
      setChat([
        {
          id: `turn-${Date.now()}`,
          role: 'planner',
          text: `Scenariusz lekcji gotowy! Możesz edytować dowolny element w locie, usuwać, przestawiać lub napisać w czacie co mam poprawić.`,
        },
      ]);
      setSavedScenarioId('');
      setStep('plan');
    } catch (err: any) {
      setError(err?.message || 'Nie udało się ułożyć scenariusza.');
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

          // Add newly created items for this section if any
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

  /* ═══ KROK 1 — USTALENIA ═══ */
  if (step === 'brief') {
    return (
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
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                Kursant / Grupa
              </label>
              <input
                type="text"
                value={brief.audience}
                onChange={e => setBrief(prev => ({ ...prev, audience: e.target.value }))}
                placeholder="np. Tomasz, Grupa DSV B2..."
                className="w-full bg-base-100/60 border border-line-strong rounded-xl px-3.5 py-2.5 text-sm text-text-hi outline-none focus:border-primary font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                Poziom CEFR
              </label>
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
                  className="p-1.5 rounded-lg text-content-muted hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLibraryFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      libraryFilter === 'student'
                        ? 'bg-primary text-black'
                        : 'bg-white/5 text-content-muted hover:text-white'
                    }`}
                  >
                    Dla: {selectedUser.firstName || selectedUser.username}
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
                              className="p-1.5 text-content-muted hover:text-rose-400"
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
    );
  }

  /* ═══ KROK 2 — WARIANTY TEMATU ═══ */
  if (step === 'topics') {
    return (
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
          <strong>{brief.audience}</strong> na {brief.date}. Wybierz jedną — ułożę z niej pełny scenariusz.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {variants.map((variant, index) => (
            <button
              key={`${variant.title}-${index}`}
              type="button"
              onClick={() => handleBuildScenario(variant)}
              disabled={Boolean(busy)}
              className="text-left rounded-2xl border border-line-strong bg-base-200/60 p-4 space-y-2.5 hover:border-primary/50 transition-colors cursor-pointer disabled:opacity-50 shadow-ambient-sm"
            >
              <h4 className="text-sm font-bold text-text-hi">{variant.title}</h4>
              {variant.angle && (
                <p className="text-[11px] text-content-muted leading-relaxed">{variant.angle}</p>
              )}
              {variant.sampleQuestion && (
                <p className="text-[11px] text-primary italic leading-relaxed border-l-2 border-primary/30 pl-2.5">
                  „{variant.sampleQuestion}"
                </p>
              )}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {variant.material && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-line-soft border border-line text-content-muted">
                    {variant.material}
                  </span>
                )}
              </div>
              {variant.why && (
                <p className="text-[10px] text-content-muted leading-relaxed pt-1 border-t border-line">
                  {variant.why}
                </p>
              )}
            </button>
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
    );
  }

  /* ═══ KROK 3 — SCENARIUSZ ZE ZRZUTÓW EKRANU ═══ */
  return (
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

      {launchFeedback && (
        <div className="p-3 rounded-xl bg-primary/15 border border-primary/40 text-primary text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <Sparkles size={14} />
          <span>{launchFeedback}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-4 items-start">
        {/* ── Główny widok Scenariusza ── */}
        <div className="space-y-4 min-w-0">
          {/* KARTA WSTĘPNA LEKCJI — Format, Cel, Materiał źródłowy (Zrzut ekranu 1) */}
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
                {plan?.sourceMaterialDescription || chosenVariant?.material || 'ESL Conversation Questions. Zachowujemy konwersacyjny format pytań o pracę.'}
              </span>
            </div>
          </div>

          {/* 6 ZWIJANYCH SEKCJI AKORDEONU (Zrzuty ekranu 1 i 2) */}
          <div className="space-y-2.5">
            {plan?.sections.map((section, sIndex) => {
              const isCollapsed = collapsedSections[section.id] ?? false;
              const isMainTopic = section.id === 'maintopic' || section.id === 'main-topic' || sIndex === 2;
              const isPractice = section.id === 'practice' || section.id === 'practice-enclosure' || sIndex === 4;

              return (
                <div
                  key={section.id}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    !isCollapsed && isMainTopic
                      ? 'border-primary/50 ring-2 ring-primary/40 bg-base-200/90 shadow-xl'
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
                      <h4 className="text-sm font-bold text-white truncate">
                        {section.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddItem(section.id);
                        }}
                        className="p-1 rounded-lg text-content-muted hover:text-primary hover:bg-white/5 transition-colors"
                        title="Dodaj punkt do sekcji"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </header>

                  {/* Zawartość sekcji po rozwinięciu */}
                  {!isCollapsed && (
                    <div className="p-4 pt-1 space-y-4 border-t border-white/5">
                      {/* Sub-bloki dla Main Topic: Topic and Material, Lead-in, Thought-Provoking Questions */}
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
                              Thought-Provoking Questions
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
                                          {ex.type === 'quiz' ? 'Quiz jednokrotnego wyboru' : ex.type === 'sentence_scramble' ? 'Układanie zdania' : 'Polowanie na błąd'}
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
                      ) : (
                        /* INNE STANDARDOWE SEKCJE (Warm-up, Grammar, Language Focus, Extra Tasks) */
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
                                  <div className="pl-6 pt-1">
                                    <button
                                      type="button"
                                      onClick={(e) => toggleNote(item.id, e)}
                                      className="text-[10px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1"
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
                placeholder="Napisz polecenie dla AI: np. „uprość pytania w sekcji 3 dla A2”, „dodaj zadanie o wózkach widłowych”..."
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
  );
};

export default LessonPlannerStudio;
