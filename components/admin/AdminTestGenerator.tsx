import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { User, LessonRecord, StudentTest, TestQuestion } from '../../types';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { generateTest, modifyTest } from '../../services/geminiService';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, BookOpen, Calendar, ChevronRight, CheckCircle, X, ChevronUp, ChevronDown, Edit2, Trash2, Plus, Eye, Sparkles } from 'lucide-react';
import TestPreviewModal from './TestPreviewModal';
import TestEditModal from './TestEditModal';
import i18n from "i18next";
import { normalizePromptLines, parseNumberedItems } from '../../utils/testFormatters';

interface AdminTestGeneratorProps {
  user?: any;
  users?: any[];
}

const AdminTestGenerator: React.FC<AdminTestGeneratorProps> = ({ user: initialUser, users = [] }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>(initialUser?.id || '');
  const user = initialUser || users.find(u => u.id === selectedUserId);
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [isModifying, setIsModifying] = useState<boolean>(false);
  const [tasksCount, setTasksCount] = useState<number>(10);
  const [attemptsLimit, setAttemptsLimit] = useState<number>(1);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({
    translation: 5,
    fill_in_blank: 5,
    fill_in_blank_bank: 5,
    matching: 5,
    find_mistake: 5,
    multiple_choice: 5,
    writing: 1,
  });
  const [writingTopic, setWritingTopic] = useState('');


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = error => reject(error);
    });
  };

  const [sourceMode, setSourceMode] = useState<'lessons' | 'custom'>('lessons');
  const [customMaterial, setCustomMaterial] = useState('');
  const [driveFile, setDriveFile] = useState<{ id: string, name: string, mimeType: string, token: string } | null>(null);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const { connectGoogleDrive } = useAuth();

  const fetchDriveFiles = async () => {
    try {
      setDriveLoading(true);
      setDriveError('');
      setShowDriveModal(true);
      
      const token = await connectGoogleDrive();
      
      const res = await fetch('https://www.googleapis.com/drive/v3/files?q=mimeType="application/pdf" or mimeType="application/vnd.google-apps.document" or mimeType="text/plain"&orderBy=modifiedTime desc', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch files from Google Drive.');
      }
      
      const data = await res.json();
      setDriveFiles(data.files.map((f: any) => ({ ...f, token })));
    } catch (err: any) {
      setDriveError(err.message || 'Wystąpił błąd podczas pobierania plików.');
      if (err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup')) {
        alert('Aby zalogować się do Google Drive, otwórz aplikację w nowej karcie (przycisk w prawym górnym rogu) lub zezwól na wyskakujące okienka.');
      }
    } finally {
      setDriveLoading(false);
    }
  };

  const processDriveFile = (file: any) => {
    setDriveFile(file);
    setShowDriveModal(false);
    setFile(null); // Clear local file if drive file selected
  };
  
  const [testTitle, setTestTitle] = useState('');
  const [scope, setScope] = useState('');
  const [dueDate, setDueDate] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<TestQuestion[] | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [showAiFloatingBox, setShowAiFloatingBox] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [tests, setTests] = useState<StudentTest[]>([]);
  const [assignedPreviewTest, setAssignedPreviewTest] = useState<StudentTest | null>(null);
  const [assignedEditTest, setAssignedEditTest] = useState<StudentTest | null>(null);

  // Helper to compute automatic title & scope based on lessons/tests/files
  const computeAutoTitleAndScope = (
    currentSelectedLessons: string[],
    currentLessons: LessonRecord[],
    currentTests: StudentTest[],
    currentFile: File | null,
    currentDriveFile: { name: string } | null
  ) => {
    // Sort all lessons chronologically ascending (oldest = Lesson 1, newest = Lesson N)
    const sortedAsc = [...currentLessons].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const getLessonNumber = (lessonId: string): number => {
      const idx = sortedAsc.findIndex(l => l.id === lessonId);
      return idx !== -1 ? idx + 1 : 1;
    };

    let autoTitle = '';
    let autoScope = '';

    if (currentSelectedLessons.length > 0) {
      const selLessonNums = currentSelectedLessons
        .map(id => getLessonNumber(id))
        .sort((a, b) => a - b);

      if (currentSelectedLessons.length === 1) {
        const singleRecord = currentLessons.find(l => l.id === currentSelectedLessons[0]);
        const num = getLessonNumber(currentSelectedLessons[0]);
        if (singleRecord?.topic) {
          autoTitle = `Podsumowanie lekcji ${num}: ${singleRecord.topic}`;
        } else {
          autoTitle = `Podsumowanie lekcji ${num}`;
        }
      } else {
        autoTitle = `Podsumowanie lekcji ${selLessonNums.join(', ')}`;
      }

      // Generate scope from selected lessons' topics and summaries
      const selectedRecords = currentLessons.filter(l => currentSelectedLessons.includes(l.id));
      selectedRecords.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const scopeLines = selectedRecords.map(l => {
        const num = getLessonNumber(l.id);
        let line = `• Lekcja ${num} (${l.date}): ${l.topic || 'Bez tematu'}`;
        if (l.lessonSummary) {
          line += ` — ${l.lessonSummary}`;
        } else if (l.vocabularyText) {
          const shortVocab = l.vocabularyText.replace(/\n+/g, ' ').trim().substring(0, 80);
          line += ` — Słownictwo: ${shortVocab}${l.vocabularyText.length > 80 ? '...' : ''}`;
        }
        return line;
      });

      autoScope = `Zakres materiału z wybranych lekcji:\n${scopeLines.join('\n')}`;
    } else if (currentFile) {
      const nextNum = currentTests.length + 1;
      autoTitle = `Test ${nextNum} - ${currentFile.name}`;
      autoScope = `Zakres materiału z pliku: ${currentFile.name}`;
    } else if (currentDriveFile) {
      const nextNum = currentTests.length + 1;
      autoTitle = `Test ${nextNum} - ${currentDriveFile.name}`;
      autoScope = `Zakres materiału z Google Drive: ${currentDriveFile.name}`;
    } else {
      const nextNum = currentTests.length + 1;
      autoTitle = `Test ${nextNum}`;
      autoScope = '';
    }

    return { autoTitle, autoScope };
  };

  useEffect(() => {
    if(user?.id) { 
      setSelectedLessons([]);
      fetchLessons(); 
      fetchTests(); 
    }
  }, [user?.id]);

  // Auto-generate testTitle and scope when selected lessons, files, or existing tests change
  useEffect(() => {
    const { autoTitle, autoScope } = computeAutoTitleAndScope(
      selectedLessons,
      lessons,
      tests,
      file,
      driveFile
    );
    setTestTitle(autoTitle);
    setScope(autoScope);
  }, [selectedLessons, lessons, tests.length, file, driveFile]);

  const fetchLessons = async () => {
    if (!user?.id) return;
    try {
      const q = query(collection(db, `users/${user.id}/lessonRecords`));
      const snap = await getDocs(q);
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as LessonRecord));
      fetched.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setLessons(fetched);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTests = async () => {
    if (!user?.id) return;
    try {
      const q = query(collection(db, `users/${user.id}/tests`));
      const snap = await getDocs(q);
      const testsFetched = snap.docs.map(d => ({
        ...d.data(),
        id: d.id,
        studentId: user.id,
        studentName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
        studentEmail: user.email
      } as StudentTest));
      testsFetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTests(testsFetched);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTest = async (testId: string) => {
    if (!user?.id || !testId) return;
    if (!window.confirm(i18n.t("Czy na pewno chcesz usunąć ten przypisany test? Kursant nie będzie go już widział."))) return;
    try {
      await deleteDoc(doc(db, `users/${user.id}/tests`, testId));
      setTests(prev => prev.filter(t => t.id !== testId));
    } catch (err) {
      console.error(err);
      alert(i18n.t("Błąd podczas usuwania testu"));
    }
  };

  const removeQuestion = (index: number) => {
    if (!generatedQuestions) return;
    if (generatedQuestions.length <= 1) {
      alert(i18n.t("Test musi zawierać przynajmniej jedno pytanie."));
      return;
    }
    const newQuestions = generatedQuestions.filter((_, idx) => idx !== index);
    setGeneratedQuestions(newQuestions);
  };

  const addCustomQuestion = () => {
    if (!generatedQuestions) return;
    const newQ: TestQuestion = {
      id: Math.random().toString(36).substring(2, 9),
      type: (selectedTypes[0] as any) || 'translation',
      instruction: 'Przetłumacz zdanie na język angielski:',
      prompt: 'Wpisz treść nowego pytania...',
      correctAnswer: 'Przykładowa odpowiedź',
      options: []
    };
    setGeneratedQuestions([...generatedQuestions, newQ]);
  };

  const handleGenerate = async () => {
    let currentScope = scope;
    if (selectedTypes.includes('writing')) {
      if (!writingTopic) return alert("Temat writingu jest wymagany, aby wygenerować test z tym typem zadania.");
      currentScope = scope + "\n\n[TEMAT WRITINGU I WYMOGI (np. limit znaków)]: " + writingTopic;
    }
    
    let activeTitle = testTitle.trim();
    if (!activeTitle) {
      const { autoTitle } = computeAutoTitleAndScope(selectedLessons, lessons, tests, file, driveFile);
      activeTitle = autoTitle || `Test ${tests.length + 1}`;
      setTestTitle(activeTitle);
    }
    if (!activeTitle) return alert("Podaj tytuł testu");
    if (selectedTypes.length === 0) return alert("Wybierz przynajmniej jeden typ zadań");
    setIsGenerating(true);
    
    try {
      const selectedLessonRecords = lessons.filter(l => selectedLessons.includes(l.id));
      const lessonContext = selectedLessonRecords.map((lr, idx) => 
        `Lesson ${lr.date}: Topic: ${lr.topic}. Summary: ${lr.lessonSummary || ''}. Words: ${lr.vocabularyText || ''}`
      ).join('\n\n');
      
      const allLessonsContext = lessons.map((lr, idx) => 
        `Lesson ${lr.date}: Topic: ${lr.topic}. Summary: ${lr.lessonSummary || ''}. Words: ${lr.vocabularyText || ''}`
      ).join('\n\n');
      
      const profile = `Imię: ${user.firstName || ''}, Zainteresowania/Opis: ${user.description || ''}`;
      
      let fileData = null;
      if (file) {
        const base64Data = await getBase64(file);
        let mimeType = 'text/plain';
        if (file.name.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (file.name.endsWith('.md')) mimeType = 'text/markdown';
        else if (file.name.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        
        fileData = { data: base64Data, mimeType };
      }

      const questions = await generateTest(
        user.level || 'B1', 
        activeTitle, 
        currentScope, 
        profile, 
        lessonContext, 
        allLessonsContext, 
        tasksCount, 
        attemptsLimit, 
        selectedTypes, 
        fileData, 
        driveFile ? { id: driveFile.id, mimeType: driveFile.mimeType, token: driveFile.token } : undefined,
        typeCounts
      );
      
      // Ensure IDs and normalized linebreaks
      const withIds = questions.map(q => ({
        ...q,
        id: Math.random().toString(36).substring(2, 9),
        prompt: normalizePromptLines(q.prompt),
        correctAnswer: normalizePromptLines(q.correctAnswer)
      }));
      setGeneratedQuestions(withIds);
      setIsPreviewModalOpen(true);
    } catch (err) {
      alert("Błąd generowania testu");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleModifyTest = async () => {
    if (!generatedQuestions || !feedback) return;
    setIsModifying(true);
    try {
      const selectedLessonRecords = lessons.filter(l => selectedLessons.includes(l.id));
      const lessonContext = selectedLessonRecords.map((lr, idx) => 
        `Lesson ${lr.date}: Topic: ${lr.topic}. Summary: ${lr.lessonSummary || ''}. Words: ${lr.vocabularyText || ''}`
      ).join('\n\n');
      const profile = `Imię: ${user.firstName || ''}, Opis: ${user.description || ''}`;
      
      const newQuestions = await modifyTest(generatedQuestions, feedback, user.level || 'B1', profile, lessonContext);
      const withIds = newQuestions.map(q => ({
        ...q,
        id: Math.random().toString(36).substring(2, 9),
        prompt: normalizePromptLines(q.prompt),
        correctAnswer: normalizePromptLines(q.correctAnswer)
      }));
      setGeneratedQuestions(withIds);
      setFeedback('');
    } catch (err) {
      alert("Błąd podczas modyfikacji testu");
      console.error(err);
    } finally {
      setIsModifying(false);
    }
  };

  const handleSaveTest = async () => {
    if (!generatedQuestions || !user.id || !dueDate) return alert("Wybierz datę wykonania testu!");
    setIsSaving(true);
    
    try {
      const newTest: Omit<StudentTest, 'id'> = {
        studentId: user.id,
        title: testTitle,
        scope,
        dueDate,
        createdAt: new Date().toISOString(),
        status: 'pending',
        questions: generatedQuestions,
        maxScore: generatedQuestions.length,
        attemptsLimit,
        attemptsUsed: 0,
      };
      
      await addDoc(collection(db, `users/${user.id}/tests`), newTest);
      setGeneratedQuestions(null);
      setIsPreviewModalOpen(false);
      setTestTitle('');
      setScope('');
      setDueDate('');
      setSelectedLessons([]);
      fetchTests();
      alert("Test przypisany pomyślnie!");
    } catch (err) {
      console.error(err);
      alert("Błąd przypisywania testu");
    } finally {
      setIsSaving(false);
    }
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (!generatedQuestions) return;
    const newQuestions = [...generatedQuestions];
    if (direction === 'up' && index > 0) {
      const temp = newQuestions[index];
      newQuestions[index] = newQuestions[index - 1];
      newQuestions[index - 1] = temp;
    } else if (direction === 'down' && index < newQuestions.length - 1) {
      const temp = newQuestions[index];
      newQuestions[index] = newQuestions[index + 1];
      newQuestions[index + 1] = temp;
    }
    setGeneratedQuestions(newQuestions);
  };

  const updateQuestionPrompt = (index: number, newPrompt: string) => {
    if (!generatedQuestions) return;
    const newQuestions = [...generatedQuestions];
    newQuestions[index].prompt = newPrompt;
    setGeneratedQuestions(newQuestions);
  };

  const toggleLesson = (id: string) => {
    setSelectedLessons(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };


  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (sourceIndex === targetIndex || isNaN(sourceIndex) || !generatedQuestions) return;
    
    const newQuestions = [...generatedQuestions];
    const [removed] = newQuestions.splice(sourceIndex, 1);
    newQuestions.splice(targetIndex, 0, removed);
    setGeneratedQuestions(newQuestions);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="space-y-8">
      {(!initialUser && users.length > 0) && (
        <Card className="p-6 bg-base-200/50">
          <label className="block text-sm font-bold text-content-muted mb-2">{i18n.t("Wybierz kursanta")}</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full bg-base-100 border border-white/10 rounded-xl p-3 outline-none focus:border-primary/50 text-white font-medium"
          >
            <option value="">{i18n.t("-- Wybierz kursanta --")}</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username}
              </option>
            ))}
          </select>
        </Card>
      )}
      {!user ? (
         <div className="text-center p-8 text-content-muted">{i18n.t("Proszę wybrać kursanta, aby wygenerować test.")}</div>
      ) : (
        <div className="space-y-8">
      {/* Lesson Selection Modal */}
      {isLessonModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto">
          <div className="w-full max-w-4xl my-auto">
            <Card className="p-0 border border-white/10 shadow-2xl overflow-hidden flex flex-col h-[80vh] bg-base-100">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-base-200/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{i18n.t("Historia lekcji")}</h3>
                    <p className="text-sm text-content-muted/80">{i18n.t("Wybierz lekcje, które posłużą jako kontekst do testu")}</p>
                  </div>
                </div>
                <button onClick={() => setIsLessonModalOpen(false)} className="text-content-muted hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {lessons.map(l => {
                  const isSelected = selectedLessons.includes(l.id);
                  return (
                    <div 
                      key={l.id} 
                      onClick={() => toggleLesson(l.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 ${isSelected ? 'bg-primary/10 border-primary/50 shadow-[0_0_15px_rgba(114,240,180,0.15)]' : 'bg-base-200/20 border-transparent hover:border-primary/30 hover:bg-base-200/40'}`}
                    >
                      <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary text-black' : 'border-content-muted/30'}`}>
                        {isSelected && <CheckCircle className="w-4 h-4" />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-primary px-2 py-1 rounded bg-primary/10 w-fit">
                            <Calendar className="w-3 h-3" />
                            {l.date}
                          </span>
                          <h4 className="font-bold text-base text-white">{l.topic}</h4>
                        </div>
                        
                        {(l.lessonSummary || l.vocabularyText || l.thingsToImprove) && (
                          <div className="text-sm text-content-muted mt-2 space-y-2">
                            {l.lessonSummary && (
                              <div className="line-clamp-2 border-l-2 border-white/10 pl-3">
                                <span className="text-xs font-bold uppercase text-white/50 block mb-0.5">{i18n.t("Podsumowanie")}</span>
                                {l.lessonSummary}
                              </div>
                            )}
                            {l.vocabularyText && !l.lessonSummary && (
                              <div className="line-clamp-2 border-l-2 border-white/10 pl-3 font-mono">
                                <span className="text-xs font-bold uppercase text-white/50 block mb-0.5">{i18n.t("Słownictwo")}</span>
                                {l.vocabularyText}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {lessons.length === 0 && (
                  <div className="text-center text-content-muted p-10 bg-base-100/50 rounded-xl border border-white/5">
                    <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    
                                                                      {i18n.t("Brak historii lekcji dla tego kursanta")}
                                                                    </div>
                )}
              </div>
              
              <div className="p-6 border-t border-white/5 bg-base-200/30 flex justify-between items-center">
                <div className="text-sm font-bold text-primary">
                  
                                                                {i18n.t("Wybrano lekcji:")} {selectedLessons.length}
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setIsLessonModalOpen(false)}>
                    
                                                                      {i18n.t("Zamknij")}
                                                                    </Button>
                  <Button onClick={() => setIsLessonModalOpen(false)} className="bg-primary text-black hover:bg-primary/90">
                    
                                                                      {i18n.t("Zatwierdź Wybór")}
                                                                    </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
      
      {/* Test Preview & Edit Modal */}
      {isPreviewModalOpen && generatedQuestions && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="w-full max-w-5xl my-auto relative">
            <Card className="p-0 border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] bg-base-100 relative">
              {/* Header Bar */}
              <div className="p-4 sm:p-6 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 bg-base-200/50 sticky top-0 z-20 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{i18n.t("Podgląd i Edycja Testu")}</h3>
                    <p className="text-xs text-content-muted">{i18n.t("Zadań w teście:")} <span className="font-bold text-primary">{generatedQuestions.length}</span></p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-base-100 border border-white/10 rounded-xl p-1.5 px-3">
                    <span className="text-xs font-bold text-content-muted shrink-0">{i18n.t("Termin:")}</span>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="bg-transparent text-sm text-white outline-none cursor-pointer font-medium"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>

                  <Button
                    onClick={() => setShowAiFloatingBox(prev => !prev)}
                    variant="secondary"
                    className={`gap-1.5 text-xs py-2 px-3 border-primary/30 transition-all ${showAiFloatingBox ? 'bg-primary/20 text-primary border-primary' : 'hover:bg-primary/10 text-primary'}`}
                  >
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>{i18n.t("Dopracuj z AI")}</span>
                  </Button>

                  <Button onClick={handleSaveTest} isLoading={isSaving} className="bg-primary text-black hover:bg-primary/90 px-5 py-2 text-sm font-bold shadow-lg shadow-primary/20">
                    {i18n.t("Przypisz Test")}
                  </Button>

                  <button onClick={() => setIsPreviewModalOpen(false)} className="text-content-muted hover:text-white transition-colors p-2">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Scrollable Questions Content */}
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6 pb-20">
                {generatedQuestions.map((q, i) => (
                  <div 
                    key={q.id} 
                    className="p-4 md:p-6 bg-base-200/40 backdrop-blur-md border border-white/10 rounded-xl space-y-4 relative group transition-all hover:border-primary/50"
                  >
                    <div className="flex items-start gap-4 md:gap-6">
                      <div className="font-bold text-primary text-lg w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 space-y-3 w-full overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="text-sm font-bold text-content-muted uppercase tracking-wider">
                            {q.type === 'multiple_choice' ? 'Wielokrotny wybór' 
                              : q.type === 'fill_in_blank_bank' ? 'Luki z banku słów (rozsypka)' 
                              : q.type === 'fill_in_blank' ? 'Luki' 
                              : q.type === 'matching' ? 'Łączenie w pary' 
                              : q.type === 'writing' ? 'Writing' 
                              : q.type === 'find_mistake' ? 'Poprawne zdanie' 
                              : 'Tłumaczenie'}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => moveQuestion(i, 'up')} disabled={i === 0} className="p-2 rounded-lg bg-base-300 text-content hover:bg-white/10 disabled:opacity-30 transition-colors">
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button onClick={() => moveQuestion(i, 'down')} disabled={i === generatedQuestions.length - 1} className="p-2 rounded-lg bg-base-300 text-content hover:bg-white/10 disabled:opacity-30 transition-colors">
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <button onClick={() => removeQuestion(i)} className="p-2 rounded-lg bg-base-300 text-content hover:text-red-400 hover:bg-red-400/10 transition-colors" title={i18n.t("Usuń pytanie")}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-bold text-content-muted mb-2 uppercase tracking-wider">{i18n.t("Treść Pytania / Przykłady")}</label>
                          <div className="space-y-3">
                            {q.instruction && (
                              <input 
                                value={q.instruction}
                                onChange={(e) => {
                                  const newQ = [...generatedQuestions];
                                  newQ[i].instruction = e.target.value;
                                  setGeneratedQuestions(newQ);
                                }}
                                className="w-full bg-base-100 border border-white/10 rounded-lg p-2.5 text-primary text-sm font-bold outline-none focus:border-primary/50"
                                placeholder={i18n.t("Polecenie")}
                              />
                            )}

                            {(q.type === 'translation' || q.type === 'fill_in_blank') ? (
                              <div className="space-y-3">
                                {parseNumberedItems(q.prompt).map((item, sIdx) => (
                                  <div key={sIdx} className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                                    {/* Treść zdania z opcją bezpośredniej edycji */}
                                    <div className="flex items-start gap-2.5">
                                      <span className="w-6 h-6 rounded bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-2">
                                        {item.num}
                                      </span>
                                      <input
                                        type="text"
                                        value={item.text}
                                        onChange={(e) => {
                                          const items = parseNumberedItems(q.prompt);
                                          items[sIdx].text = e.target.value;
                                          const newPrompt = items.map(it => `${it.num}. ${it.text}`).join('\n');
                                          updateQuestionPrompt(i, newPrompt);
                                        }}
                                        className="w-full bg-base-100 border border-white/10 rounded-lg p-2.5 text-white text-sm md:text-base font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all cursor-text"
                                        placeholder={`Zdanie ${item.num}`}
                                      />
                                    </div>

                                    {/* Podgląd pola na odpowiedź kursanta */}
                                    <div className="pt-1">
                                      <label className="block text-xs font-medium text-content-muted/80 mb-1">
                                        Pole na wpisanie odpowiedzi kursanta dla zdania {item.num}:
                                      </label>
                                      <input
                                        type="text"
                                        readOnly
                                        placeholder={`[ Miejsce na odpowiedź kursanta dla zdania ${item.num} ]`}
                                        className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs md:text-sm text-content-muted/60 placeholder:text-content-muted/40 font-medium cursor-text"
                                      />
                                    </div>
                                  </div>
                                ))}

                                <details className="text-xs text-content-muted cursor-pointer pt-1">
                                  <summary className="hover:text-white font-medium select-none">✏️ Edytuj surowy tekst zbiorczo (opcjonalnie)</summary>
                                  <textarea
                                    value={q.prompt}
                                    onChange={(e) => updateQuestionPrompt(i, e.target.value)}
                                    className="w-full mt-2 bg-base-100 border border-white/10 rounded-lg p-2.5 text-white text-xs outline-none focus:border-primary/50 min-h-[80px] cursor-text"
                                  />
                                </details>
                              </div>
                            ) : (
                              <textarea
                                value={q.prompt}
                                onChange={(e) => updateQuestionPrompt(i, e.target.value)}
                                className="w-full bg-base-100 border border-white/10 rounded-lg p-3 text-white text-base outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all resize-y min-h-[100px] leading-relaxed cursor-text"
                              />
                            )}
                          </div>
                        </div>
                        
                        {(q.type === 'multiple_choice' || q.type === 'find_mistake') && q.options && (
                          <div className="space-y-3">
                            <label className="block text-xs font-bold text-content-muted uppercase tracking-wider">{i18n.t("Opcje odpowiedzi (tylko odczyt)")}</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {q.options.map((opt, j) => (
                                <div key={j} className={`p-4 rounded-xl border text-base font-medium transition-all ${opt === q.correctAnswer ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(114,240,180,0.1)] text-primary" : "border-white/10 bg-base-100 text-content-muted"}`}>
                                  {opt}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {q.type === 'matching' && q.options && (
                          <div className="space-y-3">
                            <label className="block text-xs font-bold text-content-muted uppercase tracking-wider">{i18n.t("Pary (tylko odczyt)")}</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {q.options.map((opt, j) => {
                                const parts = opt.split('=');
                                return (
                                  <div key={j} className="p-3 text-base bg-base-100 rounded-xl border border-white/10 flex items-center justify-between text-content-muted transition-all">
                                    <span className="font-medium">{parts[0]?.trim() || opt}</span>
                                    <span className="text-content-muted/50 mx-2">↔</span>
                                    <span className="text-primary font-medium">{parts[1]?.trim() || ''}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {q.type === 'fill_in_blank_bank' && (q.wordBank || q.options) && (
                          <div className="space-y-2">
                            <label className="block text-xs font-bold text-content-muted uppercase tracking-wider">{i18n.t("Bank słów (rozsypka)")}</label>
                            <div className="flex flex-wrap gap-2 p-3 bg-base-100 rounded-xl border border-white/10">
                              {(q.wordBank || q.options)?.map((w, j) => (
                                <span key={j} className="px-3 py-1 bg-primary/10 border border-primary/30 text-primary rounded-lg text-sm font-bold">
                                  {w}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {q.type !== 'writing' && (
                          <div className="flex flex-col sm:flex-row sm:items-start gap-2 mt-2 p-3.5 rounded-lg bg-primary/5 border border-primary/10">
                            <span className="text-xs font-bold uppercase text-primary tracking-wider shrink-0 mt-0.5">{i18n.t("Prawidłowa Odpowiedź:")}</span>
                            <span className="text-base font-medium text-white whitespace-pre-wrap">{q.correctAnswer}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                <div className="flex justify-center pt-2">
                  <Button onClick={addCustomQuestion} variant="secondary" className="gap-2 text-sm border-white/10">
                    <Plus className="w-4 h-4" />
                    {i18n.t("Dodaj własne zadanie")}
                  </Button>
                </div>
              </div>

              {/* Floating AI Assistant Box / Bubble */}
              <div className="absolute bottom-6 right-6 z-30 flex flex-col items-end gap-2 pointer-events-none">
                {showAiFloatingBox && (
                  <div className="pointer-events-auto w-80 sm:w-96 p-4 bg-base-900/95 backdrop-blur-2xl border border-primary/40 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.8)] space-y-3 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                        <MessageSquare className="w-4 h-4" />
                        {i18n.t("Asystent AI - Automatyczne poprawki")}
                      </span>
                      <button onClick={() => setShowAiFloatingBox(false)} className="text-content-muted hover:text-white text-xs p-1">✕</button>
                    </div>
                    <textarea
                      value={feedback}
                      onChange={e => setFeedback(e.target.value)}
                      className="w-full bg-base-100 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 h-20 resize-none"
                      placeholder={i18n.t("Napisz do AI co poprawić (np. 'zrób łatwiejsze słownictwo w zadaniu 2')")}
                    />
                    <div className="flex justify-end gap-2">
                      <Button onClick={handleModifyTest} isLoading={isModifying} disabled={!feedback} className="bg-primary text-black hover:bg-primary/90 text-xs py-1.5 px-4 font-bold">
                        {i18n.t("Popraw Test AI")}
                      </Button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setShowAiFloatingBox(prev => !prev)}
                  className="pointer-events-auto flex items-center gap-2 px-4 py-3 bg-base-200/90 hover:bg-primary/20 text-primary border border-primary/40 rounded-full shadow-2xl backdrop-blur-xl transition-all duration-300 hover:scale-105 active:scale-95 group"
                  title={i18n.t("Poproś AI o poprawki")}
                >
                  <Sparkles className="w-5 h-5 text-primary group-hover:rotate-12 transition-transform" />
                  <span className="text-xs font-bold text-white">{i18n.t("Asystent AI")}</span>
                </button>
              </div>
            </Card>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6 bg-base-200/40 backdrop-blur-md border border-white/10">
          <h2 className="text-xl font-bold mb-4">{i18n.t("Wygeneruj Nowy Test")}</h2>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-bold text-content-muted">{i18n.t("Tytuł Testu")}</label>
                <button
                  type="button"
                  onClick={() => {
                    const { autoTitle, autoScope } = computeAutoTitleAndScope(selectedLessons, lessons, tests, file, driveFile);
                    setTestTitle(autoTitle);
                    setScope(autoScope);
                  }}
                  className="text-xs text-primary/90 hover:text-primary font-bold flex items-center gap-1 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded transition-all"
                  title="Wygeneruj automatycznie tytuł i zakres na podstawie wybranych lekcji/źródeł"
                >
                  <Sparkles className="w-3 h-3" />
                  Auto-uzupełnij
                </button>
              </div>
              <input
                type="text"
                value={testTitle}
                onChange={e => setTestTitle(e.target.value)}
                className="w-full bg-base-100 border border-base-300 rounded-lg p-2.5 outline-none focus:border-primary/50 text-white font-medium"
                placeholder={i18n.t("np. Podsumowanie lekcji 1, 2")}
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-bold text-content-muted">{i18n.t("Zakres Materiału / Instrukcje")}</label>
                {selectedLessons.length > 0 && (
                  <span className="text-[11px] text-primary font-mono font-bold bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                    Oparty o {selectedLessons.length} lekcji
                  </span>
                )}
              </div>
              <textarea
                value={scope}
                onChange={e => setScope(e.target.value)}
                className="w-full bg-base-100 border border-base-300 rounded-lg p-2.5 outline-none focus:border-primary/50 h-28 text-white text-sm leading-relaxed"
                placeholder={i18n.t("np. Czas Present Simple i słownictwo z podróży")}
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Źródła materiału do testu")}</label>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
                <div className="relative overflow-hidden w-full sm:w-auto">
                  <input
                    type="file"
                    accept=".pdf,.docx,.md,.txt"
                    onChange={(e) => { handleFileChange(e); setDriveFile(null); }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Button variant="secondary" className="w-full sm:w-auto whitespace-nowrap flex justify-center">
                    
                                                                      {i18n.t("Wybierz plik")}
                                                                    </Button>
                </div>
                
                <Button onClick={fetchDriveFiles} variant="secondary" className="w-full sm:w-auto whitespace-nowrap flex justify-center items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  
                                                                {i18n.t("Google Drive")}
                                                              </Button>
                
                <Button onClick={() => setIsLessonModalOpen(true)} variant="secondary" className="w-full sm:w-auto whitespace-nowrap flex justify-center items-center gap-2 text-primary border-primary/30 bg-primary/5 hover:bg-primary/10">
                  <BookOpen className="w-4 h-4" />
                  
                                                                {i18n.t("Historia lekcji")} {selectedLessons.length > 0 && `(${selectedLessons.length})`}
                </Button>
              </div>
              
              {file && <div className="text-xs text-primary mt-2 flex items-center gap-2 bg-primary/10 p-2 rounded-lg w-fit border border-primary/20">{i18n.t("Wybór z dysku:")} {file.name}</div>}
              {driveFile && (
                <div className="text-xs text-primary mt-2 flex items-center gap-2 bg-primary/10 p-2 rounded-lg w-fit border border-primary/20">
                  
                                                                {i18n.t("Google Drive:")} {driveFile.name}
                  <button onClick={() => setDriveFile(null)} className="ml-2 hover:text-white transition-colors">✕</button>
                </div>
              )}
              {selectedLessons.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-bold text-content-muted uppercase">{i18n.t("Wybrane lekcje (")}{selectedLessons.length}):</div>
                  <div className="flex flex-col gap-2">
                    {lessons.filter(l => selectedLessons.includes(l.id)).map(l => (
                      <div key={l.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-primary/20 bg-primary/5 text-sm">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="shrink-0 inline-flex items-center gap-1.5 font-mono text-xs text-primary px-2 py-1 rounded bg-primary/10">
                            <Calendar className="w-3 h-3" />
                            {l.date}
                          </span>
                          <span className="font-medium text-white truncate">{l.topic}</span>
                        </div>
                        <button 
                          onClick={() => toggleLesson(l.id)} 
                          className="shrink-0 p-1 rounded-md text-content-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          title={i18n.t("Usuń z wyboru")}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-content-muted mb-2">{i18n.t("Ilość zadań do testu:")} {tasksCount}</label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={tasksCount}
                  onChange={e => setTasksCount(parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-content-muted mt-1">
                  <span>1</span>
                  <span>20</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-content-muted mb-2">{i18n.t("Limit podejść")}</label>
                <select
                  value={attemptsLimit}
                  onChange={e => setAttemptsLimit(parseInt(e.target.value))}
                  className="w-full bg-base-100 border border-base-300 rounded-lg p-2.5 outline-none focus:border-primary/50 text-white"
                >
                  <option value="1">{i18n.t("1 podejście")}</option>
                  <option value="2">{i18n.t("2 podejścia")}</option>
                  <option value="3">{i18n.t("3 podejścia")}</option>
                  <option value="5">{i18n.t("5 podejść")}</option>
                  <option value="999">{i18n.t("Bez limitu")}</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-bold text-content-muted">{i18n.t("Typy zadań do wygenerowania i ich ilość")}</label>
                <span className="text-xs font-mono text-primary font-bold bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg">
                  {selectedTypes.length} {selectedTypes.length === 1 ? 'zadanie' : 'zadań'} ({selectedTypes.reduce((acc, t) => acc + (typeCounts[t] || 0), 0)} przykładów)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'translation', label: 'Tłumaczenia zdań', countLabel: 'Ilość zdań:' },
                  { id: 'fill_in_blank', label: 'Wpisywanie luk', countLabel: 'Ilość zdań:' },
                  { id: 'fill_in_blank_bank', label: 'Luki z banku słów (rozsypka)', countLabel: 'Ilość zdań:' },
                  { id: 'matching', label: 'Łączenie w pary', countLabel: 'Ilość par:' },
                  { id: 'find_mistake', label: 'Wybór poprawnego zdania', countLabel: 'Ilość zdań:' },
                  { id: 'multiple_choice', label: 'Wielokrotny wybór', countLabel: 'Ilość pytań:' },
                  { id: 'writing', label: 'Writing (otwarte)', countLabel: 'Ilość zadań:' },
                ].map(type => {
                  const isSelected = selectedTypes.includes(type.id);
                  return (
                    <div 
                      key={type.id} 
                      className={`p-3.5 md:p-4 rounded-xl border transition-all duration-300 flex flex-col justify-between min-h-[115px] ${
                        isSelected 
                          ? 'bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(114,240,180,0.12)] ring-1 ring-primary/50' 
                          : 'bg-base-200/60 backdrop-blur-md border-white/10 text-content-muted hover:border-primary/30 hover:text-white'
                      }`}
                    >
                      <label className="flex items-start gap-2.5 cursor-pointer font-bold text-sm select-none min-h-[42px]">
                        <input 
                          type="checkbox" 
                          className="sr-only"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTypes(prev => [...prev, type.id]);
                            } else {
                              setSelectedTypes(prev => prev.filter(t => t !== type.id));
                            }
                          }}
                        />
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isSelected ? 'border-primary bg-primary text-black font-extrabold' : 'border-white/20 bg-base-100'}`}>
                          {isSelected && <CheckCircle className="w-3.5 h-3.5" />}
                        </div>
                        <span className="text-white font-bold leading-snug pt-0.5">{type.label}</span>
                      </label>

                      <div className="mt-2.5 pt-2.5 border-t border-white/10 min-h-[42px] flex items-center justify-between gap-2">
                        {isSelected ? (
                          <>
                            <span className="text-xs text-content-muted font-semibold shrink-0">{type.countLabel}</span>
                            <div className="inline-flex items-center bg-black/60 border border-primary/40 rounded-lg p-1 shadow-inner shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = typeCounts[type.id] || 1;
                                  if (cur > 1) {
                                    setTypeCounts(prev => ({ ...prev, [type.id]: cur - 1 }));
                                  }
                                }}
                                disabled={(typeCounts[type.id] || 1) <= 1}
                                className="w-6 h-6 rounded-md bg-white/5 hover:bg-primary/20 text-white hover:text-primary disabled:opacity-25 flex items-center justify-center font-bold text-xs transition-all active:scale-95"
                              >
                                -
                              </button>
                              <span className="w-7 text-center font-mono font-extrabold text-primary text-xs select-none">
                                {typeCounts[type.id] || 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = typeCounts[type.id] || 1;
                                  if (cur < 30) {
                                    setTypeCounts(prev => ({ ...prev, [type.id]: cur + 1 }));
                                  }
                                }}
                                className="w-6 h-6 rounded-md bg-white/5 hover:bg-primary/20 text-white hover:text-primary flex items-center justify-center font-bold text-xs transition-all active:scale-95"
                              >
                                +
                              </button>
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-content-muted/30 italic font-normal">Niewybrane</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedTypes.includes('writing') && (
                <div className="mt-6 p-4 rounded-xl border border-primary/20 bg-primary/5">
                  <label className="block text-sm font-bold text-primary mb-2">{i18n.t("Temat writingu i wymagania (np. limit znaków)")}</label>
                  <textarea
                    value={writingTopic}
                    onChange={e => setWritingTopic(e.target.value)}
                    className="w-full bg-base-100 border border-white/10 rounded-lg p-3 outline-none focus:border-primary/50 text-white min-h-[100px]"
                    placeholder={i18n.t("Podaj temat, instrukcje i limit znaków dla zadania otwartego...")}
                  />
                  <p className="text-xs text-primary/70 mt-2">
                    {i18n.t("Uwaga: Zadanie to będzie miało zablokowane funkcje kopiowania, wklejania oraz autokorekty w panelu kursanta.")}
                  </p>
                </div>
              )}
            </div>

            <Button onClick={handleGenerate} isLoading={isGenerating} className="w-full" disabled={!testTitle || selectedTypes.length === 0}>

              

                                                    {i18n.t("Generuj Test za pomocą AI")}
                                                  </Button>
          </div>
        </Card>

        <div className="space-y-6">
          {generatedQuestions && (
            <Card className="p-6 bg-primary/5 border border-primary/20 flex flex-col items-center justify-center space-y-4">
              <h3 className="font-bold text-lg text-primary text-center">{i18n.t("Test wygenerowany pomyślnie! (")}{generatedQuestions.length}  {i18n.t("pytań)")}</h3>
              <p className="text-content-muted text-sm text-center">{i18n.t("Możesz teraz przejrzeć i edytować pytania przed przypisaniem testu kursantowi.")}</p>
              <Button onClick={() => setIsPreviewModalOpen(true)} className="bg-primary text-black hover:bg-primary/90 w-full sm:w-auto">
                
                                                          {i18n.t("Podgląd i edycja testu")}
                                                        </Button>
            </Card>
          )}

          <Card className="p-6 bg-base-200/40 backdrop-blur-md border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{i18n.t("Przypisane Testy")}</h3>
              <span className="text-xs text-content-muted font-mono">{tests.length} {i18n.t("testów")}</span>
            </div>
            <div className="space-y-3">
              {tests.map(test => (
                <div key={test.id} className="p-3 bg-base-100 rounded-xl border border-white/10 flex justify-between items-center hover:border-white/20 transition-all">
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="font-bold text-sm text-white truncate">{test.title}</div>
                    <div className="text-xs text-content-muted mt-0.5">
                      {i18n.t("Do:")} {test.dueDate} • {i18n.t("Pytań:")} {test.questions?.length || 0}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${test.status === 'pending' ? 'bg-orange-500/20 text-orange-400' : 'bg-primary/20 text-primary'}`}>
                      {test.status === 'pending' ? 'Oczekujący' : 'Zakończony'}
                    </span>
                    {test.status === 'graded' && <div className="text-xs font-mono font-bold text-primary">{test.score}/{test.maxScore}</div>}
                    
                    <button
                      onClick={() => setAssignedPreviewTest(test)}
                      className="p-1.5 rounded-lg text-content-muted hover:text-white hover:bg-white/10 transition-colors"
                      title={i18n.t("Podgląd testu")}
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setAssignedEditTest(test)}
                      className="p-1.5 rounded-lg text-content-muted hover:text-white hover:bg-white/10 transition-colors"
                      title={i18n.t("Edytuj test")}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => test.id && handleDeleteTest(test.id)}
                      className="p-1.5 rounded-lg text-content-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title={i18n.t("Usuń przypisany test")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {tests.length === 0 && <div className="text-sm text-content-muted text-center py-6">{i18n.t("Brak przypisanych testów dla tego kursanta")}</div>}
            </div>
          </Card>
        </div>
      </div>
    </div>
      )}

      {/* Modals for previewing and editing assigned tests */}
      <TestPreviewModal
        test={assignedPreviewTest}
        isOpen={!!assignedPreviewTest}
        onClose={() => setAssignedPreviewTest(null)}
      />

      <TestEditModal
        test={assignedEditTest}
        isOpen={!!assignedEditTest}
        onClose={() => setAssignedEditTest(null)}
        onSaved={fetchTests}
      />
    </div>
  );
};
export default AdminTestGenerator;
