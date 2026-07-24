import React, { useState, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { StudentTest } from '../../types';
import { gradeTest } from '../../services/geminiService';
import Card from '../ui/Card';
import ConfirmModal from '../ui/ConfirmModal';
import Button from '../ui/Button';
import { MatchingTask } from './MatchingTask';
import { WordBankFillInBlankTask } from './WordBankFillInBlankTask';
import i18n from "i18next";
import { parseNumberedItems, formatSubAnswers, parseSubAnswers, normalizePromptLines } from '../../utils/testFormatters';

interface TakeTestScreenProps {
  test: StudentTest;
  onBack: () => void;
}

const SentenceListTask: React.FC<{
  type: 'translation' | 'fill_in_blank';
  prompt: string;
  initialAnswer?: string;
  onChange: (ans: string) => void;
}> = ({ type, prompt, initialAnswer, onChange }) => {
  const sentences = useMemo(() => parseNumberedItems(prompt), [prompt]);
  const [subAnswers, setSubAnswers] = useState<Record<number, string>>(() => 
    parseSubAnswers(initialAnswer || '', sentences.length)
  );

  React.useEffect(() => {
    if (initialAnswer !== undefined) {
      setSubAnswers(parseSubAnswers(initialAnswer, sentences.length));
    }
  }, [initialAnswer, sentences.length]);

  const handleTextChange = (index: number, val: string) => {
    const updated = { ...subAnswers, [index]: val };
    setSubAnswers(updated);
    onChange(formatSubAnswers(updated, sentences.length));
  };

  return (
    <div className="space-y-5">
      {sentences.map((s, idx) => (
        <div key={idx} className="p-5 md:p-6 rounded-2xl bg-base-200/60 border border-white/10 space-y-3.5 shadow-md">
          {/* Nieedytowalna treść zdania */}
          <div className="p-4 rounded-xl bg-black/50 border border-white/10 flex items-start gap-3.5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/20 text-primary font-extrabold text-sm shrink-0 mt-0.5">
              {s.num}
            </span>
            <p className="text-base md:text-lg font-semibold text-white leading-relaxed pt-0.5">
              {s.text}
            </p>
          </div>

          {/* Pole do wpisywania odpowiedzi - bez zbędnych banerów, z cichą blokadą wklejania */}
          <div>
            <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-2 px-1">
              {type === 'translation' ? `Twoje tłumaczenie zdania ${s.num}:` : `Twoja odpowiedź dla zdania ${s.num}:`}
            </label>
            <input
              type="text"
              value={subAnswers[idx] || ''}
              onChange={(e) => handleTextChange(idx, e.target.value)}
              onPaste={(e) => e.preventDefault()}
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && ['v', 'V'].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              placeholder={
                type === 'translation'
                  ? `Wpisz tłumaczenie zdania ${s.num}...`
                  : `Wpisz odpowiedź dla zdania ${s.num}...`
              }
              className="w-full bg-black/60 border border-white/15 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl p-3.5 text-base text-white outline-none transition-all placeholder:text-content-muted/40 font-medium cursor-text"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const TakeTestScreen: React.FC<TakeTestScreenProps> = ({ test, onBack }) => {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirmModalState, setConfirmModalState] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void}>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModalState({ isOpen: true, title, message, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmModalState(prev => ({ ...prev, isOpen: false }));
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [gradingResult, setGradingResult] = useState<{score: number, feedback: string} | null>(null);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    const unanswered = test.questions.filter(q => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      if (!window.confirm(`Masz ${unanswered.length} nieodpowiedzianych pytań. Czy na pewno chcesz zakończyć test?`)) {
        return;
      }
    }

    setIsSubmitting(true);
    
    try {
      if (!user?.id || !test.id) throw new Error("Not authenticated");
      
      let gradeResult = { score: 0, feedback: 'Odpowiedzi zostały zapisane i przesłane do weryfikacji.' };
      try {
        gradeResult = await gradeTest(test.title, test.questions, answers);
      } catch (aiErr) {
        console.warn("AI grading error, proceeding with answers saved:", aiErr);
      }
      
      const newAttemptsUsed = (test.attemptsUsed || 0) + 1;
      
      const testRef = doc(db, `users/${user.id}/tests`, test.id);
      await updateDoc(testRef, {
        status: 'graded',
        studentAnswers: answers,
        score: gradeResult.score,
        aiFeedback: gradeResult.feedback,
        attemptsUsed: newAttemptsUsed,
        teacherRead: false,
        completedAt: new Date().toISOString()
      });
      setGradingResult(gradeResult);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert("Wystąpił błąd podczas zapisywania odpowiedzi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto text-center space-y-6 pt-12">
        <h2 className="text-3xl font-bold text-primary">{i18n.t("Test Zakończony!")}</h2>
        <p className="text-content-muted">{i18n.t("Twoje odpowiedzi zostały zapisane. Oczekuj na pełne sprawdzenie przez nauczyciela.")}</p>
        <Button onClick={onBack}>{i18n.t("Wróć do listy testów")}</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="text-content-muted hover:text-white flex items-center gap-2">
          
                            {i18n.t("&larr; Wróć")}
                          </button>
        <h1 className="text-2xl font-bold">{test.title}</h1>
      </div>

      <div className="bg-primary/10 text-primary p-4 rounded-lg border border-primary/20 text-sm mb-6">
        <strong>{i18n.t("Zakres:")}</strong> {test.scope}
      </div>
      {test.instructions && (
        <div className="bg-primary/5 text-primary border border-primary/20 p-4 rounded-xl mb-8 whitespace-pre-wrap">
          <strong>{i18n.t("Instrukcje:")}</strong><br/>{test.instructions}
        </div>
      )}

      <div className="space-y-8">
        {test.questions.map((q, idx) => (
          <Card key={q.id} className="p-6 md:p-8 ">
            <div className="flex items-start gap-4 md:gap-6">
              <div className="font-bold text-primary text-lg w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                {idx + 1}
              </div>
              <div className="flex-1 space-y-6 w-full overflow-hidden">
                <div>
                  <div className="text-sm font-bold text-content-muted mb-2 uppercase tracking-wider">
                    {q.type === 'multiple_choice' ? 'Wielokrotny wybór' 
                      : q.type === 'find_mistake' ? 'Wybór poprawnego zdania' 
                      : q.type === 'fill_in_blank_bank' ? 'Luki z banku słów (rozsypka)' 
                      : q.type === 'fill_in_blank' ? 'Luki' 
                      : q.type === 'matching' ? 'Łączenie w pary' 
                      : q.type === 'writing' ? 'Writing' 
                      : 'Tłumaczenie'}
                  </div>
                  {q.instruction && 
                   q.instruction.trim().toLowerCase() !== q.prompt.trim().toLowerCase() && 
                   !q.prompt.trim().toLowerCase().startsWith(q.instruction.trim().toLowerCase()) && (
                    <div className="font-bold text-primary text-lg mb-2">{q.instruction}</div>
                  )}
                  {q.type !== 'translation' && q.type !== 'fill_in_blank' && q.type !== 'fill_in_blank_bank' && (
                    <div className="font-medium text-xl leading-relaxed whitespace-pre-wrap">
                      {normalizePromptLines(q.prompt)}
                    </div>
                  )}
                  {q.hint && <div className="mt-3 text-sm text-content-muted/80 italic flex items-center gap-2"><span>💡</span>  {i18n.t("Wskazówka:")} {q.hint}</div>}
                </div>
                
                {(q.type === 'multiple_choice' || q.type === 'find_mistake') && q.options && (
                  <div className="space-y-3">
                    {q.options.map((opt, oIdx) => (
                      <label key={oIdx} className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${answers[q.id] === opt ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(114,240,180,0.15)] text-primary' : 'bg-black/30 backdrop-blur-sm border-white/10 hover:border-primary/50'}`}>
                        <input 
                          type="radio" 
                          name={`q_${q.id}`} 
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={() => handleAnswerChange(q.id, opt)}
                          className="accent-primary w-5 h-5"
                        />
                        <span className="font-medium text-base">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                
                {q.type === 'fill_in_blank_bank' && (
                  <WordBankFillInBlankTask
                    prompt={q.prompt}
                    correctAnswer={q.correctAnswer}
                    wordBank={q.wordBank}
                    options={q.options}
                    onChange={ans => handleAnswerChange(q.id, ans)}
                    initialAnswer={answers[q.id]}
                  />
                )}

                {(q.type === 'fill_in_blank' || q.type === 'translation') && (
                  <SentenceListTask
                    type={q.type}
                    prompt={q.prompt}
                    initialAnswer={answers[q.id]}
                    onChange={ans => handleAnswerChange(q.id, ans)}
                  />
                )}
                
                {q.type === 'matching' && q.options && (
                  <MatchingTask
                    options={q.options}
                    onChange={ans => handleAnswerChange(q.id, ans)}
                    initialAnswer={answers[q.id]}
                  />
                )}

                {q.type === 'writing' && (
                  <div>
                    <textarea
                      value={answers[q.id] || ''}
                      onChange={e => handleAnswerChange(q.id, e.target.value)}
                      onPaste={(e) => e.preventDefault()}
                      onCopy={(e) => e.preventDefault()}
                      onCut={(e) => e.preventDefault()}
                      placeholder={i18n.t("Zacznij pisać tutaj...")}
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck="false"
                      className="w-full bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-lg text-white outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all min-h-[200px] resize-y cursor-text font-medium"
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="pt-8 flex justify-end">
        <Button onClick={handleSubmit} isLoading={isSubmitting} className="bg-primary text-black hover:bg-primary/90 font-bold px-8 py-3 text-lg">
          
                            {i18n.t("Zakończ Test")}
                          </Button>
      </div>
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        onConfirm={confirmModalState.onConfirm}
        onCancel={closeConfirm}
        confirmText="Zakończ"
        cancelText="Anuluj"
      />
    </div>
  );
};

export default TakeTestScreen;
