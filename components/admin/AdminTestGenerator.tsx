import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { User, LessonRecord, StudentTest, TestQuestion } from '../../types';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { generateTest, modifyTest } from '../../services/geminiService';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare } from 'lucide-react';

interface AdminTestGeneratorProps {
  user: User;
}

const AdminTestGenerator: React.FC<AdminTestGeneratorProps> = ({ user }) => {
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [isModifying, setIsModifying] = useState<boolean>(false);

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
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['multiple_choice', 'fill_in_blank', 'translation']);
  
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
    setIsGenerating(true);
    
    try {
      const selectedLessonRecords = lessons.filter(l => selectedLessons.includes(l.id));
      const lessonContext = selectedLessonRecords.map((lr, idx) => 
        `Lesson ${lr.date}: Topic: ${lr.topic}. Summary: ${lr.lessonSummary || ''}. Words: ${lr.vocabularyText || ''}`
      ).join('\n\n');
      
      const profile = `Imię: ${user.firstName || ''}, Opis: ${user.description || ''}`;
      
      let fileData = null;
      if (file) {
        const base64Data = await getBase64(file);
        let mimeType = 'text/plain';
        if (file.name.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (file.name.endsWith('.md')) mimeType = 'text/markdown';
        else if (file.name.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        
        fileData = { data: base64Data, mimeType };
      }

      const questions = await generateTest(user.level || 'B1', testTitle, scope, profile, lessonContext, ['multiple_choice', 'fill_in_blank', 'translation'], fileData, driveFile ? { id: driveFile.id, mimeType: driveFile.mimeType, token: driveFile.token } : undefined);
      
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
              <label className="block text-sm font-bold text-content-muted mb-1">Dodatkowe materiały (PDF, DOCX, TXT, Markdown, Google Drive)</label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pdf,.docx,.md,.txt"
                  onChange={(e) => { handleFileChange(e); setDriveFile(null); }}
                  className="w-full bg-base-100 border border-base-300 rounded-lg p-2 outline-none focus:border-primary/50 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
                <Button onClick={fetchDriveFiles} variant="secondary" className="whitespace-nowrap flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Google Drive
                </Button>
              </div>
              {file && <div className="text-xs text-primary mt-1 flex items-center gap-2">Wybrano plik: {file.name}</div>}
              {driveFile && (
                <div className="text-xs text-primary mt-1 flex items-center gap-2 bg-primary/10 p-2 rounded w-fit">
                  Google Drive: {driveFile.name}
                  <button onClick={() => setDriveFile(null)} className="ml-2 hover:text-white">✕</button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-content-muted mb-2">Wybierz lekcje jako kontekst ({selectedLessons.length})</label>
              <div className="h-80 overflow-y-auto space-y-2 border border-white/5 rounded-lg p-2 bg-black/20">
                {lessons.map(l => (
                  <label key={l.id} className="flex items-start gap-3 p-2 hover:bg-base-300/50 rounded cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={selectedLessons.includes(l.id)}
                      onChange={() => toggleLesson(l.id)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-bold text-sm">{l.date} - {l.topic}</div>
                      <div className="text-xs text-content-muted line-clamp-2">{l.vocabularyText}</div>
                    </div>
                  </label>
                ))}
                {lessons.length === 0 && <div className="text-sm text-content-muted p-2">Brak historii lekcji</div>}
              </div>
            </div>

            <Button onClick={handleGenerate} isLoading={isGenerating} className="w-full" disabled={!testTitle}>
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
                  <div key={q.id} className="bg-base-200/50 p-3 rounded-lg border border-white/5 text-sm">
                    <div className="font-bold text-content-muted mb-1">
                      {i+1}. [{q.type === 'multiple_choice' ? 'ABCD' : q.type === 'fill_in_blank' ? 'Luki' : 'Tłumaczenie'}]
                    </div>
                    <div className="mb-2 font-medium">{q.prompt}</div>
                    {q.type === 'multiple_choice' && q.options && (
                      <ul className="list-disc pl-5 mb-2 text-content-muted">
                        {q.options.map((opt, j) => <li key={j} className={opt === q.correctAnswer ? "text-primary" : ""}>{opt}</li>)}
                      </ul>
                    )}
                    <div className="text-primary font-bold">Odp: {q.correctAnswer}</div>
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
