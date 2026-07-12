import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { User, LessonRecord, StudentTest, TestQuestion } from '../../types';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { generateTest, modifyTest } from '../../services/geminiService';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, BookOpen, Calendar, ChevronRight, CheckCircle, X } from 'lucide-react';

interface AdminTestGeneratorProps {
  user: User;
}

const AdminTestGenerator: React.FC<AdminTestGeneratorProps> = ({ user }) => {
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [isModifying, setIsModifying] = useState<boolean>(false);
  const [tasksCount, setTasksCount] = useState<number>(10);
  const [attemptsLimit, setAttemptsLimit] = useState<number>(1);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['multiple_choice', 'fill_in_blank', 'translation', 'matching', 'writing']);


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
  
  const [isSaving, setIsSaving] = useState(false);
  const [tests, setTests] = useState<StudentTest[]>([]);

  useEffect(() => {
    fetchLessons();
    fetchTests();
  }, [user.id]);

  const fetchLessons = async () => {
    if (!user.id) return;
    try {
      const q = query(collection(db, `users/${user.id}/lessonRecords`), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as LessonRecord));
      fetched.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setLessons(fetched);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTests = async () => {
    if (!user.id) return;
    try {
      const q = query(collection(db, `users/${user.id}/tests`), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setTests(snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentTest)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerate = async () => {
    if (!testTitle) return alert("Podaj tytuł testu");
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

      const questions = await generateTest(user.level || 'B1', testTitle, scope, profile, lessonContext, allLessonsContext, tasksCount, attemptsLimit, selectedTypes, fileData, driveFile ? { id: driveFile.id, mimeType: driveFile.mimeType, token: driveFile.token } : undefined);
      
      // Ensure IDs
      const withIds = questions.map(q => ({ ...q, id: Math.random().toString(36).substring(2, 9) }));
      setGeneratedQuestions(withIds);
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
      const withIds = newQuestions.map(q => ({ ...q, id: Math.random().toString(36).substring(2, 9) }));
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

  const toggleLesson = (id: string) => {
    setSelectedLessons(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  return (
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
                    <h3 className="text-xl font-bold">Historia lekcji</h3>
                    <p className="text-sm text-content-muted/80">Wybierz lekcje, które posłużą jako kontekst do testu</p>
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
                                <span className="text-xs font-bold uppercase text-white/50 block mb-0.5">Podsumowanie</span>
                                {l.lessonSummary}
                              </div>
                            )}
                            {l.vocabularyText && !l.lessonSummary && (
                              <div className="line-clamp-2 border-l-2 border-white/10 pl-3 font-mono">
                                <span className="text-xs font-bold uppercase text-white/50 block mb-0.5">Słownictwo</span>
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
                    Brak historii lekcji dla tego kursanta
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t border-white/5 bg-base-200/30 flex justify-between items-center">
                <div className="text-sm font-bold text-primary">
                  Wybrano lekcji: {selectedLessons.length}
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setIsLessonModalOpen(false)}>
                    Zamknij
                  </Button>
                  <Button onClick={() => setIsLessonModalOpen(false)} className="bg-primary text-black hover:bg-primary/90">
                    Zatwierdź Wybór
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6 bg-base-200/40 backdrop-blur-md border border-white/10">
          <h2 className="text-xl font-bold mb-4">Wygeneruj Nowy Test</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-content-muted mb-1">Tytuł Testu</label>
              <input
                type="text"
                value={testTitle}
                onChange={e => setTestTitle(e.target.value)}
                className="w-full bg-base-100 border border-base-300 rounded-lg p-2.5 outline-none focus:border-primary/50"
                placeholder="np. Test Podsumowujący Miesiąc"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-content-muted mb-1">Zakres Materiału / Instrukcje (Opcjonalne)</label>
              <textarea
                value={scope}
                onChange={e => setScope(e.target.value)}
                className="w-full bg-base-100 border border-base-300 rounded-lg p-2.5 outline-none focus:border-primary/50 h-24"
                placeholder="np. Czas Present Simple i słownictwo z podróży"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-content-muted mb-1">Źródła materiału do testu</label>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
                <div className="relative overflow-hidden w-full sm:w-auto">
                  <input
                    type="file"
                    accept=".pdf,.docx,.md,.txt"
                    onChange={(e) => { handleFileChange(e); setDriveFile(null); }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Button variant="secondary" className="w-full sm:w-auto whitespace-nowrap flex justify-center">
                    Wybierz plik
                  </Button>
                </div>
                
                <Button onClick={fetchDriveFiles} variant="secondary" className="w-full sm:w-auto whitespace-nowrap flex justify-center items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Google Drive
                </Button>
                
                <Button onClick={() => setIsLessonModalOpen(true)} variant="secondary" className="w-full sm:w-auto whitespace-nowrap flex justify-center items-center gap-2 text-primary border-primary/30 bg-primary/5 hover:bg-primary/10">
                  <BookOpen className="w-4 h-4" />
                  Historia lekcji {selectedLessons.length > 0 && `(${selectedLessons.length})`}
                </Button>
              </div>
              
              {file && <div className="text-xs text-primary mt-2 flex items-center gap-2 bg-primary/10 p-2 rounded-lg w-fit border border-primary/20">Wybór z dysku: {file.name}</div>}
              {driveFile && (
                <div className="text-xs text-primary mt-2 flex items-center gap-2 bg-primary/10 p-2 rounded-lg w-fit border border-primary/20">
                  Google Drive: {driveFile.name}
                  <button onClick={() => setDriveFile(null)} className="ml-2 hover:text-white transition-colors">✕</button>
                </div>
              )}
              {selectedLessons.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-bold text-content-muted uppercase">Wybrane lekcje ({selectedLessons.length}):</div>
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
                          title="Usuń z wyboru"
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
                <label className="block text-sm font-bold text-content-muted mb-2">Ilość zadań do testu: {tasksCount}</label>
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
                <label className="block text-sm font-bold text-content-muted mb-2">Limit podejść</label>
                <select
                  value={attemptsLimit}
                  onChange={e => setAttemptsLimit(parseInt(e.target.value))}
                  className="w-full bg-base-100 border border-base-300 rounded-lg p-2.5 outline-none focus:border-primary/50 text-white"
                >
                  <option value="1">1 podejście</option>
                  <option value="2">2 podejścia</option>
                  <option value="3">3 podejścia</option>
                  <option value="5">5 podejść</option>
                  <option value="999">Bez limitu</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-content-muted mb-3">Typy zadań do wygenerowania</label>
              <div className="flex flex-wrap gap-3">
                {[
                  { id: 'multiple_choice', label: 'Wielokrotny wybór' },
                  { id: 'fill_in_blank', label: 'Wpisywanie luk' },
                  { id: 'translation', label: 'Tłumaczenia' },
                  { id: 'matching', label: 'Łączenie w pary' },
                  { id: 'writing', label: 'Writing (otwarte)' },
                ].map(type => {
                  const isSelected = selectedTypes.includes(type.id);
                  return (
                  <label 
                    key={type.id} 
                    className={`flex items-center gap-2 cursor-pointer px-5 py-3 rounded-xl border transition-all duration-300 font-bold text-sm select-none ${
                      isSelected 
                        ? 'bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(114,240,180,0.15)] ring-1 ring-primary/50' 
                        : 'bg-base-200/60 backdrop-blur-md border-white/10 text-content-muted hover:border-primary/30 hover:text-white'
                    }`}
                  >
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
                    {isSelected && <CheckCircle className="w-4 h-4" />}
                    {type.label}
                  </label>
                )})}
              </div>
            </div>

            <Button onClick={handleGenerate} isLoading={isGenerating} className="w-full" disabled={!testTitle || selectedTypes.length === 0}>

              Generuj Test za pomocą AI
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          {generatedQuestions && (
            <Card className="p-6 bg-primary/5 border border-primary/20">
              <h3 className="font-bold text-lg mb-4 text-primary">Podgląd Wygenerowanego Testu ({generatedQuestions.length} pytań)</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto mb-4 pr-2">
                {generatedQuestions.map((q, i) => (
                  <div key={q.id} className="bg-base-200 p-4 rounded-lg border border-white/5 text-sm">
                    <div className="font-bold text-content-muted mb-3 flex items-center justify-between">
                      <span>{i+1}. [{q.type === 'multiple_choice' ? 'Wielokrotny wybór' : q.type === 'fill_in_blank' ? 'Luki' : q.type === 'matching' ? 'Łączenie w pary' : q.type === 'writing' ? 'Writing' : 'Tłumaczenie'}]</span>
                      <span className="text-xs font-mono bg-base-300 px-2 py-0.5 rounded">ID: {q.id}</span>
                    </div>
                    <div className="mb-4 font-medium text-base">{q.prompt}</div>
                    
                    {/* Interactive-looking mockups */}
                    {q.type === 'multiple_choice' && q.options && (
                      <div className="space-y-2 mb-4">
                        {q.options.map((opt, j) => (
                          <label key={j} className={`flex items-center gap-3 p-3 rounded-lg border ${opt === q.correctAnswer ? "border-primary bg-primary/5" : "border-white/10 bg-base-100"}`}>
                            <input type="radio" disabled checked={opt === q.correctAnswer} className="accent-primary" />
                            <span className={opt === q.correctAnswer ? "text-primary font-medium" : "text-white"}>{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    
                    {q.type === 'fill_in_blank' && (
                      <div className="mb-4">
                        <input type="text" disabled placeholder="Uczeń wpisze tekst..." className="w-full bg-base-100 border border-white/10 rounded-lg p-3 text-white outline-none" />
                      </div>
                    )}

                    {q.type === 'translation' && (
                      <div className="mb-4">
                        <input type="text" disabled placeholder="Tłumaczenie..." className="w-full bg-base-100 border border-white/10 rounded-lg p-3 text-white outline-none" />
                      </div>
                    )}

                    {q.type === 'matching' && q.options && (
                      <div className="mb-4 grid grid-cols-2 gap-4">
                        {q.options.map((opt, j) => {
                           const parts = opt.split('=');
                           return (
                             <div key={j} className="col-span-2 sm:col-span-1 p-3 bg-base-100 rounded-lg border border-white/10 flex justify-between">
                               <span>{parts[0]?.trim() || opt}</span>
                               <span className="text-content-muted">↔</span>
                               <span className="text-primary">{parts[1]?.trim() || ''}</span>
                             </div>
                           )
                        })}
                      </div>
                    )}

                    {q.type === 'writing' && (
                      <div className="mb-4">
                        <textarea disabled placeholder="Pole do pisania dla ucznia (czysty tekst, bez wklejania)..." className="w-full bg-base-100 border border-white/10 rounded-lg p-3 text-white outline-none h-32 resize-none" />
                      </div>
                    )}

                    {q.type !== 'writing' && <div className="text-primary font-bold text-xs uppercase tracking-wide">Prawidłowa odpowiedź: <span className="text-white font-normal bg-base-300 px-2 py-1 rounded ml-1">{q.correctAnswer}</span></div>}
                  </div>
                ))}
              </div>
              
              <div className="pt-4 border-t border-white/10 mb-6">
                <label className="block text-sm font-bold text-content-muted mb-1 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  Asystent AI - Uwagi do testu
                </label>
                <div className="flex gap-2">
                  <textarea
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    className="flex-1 bg-base-100 border border-base-300 rounded-lg p-2.5 outline-none focus:border-primary/50 text-sm h-12"
                    placeholder="Napisz do AI co chciałbyś poprawić (np. 'zrób trudniejsze zadania na tłumaczenie')"
                  />
                  <Button onClick={handleModifyTest} isLoading={isModifying} disabled={!feedback} variant="secondary" className="whitespace-nowrap">
                    Popraw Test
                  </Button>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <label className="block text-sm font-bold text-content-muted mb-1">Data Wykonania (Do kiedy)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full bg-base-100 border border-base-300 rounded-lg p-2.5 outline-none focus:border-primary/50 mb-4"
                />
                <Button onClick={handleSaveTest} isLoading={isSaving} className="w-full bg-primary text-black hover:bg-primary/90">
                  Przypisz test kursantowi
                </Button>
              </div>
            </Card>
          )}

          <Card className="p-6 bg-base-200/40 backdrop-blur-md border border-white/10">
            <h3 className="font-bold mb-4">Przypisane Testy</h3>
            <div className="space-y-2">
              {tests.map(test => (
                <div key={test.id} className="p-3 bg-base-100 rounded-lg border border-base-300 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-sm">{test.title}</div>
                    <div className="text-xs text-content-muted">Do: {test.dueDate} • Pytań: {test.questions.length}</div>
                  </div>
                  <div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${test.status === 'pending' ? 'bg-orange-500/20 text-orange-400' : 'bg-primary/20 text-primary'}`}>
                      {test.status === 'pending' ? 'Oczekujący' : 'Zakończony'}
                    </span>
                    {test.status === 'graded' && <div className="text-xs text-center mt-1">{test.score}/{test.maxScore}</div>}
                  </div>
                </div>
              ))}
              {tests.length === 0 && <div className="text-sm text-content-muted text-center py-4">Brak przypisanych testów</div>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminTestGenerator;
