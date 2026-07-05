import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { User, LessonRecord, StudentTest, TestQuestion } from '../../types';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { generateTest } from '../../services/geminiService';

interface AdminTestGeneratorProps {
  user: User;
}

const AdminTestGenerator: React.FC<AdminTestGeneratorProps> = ({ user }) => {
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  
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
      setLessons(snap.docs.map(d => ({ id: d.id, ...d.data() } as LessonRecord)));
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
    if (!testTitle || !scope) return alert("Podaj tytuł i zakres materiału");
    setIsGenerating(true);
    
    try {
      const selectedLessonRecords = lessons.filter(l => selectedLessons.includes(l.id));
      const lessonContext = selectedLessonRecords.map((lr, idx) => 
        `Lesson ${lr.date}: Topic: ${lr.topic}. Summary: ${lr.lessonSummary || ''}. Words: ${lr.vocabularyText || ''}`
      ).join('\n\n');
      
      const profile = `Imię: ${user.firstName || ''}, Opis: ${user.description || ''}`;
      
      const questions = await generateTest(user.level || 'B1', testTitle, scope, profile, lessonContext);
      
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
              <label className="block text-sm font-bold text-content-muted mb-1">Zakres Materiału (Instrukcje dla AI)</label>
              <textarea
                value={scope}
                onChange={e => setScope(e.target.value)}
                className="w-full bg-base-100 border border-base-300 rounded-lg p-2.5 outline-none focus:border-primary/50 h-24"
                placeholder="np. Czas Present Simple i słownictwo z podróży"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-content-muted mb-2">Wybierz lekcje jako kontekst ({selectedLessons.length})</label>
              <div className="h-48 overflow-y-auto space-y-2 border border-white/5 rounded-lg p-2 bg-black/20">
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
                      <div className="text-xs text-content-muted line-clamp-1">{l.vocabularyText}</div>
                    </div>
                  </label>
                ))}
                {lessons.length === 0 && <div className="text-sm text-content-muted p-2">Brak historii lekcji</div>}
              </div>
            </div>

            <Button onClick={handleGenerate} isLoading={isGenerating} className="w-full" disabled={!testTitle || !scope}>
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
