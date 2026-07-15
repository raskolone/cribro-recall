import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useLanguage } from '../../context/LanguageContext';
import { useFlashcards } from '../../context/FlashcardContext';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs, query, orderBy, limit, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { generateTranslationExercises, evaluateTranslations, getUserWeaknesses, logMistakesToFirebase } from '../../services/geminiService';
import { TranslationExercise, TranslationEvaluationResult, FlashcardSet, LessonRecord, VocabularySet, PracticeLog } from '../../types';
import { getVocabularySetsForStudent } from '../../services/lessonRecord';
import Card from '../ui/Card';
import PuzzleExercise from './PuzzleExercise';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import { motion, AnimatePresence } from 'motion/react';
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
  Timer,
  Volume2,
  Loader2,
  Calendar,
  Keyboard,
  Puzzle,
  Target
} from 'lucide-react';


const ACCENTS = ['en-US', 'en-GB', 'en-AU', 'en-SCT'];
const ACCENT_FLAGS: Record<string, string> = {
  'en-US': '🇺🇸',
  'en-GB': '🇬🇧',
  'en-AU': '🇦🇺',
  'en-SCT': '🏴󠁧󠁢󠁳󠁣󠁴󠁿'
};

const DEFAULT_GENERATION_PROMPT = `Jesteś wirtualnym nauczycielem języka angielskiego. Twoim absolutnym priorytetem jest personalizacja UX - wygenerowane zdania muszą być maksymalnie dopasowane do ucznia.\n\n[START KONTEKST UCZNIA]\n\nProfil (hobby, praca, wiek): \${userProfile || "Brak danych"}\n\nNajczęstsze błędy: \${weaknessesList || "Brak zidentyfikowanych błędów"}\n[KONIEC KONTEKST UCZNIA]\n\nWygeneruj dokładnie [NUM_SENTENCES] unikalnych zdań po polsku do przetłumaczenia na język angielski, na wybranym poziomie CEFR.\n\nZASADY TWORZENIA:\n\nPobierz dostarczony zestaw słówek z historii lekcji i zbuduj na ich podstawie zdania. Nawiązuj do tematu lekcji.\n\nWykorzystaj Profil kursanta, aby zdania były angażujące i osobiście interesujące.\n\nPRIORYTET: Skonstruuj zdania w taki sposób, aby WYMUSIĆ na uczniu użycie gramatyki/słownictwa z listy "Najczęstsze błędy" (jeśli występuje).\n\nZapewnij krótką wskazówkę (po polsku) dla każdego zdania, ułatwiającą tłumaczenie.`;

const DEFAULT_EVALUATION_PROMPT = `Przeanalizuj i oceń tłumaczenie angielskie wykonane przez ucznia dla każdego zdania po polsku. Zwróć uwagę na poprawność gramatyczną, słownictwo, idiomy i naturalność wypowiedzi.\n\n[START KONTEKST BŁĘDÓW]\nMiej szczególną uwagę na te historyczne błędy ucznia: \${weaknessesList || "Brak danych"}. Jeśli uczeń ponownie popełnił błąd z tej listy, zaznacz to w swoim feedbacku, przypominając mu o tym problemie.\n[KONIEC KONTEKST BŁĘDÓW]\n\nWskaż mocne strony, alternatywne poprawne opcje i precyzyjnie wyjaśnij ewentualne błędy po polsku.\nDla każdego zdania określ procentowy wynik poprawności (score) od 0 do 100.`;

import { ExerciseType } from '../../types';

interface AIExerciseGeneratorScreenProps {
  initialSetId?: string | null;
  onStartPractice?: (exercise: ExerciseType) => void;
  onExerciseStateChange?: (isActive: boolean) => void;
}

const AILoadingButton = ({ isLoading, onClick, children, className, disabled, loadingText, variant = 'primary' }: any) => {
  const baseStyles = 'relative overflow-hidden inline-flex items-center justify-center font-bold font-sans rounded focus:outline-none transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed';
  
  // Custom styling for loading vs default state
  const isPrimary = variant === 'primary';
  const defaultStyles = isPrimary
    ? 'bg-primary text-base-100 hover:brightness-110 hover:-translate-y-[1px] hover:shadow-[0_0_20px_rgba(114,240,180,0.4)]'
    : 'bg-transparent border-[1.5px] border-white/20 text-content hover:border-primary/60 hover:text-primary hover:bg-primary/10 hover:-translate-y-[1px]';
    
  const loadingStyles = 'bg-[#00FF66] text-black cursor-wait shadow-[0_0_30px_rgba(0,255,102,0.8)] animate-pulse scale-[1.02] transition-transform duration-300';

  return (
    <button
      onClick={onClick}
      disabled={isLoading || disabled}
      className={`${baseStyles} ${isLoading ? loadingStyles : defaultStyles} ${className || ''}`}
    >
      {isLoading && (
        <motion.div
          className="absolute left-0 top-0 bottom-0 bg-black/10"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 15, ease: "circOut" }} 
        />
      )}
      {isLoading && (
        <motion.div
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-black/20"
        />
      )}
      <div className="relative z-10 flex items-center justify-center gap-2">
        {isLoading && <Sparkles className="w-5 h-5 animate-spin" />}
        {isLoading ? loadingText : children}
      </div>
    </button>
  );
};

const AIExerciseGeneratorScreen: React.FC<AIExerciseGeneratorScreenProps> = ({ initialSetId = null, onStartPractice, onExerciseStateChange }) => {
  const { language } = useLanguage();
  const { sets, getFlashcards } = useFlashcards();
  const { user } = useAuth();

  // Settings states
  const [activeTab, setActiveTab] = useState<'ai' | 'other'>(typeof window !== 'undefined' && window.innerWidth < 1024 ? 'other' : 'ai');
  const [selectedSetId, setSelectedSetId] = useState<string>('all');
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [level, setLevel] = useState<string>(user?.level || 'B1');
  const [numSentences, setNumSentences] = useState<number>(5);
  const [practiceMode, setPracticeMode] = useState<'fixed' | 'time'>('fixed');
  const [exerciseFormat, setExerciseFormat] = useState<'typing' | 'puzzle'>('typing');
  const [timeLimit, setTimeLimit] = useState<number>(3); // minutes
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const numSentencesRef = useRef<HTMLSpanElement>(null);
  const timeLimitRef = useRef<HTMLSpanElement>(null);

  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
  const [testName, setTestName] = useState<string>('');
  const [customGenPrompt, setCustomGenPrompt] = useState<string>(() => {
    return localStorage.getItem('ai_custom_gen_prompt') || DEFAULT_GENERATION_PROMPT;
  });
  const [evaluationStrictness, setEvaluationStrictness] = useState<'normal' | 'strict' | 'loose'>('normal');
  const [customEvalPrompt, setCustomEvalPrompt] = useState<string>(() => {
    return localStorage.getItem('ai_custom_eval_prompt') || DEFAULT_EVALUATION_PROMPT;
  });

  const [confirmModalState, setConfirmModalState] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void}>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  
  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModalState({ isOpen: true, title, message, onConfirm });
  };
  
  const closeConfirm = () => {
    setConfirmModalState(prev => ({ ...prev, isOpen: false }));
  };


  useEffect(() => {
    if (user?.level) {
      setLevel(user.level);
    }
  }, [user?.level]);

  // App states
  const [exercises, setExercises] = useState<TranslationExercise[]>([]);
  const [studentAnswers, setStudentAnswers] = useState<string[]>([]);
  const [evaluationResults, setEvaluationResults] = useState<TranslationEvaluationResult[]>([]);
  const [evaluationStatuses, setEvaluationStatuses] = useState<Record<number, 'evaluating' | 'evaluated'>>({});
  const [singleEvaluationResults, setSingleEvaluationResults] = useState<Record<number, TranslationEvaluationResult>>({});
  const [selectedVoiceLang, setSelectedVoiceLang] = useState<string>('en-US');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showHints, setShowHints] = useState<boolean[]>([]);
  
  // Loading & error states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // UI states
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);

  const handlePlaySentenceAudio = async (text: string, lang: string, index: number) => {
    if (playingAudioIndex === index) return;
    setPlayingAudioIndex(index);
    try {
      const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`);
      if (!res.ok) throw new Error('Audio failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        setPlayingAudioIndex(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (err) {
      console.error(err);
      setPlayingAudioIndex(null);
    }
  };

  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number>(0);
  const [step, setStep] = useState<'setup' | 'practice' | 'results'>('setup');

  useEffect(() => {
    if (onExerciseStateChange) {
      onExerciseStateChange(step === 'practice');
    }
  }, [step, onExerciseStateChange]);
  const [vocabularySets, setVocabularySets] = useState<VocabularySet[]>([]);
  const [isLessonsExpanded, setIsLessonsExpanded] = useState<boolean>(false);
  const [isCustomSetsExpanded, setIsCustomSetsExpanded] = useState<boolean>(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (numSentencesRef.current) {
      gsap.fromTo(numSentencesRef.current, 
        { scale: 1.5, color: '#ffffff' }, 
        { scale: 1, color: '#72f0b4', duration: 0.5, ease: 'power2.out' }
      );
    }
  }, [numSentences]);

  useEffect(() => {
    if (timeLimitRef.current) {
      gsap.fromTo(timeLimitRef.current, 
        { scale: 1.5, color: '#ffffff' }, 
        { scale: 1, color: '#72f0b4', duration: 0.5, ease: 'power2.out' }
      );
    }
  }, [timeLimit]);


  useEffect(() => {
    if (user?.id) {
      getVocabularySetsForStudent(user.id)
        .then(setVocabularySets)
        .catch(console.error);
    }
  }, [user?.id]);

  // Filter out sets assigned to the student (assignedByTeacher or belongs to user)
  const availableSets = sets.filter(s => (s.assignedByTeacher || s.userId) && !s.isLessonVocabulary);

  // Save customized prompts to localStorage
  
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (timeLeft !== null && timeLeft > 0 && step === 'practice') {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timeLeft === 0 && step === 'practice') {
      handleFinishAll();
    }
    return () => clearTimeout(timer);
  }, [timeLeft, step]);

  
  useEffect(() => {
    if (step === 'results' && evaluationResults.length > 0 && resultsRef.current) {
      const tl = gsap.timeline();
      
      // Initial state
      gsap.set(resultsRef.current.children, { y: 50, opacity: 0 });
      const scoreBoard = resultsRef.current.querySelector('.score-board');
      const scoreText = resultsRef.current.querySelector('.score-text');
      const icon = resultsRef.current.querySelector('.score-icon');
      
      if (scoreBoard) gsap.set(scoreBoard, { scale: 0.8, opacity: 0 });
      if (scoreText) gsap.set(scoreText, { scale: 0, rotation: -45 });
      if (icon) gsap.set(icon, { scale: 0, rotation: 180 });
      
      // Animation sequence
      tl.to(resultsRef.current.children, {
        y: 0,
        opacity: 1,
        duration: 0.5,
        stagger: 0.1,
        ease: 'power3.out'
      })
      .to(scoreBoard, {
        scale: 1,
        opacity: 1,
        duration: 0.6,
        ease: 'elastic.out(1, 0.5)'
      }, "-=0.3")
      .to(icon, {
        scale: 1,
        rotation: 0,
        duration: 0.6,
        ease: 'back.out(2)'
      }, "-=0.4")
      .to(scoreText, {
        scale: 1,
        rotation: 0,
        duration: 0.8,
        ease: 'elastic.out(1.2, 0.3)'
      }, "-=0.2");
      
      // Liquid glow effect on the board
      if (scoreBoard) {
        gsap.to(scoreBoard, {
          boxShadow: '0 0 60px rgba(114, 240, 180, 0.3), inset 0 0 20px rgba(114, 240, 180, 0.1)',
          duration: 1.5,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut'
        });
      }
    }
  }, [step, evaluationResults]);

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
            lessonContextString = lrList.map((lr, idx) => {
              let ctx = `Lesson ${idx + 1} (${lr.date}): Topic: ${lr.topic}. `;
              if (lr.lessonSummary) ctx += `Revision Notes: ${lr.lessonSummary}. `;
              if (lr.studentSpeaking) ctx += `Kursant o czym mówił: ${lr.studentSpeaking}. `;
              if (lr.thingsToImprove) ctx += `Things to Improve: ${lr.thingsToImprove}. `;
              if (lr.suggestedFollowUp) ctx += `Suggested follow-up: ${lr.suggestedFollowUp}. `;
              if (lr.vocabularyText) ctx += `Vocabulary & Pronunciation: ${lr.vocabularyText}.`;
              return ctx;
            }).join('\n\n');
          }
        } catch (lrErr) {
          console.warn('Could not fetch lesson records:', lrErr);
        }
      }

      if (user) {
        try {
          const practiceLogsRef = collection(db, `users/${user.id}/practiceLogs`);
          const qPL = query(practiceLogsRef, orderBy('date', 'desc'), limit(3));
          const plSnapshot = await getDocs(qPL);
          const plList = plSnapshot.docs.map(doc => doc.data() as PracticeLog);
          
          const pastExercises = plList.map((pl, index) => {
            if (pl.exercisesData) {
              return `Session ${index + 1} (${new Date(pl.date).toLocaleDateString()}): ${pl.exercisesData}`;
            }
            return null;
          }).filter(Boolean);
          
          if (pastExercises.length > 0) {
            pastExercisesContext = pastExercises.join('\n');
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
      const studentProfileContext = `Kluczowy profil kursanta: ${user?.firstName ? `Imię kursanta: ${user.firstName}. ` : ''}${user?.description ? `Cały wpis z profilu kursanta (zainteresowania, cele, przykładowe zdania): ${user.description}` : 'Brak dodatkowych danych profilu.'}${user?.aiPrompt ? `\nSpersonalizowany Prompt (ŻELAZNA ZASADA DLA AI - uczeń musi widzieć przykłady w tym stylu): ${user.aiPrompt}` : ''}`;
      
      let userProfileStr = "Brak danych";
      let weaknessesListStr = "Brak zidentyfikowanych błędów";
      
      if (user) {
        userProfileStr = user.description || "Brak danych";
        weaknessesListStr = await getUserWeaknesses(user.id);
      }
      
      let finalGenPrompt = customGenPrompt;
      if (additionalInstructions.trim().length > 0) {
        finalGenPrompt += '\n\nDODATKOWE INSTRUKCJE OD NAUCZYCIELA: ' + additionalInstructions;
      }
      const resolvedGenPrompt = finalGenPrompt
        .replace(/\$\{userProfile(?: \|\| "[^"]+")?\}/g, userProfileStr)
        .replace(/\$\{weaknessesList(?: \|\| "[^"]+")?\}/g, weaknessesListStr);

      const generated = await generateTranslationExercises(level, wordsToUse, resolvedGenPrompt, lessonContextString, studentProfileContext, practiceMode === 'time' ? 10 : numSentences, pastExercisesContext);
      
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
           ? `Wystąpił błąd AI: ${err.message || 'Nieznany błąd'}` 
           : `AI Error: ${err.message || 'Unknown error'}`);
      }
    } finally {
      if (isAppending) setIsGeneratingMore(false);
      else setIsLoading(false);
    }
  };

  // Submit and grade translations with Gemini
  
  const playAudio = async (text: string, lang: string) => {
    if (!text) return;
    setIsPlayingAudio(true);
    try {
      const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`);
      if (!res.ok) throw new Error('Audio generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => setIsPlayingAudio(false);
      audio.play();
    } catch (error) {
      console.error('Audio playback error:', error);
      setIsPlayingAudio(false);
    }
  };

  const handleEvaluateSingle = async () => {
    const currentIdx = activeSentenceIndex;
    const answer = studentAnswers[currentIdx];
    if (!answer || !answer.trim()) return;
    
    setEvaluationStatuses(prev => ({ ...prev, [currentIdx]: 'evaluating' }));
    setError(null);
    try {
      const evalStudentContext = `${user?.firstName ? `Zwracaj się do ucznia po imieniu (${user.firstName}), odmieniając je naturalnie we wszystkich przypadkach w języku polskim zgodnie z regułami języka polskiego.` : ''}`;
      
      let weaknessesListStr = "Brak zidentyfikowanych błędów";
      if (user) {
        weaknessesListStr = await getUserWeaknesses(user.id);
      }

      let strictnessPrompt = customEvalPrompt
        .replace(/\$\{weaknessesList(?: \|\| "[^"]+")?\}/g, weaknessesListStr);
        
      if (evaluationStrictness === 'strict') {
        strictnessPrompt += '\n\nOCENIAJ BARDZO RYGORYSTYCZNIE. Każdy drobny błąd w pisowni, czasie lub przedimku (a/an/the) oznacza isCorrect: false.';
      } else if (evaluationStrictness === 'loose') {
        strictnessPrompt += '\n\nOCENIAJ LUŹNO. Akceptuj drobne błędy i literówki. Zwracaj uwagę na ogólny przekaz.';
      }
      const results = await evaluateTranslations([exercises[currentIdx]], [answer], strictnessPrompt, evalStudentContext);
      
      if (results && results.length > 0) {
        const result = results[0];
        setSingleEvaluationResults(prev => ({ ...prev, [currentIdx]: result }));
        setEvaluationStatuses(prev => ({ ...prev, [currentIdx]: 'evaluated' }));
      } else {
        throw new Error('AI returned empty evaluation results.');
      }
    } catch (err: any) {
      console.error(err);
      setError(language === 'pl'
        ? 'Wystąpił błąd podczas oceniania odpowiedzi przez AI. Spróbuj ponownie. (' + err.message + ')'
        : 'An error occurred while evaluating your answers with AI. Please try again. (' + err.message + ')');
      setEvaluationStatuses(prev => {
         const updated = { ...prev };
         delete updated[currentIdx];
         return updated;
      });
    }
  };

    const handleFinishAll = async () => {
    // Generate full results
    const results = exercises.map((_, i) => singleEvaluationResults[i]).filter(Boolean);
    setEvaluationResults(results);
    setStep('results');
    setTimeLeft(null);

    if (user && results.length > 0) {
      const score = Math.round(results.reduce((acc, r) => acc + r.score, 0) / results.length);
      const exercisesDetails = results.map((r) => `${r.polishSentence} -> ${r.studentAnswer}`).join(' | ');
      const logData = {
        exerciseType: 'ai_translation',
        testName: testName || undefined,
        date: new Date().toISOString(),
        isRevisionMode: false,
        score: score,
        totalWords: results.length,
        exercisesData: exercisesDetails
      };
      try {
        await addDoc(collection(db, `users/${user.id}/practiceLogs`), logData);
        const allMistakes = results.flatMap(r => r.mistakes || []);
        if (allMistakes.length > 0) {
          await logMistakesToFirebase(user.id, allMistakes);
        }
      } catch (e) {
        console.warn("Could not save practice log or log mistakes", e);
      }
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
    <div className="relative">
      {/* Pulsar effect for the whole screen area */}
      <AnimatePresence>
        {(isLoading || isEvaluating || isGeneratingMore) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -inset-4 md:-inset-6 rounded-3xl border border-primary/30 shadow-[0_0_30px_rgba(114,240,180,0.15)] pointer-events-none z-0"
          >
            <motion.div
              animate={{ opacity: [0.3, 0.8, 0.3], boxShadow: ["0 0 20px rgba(114,240,180,0.2)", "0 0 40px rgba(114,240,180,0.6)", "0 0 20px rgba(114,240,180,0.2)"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-3xl border border-primary/60"
            />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-base-300 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            ✨ {(user?.role === 'admin' || user?.role === 'admin_student') 
              ? (language === 'pl' ? 'Widok kursanta' : 'Student View')
              : (language === 'pl' ? 'Tłumacz z AI' : 'AI Translation Lab')}
          </h1>
          <p className="text-content-muted text-sm mt-1">
            {language === 'pl' 
              ? 'Ćwicz tłumaczenie zdań z języka polskiego na angielski na podstawie Twoich słówek i poziomu zaawansowania.'
              : 'Practice translating sentences from Polish to English based on your word lists and CEFR level.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {true && (
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
              onClick={() => {
                if (step === 'results') {
                  setStep('setup');
                  setExercises([]);
                  setStudentAnswers([]);
                  setTimeLeft(null);
                  return;
                }
                showConfirm(
                  language === 'pl' ? 'Zakończ trening' : 'End session',
                  language === 'pl' ? 'Czy na pewno chcesz zakończyć sesję nauki? Dotychczasowe odpowiedzi zostaną ocenione.' : 'Are you sure you want to end this study session? Your answers will be evaluated.',
                  () => {
                    closeConfirm();
                    const hasAnswers = studentAnswers.some(ans => ans?.trim());
                    if (hasAnswers) {
                      handleFinishAll();
                    } else {
                      setStep('setup');
                      setExercises([]);
                      setStudentAnswers([]);
                      setTimeLeft(null);
                    }
                  }
                );
              }}
            >
              {language === 'pl' ? 'Zakończ trening' : 'End session'}
            </Button>
          )}
        </div>
      </div>

      {/* Prompts config panel */}
      {isConfigOpen && (
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
        <div className="max-w-4xl mx-auto space-y-8 mt-4">
          {/* Main Tabs */}
          <div className="flex bg-base-200/40 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl mb-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] gap-1">
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 py-4 px-6 rounded-xl text-base font-bold transition-all duration-500 relative ${
                activeTab === 'ai' 
                  ? 'text-primary bg-primary/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-primary/30 backdrop-blur-md animate-pulsar' 
                  : 'text-content-muted hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                {language === 'pl' ? 'Tłumaczenie zdań' : 'Sentence Translation'}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('other')}
              className={`flex-1 py-4 px-6 rounded-xl text-base font-bold transition-all duration-500 ${
                activeTab === 'other' 
                  ? 'text-white bg-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-white/20 backdrop-blur-md' 
                  : 'text-content-muted hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <BookOpen className="w-5 h-5" />
                {language === 'pl' ? 'Inne ćwiczenia' : 'Other exercises'}
              </div>
            </button>
          </div>

          {activeTab === 'ai' ? (
            <div className="space-y-8 animate-fade-in-up">
              {/* Removed the description and title as requested */}

              <Card className="p-0 border border-primary/20 shadow-[0_0_20px_rgba(114,240,180,0.1)] bg-base-200/40 backdrop-blur-xl relative overflow-hidden flex flex-col">
                <div className="p-6 border-b border-primary/10 bg-primary/5">
                  <h3 className="text-xl font-bold flex items-center gap-3 text-primary">
                    <BookOpen className="w-6 h-6" />
                    {language === 'pl' ? 'Wybierz źródło słownictwa' : 'Select vocabulary source'}
                  </h3>
                </div>
                
                <div className="p-6 space-y-4">
                  {/* Główny wybór opcji */}
                  <div className="space-y-3">
                    {/* Opcja 1: Lekcje */}
                    <div className="border border-primary/20 rounded-xl overflow-hidden bg-base-200/50">
                      <button 
                        className={`w-full flex items-center justify-between p-4 transition-colors ${selectedSetId === 'lessons' || selectedLessonIds.length > 0 ? 'bg-primary/20' : 'hover:bg-primary/5'}`}
                        onClick={() => {
                          if (selectedSetId !== 'lessons') {
                            setSelectedSetId('lessons');
                            if (vocabularySets.length > 0 && selectedLessonIds.length === 0) {
                              setSelectedLessonIds([vocabularySets[0].id]);
                            }
                          } else {
                            setSelectedSetId('');
                            setSelectedLessonIds([]);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${(selectedSetId === 'lessons' || selectedLessonIds.length > 0) ? 'border-primary bg-primary text-black' : 'border-primary/50'}`}>
                            {(selectedSetId === 'lessons' || selectedLessonIds.length > 0) && <div className="w-2.5 h-2.5 bg-black rounded-full" />}
                          </div>
                          <span className="font-bold text-lg">{language === 'pl' ? 'Moje lekcje' : 'My lessons'}</span>
                        </div>
                        <ChevronDown className={`w-5 h-5 transition-transform ${(selectedSetId === 'lessons' || selectedLessonIds.length > 0) ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {/* Rozwijana lista lekcji */}
                      {(selectedSetId === 'lessons' || selectedLessonIds.length > 0) && (
                        <div className="p-4 border-t border-primary/20 bg-base-100/30 space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                          {vocabularySets.length > 0 ? vocabularySets.map((set, index) => {
                            const isSelected = selectedLessonIds.includes(set.id);
                            const lessonNumber = vocabularySets.length - index;
                            return (
                              <label key={set.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-primary/20 border-primary/50' : 'bg-base-200/50 border-white/5 hover:border-primary/30'}`}>
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isSelected) {
                                      setSelectedLessonIds(prev => prev.filter(id => id !== set.id));
                                    } else {
                                      setSelectedLessonIds(prev => [...prev, set.id]);
                                    }
                                  }}
                                  className="w-4 h-4 text-primary focus:ring-primary rounded border-white/20 bg-base-300"
                                />
                                <div className="flex flex-col">
                                  <span className={isSelected ? 'text-white font-medium' : 'text-content-muted'}>
                                    <span className="text-xs font-mono opacity-70 mr-2">L{lessonNumber}</span>
                                    {set.topic.replace(/^\d+\.\s*/, '').replace(/\(Lekcja\s*\d+\)\s*/gi, '').trim()}
                                  </span>
                                </div>
                              </label>
                            );
                          }) : (
                            <div className="text-center text-sm text-content-muted p-4">
                              {language === 'pl' ? 'Brak dostępnych lekcji' : 'No lessons available'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Opcja 2: Wszystkie moje słówka */}
                    <button 
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${selectedSetId === 'all' && selectedLessonIds.length === 0 ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(114,240,180,0.15)] ring-1 ring-primary/50' : 'bg-base-200/50 border-primary/20 hover:bg-primary/5'}`}
                      onClick={() => { setSelectedSetId('all'); setSelectedLessonIds([]); }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${(selectedSetId === 'all' && selectedLessonIds.length === 0) ? 'border-primary bg-primary text-black' : 'border-primary/50'}`}>
                          {(selectedSetId === 'all' && selectedLessonIds.length === 0) && <div className="w-2.5 h-2.5 bg-black rounded-full" />}
                        </div>
                        <span className="font-bold text-lg">{language === 'pl' ? 'Wszystkie moje słówka (Mix)' : 'All my vocabulary (Mix)'}</span>
                      </div>
                    </button>

                    {/* Opcja 3: Losowe zdania */}
                    <button 
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${selectedSetId === 'random' && selectedLessonIds.length === 0 ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(114,240,180,0.15)] ring-1 ring-primary/50' : 'bg-base-200/50 border-primary/20 hover:bg-primary/5'}`}
                      onClick={() => { setSelectedSetId('random'); setSelectedLessonIds([]); }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${(selectedSetId === 'random' && selectedLessonIds.length === 0) ? 'border-primary bg-primary text-black' : 'border-primary/50'}`}>
                          {(selectedSetId === 'random' && selectedLessonIds.length === 0) && <div className="w-2.5 h-2.5 bg-black rounded-full" />}
                        </div>
                        <span className="font-bold text-lg">{language === 'pl' ? 'Losowe zdania' : 'Random sentences'}</span>
                      </div>
                    </button>
                  </div>
                </div>
              </Card>

              {/* Parametry ćwiczenia: Tryb, Suwak itp. */}
              <Card className="p-6 border border-primary/20 shadow-[0_0_20px_rgba(114,240,180,0.1)] bg-base-200/40 backdrop-blur-xl relative overflow-hidden">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3 text-primary">
                  <Settings className="w-6 h-6" />
                  {language === 'pl' ? 'Ustawienia ćwiczenia' : 'Exercise settings'}
                </h3>

                {/* Typ tłumaczenia (Klawiatura czy Układanka) */}
                <div className="mb-8">
                  <label className="block text-sm font-bold text-content-muted uppercase tracking-wider mb-4">
                    {language === 'pl' ? 'Sposób rozwiązywania' : 'Solving method'}
                  </label>
                  <div className="flex bg-base-300/50 p-1.5 rounded-xl border border-primary/10">
                    <button
                      onClick={() => setExerciseFormat('typing')}
                      className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                        exerciseFormat === 'typing' 
                          ? 'bg-primary text-black shadow-[0_0_15px_rgba(114,240,180,0.3)]' 
                          : 'text-content-muted hover:text-white'
                      }`}
                    >
                      <Keyboard className="w-4 h-4" />
                      {language === 'pl' ? 'Wpisywanie klawiaturą' : 'Keyboard typing'}
                    </button>
                    <button
                      onClick={() => setExerciseFormat('puzzle')}
                      className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                        exerciseFormat === 'puzzle' 
                          ? 'bg-primary text-black shadow-[0_0_15px_rgba(114,240,180,0.3)]' 
                          : 'text-content-muted hover:text-white'
                      }`}
                    >
                      <Puzzle className="w-4 h-4" />
                      {language === 'pl' ? 'Układanka ze słów' : 'Word puzzle'}
                    </button>
                  </div>
                </div>

                <div className="mb-8">
                  <label className="block text-sm font-bold text-content-muted uppercase tracking-wider mb-4">
                    {language === 'pl' ? 'Tryb nauki' : 'Practice mode'}
                  </label>
                  <div className="flex bg-base-300/50 p-1.5 rounded-xl border border-primary/10">
                    <button
                      onClick={() => setPracticeMode('fixed')}
                      className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                        practiceMode === 'fixed' 
                          ? 'bg-primary text-black shadow-[0_0_15px_rgba(114,240,180,0.3)]' 
                          : 'text-content-muted hover:text-white'
                      }`}
                    >
                      <Target className="w-4 h-4" />
                      {language === 'pl' ? 'Na ilość zdań' : 'Fixed quantity'}
                    </button>
                    <button
                      onClick={() => setPracticeMode('time')}
                      className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                        practiceMode === 'time' 
                          ? 'bg-primary text-black shadow-[0_0_15px_rgba(114,240,180,0.3)]' 
                          : 'text-content-muted hover:text-white'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      {language === 'pl' ? 'Na czas (Wyzwanie)' : 'Time challenge'}
                    </button>
                  </div>
                </div>

                {practiceMode === 'fixed' && (
                  <div className="mb-6 relative">
                    <label className="flex items-center justify-between text-sm font-bold text-content-muted uppercase tracking-wider mb-8">
                      <span>{language === 'pl' ? 'Ilość zdań' : 'Number of sentences'}</span>
                      <div className="absolute right-0 -top-2">
                        <span ref={numSentencesRef} className="text-primary text-3xl font-black drop-shadow-[0_0_15px_rgba(114,240,180,0.5)] inline-block min-w-[2rem] text-center">
                          {numSentences}
                        </span>
                      </div>
                    </label>
                    <div className="relative pt-4 pb-2 px-2">
                      <input
                        type="range"
                        min="1"
                        max="50"
                        step="1"
                        value={numSentences}
                        onChange={(e) => setNumSentences(parseInt(e.target.value))}
                        className="w-full h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <div className="flex justify-between text-xs text-content-muted mt-3 font-mono">
                        <span>1</span>
                        <span>50</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {practiceMode === 'time' && (
                  <div className="mb-6 relative">
                    <label className="flex items-center justify-between text-sm font-bold text-content-muted uppercase tracking-wider mb-8">
                      <span>{language === 'pl' ? 'Czas na rozwiązanie (minuty)' : 'Time to solve (minutes)'}</span>
                      <div className="absolute right-0 -top-2">
                        <span ref={timeLimitRef} className="text-primary text-3xl font-black drop-shadow-[0_0_15px_rgba(114,240,180,0.5)] inline-block min-w-[2rem] text-center">
                          {timeLimit}
                        </span>
                      </div>
                    </label>
                    <div className="relative pt-4 pb-2 px-2">
                      <input
                        type="range"
                        min="1"
                        max="15"
                        step="1"
                        value={timeLimit}
                        onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                        className="w-full h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <div className="flex justify-between text-xs text-content-muted mt-3 font-mono">
                        <span>1 min</span>
                        <span>15 min</span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              <div className="pt-4">
                <AILoadingButton 
                  onClick={() => handleGenerate(false)} 
                  isLoading={isLoading}
                  loadingText={language === 'pl' ? 'AI przygotowuje ćwiczenie...' : 'AI is preparing the exercise...'}
                  className="w-full py-5 text-xl font-black bg-primary text-black hover:bg-primary/90 shadow-[0_0_40px_rgba(114,240,180,0.3)] transition-all hover:scale-[1.02] rounded-2xl"
                >
                  <Sparkles className="w-6 h-6 mr-2" />
                  {language === 'pl' ? 'Wygeneruj zadanie' : 'Generate exercise'}
                </AILoadingButton>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 animate-fade-in-up">
              <Card 
                className="cursor-pointer border-white/5 hover:border-primary/50 transition-all hover:-translate-y-1 bg-base-200/50 backdrop-blur-xl group"
                onClick={() => onStartPractice?.('intro')}
              >
                <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform">👀</div>
                <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                  {language === 'pl' ? 'Fiszki Intro' : 'Flashcards Intro'}
                </h3>
                <p className="text-content-muted text-base leading-relaxed">
                  {language === 'pl' ? 'Zapoznaj się powoli z nowym materiałem, bez sprawdzania i wyników.' : 'Familiarize yourself gently with new material, without testing or scoring.'}
                </p>
              </Card>
              <Card 
                className="cursor-pointer border-white/5 hover:border-primary/50 transition-all hover:-translate-y-1 bg-base-200/50 backdrop-blur-xl group"
                onClick={() => onStartPractice?.('flashcards')}
              >
                <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform">🗂️</div>
                <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                  {language === 'pl' ? 'Fiszki' : 'Flashcards'}
                </h3>
                <p className="text-content-muted text-base leading-relaxed">
                  {language === 'pl' ? 'Przeglądaj pojęcia i definicje. Odwracaj karty, aby sprawdzić swoją wiedzę.' : 'Review terms and definitions. Flip cards to test your knowledge.'}
                </p>
              </Card>
              <Card 
                className="cursor-pointer border-white/5 hover:border-primary/50 transition-all hover:-translate-y-1 bg-base-200/50 backdrop-blur-xl group"
                onClick={() => onStartPractice?.('quiz')}
              >
                <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform">📝</div>
                <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                  {language === 'pl' ? 'Quiz' : 'Quiz'}
                </h3>
                <p className="text-content-muted text-base leading-relaxed">
                  {language === 'pl' ? 'Szybki test wielokrotnego wyboru. Sprawdź, ile pamiętasz.' : 'Quick multiple choice test. See how much you remember.'}
                </p>
              </Card>
              <Card 
                className="cursor-pointer border-white/5 hover:border-primary/50 transition-all hover:-translate-y-1 bg-base-200/50 backdrop-blur-xl group"
                onClick={() => onStartPractice?.('match')}
              >
                <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform">🧩</div>
                <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                  {language === 'pl' ? 'Dopasowania' : 'Match'}
                </h3>
                <p className="text-content-muted text-base leading-relaxed">
                  {language === 'pl' ? 'Połącz słowo z jego definicją lub tłumaczeniem.' : 'Connect a word with its definition or translation.'}
                </p>
              </Card>
              <Card 
                className="cursor-pointer border-white/5 hover:border-primary/50 transition-all hover:-translate-y-1 bg-base-200/50 backdrop-blur-xl group md:col-span-2"
                onClick={() => onStartPractice?.('fill-in-the-blank')}
              >
                <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform">✍️</div>
                <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
                  {language === 'pl' ? 'Pisanie (Wypełnianie luk)' : 'Writing (Fill in the blank)'}
                </h3>
                <p className="text-content-muted text-base leading-relaxed">
                  {language === 'pl' ? 'Wpisz brakujące słowo w zdaniu z kontekstem. Świetne do nauki pisowni.' : 'Type the missing word in a contextual sentence. Great for spelling.'}
                </p>
              </Card>
            </div>
          )}
        </div>
      )}
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

          <div className="relative">
            {/* AI Motivating Bubble */}
            <AnimatePresence>
              {activeSentenceIndex > 0 && activeSentenceIndex % 3 === 0 && studentAnswers[activeSentenceIndex - 1]?.trim() && (
                <motion.div 
                  initial={{ opacity: 0, x: 20, y: -20, scale: 0.8 }}
                  animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute -right-4 -top-12 md:-right-12 md:-top-16 z-20"
                >
                  <div className="bg-primary text-black px-4 py-2 rounded-2xl rounded-bl-none shadow-lg font-bold text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {language === 'pl' ? 'Świetnie Ci idzie! Oby tak dalej!' : 'Great job! Keep it up!'}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
                
                {evaluationStatuses[activeSentenceIndex] === 'evaluated' && singleEvaluationResults[activeSentenceIndex] ? (
                  <div className="space-y-4">
                    <div 
                      className="w-full bg-base-300 border border-base-200 rounded-xl p-4 text-base"
                      dangerouslySetInnerHTML={{ __html: singleEvaluationResults[activeSentenceIndex].highlightedAnswer || singleEvaluationResults[activeSentenceIndex].studentAnswer }}
                    />
                    
                    <div className={`p-4 rounded-xl border ${singleEvaluationResults[activeSentenceIndex].isCorrect ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                       <div className="font-bold flex items-center gap-2 mb-4">
                         {singleEvaluationResults[activeSentenceIndex].isCorrect ? '✅ Poprawnie!' : '❌ Błędy w tłumaczeniu'}
                       </div>
                       
                       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-base-100/50 rounded-lg mb-4 border border-white/5">
                         <div className="font-medium text-primary/90">
                           {singleEvaluationResults[activeSentenceIndex].correctTranslation}
                         </div>
                         <div className="flex items-center gap-2 shrink-0 bg-base-300/50 p-1.5 rounded-md">
                           <button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-US')} className={`text-xl hover:scale-110 transition-transform ${isPlayingAudio ? 'opacity-50' : ''}`} title="🇺🇸 Amerykański" disabled={isPlayingAudio}>🇺🇸</button>
                           <button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-GB')} className={`text-xl hover:scale-110 transition-transform ${isPlayingAudio ? 'opacity-50' : ''}`} title="🇬🇧 Brytyjski" disabled={isPlayingAudio}>🇬🇧</button>
                           <button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-AU')} className={`text-xl hover:scale-110 transition-transform ${isPlayingAudio ? 'opacity-50' : ''}`} title="🇦🇺 Australijski" disabled={isPlayingAudio}>🇦🇺</button>
                           <button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-SCT')} className={`text-xl hover:scale-110 transition-transform ${isPlayingAudio ? 'opacity-50' : ''}`} title="🏴󠁧󠁢󠁳󠁣󠁴󠁿 Szkocki" disabled={isPlayingAudio}>🏴󠁧󠁢󠁳󠁣󠁴󠁿</button>
                         </div>
                       </div>

                       <div className="space-y-4 mt-2 text-sm">
                         {singleEvaluationResults[activeSentenceIndex].feedbackSyntax && (
                           <div>
                             <span className="font-bold text-content-muted text-xs uppercase tracking-wider">{language === 'pl' ? 'Szyk i gramatyka' : 'Syntax & Grammar'}</span>
                             <p className="mt-1 opacity-90">{singleEvaluationResults[activeSentenceIndex].feedbackSyntax}</p>
                           </div>
                         )}
                         {singleEvaluationResults[activeSentenceIndex].feedbackVocab && (
                           <div>
                             <span className="font-bold text-content-muted text-xs uppercase tracking-wider">{language === 'pl' ? 'Słownictwo i naturalność' : 'Vocabulary & Naturalness'}</span>
                             <p className="mt-1 opacity-90">{singleEvaluationResults[activeSentenceIndex].feedbackVocab}</p>
                           </div>
                         )}
                         {singleEvaluationResults[activeSentenceIndex].feedbackRule && (
                           <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                             <span className="font-bold text-amber-500/90 text-xs uppercase tracking-wider">{language === 'pl' ? 'Złota zasada' : 'Golden Rule'}</span>
                             <p className="mt-1 opacity-90">{singleEvaluationResults[activeSentenceIndex].feedbackRule}</p>
                           </div>
                         )}
                         {(!singleEvaluationResults[activeSentenceIndex].feedbackSyntax && !singleEvaluationResults[activeSentenceIndex].feedbackVocab) && (
                           <p className="whitespace-pre-wrap opacity-90">{singleEvaluationResults[activeSentenceIndex].explanation}</p>
                         )}
                       </div>
                    </div>
                  </div>
                ) : (
                  <>
                {exerciseFormat === 'puzzle' ? (
                  <PuzzleExercise 
                    sentence={exercises[activeSentenceIndex].englishTranslation}
                    level={level}
                    currentAnswer={studentAnswers[activeSentenceIndex] || ''}
                    onAnswerChange={(ans) => handleAnswerChange(activeSentenceIndex, ans)}
                  />
                ) : (
                  <textarea
                    value={studentAnswers[activeSentenceIndex] || ''}
                    onChange={(e) => handleAnswerChange(activeSentenceIndex, e.target.value)}
                    placeholder={language === 'pl' ? 'Wpisz swoje tłumaczenie tutaj...' : 'Type your translation here...'}
                    rows={3}
                    disabled={evaluationStatuses[activeSentenceIndex] === 'evaluating'}
                    className="w-full bg-base-300 border border-base-200 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 rounded-xl p-4 text-base outline-none transition-all duration-200"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (studentAnswers[activeSentenceIndex]?.trim()) {
                            handleEvaluateSingle();
                        }
                      }
                    }}
                  />
                )}
                </>
               )}
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
              
              {evaluationStatuses[activeSentenceIndex] !== 'evaluated' ? (
                <AILoadingButton
                  onClick={handleEvaluateSingle}
                  disabled={!studentAnswers[activeSentenceIndex]?.trim()}
                  isLoading={evaluationStatuses[activeSentenceIndex] === 'evaluating'}
                  loadingText={language === 'pl' ? 'Sprawdzanie...' : 'Checking...'}
                  className="px-6 py-3 bg-primary hover:bg-primary/95 text-black font-extrabold"
                >
                  {language === 'pl' ? 'Sprawdź' : 'Check'}
                </AILoadingButton>
              ) : (
                <>
                  {activeSentenceIndex === exercises.length - 1 && practiceMode === 'fixed' ? (
                    <AILoadingButton
                      onClick={handleFinishAll}
                      className="px-6 py-3 bg-primary hover:bg-primary/95 text-black font-extrabold"
                    >
                      {language === 'pl' ? 'Zakończ i podsumuj' : 'Finish & Summarize'}
                    </AILoadingButton>
                  ) : (
                    <AILoadingButton
                      onClick={handleNext}
                      disabled={isGeneratingMore}
                      isLoading={isGeneratingMore && activeSentenceIndex === exercises.length - 1}
                      loadingText={language === 'pl' ? 'Ładowanie ćwiczenia...' : 'Loading exercise...'}
                      className="px-6 py-3"
                    >
                      {language === 'pl' ? 'Następne' : 'Next'}
                    </AILoadingButton>
                  )}
                </>
              )}
            </div>
          </Card>
          </div>

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
        <div ref={resultsRef} className="max-w-3xl mx-auto space-y-8">
          {/* Main score board */}
          <Card className="score-board p-8 border-primary/30 bg-primary/[0.05] backdrop-blur-2xl text-center space-y-4 shadow-[0_0_40px_rgba(114,240,180,0.1),inset_0_1px_0_0_rgba(255,255,255,0.1)] rounded-3xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
            <div className="score-icon inline-flex p-4 bg-primary/20 text-primary rounded-2xl mb-2 backdrop-blur-md border border-primary/30 shadow-[0_0_20px_rgba(114,240,180,0.2)]">
              <Award className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-black relative z-10 text-white">
              {language === 'pl' ? 'Twój spersonalizowany wynik!' : 'Your overall score!'}
            </h2>
            <div className="flex justify-center items-baseline gap-2 relative z-10">
              <span className="score-text inline-block text-6xl font-black text-primary font-mono drop-shadow-[0_0_15px_rgba(114,240,180,0.4)]">{averageScore}%</span>
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
              <AILoadingButton 
                isLoading={isLoading} 
                onClick={() => handleGenerate(false)}
                loadingText={language === 'pl' ? 'Ładowanie ćwiczenia...' : 'Loading exercise...'}
                className="px-6 py-3"
              >
                {language === 'pl' ? 'Generuj kolejne zdania' : 'Generate next set'}
              </AILoadingButton>
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
                        <div className="text-xs text-content-muted font-bold mb-1 uppercase tracking-wider flex items-center justify-between">
                          <span>{language === 'pl' ? 'Rekomendowane przez AI' : 'Suggested translation'}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-content-muted mr-1">{language === 'pl' ? 'Odsłuchaj:' : 'Listen:'}</span>
                            {ACCENTS.map(accent => (
                              <button
                                key={accent}
                                onClick={() => handlePlaySentenceAudio(res.correctTranslation, accent as any, idx)}
                                disabled={playingAudioIndex === idx}
                                className="flex items-center justify-center w-6 h-6 bg-base-300/50 hover:bg-primary/20 text-primary rounded transition-colors"
                                title={`Posłuchaj (${accent})`}
                              >
                                {playingAudioIndex === idx ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <span className="text-[12px]">{ACCENT_FLAGS[accent]}</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="text-sm p-2.5 bg-primary/[0.02] border border-primary/10 text-primary-light rounded-lg font-medium">
                          {res.correctTranslation}
                        </div>
                      </div>
                    </div>

                    {/* Explanations & corrections */}
                    <details className="bg-base-200/50 p-4 rounded-xl border border-white/5 space-y-2 mt-2 group">
                      <summary className="text-sm text-yellow-300 font-bold flex items-center gap-2 uppercase tracking-wider cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                        <span className="relative flex h-3 w-3 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                        </span>
                        <Lightbulb className="w-4 h-4 shrink-0" />
                        {language === 'pl' ? 'Sprawdź Feedback' : 'Check Feedback'}
                        <svg className="w-4 h-4 ml-auto transition-transform group-open:rotate-180 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="pt-3 border-t border-white/10 mt-3 space-y-4">
                        {(res.feedbackSyntax || res.feedbackVocab || res.feedbackRule) ? (
                          <div className="space-y-3">
                            {res.feedbackSyntax && (
                              <div>
                                <div className="text-xs font-bold text-yellow-500 uppercase tracking-wider mb-1">{language === 'pl' ? 'Szyk i gramatyka' : 'Syntax & Grammar'}</div>
                                <div className="text-sm text-yellow-100/90">{res.feedbackSyntax}</div>
                              </div>
                            )}
                            {res.feedbackVocab && (
                              <div>
                                <div className="text-xs font-bold text-yellow-500 uppercase tracking-wider mb-1">{language === 'pl' ? 'Słownictwo i naturalność' : 'Vocabulary & Naturalness'}</div>
                                <div className="text-sm text-yellow-100/90">{res.feedbackVocab}</div>
                              </div>
                            )}
                            {res.feedbackRule && (
                              <div>
                                <div className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />{language === 'pl' ? 'Złota zasada' : 'Golden Rule'}</div>
                                <div className="text-sm text-yellow-50 font-medium">{res.feedbackRule}</div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm leading-relaxed text-yellow-100 whitespace-pre-wrap">
                            {res.explanation}
                          </p>
                        )}
                      </div>
                    </details>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        onConfirm={confirmModalState.onConfirm}
        onCancel={closeConfirm}
        confirmText={language === 'pl' ? 'Potwierdź' : 'Confirm'}
        cancelText={language === 'pl' ? 'Anuluj' : 'Cancel'}
      />
      </div>
    </div>
  );
};

export default AIExerciseGeneratorScreen;
