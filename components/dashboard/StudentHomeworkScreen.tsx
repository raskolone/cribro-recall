import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Calendar,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  GraduationCap,
  Loader2,
  MessageSquareQuote,
  Send,
  Sparkles,
  X as XIcon,
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { HomeworkType, SpecialTask, StudentTest } from '../../types';
import { homeworkBlocks, homeworkItemType, isV1Task, studentTasksQuery } from '../../utils/homework';
import { formatTaskDateTime } from './HomeworkScreen';
import { evaluateTranslations } from '../../services/geminiService';
import { HOMEWORK_TYPE_LABELS } from '../../services/homeworkGenerator';
import { recordExerciseResults } from '../../services/learningProfile';
import { useDraftAnswers } from '../../hooks/useDraftAnswers';
import { normalizeLevel } from '../../utils/learningCurve';
import HomeworkExercise from './HomeworkExercise';
import TakeTestScreen from '../tests/TakeTestScreen';
import { exportTestToPDF } from '../../utils/pdfExport';
import Markdown from 'react-markdown';
import { useEscapeModal } from '../../hooks/useEscapeModal';
import Card from '../ui/Card';
import Button from '../ui/Button';

/**
 * Praca domowa kursanta.
 *
 * Lista pokazuje wyłącznie to, co jest do zrobienia, a oddane zadania schodzą
 * niżej — po wysłaniu pracy kursant nie ma już przy niej nic do roboty poza
 * przeczytaniem oceny.
 *
 * Rozwiązywanie idzie zadanie po zadaniu na pełnym ekranie. Lista wszystkich
 * zdań naraz działała na monitorze lektora, ale na telefonie znaczyła długie
 * przewijanie i gubienie miejsca po każdym podniesieniu klawiatury.
 *
 * Trzy z czterech typów sprawdzamy u siebie, bez modelu: kolejność fragmentów,
 * wybór opcji i uzupełnione luki mają jedną poprawną odpowiedź. Model ocenia
 * tylko tłumaczenia, gdzie poprawnych wersji jest wiele.
 */

interface StudentHomeworkScreenProps {
  /** Zadanie do otwarcia od razu — np. z banera w panelu. */
  initialTaskId?: string | null;
  /** Podgląd prac konkretnego kursanta (lektor). Domyślnie własne konto. */
  studentId?: string;
  onBack?: () => void;
}

interface EvaluationRow {
  polishSentence: string;
  correctTranslation: string;
  studentAnswer: any;
  isCorrect: boolean;
  score: number;
  explanation?: string;
}

const normalize = (text: string): string =>
  String(text || '')
    .toLowerCase()
    .replace(/[.,!?;:"„”]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** Bezpieczne renderowanie odpowiedzi kursanta w UI (nawet jeśli odpowiedź to obiekt BLANK_*). */
const formatStudentAnswer = (ans: any): React.ReactNode => {
  if (ans === null || ans === undefined || ans === '') return '—';
  if (typeof ans === 'object') {
    if (Array.isArray(ans)) {
      return ans.join(' ');
    }
    const entries = Object.entries(ans).filter(([_, v]) => v !== undefined && v !== null && v !== '');
    if (entries.length === 0) return '—';
    return (
      <span className="inline-flex flex-wrap gap-1.5 align-middle">
        {entries.map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono">
            <span className="text-content-muted">{k.replace('BLANK_', '#')}:</span>
            <span className="text-primary font-medium">{String(v)}</span>
          </span>
        ))}
      </span>
    );
  }
  return String(ans);
};

/** Tekst odpowiedzi do zapisania — czytelny dla lektora, nie surowy stan UI. */
const answerToText = (type: HomeworkType, item: any, answer: any): string => {
  if (type === 'word_order') {
    const chosen: number[] = Array.isArray(answer) ? answer : [];
    return chosen.map((i) => item.chunks?.[i]).filter(Boolean).join(' ');
  }
  if (type === 'multiple_choice') {
    return typeof answer === 'number' ? item.options?.[answer] || '' : '';
  }
  if (type === 'fill_in_the_blank') {
    const blanks = answer && typeof answer === 'object' ? answer : {};
    return Object.keys(blanks)
      .sort()
      .map((key) => `${key}=${blanks[key]}`)
      .join(', ');
  }
  if (type === 'find_errors') {
    return String(answer || '').trim();
  }
  return String(answer || '');
};

export interface ReviewExerciseItem {
  index: number;
  prompt: string;
  expected: string;
  studentAnswer: any;
  isCorrect: boolean;
  score: number;
  explanation?: string;
  type: HomeworkType;
}

const getExerciseReviewRows = (task: SpecialTask): ReviewExerciseItem[] => {
  const sentences = task.sentences || [];
  const evalResults = Array.isArray(task.evaluationResults) ? task.evaluationResults : [];
  const studentAnswers = task.studentAnswers || {};

  return sentences.map((item: any, i: number) => {
    const ev = evalResults[i] || {};
    const itemType = homeworkItemType(item, task);

    const rawAns =
      ev.studentAnswer !== undefined
        ? ev.studentAnswer
        : typeof studentAnswers === 'object' && studentAnswers !== null
        ? (studentAnswers as any)[i]
        : undefined;

    const prompt =
      ev.polishSentence ||
      item.incorrectSentence ||
      item.polishSentence ||
      item.polish ||
      item.question ||
      item.textWithBlanks ||
      item.correctSentence ||
      `Zadanie #${i + 1}`;

    let expected = ev.correctTranslation || item.englishTranslation || item.english || '';
    if (!expected) {
      if (itemType === 'find_errors') expected = item.correctSentence || '';
      else if (itemType === 'word_order') expected = item.correctSentence || '';
      else if (itemType === 'multiple_choice') expected = item.options?.[item.correctIndex] || '';
      else if (itemType === 'fill_in_the_blank' && item.blanks) {
        expected = Object.entries(item.blanks)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
      }
    }

    const isCorrect =
      typeof ev.isCorrect === 'boolean'
        ? ev.isCorrect
        : typeof ev.score === 'number'
        ? ev.score >= 80
        : false;

    const score = typeof ev.score === 'number' ? ev.score : isCorrect ? 100 : 0;
    const explanation = ev.explanation || item.explanation;

    return {
      index: i + 1,
      prompt,
      expected,
      studentAnswer: rawAns,
      isCorrect,
      score,
      explanation,
      type: itemType,
    };
  });
};

const StudentHomeworkScreen: React.FC<StudentHomeworkScreenProps> = ({
  initialTaskId = null,
  studentId,
  onBack,
}) => {
  const { user, updateUserStreak } = useAuth();
  const { language } = useLanguage();
  const targetId = studentId || user?.id || '';
  // Lektor przegląda cudzą pracę domową wyłącznie po to, żeby zobaczyć, co
  // dostał kursant — rozwiązanie za niego nadpisałoby jego prawdziwą próbę,
  // a zapis i tak poszedłby na konto lektora (patrz handleSubmit).
  const isPreview = Boolean(studentId && studentId !== user?.id);

  const [tasks, setTasks] = useState<SpecialTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<SpecialTask | null>(null);
  const [index, setIndex] = useState(0);
  // Odpowiedzi przeżywają zamknięcie karty: zadanie robi się między innymi
  // sprawami, a przerwanie nie może kasować dziesięciu rozwiązanych zdań.
  const [answers, setAnswers, clearAnswers] = useDraftAnswers<Record<number, any>>(
    activeTask?.id ? `homework-draft-${activeTask.id}` : null,
    {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Komunikat pod przyciskiem wysyłki — zamiast okna, które trzeba odklikać. */
  const [notice, setNotice] = useState('');
  /** Kursant zobaczył ostrzeżenie o pustych zadaniach i może wysłać mimo to. */
  const [confirmedIncomplete, setConfirmedIncomplete] = useState(false);
  const [result, setResult] = useState<{ score: number; rows: EvaluationRow[] } | null>(null);
  const [openResultId, setOpenResultId] = useState<string | null>(null);
  const [viewingGradedTask, setViewingGradedTask] = useState<SpecialTask | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'errors' | 'correct'>('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'errors' | 'correct'>('all');
  const handledGradedUserRef = React.useRef<string | null>(null);
  // Rozwinięcie spisu bloków na liście. Praca domowa zostaje jedną pozycją,
  // a kursant może zajrzeć, z czego się składa, zanim ją otworzy.
  const [openBlocksId, setOpenBlocksId] = useState<string | null>(null);

  // Stan testów kursanta (w tej samej zakładce co prace domowe)
  const [tests, setTests] = useState<StudentTest[]>([]);
  const [activeTest, setActiveTest] = useState<StudentTest | null>(null);
  const [feedbackTest, setFeedbackTest] = useState<StudentTest | null>(null);

  useEscapeModal(Boolean(feedbackTest), () => setFeedbackTest(null));

  useEffect(() => {
    if (!targetId) {
      setIsLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      studentTasksQuery(targetId),
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as SpecialTask))
          // Zestawy silnika v2 mają własny ekran — ten ich nie zrozumie.
          .filter(isV1Task)
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setTasks(list);
        setIsLoading(false);
      },
      (error) => {
        console.error('Nie udało się wczytać prac domowych:', error);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [targetId]);

  useEffect(() => {
    if (!targetId) return;
    const testsQ = query(collection(db, `users/${targetId}/tests`), orderBy('createdAt', 'desc'));
    const unsubscribeTests = onSnapshot(
      testsQ,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as StudentTest));
        setTests(list);
      },
      (error) => {
        console.error('Nie udało się wczytać testów kursanta:', error);
      }
    );
    return () => unsubscribeTests();
  }, [targetId]);

  useEffect(() => {
    if (user?.hasNewHomework && user?.id) {
      updateDoc(doc(db, 'users', user.id), { hasNewHomework: false }).catch(console.error);
    }
  }, [user?.id, user?.hasNewHomework]);

  useEffect(() => {
    if (user?.hasGradedHomework && user?.id) {
      const currentKey = `${user.id}_${user.lastGradedHomeworkId || 'all'}`;
      if (handledGradedUserRef.current === currentKey) return;
      handledGradedUserRef.current = currentKey;

      const updates: any = { hasGradedHomework: false };
      if (user.lastGradedHomeworkId) {
        const currentDismissed = user.dismissedNotifications || [];
        const newDismissed = Array.from(new Set([
          ...currentDismissed,
          `graded_hw_${user.lastGradedHomeworkId}`,
          `graded_hw_all_${user.id}`,
        ]));
        updates.dismissedNotifications = newDismissed;
        try {
          localStorage.setItem(`dismissed_graded_hw_${user.id}_${user.lastGradedHomeworkId}`, 'true');
        } catch (e) {}
      }
      updateDoc(doc(db, 'users', user.id), updates).catch(() => {
        updateDoc(doc(db, 'users', user.id), { hasGradedHomework: false }).catch(console.error);
      });
    }
  }, [user?.id, user?.hasGradedHomework, user?.lastGradedHomeworkId]);

  useEffect(() => {
    if (!initialTaskId || activeTask || isPreview) return;
    const found = tasks.find((t) => t.id === initialTaskId);
    if (found && (found.status === 'pending' || !found.status)) {
      startTask(found);
    } else if (found && (found.status === 'graded' || found.status === 'submitted')) {
      setViewingGradedTask(found);
      setOpenResultId(found.id || null);
      if (found.status === 'graded' && user?.id && found.id) {
        try {
          localStorage.setItem(`dismissed_graded_hw_${user.id}_${found.id}`, 'true');
        } catch (e) {}
        updateDoc(doc(db, 'specialTasks', found.id), {
          feedbackReadByStudent: true,
        }).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTaskId, tasks, isPreview]);

  useEffect(() => {
    if (viewingGradedTask?.id) {
      const updated = tasks.find((t) => t.id === viewingGradedTask.id);
      if (updated) {
        setViewingGradedTask(updated);
      }
    }
  }, [tasks, viewingGradedTask?.id]);

  const isDateOverdue = (dateStr?: string | null): boolean => {
    if (!dateStr) return false;
    try {
      const d = new Date(dateStr);
      if (dateStr.length === 10) d.setHours(23, 59, 59, 999);
      return d.getTime() < Date.now();
    } catch {
      return false;
    }
  };

  const pendingTests = useMemo(() => {
    return tests.filter(
      (t) => (t.status === 'pending' || !t.status) && !isDateOverdue(t.dueDate)
    );
  }, [tests]);

  const overdueTests = useMemo(() => {
    return tests.filter(
      (t) => (t.status === 'pending' || !t.status) && isDateOverdue(t.dueDate)
    );
  }, [tests]);

  const finishedTests = useMemo(() => {
    return tests.filter(
      (t) => t.status === 'graded' || t.status === 'completed' || Boolean(t.completedAt)
    );
  }, [tests]);

  const L =
    language === 'pl'
      ? {
          title: 'Praca domowa',
          todo: 'Do zrobienia',
          done: 'Oddane',
          empty: 'Nic nie czeka. Lektor przypisze zadanie po następnej lekcji.',
          back: 'Wróć',
          due: (d: string) => `do ${d}`,
          items: (n: number) => `${n} zadań`,
          submit: 'Wyślij do lektora',
          next: 'Dalej',
          prev: 'Wstecz',
          submitting: 'Wysyłam…',
          resultTitle: 'Praca wysłana',
          resultBody: (s: number) => `Wynik wstępny: ${s}%`,
          backToList: 'Wróć do listy',
          correct: 'Dobrze',
          wrong: 'Do poprawy',
          yourAnswer: 'Twoja odpowiedź',
          expected: 'Poprawnie',
          statusSubmitted: 'Czeka na ocenę',
          statusGraded: 'Ocenione',
          teacherFeedback: 'Komentarz lektora',
          unanswered: (n: number) =>
            `Nie odpowiedziałeś na ${n} zadań. Dotknij jeszcze raz, żeby wysłać mimo to.`,
          sendFailed: 'Nie udało się wysłać pracy. Twoje odpowiedzi są zapisane — spróbuj ponownie.',
          sendAnyway: 'Wyślij mimo to',
          blockCount: (n: number) => `${n} rodzaje zadań`,
          showBlocks: 'Z czego się składa',
          hideBlocks: 'Zwiń',
          blockLabel: (label: string, at: number, of: number) => `${label} · ${at}/${of}`,
          progressTitle: 'Twój postęp',
          progressHint:
            'Nie musisz robić wszystkiego naraz — odpowiedzi zapisują się same. Możesz zamknąć aplikację i wrócić do reszty później.',
        }
      : {
          title: 'Homework',
          todo: 'To do',
          done: 'Submitted',
          empty: 'Nothing waiting. Your teacher will assign work after the next lesson.',
          back: 'Back',
          due: (d: string) => `by ${d}`,
          items: (n: number) => `${n} tasks`,
          submit: 'Send to teacher',
          next: 'Next',
          prev: 'Back',
          submitting: 'Sending…',
          resultTitle: 'Homework sent',
          resultBody: (s: number) => `Provisional score: ${s}%`,
          backToList: 'Back to list',
          correct: 'Correct',
          wrong: 'To fix',
          yourAnswer: 'Your answer',
          expected: 'Correct answer',
          statusSubmitted: 'Awaiting review',
          statusGraded: 'Graded',
          teacherFeedback: 'Teacher feedback',
          unanswered: (n: number) => `${n} tasks are unanswered. Tap again to send anyway.`,
          sendFailed: 'Could not send your work. Your answers are saved — try again.',
          sendAnyway: 'Send anyway',
          blockCount: (n: number) => `${n} exercise types`,
          showBlocks: "What's inside",
          hideBlocks: 'Collapse',
          blockLabel: (label: string, at: number, of: number) => `${label} · ${at}/${of}`,
          progressTitle: 'Your progress',
          progressHint:
            'You do not have to finish in one go — your answers save themselves. Close the app and come back to the rest later.',
        };

  /** Nazwa rodzaju zadania w języku interfejsu. */
  const typeLabel = (type: HomeworkType): string =>
    HOMEWORK_TYPE_LABELS[type]?.[language === 'pl' ? 'pl' : 'en'] || type;

  /** Podział pracy domowej na bloki — liczony raz na zadanie. */
  const blocksCache = useMemo(() => new Map<string, ReturnType<typeof homeworkBlocks>>(), [tasks]);
  const blocksOf = (task: SpecialTask) => {
    const key = task.id || '';
    const cached = blocksCache.get(key);
    if (cached) return cached;
    const blocks = homeworkBlocks(task);
    blocksCache.set(key, blocks);
    return blocks;
  };

  const pending = useMemo(
    () => tasks.filter((t) => t.status === 'pending' || !t.status),
    [tasks]
  );
  const submittedTasks = useMemo(
    () => tasks.filter((t) => t.status === 'submitted' && !t.reviewedAt),
    [tasks]
  );
  const gradedTasks = useMemo(
    () => tasks.filter((t) => t.status === 'graded' || Boolean(t.reviewedAt) || Boolean(t.teacherFeedback)),
    [tasks]
  );
  const finished = useMemo(
    () => tasks.filter((t) => t.status && t.status !== 'pending'),
    [tasks]
  );

  const [studentSeenTaskIds, setStudentSeenTaskIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`student_seen_homework_${targetId}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markTaskAsViewedByStudent = (task: SpecialTask) => {
    if (!task.id) return;
    setStudentSeenTaskIds((prev) => {
      const next = new Set(prev);
      next.add(task.id!);
      try {
        localStorage.setItem(`student_seen_homework_${targetId}`, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    if (!task.studentViewedAt) {
      const nowIso = new Date().toISOString();
      updateDoc(doc(db, 'specialTasks', task.id), {
        studentViewedAt: nowIso,
      }).catch(console.warn);

      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, studentViewedAt: nowIso } : t))
      );
    }
  };

  const isTaskNewForStudent = (task: SpecialTask): boolean => {
    if (!task.id || (task.status && task.status !== 'pending')) return false;
    if (task.studentViewedAt) return false;
    return !studentSeenTaskIds.has(task.id);
  };

  const startTask = (task: SpecialTask) => {
    markTaskAsViewedByStudent(task);
    setActiveTask(task);
    setIndex(0);
    // Odpowiedzi wczyta hook szkicu, gdy zmieni się klucz zadania — czyszczenie
    // ich tutaj kasowałoby właśnie odzyskaną, niedokończoną pracę.
    setResult(null);
    setNotice('');
    setConfirmedIncomplete(false);
  };

  const closeTask = () => {
    setActiveTask(null);
    setResult(null);
  };

  /** Ocena bez modelu — dla typów o jednej poprawnej odpowiedzi. */
  const gradeDeterministic = (type: HomeworkType, item: any, answer: any): EvaluationRow => {
    const studentAnswer = answerToText(type, item, answer);

    if (type === 'find_errors') {
      const isCorrect = normalize(studentAnswer) === normalize(item.correctSentence);
      return {
        polishSentence: item.polishHint || item.incorrectSentence,
        correctTranslation: item.correctSentence,
        studentAnswer,
        isCorrect,
        score: isCorrect ? 100 : 0,
        explanation: item.explanation,
      };
    }

    if (type === 'word_order') {
      const isCorrect = normalize(studentAnswer) === normalize(item.correctSentence);
      return {
        polishSentence: item.polishHint || item.correctSentence,
        correctTranslation: item.correctSentence,
        studentAnswer,
        isCorrect,
        score: isCorrect ? 100 : 0,
      };
    }

    if (type === 'multiple_choice') {
      const isCorrect = answer === item.correctIndex;
      return {
        polishSentence: item.question,
        correctTranslation: item.options?.[item.correctIndex] || '',
        studentAnswer,
        isCorrect,
        score: isCorrect ? 100 : 0,
        explanation: item.explanation,
      };
    }

    // Luki: liczy się udział trafionych, bo jedno zadanie to kilka odpowiedzi.
    const expected: Record<string, string> = item.blanks || {};
    const given = answer && typeof answer === 'object' ? answer : {};
    const keys = Object.keys(expected);
    const hits = keys.filter((key) => normalize(given[key]) === normalize(expected[key])).length;
    const score = keys.length > 0 ? Math.round((hits / keys.length) * 100) : 0;
    return {
      polishSentence: item.textWithBlanks || '',
      correctTranslation: keys.map((k) => `${k}=${expected[k]}`).join(', '),
      studentAnswer,
      isCorrect: score === 100,
      score,
    };
  };

  const handleSubmit = async () => {
    if (!activeTask?.id || !user?.id) return;
    const items = activeTask.sentences || [];
    const typeOf = (item: any): HomeworkType => homeworkItemType(item, activeTask);
    // Rodzaj do zapisu w dzienniku ćwiczeń: przy pracy mieszanej jedna etykieta
    // musi objąć całość, bo wpis dotyczy całej pracy domowej.
    const typesUsed = Array.from(new Set(items.map(typeOf)));
    const logFormat = typesUsed.length === 1 ? typesUsed[0] : 'mixed';

    const answered = items.filter((_, i) => {
      const a = answers[i];
      if (Array.isArray(a)) return a.length > 0;
      if (a && typeof a === 'object') return Object.keys(a).length > 0;
      if (typeof a === 'number') return true;
      return String(a || '').trim().length > 0;
    }).length;

    // Zamiast okna systemowego: ostrzeżenie pod przyciskiem, a przycisk zmienia
    // się w „wyślij mimo to". Kursant zostaje w zadaniu i widzi, czego brakuje,
    // zamiast odklikiwać dialog, który zasłania treść.
    if (answered < items.length && !confirmedIncomplete) {
      setNotice(L.unanswered(items.length - answered));
      setConfirmedIncomplete(true);
      return;
    }

    setNotice('');
    setIsSubmitting(true);
    try {
      // Tłumaczenia ocenia model, pozostałe rodzaje liczą się lokalnie. Przy
      // pracy mieszanej wszystkie tłumaczenia idą jednym zapytaniem — pytanie
      // po jednym zdaniu kosztowałoby tyle, co ułożenie pracy od nowa.
      const translationAt = items
        .map((item: any, i: number) => (typeOf(item) === 'translation' ? i : -1))
        .filter((i: number) => i >= 0);

      let evaluated: any[] = [];
      if (translationAt.length > 0) {
        const exercises = translationAt.map((i: number) => ({
          polishSentence: items[i].polishSentence,
          englishTranslation: items[i].englishTranslation,
          hint: items[i].hint,
        }));
        const given = translationAt.map((i: number) => String(answers[i] || ''));
        try {
          evaluated = await evaluateTranslations(exercises, given, user.level || 'B1', '');
        } catch (error) {
          console.error('Ocena tłumaczeń nie powiodła się:', error);
        }
      }

      const rows: EvaluationRow[] = items.map((item: any, i: number) => {
        const itemType = typeOf(item);
        if (itemType !== 'translation') {
          return gradeDeterministic(itemType, item, answers[i]);
        }
        // Odpowiedzi modelu wracają w kolejności wysłanych tłumaczeń, a nie
        // w kolejności ćwiczeń — stąd przeliczenie pozycji.
        const ev = evaluated?.[translationAt.indexOf(i)];
        const answer = String(answers[i] || '');
        const score = Number(ev?.score);
        return {
          polishSentence: item.polishSentence || item.polish || '',
          correctTranslation: item.englishTranslation || item.english || '',
          studentAnswer: answer,
          isCorrect: ev?.isCorrect ?? false,
          // Brak oceny modelu nie może zerować pracy kursanta — wtedy liczy
          // się samo oddanie odpowiedzi, a lektor ocenia ręcznie.
          score: isNaN(score) ? (answer.trim() ? 70 : 0) : score,
          explanation: ev?.explanation || (answer.trim() ? 'Przesłano do oceny lektora' : 'Brak odpowiedzi'),
        };
      });

      const average =
        rows.length > 0 ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length) : 0;

      const storedAnswers: Record<number, any> = {};
      items.forEach((item: any, i: number) => {
        const itemType = typeOf(item);
        storedAnswers[i] =
          itemType === 'fill_in_the_blank'
            ? answers[i] || {}
            : answerToText(itemType, item, answers[i]);
      });

      await updateDoc(doc(db, 'specialTasks', activeTask.id), {
        status: 'submitted',
        studentAnswers: storedAnswers,
        evaluationResults: rows,
        submittedAt: new Date().toISOString(),
      });

      try {
        await addDoc(collection(db, `users/${user.id}/practiceLogs`), {
          exerciseType: 'homework',
          exerciseFormat: logFormat,
          date: new Date().toISOString(),
          isRevisionMode: false,
          score: average,
          totalWords: items.length,
          setDisplayName: activeTask.title || 'Praca domowa',
          exercisesData: rows,
        });
      } catch (error) {
        console.warn('Nie udało się zapisać sesji z pracy domowej:', error);
      }

      // Każda odpowiedź — trafiona i chybiona — wchodzi do krzywej uczenia.
      // To z niej bierze się poziom kolejnych zadań i lista braków w promptcie.
      recordExerciseResults(
        user.id,
        rows.map((row, i) => ({
          prompt: row.polishSentence,
          expected: row.correctTranslation,
          given: row.studentAnswer,
          isCorrect: row.isCorrect,
          score: row.score,
          level: normalizeLevel(user.level),
          exerciseType: typeOf(items[i]),
          date: new Date().toISOString(),
        })),
        user.level
      ).catch(console.error);

      if (updateUserStreak) updateUserStreak().catch(console.error);

      // Praca jest u lektora — szkic nie ma już czego chronić. Czyścimy dopiero
      // tutaj, po udanym zapisie: przy błędzie odpowiedzi mają zostać.
      clearAnswers();

      setResult({ score: average, rows });
    } catch (error: any) {
      console.error('Nie udało się wysłać pracy domowej:', error);
      // Odpowiedzi zostają w szkicu, więc ponowna próba nie kosztuje pracy.
      setNotice(L.sendFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ————— Aktywny test kursanta —————
  if (activeTest && !isPreview) {
    return <TakeTestScreen test={activeTest} onBack={() => setActiveTest(null)} />;
  }

  // ————— Wynik po wysłaniu —————
  if (activeTask && result) {
    const correctCount = result.rows.filter((r) => r.isCorrect).length;
    const errorCount = result.rows.filter((r) => !r.isCorrect).length;
    const totalCount = result.rows.length;

    const filteredRows = result.rows.filter((r) => {
      if (resultFilter === 'errors') return !r.isCorrect;
      if (resultFilter === 'correct') return r.isCorrect;
      return true;
    });

    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <header className="text-center py-4 space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
            <Check className="w-8 h-8 text-emerald-400 stroke-[3]" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-2">
              Praca odesłana
            </span>
            <h1 className="text-2xl font-extrabold text-white">{L.resultTitle}</h1>
            <p className="text-xs sm:text-sm text-content-muted mt-1.5 max-w-md mx-auto leading-relaxed">
              {language === 'pl'
                ? 'Twoje odpowiedzi trafiły do lektora, który wkrótce je zweryfikuje i doda swój komentarz. Poniżej znajduje się wstępna analiza automatyczna.'
                : 'Your answers have been sent to your teacher for review. Below is an initial automated check.'}
            </p>
          </div>
        </header>

        {/* Score & Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-base-200/70 border border-white/10 text-center space-y-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-content-muted block">
              Wynik wstępny
            </span>
            <span className="text-2xl font-black font-mono text-primary">
              {result.score}%
            </span>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-500/[0.08] border border-emerald-500/30 text-center space-y-1 flex flex-col justify-center">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-center gap-1">
              <Check size={13} className="stroke-[3]" /> Zrobione dobrze
            </span>
            <span className="text-2xl font-black font-mono text-emerald-300">
              {correctCount} <span className="text-xs font-sans text-emerald-400/70 font-normal">/ {totalCount}</span>
            </span>
          </div>
          <div className="p-4 rounded-2xl bg-amber-500/[0.08] border border-amber-500/30 text-center space-y-1 flex flex-col justify-center">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center justify-center gap-1">
              <AlertTriangle size={13} /> Wymaga poprawy
            </span>
            <span className="text-2xl font-black font-mono text-amber-300">
              {errorCount} <span className="text-xs font-sans text-amber-400/70 font-normal">/ {totalCount}</span>
            </span>
          </div>
        </div>

        {/* Visual Ratio Progress Bar */}
        {totalCount > 0 && (
          <div className="space-y-1.5 px-1">
            <div className="h-2 rounded-full bg-white/10 overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(correctCount / totalCount) * 100}%` }}
                title={`Poprawne: ${correctCount}`}
              />
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${(errorCount / totalCount) * 100}%` }}
                title={`Do poprawy: ${errorCount}`}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-content-muted">
              <span>Poprawne: {Math.round((correctCount / totalCount) * 100)}%</span>
              <span>Do poprawy: {Math.round((errorCount / totalCount) * 100)}%</span>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-base-200/80 border border-white/10">
          <button
            onClick={() => setResultFilter('all')}
            className={`flex-1 min-h-[2.25rem] rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              resultFilter === 'all'
                ? 'bg-primary text-accent-ink shadow-sm'
                : 'text-content-muted hover:text-text-hi'
            }`}
          >
            Wszystkie ({totalCount})
          </button>
          <button
            onClick={() => setResultFilter('errors')}
            className={`flex-1 min-h-[2.25rem] rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              resultFilter === 'errors'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-amber-400/80 hover:text-amber-300'
            }`}
          >
            <AlertTriangle size={13} />
            <span>Do poprawy ({errorCount})</span>
          </button>
          <button
            onClick={() => setResultFilter('correct')}
            className={`flex-1 min-h-[2.25rem] rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              resultFilter === 'correct'
                ? 'bg-emerald-500 text-black shadow-sm'
                : 'text-emerald-400/80 hover:text-emerald-300'
            }`}
          >
            <Check size={13} className="stroke-[3]" />
            <span>Poprawne ({correctCount})</span>
          </button>
        </div>

        {/* Exercises List */}
        <div className="space-y-3">
          {filteredRows.length === 0 ? (
            <p className="text-center py-8 text-xs text-content-muted">
              Brak zadań w wybranej kategorii.
            </p>
          ) : (
            filteredRows.map((row, i) => (
              <div
                key={i}
                className={`rounded-2xl border p-4 sm:p-5 space-y-3 transition-all ${
                  row.isCorrect
                    ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.06] to-base-200/50'
                    : 'border-amber-500/35 bg-gradient-to-br from-amber-500/[0.08] to-base-200/60 shadow-lg shadow-amber-950/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-white/[0.06]">
                  <span className="text-xs font-mono font-bold text-content-muted">
                    Zadanie #{i + 1}
                  </span>
                  {row.isCorrect ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 shadow-sm">
                      <Check size={13} className="stroke-[3]" />
                      <span>Zrobione dobrze</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
                      <AlertTriangle size={13} className="stroke-[2.5]" />
                      <span>Wymaga poprawy</span>
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-content-muted block mb-1">
                    Treść zadania:
                  </span>
                  <p className="prose-justified text-[15px] font-semibold text-white leading-relaxed">
                    {row.polishSentence}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-base-100/70 border border-white/10 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-content-muted block">
                    Twoja odpowiedź:
                  </span>
                  <div
                    className={`text-[14px] leading-relaxed ${
                      row.isCorrect ? 'text-white font-medium' : 'text-amber-200 font-medium'
                    }`}
                  >
                    {formatStudentAnswer(row.studentAnswer)}
                  </div>
                </div>

                {!row.isCorrect && row.correctTranslation && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                      <Check size={13} className="stroke-[3]" /> Wzorzec lektora (poprawna wersja):
                    </span>
                    <p className="text-[14px] text-white font-semibold font-mono leading-relaxed">
                      {row.correctTranslation}
                    </p>
                  </div>
                )}

                {row.explanation && (
                  <div className="p-3 rounded-xl bg-primary/[0.06] border border-primary/20 flex items-start gap-2.5">
                    <Sparkles size={15} className="text-primary shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
                        Wskazówka / Wyjaśnienie:
                      </span>
                      <p className="text-[13px] text-content leading-relaxed font-sans">
                        {row.explanation}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <button
          onClick={closeTask}
          className="w-full min-h-[3.5rem] rounded-2xl bg-primary text-accent-ink font-bold text-base shadow-lg shadow-primary/25 hover:shadow-primary/45 transition-all cursor-pointer"
        >
          {L.backToList}
        </button>
      </div>
    );
  }

  // ————— Podgląd ocenionej / oddanej pracy domowej —————
  if (viewingGradedTask) {
    const rows = getExerciseReviewRows(viewingGradedTask);
    const correctCount = rows.filter((r) => r.isCorrect).length;
    const errorCount = rows.filter((r) => !r.isCorrect).length;
    const totalCount = rows.length;
    const score =
      viewingGradedTask.grade !== undefined
        ? viewingGradedTask.grade
        : totalCount > 0
        ? Math.round((correctCount / totalCount) * 100)
        : 0;

    const isGraded =
      viewingGradedTask.status === 'graded' ||
      Boolean(viewingGradedTask.reviewedAt) ||
      Boolean(viewingGradedTask.teacherFeedback);

    const filteredRows = rows.filter((r) => {
      if (reviewFilter === 'errors') return !r.isCorrect;
      if (reviewFilter === 'correct') return r.isCorrect;
      return true;
    });

    const scoreColorClass =
      score >= 80
        ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/35'
        : score >= 50
        ? 'text-amber-400 bg-amber-500/15 border-amber-500/35'
        : 'text-rose-400 bg-rose-500/15 border-rose-500/35';

    const scoreAssessment =
      score >= 80
        ? 'Znakomity wynik! Świetnie opanowany materiał.'
        : score >= 50
        ? 'Dobra próba! Sprawdź poniżej elementy, które wymagają drobnej korekty.'
        : 'Wymaga powtórki. Przeanalizuj poniższe poprawne wzorce i wskazówki.';

    return (
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-6">
        {/* Navigation & Header */}
        <div className="space-y-3">
          <button
            onClick={() => setViewingGradedTask(null)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/12 text-content-muted hover:text-text-hi hover:bg-white/5 transition-colors text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Wróć do listy prac</span>
          </button>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              {isGraded ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
                  <CheckCheck size={14} />
                  Ocenione przez lektora
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-warn/20 text-warn border border-warn/30">
                  <Clock size={14} />
                  Czeka na sprawdzenie
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
              {viewingGradedTask.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-muted font-mono pt-1">
              {viewingGradedTask.createdAt && (
                <span className="inline-flex items-center gap-1">
                  <Calendar size={12} /> Zadano: {formatTaskDateTime(viewingGradedTask.createdAt)}
                </span>
              )}
              {viewingGradedTask.submittedAt && (
                <span className="inline-flex items-center gap-1">
                  · <Clock size={12} /> Odesłano: {formatTaskDateTime(viewingGradedTask.submittedAt)}
                </span>
              )}
              {viewingGradedTask.reviewedAt && (
                <span className="inline-flex items-center gap-1 text-primary">
                  · <CheckCheck size={12} /> Sprawdzono: {formatTaskDateTime(viewingGradedTask.reviewedAt)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Teacher Feedback Card */}
        {viewingGradedTask.teacherFeedback ? (
          <div className="rounded-3xl bg-gradient-to-br from-primary/[0.14] via-base-200 to-base-200 border-2 border-primary/40 p-5 sm:p-6 shadow-xl shadow-primary/10 relative overflow-hidden space-y-3">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 space-y-2">
              <div className="flex items-center gap-2 text-primary font-mono text-xs font-bold uppercase tracking-wider">
                <MessageSquareQuote size={18} />
                <span>{L.teacherFeedback}</span>
              </div>
              <p className="text-[15px] sm:text-[16px] text-white leading-relaxed whitespace-pre-wrap font-sans font-medium">
                {viewingGradedTask.teacherFeedback}
              </p>
              {viewingGradedTask.reviewedAt && (
                <p className="text-[11px] font-mono text-content-muted pt-1">
                  Wystawiono: {formatTaskDateTime(viewingGradedTask.reviewedAt)}
                </p>
              )}
            </div>
          </div>
        ) : isGraded ? (
          <div className="rounded-2xl bg-base-200/60 border border-white/10 p-4 text-xs text-content-muted leading-relaxed flex items-center gap-3">
            <CheckCheck size={20} className="text-primary shrink-0" />
            <span>Lektor sprawdził Twoje odpowiedzi i zatwierdził zadania bez dodatkowego komentarza ogólnego.</span>
          </div>
        ) : (
          /* Wynik pod spodem wystawia automat, nie lektor. Kursant musi to
             wiedzieć, zanim przeczyta ocenę — inaczej bierze podpowiedź
             maszyny za werdykt nauczyciela i albo się nim niepotrzebnie
             przejmuje, albo uznaje pracę za zamkniętą. */
          <div className="rounded-3xl bg-gradient-to-br from-info/[0.12] via-base-200 to-base-200 border-2 border-info/40 p-5 sm:p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-info/15 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex items-start gap-3.5">
              <span className="p-2.5 rounded-2xl bg-info/15 text-info border border-info/30 shrink-0">
                <Sparkles size={20} />
              </span>
              <div className="space-y-1.5 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-[0.14em] bg-info/15 text-info border border-info/30">
                  Ocena wstępna
                </span>
                <h3 className="text-xl sm:text-2xl font-black font-serif text-white leading-tight">
                  To jest automatyczny feedback
                </h3>
                <p className="text-sm text-content leading-relaxed">
                  Poniższa ocena i uwagi powstały automatycznie, zaraz po odesłaniu pracy — żebyś
                  nie czekał na pierwszą informację zwrotną.{' '}
                  <strong className="text-white font-bold">
                    Komentarz od lektora dostaniesz później
                  </strong>{' '}
                  i to on jest oceną wiążącą.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Score & Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`p-4 rounded-2xl border text-center space-y-1 ${scoreColorClass}`}>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider opacity-80 block">
              Ocena pracy
            </span>
            <span className="text-3xl font-black font-mono">
              {score}%
            </span>
            <span className="text-[10px] block opacity-90 font-sans">
              {scoreAssessment}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-500/[0.08] border border-emerald-500/30 text-center space-y-1 flex flex-col justify-center">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-center gap-1">
              <Check size={13} className="stroke-[3]" /> Zrobione dobrze
            </span>
            <span className="text-2xl font-black font-mono text-emerald-300">
              {correctCount} <span className="text-xs font-sans text-emerald-400/70 font-normal">/ {totalCount}</span>
            </span>
            <span className="text-[11px] text-content-muted">
              {totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0}% poprawności
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/[0.08] border border-amber-500/30 text-center space-y-1 flex flex-col justify-center">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center justify-center gap-1">
              <AlertTriangle size={13} /> Wymaga poprawy
            </span>
            <span className="text-2xl font-black font-mono text-amber-300">
              {errorCount} <span className="text-xs font-sans text-amber-400/70 font-normal">/ {totalCount}</span>
            </span>
            <span className="text-[11px] text-content-muted">
              {errorCount === 0 ? 'Brak błędów!' : `${errorCount} do analizy`}
            </span>
          </div>
        </div>

        {/* Visual Ratio Progress Bar */}
        {totalCount > 0 && (
          <div className="space-y-1.5 px-1">
            <div className="h-2 rounded-full bg-white/10 overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(correctCount / totalCount) * 100}%` }}
                title={`Poprawne: ${correctCount}`}
              />
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${(errorCount / totalCount) * 100}%` }}
                title={`Do poprawy: ${errorCount}`}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-content-muted">
              <span>Poprawne: {Math.round((correctCount / totalCount) * 100)}%</span>
              <span>Do poprawy: {Math.round((errorCount / totalCount) * 100)}%</span>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-base-200/80 border border-white/10">
          <button
            onClick={() => setReviewFilter('all')}
            className={`flex-1 min-h-[2.5rem] rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              reviewFilter === 'all'
                ? 'bg-primary text-accent-ink shadow-sm'
                : 'text-content-muted hover:text-text-hi'
            }`}
          >
            Wszystkie ({totalCount})
          </button>
          <button
            onClick={() => setReviewFilter('errors')}
            className={`flex-1 min-h-[2.5rem] rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              reviewFilter === 'errors'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-amber-400/80 hover:text-amber-300'
            }`}
          >
            <AlertTriangle size={13} />
            <span>Do poprawy ({errorCount})</span>
          </button>
          <button
            onClick={() => setReviewFilter('correct')}
            className={`flex-1 min-h-[2.5rem] rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              reviewFilter === 'correct'
                ? 'bg-emerald-500 text-black shadow-sm'
                : 'text-emerald-400/80 hover:text-emerald-300'
            }`}
          >
            <Check size={13} className="stroke-[3]" />
            <span>Poprawne ({correctCount})</span>
          </button>
        </div>

        {/* Detailed Exercise Cards */}
        <div className="space-y-3">
          {filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-base-200/40 p-8 text-center text-xs text-content-muted">
              Brak zadań w wybranej kategorii.
            </div>
          ) : (
            filteredRows.map((row) => (
              <div
                key={row.index}
                className={`rounded-2xl border p-4 sm:p-5 space-y-3 transition-all ${
                  row.isCorrect
                    ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.06] to-base-200/50'
                    : 'border-amber-500/35 bg-gradient-to-br from-amber-500/[0.08] to-base-200/60 shadow-lg shadow-amber-950/20'
                }`}
              >
                {/* Header with index and distinct badge */}
                <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-white/[0.06]">
                  <span className="text-xs font-mono font-bold text-content-muted">
                    Zadanie #{row.index} · {typeLabel(row.type)}
                  </span>
                  {row.isCorrect ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 shadow-sm">
                      <Check size={13} className="stroke-[3]" />
                      <span>Zrobione dobrze</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
                      <AlertTriangle size={13} className="stroke-[2.5]" />
                      <span>Wymaga poprawy</span>
                    </span>
                  )}
                </div>

                {/* Prompt */}
                <div>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-content-muted block mb-1">
                    Treść zadania:
                  </span>
                  <p className="prose-justified text-[15px] font-semibold text-white leading-relaxed">
                    {row.prompt}
                  </p>
                </div>

                {/* Student's answer */}
                <div className="p-3 rounded-xl bg-base-100/70 border border-white/10 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-content-muted block">
                    Twoja odpowiedź:
                  </span>
                  <div
                    className={`text-[14px] leading-relaxed ${
                      row.isCorrect ? 'text-white font-medium' : 'text-amber-200 font-medium'
                    }`}
                  >
                    {formatStudentAnswer(row.studentAnswer)}
                  </div>
                </div>

                {/* Expected answer if incorrect */}
                {!row.isCorrect && row.expected && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                      <Check size={13} className="stroke-[3]" /> Wzorzec lektora (poprawna wersja):
                    </span>
                    <p className="text-[14px] text-white font-semibold font-mono leading-relaxed">
                      {row.expected}
                    </p>
                  </div>
                )}

                {/* Explanation or tip */}
                {row.explanation && (
                  <div className="p-3 rounded-xl bg-primary/[0.06] border border-primary/20 flex items-start gap-2.5">
                    <Sparkles size={15} className="text-primary shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
                        Wskazówka / Wyjaśnienie:
                      </span>
                      <p className="text-[13px] text-content leading-relaxed font-sans">
                        {row.explanation}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Back Button */}
        <button
          onClick={() => setViewingGradedTask(null)}
          className="w-full min-h-[3.5rem] rounded-2xl bg-base-100 border border-white/15 text-white font-bold text-base hover:bg-white/5 transition-all cursor-pointer"
        >
          {L.backToList}
        </button>
      </div>
    );
  }

  // ————— Rozwiązywanie —————
  if (activeTask) {
    const items = activeTask.sentences || [];
    // Jedna praca domowa miesza rodzaje ćwiczeń, więc rodzaj rozstrzyga
    // element, a nie dokument (patrz utils/homework.ts).
    const type = homeworkItemType(items[index], activeTask);
    const isLast = index >= items.length - 1;
    const blocks = blocksOf(activeTask);
    const block = blocks.find((b) => index >= b.from && index < b.from + b.count);

    /**
     * Czy na to zadanie padła jakakolwiek odpowiedź.
     *
     * Odpowiedzi bywają tekstem, tablicą (układanka, dobieranie) albo obiektem
     * (luki), więc samo `Boolean(answers[i])` uznałoby pustą tablicę i `{}` za
     * wypełnione i licznik pokazywałby komplet przy pustej pracy.
     */
    const isAnswered = (value: any): boolean => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      if (Array.isArray(value)) return value.some((entry) => isAnswered(entry));
      if (typeof value === 'object') return Object.values(value).some((entry) => isAnswered(entry));
      return true;
    };

    const countAnsweredIn = (from: number, count: number): number => {
      let done = 0;
      for (let i = from; i < from + count; i++) {
        if (isAnswered(answers[i])) done += 1;
      }
      return done;
    };

    const answeredCount = countAnsweredIn(0, items.length);

    return (
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={closeTask}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl border border-white/12 text-content-muted"
            aria-label={L.back}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((index + 1) / Math.max(items.length, 1)) * 100}%` }}
            />
          </div>
          <span className="font-mono text-xs text-content-muted shrink-0">
            {index + 1}/{items.length}
          </span>
        </div>

        {/* Etykieta bloku: przy pracy z kilku rodzajów kursant widzi, w którym
            jest i ile w nim zostało — bez tego mieszane zadania czytają się
            jak jeden nieprzewidywalny ciąg. */}
        {block && blocks.length > 1 && (
          <p className="px-1 text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-primary">
            {L.blockLabel(typeLabel(block.type), index - block.from + 1, block.count)}
          </p>
        )}

        {/* Mapa bloków z postępem.
            Pracy domowej nie trzeba robić za jednym posiedzeniem — odpowiedzi
            zapisują się same. Żeby to miało sens, kursant musi widzieć, co ma
            już wypełnione i gdzie wrócić; bez tego po przerwie przewija
            wszystko od początku, szukając pierwszej pustej luki. */}
        {blocks.length > 1 && (
          <div className="rounded-2xl border border-white/10 bg-base-200/40 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-white">{L.progressTitle}</span>
              <span className="text-[11px] font-mono text-content-muted">
                {answeredCount}/{items.length}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {blocks.map((b, bi) => {
                const done = countAnsweredIn(b.from, b.count);
                const isCurrent = index >= b.from && index < b.from + b.count;
                const complete = done === b.count;
                return (
                  <button
                    key={`${b.type}-${bi}`}
                    type="button"
                    onClick={() => setIndex(b.from)}
                    title={`${typeLabel(b.type)} — ${done}/${b.count}`}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      isCurrent
                        ? 'border-primary/50 bg-primary/12 text-primary'
                        : complete
                        ? 'border-white/10 bg-white/[0.05] text-content-muted'
                        : 'border-white/12 bg-base-100/60 text-content hover:bg-white/[0.07]'
                    }`}
                  >
                    {complete && <CheckCheck size={12} className="shrink-0" />}
                    <span className="truncate max-w-[10rem]">{typeLabel(b.type)}</span>
                    <span className="font-mono opacity-70">
                      {done}/{b.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-content-muted leading-relaxed">{L.progressHint}</p>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-base-200/50 p-4 sm:p-6">
          <HomeworkExercise
            type={type}
            item={items[index]}
            answer={answers[index]}
            onChange={(value) => setAnswers((prev) => ({ ...prev, [index]: value }))}
          />
        </div>

        {/* Ostrzeżenia i błędy stoją przy przycisku, którego dotyczą — kursant
            czyta je bez zasłaniania zadania i bez odklikiwania okna. */}
        {notice && (
          <p
            role="status"
            className="rounded-xl border border-warn/30 bg-warn/[0.08] p-3 text-[13px] text-warn leading-relaxed"
          >
            {notice}
          </p>
        )}

        <div className="flex gap-2">
          {index > 0 && (
            <button
              onClick={() => setIndex((i) => i - 1)}
              className="min-h-[3.25rem] px-5 rounded-xl border border-white/15 text-content font-bold text-sm"
            >
              {L.prev}
            </button>
          )}
          {isLast ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`flex-1 min-h-[3.25rem] flex items-center justify-center gap-2 rounded-xl font-bold disabled:opacity-50 ${
                confirmedIncomplete
                  ? 'bg-warn text-accent-ink'
                  : 'bg-primary text-accent-ink'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> {L.submitting}
                </>
              ) : (
                <>
                  <Send size={16} /> {confirmedIncomplete ? L.sendAnyway : L.submit}
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => setIndex((i) => i + 1)}
              className="flex-1 min-h-[3.25rem] flex items-center justify-center gap-2 rounded-xl bg-primary text-accent-ink font-bold"
            >
              {L.next} <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ————— Lista —————
  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
      <header className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl border border-white/12 text-content-muted"
            aria-label={L.back}
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <h1 className="text-xl font-extrabold text-white">{L.title}</h1>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-10 text-content-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-base-200/40 p-6 text-center text-sm text-content-muted">
          {L.empty}
        </p>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="space-y-2">
              <h2 className="px-1 text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-primary">
                {L.todo}
              </h2>
              <ul className="space-y-2">
                {pending.map((task) => (
                  <li key={task.id}>
                    <button
                      onClick={() => !isPreview && startTask(task)}
                      disabled={isPreview}
                      className={`neon-still w-full min-h-[4rem] flex items-center gap-3 px-4 py-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] to-base-200/50 text-left transition-transform ${isPreview ? 'opacity-70 cursor-default' : 'active:scale-[0.99]'}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="block font-bold text-white text-[15px] leading-snug truncate">
                            {task.title}
                          </span>
                          {isTaskNewForStudent(task) && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-primary text-black shadow-sm flex items-center gap-1 animate-pulse">
                              <Sparkles size={11} /> Nowa
                            </span>
                          )}
                        </div>
                        <span className="flex flex-wrap items-center gap-x-2 text-[12px] text-content-muted mt-0.5">
                          <span>
                            {blocksOf(task).length > 1
                              ? L.blockCount(blocksOf(task).length)
                              : typeLabel(blocksOf(task)[0]?.type || 'translation')}
                          </span>
                          <span>· {L.items(task.sentences?.length || 0)}</span>
                          {task.createdAt && (
                            <span className="inline-flex items-center gap-1">
                              · <Calendar size={11} /> Zadano: {formatTaskDateTime(task.createdAt)}
                            </span>
                          )}
                          {task.dueDate && (
                            <span className="inline-flex items-center gap-1 text-warn">
                              · <Clock size={11} /> {L.due(task.dueDate)}
                            </span>
                          )}
                        </span>
                      </div>
                      {!isPreview && <ChevronRight className="w-5 h-5 text-primary shrink-0" />}
                    </button>

                    {/* Spis bloków pod pozycją — jedno dotknięcie, żeby zobaczyć
                        skład pracy domowej bez jej otwierania. */}
                    {blocksOf(task).length > 1 && (
                      <>
                        <button
                          onClick={() => setOpenBlocksId((id) => (id === task.id ? null : task.id || null))}
                          aria-expanded={openBlocksId === task.id}
                          className="mt-1 ml-1 inline-flex items-center gap-1.5 min-h-[2.25rem] px-2 text-[12px] font-bold text-content-muted"
                        >
                          <ChevronDown
                            size={13}
                            className={`transition-transform ${openBlocksId === task.id ? 'rotate-180' : ''}`}
                          />
                          {openBlocksId === task.id ? L.hideBlocks : L.showBlocks}
                        </button>
                        {openBlocksId === task.id && (
                          <ul className="mt-1 ml-1 space-y-1">
                            {blocksOf(task).map((block, i) => (
                              <li
                                key={`${block.type}-${block.from}`}
                                className="flex items-center gap-2 text-[12px] text-content-muted"
                              >
                                <span className="w-5 h-5 shrink-0 rounded-md bg-primary/10 border border-primary/25 text-primary font-mono text-[10px] flex items-center justify-center">
                                  {i + 1}
                                </span>
                                <span className="text-content">{typeLabel(block.type)}</span>
                                <span>· {L.items(block.count)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Sekcja: Odesłane (oczekujące na sprawdzenie) */}
          {submittedTasks.length > 0 && (
            <section className="space-y-2">
              <h2 className="px-1 text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-content-muted flex items-center gap-1.5">
                <Clock size={13} className="text-primary" />
                <span>{language === 'pl' ? 'Odesłane (oczekujące na sprawdzenie)' : 'Submitted (Awaiting review)'}</span>
                <span className="ml-auto font-mono text-xs">{submittedTasks.length}</span>
              </h2>
              <ul className="rounded-2xl border border-white/10 bg-base-200/40 divide-y divide-white/[0.06] overflow-hidden">
                {submittedTasks.map((task) => (
                  <li key={task.id}>
                    <button
                      onClick={() => setViewingGradedTask(task)}
                      className="w-full min-h-[3.5rem] flex items-center justify-between gap-3 px-4 py-3 text-left active:bg-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-content leading-snug truncate">
                          {task.title}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-content-muted mt-0.5">
                          <span className="font-semibold text-warn flex items-center gap-1">
                            <Clock size={12} /> {L.statusSubmitted}
                          </span>
                          {task.submittedAt && (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-content-muted">
                              · <Clock size={11} /> Odesłano: {formatTaskDateTime(task.submittedAt)}
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="text-xs text-content-muted flex items-center gap-1 shrink-0 font-mono">
                        Podgląd <ChevronRight size={13} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Rozdzielający divider przed sekcją Sprawdzone przez nauczyciela */}
          <div className="pt-2">
            <div className="h-px bg-white/[0.08] my-4" />
          </div>

          {/* Sekcja: Sprawdzone przez nauczyciela */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[12px] font-mono font-bold uppercase tracking-[0.12em] text-primary flex items-center gap-1.5">
                <CheckCheck size={16} />
                <span>{language === 'pl' ? 'Sprawdzone przez nauczyciela' : 'Reviewed by teacher'}</span>
              </h2>
              <span className="text-xs font-mono font-bold text-primary/80">
                {gradedTasks.length} {language === 'pl' ? (gradedTasks.length === 1 ? 'praca' : 'prac') : 'tasks'}
              </span>
            </div>

            {gradedTasks.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-base-200/40 p-5 text-center text-xs text-content-muted leading-relaxed">
                <Award className="w-7 h-7 text-primary/40 mx-auto mb-2" />
                <p className="font-semibold text-white/90 text-sm">
                  {language === 'pl' ? 'Brak sprawdzonych prac' : 'No reviewed homework yet'}
                </p>
                <p className="mt-1 text-content-muted">
                  {language === 'pl'
                    ? 'Gdy lektor sprawdzi Twoją odesłaną pracę domową i wystawi ocenę lub komentarz, pojawi się ona w tym miejscu.'
                    : 'When your teacher reviews your submitted homework, grades and feedback will appear here.'}
                </p>
              </div>
            ) : (
              <ul className="rounded-2xl border border-primary/25 bg-base-200/40 divide-y divide-white/[0.06] overflow-hidden">
                {gradedTasks.map((task) => {
                  const rows = getExerciseReviewRows(task);
                  const correctCount = rows.filter((r) => r.isCorrect).length;
                  const errorCount = rows.filter((r) => !r.isCorrect).length;

                  return (
                    <li key={task.id}>
                      <div
                        onClick={() => {
                          setViewingGradedTask(task);
                          if (task.id && user?.id) {
                            try {
                              localStorage.setItem(`dismissed_graded_hw_${user.id}_${task.id}`, 'true');
                            } catch (e) {}
                            updateDoc(doc(db, 'specialTasks', task.id), {
                              feedbackReadByStudent: true,
                            }).catch(() => {});
                          }
                        }}
                        className="w-full min-h-[4rem] p-4 text-left active:bg-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <span className="block text-[15px] font-bold text-white leading-snug truncate">
                              {task.title}
                            </span>
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-content-muted mt-0.5">
                              <span className="font-semibold text-primary flex items-center gap-1">
                                <CheckCheck size={13} /> {L.statusGraded}
                              </span>
                              {task.reviewedAt && (
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-content-muted">
                                  · Sprawdzono: {formatTaskDateTime(task.reviewedAt)}
                                </span>
                              )}
                              {task.submittedAt && (
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-content-muted">
                                  · Odesłano: {formatTaskDateTime(task.submittedAt)}
                                </span>
                              )}
                            </span>
                          </div>

                          {task.grade !== undefined && (
                            <span className="flex items-center gap-1 font-mono text-[13px] font-bold text-primary shrink-0 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30">
                              <Award size={14} />
                              {task.grade}%
                            </span>
                          )}
                        </div>

                        {/* Quick Summary Badges & Teacher Comment Snippet */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                              <Check size={11} className="stroke-[3]" /> {correctCount} dobrych
                            </span>
                            {errorCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/25">
                                <AlertTriangle size={11} /> {errorCount} do poprawy
                              </span>
                            )}
                          </div>

                          <span className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                            <span>Zobacz ocenę i feedback</span>
                            <ChevronRight size={14} />
                          </span>
                        </div>

                        {task.teacherFeedback && (
                          <p className="text-xs text-primary/85 bg-primary/[0.06] border border-primary/15 px-3 py-2 rounded-xl line-clamp-2 italic font-sans flex items-start gap-2">
                            <MessageSquareQuote size={13} className="shrink-0 mt-0.5 text-primary" />
                            <span>"{task.teacherFeedback}"</span>
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {/* ---------------- ROZDZIELAJĄCY DIVIDER MIĘDZY PRACAMI A TESTAMI ---------------- */}
      <div className="relative my-8 py-2">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-base-200 px-4 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider text-primary border border-primary/30 flex items-center gap-2 shadow-lg shadow-black/40">
            <GraduationCap size={15} />
            <span>{language === 'pl' ? 'Testy i Sprawdziany wiedzy' : 'Tests & Exams'}</span>
            {tests.length > 0 && (
              <span className="px-1.5 py-0.2 bg-primary/20 rounded-full text-[10px] text-primary font-bold">
                {tests.length}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* ---------------- TESTY KURSANTÓW (PO TERMINIE / DO ZROBIENIA / ODESŁANE) ---------------- */}
      {tests.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-base-200/30 p-5 text-center text-xs text-content-muted">
          Brak przypisanych testów do rozwiązania.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Testy po terminie (overdue) */}
          {overdueTests.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-danger"></span>
                </span>
                <h2 className="text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-danger">
                  Termin wykonania minął
                </h2>
              </div>
              <ul className="space-y-2">
                {overdueTests.map((t) => (
                  <li key={t.id}>
                    <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-danger/35 bg-danger/[0.06] text-left">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="px-2 py-0.5 rounded-md bg-danger/20 text-danger border border-danger/30 text-[10px] font-bold font-mono uppercase">
                            Zaległy
                          </span>
                          <span className="text-[12px] text-danger font-medium flex items-center gap-1">
                            <Clock size={12} /> Termin minął: {t.dueDate}
                          </span>
                        </div>
                        <h3 className="font-bold text-white text-[15px] leading-snug">{t.title}</h3>
                        {t.scope && (
                          <p className="text-[12px] text-content-muted line-clamp-1 mt-0.5">{t.scope}</p>
                        )}
                        <span className="text-[11px] text-content-muted font-mono mt-1 block">
                          Pytań: {t.questions?.length || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!isPreview ? (
                          <button
                            onClick={() => setActiveTest(t)}
                            className="min-h-[2.5rem] px-4 rounded-xl bg-danger text-white font-bold text-xs hover:bg-danger/90 active:scale-98 transition-all flex items-center gap-1.5 shadow-md shadow-danger/20"
                          >
                            <span>Rozwiąż po terminie</span>
                            <ArrowRight size={14} />
                          </button>
                        ) : (
                          <span className="text-xs text-content-muted italic">Podgląd</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Testy do zrobienia (pending & in time) */}
          {pendingTests.length > 0 && (
            <section className="space-y-2">
              <h2 className="px-1 text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-primary">
                Testy do zrobienia
              </h2>
              <ul className="space-y-2">
                {pendingTests.map((t) => (
                  <li key={t.id}>
                    <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] to-base-200/50 text-left">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="px-2 py-0.5 rounded-md bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold font-mono uppercase">
                            Nowy test
                          </span>
                          {t.dueDate && (
                            <span className="text-[12px] text-warn font-medium flex items-center gap-1">
                              <Clock size={12} /> Do: {t.dueDate}
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-white text-[15px] leading-snug">{t.title}</h3>
                        {t.scope && (
                          <p className="text-[12px] text-content-muted line-clamp-1 mt-0.5">{t.scope}</p>
                        )}
                        <span className="text-[11px] text-content-muted font-mono mt-1 block">
                          Pytań: {t.questions?.length || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!isPreview ? (
                          <button
                            onClick={() => setActiveTest(t)}
                            className="min-h-[2.5rem] px-4 rounded-xl bg-primary text-accent-ink font-bold text-xs hover:bg-primary/90 active:scale-98 transition-all flex items-center gap-1.5 shadow-md shadow-primary/20"
                          >
                            <span>Rozpocznij test</span>
                            <ArrowRight size={14} />
                          </button>
                        ) : (
                          <span className="text-xs text-content-muted italic">Podgląd</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Testy odesłane / ocenione */}
          {finishedTests.length > 0 && (
            <section className="space-y-2">
              <h2 className="px-1 text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-content-muted">
                Odesłane i Ocenione testy
              </h2>
              <ul className="rounded-2xl border border-white/10 bg-base-200/40 divide-y divide-white/[0.06] overflow-hidden">
                {finishedTests.map((t) => (
                  <li key={t.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-md bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold font-mono uppercase">
                          Odesłany
                        </span>
                        {t.completedAt && (
                          <span className="text-[11px] text-content-muted">
                            {new Date(t.completedAt).toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-US')}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-content text-[15px] leading-snug">{t.title}</h3>
                      {t.score !== undefined && (
                        <p className="text-xs font-mono text-primary font-bold mt-1 flex items-center gap-1">
                          <Award size={13} />
                          Wynik: {Number.isNaN(Number(t.score)) ? 0 : t.score}/{Number.isNaN(Number(t.maxScore)) ? 100 : t.maxScore} pkt
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setFeedbackTest(t)}
                        className="min-h-[2.25rem] px-3 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <Eye size={13} />
                        <span>Feedback</span>
                      </button>
                      <button
                        onClick={() => exportTestToPDF(t, (k: string) => k)}
                        className="min-h-[2.25rem] px-3 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-text-hi text-xs font-medium transition-all flex items-center gap-1.5"
                      >
                        <Download size={13} />
                        <span>PDF</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Modal z feedbackiem do testu */}
      {feedbackTest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-base-200 border border-primary/30 shadow-2xl rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/10 bg-base-100">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 text-[11px] font-bold uppercase tracking-wider mb-1">
                  Raport z testu
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-white">{feedbackTest.title}</h3>
                <p className="text-content-muted text-xs sm:text-sm mt-0.5">
                  Wynik: <strong className="text-primary font-mono font-bold">{Number.isNaN(Number(feedbackTest.score)) ? 0 : feedbackTest.score}/{Number.isNaN(Number(feedbackTest.maxScore)) ? 100 : feedbackTest.maxScore} pkt</strong>
                </p>
              </div>
              <button onClick={() => setFeedbackTest(null)} className="p-2 hover:bg-white/10 rounded-xl text-content-muted hover:text-text-hi transition-colors">
                <XIcon size={20} />
              </button>
            </div>
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 prose prose-headings:text-text-hi prose-strong:text-text-hi max-w-none text-sm leading-relaxed text-content">
              {feedbackTest.aiFeedback ? (
                <Markdown>{feedbackTest.aiFeedback}</Markdown>
              ) : (
                <p className="text-content-muted italic">Brak dodatkowego feedbacku do tego testu.</p>
              )}
            </div>
            <div className="p-4 sm:p-5 border-t border-white/10 flex justify-end gap-3 bg-base-100">
              <Button onClick={() => exportTestToPDF(feedbackTest, (k: string) => k)} variant="secondary" size="sm" className="flex items-center gap-2">
                <Download size={14} />
                Pobierz raport (PDF)
              </Button>
              <Button onClick={() => setFeedbackTest(null)} size="sm" className="bg-primary text-accent-ink hover:bg-primary/90">
                Zamknij
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StudentHomeworkScreen;
