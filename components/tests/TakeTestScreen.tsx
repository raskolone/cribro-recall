import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { StudentTest } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';

interface TakeTestScreenProps {
  test: StudentTest;
  onBack: () => void;
}

const TakeTestScreen: React.FC<TakeTestScreenProps> = ({ test, onBack }) => {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    // Validate all answered? Let's assume yes or warn
    const unanswered = test.questions.filter(q => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      if (!window.confirm(`Masz ${unanswered.length} nieodpowiedzianych pytań. Czy na pewno chcesz zakończyć test?`)) {
        return;
      }
    }

    setIsSubmitting(true);
    
    // Auto-grade multiple choice and exact matches (we can do basic auto-grading, or AI grading, let's do basic for now)
    let score = 0;
    test.questions.forEach(q => {
      const studentAns = (answers[q.id] || '').trim().toLowerCase();
      const correctAns = (q.correctAnswer || '').trim().toLowerCase();
      
      if (q.type === 'multiple_choice' && studentAns === correctAns) {
        score += 1;
      } else if (q.type === 'fill_in_blank' && studentAns === correctAns) {
        score += 1; // Or levenshtein distance? exact for now
      } else if (q.type === 'translation') {
        // AI or teacher grading needed, let's just mark exact match for now
        if (studentAns === correctAns) score += 1;
      }
    });

    try {
      if (user?.id && test.id) {
        const testRef = doc(db, `users/${user.id}/tests`, test.id);
        await updateDoc(testRef, {
          status: 'graded',
          score,
          studentAnswers: answers,
          completedAt: new Date().toISOString()
        });
        setSubmitted(true);
      }
    } catch (err) {
      console.error(err);
      alert("Wystąpił błąd podczas zapisywania testu.");
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
    </div>
  );
};

export default TakeTestScreen;
