import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { GeneratedLessonScenario, ScratchpadDocument } from '../../types';
import { LessonPlan, PlanSection, InteractiveExercise } from '../../services/lessonPlannerMethod';
import { getGeneratedScenarios, getScenarioById } from '../../services/scenarioService';
import { updateScratchpadTeacherNotes, updateScratchpadActiveScenario } from '../../services/scratchpadService';

interface ScratchpadTeacherCompanionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  docData: ScratchpadDocument;
  onLaunchExercise: (exercise: InteractiveExercise) => void;
  onTriggerAiSummary?: (prompt: string) => void;
}

export const ScratchpadTeacherCompanionDrawer: React.FC<ScratchpadTeacherCompanionDrawerProps> = ({
  isOpen,
  onClose,
  docData,
  onLaunchExercise,
  onTriggerAiSummary,
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
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-lg bg-[#0e131f] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 text-text-hi">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 bg-base-100/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
            {activeTab === 'scenario' ? <Target size={18} /> : <FileSignature size={18} />}
          </div>
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-1.5">
              <span>Pomocnik Lektora</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-bold">
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
          <button
            type="button"
            onClick={onClose}
            title="Zamknij pomocnika"
            className="p-1.5 rounded-xl text-content-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 bg-base-200/50 p-1.5 gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('scenario')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'scenario'
              ? 'bg-primary text-ink-base shadow-md font-extrabold'
              : 'text-content-muted hover:text-white hover:bg-white/5'
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
              ? 'bg-amber-400 text-ink-base shadow-md font-extrabold'
              : 'text-content-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <FileSignature size={14} />
          Side Notes (Prywatne)
          {sideNotes.trim() && (
            <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-ink-base" />
          )}
        </button>
      </div>

      {/* Tab 1: Scenario Body */}
      {activeTab === 'scenario' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Scenario Selector bar */}
          <div className="p-3 rounded-2xl bg-base-200/80 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
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
                  className="text-[10px] text-content-muted hover:text-rose-400 underline cursor-pointer"
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
              className="w-full px-3 py-2 rounded-xl bg-ink-1 border border-white/15 text-xs text-white focus:outline-none focus:border-primary font-medium"
            >
              <option value="">-- Wybierz scenariusz z bazy --</option>
              {allScenarios.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.title} ({sc.targetLevel || 'B2'})
                </option>
              ))}
            </select>
          </div>

          {isLoadingScenario ? (
            <div className="py-12 text-center text-xs text-content-muted animate-pulse">
              Ładowanie scenariusza...
            </div>
          ) : parsedPlan ? (
            <div className="space-y-4">
              {/* Header Callout Card */}
              <div className="p-4 rounded-2xl bg-ink-2/90 border border-white/10 space-y-2.5 text-xs">
                <div>
                  <span className="font-bold text-white">🏭 Format: </span>
                  <span className="text-content-muted">{parsedPlan.format}</span>
                </div>
                <div>
                  <span className="font-bold text-white">Cel: </span>
                  <span className="text-text-hi">{parsedPlan.goal}</span>
                </div>
                {parsedPlan.sourceMaterialDescription && (
                  <div>
                    <span className="font-bold text-white">Materiał źródłowy: </span>
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
                      className="rounded-2xl border border-white/10 bg-ink-2/60 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSection(sec.id)}
                        className="w-full px-3.5 py-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isOpenSec ? (
                            <ChevronDown size={14} className="text-primary shrink-0" />
                          ) : (
                            <ChevronRight size={14} className="text-content-muted shrink-0" />
                          )}
                          <span className="text-xs font-bold text-white truncate">
                            {secIdx + 1}. {sec.title}
                          </span>
                        </div>
                        {sec.duration && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-content-muted font-mono shrink-0 ml-2">
                            {sec.duration}
                          </span>
                        )}
                      </button>

                      {isOpenSec && (
                        <div className="p-3 border-t border-white/10 space-y-3 bg-ink-1/40">
                          {/* Items */}
                          {sec.items.map((item) => {
                            const isChecked = checkedItems[item.id] || false;
                            const isSubnoteOpen = openSubnotes[item.id] || false;

                            // Badge header if kind changes
                            let badge = null;
                            if (item.kind === 'topic_material') {
                              badge = (
                                <div className="px-2.5 py-1 rounded-lg bg-[#16273b] border border-[#2b4b6f] text-sky-200 text-[11px] font-bold">
                                  Topic and Material
                                </div>
                              );
                            } else if (item.kind === 'lead_in') {
                              badge = (
                                <div className="px-2.5 py-1 rounded-lg bg-[#16273b] border border-[#2b4b6f] text-sky-200 text-[11px] font-bold">
                                  Lead-in
                                </div>
                              );
                            } else if (item.kind === 'thought_provoking_questions') {
                              badge = (
                                <div className="space-y-1.5">
                                  <div className="px-2.5 py-1 rounded-lg bg-[#331828] border border-[#5c2444] text-rose-200 text-[11px] font-bold">
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
                                    <span
                                      className={`leading-relaxed ${
                                        isChecked ? 'line-through text-content-muted' : 'text-text-hi'
                                      }`}
                                    >
                                      {item.text}
                                    </span>

                                    {/* Budka suflera / Teacher's Notes */}
                                    {item.teacherNotes && (
                                      <div className="mt-2 rounded-xl bg-[#2b192e] border border-[#53264c] p-2.5 text-[11px] space-y-1.5">
                                        <button
                                          type="button"
                                          onClick={() => toggleSubnote(item.id)}
                                          className="w-full flex items-center justify-between text-rose-200 font-bold hover:text-white transition-colors cursor-pointer"
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
                                          <div className="space-y-1 pt-1 border-t border-[#53264c]/60">
                                            {item.teacherNotes.goal && (
                                              <div>
                                                <span className="font-bold text-white">
                                                  • Cel:{' '}
                                                </span>
                                                <span className="text-rose-100">
                                                  {item.teacherNotes.goal}
                                                </span>
                                              </div>
                                            )}
                                            {item.teacherNotes.scaffolding && (
                                              <div className="flex items-center justify-between gap-1">
                                                <div>
                                                  <span className="font-bold text-white">
                                                    • Scaffolding:{' '}
                                                  </span>
                                                  <span className="italic text-rose-200">
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
                                                  className="p-1 rounded text-rose-300 hover:bg-white/10"
                                                  title="Skopiuj podpowiedź"
                                                >
                                                  {copiedKey === item.id ? (
                                                    <Check size={12} className="text-emerald-400" />
                                                  ) : (
                                                    <Copy size={12} />
                                                  )}
                                                </button>
                                              </div>
                                            )}
                                            {item.teacherNotes.followUp && (
                                              <div>
                                                <span className="font-bold text-amber-400">
                                                  • Follow-up:{' '}
                                                </span>
                                                <span className="text-amber-200">
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
                                    <div className="text-xs font-bold text-white truncate">
                                      {ex.title}
                                    </div>
                                    <div className="text-[10px] text-content-muted truncate">
                                      {ex.question}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => onLaunchExercise(ex)}
                                    className="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-ink-base font-bold text-[11px] shadow-sm flex items-center gap-1 shrink-0 cursor-pointer"
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
              <div className="p-3 rounded-xl bg-ink-2 border border-white/10">
                <h4 className="text-sm font-bold text-white">{activeScenario.title}</h4>
                <p className="text-xs text-content-muted">{activeScenario.topic}</p>
              </div>
              <div className="p-3 rounded-xl bg-ink-2/60 border border-white/10 text-xs text-content-muted whitespace-pre-wrap font-mono max-h-[60vh] overflow-y-auto">
                {activeScenario.content}
              </div>
            </div>
          ) : (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-content-muted mx-auto">
                <BookOpen size={24} />
              </div>
              <h4 className="text-xs font-bold text-white">Brak przypisanego scenariusza</h4>
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
          <div className="p-3 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-xs text-amber-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-300">
              <FileSignature size={14} />
              Prywatna przestrzeń lektora
            </div>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
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
              className="w-full flex-1 p-3.5 rounded-2xl bg-ink-1 border border-white/15 text-white placeholder:text-content-muted focus:outline-none focus:border-amber-400 text-xs leading-relaxed resize-none font-sans"
            />
            {isSavingNotes && (
              <span className="absolute bottom-3 right-3 text-[10px] text-amber-400/80 bg-ink-2/80 px-2 py-0.5 rounded-md border border-amber-400/20">
                Zapisywanie...
              </span>
            )}
          </div>

          {/* Quick AI Action button */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
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
                className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-ink-base font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
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
