import React, { useState, useEffect, useMemo } from 'react';
import { LessonScenario, LessonBlock, BlockType } from '../../types/planner';
import { Presentation } from '../../types/presentation';
import { UserWithId } from '../../services/userService';
import { 
  saveLessonScenario, 
  getLessonPlansForStudent, 
  getDefaultScenarioTemplate 
} from '../../services/plannerService';
import { getTeacherPresentations } from '../../services/presentationStudioService';
import { PlannerBlockItem, BLOCK_TYPE_CONFIG } from './PlannerBlockItem';
import { 
  Clock, 
  Plus, 
  Save, 
  CheckCircle2, 
  Sparkles, 
  Airplay, 
  Users, 
  Calendar, 
  Target, 
  BookOpen, 
  ArrowLeft,
  FileText,
  AlertCircle,
  FolderOpen
} from 'lucide-react';
import { ModuleHelpButton } from '../common/ModuleHelpButton';

interface LessonPlannerStudioProps {
  selectedUser?: UserWithId | null;
  users?: UserWithId[];
  currentUser?: any;
  onSelectUser?: (user: UserWithId | null) => void;
  onBack?: () => void;
  onOpenPresentationStudio?: (presentationId?: string) => void;
}

export const LessonPlannerStudio: React.FC<LessonPlannerStudioProps> = ({
  selectedUser,
  users = [],
  currentUser,
  onSelectUser,
  onBack,
  onOpenPresentationStudio,
}) => {
  const teacherId = currentUser?.uid || currentUser?.id || 'teacher_local';
  const initialStudentId = selectedUser?.id || '';

  // Stan scenariusza
  const [scenario, setScenario] = useState<LessonScenario>(() =>
    getDefaultScenarioTemplate(initialStudentId, teacherId)
  );

  // Lista powiązanych prezentacji z modułu PresentationStudio
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  // Zapisane wcześniejsze scenariusze dla danego kursanta
  const [savedPlans, setSavedPlans] = useState<LessonScenario[]>([]);
  const [isSavedPlansModalOpen, setIsSavedPlansModalOpen] = useState(false);

  // Statusy zapisu i komunikaty
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Aktualizacja studentId jeśli zmieni się selectedUser z zewnątrz
  useEffect(() => {
    if (selectedUser?.id && selectedUser.id !== scenario.studentId) {
      setScenario((prev) => ({
        ...prev,
        studentId: selectedUser.id,
      }));
    }
  }, [selectedUser?.id]);

  // Pobranie prezentacji lektora
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const presList = await getTeacherPresentations(teacherId);
        if (isMounted) setPresentations(presList);

        if (scenario.studentId) {
          const plans = await getLessonPlansForStudent(teacherId, scenario.studentId);
          if (isMounted) setSavedPlans(plans);
        }
      } catch (err) {
        console.warn('Błąd wczytywania danych do planera:', err);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [teacherId, scenario.studentId]);

  // Kalkulacja łącznego czasu trwania wszystkich bloków
  const totalMinutes = useMemo(() => {
    return scenario.blocks.reduce((sum, b) => sum + (Number(b.durationMinutes) || 0), 0);
  }, [scenario.blocks]);

  // Dynamiczny wskaźnik koloru paska postępu czasu:
  // szary/niebieski < 45, zielony 45-60, bursztynowy/czerwony > 60 min
  const progressColorStyle = useMemo(() => {
    if (totalMinutes < 45) {
      return {
        barBg: 'bg-sky-500',
        textColor: 'text-sky-400',
        borderColor: 'border-sky-500/40',
        label: 'Rozgrzewka / Poniżej 45 min',
      };
    }
    if (totalMinutes <= 60) {
      return {
        barBg: 'bg-emerald-500',
        textColor: 'text-emerald-400',
        borderColor: 'border-emerald-500/40',
        label: 'Idealny czas (45–60 min)',
      };
    }
    return {
      barBg: 'bg-amber-500',
      textColor: 'text-amber-400',
      borderColor: 'border-amber-500/40',
      label: 'Ponad 60 min (uwzględnij bufor)',
    };
  }, [totalMinutes]);

  // Zmiana studenta
  const handleStudentSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;
    const found = users.find((u) => u.id === sId) || null;
    onSelectUser?.(found);
    setScenario((prev) => ({
      ...prev,
      studentId: sId,
    }));
  };

  // Dodawanie nowego bloku
  const handleAddBlock = (type: BlockType = 'speaking') => {
    const config = BLOCK_TYPE_CONFIG[type];
    const newBlock: LessonBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      title: config.label,
      durationMinutes: type === 'speaking' ? 20 : type === 'warmup' || type === 'feedback' ? 5 : 10,
      content: '',
    };

    setScenario((prev) => ({
      ...prev,
      blocks: [...prev.blocks, newBlock],
    }));
  };

  // Aktualizacja bloku
  const handleUpdateBlock = (index: number, updated: LessonBlock) => {
    setScenario((prev) => {
      const nextBlocks = [...prev.blocks];
      nextBlocks[index] = updated;
      return { ...prev, blocks: nextBlocks };
    });
  };

  // Zmiana kolejności: w górę
  const handleMoveBlockUp = (index: number) => {
    if (index === 0) return;
    setScenario((prev) => {
      const nextBlocks = [...prev.blocks];
      const temp = nextBlocks[index - 1];
      nextBlocks[index - 1] = nextBlocks[index];
      nextBlocks[index] = temp;
      return { ...prev, blocks: nextBlocks };
    });
  };

  // Zmiana kolejności: w dół
  const handleMoveBlockDown = (index: number) => {
    if (index >= scenario.blocks.length - 1) return;
    setScenario((prev) => {
      const nextBlocks = [...prev.blocks];
      const temp = nextBlocks[index + 1];
      nextBlocks[index + 1] = nextBlocks[index];
      nextBlocks[index] = temp;
      return { ...prev, blocks: nextBlocks };
    });
  };

  // Usunięcie bloku
  const handleDeleteBlock = (index: number) => {
    setScenario((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((_, i) => i !== index),
    }));
  };

  // Zapis konspektu
  const handleSave = async (newStatus: 'draft' | 'planned' | 'completed') => {
    if (!scenario.studentId) {
      setFeedback({
        type: 'error',
        message: 'Wybierz kursanta, do którego ma zostać przypisany konspekt lekcji.',
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const toSave: LessonScenario = {
        ...scenario,
        status: newStatus,
        totalDurationMinutes: totalMinutes,
      };

      const planId = await saveLessonScenario(toSave);
      setScenario((prev) => ({ ...prev, id: planId, status: newStatus }));

      // Odśwież listę zapisanych planów
      const updatedList = await getLessonPlansForStudent(teacherId, scenario.studentId);
      setSavedPlans(updatedList);

      setFeedback({
        type: 'success',
        message:
          newStatus === 'planned'
            ? 'Lekcja została zatwierdzona i zaplanowana!'
            : 'Szkic konspektu został pomyślnie zapisany.',
      });

      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      console.error('Błąd zapisu scenariusza:', err);
      setFeedback({
        type: 'error',
        message: 'Wystąpił błąd podczas zapisywania scenariusza w chmurze.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── PASEK GÓRNY / NAGŁÓWEK KONSPEKTU ── */}
      <div className="p-5 rounded-3xl bg-base-200/95 border border-line-strong shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 rounded-xl border border-line bg-base-100 text-content-muted hover:text-text-hi hover:border-primary/50 transition-all cursor-pointer"
                title="Wróć"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(114,240,180,0.25)] shrink-0">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-text-hi tracking-tight">
                  Lesson Planner 2.0
                </h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-black">
                  Blokowy Konspekt
                </span>
                <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border font-bold ${
                  scenario.status === 'planned' 
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                    : 'bg-base-100 text-content-muted border-line'
                }`}>
                  {scenario.status === 'planned' ? 'Zatwierdzona' : 'Szkic'}
                </span>
                <ModuleHelpButton guideId="lesson-planner" />
              </div>
              <p className="text-xs text-content-muted">
                Precyzyjne planowanie jednostki lekcyjnej z podziałem na bloki czasowe i integracją ze slajdami
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {savedPlans.length > 0 && (
              <button
                type="button"
                onClick={() => setIsSavedPlansModalOpen(true)}
                className="px-3.5 py-2 rounded-xl border border-line bg-base-100/90 hover:bg-base-300 text-content font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <FolderOpen size={14} className="text-primary" />
                <span>Konspekty kursanta ({savedPlans.length})</span>
              </button>
            )}

            {onOpenPresentationStudio && (
              <button
                type="button"
                onClick={() => onOpenPresentationStudio()}
                className="px-3.5 py-2 rounded-xl border border-line bg-base-100/90 hover:bg-base-300 text-content font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
                title="Przejdź do studia tworzenia slajdów"
              >
                <Airplay size={14} className="text-primary" />
                <span>Moduł slajdów</span>
              </button>
            )}
          </div>
        </div>

        {/* ── WYBÓR KURSANTA, DATA I TEMAT ── */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
          <div className="sm:col-span-4 space-y-1.5">
            <label className="text-xs font-bold text-content-muted flex items-center gap-1.5">
              <Users size={13} className="text-primary" />
              <span>Przypisany kursant:</span>
            </label>
            <select
              value={scenario.studentId}
              onChange={handleStudentSelect}
              className="w-full px-3 py-2 rounded-xl bg-base-100 border border-line-strong text-text-hi font-bold text-xs sm:text-sm outline-none focus:border-primary cursor-pointer"
            >
              <option value="">Wybierz kursanta...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName || u.lastName
                    ? `${u.firstName || ''} ${u.lastName || ''}`.trim()
                    : u.username} ({u.level || 'B2'})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3 space-y-1.5">
            <label className="text-xs font-bold text-content-muted flex items-center gap-1.5">
              <Calendar size={13} className="text-primary" />
              <span>Data lekcji:</span>
            </label>
            <input
              type="date"
              value={scenario.date}
              onChange={(e) => setScenario((prev) => ({ ...prev, date: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-base-100 border border-line-strong text-text-hi font-mono text-xs sm:text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="sm:col-span-5 space-y-1.5">
            <label className="text-xs font-bold text-content-muted flex items-center gap-1.5">
              <FileText size={13} className="text-primary" />
              <span>Temat przewodni lekcji:</span>
            </label>
            <input
              type="text"
              value={scenario.topic}
              onChange={(e) => setScenario((prev) => ({ ...prev, topic: e.target.value }))}
              placeholder="np. Business Negotiations: Objection Handling"
              className="w-full px-3.5 py-2 rounded-xl bg-base-100 border border-line-strong text-text-hi font-bold text-xs sm:text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Cel główny lekcji */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-content-muted flex items-center gap-1.5">
            <Target size={13} className="text-primary" />
            <span>Główny cel lekcji (Main Goal):</span>
          </label>
          <input
            type="text"
            value={scenario.mainGoal}
            onChange={(e) => setScenario((prev) => ({ ...prev, mainGoal: e.target.value }))}
            placeholder="np. Kursant potrafi swobodnie zbić 3 najczęstsze obiekcje budżetowe klienta..."
            className="w-full px-3.5 py-2 rounded-xl bg-base-100/70 border border-line-strong text-content text-xs outline-none focus:border-primary"
          />
        </div>

        {/* ── PASEK POSTĘPU CZASU (SUMA MINUT) ── */}
        <div className={`p-4 rounded-2xl bg-base-100/80 border ${progressColorStyle.borderColor} space-y-2.5`}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Clock size={15} className={progressColorStyle.textColor} />
              <span className="font-bold text-text-hi">Zaplanowany czas lekcji:</span>
              <strong className={`text-base font-mono font-black ${progressColorStyle.textColor}`}>
                {totalMinutes} / 60 min
              </strong>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold ${progressColorStyle.textColor} bg-base-200 border ${progressColorStyle.borderColor}`}>
              {progressColorStyle.label}
            </span>
          </div>

          {/* Graficzny pasek postępu (0 - 60+ min) */}
          <div className="w-full h-2.5 rounded-full bg-base-300 overflow-hidden relative">
            <div
              className={`h-full rounded-full transition-all duration-300 ${progressColorStyle.barBg}`}
              style={{ width: `${Math.min(100, (totalMinutes / 60) * 100)}%` }}
            />
            {/* Wskaźnik celu 60 min */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/40"
              style={{ left: '100%' }}
              title="Standardowy limit 60 min"
            />
          </div>
        </div>
      </div>

      {/* Komunikaty zwrotne */}
      {feedback && (
        <div
          role="alert"
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
              : 'bg-red-500/15 border border-red-500/40 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-content-muted hover:text-white underline text-[11px]"
          >
            Zamknij
          </button>
        </div>
      )}

      {/* ── LISTA BLOKÓW LEKCYJNYCH ── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-content-muted flex items-center gap-2">
            <BookOpen size={16} className="text-primary" />
            <span>Bloki scenariusza ({scenario.blocks.length})</span>
          </h2>

          {/* Szybkie dodawanie konkretnego typu bloku */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(['warmup', 'recall', 'practice', 'speaking', 'feedback'] as BlockType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleAddBlock(t)}
                className="px-2.5 py-1 rounded-lg border border-line bg-base-100 hover:border-primary/50 text-[11px] font-bold text-content-muted hover:text-primary transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus size={11} />
                <span>{BLOCK_TYPE_CONFIG[t].label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {scenario.blocks.length === 0 ? (
          <div className="p-8 text-center rounded-3xl border border-dashed border-line-strong bg-base-200/40 space-y-3">
            <p className="text-content-muted text-sm">Konspekt jest pusty. Dodaj pierwszy blok lekcyjny.</p>
            <button
              type="button"
              onClick={() => handleAddBlock('warmup')}
              className="px-4 py-2 rounded-xl bg-primary text-accent-ink font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-btn"
            >
              <Plus size={14} />
              <span>Dodaj blok rozgrzewki (Warm-up)</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {scenario.blocks.map((block, idx) => (
              <PlannerBlockItem
                key={block.id}
                block={block}
                index={idx}
                totalBlocks={scenario.blocks.length}
                availablePresentations={presentations}
                onUpdate={(updated) => handleUpdateBlock(idx, updated)}
                onMoveUp={() => handleMoveBlockUp(idx)}
                onMoveDown={() => handleMoveBlockDown(idx)}
                onDelete={() => handleDeleteBlock(idx)}
                onOpenPresentation={onOpenPresentationStudio}
              />
            ))}
          </div>
        )}

        {/* Przycisk dodania kolejnego bloku na dole */}
        <button
          type="button"
          onClick={() => handleAddBlock('speaking')}
          className="w-full py-3 rounded-2xl border border-dashed border-line hover:border-primary/50 text-content-muted hover:text-primary transition-colors text-xs font-bold flex items-center justify-center gap-2 bg-base-100/40 cursor-pointer"
        >
          <Plus size={15} />
          <span>+ Dodaj kolejny blok konwersacyjny</span>
        </button>
      </div>

      {/* ── DOLNY PASEK AKCJI (ZAPIS / ZATWIERDZENIE) ── */}
      <div className="p-4 rounded-2xl bg-base-200/90 border border-line-strong shadow-lg flex flex-wrap items-center justify-between gap-3 sticky bottom-4 z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave('draft')}
            className="px-4 py-2.5 rounded-xl border border-line-strong bg-base-100 hover:bg-base-300 text-content font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save size={15} />
            <span>Zapisz jako szkic</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave('planned')}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-focus hover:from-primary-focus hover:to-primary text-accent-ink font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            <span>Zatwierdź lekcję ({totalMinutes} min)</span>
          </button>
        </div>
      </div>

      {/* Modal wczytania wcześniejszych konspektów */}
      {isSavedPlansModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-base-200 border border-line-strong rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-bold text-text-hi flex items-center gap-2">
                <FolderOpen size={16} className="text-primary" />
                <span>Konspekty wybranego kursanta</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSavedPlansModalOpen(false)}
                className="text-content-muted hover:text-white text-xs"
              >
                Zamknij
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
              {savedPlans.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setScenario(p);
                    setIsSavedPlansModalOpen(false);
                  }}
                  className="p-3.5 rounded-xl border border-line bg-base-100 hover:border-primary/50 cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <strong className="text-text-hi">{p.topic || 'Bez tematu'}</strong>
                    <span className="font-mono text-content-muted text-[11px]">{p.date}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-content-muted">
                    <span>{p.blocks?.length || 0} bloków</span>
                    <span>•</span>
                    <span className="text-primary font-bold">{p.totalDurationMinutes} min</span>
                    <span>•</span>
                    <span className="capitalize">{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonPlannerStudio;
