import React from 'react';
import { Check, X } from 'lucide-react';
import { SpellcheckIssue } from '../../services/notebookSpellcheckService';
import { SpellcheckRect } from './useNotebookSpellcheck';

interface SpellcheckPopoverProps {
  issue: SpellcheckIssue;
  anchor: SpellcheckRect;
  onApply: (issue: SpellcheckIssue) => void;
  onIgnore: (id: string) => void;
}

/**
 * Dymek podpowiedzi w stylu Google Docs — pozycjonowany WZGLĘDEM tego samego
 * kontenera co znaczniki podkreśleń (patrz `useNotebookSpellcheck`), więc
 * `anchor` to współrzędne lokalne, nie viewportu.
 */
export const SpellcheckPopover: React.FC<SpellcheckPopoverProps> = ({ issue, anchor, onApply, onIgnore }) => {
  return (
    <div
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      className="absolute z-30 min-w-[200px] max-w-[280px] rounded-xl border border-line-strong bg-ink-2 shadow-ambient-lg p-3 animate-fadeIn"
      style={{ left: anchor.left, top: anchor.top + 6 }}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onApply(issue)}
          className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 rounded px-2.5 py-1 text-sm font-semibold transition-colors cursor-pointer"
        >
          <Check size={13} />
          {issue.suggestion}
        </button>
        <button
          type="button"
          onClick={() => onIgnore(issue.id)}
          title="Ignoruj"
          aria-label="Ignoruj tę uwagę"
          className="shrink-0 h-7 w-7 rounded-lg text-text-faint hover:text-text-hi hover:bg-white/[0.07] flex items-center justify-center transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-1.5">{issue.shortReason}</p>
    </div>
  );
};

export default SpellcheckPopover;
