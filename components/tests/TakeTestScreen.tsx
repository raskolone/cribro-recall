import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { StudentTest } from '../../types';
import { gradeTest } from '../../services/geminiService';
import Card from '../ui/Card';
import ConfirmModal from '../ui/ConfirmModal';
import Button from '../ui/Button';
import i18n from "i18next";

interface TakeTestScreenProps {
  test: StudentTest;
  onBack: () => void;
}

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
      
      const gradeResult = await gradeTest(test.title, test.questions, answers);
      
      const newAttemptsUsed = (test.attemptsUsed || 0) + 1;
      
      const testRef = doc(db, `users/${user.id}/tests`, test.id);
      await updateDoc(testRef, {
        status: 'graded',
        studentAnswers: answers,
        score: gradeResult.score,
        aiFeedback: gradeResult.feedback,
        attemptsUsed: newAttemptsUsed,
        completedAt: new Date().toISOString()
      });
      setGradingResult(gradeResult);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert("Wystąpił błąd podczas zapisywania odpowiedzi lub weryfikacji AI.");
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
                    {q.type === 'multiple_choice' ? 'Wielokrotny wybór' : q.type === 'find_mistake' ? 'Wybór poprawnego zdania' : q.type === 'fill_in_blank' ? 'Luki' : q.type === 'matching' ? 'Łączenie w pary' : q.type === 'writing' ? 'Writing' : 'Tłumaczenie'}
                  </div>
                  {q.instruction && (
                    <div className="font-bold text-primary text-lg mb-2">{q.instruction}</div>
                  )}
                  <div className="font-medium text-xl leading-relaxed">{q.prompt}</div>
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
                
                {(q.type === 'fill_in_blank' || q.type === 'translation') && (
                  <div>
                    <input
                      type="text"
                      value={answers[q.id] || ''}
                      onChange={e => handleAnswerChange(q.id, e.target.value)}
                      placeholder={q.type === 'translation' ? "Przetłumacz na angielski..." : "Wpisz brakujący fragment..."}
                      className="w-full bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-lg outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                    />
                  </div>
                )}
                
                {q.type === 'matching' && q.options && (
                  <div className="space-y-4">
                    <div className="text-sm text-content-muted">{i18n.t("Przepisz połączone pary (oddzielone znakiem równości =):")}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 opacity-80">
                        {q.options.map((opt, j) => {
                            const p = opt.split('=');
                            return (
                                <div key={j} className="p-3 border border-white/10 rounded-xl bg-black/30 backdrop-blur-sm flex items-center justify-between text-sm">
                                    <span>{p[0]?.trim()}</span>
                                    <span className="text-content-muted">/</span>
                                    <span>{p[1]?.trim()}</span>
                                </div>
                            );
                        })}
                    </div>
                    <textarea
                      value={answers[q.id] || ''}
                      onChange={e => handleAnswerChange(q.id, e.target.value)}
                      placeholder={i18n.t("Wpisz połączone pary, np: jabłko = apple pies = dog")}
                      className="w-full bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-base outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all h-32 resize-y font-mono"
                    />
                  </div>
                )}

                {q.type === 'writing' && (
                  <div>
                    <div className="text-sm text-content-muted mb-2 font-bold text-primary">{i18n.t("Uwaga: Funkcja wklejania jest zablokowana w tym zadaniu.")}</div>
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
                      className="w-full bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-lg outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all min-h-[200px] resize-y"
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
