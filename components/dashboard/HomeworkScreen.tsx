import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { User, SpecialTask, HomeworkType, TranslationExercise, FillInTheBlankExercise, ErrorCorrectionExercise, LessonRecord, StudentTest } from '../../types';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { generateTranslationExercises, generateFillInTheBlankExercises, evaluateErrorCorrectionSentence, evaluateTranslations, evaluateTeacherHomework, processBulkSentences, generateHomeworkChatPipeline } from '../../services/geminiService';
import { generateFindErrors } from '../../services/homeworkGenerator';
import { isTaskForStudent, studentTasksQuery, taskOwnerFields, homeworkItemType } from '../../utils/homework';
import { backfillTaskOwners } from '../../utils/backfillTaskOwners';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import { LessonSelectionModal } from './LessonSelectionModal';
import HomeworkComposer from '../admin/HomeworkComposer';
import HomeworkComposerV2 from '../admin/HomeworkComposerV2';
import { HOMEWORK_ENGINE_V2 } from '../../config/featureFlags';
import HomeworkEmailConfirmationModal from '../admin/HomeworkEmailConfirmationModal';
import { TestPreviewModal } from '../admin/TestPreviewModal';
import { exportTestToPDF } from '../../utils/pdfExport';
import { FillInTheBlankTask } from '../practice/FillInTheBlankTask';
import { useEscapeModal } from '../../hooks/useEscapeModal';
import Badge from '../ui/Badge';
import { 
  BookOpen, 
  Sparkles, 
  Plus, 
  Check, 
  X, 
  Trash2, 
  Edit3, 
  Send, 
  Save,
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  User as UserIcon, 
  ChevronRight, 
  FileText, 
  HelpCircle, 
  RefreshCw,
  Award,
  Layers,
  UserCheck,
  Eye,
  GraduationCap,
  Download,
  CheckCheck,
  Archive,
  RotateCcw,
  Calendar,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface HomeworkScreenProps {
  initialTaskId?: string | null;
  initialStudentId?: string | null;
  initialFilterStatus?: string | null;
  onBack?: () => void;
}

export const getTaskDateMillis = (val: any): number => {
  if (!val) return 0;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (val.seconds !== undefined) return val.seconds * 1000;
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'string' || typeof val === 'number') {
    const t = new Date(val).getTime();
    return isNaN(t) ? 0 : t;
  }
  return 0;
};

export const formatTaskDate = (val: any): string => {
  const millis = getTaskDateMillis(val);
  if (!millis) return '';
  return new Date(millis).toLocaleDateString('pl-PL');
};

export const formatTaskDateTime = (val: any): string => {
  const millis = getTaskDateMillis(val);
  if (!millis) return '';
  const d = new Date(millis);
  const dateStr = d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
};

export const renderStudentAnswerDisplay = (stAns: any, item?: any): React.ReactNode => {
  if (stAns === undefined || stAns === null || stAns === '') {
    return <span className="text-danger italic">(Brak odpowiedzi)</span>;
  }

  // If stAns is an object with BLANK_ keys or other key-value map
  if (typeof stAns === 'object' && !Array.isArray(stAns)) {
    const entries = Object.entries(stAns);
    if (entries.length === 0) {
      return <span className="text-danger italic">(Brak odpowiedzi)</span>;
    }
    return (
      <div className="flex flex-wrap gap-2 mt-1">
        {entries
          .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
          .map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-base-200 border border-white/15 text-xs font-mono text-white shadow-sm"
            >
              <span className="text-primary font-bold">{key.replace(/^BLANK_/, 'Luka ')}:</span>
              <span className="text-primary font-semibold">{String(value)}</span>
            </span>
          ))}
      </div>
    );
  }

  // If stAns is an array (e.g. word order chunks or reordered fragments)
  if (Array.isArray(stAns)) {
    if (item?.chunks && Array.isArray(item.chunks)) {
      const text = stAns.map((i) => item.chunks[i] ?? i).join(' ');
      return <span className="text-primary font-medium">{text}</span>;
    }
    return <span className="text-primary font-medium">{stAns.join(' ')}</span>;
  }

  // If stAns is a number (multiple choice option index)
  if (typeof stAns === 'number') {
    if (item?.options && Array.isArray(item.options)) {
      return (
        <span className="text-primary font-medium">
          {item.options[stAns] || `Opcja ${stAns + 1}`}
        </span>
      );
    }
    return <span className="text-primary font-medium">{String(stAns)}</span>;
  }

  return <span className="text-primary font-medium">{String(stAns)}</span>;
};

export const renderExercisePrompt = (item: any, itemType: HomeworkType): React.ReactNode => {
  if (itemType === 'fill_in_the_blank') {
    const textWithBlanks = item.textWithBlanks || item.sentenceWithBlank || item.fullSentence || '';
    const blanks = item.blanks;
    return (
      <div className="space-y-1.5 text-sm">
        <div>
          <span className="text-xs text-content-muted block mb-0.5">Tekst z lukami:</span>
          <p className="font-semibold text-white leading-relaxed">{textWithBlanks}</p>
        </div>
        <div>
          <span className="text-xs text-content-muted block mb-0.5">Wzorzec (poprawne uzupełnienie):</span>
          {blanks && typeof blanks === 'object' ? (
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {Object.entries(blanks)
                .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
                .map(([k, v]) => (
                  <span key={k} className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-xs font-mono text-primary">
                    {k.replace(/^BLANK_/, 'Luka ')}: <strong>{String(v)}</strong>
                  </span>
                ))}
            </div>
          ) : (
            <p className="text-primary font-medium">{item.missingWord || item.correctSentence || '—'}</p>
          )}
        </div>
      </div>
    );
  }

  if (itemType === 'multiple_choice') {
    return (
      <div className="space-y-1.5 text-sm">
        <div>
          <span className="text-xs text-content-muted block mb-0.5">Pytanie:</span>
          <p className="font-semibold text-white">{item.question}</p>
        </div>
        <div>
          <span className="text-xs text-content-muted block mb-0.5">Poprawna opcja:</span>
          <p className="text-primary font-medium">
            {item.options?.[item.correctIndex] || `Opcja ${item.correctIndex + 1}`}
          </p>
        </div>
      </div>
    );
  }

  if (itemType === 'word_order') {
    return (
      <div className="space-y-1.5 text-sm">
        {item.polishHint && (
          <div>
            <span className="text-xs text-content-muted block mb-0.5">Znaczenie PL:</span>
            <p className="font-semibold text-white">{item.polishHint}</p>
          </div>
        )}
        <div>
          <span className="text-xs text-content-muted block mb-0.5">Poprawne zdanie (wzorzec):</span>
          <p className="text-primary font-medium">{item.correctSentence}</p>
        </div>
      </div>
    );
  }

  if (itemType === 'find_errors') {
    return (
      <div className="space-y-1.5 text-sm">
        <div>
          <span className="text-xs text-content-muted block mb-0.5">Zdanie z błędem do korekty:</span>
          <p className="font-semibold text-warn">{item.incorrectSentence}</p>
        </div>
        <div>
          <span className="text-xs text-content-muted block mb-0.5">Poprawna wersja:</span>
          <p className="text-primary font-medium">{item.correctSentence}</p>
        </div>
        {item.hint && (
          <div>
            <span className="text-xs text-content-muted block mb-0.5">Wskazówka:</span>
            <p className="text-amber-300 font-medium text-xs">💡 {item.hint}</p>
          </div>
        )}
        {item.polishHint && (
          <div>
            <span className="text-xs text-content-muted block mb-0.5">Znaczenie PL:</span>
            <p className="text-content-muted text-xs italic">{item.polishHint}</p>
          </div>
        )}
      </div>
    );
  }

  // translation
  return (
    <div className="space-y-1.5 text-sm">
      <div>
        <span className="text-xs text-content-muted block mb-0.5">Po polsku (zadanie):</span>
        <p className="font-semibold text-white">{item.polishSentence || item.polish}</p>
      </div>
      <div>
        <span className="text-xs text-content-muted block mb-0.5">Wzorzec angielski:</span>
        <p className="text-primary font-medium">{item.englishTranslation || item.english || item.englishSentence}</p>
      </div>
    </div>
  );
};

export const HomeworkScreen: React.FC<HomeworkScreenProps> = ({
  initialTaskId = null,
  initialStudentId = null,
  initialFilterStatus = null,
  onBack,
}) => {
  const { user, updateUserStreak } = useAuth();
  const { language } = useLanguage();
  const isTeacher = user?.role === 'admin' || user?.role === 'teacher';

  // State
  const [students, setStudents] = useState<User[]>([]);
  const [tasks, setTasks] = useState<SpecialTask[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingHomework, setIsSavingHomework] = useState<boolean>(false);
  const isSavingRef = React.useRef<boolean>(false);
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'flashcards'>('list');

  // Filter state for teacher
  const [filterStudentId, setFilterStudentId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>(initialFilterStatus || 'all');
  const [studentTests, setStudentTests] = useState<StudentTest[]>([]);
  const [previewTest, setPreviewTest] = useState<StudentTest | null>(null);

  // Email confirmation modal state
  const [isEmailConfirmationModalOpen, setIsEmailConfirmationModalOpen] = useState<boolean>(false);
  const [createdTaskForEmail, setCreatedTaskForEmail] = useState<any>(null);
  const [studentForEmail, setStudentForEmail] = useState<User | null>(null);

  useEffect(() => {
    if (initialFilterStatus) {
      setFilterStatus(initialFilterStatus);
      setActiveTab('list');
    }
  }, [initialFilterStatus]);

  // Form state for creating/editing homework (Teacher)
  const [editingTask, setEditingTask] = useState<SpecialTask | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '');
  
  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
      setFilterStudentId(initialStudentId);
    }
  }, [initialStudentId]);
  const [homeworkType, setHomeworkType] = useState<HomeworkType>('translation');
  const [title, setTitle] = useState<string>('');
  const [instructions, setInstructions] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  });

  // Items for creation
  const [translationItems, setTranslationItems] = useState<TranslationExercise[]>([]);
  const [errorCorrectionItems, setErrorCorrectionItems] = useState<ErrorCorrectionExercise[]>([]);

  // AI Generator controls
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [aiLevel, setAiLevel] = useState<string>('B1-B2');
  const [aiTopic, setAiTopic] = useState<string>('');
  const [aiCount, setAiCount] = useState<number>(5);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [genError, setGenError] = useState<string>('');
  const [studentLessons, setStudentLessons] = useState<LessonRecord[]>([]);
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);


  // Active task execution state for Student
  const [activeTask, setActiveTask] = useState<SpecialTask | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<Record<number, string>>({});
  const [showHints, setShowHints] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<{
    score: number;
    results: any[];
  } | null>(null);

  // Review modal for Teacher
  const [reviewTask, setReviewTask] = useState<SpecialTask | null>(null);
  const [teacherFeedbackText, setTeacherFeedbackText] = useState<string>('');
  const [isSavingReview, setIsSavingReview] = useState<boolean>(false);

  // Preview modal for assigned homework
  const [previewTask, setPreviewTask] = useState<SpecialTask | null>(null);

  // Delete modal state
  const [taskToDelete, setTaskToDelete] = useState<SpecialTask | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEscapeModal(!!reviewTask, () => setReviewTask(null));
  useEscapeModal(!!previewTask, () => setPreviewTask(null));
  useEscapeModal(showBulkAddModal, () => setShowBulkAddModal(false));
  useEscapeModal(!!taskToDelete, () => setTaskToDelete(null), 10);

  const handleHomeworkTypeChange = (type: HomeworkType) => {
    if (
      (homeworkType === 'translation' && translationItems.length > 0 && type !== 'translation') ||
      ((homeworkType === 'find_errors' || homeworkType === 'fill_in_the_blank') && errorCorrectionItems.length > 0 && type !== 'find_errors')
    ) {
      if (window.confirm(
        language === 'pl' 
          ? "Uwaga: zmiana typu pracy domowej spowoduje ukrycie wprowadzonych wcześniej zdań. Kontynuować?" 
          : "Warning: changing the homework type will hide the sentences you've entered. Continue?"
      )) {
        setHomeworkType(type);
      }
    } else {
      setHomeworkType(type);
    }
  };

  // Start editing existing homework task
  const handleStartEditTask = (task: SpecialTask) => {
    setEditingTask(task);
    setSelectedStudentId(task.studentId || '');
    setHomeworkType(task.type || 'translation');
    setTitle(task.title || '');
    setInstructions(task.instructions || '');
    setDueDate(task.dueDate || '');
    if (task.type === 'find_errors' || task.type === 'fill_in_the_blank') {
      setErrorCorrectionItems(task.sentences || []);
      setTranslationItems([]);
    } else {
      setTranslationItems(task.sentences || []);
      setErrorCorrectionItems([]);
    }
    setActiveTab('create');
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setEditingTask(null);
    setTranslationItems([]);
    setErrorCorrectionItems([]);
    setTitle('');
    setInstructions('');
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
    } else {
      setSelectedStudentId('');
    }
    setActiveTab('list');
  };

  // Load students & homework tasks (with real-time updates)
  const loadData = async () => {
    setIsLoading(true);
    try {
      if (isTeacher) {
        // Load students
        const usersSnap = await getDocs(collection(db, 'users'));
        const studentList: User[] = [];
        usersSnap.forEach((d) => {
          const u = { id: d.id, ...d.data() } as User;
          if (u.role !== 'admin' && u.role !== 'teacher') {
            studentList.push(u);
          }
        });
        setStudents(studentList);

        // Load all tasks
        const tasksSnap = await getDocs(collection(db, 'specialTasks'));
        const loadedTasks: SpecialTask[] = [];
        tasksSnap.forEach((d) => {
          loadedTasks.push({ id: d.id, ...d.data() } as SpecialTask);
        });
        loadedTasks.sort((a, b) => getTaskDateMillis(b.createdAt) - getTaskDateMillis(a.createdAt));
        setTasks(loadedTasks);
      } else if (user?.id) {
        // Kursant pobiera wyłącznie własne zadania — filtr jest w zapytaniu,
        // nie w przeglądarce (patrz komentarz przy studentTasksQuery).
        const tasksSnap = await getDocs(studentTasksQuery(user.id));
        const loadedTasks: SpecialTask[] = tasksSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as SpecialTask)
        );
        loadedTasks.sort((a, b) => getTaskDateMillis(b.createdAt) - getTaskDateMillis(a.createdAt));
        setTasks(loadedTasks);
      }
    } catch (e) {
      console.error('Błąd ładowania prac domowych:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id && !user?.email && !user?.username) return;
    setIsLoading(true);

    let unsubscribe: () => void;

    if (isTeacher) {
      // 0. Dociągnij `studentUid` w zadaniach sprzed zaostrzenia reguł.
      //    Tylko nauczyciel ma prawo zapisu w specialTasks, więc to jedyne
      //    miejsce, z którego migracja może się wykonać sama.
      backfillTaskOwners();

      // 1. Fetch students
      getDocs(collection(db, 'users')).then(usersSnap => {
        const studentList: User[] = [];
        usersSnap.forEach((d) => {
          const u = { id: d.id, ...d.data() } as User;
          if (u.role !== 'admin' && u.role !== 'teacher') {
            studentList.push(u);
          }
        });
        setStudents(studentList);
      }).catch(console.error);

      // 2. Real-time tasks listener
      const q = query(collection(db, 'specialTasks'));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedTasks: SpecialTask[] = [];
        snapshot.forEach((d) => {
          loadedTasks.push({ id: d.id, ...d.data() } as SpecialTask);
        });
        loadedTasks.sort((a, b) => getTaskDateMillis(b.createdAt) - getTaskDateMillis(a.createdAt));
        setTasks(loadedTasks);
        setIsLoading(false);
      }, (err) => {
        console.error('Błąd real-time ładowania prac domowych:', err);
        setIsLoading(false);
      });
    } else if (user?.id) {
      // Real-time listener for student's tasks
      unsubscribe = onSnapshot(studentTasksQuery(user.id), (snapshot) => {
        const loadedTasks: SpecialTask[] = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() } as SpecialTask)
        );
        loadedTasks.sort((a, b) => getTaskDateMillis(b.createdAt) - getTaskDateMillis(a.createdAt));
        setTasks(loadedTasks);
        setIsLoading(false);
      }, (err) => {
        console.error('Błąd real-time ładowania prac domowych dla kursanta:', err);
        setIsLoading(false);
      });
    }

    if (user?.hasNewHomework && user?.id) {
      updateDoc(doc(db, 'users', user.id), { hasNewHomework: false }).catch(console.error);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id, user?.username, user?.email, user?.firstName, user?.lastName, isTeacher]);

  // Pobieranie testów kursantów dla widoku lektora
  useEffect(() => {
    if (!isTeacher) return;
    let isMounted = true;

    const fetchStudentTests = async () => {
      try {
        const testsList: StudentTest[] = [];
        if (filterStudentId !== 'all') {
          const snap = await getDocs(collection(db, `users/${filterStudentId}/tests`));
          const st = students.find((s) => s.id === filterStudentId);
          snap.forEach((d) => {
            testsList.push({
              id: d.id,
              studentId: filterStudentId,
              studentName: st ? `${st.firstName || ''} ${st.lastName || ''}`.trim() || st.username : 'Kursant',
              studentEmail: st?.email || '',
              ...d.data(),
            } as StudentTest);
          });
        } else {
          for (const st of students) {
            if (!st.id) continue;
            const snap = await getDocs(collection(db, `users/${st.id}/tests`));
            snap.forEach((d) => {
              testsList.push({
                id: d.id,
                studentId: st.id,
                studentName: `${st.firstName || ''} ${st.lastName || ''}`.trim() || st.username || 'Kursant',
                studentEmail: st.email || '',
                ...d.data(),
              } as StudentTest);
            });
          }
        }
        testsList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        if (isMounted) setStudentTests(testsList);
      } catch (err) {
        console.error('Błąd pobierania testów kursantów w HomeworkScreen:', err);
      }
    };

    if (students.length > 0) {
      fetchStudentTests();
    }

    return () => {
      isMounted = false;
    };
  }, [isTeacher, students, filterStudentId]);

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

  const filteredStudentTests = React.useMemo(() => {
    return studentTests.filter((t) => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'submitted') {
        return t.status === 'graded' || t.status === 'completed' || Boolean(t.completedAt);
      }
      if (filterStatus === 'pending') {
        return t.status === 'pending' || !t.status;
      }
      if (filterStatus === 'graded') {
        return t.status === 'graded' || t.status === 'completed';
      }
      return true;
    });
  }, [studentTests, filterStatus]);

  // Auto-select initial task if provided
  useEffect(() => {
    if (initialTaskId && tasks.length > 0) {
      const found = tasks.find(t => t.id === initialTaskId);
      if (found) {
        setActiveTask(found);
        setStudentAnswers({});
        setShowHints({});
        setSubmissionResult(null);
      }
    }
  }, [initialTaskId, tasks]);

  // Restore draft on initial load
  useEffect(() => {
    if (isTeacher) {
      const savedDraft = localStorage.getItem('homework_draft');
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          if (draft.selectedStudentId !== undefined) setSelectedStudentId(draft.selectedStudentId);
          if (draft.homeworkType) setHomeworkType(draft.homeworkType);
          if (draft.title) setTitle(draft.title);
          if (draft.instructions) setInstructions(draft.instructions);
          if (draft.dueDate) setDueDate(draft.dueDate);
          if (draft.translationItems) setTranslationItems(draft.translationItems);
          if (draft.errorCorrectionItems) setErrorCorrectionItems(draft.errorCorrectionItems);
          if (draft.aiLevel) setAiLevel(draft.aiLevel);
          if (draft.aiTopic !== undefined) setAiTopic(draft.aiTopic);
          if (draft.aiCount) setAiCount(draft.aiCount);
          if (draft.aiPrompt !== undefined) setAiPrompt(draft.aiPrompt);
          if (draft.selectedLessonIds) setSelectedLessonIds(draft.selectedLessonIds);
        } catch (e) {
          console.error('Błąd podczas ładowania draftu:', e);
        }
      } else {
        // No draft, set initial title based on default homework type
        setTitle('Praca domowa: Tłumaczenie zdań');
        setInstructions('Przetłumacz poniższe zdania na język angielski. Przemyśl strukturę zdania i zastosowane słownictwo.');
      }
    }
    setIsDraftLoaded(true);
  }, [isTeacher]);

  // Save draft whenever relevant state changes (only when not editing existing task)
  useEffect(() => {
    if (isTeacher && isDraftLoaded && activeTab === 'create' && !editingTask) {
      const draft = {
        selectedStudentId,
        homeworkType,
        title,
        instructions,
        dueDate,
        translationItems,
        errorCorrectionItems,
        aiLevel,
        aiTopic,
        aiCount,
        aiPrompt,
        selectedLessonIds
      };
      localStorage.setItem('homework_draft', JSON.stringify(draft));
    }
  }, [
    isTeacher, isDraftLoaded, activeTab, editingTask, selectedStudentId, homeworkType, title, 
    instructions, dueDate, translationItems, errorCorrectionItems, 
    aiLevel, aiTopic, aiCount, aiPrompt, selectedLessonIds
  ]);

  // Auto-set level and load lessons when student changes
  useEffect(() => {
    if (!selectedStudentId || selectedStudentId === "all") {
      setStudentLessons([]);
      setSelectedLessonIds([]);
      return;
    }

    // Auto-select student's assigned level from teacher profile
    const selectedStudent = students.find((st) => st.id === selectedStudentId);
    if (selectedStudent?.level) {
      setAiLevel(selectedStudent.level);
    }

    // Load student's lesson records for vocabulary source
    const loadLessons = async () => {
      try {
        const snap = await getDocs(collection(db, `users/${selectedStudentId}/lessonRecords`));
        const lessons: LessonRecord[] = [];
        snap.forEach(d => lessons.push({ id: d.id, ...d.data() } as LessonRecord));
        const sorted = lessons.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setStudentLessons(sorted);
        setSelectedLessonIds([]); // Default to no lessons selected (user opens modal to select)
      } catch (err) {
        console.error("Błąd pobierania lekcji kursanta:", err);
      }
    };
    loadLessons();
  }, [selectedStudentId, students]);

  // AI Generation handler
  const handleGenerateWithAI = async () => {
    if (!selectedStudentId) {
      setGenError('Najpierw wybierz kursanta z listy na samej górze!');
      return;
    }

    setIsGenerating(true);
    setGenError('');
    try {
      let finalTopic = aiTopic;
      let finalPrompt = aiPrompt;
      let vocabularyTextToUse = "";

      const selectedStudent = students.find((st) => st.id === selectedStudentId);
      const selectedLessons = studentLessons.filter((l) => selectedLessonIds.includes(l.id));

      if (selectedLessons.length > 0) {
        vocabularyTextToUse = selectedLessons
          .map((l) => l.vocabularyText)
          .filter(Boolean)
          .join('\n');
        finalPrompt += `\n\nBAZUJ NA SKUMULOWANYM SŁOWNICTWIE I KONTEKŚCIE Z WYBRANYCH (${selectedLessons.length}) LEKCJI KURSANTA:\n${vocabularyTextToUse}`;
      }

      if (homeworkType === "translation") {
        const wordsArr = vocabularyTextToUse
          ? vocabularyTextToUse.split('\n').map(s => s.trim()).filter(Boolean)
          : (finalTopic ? finalTopic.split(",").map(s => s.trim()).filter(Boolean) : []);

        const pipelineRes = await generateHomeworkChatPipeline({
          studentProfile: selectedStudent ? {
            firstName: selectedStudent.firstName,
            lastName: selectedStudent.lastName,
            level: selectedStudent.level || aiLevel,
            description: selectedStudent.description,
            aiPrompt: selectedStudent.aiPrompt
          } : undefined,
          lessonHistory: selectedLessons,
          exerciseHistory: selectedStudent?.frequentErrors || [],
          chatHistory: [],
          teacherInstruction: finalPrompt,
          numSentences: aiCount,
          selectedWords: wordsArr,
          level: aiLevel
        });

        if (pipelineRes && pipelineRes.sentences && pipelineRes.sentences.length > 0) {
          setTranslationItems(pipelineRes.sentences);
        } else {
          setGenError('Nie udało się wygenerować zdań. Spróbuj zmienić parametry.');
        }
      } else {
        const result = await generateFindErrors(
          {
            source: {
              lessons: selectedLessons,
              pastedText: vocabularyTextToUse || finalTopic
            },
            types: ['find_errors'],
            perType: aiCount,
            level: selectedStudent?.level || aiLevel,
            instruction: finalPrompt,
            studentId: selectedStudentId !== 'all' ? selectedStudentId : undefined,
          },
          vocabularyTextToUse || finalTopic,
          finalPrompt
        );
        if (result && result.items && result.items.length > 0) {
          setErrorCorrectionItems(result.items);
        } else {
          setGenError("Nie udało się wygenerować zdań do poprawy błędów. Spróbuj zmienić parametry.");
        }
      }
    } catch (err: any) {
      console.error(err);
      setGenError(err.message || 'Błąd generowania z AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Add manual item
  const handleAddManualItem = () => {
    if (homeworkType === 'translation') {
      setTranslationItems([
        ...translationItems,
        { polishSentence: "", englishTranslation: "", hint: "" }
      ]);
    } else {
      setErrorCorrectionItems([
        ...errorCorrectionItems,
        { incorrectSentence: "", correctSentence: "", hint: "", polishHint: "", explanation: "" }
      ]);
    }
  };
  const handleBulkProcess = async () => {
    if (!bulkText.trim()) return;
    setIsBulkProcessing(true);
    try {
      const newItems = await processBulkSentences(bulkText);
      if (newItems && newItems.length > 0) {
        setTranslationItems([...translationItems, ...newItems]);
        setShowBulkAddModal(false);
        setBulkText("");
      } else {
        alert("Nie udało się wygenerować zadań. Sprawdź format tekstu.");
      }
    } catch (e: any) {
      alert("Wystąpił błąd podczas przetwarzania zdań.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const moveTranslationItem = (index: number, direction: 'up' | 'down') => {
    setTranslationItems((prev) => {
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const moveErrorCorrectionItem = (index: number, direction: 'up' | 'down') => {
    setErrorCorrectionItems((prev) => {
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  // Save/Assign Homework (Teacher)
  const handleSaveHomework = async () => {
    if (isSavingHomework || isSavingRef.current) return;
    if (!selectedStudentId) {
      alert('Wybierz kursanta, któremu chcesz przypisać pracę domową.');
      return;
    }

    const sentencesCount = homeworkType === 'translation' ? translationItems.length : errorCorrectionItems.length;
    if (sentencesCount === 0) {
      alert('Dodaj lub wygeneruj co najmniej jedno zdanie do pracy domowej.');
      return;
    }

    // Check that sentences are not empty
    if (homeworkType === 'translation') {
      const hasEmpty = translationItems.some(i => !i.polishSentence.trim() || !i.englishTranslation.trim());
      if (hasEmpty) {
        alert('Uzupełnij polskie zdania i angielskie tłumaczenia dla wszystkich elementów.');
        return;
      }
    } else {
      const hasEmpty = errorCorrectionItems.some(i => !i.incorrectSentence.trim() || !i.correctSentence.trim());
      if (hasEmpty) {
        alert("Uzupełnij zdanie z błędem oraz poprawną wersję dla wszystkich elementów.");
        return;
      }
    }

    try {
      isSavingRef.current = true;
      setIsSavingHomework(true);
      setIsLoading(true);
      const sentences = homeworkType === 'translation' ? translationItems : errorCorrectionItems;

      // If editing an existing task
      if (editingTask?.id) {
        const studentObj = students.find(s => s.id === selectedStudentId);
        const updatedData: Partial<SpecialTask> & Record<string, any> = {
          ...taskOwnerFields(selectedStudentId),
          studentName: studentObj 
            ? `${studentObj.firstName || ''} ${studentObj.lastName || ''}`.trim() || studentObj.username 
            : editingTask.studentName || 'Kursant',
          studentEmail: studentObj?.email || '',
          studentUsername: studentObj?.username || '',
          title: title.trim() || 'Praca domowa',
          type: homeworkType,
          instructions: instructions.trim(),
          dueDate,
          sentences: sentences
        };

        await updateDoc(doc(db, 'specialTasks', editingTask.id), updatedData);
        alert('Praca domowa została pomyślnie zaktualizowana!');
        setEditingTask(null);
        setTranslationItems([]);
        setErrorCorrectionItems([]);
        setTitle('');
        setInstructions('');
        if (!initialStudentId) setSelectedStudentId('');
        setActiveTab('list');
        await loadData();
        return;
      }

      // Target students for new homework
      const targetStudentIds = selectedStudentId === 'all' 
        ? students.map(s => s.id!).filter(Boolean)
        : [selectedStudentId];

      const nowIso = new Date().toISOString();
      let lastCreatedTask: any = null;
      let lastTargetStudent: User | null = null;

      for (const stId of targetStudentIds) {
        const studentObj = students.find(s => s.id === stId);
        const studentName = studentObj 
          ? `${studentObj.firstName || ''} ${studentObj.lastName || ''}`.trim() || studentObj.username 
          : 'Kursant';
        const taskData: Partial<SpecialTask> & Record<string, any> = {
          ...taskOwnerFields(stId),
          studentName: studentName,
          studentEmail: studentObj?.email || '',
          studentUsername: studentObj?.username || '',
          assignedBy: user?.username || user?.firstName || 'Nauczyciel',
          title: title.trim() || 'Praca domowa',
          type: homeworkType,
          instructions: instructions.trim(),
          createdAt: nowIso,
          dueDate,
          status: 'pending',
          sentences: sentences,
          manualEmailConfirmationRequired: true,
          skipAutoEmail: true,
          emailNotificationSent: false,
        };

        const docRef = await addDoc(collection(db, 'specialTasks'), taskData);
        try {
          await updateDoc(doc(db, 'users', stId), { hasNewHomework: true });
        } catch (uErr) {
          console.warn('Could not update hasNewHomework for user:', uErr);
        }

        lastCreatedTask = { id: docRef.id, ...taskData };
        lastTargetStudent = studentObj || null;
      }

      // Reset form
      setTranslationItems([]);
      setErrorCorrectionItems([]);
      setTitle('');
      setInstructions('');
      if (!initialStudentId) setSelectedStudentId('');
      setActiveTab('list');
      localStorage.removeItem('homework_draft');
      await loadData();

      if (lastCreatedTask && lastTargetStudent) {
        setCreatedTaskForEmail(lastCreatedTask);
        setStudentForEmail(lastTargetStudent);
        setIsEmailConfirmationModalOpen(true);
      } else {
        alert('Praca domowa została pomyślnie przypisana!');
      }
    } catch (err: any) {
      console.error(err);
      alert(`Błąd zapisywania pracy domowej: ${err.message}`);
    } finally {
      setIsSavingHomework(false);
      isSavingRef.current = false;
      setIsLoading(false);
    }
  };

  // Delete Homework (Teacher)
  const handleDeleteTask = (task: SpecialTask) => {
    setTaskToDelete(task);
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete?.id) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'specialTasks', taskToDelete.id));
      setTasks(prev => prev.filter(t => t.id !== taskToDelete.id));
      setTaskToDelete(null);
      if (previewTask?.id === taskToDelete.id) {
        setPreviewTask(null);
      }
      if (reviewTask?.id === taskToDelete.id) {
        setReviewTask(null);
      }
    } catch (e: any) {
      console.error('Error deleting homework task:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  // Student Start Task
  const handleStartTask = (task: SpecialTask) => {
    setActiveTask(task);
    setStudentAnswers({});
    setShowHints({});
    setSubmissionResult(null);
  };

  // Student Answer Change
  const handleAnswerChange = (index: number, val: string) => {
    setStudentAnswers(prev => ({ ...prev, [index]: val }));
  };

  // Toggle Hint for student
  const toggleHint = (index: number) => {
    setShowHints(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // Student Submit Task to Teacher
  const handleSubmitTask = async () => {
    if (!activeTask || !activeTask.id) return;

    const sentenceCount = activeTask.sentences.length;
    const answeredCount = Object.keys(studentAnswers).filter(k => {
      const val = studentAnswers[Number(k)];
      if (!val) return false;
      if (typeof val === 'string') return val.trim().length > 0;
      if (typeof val === 'object') return Object.keys(val).length > 0;
      return true;
    }).length;

    if (answeredCount < sentenceCount) {
      if (!confirm(`Wypełniłeś ${answeredCount} z ${sentenceCount} zdań. Czy na pewno chcesz wysłać pracę domową w takim stanie?`)) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const isTranslation = (activeTask.type || 'translation') === 'translation';
      const evalResults: any[] = [];
      let totalScore = 0;

      if (isTranslation) {
        // Evaluate translation exercises
        const exercises = activeTask.sentences.map((s: any) => ({
          polishSentence: s.polishSentence,
          englishTranslation: s.englishTranslation,
          hint: s.hint
        }));
        const answers = activeTask.sentences.map((_, idx) => {
          const raw = studentAnswers[idx];
          if (typeof raw === 'string') return raw;
          if (typeof raw === 'object' && raw !== null) return JSON.stringify(raw);
          return String(raw || '');
        });

        const evalArray = await evaluateTranslations(
          exercises,
          answers,
          user?.level || 'B1-B2',
          ''
        );

        if (evalArray && evalArray.length > 0) {
          evalArray.forEach((ev) => {
            evalResults.push(ev);
            const evScore = Number(ev.score);
            totalScore += isNaN(evScore) ? 0 : evScore;
          });
        } else {
          activeTask.sentences.forEach((item: any, i: number) => {
            const rawAns = studentAnswers[i];
            const stAns = typeof rawAns === 'string' ? rawAns : typeof rawAns === 'object' && rawAns !== null ? JSON.stringify(rawAns) : String(rawAns || '');
            evalResults.push({
              polishSentence: item.polishSentence,
              correctTranslation: item.englishTranslation,
              studentAnswer: stAns,
              isCorrect: Boolean(stAns.trim()),
              score: stAns.trim() ? 80 : 0,
              explanation: 'Odpowiedź przesłana do nauczyciela.'
            });
            totalScore += stAns.trim() ? 80 : 0;
          });
        }
      } else {
        // Evaluate error correction exercises
        for (let i = 0; i < activeTask.sentences.length; i++) {
          const item = activeTask.sentences[i];
          const rawAns = studentAnswers[i];
          const stAns = typeof rawAns === 'string' ? rawAns : typeof rawAns === 'object' && rawAns !== null ? JSON.stringify(rawAns) : String(rawAns || '');
          const res = await evaluateErrorCorrectionSentence(
            item.incorrectSentence,
            item.correctSentence,
            stAns
          );
          evalResults.push({
            incorrectSentence: item.incorrectSentence,
            correctSentence: item.correctSentence,
            studentAnswer: stAns,
            isCorrect: res.isCorrect,
            score: res.score,
            explanation: res.explanation,
            suggestedVersion: res.suggestedVersion
          });
          const resScore = Number(res.score);
          totalScore += isNaN(resScore) ? 0 : resScore;
        }
      }

      const calcAvg = totalScore / (activeTask.sentences.length || 1);
      const avgScore = isNaN(calcAvg) ? 0 : Math.round(calcAvg);

      // Update in Firestore
      await updateDoc(doc(db, 'specialTasks', activeTask.id), {
        status: 'submitted',
        studentAnswers: studentAnswers,
        evaluationResults: evalResults,
        submittedAt: new Date().toISOString()
      });

      // Log practice log for statistics & update streak
      try {
        const sentencesCount = activeTask.sentences ? activeTask.sentences.length : 1;
        await addDoc(collection(db, `users/${user?.id}/practiceLogs`), {
          exerciseType: 'homework',
          exerciseFormat: activeTask.type || 'homework',
          date: new Date().toISOString(),
          isRevisionMode: false,
          score: avgScore,
          totalWords: sentencesCount,
          setDisplayName: activeTask.title || 'Praca domowa',
          exercisesData: evalResults
        });

        if (user?.id) {
          const currentCount = user.translatedSentencesCount || 0;
          updateDoc(doc(db, 'users', user.id), {
            translatedSentencesCount: currentCount + sentencesCount
          }).catch(console.error);
        }
      } catch (e) {
        console.warn('Could not save homework practice log:', e);
      }

      if (updateUserStreak) {
        updateUserStreak().catch(console.error);
      }

      setSubmissionResult({
        score: avgScore,
        results: evalResults
      });

      await loadData();
    } catch (e: any) {
      console.error('Error submitting homework:', e);
      alert('Wystąpił błąd podczas przesyłania pracy domowej.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzeWithAI = async () => {
    if (!reviewTask || !reviewTask.id) return;
    setIsAnalyzing(true);
    try {
      const results = await evaluateTeacherHomework(
        (reviewTask.type === 'find_errors' ? 'find_errors' : reviewTask.type === 'fill_in_the_blank' ? 'fill_in_the_blank' : 'translation'),
        reviewTask.sentences,
        reviewTask.studentAnswers || {},
        teacherFeedbackText
      );
      
      let totalScore = 0;
      results.forEach((res: any) => {
        const scoreNum = Number(res.score);
        totalScore += isNaN(scoreNum) ? 0 : scoreNum;
      });
      const avgScore = results.length > 0 ? Math.round(totalScore / results.length) : 0;

      // Jeśli AI przygotowało elokwentne, motywujące podsumowanie pracy, wypełnij pole
      if (results?.suggestedTeacherFeedback) {
        if (!teacherFeedbackText.trim() || teacherFeedbackText.trim().length < 15) {
          setTeacherFeedbackText(results.suggestedTeacherFeedback);
        }
      }

      const updatedData = {
        evaluationResults: results,
        grade: avgScore
      };

      await updateDoc(doc(db, 'specialTasks', reviewTask.id), updatedData);
      
      setReviewTask({
        ...reviewTask,
        evaluationResults: results,
        grade: avgScore
      });

      alert('Zadanie przeanalizowane z uwzględnieniem Twoich wytycznych! Przygotowano rzetelne i motywujące uwagi.');
    } catch (e: any) {
      console.error('Error analyzing homework:', e);
      alert('Wystąpił błąd podczas analizy AI.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Teacher Save Review & Grade
  const handleSaveReview = async () => {
    if (!reviewTask || !reviewTask.id) return;
    setIsSavingReview(true);
    try {
      const nowIso = new Date().toISOString();
      await updateDoc(doc(db, 'specialTasks', reviewTask.id), {
        status: 'graded',
        teacherFeedback: teacherFeedbackText,
        reviewedAt: nowIso,
        feedbackReadByStudent: false,
        teacherRead: true,
      });

      // Powiadomienie dla kursanta o sprawdzeniu pracy i komentarzu lektora
      const targetStudentUid = reviewTask.studentUid || reviewTask.studentId;
      if (targetStudentUid) {
        try {
          await updateDoc(doc(db, 'users', targetStudentUid), {
            hasGradedHomework: true,
            lastGradedHomeworkId: reviewTask.id,
            lastGradedHomeworkTitle: reviewTask.title || 'Praca domowa',
            lastGradedFeedback: teacherFeedbackText || '',
            lastGradedScore: reviewTask.grade ?? null,
          });
        } catch (uErr) {
          console.warn('Nie udało się zapisać powiadomienia o ocenie u kursanta:', uErr);
        }
      }

      alert('Ocena i komentarz zostały zapisane! Kursant otrzyma powiadomienie.');
      setReviewTask(null);
      await loadData();
    } catch (e: any) {
      console.error(e);
      alert('Błąd podczas zapisywania oceny.');
    } finally {
      setIsSavingReview(false);
    }
  };

  // Oznaczanie pracy domowej jako zrobionej / odczytanej
  const [markingTaskId, setMarkingTaskId] = useState<string | null>(null);

  const handleMarkAsDone = async (task: SpecialTask) => {
    if (!task.id) return;
    setMarkingTaskId(task.id);
    try {
      const nowIso = new Date().toISOString();
      await updateDoc(doc(db, 'specialTasks', task.id), {
        status: 'graded',
        teacherRead: true,
        reviewedAt: nowIso,
      });

      setTasks(prev => prev.map(t => t.id === task.id ? {
        ...t,
        status: 'graded',
        teacherRead: true,
        reviewedAt: nowIso
      } : t));

      if (previewTask?.id === task.id) {
        setPreviewTask(prev => prev ? {
          ...prev,
          status: 'graded',
          teacherRead: true,
          reviewedAt: nowIso
        } : null);
      }
    } catch (err: any) {
      console.error('Błąd oznaczania pracy jako sprawdzonej:', err);
      alert('Nie udało się oznaczyć pracy: ' + (err?.message || err));
    } finally {
      setMarkingTaskId(null);
    }
  };

  // Przywracanie pracy z archiwum do oczekujących
  const handleUnmarkDone = async (task: SpecialTask) => {
    if (!task.id) return;
    setMarkingTaskId(task.id);
    try {
      await updateDoc(doc(db, 'specialTasks', task.id), {
        status: 'submitted',
        teacherRead: false,
      });

      setTasks(prev => prev.map(t => t.id === task.id ? {
        ...t,
        status: 'submitted',
        teacherRead: false
      } : t));

      if (previewTask?.id === task.id) {
        setPreviewTask(prev => prev ? {
          ...prev,
          status: 'submitted',
          teacherRead: false
        } : null);
      }
    } catch (err: any) {
      console.error('Błąd przywracania pracy do odesłanych:', err);
      alert('Nie udało się przywrócić pracy: ' + (err?.message || err));
    } finally {
      setMarkingTaskId(null);
    }
  };

  const [viewedTaskIds, setViewedTaskIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('teacher_seen_homework_ids');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markTaskAsViewedByTeacher = (task: SpecialTask) => {
    if (!task.id) return;
    setViewedTaskIds((prev) => {
      const next = new Set(prev);
      next.add(task.id!);
      try {
        localStorage.setItem('teacher_seen_homework_ids', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    if (!task.teacherViewedAt) {
      const nowIso = new Date().toISOString();
      updateDoc(doc(db, 'specialTasks', task.id), {
        teacherViewedAt: nowIso,
      }).catch(console.warn);

      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, teacherViewedAt: nowIso } : t))
      );
    }
  };

  const isTaskNewForTeacher = (task: SpecialTask): boolean => {
    if (!task.id || task.status !== 'submitted') return false;
    if (task.teacherRead || task.teacherViewedAt) return false;
    return !viewedTaskIds.has(task.id);
  };

  const [markingTestId, setMarkingTestId] = useState<string | null>(null);

  const handleMarkTestAsRead = async (test: StudentTest) => {
    if (!test.id || !test.studentId) return;
    setMarkingTestId(test.id);
    try {
      await updateDoc(doc(db, `users/${test.studentId}/tests`, test.id), {
        teacherRead: true,
      });

      setStudentTests(prev => prev.map(t => t.id === test.id ? { ...t, teacherRead: true } : t));
    } catch (err: any) {
      console.error('Błąd oznaczania testu jako odczytanego:', err);
    } finally {
      setMarkingTestId(null);
    }
  };

  const handleOpenPreviewTest = async (test: StudentTest) => {
    setPreviewTest(test);
    if (test.teacherRead === false && test.studentId && test.id) {
      try {
        await updateDoc(doc(db, `users/${test.studentId}/tests`, test.id), {
          teacherRead: true,
        });
        setStudentTests((prev) =>
          prev.map((t) => (t.id === test.id ? { ...t, teacherRead: true } : t))
        );
      } catch (err) {
        console.warn('Nie udało się oznaczyć testu jako odczytanego przy podglądzie:', err);
      }
    }
  };

  // Filtered tasks for Teacher - base filter by student
  const teacherStudentTasks = React.useMemo(() => {
    return tasks.filter(t => {
      if (filterStudentId !== 'all') {
        const targetStudent = students.find(s => s.id === filterStudentId);
        if (targetStudent) {
          if (!isTaskForStudent(t, targetStudent)) return false;
        } else if (t.studentId !== filterStudentId) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, students, filterStudentId]);

  // Aktywne zadania (czekające na kursanta lub odesłane czekające na sprawdzenie)
  const activeTasks = React.useMemo(() => {
    return teacherStudentTasks.filter(t => {
      if (filterStatus === 'submitted') {
        return t.status === 'submitted' && t.teacherRead !== true;
      }
      if (filterStatus === 'pending') {
        return t.status === 'pending';
      }
      if (filterStatus === 'graded') {
        return false;
      }
      // 'all'
      return t.status === 'pending' || (t.status === 'submitted' && t.teacherRead !== true);
    });
  }, [teacherStudentTasks, filterStatus]);

  // Archiwum zadań sprawdzonych / odznaczonych
  const archivedTasks = React.useMemo(() => {
    return teacherStudentTasks.filter(t => {
      return t.status === 'graded' || t.status === 'completed' || t.teacherRead === true;
    }).sort((a, b) => {
      const timeA = getTaskDateMillis(a.reviewedAt || a.submittedAt || a.createdAt);
      const timeB = getTaskDateMillis(b.reviewedAt || b.submittedAt || b.createdAt);
      return timeB - timeA;
    });
  }, [teacherStudentTasks]);

  const filteredTasks = activeTasks;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <BookOpen className="text-primary" size={28} />
            {isTeacher ? 'Zarządzanie Pracami Domowymi' : 'Moje Prace Domowe'}
          </h1>
          <p className="text-sm text-content-muted mt-1">
            {isTeacher
              ? 'Twórz, przypisuj i sprawdzaj prace domowe z tłumaczeń oraz korekty błędów dla swoich kursantów.'
              : 'Rozwiązuj przydzielone zadania od nauczyciela, doskonal język i wysyłaj odpowiedzi do oceny.'}
          </p>
        </div>

        {!isTeacher && onBack && (
          <div>
            <Button variant="secondary" size="sm" onClick={onBack} className="text-xs">
              ← Wróć do pulpitu
            </Button>
          </div>
        )}

        {isTeacher && (
          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (editingTask) {
                  setEditingTask(null);
                }
                setActiveTab('list');
              }}
              variant={activeTab === 'list' ? 'primary' : 'secondary'}
              className="flex items-center gap-2 text-sm"
            >
              <FileText size={16} />
              Lista prac ({tasks.length})
            </Button>
            <Button
              onClick={() => {
                if (!editingTask) {
                  setActiveTab('create');
                }
              }}
              variant={activeTab === 'create' ? 'primary' : 'secondary'}
              className="flex items-center gap-2 text-sm"
            >
              {editingTask ? (
                <>
                  <Edit3 size={16} className="text-warn" />
                  Edycja pracy
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Przypisz pracę domową
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Main Content Areas */}

      {/* ---------------- STUDENT EXERCISE WORKSPACE ---------------- */}
      {activeTask ? (
        <Card className="liquid-glass border-primary/30 p-6 space-y-6">
          <div className="flex justify-between items-start border-b border-white/10 pb-4">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/20 text-primary font-bold">
                {activeTask.type === 'find_errors' ? 'Poprawianie błędów w zdaniach' : activeTask.type === 'fill_in_the_blank' ? 'Uzupełnij luki' : 'Tłumaczenie zdań'}
              </span>
              <h2 className="text-xl font-bold text-white mt-2">{activeTask.title}</h2>
              {activeTask.instructions && (
                <p className="text-sm text-content mt-1">{activeTask.instructions}</p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const msg = language === 'pl' 
                  ? 'Czy na pewno chcesz zakończyć to zadanie i wrócić do głównego panelu zadań? Twój niezapisany postęp zostanie utracony.' 
                  : 'Are you sure you want to end this task and return to the main homework panel? Your unsaved progress will be lost.';
                if (window.confirm(msg)) {
                  setActiveTask(null);
                }
              }}
              className="flex items-center gap-1 text-xs"
            >
              <X size={16} /> Zamknij
            </Button>
          </div>

          {/* Submission Result Screen */}
          {submissionResult ? (
            <div className="space-y-6 text-center py-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 text-primary flex items-center justify-center border border-primary/40 animate-bounce">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-white">Praca domowa przesłana do nauczyciela!</h3>
              <p className="text-sm text-content-muted max-w-lg mx-auto">
                Twoje odpowiedzi zostały zapisane i przekazane do nauczyciela. Otrzymałeś szacunkowy wynik: <span className="font-bold text-primary">{Number.isNaN(Number(submissionResult.score)) ? 0 : submissionResult.score}%</span>.
              </p>

              {/* Breakdown */}
              <div className="text-left space-y-4 max-w-3xl mx-auto pt-4">
                <h4 className="font-bold text-white border-b border-white/10 pb-2">Podsumowanie odpowiedzi:</h4>
                {submissionResult.results.map((res: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-xl bg-base-200/60 border border-white/5 space-y-2">
                    <div className="flex justify-between items-center text-xs text-content-muted">
                      <span>Zdanie #{idx + 1}</span>
                      <span className={res.isCorrect ? 'text-primary font-bold' : 'text-warn font-bold'}>
                        {res.score !== undefined ? `${res.score}%` : (res.isCorrect ? 'Poprawne' : 'Do poprawy')}
                      </span>
                    </div>
                    {activeTask.type === 'find_errors' || activeTask.type === 'fill_in_the_blank' ? (
                      <>
                        <p className="text-sm text-danger">Błędne zdanie: {res.incorrectSentence}</p>
                        <div className="text-sm text-content">Twoja odpowiedź: {renderStudentAnswerDisplay(res.studentAnswer)}</div>
                        <p className="text-sm text-primary">Poprawna wersja: {res.correctSentence}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-content">Zdanie PL: {res.polishSentence}</p>
                        <div className="text-sm text-content">Twoja odpowiedź: {renderStudentAnswerDisplay(res.studentAnswer)}</div>
                        <p className="text-sm text-primary">Wzorcowe tłumaczenie: {res.correctTranslation}</p>
                      </>
                    )}
                    {res.explanation && (
                      <p className="text-xs text-content-muted italic bg-base-300/50 p-2 rounded-lg">
                        💡 {res.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <Button onClick={() => setActiveTask(null)} className="mx-auto">
                Powrót do prac domowych
              </Button>
            </div>
          ) : (
            /* Active Homework Form for Student */
            <div className="space-y-6">
              {activeTask.sentences.map((item: any, idx: number) => {
                const isTranslation = (activeTask.type || 'translation') === 'translation';
                const isFindErrors = activeTask.type === 'find_errors';

                if (isFindErrors) {
                  const incorrect = String(item.incorrectSentence || '').trim();
                  const currentValue = typeof studentAnswers[idx] === 'string' ? studentAnswers[idx] : '';
                  return (
                    <div key={idx} className="p-5 rounded-2xl bg-base-200/60 border border-white/10 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
                          <AlertTriangle size={13} className="shrink-0 text-amber-400" />
                          Zdanie {idx + 1} z {activeTask.sentences.length}: Znajdź i popraw błąd
                        </span>
                        {item.hint && (
                          <button
                            type="button"
                            onClick={() => toggleHint(idx)}
                            className="text-xs text-warn hover:underline flex items-center gap-1"
                          >
                            <HelpCircle size={14} />
                            {showHints[idx] ? 'Ukryj wskazówkę' : 'Wskazówka'}
                          </button>
                        )}
                      </div>

                      <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2 shadow-sm">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400/90 font-bold block">
                          Zdanie z błędem do korekty:
                        </span>
                        <p className="text-lg font-bold text-white leading-snug">
                          {incorrect}
                        </p>
                        {item.polishHint && (
                          <p className="text-xs text-content-muted pt-2 border-t border-white/5 flex items-center gap-1.5">
                            <span className="font-semibold text-content">Znaczenie:</span>
                            <span className="italic">{item.polishHint}</span>
                          </p>
                        )}
                      </div>

                      {showHints[idx] && item.hint && (
                        <div className="p-2.5 rounded-lg bg-warn/10 border border-warn/20 text-xs text-warn">
                          💡 <strong>Wskazówka:</strong> {item.hint}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-semibold text-content-muted">
                            Twoja poprawiona wersja zdania:
                          </label>
                          {incorrect && currentValue !== incorrect && (
                            <button
                              type="button"
                              onClick={() => handleAnswerChange(idx, incorrect)}
                              className="inline-flex items-center gap-1 text-[11px] text-primary/90 hover:text-primary font-bold transition-colors cursor-pointer"
                              title="Wstaw zdanie z błędem, aby szybko zmienić tylko niepoprawne słowo"
                            >
                              Kopiuj zdanie do edycji
                            </button>
                          )}
                        </div>
                        <textarea
                          rows={2}
                          value={currentValue}
                          onChange={(e) => handleAnswerChange(idx, e.target.value)}
                          placeholder="Wpisz w pełni poprawione zdanie po angielsku..."
                          className="w-full px-4 py-2.5 bg-base-100 text-white border border-white/10 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm transition-all resize-y"
                        />
                      </div>
                    </div>
                  );
                }
                
                if (!isTranslation) {
                  return (
                    <div key={idx} className="p-5 rounded-2xl bg-base-200/60 border border-white/10 space-y-3">
                      <FillInTheBlankTask 
                        textWithBlanks={item.textWithBlanks} 
                        availableWords={item.availableWords} 
                        studentAnswers={(studentAnswers[idx] as any) || {}} 
                        onAnswerChange={(blanks) => handleAnswerChange(idx, blanks as any)} 
                      />
                    </div>
                  );
                }

                return (
                  <div key={idx} className="p-5 rounded-2xl bg-base-200/60 border border-white/10 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono font-bold text-primary">
                        Zdanie {idx + 1} z {activeTask.sentences.length}
                      </span>
                      {item.hint && (
                        <button
                          type="button"
                          onClick={() => toggleHint(idx)}
                          className="text-xs text-warn hover:underline flex items-center gap-1"
                        >
                          <HelpCircle size={14} />
                          {showHints[idx] ? 'Ukryj wskazówkę' : 'Pokaż wskazówkę'}
                        </button>
                      )}
                    </div>
                    {/* Sentence Display */}
                    <div className="p-3 rounded-xl bg-base-300/80 text-white font-medium text-base border border-white/5">
                      {item.polishSentence}
                    </div>

                    {/* Hint display */}
                    {showHints[idx] && item.hint && (
                      <div className="p-2.5 rounded-lg bg-warn/10 border border-warn/20 text-xs text-warn">
                        💡 <strong>Wskazówka:</strong> {item.hint}
                      </div>
                    )}

                    {/* Student Answer Input */}
                    <div>
                      <label className="block text-xs font-semibold text-content-muted mb-1">
                        Wpisz tłumaczenie na angielski:
                      </label>
                      <textarea
                        rows={2}
                        value={(studentAnswers[idx] as any) || ''}
                        onChange={(e) => handleAnswerChange(idx, e.target.value)}
                        placeholder="Type English translation here..."
                        className="w-full px-4 py-2.5 bg-base-100 text-white border border-white/10 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm transition-all resize-y"
                      />
                    </div>
                  </div>
                );
              })}

              {/* Submit Button */}
              <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setActiveTask(null)}>
                  Anuluj
                </Button>
                <Button
                  onClick={handleSubmitTask}
                  isLoading={isSubmitting}
                  className="flex items-center gap-2"
                >
                  <Send size={18} />
                  Zaakceptuj i wyślij do nauczyciela
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {/* ---------------- TEACHER CREATE / EDIT HOMEWORK WORKSPACE ---------------- */}
      {/* Nowe zadanie układa kreator: kursant, materiał, typy ćwiczeń, termin.
          Stary formularz zostaje wyłącznie do edycji już przypisanej pracy —
          tam liczy się dostęp do konkretnych zdań, a nie szybkość składania. */}
      {isTeacher && activeTab === 'create' && !activeTask && !editingTask && (
        // Przełącznik silnika. Przy wyłączonej fladze wchodzi kreator v1 —
        // bit w bit ten sam, co przed wprowadzeniem v2. Rollback to jedna
        // wartość w config/featureFlags.ts, bez migracji danych.
        HOMEWORK_ENGINE_V2 ? (
          <HomeworkComposerV2
            initialStudentId={initialStudentId || undefined}
            onAssigned={() => setActiveTab('list')}
          />
        ) : (
          <HomeworkComposer
            initialStudentId={initialStudentId || undefined}
            onAssigned={() => setActiveTab('list')}
          />
        )
      )}

      {isTeacher && activeTab === 'create' && !activeTask && editingTask && (
        <Card className="liquid-glass p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {editingTask ? (
                <>
                  <Edit3 className="text-primary" size={22} />
                  Edycja Pracy Domowej
                </>
              ) : (
                <>
                  <Plus className="text-primary" size={22} />
                  Kreator Nowej Pracy Domowej
                </>
              )}
            </h2>
            {editingTask && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancelEdit}
                className="text-xs flex items-center gap-1.5 self-start sm:self-auto text-warn hover:opacity-80 border-warn/30"
              >
                <X size={14} /> Anuluj edycję i wróć do listy
              </Button>
            )}
          </div>

          {/* Edit Mode Alert Banner */}
          {editingTask && (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 flex flex-wrap items-center justify-between gap-3 shadow-[0_0_20px_rgba(114,240,180,0.15)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20 text-primary">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    Edytujesz pracę: <span className="text-primary">{editingTask.title || 'Praca domowa'}</span>
                  </h4>
                  <p className="text-xs text-content-muted">
                    Przypisana do: <strong className="text-white">{editingTask.studentName || editingTask.studentId}</strong> | Możesz modyfikować treść zdań, wytyczne, termin oraz kursanta.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 1. HIGHLIGHTED STEP 1: Wybierz kursanta */}
          <div className={`p-5 rounded-2xl border-2 transition-all space-y-4 ${
            selectedStudentId 
              ? 'bg-primary/10 border-primary shadow-[0_0_25px_rgba(114,240,180,0.25)]' 
              : 'bg-warn/10 border-warn animate-pulse shadow-[0_0_20px_rgba(224, 168, 58,0.25)]'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${selectedStudentId ? 'bg-primary text-base-100' : 'bg-warn text-base-100'}`}>
                  <UserCheck size={22} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    1. Wybierz kursanta <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-bold">KROK NAJWAŻNIEJSZY</span>
                  </h3>
                  <p className="text-xs text-content-muted">
                    Wskazanie kursanta automatycznie wczyta jego poziom językowy oraz historię lekcji i słownictwa.
                  </p>
                </div>
              </div>

              {/* Selected Student Badge / Summary */}
              {selectedStudentId && selectedStudentId !== 'all' && (() => {
                const selectedStudent = students.find(s => s.id === selectedStudentId);
                return (
                  <div className="flex items-center gap-3 bg-ink/72 border border-primary/40 px-3.5 py-1.5 rounded-xl text-xs">
                    <span className="text-white font-bold flex items-center gap-1.5">
                      👤 {selectedStudent?.firstName ? `${selectedStudent.firstName} ${selectedStudent.lastName || ''}` : selectedStudent?.username}
                    </span>
                    <span className="px-2 py-0.5 bg-primary/20 text-primary font-mono font-bold rounded-md">
                      🎯 Poziom: {selectedStudent?.level || 'B1-B2'}
                    </span>
                    <span className="text-content">
                      📚 Lekcje: <strong className="text-white">{studentLessons.length}</strong>
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-content mb-1.5">
                  Kursant docelowy <span className="text-danger">*</span>
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-4 py-3 bg-base-100 text-white border-2 border-white/20 rounded-xl focus:border-primary focus:outline-none text-sm font-semibold shadow-inner"
                >
                  <option value="">-- Wybierz kursanta z listy (Wymagane) --</option>
                  <option value="all">🌐 Wszyscy kursanci ({students.length})</option>
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      👤 {st.firstName ? `${st.firstName} ${st.lastName || ''}` : st.username} {st.level ? `[Poziom: ${st.level}]` : ''} ({st.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-content mb-1.5">
                  Termin oddania pracy domowej (opcjonalnie)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-base-100 text-white border border-white/10 rounded-xl focus:border-primary focus:outline-none text-sm"
                />
              </div>
            </div>

            {!selectedStudentId && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-warn/20 border border-warn/40 text-warn text-xs font-semibold">
                <Sparkles size={16} className="text-warn shrink-0" />
                <span>Najpierw wybierz kursanta z listy powyżej, aby automatycznie załadować jego poziom i historię lekcji!</span>
              </div>
            )}
          </div>

          {/* 2. Wybór typu pracy domowej */}
          <div>
            <label className="block text-sm font-bold text-content mb-2">
              2. Wybierz typ pracy domowej <span className="text-danger">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleHomeworkTypeChange('translation')}
                className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  homeworkType === 'translation'
                    ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(114,240,180,0.15)]'
                    : 'bg-base-200/60 border-white/5 hover:border-white/20'
                }`}
              >
                <div className={`p-2 rounded-lg ${homeworkType === 'translation' ? 'bg-primary text-base-100' : 'bg-base-300 text-text-2'}`}>
                  <BookOpen size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">1. Tłumaczenie zdań</h4>
                  <p className="text-xs text-content-muted mt-1">
                    Nauczyciel ustala zdania po polsku do przetłumaczenia na angielski przez ucznia.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleHomeworkTypeChange('find_errors')}
                className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  homeworkType === 'find_errors'
                    ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(114,240,180,0.15)]'
                    : 'bg-base-200/60 border-white/5 hover:border-white/20'
                }`}
              >
                <div className={`p-2 rounded-lg ${homeworkType === 'find_errors' ? 'bg-primary text-base-100' : 'bg-base-300 text-text-2'}`}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">2. Poprawianie błędów w zdaniach</h4>
                  <p className="text-xs text-content-muted mt-1">
                    Zestaw zdań z celowymi błędami przygotowanymi przez AI na bazie lekcji. Zadaniem ucznia jest wpisanie pełnej poprawnej wersji ze wskazówką.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* 3. Tytuł i instrukcje */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-content-muted mb-1">Tytuł pracy domowej</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="np. Tłumaczenie zdań - Past Simple"
                className="w-full px-4 py-2 bg-base-100 text-white border border-white/10 rounded-xl focus:border-primary focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-content-muted mb-1">Instrukcje dla kursanta</label>
              <input
                type="text"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Instrukcje widoczne dla kursanta..."
                className="w-full px-4 py-2 bg-base-100 text-white border border-white/10 rounded-xl focus:border-primary focus:outline-none text-sm"
              />
            </div>
          </div>

          {/* 4. AI Generator Box */}
          <div className="p-5 rounded-2xl bg-primary/10 border border-primary/30 space-y-4 shadow-[0_0_20px_rgba(114,240,180,0.1)]">
            <div className="flex items-center justify-between border-b border-primary/20 pb-3">
              <div className="flex items-center gap-2 text-primary font-bold text-base">
                <Sparkles size={20} />
                Generator Zadań AI (Dopasowany do kursanta)
              </div>
              {selectedStudentId && selectedStudentId !== 'all' && (
                <span className="text-xs bg-primary/20 text-primary border border-primary/30 px-2.5 py-1 rounded-full font-semibold">
                  Profil: {students.find(s => s.id === selectedStudentId)?.firstName || 'Wybrany kursant'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Poziom (Automatycznie wybrany) */}
              <div>
                <label className="block text-xs font-bold text-content mb-1 flex items-center justify-between">
                  <span>Poziom językowy</span>
                  {selectedStudentId && students.find(s => s.id === selectedStudentId)?.level && (
                    <span className="text-[10px] text-primary font-semibold">
                      (Dobrany z profilu: {students.find(s => s.id === selectedStudentId)?.level})
                    </span>
                  )}
                </label>
                <select
                  value={aiLevel}
                  onChange={(e) => setAiLevel(e.target.value)}
                  className="w-full px-3.5 py-2 bg-base-100 text-white border border-white/10 rounded-xl text-xs font-semibold focus:border-primary focus:outline-none"
                >
                  <option value="A1">A1 - Początkujący</option>
                  <option value="A2">A2 - Podstawowy</option>
                  <option value="B1">B1 - Średniozaawansowany niższy</option>
                  <option value="B1-B2">B1-B2 - Średniozaawansowany</option>
                  <option value="B2">B2 - Wyższy średniozaawansowany</option>
                  <option value="C1">C1 - Zaawansowany</option>
                  <option value="C2">C2 - Biegły</option>
                </select>
              </div>

              {/* Wybór lekcji kursanta do analizy AI */}
              <div>
                <label className="block text-xs font-bold text-content mb-1">
                  Wybór lekcji kursanta do analizy AI
                </label>
                <button
                  type="button"
                  onClick={() => setIsLessonModalOpen(true)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-all ${
                    selectedLessonIds.length > 0
                      ? 'bg-primary/10 border-primary/40 text-primary hover:bg-primary/15 shadow-[0_0_12px_rgba(114,240,180,0.1)]'
                      : 'bg-base-100 border-white/10 text-content hover:border-white/20 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <BookOpen className="w-4 h-4 shrink-0 text-primary" />
                    <span className="truncate">
                      {selectedLessonIds.length === 0
                        ? 'Brak wybranych lekcji (Generowanie z własnego opisu / zdania manualne)'
                        : `Lekcje do analizy AI: Wybrano ${selectedLessonIds.length} z ${studentLessons.length} lekcji`}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg shrink-0 text-white">
                    {selectedLessonIds.length === 0 ? 'Wybierz lekcje ↗' : 'Zmień ↗'}
                  </span>
                </button>
                {selectedLessonIds.length > 0 && (
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-text-2 px-1">
                    <span>AI przeanalizuje słownictwo i wpisy z {selectedLessonIds.length} lekcji.</span>
                    <button
                      type="button"
                      onClick={() => setSelectedLessonIds([])}
                      className="text-danger hover:underline font-medium"
                    >
                      Wyczyść wybór
                    </button>
                  </div>
                )}
              </div>

              {/* Temat (Manualnie) */}
              <div>
                <label className="block text-xs font-bold text-content mb-1">
                  Temat / Słownictwo docelowe (wpisywane manualnie)
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="np. Podróże i hotel, Present Perfect, Służba zdrowia..."
                  className="w-full px-3.5 py-2 bg-base-100 text-white border border-white/10 rounded-xl text-xs focus:border-primary focus:outline-none"
                />
              </div>

              {/* Liczba zadań (Manualnie) */}
              <div>
                <label className="block text-xs font-bold text-content mb-1">
                  Liczba zdań w zadaniu (manualnie)
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={aiCount}
                  onChange={(e) => setAiCount(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-base-100 text-white border border-white/10 rounded-xl text-xs focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Wskazówki dla AI (tworzy nauczyciel) */}
            <div>
              <label className="block text-xs font-bold text-content mb-1">
                Wskazówki dla AI (tworzy nauczyciel)
              </label>
              <textarea
                rows={2}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="np. Użyj słownictwa biznesowego, skup się na zdaniach pytających i konstrukcji 'used to'..."
                className="w-full px-3.5 py-2 bg-base-100 text-white border border-white/10 rounded-xl text-xs focus:border-primary focus:outline-none resize-none"
              />
            </div>

            {genError && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-xs text-danger font-semibold">
                ⚠️ {genError}
              </div>
            )}

            <Button
              onClick={handleGenerateWithAI}
              isLoading={isGenerating}
              size="md"
              className="flex items-center gap-2 w-full justify-center shadow-lg"
            >
              <Sparkles size={18} />
              Wygeneruj zestaw zdań z AI
            </Button>
          </div>

          {/* 5. Lista i Edytor zadań */}
          <div className="space-y-4 pt-2">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white text-base">
                Zdania w pracy domowej ({homeworkType === 'translation' ? translationItems.length : errorCorrectionItems.length})
              </h3>
              <div className="flex gap-2">
                {homeworkType === "translation" && (
                  <Button size="sm" variant="secondary" onClick={() => setShowBulkAddModal(true)} className="flex items-center gap-1 text-xs">
                    <FileText size={14} /> Wklej własne zdania
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={handleAddManualItem} className="flex items-center gap-1 text-xs">
                  <Plus size={14} /> Dodaj pojedynczo
                </Button>
              </div>

            </div>

            {/* Type 1: Translation Editor */}
            {homeworkType === 'translation' && (
              <div className="space-y-3">
                {translationItems.length === 0 ? (
                  <p className="text-xs text-content-muted italic py-4 text-center border border-dashed border-white/10 rounded-xl">
                    Brak zdań. Wygeneruj je przyciskiem AI lub dodaj ręcznie.
                  </p>
                ) : (
                  translationItems.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-base-200/60 border border-white/5 space-y-2 relative">
                      <div className="flex justify-between items-center text-xs font-mono font-bold text-primary mb-1">
                        <span>Zdanie #{idx + 1}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveTranslationItem(idx, 'up')}
                            disabled={idx === 0}
                            title="Przesuń zdanie w górę"
                            className="p-1 rounded text-content-muted hover:text-white disabled:opacity-20 transition-colors"
                          >
                            <ChevronUp size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveTranslationItem(idx, 'down')}
                            disabled={idx === translationItems.length - 1}
                            title="Przesuń zdanie w dół"
                            className="p-1 rounded text-content-muted hover:text-white disabled:opacity-20 transition-colors"
                          >
                            <ChevronDown size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTranslationItems(prev => prev.filter((_, i) => i !== idx))}
                            className="text-danger hover:opacity-80 p-1"
                            title="Usuń zadanie"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-content-muted mb-1">Zdanie po polsku</label>
                          <input
                            type="text"
                            value={item.polishSentence}
                            onChange={(e) => {
                              const updated = [...translationItems];
                              updated[idx].polishSentence = e.target.value;
                              setTranslationItems(updated);
                            }}
                            placeholder="np. On lubi czytać książki wieczorem."
                            className="w-full px-3 py-1.5 bg-base-100 text-white border border-white/10 rounded-lg text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-content-muted mb-1">Wzorcowe tłumaczenie po angielsku</label>
                          <input
                            type="text"
                            value={item.englishTranslation}
                            onChange={(e) => {
                              const updated = [...translationItems];
                              updated[idx].englishTranslation = e.target.value;
                              setTranslationItems(updated);
                            }}
                            placeholder="np. He likes reading books in the evening."
                            className="w-full px-3 py-1.5 bg-base-100 text-white border border-white/10 rounded-lg text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-content-muted mb-1">Wskazówka (opcjonalnie)</label>
                        <input
                          type="text"
                          value={item.hint || ''}
                          onChange={(e) => {
                            const updated = [...translationItems];
                            updated[idx].hint = e.target.value;
                            setTranslationItems(updated);
                          }}
                          placeholder="np. Zwróć uwagę na czasownik po 'like'..."
                          className="w-full px-3 py-1.5 bg-base-100 text-white border border-white/10 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Type 2: Error Correction Editor */}
            {homeworkType === 'find_errors' && (
              <div className="space-y-3">
                {errorCorrectionItems.length === 0 ? (
                  <p className="text-xs text-content-muted italic py-4 text-center border border-dashed border-white/10 rounded-xl">
                    Brak zdań. Wygeneruj je przyciskiem AI powyżej lub dodaj ręcznie.
                  </p>
                ) : (
                  errorCorrectionItems.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-base-200/60 border border-white/5 space-y-3 relative">
                      <div className="flex justify-between items-center text-xs font-mono font-bold text-primary mb-1">
                        <span>Zdanie z błędem #{idx + 1}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveErrorCorrectionItem(idx, 'up')}
                            disabled={idx === 0}
                            title="Przesuń zdanie w górę"
                            className="p-1 rounded text-content-muted hover:text-white disabled:opacity-20 transition-colors"
                          >
                            <ChevronUp size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveErrorCorrectionItem(idx, 'down')}
                            disabled={idx === errorCorrectionItems.length - 1}
                            title="Przesuń zdanie w dół"
                            className="p-1 rounded text-content-muted hover:text-white disabled:opacity-20 transition-colors"
                          >
                            <ChevronDown size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setErrorCorrectionItems(prev => prev.filter((_, i) => i !== idx))}
                            className="text-danger hover:opacity-80 p-1"
                            title="Usuń zadanie"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-warn mb-1">
                            Zdanie po angielsku Z BŁĘDEM (do poprawy) <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            value={item.incorrectSentence || ''}
                            onChange={(e) => {
                              const updated = [...errorCorrectionItems];
                              updated[idx].incorrectSentence = e.target.value;
                              setErrorCorrectionItems(updated);
                            }}
                            placeholder="np. She don't like working overtime."
                            className="w-full px-3 py-2 bg-base-100 text-white border border-warn/30 rounded-lg text-xs font-medium focus:border-warn focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-primary mb-1">
                            Poprawna wersja zdania (wzorzec) <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            value={item.correctSentence || ''}
                            onChange={(e) => {
                              const updated = [...errorCorrectionItems];
                              updated[idx].correctSentence = e.target.value;
                              setErrorCorrectionItems(updated);
                            }}
                            placeholder="np. She doesn't like working overtime."
                            className="w-full px-3 py-2 bg-base-100 text-white border border-primary/30 rounded-lg text-xs font-medium focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-amber-300 mb-1">
                            💡 Wskazówka dla kursanta (pomaga zlokalizować błąd)
                          </label>
                          <input
                            type="text"
                            value={item.hint || ''}
                            onChange={(e) => {
                              const updated = [...errorCorrectionItems];
                              updated[idx].hint = e.target.value;
                              setErrorCorrectionItems(updated);
                            }}
                            placeholder="np. Zwróć uwagę na przeczenie w 3. osobie l. poj."
                            className="w-full px-3 py-1.5 bg-base-100 text-white border border-white/10 rounded-lg text-xs focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-content-muted mb-1">
                            Polskie znaczenie (kontekst wypowiedzi)
                          </label>
                          <input
                            type="text"
                            value={item.polishHint || ''}
                            onChange={(e) => {
                              const updated = [...errorCorrectionItems];
                              updated[idx].polishHint = e.target.value;
                              setErrorCorrectionItems(updated);
                            }}
                            placeholder="np. Ona nie lubi pracować po godzinach."
                            className="w-full px-3 py-1.5 bg-base-100 text-white border border-white/10 rounded-lg text-xs focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>

                      {item.explanation && (
                        <div>
                          <label className="block text-[11px] font-semibold text-content-muted mb-1">
                            Wyjaśnienie reguły (opcjonalne, widoczne po sprawdzeniu)
                          </label>
                          <input
                            type="text"
                            value={item.explanation || ''}
                            onChange={(e) => {
                              const updated = [...errorCorrectionItems];
                              updated[idx].explanation = e.target.value;
                              setErrorCorrectionItems(updated);
                            }}
                            placeholder="np. W Present Simple z 'she' używamy 'doesn't'."
                            className="w-full px-3 py-1 bg-base-100 text-white border border-white/10 rounded-lg text-xs focus:border-primary focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={editingTask ? handleCancelEdit : () => setActiveTab('list')}
              disabled={isSavingHomework}
            >
              Anuluj
            </Button>
            <Button onClick={handleSaveHomework} disabled={isSavingHomework} className="flex items-center gap-2">
              {isSavingHomework ? (
                <>
                  <RefreshCw className="animate-spin" size={18} /> {editingTask ? 'Zapisywanie...' : 'Przypisywanie...'}
                </>
              ) : editingTask ? (
                <>
                  <Save size={18} /> Zapisz zmiany w pracy domowej
                </>
              ) : (
                <>
                  <Send size={18} /> Przypisz pracę domową
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* ---------------- HOMEWORK LIST VIEW (Students & Teachers) ---------------- */}
      {!activeTask && (activeTab === 'list' || !isTeacher) && (
        <div className="space-y-6">
          {/* Teacher Filters */}
          {isTeacher && (
            <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-base-200/60 border border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-content-muted">Kursant:</span>
                <select
                  value={filterStudentId}
                  onChange={(e) => setFilterStudentId(e.target.value)}
                  className="px-3 py-1.5 bg-base-100 text-white border border-white/10 rounded-lg text-xs"
                >
                  <option value="all">Wszyscy kursanci</option>
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.firstName ? `${st.firstName} ${st.lastName || ''}` : st.username}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-content-muted">Status:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-1.5 bg-base-100 text-white border border-white/10 rounded-lg text-xs"
                >
                  <option value="all">Wszystkie statusy</option>
                  <option value="pending">Oczekujące (w trakcie)</option>
                  <option value="submitted">Przesłane do oceny</option>
                  <option value="graded">Ocenione przez nauczyciela</option>
                </select>
              </div>
            </div>
          )}

          {/* Homework Cards List */}
          {isLoading ? (
            <div className="text-center py-12 text-content-muted">
              <RefreshCw className="animate-spin mx-auto mb-2 text-primary" size={24} />
              Ładowanie prac domowych...
            </div>
          ) : (isTeacher ? filteredTasks : tasks).length === 0 ? (
            isTeacher && filterStatus === 'graded' ? null : (
              <Card className="text-center py-12">
                <BookOpen className="mx-auto text-content-muted mb-3 opacity-40" size={48} />
                <p className="text-base font-bold text-content">
                  {isTeacher && filterStatus === 'submitted'
                    ? 'Brak prac oczekujących na sprawdzenie'
                    : 'Brak prac domowych'}
                </p>
                <p className="text-xs text-content-muted mt-1">
                  {isTeacher
                    ? filterStatus === 'submitted'
                      ? 'Wszystkie odesłane prace domowe zostały sprawdzone lub oznaczone jako zrobione. Sprawdzone prace znajdziesz w poniższym archiwum.'
                      : 'Nie znaleziono żadnych prac domowych dla wybranych kryteriów.'
                    : 'Nie masz obecnie żadnych oczekujących prac domowych do rozwiązania.'}
                </p>
              </Card>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(isTeacher ? filteredTasks : tasks).map((task) => {
                const isPending = task.status === 'pending';
                const isSubmitted = task.status === 'submitted';
                const isGraded = task.status === 'graded';

                return (
                  <Card
                    key={task.id}
                    className={`liquid-glass relative transition-all border ${
                      isSubmitted
                        ? 'border-primary/40 shadow-[0_0_15px_rgba(114, 240, 180,0.1)]'
                        : isGraded
                        ? 'border-primary/40'
                        : 'border-white/10'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-base-300 text-primary">
                          {task.type === 'find_errors' ? 'Poprawianie błędów' : task.type === 'fill_in_the_blank' ? 'Uzupełnij luki' : 'Tłumaczenie zdań'}
                        </span>
                        {isTaskNewForTeacher(task) && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-400 text-black shadow-md flex items-center gap-1 animate-pulse">
                            <Sparkles size={11} /> Nowa
                          </span>
                        )}
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${
                          isSubmitted
                            ? 'bg-primary/20 text-primary'
                            : isGraded
                            ? 'bg-primary/20 text-primary'
                            : 'bg-warn/20 text-warn'
                        }`}
                      >
                        {isSubmitted ? (
                          <>
                            <CheckCircle2 size={12} /> Przesłano do oceny
                          </>
                        ) : isGraded ? (
                          <>
                            <Award size={12} /> Oceniono
                          </>
                        ) : (
                          <>
                            <Clock size={12} /> Do zrobienia
                          </>
                        )}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-base mb-1">{task.title}</h3>
                    
                    {isTeacher && (
                      <p className="text-xs text-primary/90 font-medium mb-1">
                        👤 Kursant: {task.studentName || task.studentId}
                      </p>
                    )}

                    <p className="text-xs text-content-muted mb-3 line-clamp-2">
                      {task.instructions || `${task.sentences?.length || 0} zdań w zestawie.`}
                    </p>

                    <div className="space-y-1.5 pt-3 border-t border-white/5 mt-2 text-[11px] text-content-muted">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {isSubmitted && task.submittedAt ? (
                          <span className="flex items-center gap-1 text-primary font-semibold">
                            <Clock size={12} className="text-primary" /> Nadesłano: <strong>{formatTaskDateTime(task.submittedAt)}</strong>
                          </span>
                        ) : task.createdAt ? (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} /> Zadano: {formatTaskDateTime(task.createdAt)}
                          </span>
                        ) : null}
                        <span>{task.sentences?.length || 0} zdań</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-content-muted/80">
                        {isSubmitted && task.createdAt && (
                          <span>Zadano: {formatTaskDateTime(task.createdAt)}</span>
                        )}
                        {task.dueDate && <span>Termin: {task.dueDate}</span>}
                      </div>
                    </div>

                    {/* Teacher Feedback Banner if graded */}
                    {isGraded && task.teacherFeedback && (
                      <div className="mt-3 p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary space-y-1">
                        <strong className="block">Komentarz nauczyciela:</strong>
                        <p className="text-content">{task.teacherFeedback}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                      {isTeacher ? (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              markTaskAsViewedByTeacher(task);
                              setPreviewTask(task);
                            }}
                            className="text-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye size={14} />
                            Podgląd
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              markTaskAsViewedByTeacher(task);
                              handleStartEditTask(task);
                            }}
                            className="text-xs flex items-center gap-1.5 hover:border-primary/40 hover:text-primary transition-all cursor-pointer"
                            title="Edytuj zdania, wytyczne lub termin tej pracy"
                          >
                            <Edit3 size={14} />
                            Edytuj
                          </Button>
                          {isSubmitted && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  markTaskAsViewedByTeacher(task);
                                  handleMarkAsDone(task);
                                }}
                                disabled={markingTaskId === task.id}
                                className="text-xs flex items-center gap-1.5 text-primary border-primary/30 hover:bg-primary/15 transition-all cursor-pointer"
                                title="Oznacz tę pracę jako zrobioną/odczytaną (zmniejszy liczbę odesłanych prac i przeniesie do archiwum)"
                              >
                                {markingTaskId === task.id ? (
                                  <RefreshCw size={13} className="animate-spin" />
                                ) : (
                                  <CheckCheck size={14} className="text-primary" />
                                )}
                                <span>Oznacz jako zrobione</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => {
                                  markTaskAsViewedByTeacher(task);
                                  setReviewTask(task);
                                  setTeacherFeedbackText(task.teacherFeedback || '');
                                }}
                                className="text-xs flex items-center gap-1.5 cursor-pointer"
                              >
                                <FileText size={14} />
                                Sprawdź / Oceń
                              </Button>
                            </>
                          )}
                          {isGraded && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setReviewTask(task);
                                setTeacherFeedbackText(task.teacherFeedback || '');
                              }}
                              className="text-xs flex items-center gap-1.5 text-primary border-primary/30"
                            >
                              <Award size={14} />
                              Szczegóły oceny
                            </Button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task)}
                            className="p-2 rounded-xl text-danger hover:opacity-80 hover:bg-danger/15 border border-danger/20 hover:border-danger/40 transition-all cursor-pointer"
                            title="Usuń pracę domową"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant={isPending ? 'primary' : 'secondary'}
                          onClick={() => handleStartTask(task)}
                          className="text-xs flex items-center gap-1"
                        >
                          {isPending ? (
                            <>
                              <Edit3 size={14} /> Rozwiąż pracę domową
                            </>
                          ) : (
                            <>
                              <Check size={14} /> Zobacz odpowiedzi
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ---------------- ROZDZIELAJĄCY DIVIDER - ARCHIWUM ---------------- */}
          {isTeacher && (filterStatus === 'submitted' || filterStatus === 'all' || filterStatus === 'graded') && (
            <div className="space-y-4 pt-2">
              <div className="relative my-8 py-2">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-base-200 px-5 py-2 rounded-full text-xs font-mono font-bold uppercase tracking-wider text-content-muted border border-white/10 flex items-center gap-2 shadow-xl shadow-black/40">
                    <Archive size={15} className="text-primary" />
                    <span>Sprawdzone przez nauczyciela</span>
                    <span className="px-2 py-0.5 bg-white/10 text-white rounded-full text-[11px] font-bold">
                      {archivedTasks.length}
                    </span>
                  </span>
                </div>
              </div>

              {archivedTasks.length === 0 ? (
                <Card className="text-center py-8 bg-base-200/30 border border-white/5">
                  <Archive className="mx-auto text-content-muted mb-2 opacity-30" size={32} />
                  <p className="text-xs font-semibold text-content-muted">Archiwum jest puste</p>
                  <p className="text-[11px] text-content-muted/70 mt-0.5">
                    Sprawdzone, ocenione lub odznaczone prace domowe pojawią się w tym miejscu.
                  </p>
                </Card>
              ) : (
                <div className="space-y-2.5">
                  {archivedTasks.map((task) => {
                    const isGradedWithFeedback = Boolean(task.teacherFeedback || task.grade !== undefined);
                    const dateFormatted = formatTaskDateTime(task.reviewedAt || task.submittedAt || task.createdAt);
                    const isMarking = markingTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        className="p-3.5 rounded-xl bg-base-200/50 hover:bg-base-200/70 border border-white/5 hover:border-white/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-base-300 text-content-muted">
                              {task.type === 'find_errors' ? 'Poprawianie błędów' : task.type === 'fill_in_the_blank' ? 'Uzupełnij luki' : 'Tłumaczenie zdań'}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 flex items-center gap-1">
                              <CheckCircle2 size={11} />
                              {isGradedWithFeedback ? 'Sprawdzona i oceniona' : 'Sprawdzona / zrobiona'}
                            </span>
                            {task.grade !== undefined && (
                              <span className="text-[11px] font-mono font-bold text-primary">
                                Wynik: {task.grade}%
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm font-bold text-white truncate">{task.title}</h4>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-muted mt-1">
                            <span className="flex items-center gap-1 text-content-muted font-medium">
                              <UserIcon size={12} className="text-primary" />
                              {task.studentName || task.studentId}
                            </span>
                            {dateFormatted && (
                              <span className="flex items-center gap-1 font-mono text-[11px]">
                                <CheckCheck size={12} className="text-primary" /> Sprawdzono: {dateFormatted}
                              </span>
                            )}
                            {task.submittedAt && (
                              <span className="flex items-center gap-1 font-mono text-[11px] text-content-muted">
                                <Clock size={11} /> Nadesłano: {formatTaskDateTime(task.submittedAt)}
                              </span>
                            )}
                            {task.teacherFeedback && (
                              <span className="text-[11px] text-content-muted/80 truncate max-w-md italic">
                                „{task.teacherFeedback}”
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setPreviewTask(task)}
                            className="text-xs py-1 px-2.5 flex items-center gap-1 cursor-pointer"
                            title="Podgląd zadania i odpowiedzi kursanta"
                          >
                            <Eye size={13} />
                            Podgląd
                          </Button>

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setReviewTask(task);
                              setTeacherFeedbackText(task.teacherFeedback || '');
                            }}
                            className="text-xs py-1 px-2.5 flex items-center gap-1 text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
                            title="Edytuj ocenę lub komentarz"
                          >
                            <Award size={13} />
                            Ocena
                          </Button>

                          <button
                            type="button"
                            onClick={() => handleUnmarkDone(task)}
                            disabled={isMarking}
                            className="p-1.5 rounded-lg text-content-muted hover:text-warn hover:bg-warn/10 border border-transparent hover:border-warn/20 transition-all cursor-pointer"
                            title="Cofnij do odesłanych (przywróć do prac oczekujących na sprawdzenie)"
                          >
                            {isMarking ? <RefreshCw size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task)}
                            className="p-1.5 rounded-lg text-content-muted hover:text-danger hover:bg-danger/10 border border-transparent hover:border-danger/20 transition-all cursor-pointer"
                            title="Usuń pracę domową"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---------------- ROZDZIELAJĄCY DIVIDER MIĘDZY PRACAMI A TESTAMI ---------------- */}
          {isTeacher && (
            <>
              <div className="relative my-10 py-2">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-base-200 px-5 py-2 rounded-full text-xs font-mono font-bold uppercase tracking-wider text-primary border border-primary/30 flex items-center gap-2 shadow-xl shadow-black/40">
                    <GraduationCap size={16} />
                    <span>Testy i Sprawdziany kursantów</span>
                    {filteredStudentTests.length > 0 && (
                      <span className="px-2 py-0.5 bg-primary/20 rounded-full text-[11px] font-bold">
                        {filteredStudentTests.length}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* ---------------- TESTY KURSANTÓW DLA NAUCZYCIELA ---------------- */}
              {filteredStudentTests.length === 0 ? (
                <Card className="text-center py-8 bg-base-200/40 border border-white/5">
                  <GraduationCap className="mx-auto text-content-muted mb-2 opacity-40" size={36} />
                  <p className="text-sm font-bold text-content">Brak testów dla wybranych filtrów</p>
                  <p className="text-xs text-content-muted mt-0.5">
                    Nie znaleziono testów odpowiadających wybranemu kursantowi lub statusowi.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredStudentTests.map((test) => {
                    const isCompleted = test.status === 'graded' || test.status === 'completed' || Boolean(test.completedAt);
                    const isOverdue = !isCompleted && isDateOverdue(test.dueDate);
                    const isPending = !isCompleted && !isOverdue;

                    return (
                      <Card
                        key={test.id}
                        className={`p-5 flex flex-col justify-between transition-all border ${
                          isOverdue
                            ? 'border-danger/40 bg-danger/[0.04]'
                            : isCompleted
                            ? 'border-primary/30 bg-base-200/70'
                            : 'border-white/10 bg-base-200/50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-semibold text-content-muted flex items-center gap-1.5 truncate">
                              <UserIcon size={14} className="text-primary" />
                              <strong className="text-white">{test.studentName}</strong>
                            </span>
                            {isOverdue && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-danger/20 text-danger border border-danger/30 flex items-center gap-1">
                                <Clock size={11} /> Termin minął
                              </span>
                            )}
                            {isPending && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-warn/20 text-warn border border-warn/30">
                                W trakcie
                              </span>
                            )}
                            {isCompleted && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-primary/20 text-primary border border-primary/30 flex items-center gap-1">
                                <Check size={11} /> Odesłany
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-bold text-white leading-snug">{test.title}</h3>
                          {test.scope && (
                            <p className="text-xs text-content-muted line-clamp-2 mt-1">{test.scope}</p>
                          )}

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-muted mt-3 pt-2 border-t border-white/5 font-mono">
                            {test.dueDate && (
                              <span className={`flex items-center gap-1 ${isOverdue ? 'text-danger font-bold' : ''}`}>
                                <Clock size={12} /> Termin: {test.dueDate}
                              </span>
                            )}
                            <span>Pytań: {test.questions?.length || 0}</span>
                            {test.score !== undefined && (
                              <span className="text-primary font-bold">
                                Wynik: {test.score}/{test.maxScore || test.questions?.length || 100} pkt
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-white/5">
                          {isCompleted && test.teacherRead === false && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleMarkTestAsRead(test)}
                              disabled={markingTestId === test.id}
                              className="text-xs flex items-center gap-1.5 text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
                              title="Oznacz ten test jako odczytany (zmniejszy liczbę odesłanych prac)"
                            >
                              {markingTestId === test.id ? (
                                <RefreshCw size={12} className="animate-spin" />
                              ) : (
                                <CheckCheck size={13} />
                              )}
                              Oznacz jako odczytany
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => exportTestToPDF(test, (k: string) => k)}
                            className="text-xs flex items-center gap-1.5 cursor-pointer"
                            title="Pobierz arkusz lub raport PDF"
                          >
                            <Download size={14} /> PDF
                          </Button>
                          <Button
                            size="sm"
                            variant={isCompleted ? 'primary' : 'secondary'}
                            onClick={() => handleOpenPreviewTest(test)}
                            className="text-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye size={14} />
                            {isCompleted ? 'Zobacz odpowiedzi i feedback' : 'Podgląd pytań'}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ---------------- TEACHER REVIEW & GRADING MODAL ---------------- */}
      {reviewTask && (
        <div className="fixed inset-0 bg-ink/72 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-3xl liquid-glass border-primary/30 my-8 space-y-6">
            <div className="flex justify-between items-start border-b border-white/10 pb-4">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/20 text-primary font-bold">
                  Przegląd & Ocena nauczyciela
                </span>
                <h2 className="text-xl font-bold text-white mt-2">{reviewTask.title}</h2>
                <p className="text-xs text-content-muted mt-1">
                  Kursant: <strong className="text-white">{reviewTask.studentName || reviewTask.studentId}</strong> | Status: <span className="text-primary font-bold">{reviewTask.status}</span>
                </p>
              </div>
              <button
                onClick={() => setReviewTask(null)}
                className="p-1 rounded-lg text-content-muted hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* List of answers submitted by student */}
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
              {reviewTask.sentences.map((item: any, idx: number) => {
                const stAns = reviewTask.studentAnswers ? (reviewTask.studentAnswers as any)[idx] : '';
                const evalItem = reviewTask.evaluationResults ? reviewTask.evaluationResults[idx] : null;
                const itemType = homeworkItemType(item, reviewTask);

                return (
                  <div key={idx} className="p-4 rounded-xl bg-base-200/60 border border-white/5 space-y-2">
                    <div className="flex justify-between items-center text-xs font-mono text-content-muted">
                      <span>Zadanie #{idx + 1}</span>
                      {evalItem?.score !== undefined && (
                        <span className="text-primary font-bold">Wynik AI: {Number.isNaN(Number(evalItem.score)) ? 0 : evalItem.score}%</span>
                      )}
                    </div>

                    {renderExercisePrompt(item, itemType)}

                    <div className="p-2.5 rounded-lg bg-base-100 border border-white/10 text-sm">
                      <span className="text-xs font-semibold text-content-muted block mb-0.5">Odpowiedź kursanta:</span>
                      {renderStudentAnswerDisplay(stAns, item)}
                    </div>

                    {evalItem?.explanation && (
                      <p className="text-xs text-content-muted italic bg-base-300/40 p-2 rounded-lg">
                        💡 {evalItem.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Teacher feedback area */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <label className="block text-sm font-bold text-content">
                Komentarz / Wskazówki nauczyciela dla kursanta:
              </label>
              <textarea
                rows={3}
                value={teacherFeedbackText}
                onChange={(e) => setTeacherFeedbackText(e.target.value)}
                placeholder="Wpisz słowa uznania, uwagi do gramatyki lub zalecenia do powtórki..."
                className="w-full px-4 py-2.5 bg-base-100 text-white border border-white/10 rounded-xl focus:border-primary focus:outline-none text-sm resize-y"
              />

              <div className="flex justify-between items-center pt-2">
                <Button onClick={handleAnalyzeWithAI} isLoading={isAnalyzing} className="flex items-center gap-2">
                  <Sparkles size={18} /> Przeanalizuj z AI
                </Button>
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setReviewTask(null)}>
                    Zamknij
                  </Button>
                  <Button onClick={handleSaveReview} isLoading={isSavingReview} className="flex items-center gap-2">
                    <Check size={18} /> Zapisz ocenę i komentarz
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
      {showBulkAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-2xl bg-base-300 border-white/10">
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="text-primary" /> Dodaj własne zdania hurtowo
                </h2>
                <button onClick={() => setShowBulkAddModal(false)} className="text-content-muted hover:text-white transition-colors p-1">
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-content-muted">
                Wklej listę zdań (po polsku lub po polsku i angielsku). AI przeanalizuje tekst i automatycznie podzieli go na osobne zadania do tłumaczenia.
              </p>
              <textarea
                rows={10}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Np.\n1. Chcę kupić nowy samochód.\n2. I want to buy a new car.\n..."
                className="w-full px-4 py-3 bg-base-100 text-white border border-white/10 rounded-xl focus:border-primary focus:outline-none text-sm resize-y"
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => setShowBulkAddModal(false)}>
                  Anuluj
                </Button>
                <Button onClick={handleBulkProcess} isLoading={isBulkProcessing} className="flex items-center gap-2">
                  <Sparkles size={18} /> Przetwórz z AI
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal wyboru lekcji kursanta */}
      <LessonSelectionModal
        isOpen={isLessonModalOpen}
        onClose={() => setIsLessonModalOpen(false)}
        lessons={studentLessons}
        selectedLessonIds={selectedLessonIds}
        onSave={(ids) => setSelectedLessonIds(ids)}
        studentName={students.find((s) => s.id === selectedStudentId)?.firstName}
      />

      {/* ---------------- TEACHER & STUDENT HOMEWORK PREVIEW MODAL ---------------- */}
      {previewTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <Card className="w-full max-w-3xl liquid-glass border-primary/30 my-6 space-y-5 bg-base-100 shadow-2xl">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-white/10 pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <Badge>
                    {previewTask.type === 'find_errors' ? 'Poprawianie błędów w zdaniach' : previewTask.type === 'fill_in_the_blank' ? 'Uzupełnij luki' : 'Tłumaczenie zdań'}
                  </Badge>
                  <Badge status={previewTask.status === 'submitted' || previewTask.status === 'graded' ? 'ok' : 'wait'}>
                    {previewTask.status === 'submitted'
                      ? 'Przesłano do oceny'
                      : previewTask.status === 'graded'
                      ? 'Oceniono'
                      : 'Oczekuje na wykonanie'}
                  </Badge>
                </div>
                <h2 className="text-xl font-bold text-white">{previewTask.title}</h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-muted mt-1.5">
                  <span>Kursant: <strong className="text-white">{previewTask.studentName || previewTask.studentId}</strong></span>
                  {previewTask.createdAt && (
                    <span className="flex items-center gap-1">
                      • Zadano: <strong className="text-content">{formatTaskDateTime(previewTask.createdAt)}</strong>
                    </span>
                  )}
                  {previewTask.submittedAt && (
                    <span className="flex items-center gap-1 text-primary font-medium">
                      • Nadesłano: <strong className="text-primary">{formatTaskDateTime(previewTask.submittedAt)}</strong>
                    </span>
                  )}
                  {previewTask.reviewedAt && (
                    <span className="flex items-center gap-1">
                      • Sprawdzono: <strong className="text-content">{formatTaskDateTime(previewTask.reviewedAt)}</strong>
                    </span>
                  )}
                  {previewTask.dueDate && <span>• Termin: <strong className="text-content">{previewTask.dueDate}</strong></span>}
                  <span>• Liczba zdań: <strong className="text-content">{previewTask.sentences?.length || 0}</strong></span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTask(null)}
                className="p-1.5 rounded-xl text-content-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {previewTask.instructions && (
              <div className="p-3 bg-base-200/60 rounded-xl border border-white/5 text-xs text-content">
                <strong className="text-content-muted block mb-0.5">Instrukcje / Wskazówki ogólne:</strong>
                {previewTask.instructions}
              </div>
            )}

            {/* Sentences List */}
            <div className="space-y-3.5 max-h-[55vh] overflow-y-auto pr-1">
              {previewTask.sentences?.map((item: any, idx: number) => {
                const itemType = homeworkItemType(item, previewTask);
                const stAns = previewTask.studentAnswers ? (previewTask.studentAnswers as any)[idx] : undefined;
                const evalItem = previewTask.evaluationResults ? (previewTask.evaluationResults as any)[idx] : undefined;

                return (
                  <div key={idx} className="p-4 rounded-xl bg-base-200/50 border border-white/5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono text-content-muted">
                      <span className="font-bold text-primary">Zadanie #{idx + 1}</span>
                      {evalItem?.score !== undefined && (
                        <span className="text-primary font-bold">Ocena AI: {evalItem.score}%</span>
                      )}
                    </div>

                    {renderExercisePrompt(item, itemType)}

                    {item.hint && (
                      <div className="text-xs text-text-2 bg-base-100/60 p-2 rounded-lg border border-white/5 flex items-start gap-1.5">
                        <span className="text-warn">💡</span>
                        <span>Wskazówka: {item.hint}</span>
                      </div>
                    )}

                    {stAns !== undefined && (
                      <div className="p-2.5 rounded-lg bg-base-100 border border-white/10 text-xs sm:text-sm">
                        <span className="text-xs font-semibold text-content-muted block mb-0.5">Odpowiedź kursanta:</span>
                        {renderStudentAnswerDisplay(stAns, item)}
                      </div>
                    )}

                    {evalItem?.explanation && (
                      <p className="text-xs text-content-muted italic bg-base-300/40 p-2 rounded-lg">
                        💡 {evalItem.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Teacher Feedback if present */}
            {previewTask.teacherFeedback && (
              <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-xs space-y-1">
                <strong className="text-primary block">Komentarz nauczyciela:</strong>
                <p className="text-content">{previewTask.teacherFeedback}</p>
              </div>
            )}

            {/* Footer */}
            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              {isTeacher && (
                <button
                  type="button"
                  onClick={() => {
                    const t = previewTask;
                    setPreviewTask(null);
                    setTaskToDelete(t);
                  }}
                  className="text-xs text-danger hover:opacity-80 bg-danger/10 hover:bg-danger/20 px-3 py-1.5 rounded-xl border border-danger/25 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 size={14} /> Usuń pracę domową
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="secondary" size="sm" onClick={() => setPreviewTask(null)}>
                  Zamknij
                </Button>
                {isTeacher && previewTask.status === 'submitted' && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleMarkAsDone(previewTask)}
                      disabled={markingTaskId === previewTask.id}
                      className="text-xs flex items-center gap-1.5 text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
                    >
                      {markingTaskId === previewTask.id ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : (
                        <CheckCheck size={14} />
                      )}
                      Oznacz jako zrobione
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        const t = previewTask;
                        setPreviewTask(null);
                        setReviewTask(t);
                        setTeacherFeedbackText(t.teacherFeedback || '');
                      }}
                      className="text-xs flex items-center gap-1.5"
                    >
                      <FileText size={14} /> Sprawdź / Oceń
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!taskToDelete}
        title="Usunąć pracę domową?"
        message={
          taskToDelete
            ? `Czy na pewno chcesz trwale usunąć pracę "${taskToDelete.title || 'Praca domowa'}" dla kursanta ${taskToDelete.studentName || taskToDelete.studentId || ''}? Tej operacji nie można cofnąć.`
            : ''
        }
        confirmText={isDeleting ? 'Usuwanie...' : 'Usuń pracę domową'}
        cancelText="Anuluj"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!isDeleting) setTaskToDelete(null);
        }}
      />
      <TestPreviewModal
        isOpen={Boolean(previewTest)}
        test={previewTest}
        onClose={() => setPreviewTest(null)}
      />

      {isEmailConfirmationModalOpen && createdTaskForEmail && (
        <HomeworkEmailConfirmationModal
          isOpen={isEmailConfirmationModalOpen}
          student={studentForEmail}
          task={createdTaskForEmail}
          onEmailSent={() => {
            setIsEmailConfirmationModalOpen(false);
            setCreatedTaskForEmail(null);
            setStudentForEmail(null);
            loadData();
          }}
          onSkip={() => {
            setIsEmailConfirmationModalOpen(false);
            setCreatedTaskForEmail(null);
            setStudentForEmail(null);
            loadData();
          }}
          onClose={() => {
            setIsEmailConfirmationModalOpen(false);
            setCreatedTaskForEmail(null);
            setStudentForEmail(null);
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default HomeworkScreen;
