import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  collectionGroup,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  doc,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { SpecialTask } from '../../types';
import type { AttemptV2, ExerciseContractV2 } from '../../services/homeworkV2/contracts';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { AlertTriangle, ChevronDown, ChevronRight, MessageSquareText, ShieldCheck } from 'lucide-react';

/**
 * Ekran wglądu lektora w prace domowe silnika v2.
 *
 * Nie ma tu "zatwierdzania oceny" — werdykt AI (`GradingVerdictV2`) jest
 * niemutowalny, reguły odmawiają zapisu na `attempts` komukolwiek (patrz
 * `docs/plan-weekend-2026-09-12.md`, Etap A). Jedyna akcja lektora to
 * odnotowanie przeglądu i opcjonalny komentarz — obie rzeczy zapisane na
 * dokumencie `specialTasks`, nie na próbie.
 */

type AttemptDoc = AttemptV2 & {
  id: string;
  taskId: string;
  exerciseId: string;
  studentUid: string;
  rubricScores?: Record<string, number>;
  weightedScore?: number;
  confidence?: number;
  masteryState?: string;
  requiresTeacherReview?: boolean;
  feedbackMessage?: string;
};

const masteryLabel: Record<string, string> = {
  nowe: 'Nowe',
  'ćwiczymy': 'Ćwiczymy',
  opanowane: 'Opanowane',
};

const findExercise = (task: SpecialTask, exerciseId: string): ExerciseContractV2 | undefined =>
  (task.sentences as ExerciseContractV2[] | undefined)?.find((e) => e?.id === exerciseId);

export const HomeworkV2ReviewScreen: React.FC = () => {
  const [tasks, setTasks] = useState<SpecialTask[]>([]);
  const [flaggedAttempts, setFlaggedAttempts] = useState<AttemptDoc[]>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [taskAttempts, setTaskAttempts] = useState<Record<string, AttemptDoc[]>>({});
  const [loadingAttemptsFor, setLoadingAttemptsFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [savingNoteFor, setSavingNoteFor] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'specialTasks'), where('engineVersion', '==', 2));
    return onSnapshot(q, (snap) => {
      setTasks(snap.docs.map((d) => ({ ...(d.data() as SpecialTask), id: d.id })));
    });
  }, []);

  useEffect(() => {
    const q = query(collectionGroup(db, 'attempts'), where('requiresTeacherReview', '==', true));
    return onSnapshot(q, (snap) => {
      setFlaggedAttempts(
        snap.docs.map((d) => ({
          ...(d.data() as AttemptV2),
          id: d.id,
          taskId: d.ref.parent.parent?.id || '',
          exerciseId: (d.data() as any).exerciseId,
          studentUid: (d.data() as any).studentUid,
        }))
      );
    });
  }, []);

  const tasksById = useMemo(() => {
    const map: Record<string, SpecialTask> = {};
    tasks.forEach((t) => {
      if (t.id) map[t.id] = t;
    });
    return map;
  }, [tasks]);

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [tasks]
  );

  const loadAttemptsForTask = async (taskId: string) => {
    if (taskAttempts[taskId]) return;
    setLoadingAttemptsFor(taskId);
    try {
      const snap = await getDocs(collection(db, 'specialTasks', taskId, 'attempts'));
      setTaskAttempts((prev) => ({
        ...prev,
        [taskId]: snap.docs.map((d) => ({
          ...(d.data() as AttemptV2),
          id: d.id,
          taskId,
          exerciseId: (d.data() as any).exerciseId,
          studentUid: (d.data() as any).studentUid,
        })),
      }));
    } finally {
      setLoadingAttemptsFor(null);
    }
  };

  const toggleTask = (taskId: string) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
      return;
    }
    setExpandedTaskId(taskId);
    loadAttemptsForTask(taskId);
  };

  const saveReviewNote = async (task: SpecialTask) => {
    if (!task.id) return;
    setSavingNoteFor(task.id);
    try {
      await updateDoc(doc(db, 'specialTasks', task.id), {
        teacherReviewedAt: new Date().toISOString(),
        teacherReviewNote: noteDraft[task.id] ?? task.teacherReviewNote ?? '',
      });
    } catch (e) {
      console.error('Nie udało się zapisać przeglądu v2:', e);
      alert('Błąd podczas zapisywania przeglądu.');
    } finally {
      setSavingNoteFor(null);
    }
  };

  const flaggedByTask = useMemo(() => {
    const map: Record<string, AttemptDoc[]> = {};
    flaggedAttempts.forEach((a) => {
      if (!a.taskId) return;
      (map[a.taskId] ||= []).push(a);
    });
    return map;
  }, [flaggedAttempts]);

  return (
    <div className="space-y-6">
      <Card className="liquid-glass p-5 space-y-3">
        <h2 className="text-lg font-bold text-text-hi flex items-center gap-2">
          <AlertTriangle size={20} className="text-warn" />
          Wymaga uwagi ({flaggedAttempts.length})
        </h2>
        <p className="text-sm text-content-muted">
          Próby, których model ocenił z niską pewnością (`confidence` poniżej
          progu) albo zadania niezatwierdzone automatycznie przez walidator.
          Werdyktu nie da się zmienić — możesz przejrzeć próbę i zostawić
          notatkę dla siebie/kursanta niżej, przy zadaniu.
        </p>
        {flaggedAttempts.length === 0 ? (
          <p className="text-sm text-content-muted italic">Brak zgłoszeń — wszystko w normie.</p>
        ) : (
          <ul className="space-y-2">
            {Object.entries(flaggedByTask).map(([taskId, attempts]) => {
              const task = tasksById[taskId];
              return (
                <li key={taskId}>
                  <button
                    onClick={() => toggleTask(taskId)}
                    className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg bg-warn/10 border border-warn/30 hover:bg-warn/20 transition-colors"
                  >
                    <span className="text-sm font-semibold text-text-hi">
                      {task?.studentName || 'Kursant'} — {task?.title || 'Praca domowa'}
                    </span>
                    <Badge tone="warn">{attempts.length} do przejrzenia</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="liquid-glass p-5 space-y-3">
        <h2 className="text-lg font-bold text-text-hi">Wszystkie zestawy v2 ({sortedTasks.length})</h2>
        {sortedTasks.length === 0 ? (
          <p className="text-sm text-content-muted italic">
            Żaden kursant nie ma jeszcze przypisanego zestawu w silniku v2.
          </p>
        ) : (
          <ul className="space-y-2">
            {sortedTasks.map((task) => {
              const isOpen = expandedTaskId === task.id;
              const exercises = (task.sentences as ExerciseContractV2[] | undefined) || [];
              const attempts = (task.id && taskAttempts[task.id]) || [];
              const flagCount = (task.id && flaggedByTask[task.id]?.length) || 0;

              return (
                <li key={task.id} className="rounded-lg border border-line-strong overflow-hidden">
                  <button
                    onClick={() => task.id && toggleTask(task.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-line-soft hover:bg-line-soft/70 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-text-hi">
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      {task.studentName || 'Kursant'} — {task.title}
                    </span>
                    <span className="flex items-center gap-2">
                      {task.teacherReviewedAt && (
                        <span title={`Przejrzano ${new Date(task.teacherReviewedAt).toLocaleString()}`}>
                          <ShieldCheck size={16} className="text-primary" />
                        </span>
                      )}
                      {flagCount > 0 && <Badge tone="warn">{flagCount}</Badge>}
                      <span className="text-xs text-content-muted">{exercises.length} zadań</span>
                    </span>
                  </button>

                  {isOpen && (
                    <div className="p-4 space-y-4 bg-base-200/40">
                      {loadingAttemptsFor === task.id ? (
                        <p className="text-sm text-content-muted">Wczytywanie prób…</p>
                      ) : exercises.length === 0 ? (
                        <p className="text-sm text-content-muted italic">Brak zadań w tym zestawie.</p>
                      ) : (
                        exercises.map((ex) => {
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
                                exAttempts.map((a) => (
                                  <div
                                    key={a.id}
                                    className={`text-xs rounded-md p-2 border ${
                                      a.requiresTeacherReview
                                        ? 'border-warn/50 bg-warn/10'
                                        : 'border-line-strong bg-line-soft/40'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-mono">Próba {a.attemptNumber}</span>
                                      <span className="flex items-center gap-2">
                                        {a.masteryState && (
                                          <Badge tone={a.masteryState === 'opanowane' ? 'accent' : 'neutral'}>
                                            {masteryLabel[a.masteryState] || a.masteryState}
                                          </Badge>
                                        )}
                                        {typeof a.confidence === 'number' && (
                                          <span className="text-content-muted">
                                            pewność {(a.confidence * 100).toFixed(0)}%
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                    <p className="text-content-muted">
                                      <strong>Odpowiedź:</strong> {a.answer}
                                    </p>
                                    {a.feedbackMessage && (
                                      <p className="text-content-muted mt-1">
                                        <strong>Feedback:</strong> {a.feedbackMessage}
                                      </p>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          );
                        })
                      )}

                      <div className="pt-2 border-t border-line-strong space-y-2">
                        <label className="text-xs font-semibold text-content-muted flex items-center gap-1.5">
                          <MessageSquareText size={14} /> Notatka z przeglądu (widoczna tylko dla lektora)
                        </label>
                        <textarea
                          value={task.id ? noteDraft[task.id] ?? task.teacherReviewNote ?? '' : ''}
                          onChange={(e) =>
                            task.id && setNoteDraft((prev) => ({ ...prev, [task.id!]: e.target.value }))
                          }
                          rows={2}
                          className="w-full text-sm rounded-lg bg-base-100 border border-line-strong p-2 text-text-hi"
                          placeholder="Np. sprawdzić z kursantem na następnej lekcji…"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          isLoading={savingNoteFor === task.id}
                          onClick={() => saveReviewNote(task)}
                        >
                          Oznacz jako przejrzane
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default HomeworkV2ReviewScreen;
