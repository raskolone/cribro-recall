import React, { useState } from 'react';
import { 
  Layers, Plus, Trash2, ArrowUp, ArrowDown, CheckSquare, 
  Square, Edit2, RotateCcw, Sparkles, BookOpen, Check, X, Bookmark, 
  Sliders, Save, GripVertical, Settings2, SlidersHorizontal, HelpCircle,
  Clock, CheckCircle2
} from 'lucide-react';
import { LessonModuleConfig, LessonPlanPreset, LessonPlannerCustomSettings } from '../../types';
import { useEscapeModal } from '../../hooks/useEscapeModal';
import { 
  DEFAULT_LESSON_MODULES, 
  SAMPLE_MODULES_CATALOG, 
  LESSON_PRESETS 
} from './lessonPlannerPresets';

interface LessonModulesConfigProps {
  isOpen: boolean;
  onClose: () => void;
  modules: LessonModuleConfig[];
  onChangeModules: (modules: LessonModuleConfig[]) => void;
  selectedPresetId?: string;
  onSelectPreset?: (preset: LessonPlanPreset) => void;
  customSettings: LessonPlannerCustomSettings;
  onChangeCustomSettings: (settings: LessonPlannerCustomSettings) => void;
  customPresets: LessonPlanPreset[];
  onSaveCustomPreset: (name: string, description: string) => void;
  onDeleteCustomPreset: (presetId: string) => void;
}

export const LessonModulesConfig: React.FC<LessonModulesConfigProps> = ({
  isOpen,
  onClose,
  modules,
  onChangeModules,
  selectedPresetId,
  onSelectPreset,
  customSettings,
  onChangeCustomSettings,
  customPresets,
  onSaveCustomPreset,
  onDeleteCustomPreset
}) => {
  const [activeTab, setActiveTab] = useState<'modules' | 'prompt' | 'presets' | 'methodology'>('modules');

  // Drag & Drop State for modules in configurator
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; duration: string; placeholderInstruction: string }>({
    title: '',
    duration: '',
    placeholderInstruction: ''
  });

  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [newCustomModule, setNewCustomModule] = useState({
    title: '',
    duration: '10–15 min',
    placeholderInstruction: ''
  });

  // Save preset modal
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [presetDescInput, setPresetDescInput] = useState('');

  // ESC handling for main modal and submodals (submodals take priority)
  useEscapeModal(isOpen, onClose, 0);
  useEscapeModal(showCatalogModal, () => setShowCatalogModal(false), 5);
  useEscapeModal(showAddCustomModal, () => setShowAddCustomModal(false), 5);
  useEscapeModal(showSavePresetModal, () => setShowSavePresetModal(false), 5);

  if (!isOpen) return null;

  const activeCount = modules.filter(m => m.enabled).length;
  const allPresets = [...LESSON_PRESETS, ...customPresets];

  const handleToggleModule = (id: string) => {
    onChangeModules(
      modules.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m)
    );
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const next = [...modules];
    const moved = next.splice(draggedIndex, 1)[0];
    next.splice(targetIndex, 0, moved);
    const updated = next.map((m, idx) => ({ ...m, order: idx + 1 }));

    onChangeModules(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...modules];
    const temp = next[index];
    next[index] = next[index - 1];
    next[index - 1] = temp;
    const updated = next.map((m, idx) => ({ ...m, order: idx + 1 }));
    onChangeModules(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index >= modules.length - 1) return;
    const next = [...modules];
    const temp = next[index];
    next[index] = next[index + 1];
    next[index + 1] = temp;
    const updated = next.map((m, idx) => ({ ...m, order: idx + 1 }));
    onChangeModules(updated);
  };

  const handleDeleteModule = (id: string) => {
    if (modules.length <= 1) {
      alert('Plan lekcji musi zawierać co najmniej jeden moduł.');
      return;
    }
    const updated = modules
      .filter(m => m.id !== id)
      .map((m, idx) => ({ ...m, order: idx + 1 }));
    onChangeModules(updated);
  };

  const handleStartEdit = (module: LessonModuleConfig) => {
    setEditingModuleId(module.id);
    setEditForm({
      title: module.title,
      duration: module.duration || '',
      placeholderInstruction: module.placeholderInstruction || ''
    });
  };

  const handleSaveEdit = (id: string) => {
    if (!editForm.title.trim()) return;
    onChangeModules(
      modules.map(m => m.id === id ? {
        ...m,
        title: editForm.title.trim(),
        duration: editForm.duration.trim() || undefined,
        placeholderInstruction: editForm.placeholderInstruction.trim()
      } : m)
    );
    setEditingModuleId(null);
  };

  const handleCancelEdit = () => {
    setEditingModuleId(null);
  };

  const handleAddFromCatalog = (item: typeof SAMPLE_MODULES_CATALOG[0]) => {
    const newMod: LessonModuleConfig = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      order: modules.length + 1,
      title: `${modules.length + 1}. ${item.title}`,
      duration: item.duration,
      placeholderInstruction: item.placeholderInstruction,
      enabled: true,
      isCustom: true
    };
    onChangeModules([...modules, newMod]);
    setShowCatalogModal(false);
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomModule.title.trim()) return;

    const newMod: LessonModuleConfig = {
      id: `custom-${Date.now()}`,
      order: modules.length + 1,
      title: `${modules.length + 1}. ${newCustomModule.title.trim()}`,
      duration: newCustomModule.duration.trim() || undefined,
      placeholderInstruction: newCustomModule.placeholderInstruction.trim() || 'Wskazówki dla AI do wygenerowania tego etapu lekcji.',
      enabled: true,
      isCustom: true
    };
    onChangeModules([...modules, newMod]);
    setNewCustomModule({ title: '', duration: '10–15 min', placeholderInstruction: '' });
    setShowAddCustomModal(false);
  };

  const handleResetToDefault = () => {
    if (window.confirm('Czy na pewno chcesz przywrócić domyślne 5 modułów ze zdjęcia?')) {
      onChangeModules(DEFAULT_LESSON_MODULES);
    }
  };

  const handleSaveCurrentAsPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetNameInput.trim()) return;
    onSaveCustomPreset(presetNameInput.trim(), presetDescInput.trim());
    setPresetNameInput('');
    setPresetDescInput('');
    setShowSavePresetModal(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-base-200 border border-white/20 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-base-100/90 to-base-200/90 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/20 text-primary border border-primary/30 shadow-sm">
              <Settings2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base sm:text-lg text-white">
                  Konfigurator planu nauczania & Ustawienia AI
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 font-mono text-[11px] font-bold">
                  {activeCount} / {modules.length} aktywnych
                </span>
              </div>
              <p className="text-xs text-content-muted mt-0.5">
                Spersonalizuj układ bloków lekcji, metodykę, szablony oraz własne wytyczne dla generatora AI.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-content-muted hover:text-white transition-colors"
              title="Zamknij okno ustawień"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sub-tabs Navigation */}
        <div className="px-4 sm:px-6 pt-3 border-b border-white/10 bg-base-100/60 flex items-center justify-between gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-3 text-xs w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('modules')}
              className={`px-4 py-2 rounded-xl font-extrabold flex items-center gap-1.5 transition-all text-xs shrink-0 cursor-pointer ${
                activeTab === 'modules'
                  ? 'bg-primary text-accent-ink shadow-[0_0_15px_rgba(114,240,180,0.35)]'
                  : 'text-content-muted hover:text-white bg-white/5 hover:bg-white/10'
              }`}
            >
              <Layers size={14} />
              <span>Moduły scenariusza ({modules.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('methodology')}
              className={`px-4 py-2 rounded-xl font-extrabold flex items-center gap-1.5 transition-all text-xs shrink-0 cursor-pointer ${
                activeTab === 'methodology'
                  ? 'bg-primary text-accent-ink shadow-[0_0_15px_rgba(114,240,180,0.35)]'
                  : 'text-content-muted hover:text-white bg-white/5 hover:bg-white/10'
              }`}
            >
              <SlidersHorizontal size={14} />
              <span>Metodyka & Zadania</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('prompt')}
              className={`px-4 py-2 rounded-xl font-extrabold flex items-center gap-1.5 transition-all text-xs shrink-0 cursor-pointer ${
                activeTab === 'prompt'
                  ? 'bg-primary text-accent-ink shadow-[0_0_15px_rgba(114,240,180,0.35)]'
                  : 'text-content-muted hover:text-white bg-white/5 hover:bg-white/10'
              }`}
            >
              <Sliders size={14} />
              <span>Własny Master Prompt AI</span>
              {customSettings.customPrompt && (
                <span className="w-2 h-2 rounded-full bg-warn shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`px-4 py-2 rounded-xl font-extrabold flex items-center gap-1.5 transition-all text-xs shrink-0 cursor-pointer ${
                activeTab === 'presets'
                  ? 'bg-primary text-accent-ink shadow-[0_0_15px_rgba(114,240,180,0.35)]'
                  : 'text-content-muted hover:text-white bg-white/5 hover:bg-white/10'
              }`}
            >
              <Bookmark size={14} />
              <span>Szablony ({allPresets.length})</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 pb-3">
            <button
              type="button"
              onClick={() => setShowSavePresetModal(true)}
              className="px-3.5 py-2 rounded-xl bg-primary/20 hover:bg-primary text-primary hover:text-accent-ink border border-primary/40 text-xs font-bold flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(114,240,180,0.2)] hover:shadow-[0_0_18px_rgba(114,240,180,0.4)] cursor-pointer"
              title="Zapisz ten zestaw modułów jako szablon"
            >
              <Save size={13} />
              <span>Zapisz jako szablon</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: MODULES LIST & EDITING */}
          {activeTab === 'modules' && (
            <div className="space-y-4">
              {/* Presets Quick Bar inside Tab */}
              <div className="p-3 rounded-2xl bg-base-100/70 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <Bookmark size={14} className="text-primary" />
                  <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                    Szybki wybór profilu lekcji:
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {allPresets.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => onSelectPreset && onSelectPreset(preset)}
                        className={`px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-1 ${
                          isSelected
                            ? 'bg-primary text-accent-ink border-primary font-bold shadow-sm'
                            : 'bg-base-200 text-content-muted border-white/10 hover:text-white hover:border-white/25'
                        }`}
                      >
                        <span>{preset.name}</span>
                        {preset.isCustom && (
                          <span className="text-[9px] px-1 rounded bg-black/30 font-bold">Mój</span>
                        )}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-white border border-white/10 text-[11px] font-medium flex items-center gap-1 transition-colors"
                    title="Przywróć standardowy wzór 5 modułów ze zdjęcia"
                  >
                    <RotateCcw size={11} />
                    <span>Wzór ze zdjęcia</span>
                  </button>
                </div>
              </div>

              {/* Drag and Drop instructions note */}
              <div className="flex items-center justify-between text-xs text-content-muted px-1">
                <span className="flex items-center gap-1 font-medium">
                  <GripVertical size={13} className="text-primary" /> 
                  Przeciągaj moduły (Drag & Drop), aby zmienić ich kolejność w konspekcie
                </span>
                <span className="text-[11px] font-mono">
                  {activeCount} z {modules.length} modułów będzie generowanych
                </span>
              </div>

              {/* Module Items with Drag and Drop */}
              <div className="space-y-2.5">
                {modules.map((mod, idx) => {
                  const isEditing = editingModuleId === mod.id;
                  const isDragging = draggedIndex === idx;
                  const isDragOver = dragOverIndex === idx;

                  return (
                    <div
                      key={mod.id}
                      draggable={!isEditing}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`rounded-2xl border transition-all ${
                        isDragging
                          ? 'opacity-40 border-dashed border-primary scale-[0.99]'
                          : isDragOver
                          ? 'border-primary ring-2 ring-primary/40 bg-primary/10 scale-[1.01]'
                          : isEditing
                          ? 'border-primary/50 bg-base-100 shadow-md'
                          : mod.enabled
                          ? 'border-white/15 bg-base-100/90 shadow-sm hover:border-white/25'
                          : 'border-white/5 bg-base-100/30 opacity-60'
                      }`}
                    >
                      {isEditing ? (
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-primary">
                              Edycja modułu #{idx + 1}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(mod.id)}
                                className="px-3 py-1.5 rounded-lg bg-primary text-accent-ink font-bold text-xs flex items-center gap-1 shadow-sm hover:brightness-110"
                              >
                                <Check size={13} />
                                <span>Zapisz</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="px-2.5 py-1.5 rounded-lg bg-white/10 text-content-muted hover:text-white text-xs flex items-center gap-1"
                              >
                                <X size={13} />
                                <span>Anuluj</span>
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                            <div className="sm:col-span-2 space-y-1">
                              <label className="text-[11px] font-semibold text-content-muted">
                                Nazwa modułu (nagłówek ##):
                              </label>
                              <input
                                type="text"
                                value={editForm.title}
                                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                placeholder="np. 2. Main Topic (25–30 min)"
                                className="w-full px-3 py-2 rounded-xl bg-base-200 border border-white/20 text-white focus:border-primary focus:outline-none"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-content-muted">
                                Czas trwania:
                              </label>
                              <input
                                type="text"
                                value={editForm.duration}
                                onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })}
                                placeholder="np. 20 min"
                                className="w-full px-3 py-2 rounded-xl bg-base-200 border border-white/20 text-white focus:border-primary focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-1 text-xs">
                            <label className="text-[11px] font-semibold text-content-muted">
                              Wskazówki i instrukcje dla AI (placeholder/prompt):
                            </label>
                            <textarea
                              rows={2}
                              value={editForm.placeholderInstruction}
                              onChange={(e) => setEditForm({ ...editForm, placeholderInstruction: e.target.value })}
                              placeholder="Opisz, co dokładnie AI ma przygotować w tym module..."
                              className="w-full px-3 py-2 rounded-xl bg-base-200 border border-white/20 text-white focus:border-primary focus:outline-none resize-none font-sans"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Checkbox and Title */}
                          <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                            {/* Drag handle */}
                            <span 
                              className="mt-0.5 sm:mt-0 text-content-muted/60 hover:text-primary cursor-grab active:cursor-grabbing p-1 rounded hover:bg-white/5 transition-colors shrink-0"
                              title="Przeciągnij moduł, aby zmienić kolejność"
                            >
                              <GripVertical size={16} />
                            </span>

                            <button
                              type="button"
                              onClick={() => handleToggleModule(mod.id)}
                              className="mt-0.5 sm:mt-0 text-primary hover:brightness-125 transition-transform active:scale-90 shrink-0"
                              title={mod.enabled ? 'Wyłącz ten moduł z generowania' : 'Włącz ten moduł do generowania'}
                            >
                              {mod.enabled ? (
                                <CheckSquare size={19} className="text-primary" />
                              ) : (
                                <Square size={19} className="text-content-muted" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs sm:text-sm text-white truncate">
                                  {mod.title}
                                </span>
                                {mod.duration && (
                                  <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-content-muted">
                                    ⏱ {mod.duration}
                                  </span>
                                )}
                                {mod.isCustom && (
                                  <span className="px-1.5 py-0.2 rounded bg-accent-blue/20 text-accent-blue border border-accent-blue/30 text-[9px] font-bold">
                                    Własny
                                  </span>
                                )}
                              </div>
                              {mod.placeholderInstruction && (
                                <p className="text-[11px] text-content-muted mt-0.5 line-clamp-1">
                                  {mod.placeholderInstruction}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveUp(idx)}
                              disabled={idx === 0}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-20 text-content-muted hover:text-white transition-all cursor-pointer"
                              title="Przesuń wyżej"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveDown(idx)}
                              disabled={idx === modules.length - 1}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-20 text-content-muted hover:text-white transition-all cursor-pointer"
                              title="Przesuń niżej"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(mod)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-primary/20 text-content-muted hover:text-primary transition-all ml-1 hover:shadow-[0_0_10px_rgba(114,240,180,0.3)] cursor-pointer"
                              title="Edytuj nazwę i instrukcje modułu"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteModule(mod.id)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-content-muted hover:text-red-400 transition-all hover:shadow-[0_0_10px_rgba(248,113,113,0.35)] cursor-pointer"
                              title="Usuń moduł"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Add Buttons */}
              <div className="flex items-center gap-2.5 pt-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowCatalogModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-primary/50 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-sm hover:shadow-[0_0_15px_rgba(114,240,180,0.2)] cursor-pointer"
                >
                  <BookOpen size={15} className="text-primary" />
                  <span>Wstaw z biblioteki modułów</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddCustomModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/40 hover:border-primary text-primary hover:text-white font-extrabold text-xs flex items-center gap-2 transition-all shadow-[0_0_12px_rgba(114,240,180,0.15)] hover:shadow-[0_0_18px_rgba(114,240,180,0.35)] cursor-pointer"
                >
                  <Plus size={15} className="text-primary" />
                  <span>Stwórz własny moduł</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: METHODOLOGY & TASKS */}
          {activeTab === 'methodology' && (
            <div className="p-5 rounded-2xl bg-base-100/80 border border-white/10 space-y-5 text-xs">
              <div className="border-b border-white/10 pb-3">
                <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-primary" />
                  Ustawienia metodyczne i preferencje ćwiczeń
                </h4>
                <p className="text-xs text-content-muted mt-0.5">
                  Dostosuj odmianę języka, format zadań domowych oraz liczbę słówek.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 p-3 rounded-xl bg-base-200/60 border border-white/10">
                  <label className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>Odmiana języka angielskiego:</span>
                  </label>
                  <select
                    value={customSettings.englishVariety}
                    onChange={(e) => onChangeCustomSettings({ ...customSettings, englishVariety: e.target.value as any })}
                    className="w-full px-3 py-2.5 rounded-xl bg-base-200 border border-white/15 text-white focus:border-primary focus:outline-none"
                  >
                    <option value="any">Uniwersalny / Standard (Global English)</option>
                    <option value="british">British English (UK - pisownia, akcent, idiomy)</option>
                    <option value="american">American English (US - pisownia, zwroty amerykańskie)</option>
                  </select>
                </div>

                <div className="space-y-1.5 p-3 rounded-xl bg-base-200/60 border border-white/10">
                  <label className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>Liczba zwrotów w module słownictwa:</span>
                  </label>
                  <select
                    value={customSettings.vocabCount}
                    onChange={(e) => onChangeCustomSettings({ ...customSettings, vocabCount: parseInt(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl bg-base-200 border border-white/15 text-white focus:border-primary focus:outline-none font-bold text-primary"
                  >
                    <option value={5}>5 kluczowych zwrotów</option>
                    <option value={8}>8 zwrotów (zalecane)</option>
                    <option value={10}>10 zwrotów</option>
                    <option value={15}>15 zwrotów (intensywne)</option>
                  </select>
                </div>

                <div className="space-y-1.5 p-3 rounded-xl bg-base-200/60 border border-white/10">
                  <label className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>Styl objaśnień gramatycznych:</span>
                  </label>
                  <select
                    value={customSettings.explanationStyle}
                    onChange={(e) => onChangeCustomSettings({ ...customSettings, explanationStyle: e.target.value as any })}
                    className="w-full px-3 py-2.5 rounded-xl bg-base-200 border border-white/15 text-white focus:border-primary focus:outline-none"
                  >
                    <option value="concise">Krótkie i konkretne w punktach (Bullet points)</option>
                    <option value="detailed">Szczegółowe z analizą niuansów i typowych pułapek</option>
                  </select>
                </div>

                <div className="space-y-1.5 p-3 rounded-xl bg-base-200/60 border border-white/10">
                  <label className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>Format pracy domowej:</span>
                  </label>
                  <select
                    value={customSettings.homeworkType}
                    onChange={(e) => onChangeCustomSettings({ ...customSettings, homeworkType: e.target.value as any })}
                    className="w-full px-3 py-2.5 rounded-xl bg-base-200 border border-white/15 text-white focus:border-primary focus:outline-none"
                  >
                    <option value="translation">Tłumaczenia zdań PL → EN (sprawdzenie słownictwa)</option>
                    <option value="writing">Pisanie krótkiego tekstu / maila biznesowego</option>
                    <option value="speaking">Przygotowanie wypowiedzi ustnej (2-min pitch)</option>
                    <option value="mixed">Mieszane (4 zdania do tłumaczenia + mini-case)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOM MASTER PROMPT */}
          {activeTab === 'prompt' && (
            <div className="p-5 rounded-2xl bg-base-100/80 border border-white/10 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders size={16} className="text-primary" />
                  <div>
                    <h4 className="font-extrabold text-sm text-white">
                      Własny Master Prompt & Dyrektywy Lektora
                    </h4>
                    <p className="text-xs text-content-muted">
                      Wprowadź stałe zasady, formatowanie lub styl, który AI ma zawsze stosować przy tworzeniu lekcji.
                    </p>
                  </div>
                </div>
                {customSettings.customPrompt && (
                  <button
                    type="button"
                    onClick={() => onChangeCustomSettings({ ...customSettings, customPrompt: '' })}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-content-muted hover:text-white text-[11px] transition-colors"
                  >
                    Wyczyść prompt
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <textarea
                  value={customSettings.customPrompt}
                  onChange={(e) => onChangeCustomSettings({ ...customSettings, customPrompt: e.target.value })}
                  placeholder="Np. Zawsze dodawaj 3 pytania do dyskusji pod każdym nowym idiomek. Podawaj transkrypcję fonetyczną IPA dla trudniejszych słów. Unikaj formalnego żargonu akademickiego..."
                  rows={8}
                  className="w-full p-4 rounded-2xl bg-base-200 border border-white/15 text-white focus:border-primary focus:outline-none text-xs leading-relaxed font-sans"
                />
              </div>

              {/* Sample prompt quick insertions */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider block">
                  Gotowe formuły do wklejenia:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = 'Zawsze podawaj wymowę fonetyczną (IPA) dla zaawansowanego słownictwa oraz 2 naturalne synonimy.';
                      onChangeCustomSettings({
                        ...customSettings,
                        customPrompt: customSettings.customPrompt ? `${customSettings.customPrompt}\n${snippet}` : snippet
                      });
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-base-200 hover:bg-base-200/80 border border-white/10 hover:border-primary/40 text-content-muted hover:text-white text-[11px] transition-all"
                  >
                    + Wymowa IPA & Synonimy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = 'Skup się na dialogach biznesowych (Executive Business English) z podziałem ról Manager vs Klient.';
                      onChangeCustomSettings({
                        ...customSettings,
                        customPrompt: customSettings.customPrompt ? `${customSettings.customPrompt}\n${snippet}` : snippet
                      });
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-base-200 hover:bg-base-200/80 border border-white/10 hover:border-primary/40 text-content-muted hover:text-white text-[11px] transition-all"
                  >
                    + Dialogi biznesowe Role-play
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = 'W sekcji ćwiczeń dołącz pytania typu "Open-ended Debate" prowokujące do używania czasu Present Perfect i Past Simple.';
                      onChangeCustomSettings({
                        ...customSettings,
                        customPrompt: customSettings.customPrompt ? `${customSettings.customPrompt}\n${snippet}` : snippet
                      });
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-base-200 hover:bg-base-200/80 border border-white/10 hover:border-primary/40 text-content-muted hover:text-white text-[11px] transition-all"
                  >
                    + Debata gramatyczna
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PRESETS MANAGEMENT */}
          {activeTab === 'presets' && (
            <div className="p-5 rounded-2xl bg-base-100/80 border border-white/10 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Bookmark size={16} className="text-primary" />
                  <h4 className="font-extrabold text-sm text-white">
                    Zarządzanie szablonami lekcji
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSavePresetModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-primary text-accent-ink font-bold text-xs flex items-center gap-1.5 shadow-sm hover:brightness-110"
                >
                  <Plus size={13} />
                  <span>Nowy szablon z bieżącego układu</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allPresets.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;

                  return (
                    <div
                      key={preset.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-primary/50 bg-base-200/90 shadow-md'
                          : 'border-white/10 bg-base-200/40 hover:border-white/20'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-white text-sm">
                              {preset.name}
                            </span>
                            {preset.isCustom ? (
                              <span className="px-2 py-0.5 rounded-md bg-accent-blue/20 text-accent-blue border border-accent-blue/30 text-[9px] font-bold">
                                Własny
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-white/5 text-content-muted text-[9px] font-bold">
                                Wbudowany
                              </span>
                            )}
                          </div>
                          {preset.isCustom && (
                            <button
                              type="button"
                              onClick={() => onDeleteCustomPreset(preset.id)}
                              className="p-1 rounded-lg text-content-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Usuń ten szablon"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-content-muted">
                          {preset.description || 'Brak opisu szablonu.'}
                        </p>
                        <div className="text-[11px] text-primary/90 font-mono pt-1">
                          {preset.modules.length} modułów • {preset.defaultDuration || '60 min'}
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => onSelectPreset && onSelectPreset(preset)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-primary text-accent-ink shadow-sm'
                              : 'bg-white/5 hover:bg-white/10 text-white'
                          }`}
                        >
                          {isSelected ? '✓ Aktywny szablon' : 'Wczytaj ten szablon'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-4 sm:p-5 bg-base-100/90 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-content-muted">
            Zmiany są automatycznie zapamiętywane w Twojej przeglądarce.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-primary text-accent-ink font-extrabold text-xs shadow-md hover:brightness-110 flex items-center gap-1.5 transition-all"
          >
            <Check size={15} />
            <span>Zapisz i zamknij</span>
          </button>
        </div>
      </div>

      {/* SUB-MODAL: Catalog of Sample Modules */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-base-200 border border-white/20 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/20 text-primary">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-white">
                    Biblioteka gotowych modułów lekcji
                  </h4>
                  <p className="text-xs text-content-muted">
                    Wybierz moduł, który chcesz dołączyć do bieżącego scenariusza zajęć.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2.5">
              {SAMPLE_MODULES_CATALOG.map((catItem, cIdx) => (
                <div
                  key={cIdx}
                  className="p-3.5 rounded-2xl bg-base-100/90 border border-white/10 hover:border-primary/40 flex items-center justify-between gap-3 transition-all group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-white group-hover:text-primary transition-colors">
                        {catItem.title}
                      </span>
                      {catItem.duration && (
                        <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-content-muted border border-white/5">
                          {catItem.duration}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-content-muted mt-0.5">
                      {catItem.placeholderInstruction}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddFromCatalog(catItem)}
                    className="px-3 py-1.5 rounded-xl bg-primary/15 hover:bg-primary text-primary hover:text-accent-ink font-bold text-xs flex items-center gap-1 transition-all shrink-0"
                  >
                    <Plus size={13} />
                    <span>Wstaw</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: Create Custom Module */}
      {showAddCustomModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-base-200 border border-white/20 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/20 text-primary">
                  <Plus size={18} />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-white">
                    Stwórz własny moduł
                  </h4>
                  <p className="text-xs text-content-muted">
                    Zdefiniuj własny nagłówek i instrukcje dla generatora AI.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustomModal(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCustom} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                  Nazwa modułu:
                </label>
                <input
                  type="text"
                  required
                  value={newCustomModule.title}
                  onChange={(e) => setNewCustomModule({ ...newCustomModule, title: e.target.value })}
                  placeholder="np. Szybka powtórka słówek z poprzedniej lekcji"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-base-100 border border-white/15 text-white focus:border-primary focus:outline-none font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                  Orientacyjny czas trwania:
                </label>
                <input
                  type="text"
                  value={newCustomModule.duration}
                  onChange={(e) => setNewCustomModule({ ...newCustomModule, duration: e.target.value })}
                  placeholder="np. 10 min"
                  className="w-full px-3.5 py-2 rounded-xl bg-base-100 border border-white/15 text-white focus:border-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                  Instrukcje / Prompt dla AI:
                </label>
                <textarea
                  rows={3}
                  value={newCustomModule.placeholderInstruction}
                  onChange={(e) => setNewCustomModule({ ...newCustomModule, placeholderInstruction: e.target.value })}
                  placeholder="Opisz, co dokładnie AI ma przygotować w tym module lekcji..."
                  className="w-full p-3 rounded-xl bg-base-100 border border-white/15 text-white focus:border-primary focus:outline-none resize-none font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddCustomModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-content-muted hover:text-white text-xs font-semibold"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={!newCustomModule.title.trim()}
                  className="px-5 py-2 rounded-xl bg-primary text-accent-ink font-extrabold text-xs shadow-md hover:brightness-110 disabled:opacity-40"
                >
                  Dodaj moduł
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL: Save Current as Preset */}
      {showSavePresetModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-base-200 border border-white/20 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/20 text-primary">
                  <Bookmark size={18} />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-white">
                    Zapisz bieżący układ jako szablon
                  </h4>
                  <p className="text-xs text-content-muted">
                    Będziesz mógł wczytać ten zestaw modułów jednym kliknięciem.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCurrentAsPreset} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                  Nazwa szablonu:
                </label>
                <input
                  type="text"
                  required
                  value={presetNameInput}
                  onChange={(e) => setPresetNameInput(e.target.value)}
                  placeholder="np. Mój ulubiony model 60-minutowy"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-base-100 border border-white/15 text-white focus:border-primary focus:outline-none font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                  Krótki opis (opcjonalnie):
                </label>
                <input
                  type="text"
                  value={presetDescInput}
                  onChange={(e) => setPresetDescInput(e.target.value)}
                  placeholder="np. Do intensywnych konwersacji B2+ z naciskiem na idiomy"
                  className="w-full px-3.5 py-2 rounded-xl bg-base-100 border border-white/15 text-white focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowSavePresetModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-content-muted hover:text-white text-xs font-semibold"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={!presetNameInput.trim()}
                  className="px-5 py-2 rounded-xl bg-primary text-accent-ink font-extrabold text-xs shadow-md hover:brightness-110 disabled:opacity-40"
                >
                  Zapisz szablon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonModulesConfig;
