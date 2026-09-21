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
  /**
   * Nawigacja z powiadomienia/kafelka na pulpicie ("Nowa praca domowa",
   * widget "Wymaga uwagi" itd.) przekazuje konkretny `taskId`. Gdy to
   * zadanie jest w silniku v2, otwiera je od razu. Gdy nie — może być
   * zadaniem v1 kursanta, który ma RÓWNIEŻ jakiś zestaw v2 (więc `fallback`
   * niżej by się nie uruchomił) — wtedy oddajemy `fallback`, żeby link nie
   * ginął w liście złego silnika.
   */
  initialTaskId?: string | null;
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

const StudentHomeworkV2Screen: React.FC<StudentHomeworkV2ScreenProps> = ({ user, fallback, initialTaskId }) => {
  const [tasks, setTasks] = useState<V2Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [states, setStates] = useState<Record<string, ExerciseState>>({});
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  // Musi stać przed każdym `return` warunkowym niżej — Reguły Hooków nie
  // pozwalają wywołać `useState` dopiero po wcześniejszym wczesnym wyjściu
  // z komponentu (przy pierwszym renderze bez `exercise` ten hook w ogóle
  // by się nie wykonał, więc kolejny render z zadaniem rozjeżdżałby kolejność
  // hooków i React zgłaszałby błąd/tracił stan pozostałych hooków).
  const [showManualHint, setShowManualHint] = useState(false);

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

  // Nawigacja z powiadomienia/kafelka wskazuje konkretne zadanie — otwiera
  // się od razu, zamiast zostawiać kursanta na liście do ręcznego kliknięcia.
  const didAutoOpenRef = useRef(false);
  useEffect(() => {
    if (!initialTaskId || isLoading || didAutoOpenRef.current) return;
    if (tasks.some((t) => t.id === initialTaskId)) {
      didAutoOpenRef.current = true;
      setActiveTaskId(initialTaskId);
      setIndex(0);
    }
  }, [initialTaskId, tasks, isLoading]);

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
  // Ten sam fallback także wtedy, gdy nawigacja celuje w konkretne zadanie,
  // którego nie ma wśród zestawów v2 — to znaczy, że jest to zadanie v1
  // kursanta, który ma RÓWNIEŻ jakiś zestaw v2 (inaczej trafiłby w gałąź
  // wyżej), więc bez tego link z powiadomienia gubiłby się w liście v2.
  if (!activeTask && fallback && (tasks.length === 0 || (initialTaskId && !tasks.some((t) => t.id === initialTaskId)))) {
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

  // Kontrakt v2 przewiduje wyłącznie `content` (patrz ExerciseContractV2 w
  // functions/src/homeworkV2/contracts.ts), ale ekran nie może pokazać
  // pustej karty, gdyby jakiś starszy/uszkodzony dokument tego pola nie miał —
  // stąd defensywny fallback na nazwy z innych miejsc kontraktu oraz log
  // do konsoli, żeby dało się zdiagnozować, które pole faktycznie zabrakło.
  const exerciseContent =
    exercise.content || (exercise as any).sentence || (exercise as any).prompt || (exercise as any).sourceText || '';
  if (!exerciseContent) {
    // eslint-disable-next-line no-console
    console.error('[StudentHomeworkV2Screen] Zadanie bez treści (content):', exercise);
  }

  const availableHint =
    state.hint ||
    exercise.hintSmall ||
    exercise.hintLarge ||
    (Array.isArray(exercise.requiredMaterial) ? exercise.requiredMaterial.join(', ') : exercise.requiredMaterial) ||
    exercise.learningObjective;

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 pb-28 animate-in fade-in duration-300">
      {/* Pasek postępu i nagłówek */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-content-muted">
            Zadanie <strong className="text-white">{index + 1}</strong> z{' '}
            <strong className="text-white">{exercises.length}</strong>
          </span>
          {state.masteryState ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                state.masteryState === 'opanowane'
                  ? 'bg-primary/20 text-primary border border-primary/40'
                  : 'bg-white/10 text-content-muted border border-white/15'
              }`}
            >
              {MASTERY_LABEL[state.masteryState]}
            </span>
          ) : (
            <span className="text-content-muted font-mono text-[11px]">
              Próby: {state.attemptsLeft}/3
            </span>
          )}
        </div>

        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((index + 1) / Math.max(exercises.length, 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Karta zadania */}
      <section className="rounded-2xl border border-white/10 bg-base-200/70 p-5 sm:p-7 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-white/5 pb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold uppercase tracking-wider">
            {exercise.exerciseType === 'fix_sentence' ? 'Korekta zdania' : 'Tłumaczenie'}
          </span>

          {availableHint && !state.done && (
            <button
              type="button"
              onClick={() => setShowManualHint((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                showManualHint
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              <Lightbulb size={13} className={showManualHint ? 'text-amber-300 fill-amber-300/40' : 'text-amber-400'} />
              <span>{showManualHint ? 'Ukryj wskazówkę' : 'Wskazówka'}</span>
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-content-muted font-medium">
            {exercise.instruction || 'Uzupełnij zdanie.'}
          </p>
          {exerciseContent ? (
            <p className="text-lg sm:text-xl font-bold leading-relaxed text-white">{exerciseContent}</p>
          ) : (
            <p className="text-sm text-danger">
              Nie udało się wczytać treści tego zadania. Wróć do listy i spróbuj ponownie albo zgłoś to lektorowi.
            </p>
          )}
        </div>

        {/* Wskazówka rozwijana */}
        {showManualHint && availableHint && !state.done && (
          <div className="p-3.5 rounded-xl bg-amber-950/25 border border-amber-500/35 text-warn text-xs sm:text-sm leading-relaxed flex items-start gap-2.5 animate-in fade-in duration-200 shadow-sm">
            <Lightbulb size={16} className="text-warn shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-warn block text-[11px] uppercase tracking-wider mb-0.5">
                Wskazówka lektora:
              </span>
              <span>{availableHint}</span>
            </div>
          </div>
        )}

        {/* Wzorzec po trzeciej próbie */}
        {state.modelAnswer && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 space-y-1.5 animate-in fade-in">
            <span className="text-[11px] uppercase font-bold tracking-wider text-primary block">Poprawna odpowiedź:</span>
            <p className="text-sm sm:text-base font-semibold text-white">{state.modelAnswer}</p>
            {state.awaitingCorrection && (
              <p className="pt-1 text-xs text-content-muted">Przepisz ją powyżej własnymi słowami, aby utrwalić konstrukcję.</p>
            )}
          </div>
        )}

        {/* Feedback asystenta */}
        {state.message && (
          <div className="rounded-xl border border-white/10 bg-base-100/80 p-4">
            <p className="text-sm leading-relaxed text-content">{state.message}</p>
          </div>
        )}

        {/* Odpowiedź */}
        {!state.done && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-content-muted">Twoja odpowiedź:</label>
              {exercise.exerciseType === 'fix_sentence' && exercise.content && state.answer !== exercise.content && (
                <button
                  type="button"
                  onClick={() => setAnswer(exercise.content)}
                  className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                >
                  Wstaw zdanie do edycji
                </button>
              )}
            </div>
            <textarea
              value={state.answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={3}
              placeholder="Wpisz odpowiedź…"
              className="w-full p-4 rounded-xl border border-white/15 bg-base-100/90 text-white text-[15px] sm:text-base focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all resize-y placeholder:text-content-muted/50"
            />
            <div className="flex items-center justify-between text-xs text-content-muted">
              <span>
                {state.attemptNumber === 0
                  ? 'Masz 3 próby.'
                  : state.attemptsLeft > 0
                  ? `Pozostałe próby: ${state.attemptsLeft}`
                  : 'Ostatni krok przed zakończeniem.'}
              </span>
              <span className="text-[11px] text-content-muted/70">Wciśnij Sprawdź, aby zatwierdzić</span>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
      </section>

      {/* Pasek akcji na dole */}
      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-base-100/90 p-4 backdrop-blur-md z-20">
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          {canGoNext ? (
            <button
              type="button"
              onClick={() => {
                setShowManualHint(false);
                setIndex((i) => i + 1);
              }}
              className="w-full rounded-xl bg-primary px-5 py-3.5 text-base font-bold text-accent-ink shadow-btn hover:brightness-110 transition-all cursor-pointer"
            >
              Następne zadanie →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!state.answer.trim() || isSending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-base font-bold text-accent-ink shadow-btn hover:brightness-110 transition-all cursor-pointer disabled:opacity-40"
            >
              {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {isSending ? 'Sprawdzam odpowiedź…' : 'Sprawdź odpowiedź'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentHomeworkV2Screen;
