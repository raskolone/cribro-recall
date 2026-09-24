import React, { useState, useEffect } from 'react';
import {
  RotateCcw, Sparkles, Plus, Play, X, Layers,
  BookOpen, History, ExternalLink, ChevronRight, Zap,
  Award, Shield, FileText, CheckCircle2, Square, Lasso, Crosshair, ZoomIn
} from 'lucide-react';
import { ExerciseDefinition, RandomWheelPayload } from '../../types/exerciseStudio';
import { fetchAllExercises } from '../../services/exerciseService';
import { exerciseRegistry } from '../../services/exerciseRegistry';
import { LessonRecord, ScratchpadDocument } from '../../types';
import Button from '../ui/Button';

interface TeacherDockProps {
  isOpen: boolean;
  onClose: () => void;
  isTeacher: boolean;
  studentName?: string | null;
  lessonRecords?: LessonRecord[];
  docData: ScratchpadDocument;
  onLaunchExercise: (exercise: ExerciseDefinition) => void;
  onOpenStudio: () => void;
  onLaunchQuickRecallWheel: () => void;
  onInsertExerciseNote?: (text: string) => void;
  onStartFocusZoom?: () => void;
}

export const TeacherDock: React.FC<TeacherDockProps> = ({
  isOpen,
  onClose,
  isTeacher,
  studentName,
  lessonRecords = [],
  docData,
  onLaunchExercise,
  onOpenStudio,
  onLaunchQuickRecallWheel,
  onInsertExerciseNote,
  onStartFocusZoom,
}) => {
  const [exercises, setExercises] = useState<ExerciseDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && isTeacher) {
      setIsLoading(true);
      fetchAllExercises()
        .then((list) => setExercises(list))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, isTeacher]);

  // Widoczne TYLKO dla nauczyciela w Teacher View
  if (!isOpen || !isTeacher) return null;

  return (
    <aside
      data-testid="teacher-dock-panel"
      className="fixed right-0 top-0 bottom-0 z-[80] w-[340px] sm:w-[380px] bg-ink-2/95 border-l border-line-strong shadow-2xl backdrop-blur-xl flex flex-col animate-slide-left select-none"
      style={{
        backgroundColor: 'var(--exercise-surface, #0f172a)',
        borderColor: 'var(--exercise-border, rgba(255, 255, 255, 0.12))',
        color: 'var(--exercise-text, #f8fafc)',
      }}
    >
      {/* NAGŁÓWEK DOCKA */}
      <header className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Layers size={17} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-hi">Teacher Dock</h2>
            <p className="text-[11px] text-slate-400">Panel widgetów i ćwiczeń lektora</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Zamknij panel"
        >
          <X size={16} />
        </button>
      </header>

      {/* ZAWARTOŚĆ DOCKA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 0. SEKCJA FOCUS ZOOM & KIEROWANIE UWAGĄ */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ZoomIn size={13} className="text-emerald-400" />
              Focus Zoom (Kierowanie uwagą)
            </span>
          </div>

          <div className="p-3.5 rounded-2xl border border-white/10 bg-white/5 space-y-2.5">
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Zaznacz prostokątem lub odręcznym lasso fragment kartki (pytanie, obraz, tabelę), aby płynnie powiększyć go kursantowi.
            </p>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onClose();
                onStartFocusZoom?.();
              }}
              className="w-full border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 font-bold text-xs flex items-center justify-center gap-1.5 h-8.5"
            >
              <Crosshair size={13} />
              <span>Włącz narzędzie Focus Zoom</span>
              <kbd className="px-1 text-[9px] bg-white/10 rounded font-mono font-normal">F</kbd>
            </Button>
          </div>
        </div>

        {/* 1. SEKCJA QUICK RECALL */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Zap size={13} className="text-amber-400" />
              Szybka Rozgrzewka (Quick Recall)
            </span>
          </div>

          <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 space-y-3">
            <div className="space-y-1">
              <div className="text-xs font-bold text-emerald-300">
                Koło Fortuny — Historia Lekcji
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Pobiera zwroty, tematy i zalecenia z poprzednich zajęć kursanta {studentName ? `(${studentName})` : ''}.
              </p>
            </div>

            <Button
              size="sm"
              variant="primary"
              onClick={onLaunchQuickRecallWheel}
              className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm h-8.5"
            >
              <RotateCcw size={13} />
              Uruchom koło rozgrzewkowe
            </Button>
          </div>
        </div>

        {/* 2. SEKCJA SAVED EXERCISES */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles size={13} className="text-emerald-400" />
              Biblioteka Ćwiczeń ({exercises.length})
            </span>
            <button
              type="button"
              onClick={onOpenStudio}
              className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 cursor-pointer"
            >
              Otwórz Studio <ChevronRight size={12} />
            </button>
          </div>

          <div className="space-y-2">
            {exercises.map((ex) => {
              const wheelPayload = ex.payload as RandomWheelPayload;
              const itemsCount = wheelPayload?.items?.length || 0;

              return (
                <div
                  key={ex.id}
                  className="p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.08] hover:border-emerald-500/30 transition-all flex items-center justify-between gap-2.5 group"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-xs font-bold text-text-hi truncate group-hover:text-emerald-300 transition-colors">
                      {ex.title}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                      <span>{ex.cefr || 'B1-B2'}</span>
                      <span>•</span>
                      <span>{itemsCount} pozycji</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onLaunchExercise(ex)}
                    title="Uruchom w lekcji (Presentation Overlay)"
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Play size={11} />
                    Graj
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. SEKCJA CREATE EXERCISE / STUDIO SHORTCUT */}
        <div className="space-y-2.5 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onOpenStudio}
            className="w-full p-3 rounded-xl border border-dashed border-white/20 bg-white/[0.02] hover:bg-white/5 hover:border-emerald-500/40 text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Plus size={14} className="text-emerald-400" />
            <span>Stwórz nowe ćwiczenie w Studio</span>
          </button>
        </div>
      </div>

      {/* STOPKA DOCKA */}
      <footer className="p-3.5 border-t border-white/10 bg-black/20 text-[11px] text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Shield size={12} className="text-emerald-400" />
          Widoczne tylko dla lektora
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          Zamknij
        </button>
      </footer>
    </aside>
  );
};

export default TeacherDock;
