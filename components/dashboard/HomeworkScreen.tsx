import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { User, SpecialTask, HomeworkType, TranslationExercise, FillInTheBlankExercise, LessonRecord } from '../../types';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { generateTranslationExercises, generateFillInTheBlankExercises, evaluateErrorCorrectionSentence, evaluateTranslations, evaluateTeacherHomework, processBulkSentences } from '../../services/geminiService';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { FillInTheBlankTask } from '../practice/FillInTheBlankTask';
import { 
  BookOpen, 
  Sparkles, 
  Plus, 
  Check, 
  X, 
  Trash2, 
  Edit3, 
  Send, 
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
  UserCheck
} from 'lucide-react';

export const HomeworkScreen: React.FC = () => {
  const { user, updateUserStreak } = useAuth();
  const { language } = useLanguage();
  const isTeacher = user?.role === 'admin' || user?.role === 'teacher';

  // State
  const [students, setStudents] = useState<User[]>([]);
  const [tasks, setTasks] = useState<SpecialTask[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'flashcards'>('list');

  // Filter state for teacher
  const [filterStudentId, setFilterStudentId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Form state for creating homework (Teacher)
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
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
  const [errorCorrectionItems, setErrorCorrectionItems] = useState<FillInTheBlankExercise[]>([]);

  // AI Generator controls
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [aiLevel, setAiLevel] = useState<string>('B1-B2');
  const [aiTopic, setAiTopic] = useState<string>('');
  const [aiCount, setAiCount] = useState<number>(5);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [genError, setGenError] = useState<string>('');
  const [studentLessons, setStudentLessons] = useState<LessonRecord[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>("manual");
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);


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

  // Load students & homework tasks
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
        loadedTasks.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setTasks(loadedTasks);
      } else if (user?.id) {
        // Load student's tasks
        const q = query(collection(db, 'specialTasks'), where('studentId', 'in', [user.id, 'all']));
        const tasksSnap = await getDocs(q);
        const loadedTasks: SpecialTask[] = [];
        tasksSnap.forEach((d) => {
          loadedTasks.push({ id: d.id, ...d.data() } as SpecialTask);
        });
        loadedTasks.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setTasks(loadedTasks);
      }
    } catch (e) {
      console.error('Błąd ładowania prac domowych:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (user?.hasNewHomework && user?.id) {
      updateDoc(doc(db, 'users', user.id), { hasNewHomework: false }).catch(console.error);
    }
  }, [user?.id, isTeacher, user?.hasNewHomework]);

  // Set default title when type changes
  useEffect(() => {
    if (homeworkType === 'translation') {
      setTitle('Praca domowa: Tłumaczenie zdań');
      setInstructions('Przetłumacz poniższe zdania na język angielski. Przemyśl strukturę zdania i zastosowane słownictwo.');
    } else {
      setTitle('Praca domowa: Znajdź błędy w zdaniach');
      setInstructions('W każdym z poniższych zdań znajduje się błąd. Wpisz pełne, poprawione zdanie po angielsku.');
    }
  }, [homeworkType]);
  // Auto-set level and load lessons when student changes
  useEffect(() => {
    if (!selectedStudentId || selectedStudentId === "all") {
      setStudentLessons([]);
      setSelectedLessonId("manual");
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
        if (sorted.length > 0) {
          setSelectedLessonId("all"); // Default to all lessons vocabulary
        } else {
          setSelectedLessonId("manual");
        }
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
      const studentProfileContext = selectedStudent
        ? `Profil i tło kursanta:\nImię: ${selectedStudent.firstName || ''} ${selectedStudent.lastName || ''}\nPoziom: ${selectedStudent.level || aiLevel}\nOpis: ${selectedStudent.description || 'Brak'}`
        : '';

      if (selectedLessonId === "all" && studentLessons.length > 0) {
        vocabularyTextToUse = studentLessons
          .map((l) => l.vocabularyText)
          .filter(Boolean)
          .join('\n');
        finalPrompt += `\n\nBAZUJ NA SKUMULOWANYM SŁOWNICTWIE ZE WSZYSTKICH (${studentLessons.length}) LEKCJI KURSANTA:\n${vocabularyTextToUse}`;
      } else if (selectedLessonId !== "manual" && selectedLessonId !== "all") {
        const lesson = studentLessons.find(l => l.id === selectedLessonId);
        if (lesson) {
          vocabularyTextToUse = lesson.vocabularyText || '';
          finalPrompt += `\n\nBAZUJ NA SŁOWNICTWIE Z LEKCJI (${new Date(lesson.date).toLocaleDateString()} - ${lesson.topic}):\n${lesson.vocabularyText}`;
          if (!finalTopic) finalTopic = lesson.topic;
        }
      }

      if (homeworkType === "translation") {
        const wordsArr = vocabularyTextToUse
          ? vocabularyTextToUse.split('\n').map(s => s.trim()).filter(Boolean)
          : (finalTopic ? finalTopic.split(",").map(s => s.trim()).filter(Boolean) : []);

        const result = await generateTranslationExercises(
          aiLevel,
          wordsArr,
          finalPrompt,
          finalTopic,
          studentProfileContext,
          aiCount
        );
        if (result && result.length > 0) {
          setTranslationItems(result);
        } else {
          setGenError('Nie udało się wygenerować zdań. Spróbuj zmienić parametry.');
        }
      } else {
        const result = await generateFillInTheBlankExercises(
          aiLevel,
          finalTopic,
          aiCount,
          finalPrompt
        );
        if (result && result.textWithBlanks) {
          setErrorCorrectionItems([result]);
        } else {
          setGenError("Nie udało się wygenerować zadań z lukami.");
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
        { textWithBlanks: "", blanks: {}, availableWords: [] }
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


  // Save/Assign Homework (Teacher)
  const handleSaveHomework = async () => {
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
      const hasEmpty = errorCorrectionItems.some(i => !i.textWithBlanks.trim() || Object.keys(i.blanks).length === 0);
      if (hasEmpty) {
        alert("Uzupełnij tekst z lukami i definicje luk dla wszystkich elementów.");
        return;
      }
    }

    try {
      setIsLoading(true);
      const sentences = homeworkType === 'translation' ? translationItems : errorCorrectionItems;

      // Target students
      const targetStudentIds = selectedStudentId === 'all' 
        ? students.map(s => s.id!).filter(Boolean)
        : [selectedStudentId];

      for (const stId of targetStudentIds) {
        const studentObj = students.find(s => s.id === stId);
        const taskData: Partial<SpecialTask> = {
          studentId: stId,
          studentName: studentObj ? `${studentObj.firstName || ''} ${studentObj.lastName || ''}`.trim() || studentObj.username : 'Kursant',
          assignedBy: user?.username || 'Nauczyciel',
          title: title.trim() || 'Praca domowa',
          type: homeworkType,
          instructions: instructions.trim(),
          createdAt: new Date().toISOString(),
          dueDate,
          status: 'pending',
          sentences: sentences
        };

        await addDoc(collection(db, 'specialTasks'), taskData);
        await updateDoc(doc(db, 'users', stId), { hasNewHomework: true });
      }

      alert('Praca domowa została pomyślnie przypisana!');
      // Reset form
      setTranslationItems([]);
      setErrorCorrectionItems([]);
      setTitle('');
      setSelectedStudentId('');
      setActiveTab('list');
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(`Błąd przypisywania pracy domowej: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Homework (Teacher)
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę pracę domową?')) return;
    try {
      await deleteDoc(doc(db, 'specialTasks', taskId));
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (e: any) {
      console.error(e);
      alert('Nie udało się usunąć zadania.');
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
    const answeredCount = Object.keys(studentAnswers).filter(k => (studentAnswers[Number(k)] || '').trim().length > 0).length;

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
        const answers = activeTask.sentences.map((_, idx) => studentAnswers[idx] || '');

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
            const stAns = studentAnswers[i] || '';
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
          const stAns = studentAnswers[i] || '';
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
        (reviewTask.type === 'fill_in_the_blank' ? 'fill_in_the_blank' : 'translation'),
        reviewTask.sentences,
        reviewTask.studentAnswers || {},
        teacherFeedbackText
      );
      
      let totalScore = 0;
      results.forEach((res) => {
        const scoreNum = Number(res.score);
        totalScore += isNaN(scoreNum) ? 0 : scoreNum;
      });
      const avgScore = results.length > 0 ? Math.round(totalScore / results.length) : 0;

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

      alert('Zadanie przeanalizowane z uwzględnieniem Twoich wytycznych!');
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
      await updateDoc(doc(db, 'specialTasks', reviewTask.id), {
        status: 'graded',
        teacherFeedback: teacherFeedbackText
      });
      alert('Ocena i komentarz zostały zapisane!');
      setReviewTask(null);
      await loadData();
    } catch (e: any) {
      console.error(e);
      alert('Błąd podczas zapisywania oceny.');
    } finally {
      setIsSavingReview(false);
    }
  };

  // Filtered tasks for Teacher
  const filteredTasks = tasks.filter(t => {
    if (filterStudentId !== 'all' && t.studentId !== filterStudentId) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    return true;
  });

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

        {isTeacher && (
          <div className="flex gap-2">
            <Button
              onClick={() => setActiveTab('list')}
              variant={activeTab === 'list' ? 'primary' : 'secondary'}
              className="flex items-center gap-2 text-sm"
            >
              <FileText size={16} />
              Lista prac ({tasks.length})
            </Button>
            <Button
              onClick={() => setActiveTab('create')}
              variant={activeTab === 'create' ? 'primary' : 'secondary'}
              className="flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              Przypisz pracę domową
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
                {activeTask.type === 'fill_in_the_blank' ? 'Znajdź błędy w zdaniach' : 'Tłumaczenie zdań'}
              </span>
              <h2 className="text-xl font-bold text-white mt-2">{activeTask.title}</h2>
              {activeTask.instructions && (
                <p className="text-sm text-gray-300 mt-1">{activeTask.instructions}</p>
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
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40 animate-bounce">
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
                      <span className={res.isCorrect ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {res.score !== undefined ? `${res.score}%` : (res.isCorrect ? 'Poprawne' : 'Do poprawy')}
                      </span>
                    </div>
                    {activeTask.type === 'fill_in_the_blank' ? (
                      <>
                        <p className="text-sm text-red-300">Błędne zdanie: {res.incorrectSentence}</p>
                        <p className="text-sm text-gray-200">Twoja odpowiedź: <span className="text-primary font-medium">{res.studentAnswer || '(brak)'}</span></p>
                        <p className="text-sm text-emerald-400">Poprawna wersja: {res.correctSentence}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-300">Zdanie PL: {res.polishSentence}</p>
                        <p className="text-sm text-gray-200">Twoja odpowiedź: <span className="text-primary font-medium">{res.studentAnswer || '(brak)'}</span></p>
                        <p className="text-sm text-emerald-400">Wzorcowe tłumaczenie: {res.correctTranslation}</p>
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
                          className="text-xs text-amber-400 hover:underline flex items-center gap-1"
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
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
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

      {/* ---------------- TEACHER CREATE HOMEWORK WORKSPACE ---------------- */}
      {isTeacher && activeTab === 'create' && !activeTask && (
        <Card className="liquid-glass p-6 space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <Plus className="text-primary" size={22} />
            Kreator Nowej Pracy Domowej
          </h2>

          {/* 1. HIGHLIGHTED STEP 1: Wybierz kursanta */}
          <div className={`p-5 rounded-2xl border-2 transition-all space-y-4 ${
            selectedStudentId 
              ? 'bg-primary/10 border-primary shadow-[0_0_25px_rgba(114,240,180,0.25)]' 
              : 'bg-amber-500/10 border-amber-400 animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.25)]'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${selectedStudentId ? 'bg-primary text-base-100' : 'bg-amber-500 text-base-100'}`}>
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
                  <div className="flex items-center gap-3 bg-base-100/90 border border-primary/40 px-3.5 py-1.5 rounded-xl text-xs">
                    <span className="text-white font-bold flex items-center gap-1.5">
                      👤 {selectedStudent?.firstName ? `${selectedStudent.firstName} ${selectedStudent.lastName || ''}` : selectedStudent?.username}
                    </span>
                    <span className="px-2 py-0.5 bg-primary/20 text-primary font-mono font-bold rounded-md">
                      🎯 Poziom: {selectedStudent?.level || 'B1-B2'}
                    </span>
                    <span className="text-gray-300">
                      📚 Lekcje: <strong className="text-white">{studentLessons.length}</strong>
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-200 mb-1.5">
                  Kursant docelowy <span className="text-red-400">*</span>
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
                <label className="block text-xs font-bold text-gray-200 mb-1.5">
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
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-semibold">
                <Sparkles size={16} className="text-amber-400 shrink-0" />
                <span>Najpierw wybierz kursanta z listy powyżej, aby automatycznie załadować jego poziom i historię lekcji!</span>
              </div>
            )}
          </div>

          {/* 2. Wybór typu pracy domowej */}
          <div>
            <label className="block text-sm font-bold text-gray-200 mb-2">
              2. Wybierz typ pracy domowej <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setHomeworkType('translation')}
                className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  homeworkType === 'translation'
                    ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(114,240,180,0.15)]'
                    : 'bg-base-200/60 border-white/5 hover:border-white/20'
                }`}
              >
                <div className={`p-2 rounded-lg ${homeworkType === 'translation' ? 'bg-primary text-base-100' : 'bg-base-300 text-gray-400'}`}>
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
                onClick={() => setHomeworkType('fill_in_the_blank')}
                className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  homeworkType === 'fill_in_the_blank'
                    ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(114,240,180,0.15)]'
                    : 'bg-base-200/60 border-white/5 hover:border-white/20'
                }`}
              >
                <div className={`p-2 rounded-lg ${homeworkType === 'fill_in_the_blank' ? 'bg-primary text-base-100' : 'bg-base-300 text-gray-400'}`}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">2. Znajdź błędy w zdaniach</h4>
                  <p className="text-xs text-content-muted mt-1">
                    Zestaw zdań z celowymi błędami. Zadaniem ucznia jest ich korekta i wpisanie poprawnej wersji.
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
                <label className="block text-xs font-bold text-gray-200 mb-1 flex items-center justify-between">
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

              {/* Źródło słownictwa */}
              <div>
                <label className="block text-xs font-bold text-gray-200 mb-1">
                  Źródło słownictwa do wygenerowania
                </label>
                <select
                  value={selectedLessonId}
                  onChange={(e) => setSelectedLessonId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-base-100 text-white border border-white/10 rounded-xl text-xs font-semibold focus:border-primary focus:outline-none"
                >
                  <option value="manual">✍️ Manualne (własny temat / słownictwo wpisane niżej)</option>
                  {studentLessons.length > 0 && (
                    <option value="all">
                      ⚡ Wszystkie lekcje kursanta (skumulowane słownictwo z {studentLessons.length} lekcji)
                    </option>
                  )}
                  {studentLessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      📖 Lekcja z dnia {new Date(lesson.date).toLocaleDateString()} - {lesson.topic || 'Bez tematu'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Temat (Manualnie) */}
              <div>
                <label className="block text-xs font-bold text-gray-200 mb-1">
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
                <label className="block text-xs font-bold text-gray-200 mb-1">
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
              <label className="block text-xs font-bold text-gray-200 mb-1">
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
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 font-semibold">
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
                        <button
                          type="button"
                          onClick={() => setTranslationItems(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
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
            {homeworkType === 'fill_in_the_blank' && (
              <div className="space-y-3">
                {errorCorrectionItems.length === 0 ? (
                  <p className="text-xs text-content-muted italic py-4 text-center border border-dashed border-white/10 rounded-xl">
                    Brak zdań. Wygeneruj je przyciskiem AI lub dodaj ręcznie.
                  </p>
                ) : (
                  errorCorrectionItems.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-base-200/60 border border-white/5 space-y-2 relative">
                      <div className="flex justify-between items-center text-xs font-mono font-bold text-primary mb-1">
                        <span>Zdanie z błędem #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => setErrorCorrectionItems(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-amber-400 mb-1">Tekst z lukami (użyj [BLANK_1] itd.)</label>
                          <textarea
                            rows={3}
                            value={item.textWithBlanks}
                            onChange={(e) => {
                              const updated = [...errorCorrectionItems];
                              updated[idx].textWithBlanks = e.target.value;
                              setErrorCorrectionItems(updated);
                            }}
                            placeholder="This is a [BLANK_1]..."
                            className="w-full px-3 py-1.5 bg-base-100 text-white border border-amber-500/30 rounded-lg text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-emerald-400 mb-1">Odpowiedzi (JSON format)</label>
                            <textarea
                              rows={3}
                              defaultValue={JSON.stringify(item.blanks, null, 2)}
                              onBlur={(e) => {
                                const updated = [...errorCorrectionItems];
                                try {
                                  updated[idx].blanks = JSON.parse(e.target.value);
                                  setErrorCorrectionItems(updated);
                                } catch(err) {
                                  // ignore invalid json
                                }
                              }}
                              placeholder='{ "BLANK_1": "word" }'
                              className="w-full px-3 py-1.5 bg-base-100 text-white border border-emerald-500/30 rounded-lg text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-content-muted mb-1">Dostępne słowa (po przecinku)</label>
                            <textarea
                              rows={3}
                              value={(item.availableWords || []).join(", ")}
                              onChange={(e) => {
                                const updated = [...errorCorrectionItems];
                                updated[idx].availableWords = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                                setErrorCorrectionItems(updated);
                              }}
                              placeholder="word1, word2, word3"
                              className="w-full px-3 py-1.5 bg-base-100 text-white border border-white/10 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setActiveTab('list')}>
              Anuluj
            </Button>
            <Button onClick={handleSaveHomework} className="flex items-center gap-2">
              <Send size={18} /> Przypisz pracę domową
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
            <Card className="text-center py-12">
              <BookOpen className="mx-auto text-content-muted mb-3 opacity-40" size={48} />
              <p className="text-base font-bold text-gray-300">Brak prac domowych</p>
              <p className="text-xs text-content-muted mt-1">
                {isTeacher
                  ? 'Nie przypisano jeszcze żadnej pracy domowej. Kliknij "Przypisz pracę domową", aby stworzyć pierwsze zadanie.'
                  : 'Nie masz obecnie żadnych oczekujących prac domowych do rozwiązania.'}
              </p>
            </Card>
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
                        ? 'border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                        : isGraded
                        ? 'border-primary/40'
                        : 'border-white/10'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-base-300 text-primary">
                        {task.type === 'fill_in_the_blank' ? 'Znajdź błędy' : 'Tłumaczenie zdań'}
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isSubmitted
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : isGraded
                            ? 'bg-primary/20 text-primary'
                            : 'bg-amber-500/20 text-amber-300'
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

                    <div className="flex items-center justify-between text-[11px] text-content-muted pt-3 border-t border-white/5 mt-2">
                      <span>{task.sentences?.length || 0} zdań</span>
                      {task.dueDate && <span>Termin: {task.dueDate}</span>}
                    </div>

                    {/* Teacher Feedback Banner if graded */}
                    {isGraded && task.teacherFeedback && (
                      <div className="mt-3 p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary space-y-1">
                        <strong className="block">Komentarz nauczyciela:</strong>
                        <p className="text-gray-200">{task.teacherFeedback}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-4 flex items-center justify-end gap-2">
                      {isTeacher ? (
                        <>
                          <Button
                            size="sm"
                            variant={isSubmitted ? 'primary' : 'secondary'}
                            onClick={() => {
                              setReviewTask(task);
                              setTeacherFeedbackText(task.teacherFeedback || '');
                            }}
                            className="text-xs flex items-center gap-1"
                          >
                            <FileText size={14} />
                            {isSubmitted ? 'Sprawdź / Oceń' : 'Podgląd zadania'}
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task.id!)}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Usuń pracę domową"
                          >
                            <Trash2 size={16} />
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

        </div>
      )}

      {/* ---------------- TEACHER REVIEW & GRADING MODAL ---------------- */}
      {reviewTask && (
        <div className="fixed inset-0 bg-base-100/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
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
                const isTranslation = (reviewTask.type || 'translation') === 'translation';

                return (
                  <div key={idx} className="p-4 rounded-xl bg-base-200/60 border border-white/5 space-y-2">
                    <div className="flex justify-between items-center text-xs font-mono text-content-muted">
                      <span>Zdanie #{idx + 1}</span>
                      {evalItem?.score !== undefined && (
                        <span className="text-primary font-bold">Wynik AI: {Number.isNaN(Number(evalItem.score)) ? 0 : evalItem.score}%</span>
                      )}
                    </div>

                    {isTranslation ? (
                      <>
                        <p className="text-sm font-medium text-white">PL: {item.polishSentence}</p>
                        <p className="text-sm text-emerald-400">Wzorzec EN: {item.englishTranslation}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-amber-300">Z błędem: {item.incorrectSentence}</p>
                        <p className="text-sm text-emerald-400">Wzorzec: {item.correctSentence}</p>
                      </>
                    )}

                    <div className="p-2.5 rounded-lg bg-base-100 border border-white/10 text-sm">
                      <span className="text-xs font-semibold text-content-muted block mb-0.5">Odpowiedź kursanta:</span>
                      <span className={stAns ? 'text-primary font-medium' : 'text-red-400 italic'}>
                        {stAns || '(Brak odpowiedzi)'}
                      </span>
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
              <label className="block text-sm font-bold text-gray-200">
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
                <Button onClick={handleAnalyzeWithAI} isLoading={isAnalyzing} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700">
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

    </div>
  );
};

export default HomeworkScreen;
