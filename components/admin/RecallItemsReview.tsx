import React, { useState } from 'react';
import { CheckSquare, Square, Sparkles, Loader2, Trash2, Plus, Info } from 'lucide-react';
import { RecallCandidate, RecallLearningType } from '../../types';
import { generateRecallCandidates } from '../../services/geminiService';

/**
 * Zatwierdzanie elementów do powtórek — jedyny moment, w którym powstaje
 * materiał dla kursanta.
 *
 * Szkic AI jest jednorazowy i uruchamiany ręcznie. Nic tu nie dzieje się przy
 * otwarciu panelu kursanta: gdyby elementy powstawały „w locie", kursant
 * dostawałby treść, której lektor nigdy nie widział.
 *
 * Kandydaci są domyślnie zaznaczeni. Zapis lekcji ma się zamykać w kilkudziesięciu
 * sekundach, więc krok zatwierdzania nie może wymagać klikania po kolei —
 * lektor odznacza to, co odpada, i zapisuje.
 */

export interface ReviewedCandidate extends RecallCandidate {
  approved: boolean;
}

interface RecallItemsReviewProps {
  lessonTopic: string;
  vocabularyText: string;
  lessonNotes: string;
  thingsToImprove: string;
  candidates: ReviewedCandidate[];
  onChange: (candidates: ReviewedCandidate[]) => void;
}

const LEARNING_TYPES: RecallLearningType[] = [
  'fraza', 'kolokacja', 'gramatyka', 'wymowa', 'funkcja', 'korekta',
];

const SUGGESTED_MIN = 3;
const SUGGESTED_MAX = 10;

const RecallItemsReview: React.FC<RecallItemsReviewProps> = ({
  lessonTopic,
  vocabularyText,
  lessonNotes,
  thingsToImprove,
  candidates,
  onChange,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approvedCount = candidates.filter((c) => c.approved).length;
  const hasMaterial = [vocabularyText, lessonNotes, thingsToImprove].some(
    (t) => t && t.trim().length > 0
  );

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const generated = await generateRecallCandidates(
        lessonTopic,
        vocabularyText,
        lessonNotes,
        thingsToImprove
      );
      if (generated.length === 0) {
        setError('AI nie wyciągnęło z tego materiału żadnych elementów. Dodaj je ręcznie.');
      }
      // Szkic dokłada się do tego, co już jest — lektor mógł dopisać coś ręcznie
      // przed wywołaniem AI i nie ma powodu, żeby to skasować.
      onChange([...candidates, ...generated.map((c) => ({ ...c, approved: true }))]);
    } catch (e: any) {
      setError(e?.message || 'Nie udało się wygenerować szkicu.');
    } finally {
      setIsGenerating(false);
    }
  };

  const update = (idx: number, patch: Partial<ReviewedCandidate>) => {
    onChange(candidates.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const remove = (idx: number) => {
    onChange(candidates.filter((_, i) => i !== idx));
  };

  const addManual = () => {
    onChange([
      ...candidates,
      { targetForm: '', meaningOrFunction: '', learningType: 'fraza', approved: true },
    ]);
  };

  const hint =
    approvedCount > SUGGESTED_MAX
      ? `Zatwierdzonych ${approvedCount}. Sesja kursanta celuje w ${SUGGESTED_MIN}–${SUGGESTED_MAX} elementów i 3–7 minut.`
      : approvedCount === 0 && candidates.length > 0
      ? 'Nic nie jest zatwierdzone — kursant nie dostanie z tej lekcji żadnej powtórki.'
      : null;

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-b border-primary/20">
        <div>
          <div className="text-sm font-bold text-white">Elementy do powtórek</div>
          <div className="text-xs text-content-muted">
            Tylko zatwierdzone trafiają do panelu kursanta.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !hasMaterial}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-accent-ink disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {isGenerating ? 'Generuję…' : 'Szkic AI'}
          </button>
          <button
            type="button"
            onClick={addManual}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-white/15 text-content hover:border-primary/50"
          >
            <Plus size={13} /> Dodaj ręcznie
          </button>
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="px-3 py-4 text-xs text-content-muted">
          {hasMaterial
            ? 'Kliknij „Szkic AI", żeby wyciągnąć elementy z materiału tej lekcji.'
            : 'Wpisz słownictwo albo notatki z lekcji — wtedy da się przygotować szkic.'}
        </div>
      ) : (
        <>
          <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-content-muted font-mono border-b border-white/5">
            Zatwierdzone: {approvedCount} z {candidates.length}
          </div>
          <ul className="max-h-72 overflow-y-auto divide-y divide-white/5">
            {candidates.map((c, idx) => (
              <li
                key={idx}
                className={`px-3 py-2.5 flex items-start gap-2.5 ${c.approved ? '' : 'opacity-45'}`}
              >
                <button
                  type="button"
                  onClick={() => update(idx, { approved: !c.approved })}
                  className="mt-2 shrink-0"
                  aria-label={c.approved ? 'Odznacz element' : 'Zatwierdź element'}
                >
                  {c.approved ? (
                    <CheckSquare size={16} className="text-primary" />
                  ) : (
                    <Square size={16} className="text-content-muted" />
                  )}
                </button>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <input
                    value={c.targetForm}
                    onChange={(e) => update(idx, { targetForm: e.target.value })}
                    placeholder="Forma do odtworzenia (angielski)"
                    className="w-full bg-base-200 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm font-mono"
                  />
                  <input
                    value={c.meaningOrFunction}
                    onChange={(e) => update(idx, { meaningOrFunction: e.target.value })}
                    placeholder="Sens lub funkcja (polski)"
                    className="w-full bg-base-200 border border-white/10 rounded-lg px-2 py-1.5 text-content text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={c.learningType}
                      onChange={(e) =>
                        update(idx, { learningType: e.target.value as RecallLearningType })
                      }
                      className="bg-base-200 border border-white/10 rounded-lg px-2 py-1 text-content-muted text-xs"
                    >
                      {LEARNING_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <input
                      value={c.teacherNote || ''}
                      onChange={(e) => update(idx, { teacherNote: e.target.value })}
                      placeholder="Notatka lektora (opcjonalnie)"
                      className="flex-1 min-w-0 bg-base-200 border border-white/10 rounded-lg px-2 py-1 text-content-muted text-xs"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="mt-2 shrink-0 text-content-muted hover:text-danger"
                  aria-label="Usuń kandydata"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {(hint || error) && (
        <div className="flex items-start gap-2 px-3 py-2 border-t border-white/10 text-xs">
          <Info size={13} className={`mt-0.5 shrink-0 ${error ? 'text-danger' : 'text-warn'}`} />
          <span className={error ? 'text-danger' : 'text-content-muted'}>{error || hint}</span>
        </div>
      )}
    </div>
  );
};

export default RecallItemsReview;
