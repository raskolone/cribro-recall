import React from 'react';
import { LessonBlock, BlockType } from '../../types/planner';
import { Presentation } from '../../types/presentation';
import { 
  Flame, 
  RotateCcw, 
  BookOpen, 
  Layers, 
  MessageSquare, 
  CheckCircle2, 
  FileEdit, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Airplay, 
  Clock,
  ExternalLink,
  X
} from 'lucide-react';

interface PlannerBlockItemProps {
  block: LessonBlock;
  index: number;
  totalBlocks: number;
  availablePresentations?: Presentation[];
  onUpdate: (updatedBlock: LessonBlock) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onOpenPresentation?: (presentationId: string) => void;
}

export const BLOCK_TYPE_CONFIG: Record<
  BlockType,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    badgeBg: string;
    borderColor: string;
    textColor: string;
    glowClass: string;
  }
> = {
  warmup: {
    label: 'Warm-up & Icebreaker',
    description: 'Rozgrzewka językowa, swobodna rozmowa, przełamanie bariery',
    icon: Flame,
    badgeBg: 'bg-amber-500/15',
    borderColor: 'border-amber-500/40',
    textColor: 'text-amber-400',
    glowClass: 'hover:border-amber-400/70',
  },
  recall: {
    label: 'Recall & Pronunciation Drill',
    description: 'Powtórka zwrotów z poprzedniej lekcji, korekta wymowy',
    icon: RotateCcw,
    badgeBg: 'bg-sky-500/15',
    borderColor: 'border-sky-500/40',
    textColor: 'text-sky-400',
    glowClass: 'hover:border-sky-400/70',
  },
  input: {
    label: 'Language Input & Analysis',
    description: 'Wprowadzenie nowych pojęć, struktur lub analizy case study',
    icon: BookOpen,
    badgeBg: 'bg-indigo-500/15',
    borderColor: 'border-indigo-500/40',
    textColor: 'text-indigo-400',
    glowClass: 'hover:border-indigo-400/70',
  },
  practice: {
    label: 'Controlled Practice & Drills',
    description: 'Ćwiczenia sterowane, modelowanie zdań, parafraza',
    icon: Layers,
    badgeBg: 'bg-violet-500/15',
    borderColor: 'border-violet-500/40',
    textColor: 'text-violet-400',
    glowClass: 'hover:border-violet-400/70',
  },
  speaking: {
    label: 'Core Speaking & Role-play',
    description: 'Konwersacja swobodna, symulacja sytuacji zawodowej, negocjacje',
    icon: MessageSquare,
    badgeBg: 'bg-emerald-500/15',
    borderColor: 'border-emerald-500/40',
    textColor: 'text-emerald-400',
    glowClass: 'hover:border-emerald-400/70',
  },
  feedback: {
    label: 'Feedback & Error Correction',
    description: 'Podsumowanie, omówienie błędów, wskazówki i pochwały',
    icon: CheckCircle2,
    badgeBg: 'bg-rose-500/15',
    borderColor: 'border-rose-500/40',
    textColor: 'text-rose-400',
    glowClass: 'hover:border-rose-400/70',
  },
  homework: {
    label: 'Follow-up & Homework',
    description: 'Zadanie domowe, materiał do powtórki na platformie',
    icon: FileEdit,
    badgeBg: 'bg-teal-500/15',
    borderColor: 'border-teal-500/40',
    textColor: 'text-teal-400',
    glowClass: 'hover:border-teal-400/70',
  },
};

export const PlannerBlockItem: React.FC<PlannerBlockItemProps> = ({
  block,
  index,
  totalBlocks,
  availablePresentations = [],
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDelete,
  onOpenPresentation,
}) => {
  const config = BLOCK_TYPE_CONFIG[block.type] || BLOCK_TYPE_CONFIG.speaking;
  const Icon = config.icon;

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...block, title: e.target.value });
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(1, Math.min(180, parseInt(e.target.value, 10) || 0));
    onUpdate({ ...block, durationMinutes: val });
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ ...block, content: e.target.value });
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate({ ...block, type: e.target.value as BlockType });
  };

  const handlePresentationLink = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onUpdate({ ...block, linkedPresentationId: val ? val : undefined });
  };

  const linkedPresentation = availablePresentations.find(
    (p) => p.id === block.linkedPresentationId
  );

  return (
    <div
      className={`rounded-2xl border ${config.borderColor} bg-base-200/90 p-4 sm:p-5 transition-all shadow-ambient-sm space-y-3.5 relative ${config.glowClass}`}
    >
      {/* Pasek górny karty */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-line-strong">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-base-100 text-content-muted text-xs font-mono font-black border border-line-strong shrink-0">
            {index + 1}
          </span>

          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border ${config.borderColor} ${config.badgeBg} ${config.textColor} text-xs font-extrabold shrink-0`}
          >
            <Icon size={14} />
            <select
              value={block.type}
              onChange={handleTypeChange}
              className="bg-transparent font-bold text-xs text-inherit outline-none cursor-pointer pr-1"
              aria-label="Wybierz typ bloku"
            >
              <option value="warmup" className="bg-base-200 text-text-hi">Warm-up (Rozgrzewka)</option>
              <option value="recall" className="bg-base-200 text-text-hi">Recall (Powtórka & Wymowa)</option>
              <option value="input" className="bg-base-200 text-text-hi">Input (Wprowadzenie materiału)</option>
              <option value="practice" className="bg-base-200 text-text-hi">Practice (Praktyka sterowana)</option>
              <option value="speaking" className="bg-base-200 text-text-hi">Speaking (Główna konwersacja)</option>
              <option value="feedback" className="bg-base-200 text-text-hi">Feedback (Informacja zwrotna)</option>
              <option value="homework" className="bg-base-200 text-text-hi">Homework (Zadanie)</option>
            </select>
          </div>
        </div>

        {/* Kontrolki nawigacji: góra / dół / usuń */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1.5 rounded-lg border border-line bg-base-100 text-content-muted hover:text-text-hi hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            title="Przesuń w górę"
            aria-label="Przesuń w górę"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === totalBlocks - 1}
            className="p-1.5 rounded-lg border border-line bg-base-100 text-content-muted hover:text-text-hi hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            title="Przesuń w dół"
            aria-label="Przesuń w dół"
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all cursor-pointer ml-1"
            title="Usuń blok"
            aria-label="Usuń blok"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Rząd z tytułem i czasem trwania */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        <div className="sm:col-span-8">
          <input
            type="text"
            value={block.title}
            onChange={handleTitleChange}
            placeholder="Tytuł bloku, np. Dyskusja o negocjacjach budżetu..."
            className="w-full px-3.5 py-2 rounded-xl bg-base-100/90 border border-line-strong text-text-hi font-bold text-sm outline-none focus:border-primary transition-colors"
          />
        </div>

        <div className="sm:col-span-4 flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-base-100/90 border border-line-strong w-full">
            <Clock size={14} className="text-primary shrink-0" />
            <span className="text-xs text-content-muted font-medium">Czas:</span>
            <input
              type="number"
              min={1}
              max={180}
              step={5}
              value={block.durationMinutes}
              onChange={handleDurationChange}
              className="w-14 bg-transparent text-text-hi font-mono font-bold text-sm text-center outline-none focus:text-primary"
            />
            <span className="text-xs text-content-muted font-mono">min</span>
          </div>
        </div>
      </div>

      {/* Opis ćwiczenia / notatki lektora */}
      <div>
        <textarea
          rows={2}
          value={block.content}
          onChange={handleContentChange}
          placeholder="Opis zadania, sugerowane pytania, kluczowe idiomy do wyciągnięcia..."
          className="w-full px-3.5 py-2 rounded-xl bg-base-100/80 border border-line-strong text-content text-xs leading-relaxed outline-none focus:border-primary transition-colors resize-y min-h-[50px]"
        />
      </div>

      {/* Opcjonalne powiązanie ze slajdem/prezentacją */}
      <div className="pt-2 border-t border-line-strong flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-content-muted min-w-0">
          <Airplay size={13} className="text-primary shrink-0" />
          <span className="shrink-0 font-medium">Powiązana prezentacja:</span>
          <select
            value={block.linkedPresentationId || ''}
            onChange={handlePresentationLink}
            className="bg-base-100 border border-line rounded-lg px-2 py-1 text-xs text-text-hi outline-none focus:border-primary max-w-[200px] truncate"
          >
            <option value="">Brak (lekcja bez slajdów)</option>
            {availablePresentations.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.slides?.length || 0} slajdów)
              </option>
            ))}
          </select>
        </div>

        {linkedPresentation && (
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-primary/15 text-primary text-[11px] font-mono font-bold">
              {linkedPresentation.slides?.length || 0} slajdów
            </span>
            {onOpenPresentation && (
              <button
                type="button"
                onClick={() => onOpenPresentation(linkedPresentation.id)}
                className="text-primary hover:underline text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>Otwórz slajdy</span>
                <ExternalLink size={11} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
