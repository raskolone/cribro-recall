import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { AlertTriangle, ChevronDown, Loader2, Send, Sparkles } from 'lucide-react';

import { db } from '../../firebase';
import { LessonRecord, User } from '../../types';
import { getLessonRecordsForStudent } from '../../services/lessonRecord';
import { isStudentVisibleLesson } from '../../utils/lessonBlocks';
import { cleanVocabularyTopic } from '../../utils/vocabulary';
import {
  EXERCISE_TYPES_V2,
  ExerciseContractV2,
  ExerciseTypeV2,
  MAX_LESSONS_AS_FUEL,
} from '../../services/homeworkV2/contracts';
import { assignHomeworkSetV2, generateHomeworkSetV2 } from '../../services/homeworkV2Client';
import HomeworkEmailConfirmationModal from './HomeworkEmailConfirmationModal';

/**
 * Kreator prac domowych v2 — jeden ekran podglądu i przycisk Wyślij.
 *
 * Zlecenie mówi wprost: obowiązkowa obróbka każdej karty jest zakazana.
 * Lektor ma zobaczyć zestaw i go wysłać. Szczegóły kontraktu — cel, wzorzec,
 * warianty, wynik walidatora — są pod rozwinięciem, bo to informacja na
 * wyjątek, a nie na każdy raz.
 *
 * Jedyne, co blokuje wysyłkę, to zadania oznaczone `requiresTeacherReview`:
 * walidator nie przepuścił ich po dwóch regeneracjach, więc nie mogą pójść
 * automatycznie. Lektor je odrzuca albo świadomie dopuszcza.
 */

interface HomeworkComposerV2Props {
  initialStudentId?: string;
  onAssigned?: () => void;
}

const TYPE_LABELS: Record<ExerciseTypeV2, string> = {
  micro_translation: 'Tłumaczenie',
  fix_sentence: 'Napraw zdanie',
  gap_from_context: 'Uzupełnij',
};

const studentLabel = (student: User): string => {
  const name = `${student.firstName || ''} ${student.lastName || ''}`.trim();
  return name || student.username || student.email || student.id;
};

const todayPlusDays = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

/** Polska odmiana po liczebniku — ta sama zasada co w kreatorze v1. */
const exerciseNoun = (n: number): string => {
  if (n === 1) return 'zadanie';
  const rest10 = n % 10;
  const rest100 = n % 100;
  if (rest10 >= 2 && rest10 <= 4 && !(rest100 >= 12 && rest100 <= 14)) return 'zadania';
  return 'zadań';
};

const HomeworkComposerV2: React.FC<HomeworkComposerV2Props> = ({ initialStudentId, onAssigned }) => {
  const [students, setStudents] = useState<User[]>([]);
  const [studentId, setStudentId] = useState(initialStudentId || '');
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [types, setTypes] = useState<ExerciseTypeV2[]>([...EXERCISE_TYPES_V2]);
  const [itemCount, setItemCount] = useState(6);
  const [plannedMinutes, setPlannedMinutes] = useState(15);
  const [dueDate, setDueDate] = useState(() => todayPlusDays(7));

  const [isGenerating, setIsGenerating] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState('');
  const [exercises, setExercises] = useState<ExerciseContractV2[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingEmailTask, setPendingEmailTask] = useState<any>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const student = useMemo(() => students.find((s) => s.id === studentId), [students, studentId]);

  // --- wczytanie kursantów --------------------------------------------------
  useEffect(() => {
    getDocs(collection(db, 'users'))
      .then((snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as User))
          .filter((u) => u.role !== 'admin' && u.role !== 'teacher');
        setStudents(list);
      })
      .catch(() => setError('Nie udało się wczytać listy kursantów.'));
  }, []);

  // --- wczytanie lekcji wybranego kursanta ----------------------------------
  useEffect(() => {
    if (!studentId) {
      setLessons([]);
      setSelectedLessonIds([]);
      return;
    }
    getLessonRecordsForStudent(studentId)
      .then((records) => {
        // Paliwem może być wyłącznie lekcja zatwierdzona — ta sama zasada,
        // którą stosuje panel kursanta. Funkcja i tak sprawdzi to po swojej
        // stronie; tutaj chodzi o to, żeby lektor nie wybierał z listy
        // czegoś, co i tak zostanie odrzucone.
        const approved = records.filter(isStudentVisibleLesson);
        setLessons(approved);
        setSelectedLessonIds(approved[0]?.id ? [approved[0].id] : []);
      })
      .catch(() => setError('Nie udało się wczytać lekcji kursanta.'));
  }, [studentId]);

  const toggleLesson = (lessonId: string) => {
    setSelectedLessonIds((current) => {
      if (current.includes(lessonId)) return current.filter((id) => id !== lessonId);
      if (current.length >= MAX_LESSONS_AS_FUEL) return current;
      return [...current, lessonId];
    });
  };

  const toggleType = (type: ExerciseTypeV2) => {
    setTypes((current) =>
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type]
    );
  };

  // --- generowanie ----------------------------------------------------------
  const handleGenerate = async () => {
    if (!studentId || selectedLessonIds.length === 0 || types.length === 0) return;
    setIsGenerating(true);
    setError('');
    setExercises([]);
    setWarnings([]);
    try {
      const result = await generateHomeworkSetV2({
        studentUid: studentId,
        lessonIds: selectedLessonIds,
        itemCount,
        plannedMinutes,
        types,
      });
      setExercises(result.exercises);
      setWarnings(result.warnings);
    } catch (e: any) {
      setError(e?.message || 'Nie udało się ułożyć zestawu.');
    } finally {
      setIsGenerating(false);
    }
  };

  const sendable = exercises.filter((e) => !e.requiresTeacherReview);
  const needsReview = exercises.filter((e) => e.requiresTeacherReview);

  /** Usunięcie zadania z zestawu — jedyna obróbka, jakiej lektor potrzebuje na co dzień. */
  const dropExercise = (id: string) => setExercises((current) => current.filter((e) => e.id !== id));

  /**
   * Zamknięcie okna potwierdzenia wysyłki.
   *
   * `onAssigned` odpala się dopiero tutaj, a nie zaraz po zapisie zestawu:
   * przełączenie widoku w trakcie otwartego modala zabrałoby lektorowi okno,
   * w którym ma potwierdzić wysyłkę maila.
   */
  const closeEmailModal = () => {
    setIsEmailModalOpen(false);
    setPendingEmailTask(null);
    onAssigned?.();
  };

  /** Świadome dopuszczenie zadania, którego walidator nie przepuścił. */
  const forceAllow = (id: string) =>
    setExercises((current) =>
      current.map((e) => (e.id === id ? { ...e, requiresTeacherReview: false } : e))
    );

  // --- wysyłka --------------------------------------------------------------
  const handleAssign = async () => {
    if (!studentId || sendable.length === 0) return;
    setIsAssigning(true);
    setError('');
    try {
      const sourceLabel = lessons.find((l) => l.id === selectedLessonIds[0]);
      const topic = sourceLabel ? cleanVocabularyTopic(sourceLabel.topic) || sourceLabel.topic : '';
      const title = topic ? `Praca domowa: ${topic}` : 'Praca domowa';

      const result = await assignHomeworkSetV2({
        exercises: sendable,
        studentUids: [studentId],
        title,
        dueDate,
      });

      // Wysyłkę maila potwierdza lektor w tym samym oknie co w v1.
      // Zestaw v2 zapisuje `skipAutoEmail`, więc automat nie wyśle nic
      // za plecami — patrz functions/src/index.ts.
      setPendingEmailTask({
        id: result.taskIds[0],
        studentUid: studentId,
        studentName: student ? studentLabel(student) : 'Kursant',
        studentEmail: student?.email || '',
        title,
        dueDate,
        sentences: sendable,
      });
      setIsEmailModalOpen(true);
      setExercises([]);
    } catch (e: any) {
      setError(e?.message || 'Nie udało się przypisać zestawu.');
    } finally {
      setIsAssigning(false);
    }
  };

  const canGenerate = Boolean(studentId) && selectedLessonIds.length > 0 && types.length > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-24">
      {/* ---------------- 1. Ustawienia ---------------- */}
      <section className="rounded-2xl border border-line-strong bg-surface-flat/40 p-4 sm:p-5 space-y-4">
        <h3 className="text-sm font-bold text-text-hi flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          Nowa praca domowa
        </h3>

        <label className="block space-y-1">
          <span className="text-xs text-text-2">Kursant</span>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full rounded-xl border border-line-strong bg-ink px-3 py-2 text-sm text-text-hi"
          >
            <option value="">— wybierz —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {studentLabel(s)}
              </option>
            ))}
          </select>
        </label>

        {studentId && (
          <div className="space-y-1">
            <span className="text-xs text-text-2">
              Lekcja jako materiał (najwyżej {MAX_LESSONS_AS_FUEL})
            </span>
            {lessons.length === 0 ? (
              <p className="text-xs text-warn">
                Ten kursant nie ma zatwierdzonych lekcji. Bez nich nie ma z czego układać zadań.
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {lessons.slice(0, 12).map((lesson) => {
                  const active = selectedLessonIds.includes(lesson.id);
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => toggleLesson(lesson.id)}
                      className={`w-full text-left rounded-xl border px-3 py-2 text-xs transition ${
                        active
                          ? 'border-primary/50 bg-primary/10 text-text-hi'
                          : 'border-line-strong bg-ink text-text-2'
                      }`}
                    >
                      <span className="font-medium">{cleanVocabularyTopic(lesson.topic) || lesson.topic}</span>
                      <span className="ml-2 opacity-60">{lesson.date}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {EXERCISE_TYPES_V2.map((type) => {
            const active = types.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  active
                    ? 'border-primary/50 bg-primary/10 text-text-hi'
                    : 'border-line-strong bg-ink text-text-2'
                }`}
              >
                {TYPE_LABELS[type]}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-text-2">Liczba zadań</span>
            <input
              type="number"
              min={1}
              max={30}
              value={itemCount}
              onChange={(e) => setItemCount(Number(e.target.value) || 1)}
              className="w-full rounded-xl border border-line-strong bg-ink px-3 py-2 text-sm text-text-hi"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-text-2">Planowany czas (min)</span>
            <input
              type="number"
              min={1}
              max={120}
              value={plannedMinutes}
              onChange={(e) => setPlannedMinutes(Number(e.target.value) || 1)}
              className="w-full rounded-xl border border-line-strong bg-ink px-3 py-2 text-sm text-text-hi"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-text-2">Termin</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-line-strong bg-ink px-3 py-2 text-sm text-text-hi"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating}
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {isGenerating ? 'Układam zestaw…' : 'Ułóż zestaw'}
        </button>
      </section>

      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {/* ---------------- 2. Ostrzeżenia ---------------- */}
      {warnings.length > 0 && (
        <ul className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 space-y-1">
          {warnings.map((warning, index) => (
            <li key={index} className="flex gap-2 text-xs text-warn">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      )}

      {/* ---------------- 3. Podgląd — jeden ekran ---------------- */}
      {exercises.length > 0 && (
        <section className="space-y-2">
          {exercises.map((exercise, index) => {
            const expanded = expandedId === exercise.id;
            return (
              <article
                key={exercise.id}
                className={`rounded-2xl border p-3 sm:p-4 ${
                  exercise.requiresTeacherReview
                    ? 'border-warn/50 bg-warn/5'
                    : 'border-line-strong bg-surface-flat/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-xs font-mono text-text-mute">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        {TYPE_LABELS[exercise.exerciseType]}
                      </span>
                      {/* Krótka etykieta źródła — zlecenie mówi: `lekcja`. */}
                      <span className="rounded-full bg-line-soft px-2 py-0.5 text-[11px] text-text-2">
                        lekcja
                      </span>
                      {exercise.requiresTeacherReview && (
                        <span className="rounded-full bg-warn/20 px-2 py-0.5 text-[11px] text-warn">
                          wymaga decyzji
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-hi break-words">{exercise.content}</p>
                    <p className="text-xs text-text-2 mt-1">{exercise.learningObjective}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : exercise.id)}
                    className="shrink-0 rounded-lg p-1.5 text-text-mute hover:text-text-hi"
                    aria-label="Szczegóły kontraktu"
                  >
                    <ChevronDown size={16} className={expanded ? 'rotate-180 transition' : 'transition'} />
                  </button>
                </div>

                {/* Kontrakt pod rozwinięciem: informacja na wyjątek, nie na co dzień. */}
                {expanded && (
                  <dl className="mt-3 space-y-1.5 border-t border-line-strong pt-3 text-xs">
                    <div>
                      <dt className="inline text-text-mute">Wzorzec: </dt>
                      <dd className="inline text-text-hi">{exercise.modelAnswer}</dd>
                    </div>
                    {exercise.acceptedVariants.length > 0 && (
                      <div>
                        <dt className="inline text-text-mute">Warianty: </dt>
                        <dd className="inline text-text-2">{exercise.acceptedVariants.join(' · ')}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="inline text-text-mute">Wymagany materiał: </dt>
                      <dd className="inline text-text-2">{exercise.requiredMaterial.join(', ')}</dd>
                    </div>
                    <div>
                      <dt className="inline text-text-mute">Podpowiedzi: </dt>
                      <dd className="inline text-text-2">
                        {exercise.hintSmall} → {exercise.hintLarge}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline text-text-mute">Walidator: </dt>
                      <dd className="inline text-text-2">
                        {exercise.validation.passed ? 'przeszedł' : 'nie przeszedł'} ·{' '}
                        {Math.round(exercise.validation.score * 100)}%
                        {exercise.validation.failedChecks.length > 0 &&
                          ` · ${exercise.validation.failedChecks.join(', ')}`}
                        {exercise.validation.regenerationCount > 0 &&
                          ` · regeneracji: ${exercise.validation.regenerationCount}`}
                      </dd>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => dropExercise(exercise.id)}
                        className="rounded-lg border border-line-strong px-2.5 py-1 text-[11px] text-text-2"
                      >
                        Usuń z zestawu
                      </button>
                      {exercise.requiresTeacherReview && (
                        <button
                          type="button"
                          onClick={() => forceAllow(exercise.id)}
                          className="rounded-lg border border-warn/50 px-2.5 py-1 text-[11px] text-warn"
                        >
                          Dopuść mimo uwag
                        </button>
                      )}
                    </div>
                  </dl>
                )}
              </article>
            );
          })}

          {/* ---------------- 4. Wyślij ---------------- */}
          <div className="sticky bottom-4 rounded-2xl border border-line-strong bg-ink/95 p-3 backdrop-blur">
            {needsReview.length > 0 && (
              <p className="mb-2 text-xs text-warn">
                {needsReview.length} {exerciseNoun(needsReview.length)} nie przeszło kontroli i nie
                pójdzie automatycznie. Rozwiń, żeby usunąć albo dopuścić.
              </p>
            )}
            <button
              type="button"
              onClick={handleAssign}
              disabled={sendable.length === 0 || isAssigning}
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {isAssigning ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {isAssigning
                ? 'Wysyłam…'
                : `Wyślij ${sendable.length} ${exerciseNoun(sendable.length)}`}
            </button>
          </div>
        </section>
      )}

      {/* Ten sam modal co w kreatorze v1 — zestaw v2 zapisuje `skipAutoEmail`,
          więc pocztę wysyła lektor stąd, a nie wyzwalacz w bazie. */}
      <HomeworkEmailConfirmationModal
        isOpen={isEmailModalOpen}
        student={student || null}
        task={pendingEmailTask}
        onEmailSent={closeEmailModal}
        onSkip={closeEmailModal}
        onClose={closeEmailModal}
      />
    </div>
  );
};

export default HomeworkComposerV2;
