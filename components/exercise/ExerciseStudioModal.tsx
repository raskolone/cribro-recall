import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw, Sparkles, Plus, Trash2, Edit3, Check, Save,
  Play, Eye, Layers, Link2, Puzzle, HelpCircle, X,
  FileText, Award, ArrowLeft, ArrowRight, CheckCircle2
} from 'lucide-react';
import {
  ExerciseDefinition,
  ExerciseStudioType,
  RandomWheelPayload,
  WheelItem
} from '../../types/exerciseStudio';
import {
  fetchAllExercises,
  saveExercise,
  deleteExercise,
  createNewExercise
} from '../../services/exerciseService';
import { exerciseRegistry, getAllExerciseTypes } from '../../services/exerciseRegistry';
import { WheelOfFortune } from '../presentation/WheelOfFortune';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useEscapeModal } from '../../hooks/useEscapeModal';

interface ExerciseStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Uruchomienie wybranego ćwiczenia w Presentation Overlay */
  onLaunchExercise?: (exercise: ExerciseDefinition) => void;
  /** Wstawienie ćwiczenia / promptu do aktywnego notatnika */
  onInsertToLesson?: (exercise: ExerciseDefinition) => void;
}

export const ExerciseStudioModal: React.FC<ExerciseStudioModalProps> = ({
  isOpen,
  onClose,
  onLaunchExercise,
  onInsertToLesson,
}) => {
  const [activeTab, setActiveTab] = useState<'library' | 'editor' | 'preview'>('library');
  const [exercises, setExercises] = useState<ExerciseDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDefinition<RandomWheelPayload> | null>(null);

  // Formularz edytora
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<ExerciseStudioType>('random_wheel');
  const [formCefr, setFormCefr] = useState('B1-B2');
  const [formInstructions, setFormInstructions] = useState('');
  const [formItems, setFormItems] = useState<WheelItem[]>([]);
  const [formRemoveOnHit, setFormRemoveOnHit] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEscapeModal(isOpen, onClose, 10);

  // Wczytanie biblioteki ćwiczeń
  const loadExercises = async () => {
    setIsLoading(true);
    try {
      const list = await fetchAllExercises();
      setExercises(list);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadExercises();
    }
  }, [isOpen]);

  // Rozpoczęcie tworzenia nowego ćwiczenia
  const handleStartCreate = (type: ExerciseStudioType = 'random_wheel') => {
    const newEx = createNewExercise<RandomWheelPayload>(type, 'Nowe Koło Fortuny');
    setSelectedExercise(newEx);
    setFormTitle(newEx.title);
    setFormType(type);
    setFormCefr(newEx.cefr || 'B1-B2');
    setFormInstructions(newEx.instructions || '');
    setFormItems(newEx.payload?.items || []);
    setFormRemoveOnHit(newEx.payload?.removeOnHit || false);
    setActiveTab('editor');
  };

  // Edycja istniejącego ćwiczenia
  const handleEditExercise = (ex: ExerciseDefinition) => {
    const wheelEx = ex as ExerciseDefinition<RandomWheelPayload>;
    setSelectedExercise(wheelEx);
    setFormTitle(wheelEx.title);
    setFormType(wheelEx.type);
    setFormCefr(wheelEx.cefr || 'B1-B2');
    setFormInstructions(wheelEx.instructions || '');
    setFormItems(wheelEx.payload?.items || []);
    setFormRemoveOnHit(wheelEx.payload?.removeOnHit || false);
    setActiveTab('editor');
  };

  // Dodanie nowego elementu do koła
  const handleAddItem = () => {
    const newItem: WheelItem = {
      id: `item-${Date.now()}`,
      label: `Nowa pozycja ${formItems.length + 1}`,
      prompt: 'Wpisz treść pytania lub zadania dla kursanta...',
      category: 'General',
      used: false,
    };
    setFormItems([...formItems, newItem]);
  };

  // Usunięcie elementu
  const handleRemoveItem = (index: number) => {
    setFormItems(formItems.filter((_, idx) => idx !== index));
  };

  // Aktualizacja elementu
  const handleUpdateItem = (index: number, field: keyof WheelItem, val: any) => {
    const updated = [...formItems];
    updated[index] = { ...updated[index], [field]: val };
    setFormItems(updated);
  };

  // Zapis ćwiczenia
  const handleSave = async () => {
    if (!formTitle.trim()) return;
    const toSave: ExerciseDefinition<RandomWheelPayload> = {
      id: selectedExercise?.id || `ex_wheel_${Date.now()}`,
      title: formTitle.trim(),
      type: formType,
      cefr: formCefr,
      language: 'English',
      instructions: formInstructions,
      payload: {
        title: formTitle.trim(),
        items: formItems,
        removeOnHit: formRemoveOnHit,
        spinDuration: 4.5,
        questionSource: 'custom',
      },
      status: 'ready',
      createdBy: selectedExercise?.createdBy || 'teacher',
      createdAt: selectedExercise?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: (selectedExercise?.version || 0) + 1,
    };

    await saveExercise(toSave);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
    await loadExercises();
  };

  // Usunięcie ćwiczenia z biblioteki
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Czy na pewno chcesz usunąć to ćwiczenie?')) {
      await deleteExercise(id);
      await loadExercises();
      if (selectedExercise?.id === id) {
        setSelectedExercise(null);
        setActiveTab('library');
      }
    }
  };

  if (!isOpen) return null;

  const currentPreviewPayload: RandomWheelPayload = {
    title: formTitle || 'Podgląd Koła',
    items: formItems.length > 0 ? formItems : [{ id: 'p-1', label: 'Przykładowa opcja', prompt: 'Treść' }],
    removeOnHit: formRemoveOnHit,
    spinDuration: 4.5,
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-6xl max-h-[92vh] rounded-3xl border border-line-strong shadow-2xl flex flex-col overflow-hidden animate-fadeIn"
        style={{
          backgroundColor: 'var(--exercise-surface, #0f172a)',
          color: 'var(--exercise-text, #f8fafc)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* NAGŁÓWEK STUDIO */}
        <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-text-hi">Exercise Studio</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Projektowanie, edycja i uruchamianie interaktywnych ćwiczeń lekcyjnych
              </p>
            </div>
          </div>

          {/* ZAKŁADKI STUDIO */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/30 border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'library'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Moje ćwiczenia ({exercises.length})
            </button>
            <button
              type="button"
              onClick={() => {
                if (!selectedExercise) handleStartCreate();
                else setActiveTab('editor');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'editor'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Kreator ćwiczenia
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Podgląd na żywo
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Zamknij Studio"
          >
            <X size={18} />
          </button>
        </header>

        {/* ZAWARTOŚĆ ZAKŁADEK */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 1. BIBLIOTEKA ĆWICZEŃ */}
          {activeTab === 'library' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-text-hi">Zapisane ćwiczenia</h2>
                  <p className="text-xs text-slate-400">
                    Wybierz ćwiczenie do uruchomienia podczas lekcji lub edytuj jego zawartość.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleStartCreate('random_wheel')}
                  className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold flex items-center gap-1.5 px-4"
                >
                  <Plus size={14} />
                  Nowe koło fortuny
                </Button>
              </div>

              {/* Siatka ćwiczeń */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {exercises.map((ex) => {
                  const entry = exerciseRegistry[ex.type] || exerciseRegistry.random_wheel;
                  const wheelPayload = ex.payload as RandomWheelPayload;
                  const itemsCount = wheelPayload?.items?.length || 0;

                  return (
                    <div
                      key={ex.id}
                      onClick={() => handleEditExercise(ex)}
                      className="p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/[0.08] hover:border-emerald-500/40 transition-all cursor-pointer flex flex-col justify-between group relative shadow-md"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {entry.label}
                          </span>
                          {ex.cefr && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/10 text-slate-300">
                              {ex.cefr}
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="text-sm font-bold text-text-hi group-hover:text-emerald-300 transition-colors line-clamp-1">
                            {ex.title}
                          </h3>
                          <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                            {ex.instructions || `${itemsCount} segmentów losowania`}
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-slate-500">
                          {itemsCount} pozycji
                        </span>

                        <div className="flex items-center gap-1.5">
                          {onLaunchExercise && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onLaunchExercise(ex);
                                onClose();
                              }}
                              title="Uruchom w lekcji (Presentation Overlay)"
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 flex items-center gap-1 cursor-pointer"
                            >
                              <Play size={11} />
                              Graj
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => handleDelete(ex.id, e)}
                            title="Usuń ćwiczenie"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sekcja: Nadchodzące typy ćwiczeń */}
              <div className="pt-6 border-t border-white/10">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Więcej formatów ćwiczeń (Wkrótce w Studio):
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {getAllExerciseTypes().filter(t => !t.isReady).map(t => (
                    <div key={t.type} className="p-3.5 rounded-xl border border-white/5 bg-white/[0.02] opacity-60 flex flex-col justify-between">
                      <div className="font-semibold text-xs text-slate-300">{t.label}</div>
                      <span className="text-[9px] font-mono text-amber-400 mt-2">W przygotowaniu</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. KREATOR / EDYTOR ĆWICZENIA */}
          {activeTab === 'editor' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h2 className="text-base font-bold text-text-hi">
                    {selectedExercise?.id ? 'Edycja koła fortuny' : 'Nowe koło fortuny'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Skonfiguruj listę segmentów, pytania oraz zachowanie po wylosowaniu.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setActiveTab('preview')}
                    className="text-xs flex items-center gap-1.5"
                  >
                    <Eye size={13} />
                    Testuj na żywo
                  </Button>

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleSave}
                    className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold flex items-center gap-1.5 px-4"
                  >
                    {saveSuccess ? <Check size={14} /> : <Save size={14} />}
                    {saveSuccess ? 'Zapisano!' : 'Zapisz ćwiczenie'}
                  </Button>
                </div>
              </div>

              {/* Główne parametry */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Tytuł ćwiczenia:</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="np. Business Negotiations Warm-up Wheel"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-black/30 text-sm text-text-hi focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Poziom CEFR:</label>
                  <select
                    value={formCefr}
                    onChange={(e) => setFormCefr(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-black/30 text-sm text-text-hi focus:outline-none focus:border-emerald-500"
                  >
                    <option value="A1-A2">A1-A2 (Elementary)</option>
                    <option value="B1-B2">B1-B2 (Intermediate)</option>
                    <option value="B2-C1">B2-C1 (Upper Intermediate / Advanced)</option>
                    <option value="C1-C2">C1-C2 (Proficiency)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Instrukcja dla kursanta (opcjonalnie):</label>
                <input
                  type="text"
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                  placeholder="np. Zakręć kołem i odpowiedz pełnym zdaniem na wylosowane pytanie..."
                  className="w-full px-3.5 py-2 rounded-xl border border-white/10 bg-black/30 text-xs text-text-hi focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Opcja: Znikające segmenty */}
              <div className="p-3.5 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-text-hi">Znikający segment po wylosowaniu (Remove on hit)</div>
                  <div className="text-[11px] text-slate-400">
                    Wylosowany element zostaje oznaczony jako zużyty i nie pojawia się w kolejnych zakręceniach.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formRemoveOnHit}
                  onChange={(e) => setFormRemoveOnHit(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500/40 bg-black/30 border-white/20"
                />
              </div>

              {/* Lista segmentów koła */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Segmenty koła ({formItems.length}):
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleAddItem}
                    className="text-xs flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                  >
                    <Plus size={13} />
                    Dodaj segment
                  </Button>
                </div>

                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {formItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3.5 rounded-xl border border-white/10 bg-black/20 flex flex-col sm:flex-row items-start sm:items-center gap-3"
                    >
                      <span className="text-xs font-mono font-bold text-slate-500 shrink-0">
                        #{idx + 1}
                      </span>

                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 w-full">
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => handleUpdateItem(idx, 'label', e.target.value)}
                          placeholder="Etykieta na kole (krótka)"
                          className="sm:col-span-4 px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/30 text-xs text-text-hi focus:outline-none focus:border-emerald-500"
                        />
                        <input
                          type="text"
                          value={item.prompt || ''}
                          onChange={(e) => handleUpdateItem(idx, 'prompt', e.target.value)}
                          placeholder="Pełne pytanie / prompt do dyskusji..."
                          className="sm:col-span-6 px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/30 text-xs text-text-hi focus:outline-none focus:border-emerald-500"
                        />
                        <input
                          type="text"
                          value={item.category || ''}
                          onChange={(e) => handleUpdateItem(idx, 'category', e.target.value)}
                          placeholder="Kategoria"
                          className="sm:col-span-2 px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/30 text-xs text-text-hi focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. PODGLĄD NA ŻYWO (PREVIEW) */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div>
                  <h2 className="text-base font-bold text-text-hi">Podgląd na żywo</h2>
                  <p className="text-xs text-slate-400">
                    Przetestuj animację obrotu i losowanie tak, jak zobaczy to kursant.
                  </p>
                </div>
                {onLaunchExercise && selectedExercise && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      onLaunchExercise(selectedExercise);
                      onClose();
                    }}
                    className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold flex items-center gap-1.5 px-4"
                  >
                    <Play size={13} />
                    Uruchom w lekcji
                  </Button>
                )}
              </div>

              <div className="py-2">
                <WheelOfFortune
                  items={currentPreviewPayload.items}
                  removeOnHit={currentPreviewPayload.removeOnHit}
                  exerciseTitle={currentPreviewPayload.title}
                  mode="focus"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExerciseStudioModal;
