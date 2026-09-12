import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Check, ChevronRight, Lightbulb, Loader2, Send } from 'lucide-react';

import { db } from '../../firebase';
import { User } from '../../types';
import { studentTasksQuery } from '../../utils/homework';
import { ExerciseContractV2, MasteryState, isV2Task } from '../../services/homeworkV2/contracts';
import { submitHomeworkAttemptV2 } from '../../services/homeworkV2Client';

/**
 * Ekran kursanta dla silnika v2.
 *
 * Mobile-first i jedno zadanie na ekran. Kursant robi to w tramwaju albo
 * między jednym a drugim — każda dodatkowa decyzja na ekranie jest kosztem,
 * który płaci przy każdym zadaniu.
 *
 * Czego tu świadomie NIE MA: procentu, słupka postępu punktowego i listy
 * wszystkich błędów. Trening pokazuje feedback i stan (§3.1 specyfikacji).
 * Liczby zostają u lektora.
 *
 * Szkic idzie do `specialTasks/{taskId}/drafts/{exerciseId}` w Firestore,
 * a nie do `localStorage` jak w v1 — dzięki temu kursant zaczyna na telefonie
 * i kończy na laptopie.
 */

interface StudentHomeworkV2ScreenProps {
  user: User;
  /**
   * Ekran v1, pokazywany, gdy kursant nie ma żadnego zestawu v2.
   *
   * Bez tego włączenie flagi schowałoby całą dotychczasową pracę domową
   * kursanta — a zlecenie wymaga, żeby wszystkie dotychczasowe zestawy
   * i wyniki dalej działały.
   */
  fallback?: React.ReactNode;
}

interface V2Task {
  id: string;
  title: string;
  dueDate?: string;
  createdAt?: string;
  sentences: ExerciseContractV2[];
}

interface ExerciseState {
  answer: string;
  attemptNumber: number;
  attemptsLeft: number;
  message: string;
  masteryState: MasteryState | null;
  hint: string | null;
  modelAnswer: string | null;
  /** Po wzorcu kursant pisze poprawioną wersję — to ostatni krok, nie kolejna próba. */
  awaitingCorrection: boolean;
  done: boolean;
}

const emptyState = (): ExerciseState => ({
  answer: '',
  attemptNumber: 0,
  attemptsLeft: 3,
  message: '',
  masteryState: null,
  hint: null,
  modelAnswer: null,
  awaitingCorrection: false,
  done: false,
});

const MASTERY_LABEL: Record<MasteryState, string> = {
  nowe: 'Nowe',
  ćwiczymy: 'Jeszcze ćwiczymy',
  opanowane: 'Opanowane',
};

const StudentHomeworkV2Screen: React.FC<StudentHomeworkV2ScreenProps> = ({ user, fallback }) => {
  const [tasks, setTasks] = useState<V2Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [states, setStates] = useState<Record<string, ExerciseState>>({});
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- wczytanie zadań v2 ---------------------------------------------------
  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = onSnapshot(
      studentTasksQuery(user.id),
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as any))
          // Odwrotność filtra z ekranu v1: tutaj wchodzą wyłącznie zestawy v2.
          .filter(isV2Task)
          .sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          ) as V2Task[];
        setTasks(list);
        setIsLoading(false);
      },
      () => setIsLoading(false)
    );
    return unsubscribe;
  }, [user?.id]);

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeTaskId) || null,
    [tasks, activeTaskId]
  );

  const exercises = activeTask?.sentences || [];
  const exercise = exercises[index];
  const state = exercise ? states[exercise.id] || emptyState() : emptyState();

  // --- wznowienie: wczytanie szkicu -----------------------------------------
  useEffect(() => {
    if (!activeTask || !exercise) return;
    const ref = doc(db, 'specialTasks', activeTask.id, 'drafts', exercise.id);
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const saved = snapshot.data()?.answer;
      if (typeof saved !== 'string') return;
      setStates((current) => {
        const existing = current[exercise.id] || emptyState();
        // Szkic z chmury nie nadpisuje tego, co kursant właśnie pisze —
        // wchodzi tylko wtedy, gdy pole jest puste (świeże wejście na zadanie).
        if (existing.answer) return current;
        return { ...current, [exercise.id]: { ...existing, answer: saved } };
      });
    });
    return unsubscribe;
  }, [activeTask?.id, exercise?.id]);

  // --- autosave -------------------------------------------------------------
  const scheduleSave = useCallback(
    (answer: string) => {
      if (!activeTask || !exercise) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // 800 ms: zapis po każdym znaku to setki zapisów na jedno zadanie.
      saveTimer.current = setTimeout(() => {
        setDoc(doc(db, 'specialTasks', activeTask.id, 'drafts', exercise.id), {
          exerciseId: exercise.id,
          answer,
          updatedAt: new Date().toISOString(),
        }).catch(() => {
          // Szkic to wygoda, nie dane krytyczne. Odpowiedź i tak poleci
          // przy wysłaniu — brak zapisu nie może niczego zatrzymać.
        });
      }, 800);
    },
    [activeTask?.id, exercise?.id]
  );

  const setAnswer = (value: string) => {
    if (!exercise) return;
    setStates((current) => ({
      ...current,
      [exercise.id]: { ...(current[exercise.id] || emptyState()), answer: value },
    }));
    scheduleSave(value);
  };

  // --- wysłanie próby -------------------------------------------------------
  const handleSubmit = async () => {
    if (!activeTask || !exercise || !state.answer.trim() || isSending) return;
    setIsSending(true);
    setError('');
    try {
      const result = await submitHomeworkAttemptV2({
        taskId: activeTask.id,
        exerciseId: exercise.id,
        answer: state.answer.trim(),
      });

      setStates((current) => ({
        ...current,
        [exercise.id]: {
          ...(current[exercise.id] || emptyState()),
          // Po wzorcu czyścimy pole — kursant pisze poprawioną wersję od nowa.
          answer: result.revealModelAnswer ? '' : current[exercise.id]?.answer || '',
          attemptNumber: result.attemptNumber,
          attemptsLeft: result.attemptsLeft,
          message: result.message,
          masteryState: result.masteryState,
          hint: result.nextHint,
          modelAnswer: result.modelAnswer || null,
          awaitingCorrection: result.revealModelAnswer && !state.awaitingCorrection,
          done: result.masteryState === 'opanowane' || (result.attemptsLeft === 0 && state.awaitingCorrection),
        },
      }));
    } catch (e: any) {
      setError(e?.message || 'Nie udało się wysłać odpowiedzi. Spróbuj jeszcze raz.');
    } finally {
      setIsSending(false);
    }
  };

  // --- lista zadań ----------------------------------------------------------
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-text-mute" size={24} />
      </div>
    );
  }

  // Brak zestawów v2 — oddajemy ekran v1 razem z całą historią kursanta.
  if (!activeTask && tasks.length === 0 && fallback) {
    return <>{fallback}</>;
  }

  if (!activeTask) {
    return (
      <div className="mx-auto max-w-lg space-y-3 px-4 py-6">
        <h2 className="text-lg font-bold text-text-hi">Prace domowe</h2>
        {tasks.length === 0 && (
          <p className="text-sm text-text-2">Nie masz teraz żadnej pracy domowej.</p>
        )}
        {tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => {
              setActiveTaskId(task.id);
              setIndex(0);
            }}
            className="flex w-full items-center justify-between rounded-2xl border border-line-strong bg-surface-flat/40 px-4 py-4 text-left"
          >
            <span>
              <span className="block text-sm font-semibold text-text-hi">{task.title}</span>
              <span className="block text-xs text-text-2">
                {task.sentences?.length || 0} zadań
                {task.dueDate ? ` · na ${task.dueDate}` : ''}
              </span>
            </span>
            <ChevronRight size={18} className="text-text-mute" />
          </button>
        ))}
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center space-y-4">
        <Check size={40} className="mx-auto text-primary" />
        <p className="text-base font-semibold text-text-hi">To wszystko na dziś.</p>
        <button
          type="button"
          onClick={() => setActiveTaskId(null)}
          className="rounded-xl border border-line-strong px-4 py-2 text-sm text-text-2"
        >
          Wróć do listy
        </button>
      </div>
    );
  }

  const canGoNext = state.done || (state.attemptsLeft === 0 && !state.awaitingCorrection);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6 pb-28">
      {/* Postęp — ile zadań, nie ile punktów. */}
      <div className="flex items-center justify-between text-xs text-text-2">
        <span>
          Zadanie {index + 1} z {exercises.length}
        </span>
        {state.masteryState && (
          <span
            className={`rounded-full px-2.5 py-1 ${
              state.masteryState === 'opanowane'
                ? 'bg-primary/15 text-primary'
                : 'bg-line-soft text-text-2'
            }`}
          >
            {MASTERY_LABEL[state.masteryState]}
          </span>
        )}
      </div>

      {/* Zadanie */}
      <section className="rounded-2xl border border-line-strong bg-surface-flat/40 p-5 space-y-3">
        <p className="text-xs text-text-2">{exercise.instruction}</p>
        <p className="text-lg leading-relaxed text-text-hi">{exercise.content}</p>
      </section>

      {/* Podpowiedź — z kontraktu zadania, nie od modelu */}
      {state.hint && !state.done && (
        <div className="flex gap-2 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3">
          <Lightbulb size={16} className="mt-0.5 shrink-0 text-warn" />
          <p className="text-sm text-warn">{state.hint}</p>
        </div>
      )}

      {/* Wzorzec po trzeciej próbie */}
      {state.modelAnswer && (
        <div className="rounded-2xl border border-line-strong bg-line-soft px-4 py-3 space-y-1">
          <p className="text-xs text-text-2">Poprawna odpowiedź</p>
          <p className="text-sm text-text-hi">{state.modelAnswer}</p>
          {state.awaitingCorrection && (
            <p className="pt-1 text-xs text-text-2">Przepisz ją własnymi słowami, żeby utrwalić.</p>
          )}
        </div>
      )}

      {/* Feedback Asystenta Cribro */}
      {state.message && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm leading-relaxed text-text-hi">{state.message}</p>
        </div>
      )}

      {/* Odpowiedź */}
      {!state.done && (
        <>
          <textarea
            value={state.answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            placeholder="Twoja odpowiedź"
            className="w-full rounded-2xl border border-line-strong bg-ink px-4 py-3 text-base text-text-hi"
          />
          <p className="text-xs text-text-mute">
            {state.attemptNumber === 0
              ? 'Masz trzy próby.'
              : state.attemptsLeft > 0
              ? `Zostały próby: ${state.attemptsLeft}`
              : 'To ostatni krok tego zadania.'}
          </p>
        </>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Akcja — duży przycisk, jeden na ekran */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line-strong bg-ink/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-lg">
          {canGoNext ? (
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-ink"
            >
              Dalej
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!state.answer.trim() || isSending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-ink disabled:opacity-40"
            >
              {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {isSending ? 'Sprawdzam…' : 'Sprawdź'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentHomeworkV2Screen;
