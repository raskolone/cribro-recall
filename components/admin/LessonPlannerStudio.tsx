import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  MessageSquare,
  Save,
  Sparkles,
  Users,
  Wand2,
  X,
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
} from '../../services/lessonPlannerMethod';
import { CouncilEvent, DEFAULT_COUNCIL, runCouncil } from '../../services/aiCouncil';
import { getAiConfig, peekCouncil } from '../../services/aiConfigService';
import { saveGeneratedScenario } from '../../services/scenarioService';
import { formatAIModelName } from '../../services/geminiService';
import { extractLessonBlocks } from '../../utils/lessonBlocks';

/**
 * PLANER LEKCJI — potężne narzędzie w prostej obudowie.
 *
 * ══ CO BYŁO NIE TAK ══
 *
 * Poprzedni planer pokazywał CAŁY swój mechanizm na wejściu: konfigurację
 * modułów lekcji, presety, ustawienia metodyki, wybór odmiany angielskiego,
 * liczbę słówek, styl wyjaśnień, załączniki, wybór scenariusza bazowego
 * i okno czatu — wszystko naraz, zanim padło pierwsze pytanie o to, czego
 * lekcja ma dotyczyć. Narzędzie było mocne, ale jego obudowa wyglądała jak
 * panel sterowania, a nie jak miejsce, w którym układa się lekcję.
 *
 * ══ CO JEST TERAZ ══
 *
 * TRZY KROKI, JEDEN NA EKRAN, i nic poza tym, co w danym kroku potrzebne:
 *
 *   1. USTALENIA — pięć pól, które i tak trzeba podać (bramka Kroku 0
 *      z metody Cribro: tryb, kursant, data). Reszta jest opcjonalna
 *      i zwinięta.
 *   2. TEMAT — AI pyta o sugestie i o to, ile wariantów przygotować,
 *      dokładnie tak, jak robi to człowiek, któremu zlecono lekcję.
 *      Warianty przychodzą jako karty do wyboru, nie jako ściana tekstu.
 *   3. SCENARIUSZ — gotowa lekcja w sekcjach. Każdy element da się
 *      ZAZNACZYĆ i kazać go przerobić w czacie.
 *
 * Mózg — narada modeli, wytyczne metody, kaskady zapasowe — siedzi pod
 * jednym zwiniętym paskiem na dole. Jest dostępny, kiedy coś pójdzie nie
 * tak, i nie zabiera miejsca, kiedy wszystko idzie dobrze.
 *
 * ══ DLACZEGO SCENARIUSZ TO SEKCJE I ELEMENTY, A NIE TEKST ══
 *
 * Bo lektor ma móc wskazać JEDNO pytanie i kazać je poprawić. W jednym
 * bloku markdown nie da się niczego wskazać — element musi mieć własny
 * identyfikator już w chwili powstania, więc model dostaje go do nadania
 * razem z treścią.
 */

interface UserWithId extends User {
  id: string;
}

interface PlanItem {
  id: string;
  kind: 'question' | 'text' | 'vocab' | 'correction' | 'task' | 'answerKey' | 'note';
  text: string;
  notes?: string;
}

interface PlanSection {
  id: string;
  title: string;
  minutes?: string;
  items: PlanItem[];
}

interface LessonPlan {
  title: string;
  summary: string;
  sections: PlanSection[];
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
  /** Identyfikatory, których dotyczyła prośba — pokazywane przy wpisie. */
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

const KIND_LABEL: Record<PlanItem['kind'], string> = {
  question: 'Pytanie',
  text: 'Tekst',
  vocab: 'Słownictwo',
  correction: 'Korekta',
  task: 'Zadanie',
  answerKey: 'Klucz',
  note: 'Notatka',
};

/** Zamiana planu na markdown — format, w którym scenariusze już są zapisywane. */
const planToMarkdown = (plan: LessonPlan): string => {
  const lines: string[] = [`# ${plan.title}`, ''];
  if (plan.summary) lines.push(plan.summary, '');

  for (const section of plan.sections) {
    lines.push(`## ${section.title}`, '');
    if (section.items.length === 0) {
      lines.push('_Sekcja celowo pusta._', '');
      continue;
    }
    for (const item of section.items) {
      if (item.kind === 'question') {
        lines.push(`- [ ] ${item.text}`);
        if (item.notes) lines.push('', `  > **Teacher's Notes:** ${item.notes}`, '');
      } else if (item.kind === 'vocab' || item.kind === 'correction') {
        lines.push(`- ${item.text}`);
      } else if (item.kind === 'answerKey') {
        lines.push('', '**Answer Key**', '', '```markdown', item.text, '```', '');
      } else if (item.kind === 'task') {
        lines.push('', '```markdown', item.text, '```', '');
      } else {
        lines.push(item.text, '');
      }
    }
    lines.push('');
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

/** Słownictwo z planu — do wstawienia w notatkę z lekcji. */
const planVocabulary = (plan: LessonPlan): string =>
  plan.sections
    .flatMap(section => section.items)
    .filter(item => item.kind === 'vocab')
    .map(item => item.text)
    .join('\n');

const LessonPlannerStudio: React.FC<LessonPlannerStudioProps> = ({
  selectedUser,
  users,
  onSelectUser,
  recentLessons = [],
  onInsertLessonRecord,
  onOpenInPresentation,
}) => {
  const [step, setStep] = useState<'brief' | 'topics' | 'plan'>('brief');

  const [brief, setBrief] = useState<LessonBrief>({
    mode: '1:1',
    audience: selectedUser
      ? `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.username
      : '',
    date: new Date().toISOString().split('T')[0],
    level: selectedUser?.level || 'B2',
    grammarTopic: '',
    sourceMaterial: '',
    notes: '',
  });
  const [showOptional, setShowOptional] = useState(false);

  /*
   * Załączniki. Metoda Cribro sprawdza materiał źródłowy w KOLEJNOŚCI:
   * najpierw załączony plik, dopiero potem opis słowny, a na końcu — gdy nie
   * ma ani jednego — propozycje AI. Bez wczytywania plików planer pomijał
   * pierwszy z tych trzech przypadków i kazał wklejać artykuł ręcznie.
   */
  const [attachments, setAttachments] = useState<LessonAttachment[]>([]);

  const [suggestion, setSuggestion] = useState('');
  const [variantCount, setVariantCount] = useState(3);
  const [variants, setVariants] = useState<TopicVariant[]>([]);
  const [chosenVariant, setChosenVariant] = useState<TopicVariant | null>(null);

  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [chatDraft, setChatDraft] = useState('');

  const [transcript, setTranscript] = useState<CouncilEvent[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [savedScenarioId, setSavedScenarioId] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  /*
   * Historia lekcji jest podstawą Revision Translation, ale model nie
   * potrzebuje dwudziestu lekcji wstecz — metoda mówi wprost, że powtórka
   * idzie WYŁĄCZNIE z ostatnich zajęć. Trzy wpisy dają jeszcze kontekst
   * wcześniejszych wątków i nie zalewają promptu.
   */
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

  /**
   * Materiał źródłowy w kolejności wymaganej przez metodę: treść załączonych
   * plików przed opisem słownym. Pliki bez odczytanego tekstu (obrazy, PDF-y
   * bez warstwy tekstowej) są WYMIENIANE z nazwy zamiast pomijane — inaczej
   * lektor widzi załącznik na liście i nie wie, że model go nie przeczytał.
   */
  const materialForPrompt = (): string => {
    const parts: string[] = [];

    const withText = attachments.filter(a => a.textContent?.trim());
    for (const file of withText) {
      parts.push(`--- ZAŁĄCZNIK: ${file.name} ---\n${file.textContent!.trim()}`);
    }

    const withoutText = attachments.filter(a => !a.textContent?.trim());
    if (withoutText.length > 0) {
      parts.push(
        `--- ZAŁĄCZNIKI BEZ ODCZYTANEJ TREŚCI (nie znasz ich zawartości, nie zgaduj jej): ${withoutText
          .map(f => f.name)
          .join(', ')} ---`
      );
    }

    if (brief.sourceMaterial?.trim()) parts.push(brief.sourceMaterial.trim());
    return parts.join('\n\n');
  };

  const fullBrief = (): LessonBrief => ({
    ...brief,
    sourceMaterial: materialForPrompt(),
    history: historyDigest,
  });

  /** Jedno wejście do narady — wszystkie trzy kroki wołają to samo. */
  const ask = async <T,>(prompt: string, phase: string): Promise<T> => {
    setBusy(phase);
    setError('');
    setTranscript([]);
    try {
      await getAiConfig();
      const council = peekCouncil() || DEFAULT_COUNCIL;
      const result = await runCouncil<T>({
        config: council,
        systemInstruction: CRIBRO_METHOD_SYSTEM,
        prompt,
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
      setError(`Zanim planer ruszy, uzupełnij: ${missing.join(', ')}.`);
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
          text: `Scenariusz gotowy. Zaznacz elementy, które mam przerobić, i napisz, co z nimi zrobić.`,
        },
      ]);
      setSavedScenarioId('');
      setStep('plan');
    } catch (err: any) {
      setError(err?.message || 'Nie udało się ułożyć scenariusza.');
    }
  };

  const toggleItem = (id: string) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const toggleSection = (section: PlanSection) => {
    const ids = section.items.map(item => item.id);
    const allSelected = ids.length > 0 && ids.every(id => selectedIds.includes(id));
    setSelectedIds(prev =>
      allSelected ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))
    );
  };

  const handleRevise = async () => {
    const instruction = chatDraft.trim();
    if (!instruction || !plan) return;
    if (selectedIds.length === 0) {
      setError('Zaznacz najpierw elementy, których ma dotyczyć poprawka.');
      return;
    }

    const targets = [...selectedIds];
    setChat(prev => [
      ...prev,
      { id: `turn-${Date.now()}`, role: 'teacher', text: instruction, targets },
    ]);
    setChatDraft('');

    try {
      const data = await ask<{ updates: { id: string; text: string; notes?: string }[]; comment?: string }>(
        buildRevisionPrompt(fullBrief(), JSON.stringify(plan), targets, instruction),
        `Przerabiam ${targets.length} ${targets.length === 1 ? 'element' : 'elementy'}…`
      );

      const updates = Array.isArray(data?.updates) ? data.updates : [];
      /*
       * Wstawiamy WYŁĄCZNIE elementy o zaznaczonych identyfikatorach.
       * Model bywa nadgorliwy i dorzuca poprawki do rzeczy, o które nikt
       * nie prosił — a lektor już je zaakceptował i nie ma powodu ich
       * tracić przy okazji poprawiania czegoś innego.
       */
      const allowed = new Set(targets);
      const applied = updates.filter(update => allowed.has(update.id));

      setPlan(prev =>
        prev
          ? {
              ...prev,
              sections: prev.sections.map(section => ({
                ...section,
                items: section.items.map(item => {
                  const update = applied.find(u => u.id === item.id);
                  return update
                    ? { ...item, text: update.text ?? item.text, notes: update.notes ?? item.notes }
                    : item;
                }),
              })),
            }
          : prev
      );

      const ignored = updates.length - applied.length;
      setChat(prev => [
        ...prev,
        {
          id: `turn-${Date.now()}-r`,
          role: 'planner',
          text:
            applied.length === 0
              ? 'Nie dostałem poprawki do żadnego z zaznaczonych elementów. Spróbuj napisać dokładniej, co ma się zmienić.'
              : `${data?.comment || 'Gotowe.'} Zmieniono ${applied.length} ${
                  applied.length === 1 ? 'element' : 'elementy'
                }.${ignored > 0 ? ` Pominięto ${ignored} zmian poza zaznaczeniem.` : ''}`,
        },
      ]);
      setSelectedIds([]);
      setSavedScenarioId('');
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    } catch (err: any) {
      setError(err?.message || 'Nie udało się nanieść poprawki.');
    }
  };

  const handleSave = async () => {
    if (!plan) return;
    setBusy('Zapisuję scenariusz…');
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
      });
      setSavedScenarioId(saved.id);
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

  /* ── Wspólne kawałki obudowy ── */

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
      <div className="rounded-xl border border-primary/30 bg-primary/8 px-4 py-3 flex items-center gap-2.5">
        <Loader2 size={16} className="text-primary animate-spin shrink-0" />
        <span className="text-sm font-semibold text-text-hi">{busy}</span>
      </div>
    ) : null;

  /* ── Pasek narady: mózg narzędzia, domyślnie zwinięty ── */
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
          <div className="px-3.5 pb-3.5 space-y-2.5 border-t border-line pt-3">
            {transcript.map((event, index) => (
              <div key={`${event.seatId}-${index}`} className="text-[11px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-text-hi">{formatAIModelName(event.model)}</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-line-soft border border-line text-content-muted font-mono">
                    {event.phase === 'draft'
                      ? 'pisze'
                      : event.phase === 'review'
                      ? 'recenzuje'
                      : 'poprawia'}
                  </span>
                  <span className="text-content-muted font-mono">{event.seconds.toFixed(1)} s</span>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-content-muted leading-relaxed max-h-40 overflow-y-auto">
                  {event.phase === 'review' ? event.text : `${event.text.slice(0, 600)}…`}
                </pre>
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
        <StepBar />

        <div className="rounded-2xl border border-line-strong bg-base-200/60 p-5 space-y-4 shadow-ambient-sm">
          <div>
            <h3 className="text-base font-bold text-text-hi">Ustalenia</h3>
            <p className="text-[11px] text-content-muted mt-0.5">
              Trzy rzeczy, bez których planer nie rusza. Resztę dopowiesz albo zostawisz AI.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                Tryb
              </span>
              <div className="flex gap-1.5">
                {(['1:1', 'grupa'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setBrief(prev => ({ ...prev, mode }))}
                    className={`flex-1 px-3 py-2.5 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${
                      brief.mode === mode
                        ? 'border-primary/60 bg-primary/12 text-primary'
                        : 'border-line-strong bg-base-100/40 text-content-muted hover:border-primary/35'
                    }`}
                  >
                    {mode === '1:1' ? 'Lekcja 1:1' : 'Grupa 2–4'}
                  </button>
                ))}
              </div>
            </label>

            <label className="block">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                {brief.mode === 'grupa' ? 'Nazwa grupy' : 'Kursant'}
              </span>
              {brief.mode === '1:1' ? (
                <select
                  value={selectedUser?.id || ''}
                  onChange={e => {
                    const picked = users.find(u => u.id === e.target.value) || null;
                    onSelectUser?.(picked);
                    if (picked) {
                      setBrief(prev => ({
                        ...prev,
                        audience:
                          `${picked.firstName || ''} ${picked.lastName || ''}`.trim() || picked.username,
                        level: picked.level || prev.level,
                      }));
                    }
                  }}
                  className="w-full bg-base-100/50 border border-line-strong rounded-xl px-3 py-2.5 text-sm text-text-hi outline-none focus:border-primary cursor-pointer"
                >
                  <option value="">Wybierz kursanta…</option>
                  {users
                    .filter(u => u.role !== 'admin')
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username}
                      </option>
                    ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={brief.audience}
                  onChange={e => setBrief(prev => ({ ...prev, audience: e.target.value }))}
                  placeholder="np. Grupa środowa B1"
                  className="w-full bg-base-100/50 border border-line-strong rounded-xl px-3 py-2.5 text-sm text-text-hi outline-none focus:border-primary"
                />
              )}
            </label>

            <label className="block">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                Data lekcji
              </span>
              <input
                type="date"
                value={brief.date}
                onChange={e => setBrief(prev => ({ ...prev, date: e.target.value }))}
                className="w-full bg-base-100/50 border border-line-strong rounded-xl px-3 py-2.5 text-sm text-text-hi outline-none focus:border-primary"
              />
            </label>

            <label className="block">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                Poziom
              </span>
              <select
                value={brief.level}
                onChange={e => setBrief(prev => ({ ...prev, level: e.target.value }))}
                className="w-full bg-base-100/50 border border-line-strong rounded-xl px-3 py-2.5 text-sm text-text-hi outline-none focus:border-primary cursor-pointer"
              >
                {['A1', 'A2', 'B1', 'B1+', 'B2', 'B2+', 'C1'].map(level => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Rzadziej używane — zwinięte, bo w większości lekcji zostaje puste. */}
          <button
            type="button"
            onClick={() => setShowOptional(prev => !prev)}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-content-muted hover:text-text-hi transition-colors cursor-pointer"
          >
            <ChevronDown size={13} className={showOptional ? 'rotate-180' : ''} />
            Gramatyka i materiał źródłowy
          </button>

          {showOptional && (
            <div className="space-y-3 pt-1">
              <label className="block">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                  Temat gramatyczny — puste znaczy „sama rozmowa"
                </span>
                <input
                  type="text"
                  value={brief.grammarTopic}
                  onChange={e => setBrief(prev => ({ ...prev, grammarTopic: e.target.value }))}
                  placeholder="np. present perfect vs past simple"
                  className="w-full bg-base-100/50 border border-line-strong rounded-xl px-3 py-2.5 text-sm text-text-hi outline-none focus:border-primary"
                />
              </label>

              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                  Pliki źródłowe
                </span>
                <LessonFileUploader
                  attachments={attachments}
                  onAttachmentsChange={setAttachments}
                  maxFiles={4}
                />
              </div>

              <label className="block">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                  Albo wklej tekst / opisz temat
                </span>
                <textarea
                  value={brief.sourceMaterial}
                  onChange={e => setBrief(prev => ({ ...prev, sourceMaterial: e.target.value }))}
                  rows={4}
                  placeholder="Artykuł, transkrypcja, link, opis tematu… Puste znaczy, że AI zaproponuje materiał samo."
                  className="w-full bg-base-100/50 border border-line-strong rounded-xl px-3 py-2.5 text-sm text-text-hi outline-none focus:border-primary resize-y"
                />
              </label>

              <label className="block">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                  Uwagi dla planera
                </span>
                <input
                  type="text"
                  value={brief.notes}
                  onChange={e => setBrief(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="np. unikaj tematów o pracy, kursant właśnie zmienia branżę"
                  className="w-full bg-base-100/50 border border-line-strong rounded-xl px-3 py-2.5 text-sm text-text-hi outline-none focus:border-primary"
                />
              </label>
            </div>
          )}
        </div>

        {/* PYTANIE OD AI — tak, jak zadałby je człowiek, któremu zlecono lekcję. */}
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
                      ? 'border-primary/60 bg-primary text-accent-ink'
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
              className="px-4 py-2.5 rounded-xl bg-primary text-accent-ink text-sm font-bold hover:brightness-110 transition-all flex items-center gap-2 cursor-pointer shadow-btn disabled:opacity-50"
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

  /* ═══ KROK 3 — SCENARIUSZ ═══ */
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepBar />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStep('topics')}
            className="text-[11px] font-bold text-content-muted hover:text-text-hi flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft size={12} /> Inny temat
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={Boolean(busy)}
            className="px-3 py-1.5 rounded-xl border border-line-strong bg-base-100/50 text-xs font-bold text-text-hi hover:border-primary/40 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {savedScenarioId ? <Check size={13} className="text-primary" /> : <Save size={13} />}
            {savedScenarioId ? 'Zapisany' : 'Zapisz scenariusz'}
          </button>
          {onOpenInPresentation && plan && (
            <button
              type="button"
              onClick={() =>
                onOpenInPresentation({
                  id: savedScenarioId || `scenario-draft-${Date.now()}`,
                  title: plan.title,
                  topic: plan.title,
                  content: planToMarkdown(plan),
                  targetLevel: brief.level,
                  createdAt: new Date().toISOString(),
                })
              }
              className="px-3 py-1.5 rounded-xl border border-line-strong bg-base-100/50 text-xs font-bold text-text-hi hover:border-primary/40 transition-colors cursor-pointer"
            >
              W prezentacji
            </button>
          )}
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
        {/* ── Scenariusz ── */}
        <div className="space-y-3 min-w-0">
          <div className="rounded-2xl border border-line-strong bg-base-200/60 p-4 shadow-ambient-sm">
            <h3 className="text-base font-bold text-text-hi">{plan?.title}</h3>
            {plan?.summary && (
              <p className="text-[11px] text-content-muted mt-1 leading-relaxed">{plan.summary}</p>
            )}
          </div>

          {plan?.sections.map(section => {
            const ids = section.items.map(item => item.id);
            const allSelected = ids.length > 0 && ids.every(id => selectedIds.includes(id));

            return (
              <section
                key={section.id}
                className="rounded-2xl border border-line-strong bg-base-200/60 overflow-hidden shadow-ambient-sm"
              >
                <header className="px-4 py-3 border-b border-line-strong bg-base-100/40 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-bold text-text-hi truncate">{section.title}</h4>
                  {ids.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleSection(section)}
                      className="text-[10px] font-bold uppercase tracking-wider text-content-muted hover:text-primary shrink-0 cursor-pointer"
                    >
                      {allSelected ? 'Odznacz' : 'Zaznacz całość'}
                    </button>
                  )}
                </header>

                <div className="p-2 space-y-1">
                  {section.items.length === 0 && (
                    <p className="px-2.5 py-3 text-[11px] text-content-muted italic">
                      Sekcja celowo pusta — taka jest decyzja w metodzie.
                    </p>
                  )}

                  {section.items.map(item => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`rounded-xl px-3 py-2.5 cursor-pointer transition-colors border ${
                          isSelected
                            ? 'border-primary/50 bg-primary/10'
                            : 'border-transparent hover:bg-base-100/40'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'border-primary bg-primary text-accent-ink'
                                : 'border-line-strong'
                            }`}
                          >
                            {isSelected && <Check size={11} />}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[9px] font-mono uppercase tracking-wider text-content-muted">
                                {KIND_LABEL[item.kind] || item.kind}
                              </span>
                            </div>
                            <p className="text-sm text-text-hi whitespace-pre-wrap leading-relaxed">
                              {item.text}
                            </p>
                            {item.notes && (
                              <p className="text-[11px] text-content-muted mt-1.5 pl-2.5 border-l-2 border-line-strong leading-relaxed whitespace-pre-wrap">
                                {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* ── Czat poprawek ── */}
        <div className="lg:sticky lg:top-4 space-y-3">
          <div className="rounded-2xl border border-line-strong bg-base-200/60 overflow-hidden shadow-ambient-sm flex flex-col max-h-[36rem]">
            <header className="px-4 py-3 border-b border-line-strong bg-base-100/40 flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-primary/12 text-primary border border-primary/25">
                <MessageSquare size={14} />
              </span>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-text-hi">Poprawki</h4>
                <p className="text-[10px] text-content-muted">
                  {selectedIds.length > 0
                    ? `Zaznaczono ${selectedIds.length} ${selectedIds.length === 1 ? 'element' : 'elementy'}`
                    : 'Zaznacz elementy w scenariuszu'}
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

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[10rem]">
              {chat.map(turn => (
                <div
                  key={turn.id}
                  className={`rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                    turn.role === 'teacher'
                      ? 'bg-primary/10 border border-primary/25 text-text-hi'
                      : 'bg-base-100/45 border border-line-strong text-content-muted'
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

            <div className="p-3 border-t border-line-strong bg-base-100/25 space-y-2">
              <textarea
                value={chatDraft}
                onChange={e => setChatDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRevise();
                }}
                rows={3}
                placeholder="Co zrobić z zaznaczonymi elementami? np. „za trudne na B1, uprość i oprzyj o codzienne sytuacje”"
                className="w-full bg-base-100/60 border border-line-strong rounded-xl px-3 py-2.5 text-[12px] text-text-hi outline-none focus:border-primary resize-none"
              />
              <button
                type="button"
                onClick={handleRevise}
                disabled={Boolean(busy) || !chatDraft.trim() || selectedIds.length === 0}
                className="w-full px-3 py-2.5 rounded-xl bg-primary text-accent-ink text-sm font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-btn disabled:opacity-40"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                Przerób zaznaczone
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
