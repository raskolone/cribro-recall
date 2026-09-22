import React, { useState, useEffect, useRef } from 'react';
import {
  Target,
  FileSignature,
  X,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Zap,
  CheckSquare,
  Square,
  BookOpen,
  Copy,
  Check,
  RotateCcw,
  Layers,
  FolderOpen,
  Volume2,
  Music,
  Airplay,
  UploadCloud,
  PlusCircle,
} from 'lucide-react';
import { GeneratedLessonScenario, LessonAttachment, ScratchpadDocument } from '../../types';
import { LessonPlan, PlanSection, InteractiveExercise } from '../../services/lessonPlannerMethod';
import { getGeneratedScenarios, getScenarioById } from '../../services/scenarioService';
import { updateScratchpadTeacherNotes, updateScratchpadActiveScenario, updateScratchpadPresentation } from '../../services/scratchpadService';

interface ScratchpadTeacherCompanionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  docData: ScratchpadDocument;
  onLaunchExercise: (exercise: InteractiveExercise) => void;
  onLaunchWheelOfFortune?: () => void;
  onTriggerAiSummary?: (prompt: string) => void;
  /** Wstawia zwrot/zadanie ze scenariusza bezpośrednio w miejscu kursora na aktywnej stronie A4. */
  onInsertPhrase?: (text: string) => void;
}

export const ScratchpadTeacherCompanionDrawer: React.FC<ScratchpadTeacherCompanionDrawerProps> = ({
  isOpen,
  onClose,
  docData,
  onLaunchExercise,
  onLaunchWheelOfFortune,
  onTriggerAiSummary,
  onInsertPhrase,
}) => {
  const [activeTab, setActiveTab] = useState<'scenario' | 'notes'>('scenario');
  const [activeScenario, setActiveScenario] = useState<GeneratedLessonScenario | null>(null);
  const [parsedPlan, setParsedPlan] = useState<LessonPlan | null>(null);
  const [allScenarios, setAllScenarios] = useState<GeneratedLessonScenario[]>([]);
  const [isLoadingScenario, setIsLoadingScenario] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'warm-up': true,
    'main-topic': true,
    'practice-enclosure': true,
  });
  const [openSubnotes, setOpenSubnotes] = useState<Record<string, boolean>>({});
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Side Notes local state
  const [sideNotes, setSideNotes] = useState(docData.teacherNotes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Sync side notes from docData
  useEffect(() => {
    if (docData.teacherNotes !== undefined && docData.teacherNotes !== sideNotes) {
      setSideNotes(docData.teacherNotes);
    }
  }, [docData.teacherNotes]);

  // Load scenarios list & active scenario
  useEffect(() => {
    if (!isOpen) return;

    getGeneratedScenarios().then((list) => {
      setAllScenarios(list);
    });

    if (docData.activeScenarioId) {
      setIsLoadingScenario(true);
      getScenarioById(docData.activeScenarioId)
        .then((sc) => {
          if (sc) {
            setActiveScenario(sc);
            if (sc.planJson) {
              try {
                setParsedPlan(JSON.parse(sc.planJson));
              } catch (e) {
                console.warn('Failed to parse planJson in companion drawer:', e);
              }
            }
          }
        })
        .finally(() => setIsLoadingScenario(false));
    }
  }, [isOpen, docData.activeScenarioId]);

  // Auto-save side notes with debounce
  useEffect(() => {
    if (!docData.id || sideNotes === (docData.teacherNotes || '')) return;

    const timer = setTimeout(async () => {
      try {
        setIsSavingNotes(true);
        await updateScratchpadTeacherNotes(docData.id, sideNotes);
      } catch (err) {
        console.error('Błąd zapisu notatek lektora:', err);
      } finally {
        setIsSavingNotes(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [sideNotes, docData.id, docData.teacherNotes]);

  if (!isOpen) return null;

  const handleSelectScenario = async (sc: GeneratedLessonScenario) => {
    setActiveScenario(sc);
    if (sc.planJson) {
      try {
        setParsedPlan(JSON.parse(sc.planJson));
      } catch (e) {
        setParsedPlan(null);
      }
    } else {
      setParsedPlan(null);
    }
    if (docData.id) {
      await updateScratchpadActiveScenario(docData.id, sc.id);
    }
  };

  const toggleSection = (secId: string) => {
    setOpenSections((prev) => ({ ...prev, [secId]: !prev[secId] }));
  };

  const toggleSubnote = (itemId: string) => {
    setOpenSubnotes((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const toggleChecked = (itemId: string) => {
    setCheckedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-lg bg-base-200 border-l border-line-strong shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 text-text-hi">
      {/* Header */}
      <div className="px-4 py-3 border-b border-line bg-base-100/70 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
            {activeTab === 'scenario' ? <Target size={18} /> : <FileSignature size={18} />}
          </div>
          <div>
            <h3 className="text-sm font-black text-text-hi flex items-center gap-1.5">
              <span>Pomocnik Lektora</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-bold">
                Live Companion
              </span>
            </h3>
            <p className="text-[11px] text-content-muted">
              {activeTab === 'scenario'
                ? 'Śledź scenariusz i uruchamiaj ćwiczenia'
                : 'Prywatne notatki (ukryte przed kursantem)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onLaunchWheelOfFortune && (
            <button
              type="button"
              onClick={onLaunchWheelOfFortune}
              title="Uruchom Koło Fortuny na żywo dla kursanta"
              className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-medium text-xs flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
            >
              <span>🎡</span>
              <span className="hidden sm:inline">Koło Fortuny</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Zamknij pomocnika"
            className="p-1.5 rounded-xl text-content-muted hover:text-text-hi hover:bg-base-300/60 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line bg-base-100/40 p-1.5 gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('scenario')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'scenario'
              ? 'bg-primary text-accent-ink shadow-sm font-extrabold'
              : 'text-content-muted hover:text-text-hi hover:bg-base-300/50'
          }`}
        >
          <Target size={14} />
          Scenariusz Lekcji
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
            activeTab === 'notes'
              ? 'bg-amber-500 text-slate-950 font-black dark:bg-amber-400 dark:text-ink shadow-sm'
              : 'text-content-muted hover:text-text-hi hover:bg-base-300/50'
          }`}
        >
          <FileSignature size={14} />
          Side Notes (Prywatne)
          {sideNotes.trim() && (
            <span
              className={`w-2 h-2 rounded-full ring-2 ring-base-200 ${
                activeTab === 'notes' ? 'bg-slate-950/70 dark:bg-ink/70' : 'bg-amber-500 dark:bg-amber-400'
              }`}
            />
          )}
        </button>
      </div>

      {/* Tab 1: Scenario Body */}
      {activeTab === 'scenario' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Szybkie narzędzie rozgrzewkowe: Koło Fortuny */}
          {onLaunchWheelOfFortune && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-primary/10 to-amber-500/10 border border-amber-500/30 dark:border-amber-400/25 shadow-sm space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-950 dark:text-amber-300 flex items-center justify-center text-lg shrink-0">
                    🎡
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-text-hi flex items-center gap-1.5">
                      <span>Koło Fortuny (Rozgrzewka)</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-950 dark:text-amber-300 border border-amber-500/30 font-bold uppercase">
                        Live Game
                      </span>
                    </div>
                    <p className="text-[11px] text-content-muted truncate">
                      Interaktywne pytania rozgrzewkowe z fizyką GSAP
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLaunchWheelOfFortune}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 dark:bg-amber-400 dark:hover:bg-amber-300 text-slate-950 dark:text-ink font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                  title="Uruchom Koło Fortuny kursantowi na żywo"
                >
                  <Sparkles size={12} />
                  <span>Uruchom</span>
                </button>
              </div>
            </div>
          )}

          {/* Scenario Selector bar */}
          <div className="p-3 rounded-2xl bg-base-100 border border-line space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-hi flex items-center gap-1.5">
                <FolderOpen size={13} className="text-primary" />
                Aktywny scenariusz:
              </span>
              {activeScenario && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveScenario(null);
                    setParsedPlan(null);
                    if (docData.id) updateScratchpadActiveScenario(docData.id, '');
                  }}
                  className="text-[10px] text-content-muted hover:text-rose-500 dark:hover:text-rose-400 underline cursor-pointer"
                >
                  Odłącz
                </button>
              )}
            </div>

            <select
              value={activeScenario?.id || ''}
              onChange={(e) => {
                const sc = allScenarios.find((s) => s.id === e.target.value);
                if (sc) handleSelectScenario(sc);
              }}
              className="w-full px-3 py-2 rounded-xl bg-base-200 border border-line-strong text-xs text-text-hi focus:outline-none focus:border-primary font-medium"
            >
              <option value="" className="bg-base-200 text-text-hi">-- Wybierz scenariusz z bazy --</option>
              {allScenarios.map((sc) => (
                <option key={sc.id} value={sc.id} className="bg-base-200 text-text-hi">
                  {sc.title} ({sc.targetLevel || 'B2'})
                </option>
              ))}
            </select>
          </div>

          {/* Scenario Audio Materials Card */}
          {(() => {
            const scenarioAudio = activeScenario?.attachments?.filter(
              (a): a is LessonAttachment & { dataUrl: string } => a.type === 'audio' && Boolean(a.dataUrl)
            ) || [];

            const handleDrawerAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              if (!file || !activeScenario) return;
              if (file.size > 15 * 1024 * 1024) {
                alert(`Plik "${file.name}" przekracza maksymalny limit 15 MB.`);
                return;
              }
              const reader = new FileReader();
              reader.onload = async () => {
                const dataUrl = reader.result as string;
                const newAtt: LessonAttachment = {
                  id: `att-audio-${Date.now()}`,
                  name: file.name,
                  type: 'audio',
                  size: file.size,
                  mimeType: file.type || 'audio/mpeg',
                  dataUrl,
                };
                const updatedAttachments = [...(activeScenario.attachments || []), newAtt];
                setActiveScenario({ ...activeScenario, attachments: updatedAttachments });
                if (docData.id) {
                  await updateScratchpadPresentation(docData.id, {
                    active: true,
                    type: 'listening',
                    title: `Nagranie: ${file.name}`,
                    prompt: 'Odsłuchaj nagranie audio i wykonaj polecenia lektora.',
                    audioUrl: dataUrl,
                    audioName: file.name,
                    studentAnswer: null,
                    revealedAnswer: null,
                  });
                }
              };
              reader.readAsDataURL(file);
              e.target.value = '';
            };

            if (scenarioAudio.length === 0 && !activeScenario) return null;

            return (
              <div className="p-3.5 rounded-2xl bg-purple-950/25 border border-purple-500/35 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                    <Volume2 size={14} className="text-purple-400" />
                    Nagrania audio ze scenariusza
                    {scenarioAudio.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/30 text-purple-200 font-mono">
                        {scenarioAudio.length}
                      </span>
                    )}
                  </span>
                  {activeScenario && (
                    <div>
                      <input
                        ref={audioInputRef}
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac"
                        className="hidden"
                        onChange={handleDrawerAudioUpload}
                      />
                      <button
                        type="button"
                        onClick={() => audioInputRef.current?.click()}
                        className="px-2 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-[10px] font-bold text-purple-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                        title="Dodaj plik audio i uruchom go w prezentacji u kursanta"
                      >
                        <UploadCloud size={12} />
                        + Dodaj audio
                      </button>
                    </div>
                  )}
                </div>

                {scenarioAudio.length > 0 ? (
                  <div className="space-y-2.5">
                    {scenarioAudio.map((att) => (
                      <div
                        key={att.id}
                        className="p-2.5 rounded-xl bg-base-100/70 border border-purple-500/20 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-text-hi truncate" title={att.name}>
                            🎧 {att.name}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              if (docData.id) {
                                await updateScratchpadPresentation(docData.id, {
                                  active: true,
                                  type: 'listening',
                                  title: `Nagranie: ${att.name}`,
                                  prompt: 'Odsłuchaj nagranie audio i wykonaj polecenia lektora.',
                                  audioUrl: att.dataUrl,
                                  audioName: att.name,
                                  studentAnswer: null,
                                  revealedAnswer: null,
                                });
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary text-[11px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
                            title="Włącz ten slajd audio w prezentacji u kursanta"
                          >
                            <Airplay size={12} />
                            Odtwórz w Prezentacji
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
                  <p className="text-[11px] text-purple-200/60 text-center py-1">
                    Brak wgranych plików audio w tym scenariuszu.
                  </p>
                )}
              </div>
            );
          })()}

          {isLoadingScenario ? (
            <div className="py-12 text-center text-xs text-content-muted animate-pulse">
              Ładowanie scenariusza...
            </div>
          ) : parsedPlan ? (
            <div className="space-y-4">
              {/* Header Callout Card */}
              <div className="p-4 rounded-2xl bg-base-100/70 border border-line space-y-2.5 text-xs">
                <div>
                  <span className="font-bold text-text-hi">🏭 Format: </span>
                  <span className="text-content-muted">{parsedPlan.format}</span>
                </div>
                <div>
                  <span className="font-bold text-text-hi">Cel: </span>
                  <span className="text-text-hi">{parsedPlan.goal}</span>
                </div>
                {parsedPlan.sourceMaterialDescription && (
                  <div>
                    <span className="font-bold text-text-hi">Materiał źródłowy: </span>
                    <span className="text-content-muted">
                      {parsedPlan.sourceMaterialDescription}
                    </span>
                  </div>
                )}
              </div>

              {/* Sections Accordion */}
              <div className="space-y-2.5">
                {parsedPlan.sections.map((sec, secIdx) => {
                  const isOpenSec = openSections[sec.id] ?? false;
                  return (
                    <div
                      key={sec.id}
                      className="rounded-2xl border border-line bg-base-100/50 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSection(sec.id)}
                        className="w-full px-3.5 py-3 flex items-center justify-between text-left hover:bg-base-300/40 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isOpenSec ? (
                            <ChevronDown size={14} className="text-primary shrink-0" />
                          ) : (
                            <ChevronRight size={14} className="text-content-muted shrink-0" />
                          )}
                          <span className="text-xs font-bold text-text-hi truncate">
                            {secIdx + 1}. {sec.title}
                          </span>
                        </div>
                        {sec.duration && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-base-300/60 text-content-muted font-mono shrink-0 ml-2">
                            {sec.duration}
                          </span>
                        )}
                      </button>

                      {isOpenSec && (
                        <div className="p-3 border-t border-line space-y-3 bg-base-100/30">
                          {/* Items */}
                          {sec.items.map((item) => {
                            const isChecked = checkedItems[item.id] || false;
                            const isSubnoteOpen = openSubnotes[item.id] || false;

                            // Badge header if kind changes
                            let badge = null;
                            if (item.kind === 'topic_material') {
                              badge = (
                                <div className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-[11px] font-bold">
                                  Topic and Material
                                </div>
                              );
                            } else if (item.kind === 'lead_in') {
                              badge = (
                                <div className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-[11px] font-bold">
                                  Lead-in
                                </div>
                              );
                            } else if (item.kind === 'thought_provoking_questions') {
                              badge = (
                                <div className="space-y-1.5">
                                  <div className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] font-bold">
                                    Thought-Provoking Questions
                                  </div>
                                  {item.safetyBankNote && (
                                    <p className="text-[11px] text-content-muted italic">
                                      {item.safetyBankNote}
                                    </p>
                                  )}
                                  {item.methodologyNote && (
                                    <p className="text-[11px] text-primary/90 font-medium">
                                      {item.methodologyNote}
                                    </p>
                                  )}
                                </div>
                              );
                            }

                            return (
                              <div key={item.id} className="space-y-1.5">
                                {badge}

                                <div className="flex items-start gap-2 text-xs">
                                  {item.checkable ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleChecked(item.id)}
                                      className="mt-0.5 text-content-muted hover:text-primary transition-colors cursor-pointer"
                                    >
                                      {isChecked ? (
                                        <CheckSquare size={14} className="text-primary" />
                                      ) : (
                                        <Square size={14} />
                                      )}
                                    </button>
                                  ) : (
                                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-content-muted shrink-0" />
                                  )}

                                  <div className="flex-1">
                                    <span className="flex items-start justify-between gap-2">
                                      <span
                                        className={`leading-relaxed ${
                                          isChecked ? 'line-through text-content-muted' : 'text-text-hi'
                                        }`}
                                      >
                                        {item.text}
                                      </span>
                                      {onInsertPhrase && item.text?.trim() && (
                                        <button
                                          type="button"
                                          onClick={() => onInsertPhrase(item.text)}
                                          title="Wstaw do notatki w miejscu kursora"
                                          className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                        >
                                          <PlusCircle size={11} />
                                          Wstaw
                                        </button>
                                      )}
                                    </span>

                                    {/* Budka suflera / Teacher's Notes */}
                                    {item.teacherNotes && (
                                      <div className="mt-2 rounded-xl bg-rose-500/10 border border-rose-500/25 p-2.5 text-[11px] space-y-1.5 text-rose-900 dark:text-rose-200">
                                        <button
                                          type="button"
                                          onClick={() => toggleSubnote(item.id)}
                                          className="w-full flex items-center justify-between text-rose-700 dark:text-rose-300 font-bold hover:text-text-hi transition-colors cursor-pointer"
                                        >
                                          <span className="flex items-center gap-1.5">
                                            {isSubnoteOpen ? (
                                              <ChevronDown size={12} />
                                            ) : (
                                              <ChevronRight size={12} />
                                            )}
                                            Teacher's Notes (Budka Suflera)
                                          </span>
                                        </button>

                                        {isSubnoteOpen && (
                                          <div className="space-y-1 pt-1 border-t border-rose-500/20">
                                            {item.teacherNotes.goal && (
                                              <div>
                                                <span className="font-bold text-text-hi">
                                                  • Cel:{' '}
                                                </span>
                                                <span className="text-rose-800 dark:text-rose-100">
                                                  {item.teacherNotes.goal}
                                                </span>
                                              </div>
                                            )}
                                            {item.teacherNotes.scaffolding && (
                                              <div className="flex items-center justify-between gap-1">
                                                <div>
                                                  <span className="font-bold text-text-hi">
                                                    • Scaffolding:{' '}
                                                  </span>
                                                  <span className="italic text-rose-800 dark:text-rose-200">
                                                    {item.teacherNotes.scaffolding}
                                                  </span>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleCopy(
                                                      item.teacherNotes?.scaffolding || '',
                                                      item.id
                                                    )
                                                  }
                                                  className="p-1 rounded text-rose-700 dark:text-rose-300 hover:bg-base-300/60"
                                                  title="Skopiuj podpowiedź"
                                                >
                                                  {copiedKey === item.id ? (
                                                    <Check size={12} className="text-emerald-500 dark:text-emerald-400" />
                                                  ) : (
                                                    <Copy size={12} />
                                                  )}
                                                </button>
                                              </div>
                                            )}
                                            {item.teacherNotes.followUp && (
                                              <div>
                                                <span className="font-bold text-amber-950 dark:text-amber-300">
                                                  • Follow-up:{' '}
                                                </span>
                                                <span className="text-slate-800 dark:text-amber-100 font-medium">
                                                  {item.teacherNotes.followUp}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {/* Section 5: Interactive Exercises */}
                          {sec.interactiveExercises && sec.interactiveExercises.length > 0 && (
                            <div className="pt-2 space-y-2.5">
                              <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                                <Zap size={12} />
                                Ćwiczenia Kahoot-Style (do uruchomienia):
                              </span>
                              {sec.interactiveExercises.map((ex) => (
                                <div
                                  key={ex.id}
                                  className="p-2.5 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-text-hi truncate">
                                      {ex.title}
                                    </div>
                                    <div className="text-[10px] text-content-muted truncate">
                                      {ex.question}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => onLaunchExercise(ex)}
                                    className="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-accent-ink font-bold text-[11px] shadow-sm flex items-center gap-1 shrink-0 cursor-pointer"
                                  >
                                    <Zap size={11} />
                                    Uruchom
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeScenario ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-base-100 border border-line">
                <h4 className="text-sm font-bold text-text-hi">{activeScenario.title}</h4>
                <p className="text-xs text-content-muted">{activeScenario.topic}</p>
              </div>
              <div className="p-3 rounded-xl bg-base-100/60 border border-line text-xs text-content-muted whitespace-pre-wrap font-mono max-h-[60vh] overflow-y-auto">
                {activeScenario.content}
              </div>
            </div>
          ) : (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-base-300/40 border border-line flex items-center justify-center text-content-muted mx-auto">
                <BookOpen size={24} />
              </div>
              <h4 className="text-xs font-bold text-text-hi">Brak przypisanego scenariusza</h4>
              <p className="text-[11px] text-content-muted max-w-xs mx-auto">
                Wybierz wcześniej przygotowany scenariusz z rozwijanej listy u góry lub stwórz nowy w
                Planerze Lekcji.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Side Notes Body */}
      {activeTab === 'notes' && (
        <div className="flex-1 flex flex-col p-4 space-y-3 overflow-hidden">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 dark:bg-amber-500/15 dark:border-amber-400/30 text-xs space-y-1.5 shadow-sm">
            <div className="font-black flex items-center gap-2 text-amber-950 dark:text-amber-300">
              <span className="p-1 rounded-md bg-amber-500/20 text-amber-950 dark:text-amber-300">
                <FileSignature size={14} />
              </span>
              <span>Prywatna przestrzeń lektora</span>
            </div>
            <p className="text-[11px] text-slate-800 dark:text-amber-100/90 leading-relaxed font-medium">
              Te notatki są w 100% niewidoczne dla kursanta. Zapisuj na bieżąco trudności kursanta,
              nowe pomysły lub błędy. Asystent AI w notatniku wykorzysta je do wygenerowania
              podsumowania i pracy domowej!
            </p>
          </div>

          <div className="flex-1 flex flex-col min-h-0 relative">
            <textarea
              value={sideNotes}
              onChange={(e) => setSideNotes(e.target.value)}
              placeholder="np. Marek ciągle myli 'there is' z 'there are' przy pytaniach; zawiesił się na słowie 'forklift'; świetnie opisał swój dzień pracy w magazynie..."
              className="w-full flex-1 p-3.5 rounded-2xl bg-base-100 border border-line-strong hover:border-line-stronger text-text-hi placeholder:text-content-muted/80 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-xs leading-relaxed resize-none font-sans transition-all"
            />
            {isSavingNotes && (
              <span className="absolute bottom-3 right-3 text-[10px] text-amber-950 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-600/40 shadow-sm font-bold">
                Zapisywanie...
              </span>
            )}
          </div>

          {/* Quick AI Action button */}
          <div className="pt-2 border-t border-line flex items-center justify-between gap-2">
            <span className="text-[10px] text-content-muted">
              Auto-zapis w chmurze powiązany z tym notatnikiem
            </span>
            {onTriggerAiSummary && (
              <button
                type="button"
                onClick={() =>
                  onTriggerAiSummary(
                    'Na podstawie moich prywatnych Side Notes oraz treści lekcji, przygotuj zwięzłe podsumowanie dla kursanta, listę kluczowych błędów do utrwalenia i zadanie domowe.'
                  )
                }
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 dark:bg-amber-400 dark:hover:bg-amber-300 text-slate-950 dark:text-ink font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Sparkles size={13} />
                Wygeneruj podsumowanie z AI
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

export default ScratchpadTeacherCompanionDrawer;
