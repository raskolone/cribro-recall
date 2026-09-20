import React, { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { SpecialTask } from '../../types';
import type { AttemptV2, ExerciseContractV2, GradingVerdictV2 } from '../../services/homeworkV2/contracts';
import { proposeGradeV2, approveGradeV2 } from '../../services/homeworkV2Client';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { Check, MessageSquareText, Sparkles } from 'lucide-react';

/**
 * Podgląd JEDNEGO zestawu silnika v2 dla lektora — osadzony wewnątrz
 * ujednoliconego okna szczegółów pracy domowej w `HomeworkScreen.tsx`, nie
 * jako osobny ekran "Przegląd v2" (ujednolicenie modułu prac domowych,
 * human-in-the-loop).
 *
 * Werdykt (`GradingVerdictV2`) NIE jest tu już z automatu — lektor
 * uruchamia ocenę przyciskiem „Zaproponuj ocenę z AI"
 * (`proposeHomeworkV2Grade`), może poprawić komentarz, i dopiero wtedy
 * zatwierdza przyciskiem „Zatwierdź i wyślij do kursanta"
 * (`approveHomeworkV2Grade`), co odblokowuje feedback dla kursanta.
 */

type AttemptDoc = AttemptV2 & {
  id: string;
  exerciseId: string;
  studentUid: string;
  rubricScores?: Record<string, number>;
  weightedScore?: number;
  confidence?: number;
  masteryState?: string;
  requiresTeacherReview?: boolean;
  pendingTeacherApproval?: boolean;
  feedbackMessage?: string;
};

const masteryLabel: Record<string, string> = {
  nowe: 'Nowe',
  'ćwiczymy': 'Ćwiczymy',
  opanowane: 'Opanowane',
};

export interface HomeworkV2ReviewScreenProps {
  task: SpecialTask;
}

export const HomeworkV2ReviewScreen: React.FC<HomeworkV2ReviewScreenProps> = ({ task }) => {
  const [attempts, setAttempts] = useState<AttemptDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [proposingFor, setProposingFor] = useState<string | null>(null);
  const [approvingFor, setApprovingFor] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Record<string, { verdict: GradingVerdictV2; feedbackMessage: string }>>({});
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!task.id) return;
    let cancelled = false;
    setIsLoading(true);
    getDocs(collection(db, 'specialTasks', task.id, 'attempts'))
      .then((snap) => {
        if (cancelled) return;
        setAttempts(
          snap.docs.map((d) => ({
            ...(d.data() as AttemptV2),
            id: d.id,
            exerciseId: (d.data() as any).exerciseId,
            studentUid: (d.data() as any).studentUid,
          }))
        );
      })
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  const exercises = (task.sentences as ExerciseContractV2[] | undefined) || [];

  const handlePropose = async (attempt: AttemptDoc) => {
    if (!task.id) return;
    setProposingFor(attempt.id);
    try {
      const result = await proposeGradeV2({ taskId: task.id, attemptId: attempt.id });
      setProposals((prev) => ({ ...prev, [attempt.id]: result }));
      setFeedbackDraft((prev) => ({ ...prev, [attempt.id]: result.feedbackMessage }));
    } catch (e: any) {
      console.error('Nie udało się przygotować propozycji oceny v2:', e);
      alert('Błąd podczas przygotowania propozycji oceny: ' + (e?.message || e));
    } finally {
      setProposingFor(null);
    }
  };

  const handleApprove = async (attempt: AttemptDoc) => {
    if (!task.id) return;
    const proposal = proposals[attempt.id];
    if (!proposal) return;
    setApprovingFor(attempt.id);
    try {
      const feedbackMessage = feedbackDraft[attempt.id] ?? proposal.feedbackMessage;
      await approveGradeV2({
        taskId: task.id,
        attemptId: attempt.id,
        verdict: proposal.verdict,
        feedbackMessage,
      });

      setAttempts((prev) =>
        prev.map((a) =>
          a.id === attempt.id
            ? { ...a, ...proposal.verdict, requiresTeacherReview: false, pendingTeacherApproval: false, feedbackMessage }
            : a
        )
      );

      const targetStudentUid = task.studentUid || task.studentId;
      if (targetStudentUid) {
        const token = await auth.currentUser?.getIdToken();
        if (token) {
          fetch('/api/homework/notify-graded', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              studentUid: targetStudentUid,
              taskId: task.id,
              taskTitle: task.title || 'Praca domowa',
              score: Math.round((proposal.verdict.weightedScore || 0) * 100),
              teacherFeedback: feedbackMessage,
              teacherName: auth.currentUser?.displayName || 'Maciej Wyrozumski',
            }),
          }).catch((err) => console.warn('Błąd wysyłki e-mail o sprawdzonej pracy v2:', err));
        }
      }

      if (task.id) {
        await updateDoc(doc(db, 'specialTasks', task.id), { teacherReviewedAt: new Date().toISOString() }).catch(() => {});
      }
    } catch (e: any) {
      console.error('Nie udało się zatwierdzić oceny v2:', e);
      alert('Błąd podczas zatwierdzania oceny: ' + (e?.message || e));
    } finally {
      setApprovingFor(null);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-content-muted">Wczytywanie odpowiedzi kursanta…</p>;
  }

  if (exercises.length === 0) {
    return <p className="text-sm text-content-muted italic">Brak zadań w tym zestawie.</p>;
  }

  return (
    <div className="space-y-4">
      {exercises.map((ex) => {
        const exAttempts = attempts
          .filter((a) => a.exerciseId === ex.id)
          .sort((a, b) => (a.attemptNumber || 0) - (b.attemptNumber || 0));

        return (
          <div key={ex.id} className="rounded-lg border border-line-strong p-3 space-y-2">
            <p className="text-sm font-semibold text-text-hi">{ex.content}</p>
            <p className="text-xs text-content-muted">{ex.instruction}</p>
            {exAttempts.length === 0 ? (
              <p className="text-xs text-content-muted italic">Kursant jeszcze nie odpowiedział.</p>
            ) : (
              exAttempts.map((a) => {
                const isGraded = a.pendingTeacherApproval === false && typeof a.confidence === 'number';
                const proposal = proposals[a.id];
                return (
                  <div key={a.id} className="text-xs rounded-md p-2.5 border border-line-strong bg-line-soft/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono">Próba {a.attemptNumber}</span>
                      {isGraded && a.masteryState && (
                        <Badge tone={a.masteryState === 'opanowane' ? 'accent' : 'neutral'}>
                          {masteryLabel[a.masteryState] || a.masteryState}
                        </Badge>
                      )}
                    </div>
                    <p className="text-content-muted">
                      <strong>Odpowiedź:</strong> {a.answer}
                    </p>

                    {/* Subtelna notatka o pewności modelu — nie osobny boks ostrzeżenia. */}
                    {typeof a.confidence === 'number' && (
                      <p className="text-[11px] text-content-muted italic">
                        pewność modelu: {(a.confidence * 100).toFixed(0)}%
                      </p>
                    )}

                    {isGraded ? (
                      a.feedbackMessage && (
                        <p className="text-content-muted">
                          <strong>Feedback wysłany kursantowi:</strong> {a.feedbackMessage}
                        </p>
                      )
                    ) : proposal ? (
                      <div className="space-y-2 pt-1 border-t border-line-strong">
                        <p className="text-[11px] text-content-muted italic">
                          Propozycja AI — pewność {(proposal.verdict.confidence * 100).toFixed(0)}%,
                          stan: {masteryLabel[proposal.verdict.masteryState] || proposal.verdict.masteryState}
                        </p>
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-content-muted">
                          <MessageSquareText size={12} /> Komentarz dla kursanta (edytowalny):
                        </label>
                        <textarea
                          value={feedbackDraft[a.id] ?? proposal.feedbackMessage}
                          onChange={(e) => setFeedbackDraft((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          rows={2}
                          className="w-full text-xs rounded-lg bg-base-100 border border-line-strong p-2 text-text-hi"
                        />
                        <Button
                          size="sm"
                          isLoading={approvingFor === a.id}
                          onClick={() => handleApprove(a)}
                          className="flex items-center gap-1.5"
                        >
                          <Check size={14} /> Zatwierdź i wyślij do kursanta
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        isLoading={proposingFor === a.id}
                        onClick={() => handlePropose(a)}
                        className="flex items-center gap-1.5"
                      >
                        <Sparkles size={14} /> Zaproponuj ocenę z AI
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
};

export default HomeworkV2ReviewScreen;
