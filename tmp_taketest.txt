import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { StudentTest } from '../../types';
import { gradeTest } from '../../services/geminiService';
import Card from '../ui/Card';
import ConfirmModal from '../ui/ConfirmModal';
import Button from '../ui/Button';

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
        <h2 className="text-3xl font-bold text-primary">Test Zakończony!</h2>
        <p className="text-content-muted">Twoje odpowiedzi zostały zapisane. Oczekuj na pełne sprawdzenie przez nauczyciela.</p>
        <Button onClick={onBack}>Wróć do listy testów</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="text-content-muted hover:text-white flex items-center gap-2">
          &larr; Wróć
        </button>
        <h1 className="text-2xl font-bold">{test.title}</h1>
      </div>

      <div className="bg-primary/10 text-primary p-4 rounded-lg border border-primary/20 text-sm mb-6">
        <strong>Zakres:</strong> {test.scope}
      </div>

      <div className="space-y-8">
        {test.questions.map((q, idx) => (
          <Card key={q.id} className="p-6 bg-base-200/40 backdrop-blur-md border border-white/10">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center font-bold text-sm shrink-0">
                {idx + 1}
              </div>
              <div className="flex-1 space-y-4">
                <div className="font-medium text-lg">{q.prompt}</div>
                {q.hint && <div className="text-xs text-content-muted italic">Wskazówka: {q.hint}</div>}
                
                {q.type === 'multiple_choice' && q.options && (
                  <div className="space-y-2">
                    {q.options.map((opt, oIdx) => (
                      <label key={oIdx} className="flex items-center gap-3 p-3 bg-base-100 rounded-lg border border-base-300 cursor-pointer hover:border-primary/50 transition-colors">
                        <input 
                          type="radio" 
                          name={`q_${q.id}`} 
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={() => handleAnswerChange(q.id, opt)}
                          className="accent-primary"
                        />
                        <span>{opt}</span>
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
                      className="w-full bg-base-100 border border-base-300 rounded-lg p-3 outline-none focus:border-primary/50"
                    />
                  </div>
                )}
                
                {q.type === 'matching' && q.options && (
                  <div className="space-y-3">
                    <div className="text-sm text-content-muted mb-2">Przepisz połączone pary (oddzielone znakiem równości =):</div>
                    <div className="grid grid-cols-2 gap-4 mb-2 opacity-70">
                        {q.options.map((opt, j) => {
                            const p = opt.split('=');
                            return (
                                <div key={j} className="p-2 border border-white/10 rounded bg-base-100 text-sm">
                                    {p[0]?.trim()} / {p[1]?.trim()}
                                </div>
                            );
                        })}
                    </div>
                    <textarea
                      value={answers[q.id] || ''}
                      onChange={e => handleAnswerChange(q.id, e.target.value)}
                      placeholder="Wpisz połączone pary, np:\njabłko = apple\npies = dog"
                      className="w-full bg-base-100 border border-base-300 rounded-lg p-3 outline-none focus:border-primary/50 h-32 resize-y font-mono text-sm"
                    />
                  </div>
                )}

                {q.type === 'writing' && (
                  <div>
                    <div className="text-sm text-content-muted mb-2 font-bold text-primary">Uwaga: Funkcja wklejania jest zablokowana w tym zadaniu.</div>
                    <textarea
                      value={answers[q.id] || ''}
                      onChange={e => handleAnswerChange(q.id, e.target.value)}
                      onPaste={(e) => e.preventDefault()}
                      onCopy={(e) => e.preventDefault()}
                      onCut={(e) => e.preventDefault()}
                      placeholder="Zacznij pisać tutaj..."
                      className="w-full bg-base-100 border border-base-300 rounded-lg p-3 outline-none focus:border-primary/50 min-h-[200px] resize-y"
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
          Zakończ Test
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
