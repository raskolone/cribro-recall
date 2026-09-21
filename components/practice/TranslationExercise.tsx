import React, { useMemo, useState } from 'react';
import { Check, X, Lightbulb, RotateCcw } from 'lucide-react';
import i18n from 'i18next';
import Button from '../ui/Button';
import { AdvancedTranslationPayload, TranslationStep } from '../../types/translationExercise';

interface TranslationExerciseProps {
  items: AdvancedTranslationPayload[];
  onExit: () => void;
  onComplete: () => void;
}

/** Ta sama polityka porównania co `unscrambleGrading.ts` (rozgrzewka homework) —
 *  małe litery, bez interpunkcji, jednolity apostrof — stosowana na całym zdaniu. */
function normalizeSentence(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[.,!?;:"„”]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

const CHIP_COLORS = [
  'bg-emerald-500/15 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25',
  'bg-teal-500/15 border-teal-500/35 text-teal-300 hover:bg-teal-500/25',
  'bg-cyan-500/15 border-cyan-500/35 text-cyan-300 hover:bg-cyan-500/25',
  'bg-indigo-500/15 border-indigo-500/35 text-indigo-300 hover:bg-indigo-500/25',
];

const ClassicAssisted: React.FC<{
  payload: AdvancedTranslationPayload;
  onSubmit: (isCorrect: boolean, answer: string) => void;
}> = ({ payload, onSubmit }) => {
  const [answer, setAnswer] = useState('');

  const handleHintClick = (hint: string) => {
    setAnswer((prev) => (prev ? `${prev.trim()} ${hint}` : hint));
  };

  const handleSubmit = () => {
    const isCorrect = normalizeSentence(answer) === normalizeSentence(payload.targetSentence);
    onSubmit(isCorrect, answer);
  };

  return (
    <div className="space-y-4">
      {!!payload.lexicalHints?.length && (
        <div className="flex flex-wrap gap-2">
          {payload.lexicalHints.map((hint, idx) => (
            <button
              key={`${hint}-${idx}`}
              type="button"
              onClick={() => handleHintClick(hint)}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${CHIP_COLORS[idx % CHIP_COLORS.length]}`}
            >
              <Lightbulb size={12} className="inline mr-1 -mt-0.5" />
              {hint}
            </button>
          ))}
        </div>
      )}

      <textarea
        rows={2}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={i18n.t('Type your translation...')}
        className="w-full px-4 py-3 bg-base-100 text-white border border-white/10 rounded-xl focus:border-primary focus:outline-none text-base resize-none"
      />

      <Button onClick={handleSubmit} disabled={!answer.trim()} className="w-full">
        {i18n.t('Check')}
      </Button>
    </div>
  );
};

const FragmentPool: React.FC<{
  payload: AdvancedTranslationPayload;
  onSubmit: (isCorrect: boolean, answer: string) => void;
}> = ({ payload, onSubmit }) => {
  const steps = useMemo(
    () => [...(payload.steps || [])].sort((a, b) => a.stepIndex - b.stepIndex),
    [payload.steps]
  );
  const [selections, setSelections] = useState<(string | null)[]>(() => steps.map(() => null));
  const pools = useMemo(
    () => steps.map((step: TranslationStep) => shuffle([step.correctChunk, ...(step.distractors || [])])),
    [steps]
  );

  const activeStepIndex = selections.findIndex((s) => s === null);
  const isComplete = activeStepIndex === -1;

  const handlePick = (stepIdx: number, chunk: string) => {
    if (stepIdx !== activeStepIndex) return; // Kroki uzupełniane po kolei — jak w rozgrzewce homework.
    setSelections((prev) => {
      const next = [...prev];
      next[stepIdx] = chunk;
      return next;
    });
  };

  const handleSubmit = () => {
    const answer = selections.join(' ');
    const isCorrect = steps.every((step, idx) => selections[idx] === step.correctChunk);
    onSubmit(isCorrect, answer);
  };

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-base-200/60 border border-white/5 text-lg font-medium leading-relaxed min-h-[3.5rem]">
        {steps.map((_, idx) => (
          <span key={idx} className={idx > 0 ? 'ml-1.5' : ''}>
            {selections[idx] ?? (
              <span className="text-content-muted/50 italic">…</span>
            )}
          </span>
        ))}
      </div>

      <div className="space-y-3">
        {steps.map((step, stepIdx) => (
          <div key={step.stepIndex} className={stepIdx > activeStepIndex && activeStepIndex !== -1 ? 'opacity-40 pointer-events-none' : ''}>
            <p className="text-[11px] font-mono uppercase tracking-wider text-content-muted mb-1.5">
              {i18n.t('Fragment')} {stepIdx + 1}
            </p>
            <div className="flex flex-wrap gap-2">
              {pools[stepIdx].map((chunk, chunkIdx) => {
                const isPicked = selections[stepIdx] === chunk;
                return (
                  <button
                    key={`${chunk}-${chunkIdx}`}
                    type="button"
                    disabled={selections[stepIdx] !== null}
                    onClick={() => handlePick(stepIdx, chunk)}
                    className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                      isPicked
                        ? 'bg-primary/25 border-primary text-primary'
                        : `${CHIP_COLORS[chunkIdx % CHIP_COLORS.length]} disabled:opacity-30`
                    }`}
                  >
                    {chunk}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Button onClick={handleSubmit} disabled={!isComplete} className="w-full">
        {i18n.t('Check')}
      </Button>
    </div>
  );
};

const TranslationExercise: React.FC<TranslationExerciseProps> = ({ items, onExit, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; answer: string } | null>(null);

  const current = items[currentIndex];

  const handleSubmit = (isCorrect: boolean, answer: string) => {
    setResults((prev) => ({ ...prev, [current.id]: isCorrect }));
    setFeedback({ isCorrect, answer });
  };

  const handleNext = () => {
    setFeedback(null);
    if (currentIndex === items.length - 1) {
      setIsFinished(true);
      onComplete();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  if (isFinished) {
    const correctCount = Object.values(results).filter(Boolean).length;
    return (
      <div className="text-center p-8 bg-base-200/40 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-4">{i18n.t('Translation exercise complete!')}</h2>
        <p className="text-lg mb-2">
          {correctCount} / {items.length} {i18n.t('correct')}
        </p>
        <div className="flex gap-4 justify-center mt-6">
          <Button onClick={() => { setIsFinished(false); setCurrentIndex(0); setResults({}); setFeedback(null); }} className="flex items-center gap-2">
            <RotateCcw size={16} /> {i18n.t('Try Again')}
          </Button>
          <Button onClick={onExit} variant="secondary">{i18n.t('Exit')}</Button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="flex flex-col items-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">{i18n.t('Translation')}</h2>
          <Button onClick={onExit} variant="ghost">{i18n.t('Exit')}</Button>
        </div>

        <p className="text-center mt-1 mb-4 text-xs text-content-muted">
          {i18n.t('Sentence')} {currentIndex + 1} {i18n.t('of')} {items.length}
        </p>

        <div className="p-5 rounded-xl bg-base-200/40 backdrop-blur-xl border border-white/20 shadow-2xl space-y-5">
          <p className="text-xl font-bold text-primary text-center">{current.polishSentence}</p>

          {feedback ? (
            <div
              className={`p-4 rounded-xl border space-y-2 ${
                feedback.isCorrect ? 'bg-primary/10 border-primary/40' : 'bg-danger/10 border-danger/40'
              }`}
            >
              <p className={`flex items-center gap-2 font-bold ${feedback.isCorrect ? 'text-primary' : 'text-danger'}`}>
                {feedback.isCorrect ? <Check size={18} /> : <X size={18} />}
                {feedback.isCorrect ? i18n.t('Correct!') : i18n.t('Not quite')}
              </p>
              {!feedback.isCorrect && (
                <p className="text-sm text-content-muted">
                  {i18n.t('Correct translation:')} <span className="text-white font-medium">{current.targetSentence}</span>
                </p>
              )}
              <Button onClick={handleNext} className="w-full mt-2">
                {currentIndex === items.length - 1 ? i18n.t('Finish') : i18n.t('Next')}
              </Button>
            </div>
          ) : current.mode === 'fragment_pool' ? (
            <FragmentPool payload={current} onSubmit={handleSubmit} />
          ) : (
            <ClassicAssisted payload={current} onSubmit={handleSubmit} />
          )}
        </div>
      </div>
    </div>
  );
};

export default TranslationExercise;
