import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useFlashcards } from '../../context/FlashcardContext';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs, query, orderBy, limit, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { generateTranslationExercises, evaluateTranslations } from '../../services/geminiService';
import { TranslationExercise, TranslationEvaluationResult, FlashcardSet, LessonRecord, VocabularySet, PracticeLog } from '../../types';
import { getVocabularySetsForStudent } from '../../services/lessonRecord';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { 
  Sparkles, 
  Settings, 
  BookOpen, 
  Award, 
  Lightbulb, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  ArrowRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  HelpCircle,
  Play,
  Clock,
  Hash,
  Timer
} from 'lucide-react';

const DEFAULT_GENERATION_PROMPT = `Jesteś wirtualnym nauczycielem języka angielskiego. Twoim absolutnym priorytetem jest personalizacja UX - wygenerowane zdania muszą być maksymalnie dopasowane do profilu kursanta (jeśli został dostarczony).
Wygeneruj dokładnie [NUM_SENTENCES] unikalnych zdań po polsku do przetłumaczenia na język angielski, na wybranym poziomie CEFR.
Pobierz dostarczony zestaw słówek z historii lekcji i na ich podstawie zbuduj zdania. Nawiązuj do tematu lekcji, jeśli to możliwe.
Wykorzystaj informacje z profilu kursanta (np. hobby, wiek, praca), aby zdania były dla niego angażujące i osobiście interesujące.
Zapewnij również krótką wskazówkę (po polsku) dla każdego zdania, ułatwiającą tłumaczenie.`;

const DEFAULT_EVALUATION_PROMPT = `Przeanalizuj i oceń tłumaczenie angielskie wykonane przez ucznia dla każdego zdania po polsku.
Zwróć uwagę na poprawność gramatyczną, słownictwo, idiomy i naturalność wypowiedzi.
Wskaż mocne strony, alternatywne poprawne opcje i precyzyjnie wyjaśnij ewentualne błędy po polsku.
Dla każdego zdania określ procentowy wynik poprawności (score) od 0 do 100.`;

const AIExerciseGeneratorScreen: React.FC = () => {
  const { language } = useLanguage();
  const { sets, getFlashcards } = useFlashcards();
  const { user } = useAuth();

  // Settings states
  const [selectedSetId, setSelectedSetId] = useState<string>('all');
  const [level, setLevel] = useState<string>(user?.level || 'B1');
  const [numSentences, setNumSentences] = useState<number>(5);
  const [practiceMode, setPracticeMode] = useState<'fixed' | 'time'>('fixed');
  const [timeLimit, setTimeLimit] = useState<number>(3); // minutes
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [customGenPrompt, setCustomGenPrompt] = useState<string>(() => {
    return localStorage.getItem('ai_custom_gen_prompt') || DEFAULT_GENERATION_PROMPT;
  });
  const [customEvalPrompt, setCustomEvalPrompt] = useState<string>(() => {
    return localStorage.getItem('ai_custom_eval_prompt') || DEFAULT_EVALUATION_PROMPT;
  });

  useEffect(() => {
    if (user?.level) {
      setLevel(user.level);
    }
  }, [user?.level]);

  // App states
  const [exercises, setExercises] = useState<TranslationExercise[]>([]);
  const [studentAnswers, setStudentAnswers] = useState<string[]>([]);
  const [evaluationResults, setEvaluationResults] = useState<TranslationEvaluationResult[]>([]);
  const [showHints, setShowHints] = useState<boolean[]>([]);
  
  // Loading & error states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // UI states
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number>(0);
  const [step, setStep] = useState<'setup' | 'practice' | 'results'>('setup');
  const [vocabularySets, setVocabularySets] = useState<VocabularySet[]>([]);

  useEffect(() => {
    if (user?.id) {
      getVocabularySetsForStudent(user.id)
        .then(setVocabularySets)
        .catch(console.error);
    }
  }, [user?.id]);

  // Filter out sets assigned to the student (assignedByTeacher or belongs to user)
  const availableSets = sets.filter(s => s.assignedByTeacher || s.userId);

  // Save customized prompts to localStorage
  
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (timeLeft !== null && timeLeft > 0 && step === 'practice') {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timeLeft === 0 && step === 'practice') {
      handleEvaluate();
    }
    return () => clearTimeout(timer);
  }, [timeLeft, step]);

  const handleSavePrompts = () => {
    localStorage.setItem('ai_custom_gen_prompt', customGenPrompt);
    localStorage.setItem('ai_custom_eval_prompt', customEvalPrompt);
    alert(language === 'pl' ? 'Prompty zostały pomyślnie zapisane!' : 'Prompts saved successfully!');
  };

  const handleResetPrompts = () => {
    if (window.confirm(language === 'pl' ? 'Czy na pewno chcesz zresetować prompty do domyślnych?' : 'Are you sure you want to reset prompts to default?')) {
      setCustomGenPrompt(DEFAULT_GENERATION_PROMPT);
      setCustomEvalPrompt(DEFAULT_EVALUATION_PROMPT);
      localStorage.removeItem('ai_custom_gen_prompt');
      localStorage.removeItem('ai_custom_eval_prompt');
    }
  };

  // Generate exercises using Gemini
  const handleGenerate = async (isAppending = false) => {
    if (isAppending) {
      setIsGeneratingMore(true);
    } else {
      setIsLoading(true);
      setError(null);
      setExercises([]);
      setStudentAnswers([]);
      setEvaluationResults([]);
      setShowHints([]);
      setActiveSentenceIndex(0);
      if (practiceMode === 'time') {
        setTimeLeft(timeLimit * 60);
      } else {
        setTimeLeft(null);
      }
    }

    try {
      let wordsToUse: string[] = [];
      let lessonContextString = '';
      let pastExercisesContext = "";

      // Fetch user's recent lesson records for context
      if (user) {
        try {
          const lessonRecordsRef = collection(db, `users/${user.id}/lessonRecords`);
          const qLR = query(lessonRecordsRef, orderBy('date', 'desc'), limit(3));
          const lrSnapshot = await getDocs(qLR);
          const lrList = lrSnapshot.docs.map(doc => doc.data() as LessonRecord);
          
          if (lrList.length > 0) {
            lessonContextString = lrList.map((lr, idx) => 
              `Lesson ${idx + 1} (${lr.date}): Topic: ${lr.topic}. Summary: ${lr.lessonSummary || ''}. Words covered: ${lr.vocabularyText || ''}`
            ).join('\n\n');
          }
        } catch (lrErr) {
          console.warn('Could not fetch lesson records:', lrErr);
        }
      }

      if (user) {
        try {
          const practiceLogsRef = collection(db, `users/${user.id}/practiceLogs`);
          const qPL = query(practiceLogsRef, orderBy('date', 'desc'), limit(10));
          const plSnapshot = await getDocs(qPL);
          const plList = plSnapshot.docs.map(doc => doc.data() as PracticeLog);
          
          const pastExercises = plList.map(pl => pl.exercisesData).filter(Boolean);
          if (pastExercises.length > 0) {
            pastExercisesContext = pastExercises.join(' | ');
          }
        } catch (e) {
          console.warn("Could not fetch recent practice logs", e);
        }
      }

      // Extract words from chosen set if applicable
      if (selectedSetId !== 'general') {
        if (selectedSetId.startsWith('vocab-')) {
          const matchedVocab = vocabularySets.find(s => `vocab-${s.id}` === selectedSetId);
          if (matchedVocab && matchedVocab.vocabularyText) {
             const items = matchedVocab.vocabularyText.split(/[\n,;]+/).map(i => i.trim()).filter(i => i.length > 0);
             wordsToUse = Array.from(new Set(items)); // AI analyzes all vocabulary from lesson
          }
        } else {
          let setsToProcess: FlashcardSet[] = [];
          if (selectedSetId === 'all') {
            setsToProcess = availableSets;
          } else {
            const matchedSet = availableSets.find(s => s.id === selectedSetId);
            if (matchedSet) setsToProcess = [matchedSet];
          }

          // Fetch cards for each chosen set
          const allCardsPromises = setsToProcess.map(s => getFlashcards(s.id));
          const allCardsLists = await Promise.all(allCardsPromises);
          const allCards = allCardsLists.flat();
          
          // Pick unique words/terms
          wordsToUse = Array.from(new Set(allCards.map(c => c.term))).slice(0, 15);
        }
      }

      // Call Gemini API service function
      const studentProfileContext = user?.description ? `Kluczowy profil kursanta (obowiązkowo spersonalizuj zdania pod kątem tych informacji): ${user.description}` : 'Brak danych profilu - stwórz naturalne zdania.';
      const generated = await generateTranslationExercises(level, wordsToUse, customGenPrompt, lessonContextString, studentProfileContext, practiceMode === 'time' ? 10 : numSentences, pastExercisesContext);
      
      if (generated && generated.length > 0) {
        if (isAppending) {
           setExercises(prev => [...prev, ...generated]);
           setStudentAnswers(prev => [...prev, ...new Array(generated.length).fill('')]);
           setShowHints(prev => [...prev, ...new Array(generated.length).fill(false)]);
        } else {
           setExercises(generated);
           setStudentAnswers(new Array(generated.length).fill(''));
           setShowHints(new Array(generated.length).fill(false));
           setStep('practice');
        }
      } else {
        if (!isAppending) throw new Error('AI returned empty exercises.');
      }
    } catch (err: any) {
      console.error(err);
      if (!isAppending) {
        setError(language === 'pl' 
           ? 'Wystąpił błąd podczas generowania ćwiczeń przez AI. Upewnij się, że Twój klucz API w Settings > Secrets jest poprawny.' 
           : 'Failed to generate exercises from AI. Please check your API key in Settings > Secrets.');
      }
    } finally {
      if (isAppending) setIsGeneratingMore(false);
      else setIsLoading(false);
    }
  };

  // Submit and grade translations with Gemini
  const handleEvaluate = async () => {
    setIsEvaluating(true);
    setError(null);
    setTimeLeft(null); // Stop timer
    try {
      // Only evaluate answered exercises
      const answeredExercises = [];
      const answeredAnswers = [];
      for (let i = 0; i < exercises.length; i++) {
        if (studentAnswers[i]?.trim()) {
          answeredExercises.push(exercises[i]);
          answeredAnswers.push(studentAnswers[i]);
        }
      }
      
      if (answeredExercises.length === 0) {
        setStep('results');
        return;
      }
      
      const results = await evaluateTranslations(answeredExercises, answeredAnswers, customEvalPrompt);
      if (results && results.length > 0) {
        setEvaluationResults(results);
        setStep('results');

        if (user) {
          const score = Math.round(results.reduce((acc, r) => acc + r.score, 0) / results.length);
          const exercisesDetails = answeredExercises.map((ex, i) => `${ex.polish} -> ${answeredAnswers[i]}`).join(' | ');
          const logData = {
            exerciseType: 'ai_translation',
            date: new Date().toISOString(),
            isRevisionMode: false,
            score: score,
            totalWords: answeredExercises.length,
            exercisesData: exercisesDetails
          };
          try {
            await addDoc(collection(db, `users/${user.id}/practiceLogs`), logData);
          } catch (e) {
            console.warn("Could not save practice log", e);
          }
        }
      } else {
        throw new Error('AI returned empty evaluation results.');
      }
    } catch (err: any) {
      console.error(err);
      setError(language === 'pl'
        ? 'Wystąpił błąd podczas oceniania odpowiedzi przez AI. Spróbuj ponownie.'
        : 'An error occurred while evaluating your answers with AI. Please try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleNext = () => {
    if (activeSentenceIndex < exercises.length - 1) {
      setActiveSentenceIndex(activeSentenceIndex + 1);
      if (practiceMode === 'time' && activeSentenceIndex === exercises.length - 3 && !isGeneratingMore) {
         handleGenerate(true); // fetch more in background
      }
    }
  };

  const handlePrev = () => {
    if (activeSentenceIndex > 0) {
      setActiveSentenceIndex(activeSentenceIndex - 1);
    }
  };

  const handleAnswerChange = (index: number, val: string) => {
    const updated = [...studentAnswers];
    updated[index] = val;
    setStudentAnswers(updated);
  };

  const toggleHint = (index: number) => {
    const updated = [...showHints];
    updated[index] = !updated[index];
    setShowHints(updated);
  };

  const averageScore = evaluationResults.length > 0
    ? Math.round(evaluationResults.reduce((acc, r) => acc + r.score, 0) / evaluationResults.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-base-300 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            ✨ {language === 'pl' ? 'Tłumacz z AI' : 'AI Translation Lab'}
          </h1>
          <p className="text-content-muted text-sm mt-1">
            {language === 'pl' 
              ? 'Ćwicz tłumaczenie zdań z języka polskiego na angielski na podstawie Twoich słówek i poziomu zaawansowania.'
              : 'Practice translating sentences from Polish to English based on your word lists and CEFR level.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(user?.role === 'admin' || user?.role === 'admin_student') && (
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="flex items-center gap-1.5"
            >
              <Settings className="w-4 h-4" />
              {language === 'pl' ? 'Konfiguracja Promptu' : 'Prompt Setup'}
            </Button>
          )}
          {step !== 'setup' && (
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setStep('setup')}
            >
              {language === 'pl' ? 'Zakończ trening' : 'End session'}
            </Button>
          )}
        </div>
      </div>

      {/* Prompts config panel */}
      {(user?.role === 'admin' || user?.role === 'admin_student') && isConfigOpen && (
        <Card className="p-5 border-amber-500/30 bg-amber-500/[0.02] space-y-4 animate-fade-in-up">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-amber-500 flex items-center gap-2 text-sm uppercase tracking-wider">
              <Settings className="w-4 h-4 animate-spin-slow" />
              {language === 'pl' ? 'PROTOTYP: Narzędzia Konfiguracji Promptów' : 'PROTOTYPE: Prompt Configuration Tools'}
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={handleResetPrompts} 
                className="text-xs text-content-muted hover:text-white underline"
              >
                {language === 'pl' ? 'Domyślne' : 'Restore defaults'}
              </button>
              <button 
                onClick={handleSavePrompts} 
                className="text-xs text-primary font-bold hover:underline"
              >
                {language === 'pl' ? 'Zapisz' : 'Save changes'}
              </button>
            </div>
          </div>
          <p className="text-xs text-content-muted">
            {language === 'pl'
              ? 'Możesz dopracować te prompty, aby wpłynąć na to, jak AI generuje zdania oraz jak ocenia błędy gramatyczne i ortograficzne.'
              : 'Modify these prompts to change how AI generates sentences and how strictly it grades grammar, spelling, and style.'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-content-muted">{language === 'pl' ? 'Prompt Generowania' : 'Generation Prompt'}</label>
              <textarea 
                value={customGenPrompt}
                onChange={(e) => setCustomGenPrompt(e.target.value)}
                rows={5}
                className="w-full bg-base-300 border border-base-200 rounded-lg p-2.5 text-xs font-mono outline-none focus:border-primary/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-content-muted">{language === 'pl' ? 'Prompt Oceny & Korekty' : 'Evaluation Prompt'}</label>
              <textarea 
                value={customEvalPrompt}
                onChange={(e) => setCustomEvalPrompt(e.target.value)}
                rows={5}
                className="w-full bg-base-300 border border-base-200 rounded-lg p-2.5 text-xs font-mono outline-none focus:border-primary/50"
              />
            </div>
          </div>
        </Card>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">{error}</div>
        </div>
      )}

      {/* STEP 1: SETUP */}
      {step === 'setup' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-primary/10 border border-primary/30 p-6 rounded-2xl text-center shadow-lg animate-pulse-delicate">
            <h2 className="text-xl font-bold text-primary mb-2 flex justify-center items-center gap-2">
              <Sparkles className="w-5 h-5" />
              {language === 'pl' ? 'Wciśnij "Generuj zdania przez AI", żeby rozpocząć nową lekcję!' : 'Click "Generate sentences with AI" to start a new lesson!'}
            </h2>
            <p className="text-sm text-primary/80">
              {language === 'pl' ? 'Przygotujemy dla Ciebie spersonalizowane ćwiczenia.' : 'We will prepare personalized exercises just for you.'}
            </p>
          </div>
          
          <Card className="p-6 md:p-8 space-y-6 border border-white/5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {language === 'pl' ? 'Skonfiguruj ćwiczenie' : 'Setup your practice session'}
                  </h2>
                  <p className="text-xs text-content-muted">
                    {language === 'pl' ? 'Wybierz poziom oraz źródło słownictwa' : 'Choose your target level and source vocabulary'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                {(user?.role === 'admin' || user?.role === 'admin_student') ? (
                  <select 
                    value={level} 
                    onChange={(e) => setLevel(e.target.value)}
                    className="bg-base-200 border border-base-300 text-sm font-bold text-primary rounded-lg p-2 outline-none focus:border-primary/50 cursor-pointer"
                  >
                    {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl) => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                ) : (
                  <div className="bg-base-200 border border-base-300 text-sm font-bold text-primary rounded-lg p-2 cursor-default">
                    {level}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {/* Source selection */}
              <div>
                <label className="block text-sm font-bold text-content-muted mb-2">
                  {language === 'pl' ? 'Baza słownictwa' : 'Vocabulary base'}
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 bg-base-200 rounded-lg border border-base-300 cursor-pointer hover:border-white/10 transition-colors">
                    <input 
                      type="radio" 
                      name="vocabSource" 
                      checked={selectedSetId === 'all'} 
                      onChange={() => setSelectedSetId('all')}
                      className="text-primary focus:ring-primary/50 bg-base-300 border-base-300"
                    />
                    <div className="text-sm">
                      <div className="font-bold">{language === 'pl' ? 'Wszystkie moje przypisane zestawy' : 'All my assigned word sets'}</div>
                      <div className="text-xs text-content-muted">{language === 'pl' ? `Wplecie słówka z Twoich ${availableSets.length} zestawów` : `Integrates terms from your ${availableSets.length} sets`}</div>
                    </div>
                  </label>

                  {availableSets.map(set => {
                    const isNewSet = set.title.toLowerCase().includes('nowy zestaw');
                    const displayTitle = isNewSet && set.lessonTopic 
                      ? (language === 'pl' ? `Słownictwo z: ${set.lessonTopic}` : `Vocabulary from: ${set.lessonTopic}`)
                      : set.title;
                      
                    return (
                      <label key={set.id} className="flex items-center gap-3 p-3 bg-base-200 rounded-lg border border-base-300 cursor-pointer hover:border-white/10 transition-colors">
                        <input 
                          type="radio" 
                          name="vocabSource" 
                          checked={selectedSetId === set.id} 
                          onChange={() => setSelectedSetId(set.id)}
                          className="text-primary focus:ring-primary/50 bg-base-300 border-base-300"
                        />
                        <div className="text-sm">
                          <div className="font-bold">{displayTitle}</div>
                          {!isNewSet && set.lessonTopic && <div className="text-xs text-amber-500 italic">Topic: {set.lessonTopic}</div>}
                        </div>
                      </label>
                    );
                  })}

                  {vocabularySets.map(set => (
                    <label key={`vocab-${set.id}`} className="flex items-center gap-3 p-3 bg-base-200 rounded-lg border border-base-300 cursor-pointer hover:border-white/10 transition-colors">
                      <input 
                        type="radio" 
                        name="vocabSource" 
                        checked={selectedSetId === `vocab-${set.id}`} 
                        onChange={() => setSelectedSetId(`vocab-${set.id}`)}
                        className="text-primary focus:ring-primary/50 bg-base-300 border-base-300"
                      />
                      <div className="text-sm">
                        <div className="font-bold">{language === 'pl' ? 'Lekcja: ' : 'Lesson: '}{set.topic}</div>
                        <div className="text-xs text-amber-500 italic">
                          {language === 'pl' ? 'Z dnia: ' : 'Date: '}{new Date(set.date).toLocaleDateString()} &bull; {set.itemCount} {language === 'pl' ? 'słów' : 'words'}
                        </div>
                      </div>
                    </label>
                  ))}

                  <label className="flex items-center gap-3 p-3 bg-base-200 rounded-lg border border-base-300 cursor-pointer hover:border-white/10 transition-colors">
                    <input 
                      type="radio" 
                      name="vocabSource" 
                      checked={selectedSetId === 'general'} 
                      onChange={() => setSelectedSetId('general')}
                      className="text-primary focus:ring-primary/50 bg-base-300 border-base-300"
                    />
                    <div className="text-sm">
                      <div className="font-bold">{language === 'pl' ? 'Dowolne słownictwo ogólne' : 'General English vocabulary'}</div>
                      <div className="text-xs text-content-muted">{language === 'pl' ? 'AI dobierze optymalne słówka dla wybranego poziomu' : 'AI chooses best vocabulary suited for target level'}</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-bold text-content-muted mb-2">
                  {language === 'pl' ? 'Tryb nauki' : 'Practice Mode'}
                </label>
                <div className="flex rounded-lg overflow-hidden border border-base-300">
                  <button
                    onClick={() => setPracticeMode('fixed')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-colors ${practiceMode === 'fixed' ? 'bg-primary text-black' : 'bg-base-200 text-content-muted hover:bg-base-300'}`}
                  >
                    <Hash className="w-4 h-4" />
                    {language === 'pl' ? 'Ilość zdań' : 'Fixed Amount'}
                  </button>
                  <button
                    onClick={() => setPracticeMode('time')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-colors ${practiceMode === 'time' ? 'bg-primary text-black' : 'bg-base-200 text-content-muted hover:bg-base-300'}`}
                  >
                    <Timer className="w-4 h-4" />
                    {language === 'pl' ? 'Na czas' : 'Time Challenge'}
                  </button>
                </div>
              </div>

              {practiceMode === 'fixed' ? (
                <div>
                  <label className="block text-sm font-bold text-content-muted mb-2">
                    {language === 'pl' ? 'Ilość zdań' : 'Number of sentences'}
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    max="20" 
                    value={numSentences} 
                    onChange={(e) => setNumSentences(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-full bg-base-200 border border-base-300 focus:border-primary/50 text-white rounded-lg p-3 text-sm font-bold"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-bold text-content-muted mb-2">
                    {language === 'pl' ? 'Czas ćwiczenia (minuty)' : 'Practice time (minutes)'}
                  </label>
                  <div className="flex gap-2">
                    {[1, 3, 5, 10].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => setTimeLimit(mins)}
                        className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${
                          timeLimit === mins 
                            ? 'bg-primary/20 text-primary border border-primary/50' 
                            : 'bg-base-200 border border-base-300 text-content-muted hover:text-white'
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={() => handleGenerate(false)}
                isLoading={isLoading}
                className="w-full py-3 text-base flex items-center justify-center gap-2 mt-2"
              >
                <Sparkles className="w-5 h-5 animate-pulse" />
                {language === 'pl' ? 'Generuj zdania przez AI' : 'Generate sentences with AI'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* STEP 2: PRACTICE ACTIVE */}
      {step === 'practice' && exercises.length > 0 && (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Progress header */}
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono text-content-muted">
              {language === 'pl' ? 'Postęp:' : 'Progress:'} {activeSentenceIndex + 1} {practiceMode === 'fixed' ? `/ ${exercises.length}` : ''}
            </span>
            {practiceMode === 'time' && timeLeft !== null && (
              <div className={`font-mono text-lg font-bold flex items-center gap-2 ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-primary'}`}>
                <Clock className="w-5 h-5" />
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
            )}
            {practiceMode === 'fixed' && (
              <div className="flex gap-1 h-2 bg-base-300 rounded-full w-48 overflow-hidden">
              {exercises.map((_, idx) => (
                <div 
                  key={idx}
                  className={`h-full transition-all duration-300 flex-1 ${
                    idx <= activeSentenceIndex 
                      ? studentAnswers[idx]?.trim() ? 'bg-primary' : 'bg-primary/40'
                      : 'bg-transparent'
                  }`}
                />
              ))}
            </div>
            )}
          </div>

          <Card className="p-6 md:p-8 space-y-6 border border-white/5 shadow-xl relative overflow-hidden">
            {/* Background design accents */}
            <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none select-none">
              <Sparkles className="w-64 h-64 text-primary" />
            </div>

            <div className="space-y-4 relative z-10">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-mono font-bold">
                Zdanie {activeSentenceIndex + 1}
              </div>

              {/* Polish Sentence */}
              <div className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-relaxed">
                {exercises[activeSentenceIndex].polishSentence}
              </div>

              {/* Optional hint toggle */}
              {exercises[activeSentenceIndex].hint && (
                <div>
                  <button
                    type="button"
                    onClick={() => toggleHint(activeSentenceIndex)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    {showHints[activeSentenceIndex] 
                      ? (language === 'pl' ? 'Ukryj wskazówkę' : 'Hide hint') 
                      : (language === 'pl' ? 'Pokaż wskazówkę' : 'Show hint')}
                  </button>
                  {showHints[activeSentenceIndex] && (
                    <div className="mt-2 bg-amber-500/[0.04] border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400 animate-fade-in-up">
                      {exercises[activeSentenceIndex].hint}
                    </div>
                  )}
                </div>
              )}

              {/* Student answer field */}
              <div className="space-y-1.5 mt-6 pt-4 border-t border-base-300">
                <label className="block text-xs font-bold text-content-muted">
                  {language === 'pl' ? 'Twoje tłumaczenie na angielski:' : 'Your translation to English:'}
                </label>
                <textarea
                  value={studentAnswers[activeSentenceIndex]}
                  onChange={(e) => handleAnswerChange(activeSentenceIndex, e.target.value)}
                  placeholder={language === 'pl' ? 'Wpisz swoje tłumaczenie tutaj...' : 'Type your translation here...'}
                  rows={3}
                  className="w-full bg-base-300 border border-base-200 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 rounded-xl p-4 text-base outline-none transition-all duration-200"
                />
              </div>
            </div>

            {/* Navigation controls */}
            <div className="flex justify-between items-center pt-4">
              <Button
                variant="secondary"
                onClick={handlePrev}
                disabled={activeSentenceIndex === 0}
              >
                {language === 'pl' ? 'Poprzednie' : 'Previous'}
              </Button>
              
              {practiceMode === 'fixed' && activeSentenceIndex === exercises.length - 1 ? (
                <Button
                  onClick={handleEvaluate}
                  isLoading={isEvaluating}
                  disabled={studentAnswers.some(ans => !ans?.trim())}
                  className="bg-primary hover:bg-primary/95 text-black font-extrabold"
                >
                  {language === 'pl' ? 'Sprawdź i oceń odpowiedzi' : 'Submit & evaluate answers'}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={!studentAnswers[activeSentenceIndex]?.trim() || isGeneratingMore}
                  isLoading={isGeneratingMore && activeSentenceIndex === exercises.length - 1}
                >
                  {language === 'pl' ? 'Następne' : 'Next'}
                </Button>
              )}
            </div>
          </Card>

          {/* Prompt warning if fields are not completed */}
          {studentAnswers.some(ans => !ans?.trim()) && (
            <div className="text-center text-xs text-content-muted">
              {language === 'pl' 
                ? 'Przetłumacz wszystkie zdania, aby odblokować przycisk oceny.' 
                : 'Please translate all sentences to enable the submission button.'}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: RESULTS EVALUATION */}
      {step === 'results' && evaluationResults.length > 0 && (
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in-up">
          {/* Main score board */}
          <Card className="p-8 border-primary/30 bg-primary/[0.01] text-center space-y-4 shadow-[0_0_32px_rgba(114,240,180,0.05)]">
            <div className="inline-flex p-3 bg-primary/10 text-primary rounded-full mb-2">
              <Award className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black">
              {language === 'pl' ? 'Twój spersonalizowany wynik!' : 'Your overall score!'}
            </h2>
            <div className="flex justify-center items-baseline gap-2">
              <span className="text-5xl font-black text-primary font-mono">{averageScore}%</span>
              <span className="text-sm text-content-muted">/ 100%</span>
            </div>

            <div className="max-w-md mx-auto text-sm text-content-muted">
              {averageScore >= 80 
                ? (language === 'pl' ? 'Fantastyczna robota! Wykazujesz się świetnym wyczuciem językowym.' : 'Fantastic job! You show excellent language proficiency.')
                : averageScore >= 50
                  ? (language === 'pl' ? 'Dobry krok naprzód! Przeanalizuj wskazówki AI poniżej, aby wyeliminować błędy.' : 'Good progress! Check out the AI tips below to eliminate mistakes.')
                  : (language === 'pl' ? 'Trening czyni mistrza. Przyjrzyj się objaśnieniom i spróbuj jeszcze raz.' : 'Practice makes perfect. Carefully review the explanations and try again.')}
            </div>

            <div className="pt-4 flex justify-center gap-3">
              <Button onClick={() => setStep('setup')} variant="secondary">
                {language === 'pl' ? 'Nowy trening' : 'New session'}
              </Button>
              <Button onClick={() => handleGenerate(false)} isLoading={isLoading}>
                {language === 'pl' ? 'Generuj kolejne zdania' : 'Generate next set'}
              </Button>
            </div>
          </Card>

          {/* Individual sentence evaluation list */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold border-b border-base-300 pb-2">
              {language === 'pl' ? 'Szczegółowa analiza każdego zdania' : 'Detailed analysis of each sentence'}
            </h3>

            {evaluationResults.map((res, idx) => (
              <Card key={idx} className={`p-6 border-l-4 transition-all ${
                res.score >= 85 
                  ? 'border-l-green-400 border-base-300 bg-green-500/[0.01]' 
                  : res.score >= 60 
                    ? 'border-l-amber-500 border-base-300 bg-amber-500/[0.01]' 
                    : 'border-l-red-500 border-base-300 bg-red-500/[0.01]'
              }`}>
                <div className="space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-base-300 rounded text-xs font-mono text-content-muted">
                      Zdanie {idx + 1}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-bold font-mono ${
                        res.score >= 85 ? 'text-green-400' : res.score >= 60 ? 'text-amber-500' : 'text-red-400'
                      }`}>
                        {res.score}%
                      </span>
                      {res.score >= 80 ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                  </div>

                  {/* Sentences table style */}
                  <div className="space-y-3 pt-2">
                    <div>
                      <div className="text-xs text-content-muted font-bold mb-1 uppercase tracking-wider">{language === 'pl' ? 'Po polsku' : 'In Polish'}</div>
                      <div className="text-base font-semibold text-white">{res.polishSentence}</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                      <div>
                        <div className="text-xs text-content-muted font-bold mb-1 uppercase tracking-wider">{language === 'pl' ? 'Twoja odpowiedź' : 'Your translation'}</div>
                        <div className={`text-sm p-2.5 rounded-lg font-medium border ${
                          res.score >= 85 
                            ? 'bg-green-500/[0.02] border-green-500/10 text-green-100' 
                            : res.score >= 60 
                              ? 'bg-amber-500/[0.02] border-amber-500/10 text-amber-100' 
                              : 'bg-red-500/[0.02] border-red-500/10 text-red-100'
                        }`}>
                          {res.studentAnswer || <span className="italic opacity-50">{language === 'pl' ? '(brak)' : '(none)'}</span>}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-content-muted font-bold mb-1 uppercase tracking-wider">{language === 'pl' ? 'Rekomendowane przez AI' : 'Suggested translation'}</div>
                        <div className="text-sm p-2.5 bg-primary/[0.02] border border-primary/10 text-primary-light rounded-lg font-medium">
                          {res.correctTranslation}
                        </div>
                      </div>
                    </div>

                    {/* Explanations & corrections */}
                    <div className="bg-base-200/50 p-4 rounded-xl border border-white/5 space-y-2 mt-2">
                      <div className="text-xs text-primary font-bold flex items-center gap-1.5 uppercase tracking-wider">
                        <Lightbulb className="w-3.5 h-3.5 shrink-0" />
                        {language === 'pl' ? 'Wskazówki i wyjaśnienie AI' : 'AI Analysis & feedback'}
                      </div>
                      <p className="text-xs leading-relaxed text-content-muted whitespace-pre-wrap">
                        {res.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIExerciseGeneratorScreen;
