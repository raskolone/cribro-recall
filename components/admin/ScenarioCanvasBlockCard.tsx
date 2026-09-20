import React, { useState } from 'react';
import { Check, X, Clock, Target, ChevronDown, ChevronUp, LifeBuoy, MinusCircle } from 'lucide-react';
import { CanvasBlock, CanvasBlockId, CanvasItem } from '../../types/scenarioCanvas';

export const CANVAS_BLOCK_LABELS: Record<CanvasBlockId, string> = {
  lesson_goal: 'Cel lekcji',
  warm_up: 'Rozgrzewka',
  revision_translation: 'Powtórka / tłumaczenie',
  older_lesson_refresh: 'Przypomnienie starszej lekcji',
  grammar_review: 'Powtórka gramatyki',
  main_topic: 'Główny temat',
  language_focus: 'Language focus',
  practice_enclosure: 'Zamknięcie ćwiczeniowe',
  homework: 'Praca domowa',
};

const ITEM_KIND_LABELS: Record<CanvasItem['kind'], string> = {
  question: 'Pytanie',
  task: 'Zadanie',
  note: 'Notatka',
  rescue_question: 'Ratunkowe',
  wind_down_question: 'Zamykające',
};

interface CanvasItemRowProps {
  item: CanvasItem;
  onAccept: () => void;
  onReject: () => void;
  onReasonChange: (reason: string) => void;
}

const CanvasItemRow: React.FC<CanvasItemRowProps> = ({ item, onAccept, onReject, onReasonChange }) => {
  const isRejected = item.review.state === 'rejected';
  const isAccepted = item.review.state === 'accepted';

  return (
    <li
      className={`rounded-xl border p-2.5 transition-colors ${
        isAccepted
          ? 'border-primary/30 bg-primary/5'
          : isRejected
            ? 'border-danger/30 bg-danger/5'
            : 'border-white/10 bg-base-300/40'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase tracking-wider bg-white/5 text-content-muted border border-white/10">
          {ITEM_KIND_LABELS[item.kind]}
        </span>
        <span className="flex-1 text-xs text-content leading-relaxed">{item.text}</span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onAccept}
            aria-label="Zaakceptuj"
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              isAccepted ? 'bg-primary/25 text-primary' : 'text-content-muted hover:text-primary hover:bg-primary/10'
            }`}
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={onReject}
            aria-label="Odrzuć"
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              isRejected ? 'bg-danger/25 text-danger' : 'text-content-muted hover:text-danger hover:bg-danger/10'
            }`}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {isRejected && (
        <div className="mt-2 pl-1">
          <input
            value={item.review.rejectionReason || ''}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Krótka uwaga dla lektora (opcjonalnie) — co zmienić?"
            className="w-full text-[11px] bg-base-300/70 border border-danger/20 rounded-lg px-2.5 py-1.5 text-content placeholder:text-content-muted focus:outline-none focus:border-danger/50"
          />
        </div>
      )}
    </li>
  );
};

interface ScenarioCanvasBlockCardProps {
  block: CanvasBlock;
  onAcceptItem: (itemId: string) => void;
  onRejectItem: (itemId: string) => void;
  onReasonChange: (itemId: string, reason: string) => void;
}

/** Pojedyncza karta bloku Canvasu 2.0 — bez DnD, jak reszta interfejsu Cribro. */
export const ScenarioCanvasBlockCard: React.FC<ScenarioCanvasBlockCardProps> = ({ block, onAcceptItem, onRejectItem, onReasonChange }) => {
  const [notesOpen, setNotesOpen] = useState(false);

  if (block.skipped) {
    return (
      <div className="rounded-xl border border-white/5 bg-base-300/20 p-3 flex items-center gap-2.5 opacity-60">
        <MinusCircle size={14} className="text-content-muted shrink-0" />
        <span className="text-xs font-bold text-content-muted">{CANVAS_BLOCK_LABELS[block.blockId]}</span>
        <span className="text-[11px] text-content-muted">— pominięty{block.skipReason ? `: ${block.skipReason}` : ''}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-violet-500/20 bg-base-300/50 overflow-hidden">
      <div className="p-3 bg-violet-950/20 flex items-center justify-between gap-2 border-b border-violet-500/15">
        <span className="text-xs font-extrabold text-violet-200">{CANVAS_BLOCK_LABELS[block.blockId]}</span>
        {block.durationMin > 0 && (
          <span className="text-[11px] text-violet-300/70 flex items-center gap-1 shrink-0">
            <Clock size={12} /> {block.durationMin} min
          </span>
        )}
      </div>
      <div className="p-3 space-y-2">
        {block.objective && (
          <div className="flex items-start gap-1.5 text-[11px] text-violet-200/80 italic">
            <Target size={12} className="mt-0.5 shrink-0 text-violet-400" />
            <span>{block.objective}</span>
          </div>
        )}
        <ul className="space-y-1.5">
          {block.items.map((item) => (
            <CanvasItemRow
              key={item.itemId}
              item={item}
              onAccept={() => onAcceptItem(item.itemId)}
              onReject={() => onRejectItem(item.itemId)}
              onReasonChange={(reason) => onReasonChange(item.itemId, reason)}
            />
          ))}
        </ul>

        {block.teacherNotes && block.teacherNotes.length > 0 && (
          <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setNotesOpen((v) => !v)}
              className="w-full p-2.5 flex items-center justify-between gap-2 text-[11px] font-bold text-violet-300 hover:bg-violet-500/10 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <LifeBuoy size={12} /> Teacher's Notes
              </span>
              {notesOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {notesOpen && (
              <ul className="px-2.5 pb-2.5 space-y-1 list-disc list-inside">
                {block.teacherNotes.map((note, idx) => (
                  <li key={idx} className="text-[11px] text-violet-100/80">{note}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScenarioCanvasBlockCard;
