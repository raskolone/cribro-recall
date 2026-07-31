import React, { useState, useEffect, useRef, useMemo } from 'react';
import gsap from 'gsap';
import html2pdf from 'html2pdf.js';
import { useLanguage } from '../../context/LanguageContext';
import { useFlashcards } from '../../context/FlashcardContext';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs, query, orderBy, limit, addDoc, where, documentId, doc, updateDoc, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { getDoc } from 'firebase/firestore';
import { generateTranslationExercises, evaluateTranslations, getUserWeaknesses, logMistakesToFirebase, formatAIModelName } from '../../services/geminiService';
import { generateSpeech } from '../../services/elevenLabsService';
import { TranslationExercise, TranslationEvaluationResult, FlashcardSet, LessonRecord, VocabularySet, PracticeLog } from '../../types';
import { getVocabularySetsForStudent, markVocabularySetAsUsed } from '../../services/lessonRecord';
import Card from '../ui/Card';
import PuzzleExercise from './PuzzleExercise';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import MobileTopMenu from './MobileTopMenu';
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
  ChevronRight,
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
  Target,
  Layers,
  Shuffle, X, Eye, Flame,
  CheckCircle2, LayoutGrid, Mic, AlertCircle,
  Plus, Minus, ShoppingBag, Trash2, Check
} from 'lucide-react';

export interface BasketWordItem {
  id: string;
  term: string;
  definition?: string;
  sourceTopic?: string;
}

export function parseLineToWordItem(line: string, sourceTopic?: string): BasketWordItem {
  let cleanLine = line.replace(/^[\s\*\-\•\d\.]+\s*/, '').trim();
  let term = cleanLine;
  let definition = '';
  
  if (cleanLine.includes(' - ')) {
    const parts = cleanLine.split(' - ');
    term = parts[0].trim();
    definition = parts.slice(1).join(' - ').trim();
  } else if (cleanLine.includes(' – ')) {
    const parts = cleanLine.split(' – ');
    term = parts[0].trim();
    definition = parts.slice(1).join(' – ').trim();
  } else if (cleanLine.includes(' — ')) {
    const parts = cleanLine.split(' — ');
    term = parts[0].trim();
    definition = parts.slice(1).join(' — ').trim();
  } else if (cleanLine.includes(':')) {
    const parts = cleanLine.split(':');
    term = parts[0].trim();
    definition = parts.slice(1).join(':').trim();
  } else if (cleanLine.includes('=')) {
    const parts = cleanLine.split('=');
    term = parts[0].trim();
    definition = parts.slice(1).join('=').trim();
  }

  return {
    id: term.toLowerCase(),
    term,
    definition,
    sourceTopic
  };
}


const ACCENTS = ['en-US', 'en-GB'];
const ACCENT_FLAGS: Record<string, string> = {
  'en-US': '🇺🇸',
  'en-GB': '🇬🇧'
};

const DEFAULT_GENERATION_PROMPT = `ROLE:
You are an expert English Language Content Creator specializing in adaptive, personalized language practice.

TASK:
Generate natural, highly realistic sentences using the provided list of target vocabulary from the student's personal word list or lesson history. Adapt the tone and topic naturally to match the vocabulary context.

RULES FOR SENTENCE GENERATION:
- CONTEXT: Sentences MUST sound like real-world communication relevant to the provided vocabulary (e.g., casual, technical, business, everyday conversation).
- NATURALNESS: Never force multiple target words into a single sentence if it sounds awkward. Use MAXIMUM 1 target word per sentence.
- GRAMMAR & STYLE: Use modern, natural English. Avoid academic, bizarre, or forced phrasing.
- VARIETY: Use diverse sentence structures (mix conditionals, modal verbs, different tenses, and sentence lengths).
- LOGIC & REALISM: Sentences MUST be practical, logical, and make total sense in practice. Do NOT forcefully combine unrelated student profile keywords into a sentence if it compromises natural logic and realism.

[SPERSONALIZOWANE WSKAZÓWKI I PROMPT DLA KURSANTA]
Dla tego kursanta obowiązują następujące spersonalizowane wskazówki:
- Spersonalizowany Prompt Kursanta: \${userAiPrompt || "Brak specjalnych wskazówek"}
- Profil i tło kursanta: \${userProfile || "Brak dodatkowego profilu"}
- Najczęstsze błędy: \${weaknessesList || "Brak zidentyfikowanych błędów"}`;

const DEFAULT_EVALUATION_PROMPT = `ROLE:
You are a fair, intelligent AI Language Evaluator.

TASK:
Evaluate the student's translation based ONLY on the provided target sentence and expected meaning. Accept any grammatically correct, natural phrasing or valid synonym.

CRITICAL ISOLATION RULE:
Evaluate ONLY the data provided in the current input block. Ignore any previous sentences or chat history.

GRADING RUBRIC (Total Score: 100%):
1. Meaning & Accuracy (40%): Does the translation convey the exact intended meaning? Accept valid synonyms and natural reformulations! (Max 40 points)
2. Grammar & Syntax (40%): Are tenses, word order, prepositions, and articles correct? (Max 40 points)
3. Target Vocabulary & Spelling (20%): Is the key vocabulary used correctly and spelled properly? (Max 20 points)

[HISTORYCZNE BŁĘDY KURSANTA]
Zwróć dodatkową uwagę na te błędy kursanta, jeśli wystąpią: \${weaknessesList || "Brak zidentyfikowanych błędów"}`;

import { ExerciseType } from '../../types';
import i18n from "i18next";

const playSliderSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    // Wooden block / tap sound synthesis
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    // Frequency drop for wooden click
    osc.frequency.setValueAtTime(540 + Math.random() * 30, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(130, ctx.currentTime + 0.035);
    
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch (e) {
    // Ignore browser autoplay/audio context restriction errors
  }
};


const AIGenerationLoader: React.FC<{ language: 'pl' | 'en'; level: string; logs?: string; currentModel?: string }> = ({ language, level, currentModel }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tangledRef = useRef<SVGPathElement>(null);
  const spiralRef = useRef<SVGPathElement>(null);
  const stringPullRef = useRef<SVGPathElement>(null);
  const statusTextRef = useRef<HTMLParagraphElement>(null);

  const tangledPath = useMemo(() => {
    const points = [];
    const numPoints = 120;
    for (let i = 0; i < numPoints; i++) {
      const t = i * 0.5;
      const radius = 20 + 55 * Math.abs(Math.sin(t * 1.7) * Math.cos(t * 2.3));
      const angle = t * 3.4;
      points.push({
        x: 100 + radius * Math.cos(angle),
        y: 100 + radius * Math.sin(angle)
      });
    }
    let d = `M ${points[0].x} ${points[0].y} `;
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      d += `Q ${points[i].x} ${points[i].y}, ${xc} ${yc} `;
    }
    return d;
  }, []);

  const spiralPath = useMemo(() => {
    let d = "";
    const turns = 7;
    const maxRadius = 75;
    for (let i = 0; i <= 360 * turns; i += 5) {
      const angle = (i * Math.PI) / 180;
      const radius = (maxRadius * i) / (360 * turns);
      const x = 100 + radius * Math.cos(angle);
      const y = 100 + radius * Math.sin(angle);
      if (i === 0) d = `M ${x} ${y} `;
      else d += `L ${x} ${y} `;
    }
    return d;
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 1.5 });

      const tangledLength = tangledRef.current?.getTotalLength() || 2000;
      const spiralLength = spiralRef.current?.getTotalLength() || 2000;
      const pullLength = stringPullRef.current?.getTotalLength() || 500;

      // Initial state
      gsap.set(tangledRef.current, { strokeDasharray: tangledLength, strokeDashoffset: 0, opacity: 1 });
      gsap.set(spiralRef.current, { strokeDasharray: spiralLength, strokeDashoffset: spiralLength, opacity: 1 });
      gsap.set(stringPullRef.current, { strokeDasharray: pullLength, strokeDashoffset: pullLength, opacity: 0 });

      // The animation: Untangling
      tl.to(tangledRef.current, {
        strokeDashoffset: tangledLength,
        duration: 3.5,
        ease: 'power2.inOut'
      }, 0);

      // The thread being pulled away
      tl.fromTo(stringPullRef.current, 
        { strokeDashoffset: pullLength, opacity: 0 },
        { strokeDashoffset: 0, opacity: 1, duration: 1.5, ease: 'power1.in' },
        0
      );
      tl.to(stringPullRef.current, {
        strokeDashoffset: -pullLength,
        opacity: 0,
        duration: 1.5,
        ease: 'power1.out'
      }, 1.5);

      // Forming the perfect spiral
      tl.to(spiralRef.current, {
        strokeDashoffset: 0,
        duration: 3.5,
        ease: 'power2.inOut'
      }, 0.5);

      // Add a subtle rotation to the whole thing
      tl.fromTo('.yarn-container',
        { rotation: -10, scale: 0.95 },
        { rotation: 10, scale: 1.05, duration: 4, ease: 'sine.inOut' },
        0
      );

      // Pulse text
      gsap.to(statusTextRef.current, {
        opacity: 0.6,
        duration: 1.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

    }, containerRef);

    return () => ctx.revert();
  }, [language, level]);

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[420px] w-full max-w-xl mx-auto my-auto animate-fade-in">
      <div className="relative w-64 h-64 mb-6 flex items-center justify-center select-none yarn-container origin-center">
        {/* Glow behind the yarn */}
        <div className="absolute inset-0 bg-green-500/10 blur-3xl rounded-full" />
        
        <svg
          className="w-full h-full drop-shadow-[0_0_15px_rgba(74,222,128,0.3)]"
          viewBox="0 0 200 200"
          fill="none"
        >
          <defs>
            <filter id="crayon" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="4" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
          {/* Tangled chaotic string */}
          <path
            ref={tangledRef}
            d={tangledPath}
            stroke="#4ade80"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#crayon)"
          />

          {/* String pulling away from tangle */}
          <path
            ref={stringPullRef}
            d="M 100,100 C 130,50 180,20 220,-20"
            stroke="#4ade80"
            strokeWidth="4"
            strokeLinecap="round"
            filter="url(#crayon)"
          />

          {/* Organized perfect spiral */}
          <path
            ref={spiralRef}
            d={spiralPath}
            stroke="#4ade80"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#crayon)"
          />
        </svg>
      </div>

      <h3 className="text-xl font-bold text-white mb-2 tracking-tight flex items-center justify-center gap-2">
        <Sparkles className="w-5 h-5 text-green-400 animate-pulse" />
        <span>{language === 'pl' ? 'Sztuczna inteligencja rozplątuje myśli...' : 'AI is untangling concepts...'}</span>
      </h3>
      <p ref={statusTextRef} className="text-sm text-green-300/80 font-medium tracking-wide max-w-sm mx-auto">
        {language === 'pl' 
          ? 'Porządkowanie struktury i tworzenie idealnych ćwiczeń' 
          : 'Organizing structure and creating perfect exercises'}
      </p>

      <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold shadow-[0_0_20px_rgba(6,182,212,0.2)]">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
        </span>
        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
        <span>
          {language === 'pl' ? 'Wysyłam zapytanie do: ' : 'Sending query to: '}
          <strong className="text-white font-bold">{formatAIModelName(currentModel || 'deepseek-reasoner')}</strong>
        </span>
      </div>
    </div>
  );
};

const AILoadingButton = ({ isLoading, onClick, children, className, disabled, loadingText, variant = 'primary' }: any) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading || disabled}
      className={`relative overflow-hidden ${className} ${
        variant === 'primary' 
          ? 'bg-primary text-black hover:bg-primary/95' 
          : 'bg-base-200 text-white hover:bg-base-300 border border-white/10'
      } rounded-xl font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {isLoading && (
        <motion.div
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "circOut" }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-1/2 -skew-x-12"
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

interface AIExerciseGeneratorScreenProps {
  onOpenSidebar?: () => void;
  initialSetId?: string | null;
  onStartPractice?: (type: any, mode1?: boolean, mode2?: boolean) => void;
  onExerciseStateChange?: (active: boolean) => void;
  onChangeView?: (view: string, extra?: any) => void;
}

const AIExerciseGeneratorScreen: React.FC<AIExerciseGeneratorScreenProps> = ({ initialSetId = null, onStartPractice, onExerciseStateChange, onOpenSidebar, onChangeView }) => {
  const { language } = useLanguage();
  const { sets, getFlashcards } = useFlashcards();
  const { user, updateUserStreak } = useAuth();
  const isTeacher = user?.role === 'admin' || user?.role === 'teacher';
  const [translatedSentencesCount, setTranslatedSentencesCount] = useState<number>(user?.translatedSentencesCount || 0);

  // Vocabulary Basket State
  const [basketWords, setBasketWords] = useState<BasketWordItem[]>(() => {
    try {
      const saved = (function(){ try { return localStorage.getItem('ai_vocab_basket'); } catch(e) { return null; } })();
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isBasketModalOpen, setIsBasketModalOpen] = useState(false);

  useEffect(() => {
    try {
      (function(){ try { localStorage.setItem('ai_vocab_basket', JSON.stringify(basketWords)); } catch(e) {} })();
    } catch (e) {
      console.error(e);
    }
  }, [basketWords]);

  const toggleBasketWord = (wordItem: BasketWordItem) => {
    const normKey = wordItem.term.trim().toLowerCase();
    setBasketWords(prev => {
      const exists = prev.some(w => w.term.trim().toLowerCase() === normKey);
      if (exists) {
        return prev.filter(w => w.term.trim().toLowerCase() !== normKey);
      } else {
        return [...prev, { ...wordItem, id: normKey }];
      }
    });
  };

  const isWordInBasket = (term: string) => {
    const normKey = term.trim().toLowerCase();
    return basketWords.some(w => w.term.trim().toLowerCase() === normKey);
  };

  const addAllWordsFromTextToBasket = (text: string, sourceTopic?: string) => {
    if (!text) return;
    const lines = text.split(/[\n;]+/).map(l => l.trim()).filter(l => l.length > 0);
    const newItems = lines.map(line => parseLineToWordItem(line, sourceTopic));
    
    setBasketWords(prev => {
      const existingKeys = new Set(prev.map(w => w.term.trim().toLowerCase()));
      const toAdd = newItems.filter(item => !existingKeys.has(item.term.trim().toLowerCase()));
      return [...prev, ...toAdd];
    });
  };

  const clearBasket = () => {
    setBasketWords([]);
  };

  const syncBasketToFirestoreSet = async (items: BasketWordItem[]) => {
    if (!user?.id || items.length === 0) return null;
    const setId = `set-basket-${user.id}`;
    const setRef = doc(db, `sets/${setId}`);
    
    await setDoc(setRef, {
      userId: user.id,
      title: language === 'pl' ? 'Koszyk Słówek' : 'Vocabulary Basket',
      description: language === 'pl' ? `Wybrane słówka (${items.length})` : `Custom selected words (${items.length})`,
      isPublic: false,
      cardCount: items.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isBasketSet: true
    });

    const batch = writeBatch(db);
    items.forEach((item, index) => {
      const cardRef = doc(db, `sets/${setId}/flashcards/card-${index}`);
      batch.set(cardRef, {
        position: index,
        term: item.term,
        definition: item.definition || '',
        termLanguage: 'English',
        definitionLanguage: 'Polish'
      });
    });
    await batch.commit();
    return setId;
  };

  const handleStartBasketPractice = async (type: 'intro' | 'flashcards' | 'quiz' | 'match') => {
    if (!user?.id || basketWords.length === 0) {
      alert(language === 'pl' ? 'Koszyk jest pusty! Dodaj najpierw słówka przyciskiem +' : 'Basket is empty! Add words first using +');
      return;
    }
    setIsLoading(true);
    try {
      const setId = await syncBasketToFirestoreSet(basketWords);
      if (setId && onChangeView) {
        onChangeView('flashcard-study', { 
          activeSetId: setId, 
          practiceView: { type: 'exercise', exercise: type } 
        });
      } else {
        onStartPractice?.(type);
      }
    } catch (err) {
      console.error("Could not sync basket set:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      if (user.translatedSentencesCount !== undefined) {
        setTranslatedSentencesCount(user.translatedSentencesCount);
      } else {
        getDocs(collection(db, `users/${user.id}/practiceLogs`)).then(snapshot => {
          let total = 0;
          snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.detailedFeedback && Array.isArray(data.detailedFeedback)) {
              total += data.detailedFeedback.length;
            } else if (data.totalWords) {
              total += data.totalWords;
            }
          });
          setTranslatedSentencesCount(total);
          updateDoc(doc(db, 'users', user.id), { translatedSentencesCount: total }).catch(console.error);
        }).catch(console.error);
      }
    }
  }, [user?.id, user?.translatedSentencesCount]);

  // Settings states
  const [activeTab, setActiveTab] = useState<'ai' | 'other'>('ai');
  const [selectedSetId, setSelectedSetId] = useState<string>('all');
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [level, setLevel] = useState<string>(user?.level || 'B1');
  const [numSentences, setNumSentences] = useState<number>(5);
  const [practiceMode, setPracticeMode] = useState<'fixed' | 'time'>('fixed');
  const [exerciseFormat, setExerciseFormat] = useState<'typing' | 'puzzle' | 'test' | 'speaking'>('puzzle');
  const [isLessonSelectorOpen, setIsLessonSelectorOpen] = useState(false);
  const [previewVocabSet, setPreviewVocabSet] = useState<VocabularySet | null>(null);
  const [selectedGrammarTopics, setSelectedGrammarTopics] = useState<any[]>([]);
  const [expandedGrammarLevel, setExpandedGrammarLevel] = useState<number | null>(null);

  const [timeLimit, setTimeLimit] = useState<number>(3); // minutes
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const numSentencesRef = useRef<HTMLSpanElement>(null);
  const timeLimitRef = useRef<HTMLSpanElement>(null);

  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
  const [testName, setTestName] = useState<string>('');
  const [customGenPrompt, setCustomGenPrompt] = useState<string>(() => {
    return (function(){ try { return localStorage.getItem('ai_custom_gen_prompt'); } catch(e) { return null; } })() || DEFAULT_GENERATION_PROMPT;
  });
  const [evaluationStrictness, setEvaluationStrictness] = useState<'normal' | 'strict' | 'loose'>('normal');
  const [customEvalPrompt, setCustomEvalPrompt] = useState<string>(() => {
    return (function(){ try { return localStorage.getItem('ai_custom_eval_prompt'); } catch(e) { return null; } })() || DEFAULT_EVALUATION_PROMPT;
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
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [grammarChapters, setGrammarChapters] = useState<any[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  
  // Loading & error states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [activeGeneratingModel, setActiveGeneratingModel] = useState<string>('deepseek-reasoner');
  const [error, setError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<string>('');
  const addLog = (msg: string) => { console.log(msg); setDebugLogs(prev => prev + "\n" + msg); };
  
  // UI states
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);

  const handlePlaySentenceAudio = async (text: string, lang: string, index: number) => {
    if (playingAudioIndex === index) return;
    setPlayingAudioIndex(index);
    
    const audio = new Audio();
    audio.play().catch(() => {});

    try {
      const generatedAudio = await generateSpeech(text, lang as any);
      audio.src = generatedAudio.src;
      audio.onended = () => {
        setPlayingAudioIndex(null);
      };
      audio.onerror = () => {
        setPlayingAudioIndex(null);
      };
      await audio.play();
    } catch (err) {
      console.error(err);
      setPlayingAudioIndex(null);
    }
  };

  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number>(0);
  const [step, setStep] = useState<'setup' | 'practice' | 'results' | 'puzzle-success'>('setup');

  useEffect(() => {
    if (onExerciseStateChange) {
      onExerciseStateChange(step === 'practice');
    }
  }, [step, onExerciseStateChange]);
  const [vocabularySets, setVocabularySets] = useState<VocabularySet[]>([]);
  const [specialTasks, setSpecialTasks] = useState<any[]>([]);
  const [isLessonsExpanded, setIsLessonsExpanded] = useState<boolean>(false);
  const [isCustomSetsExpanded, setIsCustomSetsExpanded] = useState<boolean>(false);
  const [previewedSetId, setPreviewedSetId] = useState<string | null>(null);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const practiceCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (practiceCardRef.current && step === 'practice') {
      gsap.fromTo(practiceCardRef.current,
        { opacity: 0, y: 15, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "power2.out" }
      );
    }
  }, [activeSentenceIndex, step]);

  useEffect(() => {
    if (numSentencesRef.current) {
      const targetScale = 0.7 + (numSentences / 20) * 0.8;
      gsap.fromTo(numSentencesRef.current, 
        { scale: targetScale * 1.5, color: '#ffffff' }, 
        { scale: targetScale, color: '#72f0b4', duration: 0.5, ease: 'back.out(2)' }
      );
    }
  }, [numSentences]);

  useEffect(() => {
    if (timeLimitRef.current) {
      const targetScale = 0.7 + (timeLimit / 20) * 0.8;
      gsap.fromTo(timeLimitRef.current, 
        { scale: targetScale * 1.5, color: '#ffffff' }, 
        { scale: targetScale, color: '#72f0b4', duration: 0.5, ease: 'back.out(2)' }
      );
    }
  }, [timeLimit]);



  useEffect(() => {
    const fetchTopics = async () => {
      setIsLoadingTopics(true);
      try {
        const docRef = doc(db, 'system', 'topic_database');
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().chapters) {
          setGrammarChapters(snap.data().chapters);
        }
      } catch (err) {
        console.error("Error fetching grammar topics", err);
      } finally {
        setIsLoadingTopics(false);
      }
    };
    fetchTopics();
  }, []);

  useEffect(() => {
    if (user?.id) {
      getVocabularySetsForStudent(user.id)
        .then(setVocabularySets)
        .catch(console.error);

      // fetch special tasks
      import('firebase/firestore').then(({ collection, getDocs, query, where, orderBy }) => {
        const tasksQ = query(collection(db, 'specialTasks'), where('studentId', '==', user.id));
        getDocs(tasksQ).then(snap => {
          const tasks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
          tasks.sort((a, b) => new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt).getTime() - new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt).getTime());
          setSpecialTasks(tasks.filter(t => t.status === 'pending')); // only pending tasks
        });
      });
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
    if (step === 'results' && evaluationResults.length > 0 && resultsRef.current && resultsRef.current.children.length > 0) {
      const tl = gsap.timeline();
      
      // Initial state
      gsap.set(gsap.utils.toArray(resultsRef.current.children), { y: 50, opacity: 0 });
      const scoreBoard = resultsRef.current.querySelector('.score-board');
      const scoreText = resultsRef.current.querySelector('.score-text');
      const icon = resultsRef.current.querySelector('.score-icon');
      
      if (scoreBoard) gsap.set(scoreBoard, { scale: 0.8, opacity: 0 });
      if (scoreText) gsap.set(scoreText, { scale: 0, rotation: -45 });
      if (icon) gsap.set(icon, { scale: 0, rotation: 180 });
      
      // Animation sequence
      tl.to(gsap.utils.toArray(resultsRef.current.children), {
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
    (function(){ try { localStorage.setItem('ai_custom_gen_prompt', customGenPrompt); } catch(e) {} })();
    (function(){ try { localStorage.setItem('ai_custom_eval_prompt', customEvalPrompt); } catch(e) {} })();
    alert(language === 'pl' ? 'Prompty zostały pomyślnie zapisane!' : 'Prompts saved successfully!');
  };

  const handleResetPrompts = () => {
    if (window.confirm(language === 'pl' ? 'Czy na pewno chcesz zresetować prompty do domyślnych?' : 'Are you sure you want to reset prompts to default?')) {
      setCustomGenPrompt(DEFAULT_GENERATION_PROMPT);
      setCustomEvalPrompt(DEFAULT_EVALUATION_PROMPT);
      (function(){ try { localStorage.removeItem('ai_custom_gen_prompt'); } catch(e) {} })();
      (function(){ try { localStorage.removeItem('ai_custom_eval_prompt'); } catch(e) {} })();
    }
  };

  const handleStartOtherPractice = (type: any, mode1?: boolean, mode2?: boolean) => {
    if (selectedSetId === 'basket') {
      handleStartBasketPractice(type);
      return;
    }
    if (user?.id && (selectedSetId === 'lessons' || selectedLessonIds.length > 0)) {
      selectedLessonIds.forEach(id => {
        const set = vocabularySets.find(s => s.id === id);
        if (set && set.used === false) {
          set.used = true;
          markVocabularySetAsUsed(user.id, id).catch(console.error);
        }
      });
    }
    
    // Instead of using onStartPractice which does nothing, we switch view to flashcards.
    // If multiple selected, we just pass the first one for now (or a combined set if possible).
    // The Dashboard needs to support initialMode.
    const setIdToUse = selectedSetId === 'lessons' && selectedLessonIds.length > 0 ? selectedLessonIds[0] : (selectedSetId === 'grammar' ? null : selectedSetId);
    if (onChangeView) {
      onChangeView('flashcard-study', { setId: setIdToUse || '', initialMode: type });
    } else {
      onStartPractice?.(type, mode1, mode2);
    }
  };

  // Generate exercises using Gemini
  const handleGenerate = async (isAppending = false, specialPromptOverride?: string) => {
    if (selectedSetId?.startsWith('special-task-')) {
      const taskId = selectedSetId.replace('special-task-', '');
      const task = specialTasks.find(t => t.id === taskId);
      if (task) {
        if (isAppending) {
           setIsGeneratingMore(false);
           return; // special tasks have fixed number of sentences, don't generate more
        }
        setIsLoading(true);
        setError('');
        try {
           setExercises(task.sentences);
           setStudentAnswers(new Array(task.sentences.length).fill(''));
           setShowHints(new Array(task.sentences.length).fill(false));
           setStep('practice');
        } catch(e) {
           setError('Błąd ładowania zadania specjalnego');
        } finally {
           setIsLoading(false);
        }
        return;
      }
    }
    addLog('Starting handleGenerate');
    
    // Mark any selected vocabulary sets as used
    if (user?.id && (selectedSetId === 'lessons' || selectedLessonIds.length > 0)) {
      selectedLessonIds.forEach(id => {
        const set = vocabularySets.find(s => s.id === id);
        if (set && set.used === false) {
          set.used = true;
          markVocabularySetAsUsed(user.id, id).catch(console.error);
        }
      });
    }

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

      
      let weaknessesListStr = "Brak zidentyfikowanych błędów";
      
      const fetchPromises: Promise<void>[] = [];

      // Fetch user's recent lesson records for context
      if (user) {
        fetchPromises.push((async () => {
          try {
            const lessonRecordsRef = collection(db, `users/${user.id}/lessonRecords`);
            let lrList: LessonRecord[] = [];
            
            // If user selected specific lessons, load those lessons' context
            if ((selectedSetId === 'lessons' || selectedLessonIds.length > 0) && vocabularySets.length > 0) {
               const selectedSets = vocabularySets.filter(s => selectedLessonIds.includes(s.id));
               const targetRecordIds = selectedSets.map(s => s.lessonRecordId).filter(Boolean);
               if (targetRecordIds.length > 0) {
                  const qLR = query(lessonRecordsRef, where(documentId(), 'in', targetRecordIds.slice(0, 10)));
                  const lrSnapshot = await getDocs(qLR);
                  lrList = lrSnapshot.docs.map(doc => doc.data() as LessonRecord);
               }
            }
            
            // If no specific lessons picked or found, fallback to latest 3
            if (lrList.length === 0) {
               const qLR = query(lessonRecordsRef, orderBy('date', 'desc'), limit(3));
               const lrSnapshot = await getDocs(qLR);
               lrList = lrSnapshot.docs.map(doc => doc.data() as LessonRecord);
            }
            
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
        })());

        // Fetch practice logs
        fetchPromises.push((async () => {
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
        })());
        
        // Fetch weaknesses
        fetchPromises.push((async () => {
          try {
            weaknessesListStr = await getUserWeaknesses(user.id);
          } catch (e) {
            console.warn("Could not fetch user weaknesses", e);
          }
        })());
      }

      // Extract words from chosen set if applicable
      if (selectedSetId !== 'general') {
        fetchPromises.push((async () => {
          try {
            if (selectedSetId === 'basket') {
              if (basketWords.length === 0) {
                setIsLoading(false);
                setError(language === 'pl' ? 'Twój koszyk jest pusty! Dodaj najpierw słówka z lekcji przyciskiem +' : 'Basket is empty! Add words from lessons using +');
                setIsBasketModalOpen(true);
                return;
              }
              wordsToUse = basketWords.map(w => w.definition ? `${w.term} (${w.definition})` : w.term);
            } else if (selectedSetId === 'lessons' || selectedLessonIds.length > 0) {
              const selectedSets = vocabularySets.filter(s => selectedLessonIds.includes(s.id));
              const allWords: string[] = [];
              selectedSets.forEach(set => {
                if (set.vocabularyText) {
                  const items = set.vocabularyText.split(/[\n,;]+/).map(i => i.trim()).filter(i => i.length > 0);
                  allWords.push(...items);
                }
              });
              wordsToUse = Array.from(new Set(allWords)).slice(0, 15);
            } else if (selectedSetId.startsWith('vocab-')) {
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
          } catch (e) {
            console.warn("Could not fetch flashcards for wordsToUse", e);
          }
        })());
      }

      addLog('Waiting for fetchPromises');
      await Promise.all(fetchPromises);
      addLog('fetchPromises resolved');

      // Call Gemini API service function
      const studentProfileContext = `
Spersonalizowany Prompt Kursanta (ŻELAZNE WSKAZÓWKI AI DLA KURSANTA):
${user?.aiPrompt ? user.aiPrompt : 'Brak dodatkowych wskazówek.'}

Profil i tło kursanta:
${user?.description ? user.description : 'Brak dodatkowego opisu.'}
`;
      
      let userProfileStr = user?.description || "Brak danych";
      let userAiPromptStr = user?.aiPrompt || "Brak dodatkowych wskazówek";
      
      let finalGenPrompt = customGenPrompt;
      finalGenPrompt += `\n\n- CHUNKING: Generate sentences and split them into puzzle chunks based on student's proficiency level (${level}).
  - For A1/A2: Split into many, smaller chunks (more puzzle pieces).
  - For B1/B2: Split into moderate chunks.
  - For C1/C2: Split into fewer, larger chunks.
  Return the chunks as an array of strings in a JSON field named "puzzleChunks".`;

      if (selectedSetId === 'grammar' && selectedGrammarTopics && selectedGrammarTopics.length > 0) {
         const combinedSentences = selectedGrammarTopics.map(t => `--- ${t.name} ---\n${t.sentences}`).join('\n\n');
         finalGenPrompt += `\n\n[TŁUMACZENIA - GRAMATYKA (CRITICAL REGION)]: Zignoruj globalne wytyczne poziomu kursanta. Wygeneruj zdania adekwatne do podanych przykładów z bazy. Używaj konstrukcji gramatycznych z przykładów. Przykłady z bazy:\n${combinedSentences}`;
      }
      if (additionalInstructions.trim().length > 0) {
        finalGenPrompt += '\n\nDODATKOWE INSTRUKCJE OD NAUCZYCIELA: ' + additionalInstructions;
      }
      if (specialPromptOverride) {
        finalGenPrompt += '\n\n' + specialPromptOverride;
      }
      const resolvedGenPrompt = finalGenPrompt
        .replace(/\$\{userProfile(?: \|\| "[^"]+")?\}/g, userProfileStr)
        .replace(/\$\{userAiPrompt(?: \|\| "[^"]+")?\}/g, userAiPromptStr)
        .replace(/\$\{weaknessesList(?: \|\| "[^"]+")?\}/g, weaknessesListStr);

      addLog('Calling generateTranslationExercises');
      const generated = await generateTranslationExercises(
        level, 
        wordsToUse, 
        resolvedGenPrompt, 
        lessonContextString, 
        studentProfileContext, 
        practiceMode === 'time' ? 10 : numSentences, 
        pastExercisesContext, 
        weaknessesListStr,
        selectedSetId === 'grammar',
        (model) => setActiveGeneratingModel(model)
      );
      
      addLog('generateTranslationExercises returned ' + (generated ? generated.length : 'null'));
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
    
    const audio = new Audio();
    audio.play().catch(() => {});

    try {
      const generatedAudio = await generateSpeech(text, lang as any);
      audio.src = generatedAudio.src;
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      await audio.play();
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
      const results = await evaluateTranslations(
        [exercises[currentIdx]], 
        [answer], 
        strictnessPrompt, 
        evalStudentContext,
        (model) => setActiveGeneratingModel(model)
      );
      
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
    if (exerciseFormat === 'puzzle') {
      setStep('puzzle-success');
      return;
    }

    setIsGeneratingMore(true);
    let currentEvalResults = { ...singleEvaluationResults };
    
    // Fill in default results for empty answers
    for (let i = 0; i < exercises.length; i++) {
      if (!studentAnswers[i]?.trim() && !currentEvalResults[i]) {
        currentEvalResults[i] = {
          polishSentence: exercises[i].polishSentence,
          correctTranslation: exercises[i].englishTranslation,
          studentAnswer: '',
          isCorrect: false,
          score: 0,
          explanation: language === 'pl' ? 'Brak odpowiedzi.' : 'No answer provided.',
          suggested_better_version: exercises[i].englishTranslation,
          feedbackSyntax: '',
          feedbackVocab: '',
          feedbackRule: '',
          breakdown: {
            meaning_score: 0,
            grammar_score: 0,
            vocabulary_score: 0
          }
        };
      }
    }

    // Find sentences that need evaluation
    const unevaluatedIndices = [];
    for (let i = 0; i < exercises.length; i++) {
      if (studentAnswers[i]?.trim() && !currentEvalResults[i]) {
        unevaluatedIndices.push(i);
      }
    }

    if (unevaluatedIndices.length > 0) {
      try {
        const evalStudentContext = `${user?.firstName ? `Zwracaj się do ucznia po imieniu (${user.firstName}), odmieniając je naturalnie we wszystkich przypadkach w języku polskim zgodnie z regułami języka polskiego.` : ''}`;
        let weaknessesListStr = "Brak zidentyfikowanych błędów";
        if (user) {
          weaknessesListStr = await getUserWeaknesses(user.id);
        }
        let strictnessPrompt = customEvalPrompt.replace(/\$\{weaknessesList(?: \|\| "[^"]+")?\}/g, weaknessesListStr);
        if (evaluationStrictness === 'strict') {
          strictnessPrompt += '\n\nOCENIAJ BARDZO RYGORYSTYCZNIE. Każdy drobny błąd w pisowni, czasie lub przedimku (a/an/the) oznacza isCorrect: false.';
        } else if (evaluationStrictness === 'loose') {
          strictnessPrompt += '\n\nOCENIAJ LUŹNO. Akceptuj drobne błędy i literówki. Zwracaj uwagę na ogólny przekaz.';
        }

        const exercisesToEval = unevaluatedIndices.map(i => exercises[i]);
        const answersToEval = unevaluatedIndices.map(i => studentAnswers[i]);
        const batchResults = await evaluateTranslations(
          exercisesToEval, 
          answersToEval, 
          strictnessPrompt, 
          evalStudentContext,
          (model) => setActiveGeneratingModel(model)
        );

        if (batchResults && batchResults.length === unevaluatedIndices.length) {
          batchResults.forEach((res, idx) => {
            currentEvalResults[unevaluatedIndices[idx]] = res;
          });
          setSingleEvaluationResults(currentEvalResults);
          
          let newStatuses = {};
          unevaluatedIndices.forEach(idx => {
            newStatuses[idx] = 'evaluated';
          });
          setEvaluationStatuses(prev => ({ ...prev, ...newStatuses }));
        }
      } catch (err) {
        console.error("Batch evaluation failed", err);
        setError(language === 'pl' ? "Nie udało się ocenić wszystkich odpowiedzi z powodu błędu. Wygenerowano przybliżone wyniki." : "Failed to evaluate all answers due to an error. Fallback results generated.");
        
        // Fallback for failed evaluation
        unevaluatedIndices.forEach(idx => {
           currentEvalResults[idx] = {
             polishSentence: exercises[idx].polishSentence,
             correctTranslation: exercises[idx].englishTranslation,
             studentAnswer: studentAnswers[idx] || '',
             isCorrect: false,
             score: 0,
             explanation: language === 'pl' ? 'Wystąpił błąd podczas oceny.' : 'An error occurred during evaluation.',
             suggested_better_version: exercises[idx].englishTranslation,
             feedbackSyntax: '',
             feedbackVocab: '',
             feedbackRule: '',
             breakdown: { meaning_score: 0, grammar_score: 0, vocabulary_score: 0 }
           };
        });
      }
    }

    setIsGeneratingMore(false);

    // Generate full results
    // currentEvalResults now contains evaluations for all items
    const results = exercises.map((_, i) => currentEvalResults[i]);
    setEvaluationResults(results);
    setStep('results');
    setTimeLeft(null);

    if (user && results.length > 0) {
      const score = Math.round(results.reduce((acc, r) => acc + (r?.score || 0), 0) / results.length);
      const exercisesDetails = results.map((r) => {
        if (r.explanation === 'Ułożono poprawnie.') {
           return `${r.polishSentence} -> ${r.studentAnswer} [UKŁADANKA - Wymagane powtórzenie przez samodzielne Wpisywanie]`;
        }
        return `${r.polishSentence} -> ${r.studentAnswer}`;
      }).join(' | ');
      
      const detailedFeedback = results.map((r) => ({
        polishSentence: r?.polishSentence || '',
        studentAnswer: r?.studentAnswer || '',
        correctTranslation: r?.correctTranslation || '',
        isCorrect: r?.isCorrect || false,
        score: r?.score || 0,
        explanation: r?.explanation || '',
        feedbackSyntax: r?.feedbackSyntax || '',
        feedbackVocab: r?.feedbackVocab || '',
        feedbackRule: r?.feedbackRule || ''
      }));

      const logData: any = {
        exerciseType: 'ai_translation',
        date: new Date().toISOString(),
        isRevisionMode: false,
        score: score,
        totalWords: results.length,
        exercisesData: exercisesDetails,
        detailedFeedback: detailedFeedback
      };
      if (testName) logData.testName = testName;
      
      try {
        await addDoc(collection(db, `users/${user.id}/practiceLogs`), logData);
        const allMistakes = results.flatMap(r => r.mistakes || []);
        if (allMistakes.length > 0) {
          await logMistakesToFirebase(user.id, allMistakes);
        }

        const newSentencesCount = (user?.translatedSentencesCount || translatedSentencesCount || 0) + results.length;
        setTranslatedSentencesCount(newSentencesCount);
        await updateDoc(doc(db, 'users', user.id), { translatedSentencesCount: newSentencesCount });
        if (updateUserStreak) {
          updateUserStreak().catch(console.error);
        }

        // mark special task as completed
        if (selectedSetId?.startsWith('special-task-')) {
           const taskId = selectedSetId.replace('special-task-', '');
           import('firebase/firestore').then(({ doc, updateDoc }) => {
              updateDoc(doc(db, 'specialTasks', taskId), { status: 'completed' });
           });
        }
      } catch (e) {
        console.warn("Could not save practice log or log mistakes", e);
      }
    }
  };

  const handleProceedToTrueChallenge = () => {
    setExerciseFormat('typing');
    const puzzleSentences = exercises.map(e => e.englishTranslation).join(' | ');
    const override = `WYMÓG SPECJALNY: Uczeń właśnie ukończył układankę z tymi zdaniami: [${puzzleSentences}]. Wygeneruj nowe zdania, które są PODOBNE tematycznie i używają podobnych struktur gramatycznych, ale SĄ INNE (nie kopiuj ich). To ma być "prawdziwe wyzwanie" gdzie uczeń samodzielnie tłumaczy nowe zdania.`;
    setExercises([]);
    setStudentAnswers([]);
    setActiveSentenceIndex(0);
    setEvaluationStatuses({});
    setSingleEvaluationResults({});
    handleGenerate(false, override);
  };

  const handleMaybeLater = () => {
    setExerciseFormat('typing');
    setStep('setup');
    setExercises([]);
    setStudentAnswers([]);
    setTimeLeft(null);
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

      {/* GLOBAL MOBILE HEADER */}
      <div className="md:hidden pt-6 pb-2 px-6 flex items-center justify-between bg-transparent z-40">
        <button 
          onClick={onOpenSidebar}
          className="p-2 -ml-2 text-content-muted hover:text-white rounded-lg hover:bg-white/5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
          {step === 'setup' ? (language === 'pl' ? 'Czas na trening' : 'Time for training') : 
           step === 'practice' ? (language === 'pl' ? 'Ćwiczenie' : 'Practice') :
           step === 'results' ? (language === 'pl' ? 'Wyniki' : 'Results') : 
           (language === 'pl' ? 'Sukces' : 'Success')}
        </h2>
        <div className="flex items-center gap-2">
          {step === 'practice' && (
            <button
              onClick={() => {
                showConfirm(
                  language === 'pl' ? 'Zakończ trening' : 'End session',
                  language === 'pl' ? 'Czy na pewno chcesz zakończyć sesję nauki? Dotychczasowe odpowiedzi zostaną ocenione.' : 'Are you sure you want to end this study session? Your answers will be evaluated.',
                  () => {
                    closeConfirm();
                    handleFinishAll();
                  }
                );
              }}
              className="p-2 text-content-muted hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          )}
          {onChangeView ? (
            <MobileTopMenu 
              currentView="dashboard" 
              onChangeView={onChangeView}
              isExerciseActive={step === 'practice' || step === 'results'}
              onConfirmEndSession={(onEnd) => {
                showConfirm(
                  language === 'pl' ? 'Zakończ trening' : 'End session',
                  language === 'pl' ? 'Czy na pewno chcesz zakończyć sesję nauki? Dotychczasowe odpowiedzi zostaną ocenione.' : 'Are you sure you want to end this study session? Your answers will be evaluated.',
                  () => {
                    closeConfirm();
                    onEnd();
                  }
                );
              }}
            />
          ) : (
            <div className="w-10" />
          )}
        </div>
      </div>

      {step === 'setup' && (
        <div className="md:hidden px-6 pt-1 pb-3 flex flex-col gap-2 border-b border-white/10">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
              {language === 'pl' 
                ? `Przetłumaczyłeś już ${translatedSentencesCount} zdań. Świetna robota!` 
                : `You translated ${translatedSentencesCount} sentences. Great job!`}
            </p>
            <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-xl shrink-0">
              <Flame className="w-4 h-4 text-amber-400 fill-amber-300" />
              <span className="text-xs font-bold text-amber-300">
                {user?.streakCount || 0}d
              </span>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {(isLoading || isEvaluating || isGeneratingMore) && (
          <motion.div key="global-loader" 
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
        <div className="hidden md:flex flex-col md:flex-row md:items-center justify-end gap-4 border-b border-base-300 pb-2">
        <div className="flex items-center gap-2">
          {isTeacher && (
            <button
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title={language === 'pl' ? 'Konfiguracja Promptu' : 'Prompt Setup'}
            >
              <Settings className="w-5 h-5" />
            </button>
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
                className="w-full bg-black/30 backdrop-blur-sm border border-white/10 shadow-inner rounded-lg p-2.5 text-xs font-mono outline-none focus:border-primary/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-content-muted">{language === 'pl' ? 'Prompt Oceny & Korekty' : 'Evaluation Prompt'}</label>
              <textarea 
                value={customEvalPrompt}
                onChange={(e) => setCustomEvalPrompt(e.target.value)}
                rows={5}
                className="w-full bg-black/30 backdrop-blur-sm border border-white/10 shadow-inner rounded-lg p-2.5 text-xs font-mono outline-none focus:border-primary/50"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Enhanced Error & Loading Logs */}
      <AnimatePresence>
        {error && (
          <motion.div key="error-banner" 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="mb-6 bg-gradient-to-r from-red-500/20 to-red-900/20 border border-red-500/30 backdrop-blur-md text-red-100 p-4 rounded-2xl shadow-[0_8px_30px_rgba(239,68,68,0.15)] flex flex-col gap-3 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500/50" />
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-500/20 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1 mt-1">
                <h4 className="font-bold text-red-300 text-sm mb-1">{language === 'pl' ? 'Ups, coś poszło nie tak' : 'Oops, something went wrong'}</h4>
                <div className="text-sm text-red-200/90 leading-relaxed">{error}</div>
              </div>
              <button 
                onClick={() => setError(null)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors shrink-0"
              >
                <X className="w-5 h-5 text-red-400/70" />
              </button>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STEP 1: SETUP */}
      {step === 'setup' && (
        isLoading ? (
          <AIGenerationLoader language={language} level={level} logs={debugLogs} currentModel={activeGeneratingModel} />
        ) : (
          <div className="max-w-2xl mx-auto sm:mt-4 w-full">
            
            <Card className="p-0 md:p-8 border-none md:border-solid md:border md:border-white/10 bg-[#05080f] md:bg-[#0d131d] backdrop-blur-2xl relative overflow-visible md:overflow-hidden flex flex-col rounded-none md:rounded-3xl shadow-none md:shadow-[0_20px_60px_rgba(0,0,0,0.55)] max-w-2xl mx-auto min-h-screen md:min-h-0">


              {/* Single Box Body content */}
              <div>
                {activeTab === 'ai' ? (

                  <>
                  {/* --- MOBILE REDESIGN (Only visible below 'sm' breakpoint) --- */}
                  <div className="block md:hidden bg-[#05080f] min-h-screen pb-32 animate-fade-in-up">
                    {/* Content Container */}
                    <div className="px-6 space-y-8">
                      
                      {/* Section 1: TRYB ĆWICZENIA */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                            {language === 'pl' ? 'Tryb ćwiczenia' : 'Exercise mode'}
                          </label>
                          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-semibold">
                            4 Formaty
                          </span>
                        </div>

                        {/* Top Row: Two Large Primary Cards (Puzzle & Typing) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Card 1: Układanka */}
                          <div className="relative group">
                            <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 animate-pulse pointer-events-none" />
                            <button 
                              type="button"
                              onClick={() => setExerciseFormat('puzzle')}
                              className={`w-full group/card relative text-left rounded-3xl p-5 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer min-h-[170px] ${
                                exerciseFormat === 'puzzle' 
                                  ? 'bg-[#0a0e17]/90 backdrop-blur-md border-2 border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.45)] scale-[1.02]' 
                                  : 'backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:border-emerald-500/70 hover:shadow-[0_0_35px_rgba(16,185,129,0.35)] hover:-translate-y-1'
                              }`}
                            >
                              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />

                              <div className="flex items-center justify-between w-full z-10">
                                <div className={`w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover/card:scale-110 transition-transform ${exerciseFormat === 'puzzle' ? 'text-emerald-400 bg-emerald-500/20 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : ''}`}>
                                  <LayoutGrid className="w-6 h-6 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                </div>
                                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                  {language === 'pl' ? 'Rekomendowane' : 'Recommended'}
                                </span>
                              </div>

                              <div className="z-10 mt-3">
                                <h3 className="text-xl font-serif font-bold text-white group-hover/card:text-emerald-400 transition-colors flex items-center gap-1.5">
                                  {language === 'pl' ? 'Układanka' : 'Puzzle'} <ChevronRight className="w-5 h-5 text-emerald-400 group-hover/card:translate-x-1 transition-transform" />
                                </h3>
                                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                                  {language === 'pl' ? 'Układaj zdania z interaktywnych klocków i ucz się szybkiego szyku.' : 'Assemble sentences from interactive tiles.'}
                                </p>
                              </div>
                            </button>
                          </div>

                          {/* Card 2: Prawdziwe Wyzwanie */}
                          <div className="relative group">
                            <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-cyan-500/0 via-cyan-500/40 to-cyan-500/0 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 animate-pulse pointer-events-none" />
                            <button 
                              type="button"
                              onClick={() => setExerciseFormat('typing')}
                              className={`w-full group/card relative text-left rounded-3xl p-5 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer min-h-[170px] ${
                                exerciseFormat === 'typing' 
                                  ? 'bg-[#0a0e17]/90 backdrop-blur-md border-2 border-cyan-400 shadow-[0_0_35px_rgba(6,182,212,0.45)] scale-[1.02]' 
                                  : 'backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:border-cyan-500/70 hover:shadow-[0_0_35px_rgba(6,182,212,0.35)] hover:-translate-y-1'
                              }`}
                            >
                              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />

                              <div className="flex items-center justify-between w-full z-10">
                                <div className={`w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover/card:scale-110 transition-transform ${exerciseFormat === 'typing' ? 'text-cyan-400 bg-cyan-500/20 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : ''}`}>
                                  <Keyboard className="w-6 h-6 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                                </div>
                                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">
                                  {language === 'pl' ? 'Wpisywanie' : 'Typing'}
                                </span>
                              </div>

                              <div className="z-10 mt-3">
                                <h3 className="text-xl font-serif font-bold text-white group-hover/card:text-cyan-400 transition-colors flex items-center gap-1.5">
                                  {language === 'pl' ? 'Prawdziwe Wyzwanie' : 'Real Challenge'} <ChevronRight className="w-5 h-5 text-cyan-400 group-hover/card:translate-x-1 transition-transform" />
                                </h3>
                                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                                  {language === 'pl' ? 'Pisanie pełnych zdań z pamięci i inteligentna korekta AI.' : 'Type full sentences with instant AI feedback.'}
                                </p>
                              </div>
                            </button>
                          </div>
                        </div>
                        
                        {/* Bottom Row: Two Compact Cards (Flashcards & Match) */}
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          {/* Card 3: Fiszki */}
                          <div className="relative group">
                            <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-purple-500/0 via-purple-500/50 to-purple-500/0 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 animate-pulse pointer-events-none" />
                            <button
                              type="button"
                              onClick={() => handleStartOtherPractice('flashcards')}
                              className="w-full group/card relative rounded-3xl p-4 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:border-purple-500/70 hover:shadow-[0_0_35px_rgba(168,85,247,0.35)] hover:-translate-y-1 text-left min-h-[110px]"
                            >
                              <div className="flex items-center justify-between w-full z-10">
                                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-lg group-hover/card:scale-110 transition-transform shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                                  🗂️
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20">
                                  {language === 'pl' ? 'Nauka' : 'Learn'}
                                </span>
                              </div>
                              <div className="z-10 mt-2">
                                <h4 className="text-sm font-serif font-bold text-white group-hover/card:text-purple-300 transition-colors flex items-center gap-1">
                                  {language === 'pl' ? 'Fiszki' : 'Flashcards'} <ChevronRight className="w-4 h-4 text-purple-400 group-hover/card:translate-x-1 transition-transform" />
                                </h4>
                              </div>
                            </button>
                          </div>
                          
                          {/* Card 4: Dopasowanie */}
                          <div className="relative group">
                            <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-amber-500/0 via-amber-500/50 to-amber-500/0 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 animate-pulse pointer-events-none" />
                            <button
                              type="button"
                              onClick={() => handleStartOtherPractice('match')}
                              className="w-full group/card relative rounded-3xl p-4 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:border-amber-500/70 hover:shadow-[0_0_35px_rgba(245,158,11,0.35)] hover:-translate-y-1 text-left min-h-[110px]"
                            >
                              <div className="flex items-center justify-between w-full z-10">
                                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-lg group-hover/card:scale-110 transition-transform shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                                  🧩
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20">
                                  {language === 'pl' ? 'Gra' : 'Game'}
                                </span>
                              </div>
                              <div className="z-10 mt-2">
                                <h4 className="text-sm font-serif font-bold text-white group-hover/card:text-amber-300 transition-colors flex items-center gap-1">
                                  {language === 'pl' ? 'Dopasowanie' : 'Match'} <ChevronRight className="w-4 h-4 text-amber-400 group-hover/card:translate-x-1 transition-transform" />
                                </h4>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Źródło Słownictwa - Wąski Pasek z wybranymi pod spodem */}
                      <div className="w-full space-y-2.5">
                        <button
                          type="button"
                          onClick={() => setIsLessonSelectorOpen(true)}
                          className="w-full group relative flex items-center justify-between px-4 py-3 rounded-2xl bg-[#0c1017]/90 backdrop-blur-md border border-white/10 hover:border-emerald-500/60 shadow-[0_8px_25px_rgba(0,0,0,0.4)] hover:shadow-[0_0_25px_rgba(16,185,129,0.25)] transition-all duration-300 cursor-pointer overflow-hidden text-left"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                          
                          <div className="flex items-center gap-2.5 z-10">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                              {selectedSetId === 'basket' ? <ShoppingBag className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                            </div>
                            <span className="text-sm font-serif font-bold text-white group-hover:text-emerald-300 transition-colors">
                              {language === 'pl' ? 'Źródło słownictwa' : 'Vocabulary Source'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 z-10 shrink-0">
                            {basketWords.length > 0 && (
                              <span 
                                onClick={(e) => { e.stopPropagation(); setIsBasketModalOpen(true); }}
                                className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 hover:scale-105 transition-transform"
                              >
                                <ShoppingBag className="w-3 h-3" />
                                <span>{basketWords.length}</span>
                              </span>
                            )}
                            <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black transition-all flex items-center gap-1">
                              <span>{language === 'pl' ? 'Wybierz' : 'Select'}</span>
                              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        </button>

                        {/* Wybrane pozycje pod spodem */}
                        <div className="flex flex-wrap items-center gap-1.5 px-1">
                          {selectedSetId === 'basket' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                              <ShoppingBag className="w-3 h-3 text-emerald-400" />
                              {language === 'pl' ? `Koszyk (${basketWords.length} słów)` : `Basket (${basketWords.length} words)`}
                            </span>
                          ) : selectedSetId === 'grammar' && selectedGrammarTopics && selectedGrammarTopics.length > 0 ? (
                            selectedGrammarTopics.map((topic, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                                <Sparkles className="w-3 h-3 text-emerald-400" />
                                {topic.name}
                              </span>
                            ))
                          ) : selectedLessonIds.length > 0 ? (
                            vocabularySets
                              .filter(s => selectedLessonIds.includes(s.id))
                              .map((set, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                                  <BookOpen className="w-3 h-3 text-emerald-400" />
                                  {set.topic.replace(/^\d+\.\s*/, '').replace(/\(Lekcja\s*\d+\)\s*/gi, '').trim()}
                                </span>
                              ))
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-gray-400">
                              <BookOpen className="w-3 h-3 text-gray-400" />
                              {language === 'pl' ? 'Wszystkie Słówka (Mix z Zasobów)' : 'All Vocabulary (Mix)'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Section 3: ILOŚĆ ZDAŃ */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                            {language === 'pl' ? 'Ilość zdań' : 'Sentences amount'}
                          </label>
                          <span className="text-3xl font-black text-white font-mono leading-none">
                            {numSentences}
                          </span>
                        </div>
                        <div className="bg-[#121824] border border-primary/20 rounded-2xl p-5 space-y-4 animate-pulsar-soft">
                          <input
                            type="range"
                            min="1"
                            max="25"
                            step="1"
                            value={numSentences}
                            onChange={(e) => {
                              setNumSentences(parseInt(e.target.value));
                              playSliderSound();
                            }}
                            className="w-full h-2 bg-[#202b3c] rounded-lg appearance-none cursor-pointer accent-emerald-400 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sticky CTA */}
                    <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#05080f] via-[#05080f] to-transparent z-50 pointer-events-none">
                      <button
                        onClick={() => handleGenerate(false)}
                        disabled={isLoading}
                        className="w-full pointer-events-auto py-4 rounded-[2rem] bg-gradient-to-r from-[#10b981] to-[#34d399] text-[#05080f] font-extrabold text-lg shadow-[0_0_30px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        {isLoading ? (
                          <Loader2 className="w-6 h-6 animate-spin text-[#05080f]" />
                        ) : (
                          <>{language === 'pl' ? 'Wygeneruj Trening' : 'Generate Training'} 🚀</>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="hidden md:block space-y-7 animate-fade-in-up">
                    {/* Title Header with Streak & Sentence Counters */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/10">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center flex-wrap gap-y-2">
                            {language === 'pl' ? 'Czas na trening' : 'Time for training'}
                          </h2>
                          {user?.hasNewVocabulary && !isBannerDismissed && (
                            <span 
                              onClick={() => {
                                setSelectedSetId('lessons');
                                if (vocabularySets.length > 0 && selectedLessonIds.length === 0) {
                                  setSelectedLessonIds([vocabularySets[0].id]);
                                }
                                setIsBannerDismissed(true);
                                if (user?.id) {
                                  updateDoc(doc(db, 'users', user.id), { hasNewVocabulary: false }).catch(console.error);
                                }
                              }}
                              className="text-xs md:text-sm px-3 py-1 bg-primary/20 text-primary border border-primary/40 rounded-full animate-pulse cursor-pointer hover:bg-primary/30 transition-colors whitespace-nowrap font-semibold"
                            >
                              {language === 'pl' ? 'Nowe słówka' : 'New vocab'}
                            </span>
                          )}
                          {user?.hasNewLesson && (
                            <span className="text-xs md:text-sm px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-full animate-pulse cursor-default whitespace-nowrap font-semibold">
                              {language === 'pl' ? 'Nowa lekcja' : 'New lesson'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-emerald-400 font-semibold flex items-center gap-1.5 pt-0.5">
                          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                          {language === 'pl' 
                            ? `Przetłumaczyłeś już ${translatedSentencesCount} zdań. Świetna robota!` 
                            : `You have already translated ${translatedSentencesCount} sentences. Great job!`}
                        </p>
                      </div>

                      {/* Streak Counter Badge */}
                      <div className="flex items-center gap-3 bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-red-500/15 border border-amber-500/30 px-4 py-2.5 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.15)] shrink-0">
                        <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 font-black shadow-[0_0_12px_rgba(245,158,11,0.6)]">
                          <Flame className="w-5 h-5 text-slate-950 fill-amber-200 animate-bounce" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-amber-300/80 font-bold uppercase tracking-wider">
                            {language === 'pl' ? 'Streak treningu' : 'Training Streak'}
                          </span>
                          <span className="text-sm font-black text-white flex items-center gap-1">
                            {user?.streakCount ? (
                              <>
                                <span className="text-amber-400 text-base">{user.streakCount}</span> 
                                {language === 'pl' ? (user.streakCount === 1 ? 'dzień z rzędu' : 'dni z rzędu') : (user.streakCount === 1 ? 'day streak' : 'days streak')} 🔥
                              </>
                            ) : (
                              <span className="text-amber-200/90 text-xs">
                                {language === 'pl' ? '0 dni — ćwicz dzisiaj!' : '0 days — start today!'}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: TRYB ĆWICZENIA (Two large tiles, two smaller below) */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                          {language === 'pl' ? 'Tryb ćwiczenia' : 'Exercise mode'}
                        </label>
                        <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-semibold">
                          4 Formaty
                        </span>
                      </div>

                      {/* Top Row: Two Large Primary Cards (Puzzle & Typing) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Card 1: Układanka */}
                        <div className="relative group">
                          <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 animate-pulse pointer-events-none" />
                          <button
                            type="button"
                            onClick={() => setExerciseFormat('puzzle')}
                            className={`w-full group/card relative text-left rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer min-h-[180px] ${
                              exerciseFormat === 'puzzle'
                                ? 'bg-[#0a0e17]/90 backdrop-blur-md border-2 border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.45)] scale-[1.02]'
                                : 'backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:border-emerald-500/70 hover:shadow-[0_0_35px_rgba(16,185,129,0.35)] hover:-translate-y-1'
                            }`}
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />

                            <div className="flex items-center justify-between w-full z-10">
                              <div className={`w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover/card:scale-110 transition-transform ${exerciseFormat === 'puzzle' ? 'text-emerald-400 bg-emerald-500/20 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : ''}`}>
                                <LayoutGrid className="w-6 h-6 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                              </div>
                              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                {language === 'pl' ? 'Rekomendowane' : 'Recommended'}
                              </span>
                            </div>

                            <div className="z-10 mt-4">
                              <h3 className="text-2xl font-serif font-bold text-white group-hover/card:text-emerald-400 transition-colors flex items-center gap-1.5">
                                {language === 'pl' ? 'Układanka' : 'Puzzle'} <ChevronRight className="w-5 h-5 text-emerald-400 group-hover/card:translate-x-1 transition-transform" />
                              </h3>
                              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                                {language === 'pl' ? 'Układaj zdania z interaktywnych klocków i ucz się szybkiego szyku.' : 'Assemble sentences from interactive tiles.'}
                              </p>
                            </div>
                          </button>
                        </div>

                        {/* Card 2: Prawdziwe wyzwanie */}
                        <div className="relative group">
                          <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-cyan-500/0 via-cyan-500/40 to-cyan-500/0 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 animate-pulse pointer-events-none" />
                          <button
                            type="button"
                            onClick={() => setExerciseFormat('typing')}
                            className={`w-full group/card relative text-left rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer min-h-[180px] ${
                              exerciseFormat === 'typing'
                                ? 'bg-[#0a0e17]/90 backdrop-blur-md border-2 border-cyan-400 shadow-[0_0_35px_rgba(6,182,212,0.45)] scale-[1.02]'
                                : 'backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:border-cyan-500/70 hover:shadow-[0_0_35px_rgba(6,182,212,0.35)] hover:-translate-y-1'
                            }`}
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />

                            <div className="flex items-center justify-between w-full z-10">
                              <div className={`w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover/card:scale-110 transition-transform ${exerciseFormat === 'typing' ? 'text-cyan-400 bg-cyan-500/20 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : ''}`}>
                                <Keyboard className="w-6 h-6 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                              </div>
                              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">
                                {language === 'pl' ? 'Wpisywanie' : 'Typing'}
                              </span>
                            </div>

                            <div className="z-10 mt-4">
                              <h3 className="text-2xl font-serif font-bold text-white group-hover/card:text-cyan-400 transition-colors flex items-center gap-1.5">
                                {language === 'pl' ? 'Prawdziwe Wyzwanie' : 'Real Challenge'} <ChevronRight className="w-5 h-5 text-cyan-400 group-hover/card:translate-x-1 transition-transform" />
                              </h3>
                              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                                {language === 'pl' ? 'Pisanie pełnych zdań z pamięci i inteligentna korekta AI.' : 'Type full sentences with instant AI feedback.'}
                              </p>
                            </div>
                          </button>
                        </div>
                      </div>
                      
                      {/* Bottom Row: Two Compact Cards (Flashcards & Match) */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Card 3: Fiszki */}
                        <div className="relative group">
                          <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-purple-500/0 via-purple-500/50 to-purple-500/0 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 animate-pulse pointer-events-none" />
                          <button
                            type="button"
                            onClick={() => handleStartOtherPractice('flashcards')}
                            className="w-full group/card relative rounded-3xl p-4 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:border-purple-500/70 hover:shadow-[0_0_35px_rgba(168,85,247,0.35)] hover:-translate-y-1 text-left min-h-[115px]"
                          >
                            <div className="flex items-center justify-between w-full z-10">
                              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-xl group-hover/card:scale-110 transition-transform shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                                🗂️
                              </div>
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20">
                                {language === 'pl' ? 'Nauka' : 'Learn'}
                              </span>
                            </div>
                            <div className="z-10 mt-2">
                              <h4 className="text-base font-serif font-bold text-white group-hover/card:text-purple-300 transition-colors flex items-center gap-1">
                                {language === 'pl' ? 'Fiszki' : 'Flashcards'} <ChevronRight className="w-4 h-4 text-purple-400 group-hover/card:translate-x-1 transition-transform" />
                              </h4>
                            </div>
                          </button>
                        </div>
                        
                        {/* Card 4: Dopasowanie */}
                        <div className="relative group">
                          <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-amber-500/0 via-amber-500/50 to-amber-500/0 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 animate-pulse pointer-events-none" />
                          <button
                            type="button"
                            onClick={() => handleStartOtherPractice('match')}
                            className="w-full group/card relative rounded-3xl p-4 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:border-amber-500/70 hover:shadow-[0_0_35px_rgba(245,158,11,0.35)] hover:-translate-y-1 text-left min-h-[115px]"
                          >
                            <div className="flex items-center justify-between w-full z-10">
                              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xl group-hover/card:scale-110 transition-transform shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                                🧩
                              </div>
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20">
                                {language === 'pl' ? 'Gra' : 'Game'}
                              </span>
                            </div>
                            <div className="z-10 mt-2">
                              <h4 className="text-base font-serif font-bold text-white group-hover/card:text-amber-300 transition-colors flex items-center gap-1">
                                {language === 'pl' ? 'Dopasowanie' : 'Match'} <ChevronRight className="w-4 h-4 text-amber-400 group-hover/card:translate-x-1 transition-transform" />
                              </h4>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Źródło Słownictwa - Wąski Pasek z wybranymi pozycjami pod spodem */}
                    <div className="w-full space-y-3">
                      <button
                        type="button"
                        onClick={() => setIsLessonSelectorOpen(true)}
                        className="w-full group relative flex items-center justify-between px-5 py-3.5 rounded-2xl bg-[#0c1017]/90 backdrop-blur-md border border-white/10 hover:border-emerald-500/60 shadow-[0_8px_25px_rgba(0,0,0,0.4)] hover:shadow-[0_0_25px_rgba(16,185,129,0.25)] transition-all duration-300 cursor-pointer overflow-hidden text-left"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        
                        <div className="flex items-center gap-3 z-10">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                            {selectedSetId === 'basket' ? <ShoppingBag className="w-4.5 h-4.5" /> : <BookOpen className="w-4.5 h-4.5" />}
                          </div>
                          <span className="text-base font-serif font-bold text-white group-hover:text-emerald-300 transition-colors">
                            {language === 'pl' ? 'Źródło słownictwa' : 'Vocabulary Source'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 z-10 shrink-0">
                          {basketWords.length > 0 && (
                            <span 
                              onClick={(e) => { e.stopPropagation(); setIsBasketModalOpen(true); }}
                              className="text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 hover:scale-105 transition-transform shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                              <span>{language === 'pl' ? `Koszyk (${basketWords.length})` : `Basket (${basketWords.length})`}</span>
                            </span>
                          )}
                          <div className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black transition-all flex items-center gap-1">
                            <span>{language === 'pl' ? 'Wybierz' : 'Select'}</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </button>

                      {/* Lista wybranych pozycji pod spodem */}
                      <div className="flex flex-wrap items-center gap-2 px-1">
                        {selectedSetId === 'basket' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                            <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                            {language === 'pl' ? `Koszyk Słówek (${basketWords.length} słów)` : `Word Basket (${basketWords.length} words)`}
                          </span>
                        ) : selectedSetId === 'grammar' && selectedGrammarTopics && selectedGrammarTopics.length > 0 ? (
                          selectedGrammarTopics.map((topic, i) => (
                            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                              {topic.name}
                            </span>
                          ))
                        ) : selectedLessonIds.length > 0 ? (
                          vocabularySets
                            .filter(s => selectedLessonIds.includes(s.id))
                            .map((set, i) => (
                              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                                {set.topic.replace(/^\d+\.\s*/, '').replace(/\(Lekcja\s*\d+\)\s*/gi, '').trim()}
                              </span>
                            ))
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-gray-400">
                            <BookOpen className="w-3.5 h-3.5 text-gray-400" />
                            {language === 'pl' ? 'Wszystkie Słówka (Mix z Zasobów)' : 'All Vocabulary (Mix)'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* SECTION 3: ILOŚĆ ZDAŃ */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                          {language === 'pl' ? 'Ilość zdań' : 'Number of sentences'}
                        </label>
                        <span className="text-3xl font-black text-white font-mono leading-none">
                          {numSentences}
                        </span>
                      </div>

                      <div className="bg-[#121824] border border-primary/20 rounded-2xl p-5 space-y-4 animate-pulsar-soft">
                        <input
                          type="range"
                          min="1"
                          max="25"
                          step="1"
                          value={numSentences}
                          onChange={(e) => {
                            setNumSentences(parseInt(e.target.value));
                            playSliderSound();
                          }}
                          className="w-full h-2 bg-[#202b3c] rounded-lg appearance-none cursor-pointer accent-emerald-400 focus:outline-none"
                        />

                        <div className="grid grid-cols-4 gap-2.5 pt-1">
                          {[5, 10, 15, 20].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => {
                                setNumSentences(val);
                                playSliderSound();
                              }}
                              className={`py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                                numSentences === val
                                  ? 'bg-[#283548] border border-white/20 text-white shadow-inner'
                                  : 'bg-[#18212e] border border-white/5 text-gray-400 hover:text-white hover:bg-[#1f2b3c]'
                              }`}
                            >
                              {val}
                            </button>
                          ))}

                        </div>
                      </div>
                    </div>

                    {/* SECTION 4: GENERATE BUTTON */}
                    <div className="pt-2">
                      <AILoadingButton
                        onClick={() => handleGenerate(false)}
                        isLoading={isLoading}
                        loadingText={language === 'pl' ? 'AI przygotowuje ćwiczenie...' : 'AI is preparing the exercise...'}
                        className="w-full py-4 px-6 rounded-2xl border border-emerald-500/50 bg-gradient-to-r from-emerald-950/80 via-[#132c25] to-emerald-950/80 hover:from-emerald-900/90 hover:to-emerald-900/90 text-white font-bold text-base flex items-center justify-center gap-3 transition-all duration-300 shadow-[0_0_25px_rgba(16,185,129,0.2)] hover:shadow-[0_0_35px_rgba(16,185,129,0.35)] hover:scale-[1.008] active:scale-[0.995] group"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse shrink-0" />
                        <span>
                          {language === 'pl'
                            ? `Wygeneruj ${numSentences === 1 ? '1 zdanie' : numSentences >= 2 && numSentences <= 4 ? `${numSentences} zdania` : `${numSentences} zdań`}`
                            : `Generate ${numSentences} ${numSentences === 1 ? 'sentence' : 'sentences'}`}
                        </span>
                        <ArrowRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                      </AILoadingButton>
                    </div>
                  </div>
                  {/* Modal Lesson Selection for Mobile */}
                        <AnimatePresence>
                          {isLessonSelectorOpen && (
                            <motion.div key="lesson-selector"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end justify-center p-0 sm:p-6"
                            >
                              <motion.div
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className="bg-[#0f1522] border border-white/10 w-full max-w-md rounded-t-[2rem] sm:rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                              >
                                <div className="flex justify-between items-center mb-6">
                                  <h3 className="text-lg font-bold text-white">
                                    {language === 'pl' ? 'Źródło słownictwa' : 'Vocabulary source'}
                                  </h3>
                                  <button 
                                    onClick={() => setIsLessonSelectorOpen(false)}
                                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>
                                
                                <div className="overflow-y-auto custom-scrollbar flex-1 -mr-2 pr-2 space-y-2 pb-6">
                                  <h4 className="text-sm font-bold text-gray-400 px-2 mb-2 uppercase tracking-wider">{language === 'pl' ? 'Wybierz źródło' : 'Select source'}</h4>
                                  
                                  {/* Koszyk Option if populated */}
                                  {basketWords.length > 0 && (
                                    <label className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                                      selectedSetId === 'basket' ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-[#18212e] border-white/5 hover:border-white/10'
                                    }`}>
                                      <input 
                                        type="radio" 
                                        name="mobileSourceModal"
                                        checked={selectedSetId === 'basket'}
                                        onChange={() => {
                                          setSelectedSetId('basket');
                                          setSelectedLessonIds([]);
                                        }}
                                        className="w-5 h-5 text-emerald-400 focus:ring-emerald-400 rounded-full border-white/20 bg-black/40 cursor-pointer accent-emerald-400"
                                      />
                                      <div className="flex-1 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <ShoppingBag className="w-5 h-5 text-emerald-400" />
                                          <span className={`text-base font-semibold ${selectedSetId === 'basket' ? 'text-emerald-400' : 'text-gray-200'}`}>
                                            {language === 'pl' ? `Koszyk Słówek (${basketWords.length})` : `Vocabulary Basket (${basketWords.length})`}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsBasketModalOpen(true);
                                          }}
                                          className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-medium transition-colors"
                                        >
                                          {language === 'pl' ? 'Otwórz koszyk' : 'Open basket'}
                                        </button>
                                      </div>
                                    </label>
                                  )}

                                  <h4 className="text-sm font-bold text-gray-400 px-2 mt-4 mb-2 uppercase tracking-wider">{language === 'pl' ? 'Moje lekcje' : 'My lessons'}</h4>
                                  {specialTasks.length > 0 && specialTasks.map(task => (
                                    <label key={task.id} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                                      selectedSetId === 'special-task-' + task.id ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-[#18212e] border-white/5'
                                    }`}>
                                      <input 
                                        type="radio" 
                                        name="mobileSourceModal"
                                        checked={selectedSetId === 'special-task-' + task.id}
                                        onChange={() => {
                                          if (selectedSetId !== 'special-task-' + task.id) {
                                            setSelectedSetId('special-task-' + task.id);
                                            setSelectedLessonIds([]);
                                          } else {
                                            setSelectedSetId('all');
                                          }
                                        }}
                                        className="w-5 h-5 text-emerald-400 focus:ring-emerald-400 rounded-full border-white/20 bg-black/40 cursor-pointer accent-emerald-400"
                                      />
                                      <span className={`text-base font-semibold ${selectedSetId === 'special-task-' + task.id ? 'text-emerald-400' : 'text-gray-300'}`}>
                                        {task.title}
                                      </span>
                                    </label>
                                  ))}


                                  {vocabularySets.length > 0 ? vocabularySets.map((set, index) => {
                                    const isSelected = selectedLessonIds.includes(set.id);
                                    const lessonNumber = vocabularySets.length - index;
                                    const isNewAndPulsing = index === 0 && user?.hasNewVocabulary && !isBannerDismissed;
                                    return (
                                      <label 
                                        key={set.id} 
                                        className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                                          isNewAndPulsing ? 'border-primary shadow-[0_0_20px_rgba(114,240,180,0.5)] animate-pulse bg-primary/20' :
                                          isSelected ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-[#18212e] border-white/5'
                                        }`}
                                      >
                                        <input 
                                          type="checkbox" 
                                          checked={isSelected}
                                          onChange={() => {
                                            setSelectedSetId('lessons');
                                            if (isSelected) {
                                              setSelectedLessonIds(prev => prev.filter(id => id !== set.id));
                                            } else {
                                              setSelectedLessonIds(prev => [...prev, set.id]);
                                            }
                                          }}
                                          className="w-5 h-5 text-emerald-400 focus:ring-emerald-400 rounded border-white/20 bg-black/40 cursor-pointer accent-emerald-400"
                                        />
                                        <div className="flex-1 flex flex-col min-w-0">
                                          <span className="text-sm font-semibold leading-none flex items-center flex-wrap gap-y-2">
                                            <span className="text-[10px] font-mono bg-white/10 px-2 py-1 rounded text-emerald-300 mr-2 border border-white/5">L{lessonNumber}</span>
                                            <span className={`${isSelected ? 'text-white' : 'text-gray-300'} break-words whitespace-normal leading-tight`}>
                                              {set.topic.replace(/^\d+\.\s*/, '').replace(/\(Lekcja\s*\d+\)\s*/gi, '').trim()}
                                            </span>
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setPreviewVocabSet(set);
                                          }}
                                          className="p-2 -mr-2 rounded-lg bg-white/5 hover:bg-white/10 text-emerald-400 hover:text-emerald-300 transition-colors flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold"
                                        >
                                          <Eye className="w-4 h-4" />
                                          <span className="hidden sm:inline">{language === 'pl' ? 'Podgląd' : 'Preview'}</span>
                                        </button>
                                      </label>
                                    );
                                  }) : (
                                    <div className="text-center text-sm text-gray-400 py-8">Brak lekcji</div>
                                  )}
                                  
<div className="h-px w-full bg-white/10 my-4"></div>
<h4 className="text-sm font-bold text-gray-400 px-2 mb-2 uppercase tracking-wider">{language === 'pl' ? 'Mix' : 'Mix'}</h4>
{/* Option to select "All" */}
                                  <label className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                                    selectedSetId === 'all' && selectedLessonIds.length === 0 ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-[#18212e] border-white/5'
                                  }`}>
                                    <input 
                                      type="radio" 
                                      name="mobileSourceModal"
                                      checked={selectedSetId === 'all' && selectedLessonIds.length === 0}
                                      onChange={() => {
                                        setSelectedSetId('all');
                                        setSelectedLessonIds([]);
                                      }}
                                      className="w-5 h-5 text-emerald-400 focus:ring-emerald-400 rounded-full border-white/20 bg-black/40 cursor-pointer accent-emerald-400"
                                    />
                                    <span className={`text-base font-semibold ${selectedSetId === 'all' && selectedLessonIds.length === 0 ? 'text-emerald-400' : 'text-gray-300'}`}>
                                      {language === 'pl' ? 'Wszystkie słówka (Mix)' : 'All vocabulary'}
                                    </span>
                                  </label>
                                  {/* Grammar Options */}
                                  <div className="h-px w-full bg-white/10 my-4"></div>
                                  <h4 className="text-sm font-bold text-gray-400 px-2 mb-2 uppercase tracking-wider">{language === 'pl' ? 'Gramatyka' : 'Grammar'}</h4>
                                  {grammarChapters.length > 0 && grammarChapters.map((chapter: any, cIdx: number) => (
                                    <div key={chapter.id || cIdx} className="mb-2">
                                      <div 
                                        className="flex items-center justify-between p-4 rounded-2xl bg-[#18212e] border border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                                        onClick={() => setExpandedGrammarLevel(expandedGrammarLevel === cIdx ? null : cIdx)}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                                            {cIdx + 1}
                                          </div>
                                          <span className="text-base font-semibold text-gray-300">{chapter.name}</span>
                                        </div>
                                        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${expandedGrammarLevel === cIdx ? 'rotate-180' : ''}`} />
                                      </div>
                                      <AnimatePresence>
                                        {expandedGrammarLevel === cIdx && (
                                          <motion.div key="grammar-level"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                          >
                                            <div className="pt-2 pl-4 space-y-2">
                                              {chapter.topics.map((topic: any, tIdx: number) => {
                                                const hasSentences = (topic.sentences || "").trim().length > 0;
                                                const isSelected = selectedSetId === 'grammar' && selectedGrammarTopics.some(t => t.id === topic.id);
                                                return (
                                                  <label 
                                                    key={topic.id || tIdx} 
                                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${hasSentences ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'} ${
                                                      isSelected ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-black/20 border-white/5 hover:border-white/10'
                                                    }`}
                                                  >
                                                    <input 
                                                      type="checkbox" 
                                                      name={`mobileSourceModal-${topic.id}`}
                                                      disabled={!hasSentences}
                                                      checked={isSelected}
                                                      onChange={() => {
                                                        if (hasSentences) {
                                                          setSelectedSetId('grammar');
                                                          setSelectedLessonIds([]);
                                                          setSelectedGrammarTopics(prev => {
                                                            if (prev.find(t => t.id === topic.id)) {
                                                              return prev.filter(t => t.id !== topic.id);
                                                            } else {
                                                              return [...prev, { ...topic, chapterIndex: cIdx }];
                                                            }
                                                          });
                                                        }
                                                      }}
                                                      className="w-4 h-4 text-emerald-400 focus:ring-emerald-400 rounded-sm border-white/20 bg-black/40 cursor-pointer accent-emerald-400"
                                                    />
                                                    <div className="flex flex-col">
                                                      <span className={`text-sm font-semibold ${isSelected ? 'text-emerald-400' : 'text-gray-300'}`}>
                                                        {tIdx + 1}. {topic.name}
                                                      </span>
                                                    </div>
                                                  </label>
                                                );
                                              })}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-4 pt-4 border-t border-white/10">
                                  <button 
                                    onClick={() => setIsLessonSelectorOpen(false)}
                                    className="w-full py-4 rounded-2xl bg-[#10b981] text-black font-bold text-base shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                                  >
                                    {language === 'pl' ? 'Zatwierdź' : 'Confirm'}
                                  </button>
                                </div>
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <AnimatePresence>
                          {previewVocabSet && (
                            <motion.div key="preview-modal"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
                            >
                              <motion.div
                                initial={{ y: 20, opacity: 0, scale: 0.95 }}
                                animate={{ y: 0, opacity: 1, scale: 1 }}
                                exit={{ y: 20, opacity: 0, scale: 0.95 }}
                                className="bg-[#0f1522] border border-white/10 w-full max-w-lg rounded-[2rem] p-6 shadow-2xl flex flex-col max-h-[85vh]"
                              >
                                <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4">
                                  <div>
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                      <BookOpen className="w-5 h-5 text-emerald-400" />
                                      {previewVocabSet.topic.replace(/^\d+\.\s*/, '').replace(/\(Lekcja\s*\d+\)\s*/gi, '').trim()}
                                    </h3>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      {language === 'pl' ? 'Kliknij +, aby dodać konkretne słówko do koszyka' : 'Click + to add specific words to basket'}
                                    </p>
                                  </div>
                                  <button 
                                    onClick={() => setPreviewVocabSet(null)}
                                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>

                                {previewVocabSet.vocabularyText && (
                                  <div className="mb-4 flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                                    <span className="text-xs font-medium text-emerald-300">
                                      {language === 'pl' ? 'Chcesz całą lekcję?' : 'Want full lesson?'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        addAllWordsFromTextToBasket(
                                          previewVocabSet.vocabularyText, 
                                          previewVocabSet.topic.replace(/^\d+\.\s*/, '').replace(/\(Lekcja\s*\d+\)\s*/gi, '').trim()
                                        );
                                      }}
                                      className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-colors flex items-center gap-1 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>{language === 'pl' ? 'Dodaj wszystkie do koszyka' : 'Add all to basket'}</span>
                                    </button>
                                  </div>
                                )}

                                <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 space-y-2">
                                  {previewVocabSet.vocabularyText ? (
                                    previewVocabSet.vocabularyText
                                      .split(/[\n;]+/)
                                      .map(i => i.trim())
                                      .filter(i => i.length > 0)
                                      .map((line, lIdx) => {
                                        const wordItem = parseLineToWordItem(
                                          line, 
                                          previewVocabSet.topic.replace(/^\d+\.\s*/, '').replace(/\(Lekcja\s*\d+\)\s*/gi, '').trim()
                                        );
                                        const inBasket = isWordInBasket(wordItem.term);
                                        return (
                                          <div key={lIdx} className={`flex items-center justify-between gap-3 border rounded-xl p-3 text-sm transition-all ${
                                            inBasket 
                                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200' 
                                              : 'bg-white/5 border-white/10 text-gray-200 hover:border-white/20'
                                          }`}>
                                            <div className="flex-1 min-w-0">
                                              <span className="font-semibold text-white block truncate">{wordItem.term}</span>
                                              {wordItem.definition && (
                                                <span className="text-xs text-gray-400 block truncate">{wordItem.definition}</span>
                                              )}
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => toggleBasketWord(wordItem)}
                                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-all shrink-0 ${
                                                inBasket
                                                  ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                                                  : 'bg-white/10 hover:bg-emerald-500/20 hover:text-emerald-400 text-gray-300 border border-white/10'
                                              }`}
                                              title={inBasket ? 'Usuń z koszyka' : 'Dodaj do koszyka'}
                                            >
                                              {inBasket ? <Check className="w-4 h-4 stroke-[3]" /> : <Plus className="w-4 h-4" />}
                                            </button>
                                          </div>
                                        );
                                      })
                                  ) : (
                                    <div className="text-center text-gray-400 py-8">
                                      Brak słownictwa do wyświetlenia.
                                    </div>
                                  )}
                                </div>

                                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
                                  {basketWords.length > 0 && (
                                    <button
                                      onClick={() => {
                                        setPreviewVocabSet(null);
                                        setIsBasketModalOpen(true);
                                      }}
                                      className="py-3 px-4 rounded-xl bg-white/10 text-white font-semibold text-xs hover:bg-white/20 transition-colors flex items-center gap-2"
                                    >
                                      <ShoppingBag className="w-4 h-4 text-emerald-400" />
                                      <span>{language === 'pl' ? `Zobacz koszyk (${basketWords.length})` : `View basket (${basketWords.length})`}</span>
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => setPreviewVocabSet(null)}
                                    className="flex-1 py-3.5 rounded-xl bg-[#10b981] text-black font-bold text-sm shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                                  >
                                    {language === 'pl' ? 'Gotowe' : 'Done'}
                                  </button>
                                </div>
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Modal: Vocabulary Basket (Koszyk Słówek) */}
                        <AnimatePresence>
                          {isBasketModalOpen && (
                            <motion.div key="basket-modal"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
                            >
                              <motion.div
                                initial={{ y: 20, opacity: 0, scale: 0.95 }}
                                animate={{ y: 0, opacity: 1, scale: 1 }}
                                exit={{ y: 20, opacity: 0, scale: 0.95 }}
                                className="bg-[#0f1522] border border-white/10 w-full max-w-lg rounded-[2rem] p-6 shadow-2xl flex flex-col max-h-[85vh]"
                              >
                                <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                                      <ShoppingBag className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        {language === 'pl' ? 'Koszyk Słówek' : 'Vocabulary Basket'}
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                          {basketWords.length}
                                        </span>
                                      </h3>
                                      <p className="text-xs text-gray-400">
                                        {language === 'pl' ? 'Twój własny zestaw słów wymiksowany z lekcji' : 'Your custom mix of vocabulary from lessons'}
                                      </p>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => setIsBasketModalOpen(false)}
                                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>

                                {basketWords.length > 0 && (
                                  <div className="flex justify-end mb-2">
                                    <button
                                      type="button"
                                      onClick={clearBasket}
                                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium px-2 py-1 rounded hover:bg-rose-500/10 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>{language === 'pl' ? 'Wyczyść koszyk' : 'Clear basket'}</span>
                                    </button>
                                  </div>
                                )}

                                <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 space-y-2">
                                  {basketWords.length > 0 ? (
                                    basketWords.map((item, idx) => (
                                      <div key={item.id + idx} className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-3 text-sm text-gray-200 transition-all">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="font-semibold text-white truncate">{item.term}</span>
                                            {item.sourceTopic && (
                                              <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded text-gray-400 truncate max-w-[120px]">
                                                {item.sourceTopic}
                                              </span>
                                            )}
                                          </div>
                                          {item.definition && (
                                            <span className="text-xs text-gray-400 block truncate mt-0.5">{item.definition}</span>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => toggleBasketWord(item)}
                                          className="p-2 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
                                          title="Usuń z koszyka"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-center text-gray-400 py-12 space-y-3">
                                      <ShoppingBag className="w-12 h-12 text-gray-600 mx-auto stroke-[1.5]" />
                                      <p className="text-sm font-medium">
                                        {language === 'pl' ? 'Twój koszyk jest pusty.' : 'Your basket is empty.'}
                                      </p>
                                      <p className="text-xs text-gray-500 max-w-xs mx-auto">
                                        {language === 'pl' ? 'Wejdź w dowolną lekcję i kliknij przycisk +, aby dodać słówka do koszyka.' : 'Open any lesson and click + to add words into your basket.'}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {basketWords.length > 0 && (
                                  <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                      {language === 'pl' ? 'Wybierz typ ćwiczenia dla koszyka' : 'Choose exercise type for basket'}
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedSetId('basket');
                                          setIsBasketModalOpen(false);
                                          handleGenerate(false);
                                        }}
                                        className="py-3 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                                      >
                                        <Sparkles className="w-4 h-4 fill-black" />
                                        <span>{language === 'pl' ? 'Trening AI' : 'AI Sentences'}</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsBasketModalOpen(false);
                                          handleStartBasketPractice('flashcards');
                                        }}
                                        className="py-3 px-3 rounded-xl bg-white/10 border border-white/10 hover:border-emerald-500/40 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-white/15 transition-all"
                                      >
                                        <span>🗂️ {language === 'pl' ? 'Fiszki' : 'Flashcards'}</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsBasketModalOpen(false);
                                          handleStartBasketPractice('quiz');
                                        }}
                                        className="py-3 px-3 rounded-xl bg-white/10 border border-white/10 hover:border-emerald-500/40 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-white/15 transition-all"
                                      >
                                        <span>📝 {language === 'pl' ? 'Quiz' : 'Quiz'}</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsBasketModalOpen(false);
                                          handleStartBasketPractice('match');
                                        }}
                                        className="py-3 px-3 rounded-xl bg-white/10 border border-white/10 hover:border-emerald-500/40 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-white/15 transition-all"
                                      >
                                        <span>🧩 {language === 'pl' ? 'Dopasowanie' : 'Match'}</span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                  </>
                ) : (
                  /* Other Exercises Tab in the same unified long box layout */
                  <div className="space-y-4 animate-fade-in-up">
                    <div 
                      className="cursor-pointer liquid-glass-tile p-4.5 group flex items-start gap-4"
                      onClick={() => handleStartOtherPractice('intro')}
                    >
                      <div className="text-3xl shrink-0 transform group-hover:scale-110 transition-transform">👀</div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                          {language === 'pl' ? 'Fiszki Intro' : 'Flashcards Intro'}
                        </h4>
                        <p className="text-content-muted text-xs mt-1 leading-relaxed">
                          {language === 'pl' ? 'Zapoznaj się powoli z nowym materiałem, bez sprawdzania i wyników.' : 'Familiarize yourself gently with new material, without testing or scoring.'}
                        </p>
                      </div>
                    </div>
                    
                    <div 
                      className="cursor-pointer liquid-glass-tile p-4.5 group flex items-start gap-4"
                      onClick={() => handleStartOtherPractice('flashcards')}
                    >
                      <div className="text-3xl shrink-0 transform group-hover:scale-110 transition-transform">🗂️</div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                          {language === 'pl' ? 'Fiszki' : 'Flashcards'}
                        </h4>
                        <p className="text-content-muted text-xs mt-1 leading-relaxed">
                          {language === 'pl' ? 'Przeglądaj pojęcia i definicje. Odwracaj karty, aby sprawdzić swoją wiedzę.' : 'Review terms and definitions. Flip cards to test your knowledge.'}
                        </p>
                      </div>
                    </div>

                    <div 
                      className="cursor-pointer liquid-glass-tile p-4.5 group flex items-start gap-4"
                      onClick={() => handleStartOtherPractice('quiz')}
                    >
                      <div className="text-3xl shrink-0 transform group-hover:scale-110 transition-transform">📝</div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                          {language === 'pl' ? 'Quiz' : 'Quiz'}
                        </h4>
                        <p className="text-content-muted text-xs mt-1 leading-relaxed">
                          {language === 'pl' ? 'Szybki test wielokrotnego wyboru. Sprawdź, ile pamiętasz.' : 'Quick multiple choice test. See how much you remember.'}
                        </p>
                      </div>
                    </div>

                    <div 
                      className="cursor-pointer liquid-glass-tile p-4.5 group flex items-start gap-4"
                      onClick={() => handleStartOtherPractice('match')}
                    >
                      <div className="text-3xl shrink-0 transform group-hover:scale-110 transition-transform">🧩</div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                          {language === 'pl' ? 'Dopasowania' : 'Match'}
                        </h4>
                        <p className="text-content-muted text-xs mt-1 leading-relaxed">
                          {language === 'pl' ? 'Połącz słowo z jego definicją lub tłumaczeniem.' : 'Connect a word with its definition or translation.'}
                        </p>
                      </div>
                    </div>

                    <div 
                      className="cursor-pointer liquid-glass-tile p-4.5 group flex items-start gap-4"
                      onClick={() => handleStartOtherPractice('fill-in-the-blank')}
                    >
                      <div className="text-3xl shrink-0 transform group-hover:scale-110 transition-transform">✍️</div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                          {language === 'pl' ? 'Pisanie (Wypełnianie luk)' : 'Writing (Fill in the blank)'}
                        </h4>
                        <p className="text-content-muted text-xs mt-1 leading-relaxed">
                          {language === 'pl' ? 'Wpisz brakujące słowo w zdaniu z kontekstem. Świetne do nauki pisowni.' : 'Type the missing word in a contextual sentence. Great for spelling.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )
      )}
      {step === 'practice' && exercises.length > 0 && (
        <div className="max-w-2xl mx-auto space-y-4 pb-28 md:pb-8">
          {/* Progress header */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-content-muted">
              {language === 'pl' ? 'Postęp:' : 'Progress:'} {activeSentenceIndex + 1} {practiceMode === 'fixed' ? `/ ${exercises.length}` : ''}
            </span>
            {practiceMode === 'time' && timeLeft !== null && (
              <div className={`font-mono text-base font-bold flex items-center gap-1.5 ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-primary'}`}>
                <Clock className="w-4 h-4" />
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
            )}
            {practiceMode === 'fixed' && (
              <div className="flex gap-1 h-1.5 bg-black/30 rounded-full w-40 overflow-hidden">
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
                <motion.div key="motivating-bubble" 
                  initial={{ opacity: 0, x: 15, y: -15, scale: 0.85 }}
                  animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  className="absolute -right-2 -top-10 md:-right-8 md:-top-12 z-20"
                >
                  <div className="bg-primary text-black px-3.5 py-1.5 rounded-2xl rounded-bl-none shadow-md font-bold text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    {language === 'pl' ? 'Świetnie Ci idzie! Oby tak dalej!' : 'Great job! Keep it up!'}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <Card ref={practiceCardRef} className="liquid-glass-card p-4 md:p-6 space-y-3 relative overflow-hidden flex flex-col">
              {/* Background design accents */}
              <div className="absolute top-0 right-0 p-6 opacity-[0.02] pointer-events-none select-none">
                <Sparkles className="w-48 h-48 text-primary" />
              </div>

            <div className="space-y-3 relative z-10 flex flex-col items-center text-center">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-mono font-bold mx-auto">
                {i18n.t("Zdanie")} {activeSentenceIndex + 1}
              </div>

              {/* Polish Sentence */}
              {exerciseFormat !== 'puzzle' && (
                <div className="w-full bg-[#18212e] border border-white/10 rounded-2xl p-5 shadow-[inset_0_2px_15px_rgba(0,0,0,0.5)] mb-2">
                  <div className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-relaxed text-center">
                    {exercises[activeSentenceIndex].polishSentence}
                  </div>
                </div>
              )}

              {/* Optional hint toggle */}
              {exercises[activeSentenceIndex].hint && exerciseFormat !== 'puzzle' && (
                <div className="w-full">
                  <button
                    type="button"
                    onClick={() => toggleHint(activeSentenceIndex)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors mx-auto"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    {showHints[activeSentenceIndex] 
                      ? (language === 'pl' ? 'Ukryj wskazówkę' : 'Hide hint') 
                      : (language === 'pl' ? 'Pokaż wskazówkę' : 'Show hint')}
                  </button>
                  {showHints[activeSentenceIndex] && (
                    <div className="mt-1.5 mx-auto bg-amber-500/[0.04] border border-amber-500/15 rounded-xl p-3 text-xs text-amber-400 animate-fade-in-up max-w-lg">
                      {exercises[activeSentenceIndex].hint}
                    </div>
                  )}
                </div>
              )}

              {/* Student answer field */}
              <div className="w-full space-y-3 mt-4 pt-4 border-t border-white/5 flex flex-col items-center">
                {exerciseFormat !== 'puzzle' && (
                  <label className="block text-sm font-bold text-emerald-400/80 text-center w-full uppercase tracking-widest">
                    {language === 'pl' ? 'Twoje tłumaczenie na angielski:' : 'Your translation to English:'}
                  </label>
                )}
                
                {evaluationStatuses[activeSentenceIndex] === 'evaluated' && singleEvaluationResults[activeSentenceIndex] ? (
                  <div className="space-y-3 w-full text-center flex flex-col items-center">
                    <div 
                      className="w-full bg-black/30 backdrop-blur-sm border border-white/10 shadow-inner rounded-xl p-3 text-sm text-center"
                      dangerouslySetInnerHTML={{ __html: singleEvaluationResults[activeSentenceIndex].highlightedAnswer || singleEvaluationResults[activeSentenceIndex].studentAnswer }}
                    />
                    
                    <div className={`w-full p-3.5 rounded-xl border flex flex-col items-center text-center ${singleEvaluationResults[activeSentenceIndex].isCorrect ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                       <div className="font-bold flex flex-col sm:flex-row items-center justify-between w-full mb-3 text-sm gap-2">
                         <span className="flex items-center gap-2 flex-wrap">
                           {singleEvaluationResults[activeSentenceIndex].isCorrect ? '✅ Poprawnie!' : '❌ Błędy w tłumaczeniu'}
                           <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-medium">
                             <Sparkles className="w-3 h-3 text-cyan-400" />
                             <span>
                               {language === 'pl' ? 'Sprawdzone przez: ' : 'Evaluated by: '}
                               <strong className="text-white font-bold">{formatAIModelName(singleEvaluationResults[activeSentenceIndex].modelUsed)}</strong>
                             </span>
                           </span>
                         </span>
                         <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg border ${
                           singleEvaluationResults[activeSentenceIndex].score >= 80 
                             ? 'bg-green-500/20 border-green-500/30 text-green-300' 
                             : singleEvaluationResults[activeSentenceIndex].score >= 60 
                               ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' 
                               : 'bg-red-500/20 border-red-500/30 text-red-300'
                         }`}>
                           
                                                                                     {i18n.t("Wynik:")} {singleEvaluationResults[activeSentenceIndex].score}%
                         </span>
                       </div>
                       
                       {singleEvaluationResults[activeSentenceIndex].breakdown && (
                         <div className="grid grid-cols-3 gap-2 w-full mb-3 text-[11px] font-mono">
                           <div className="bg-black/30 p-2 rounded-lg border border-white/5 text-center flex flex-col items-center justify-center">
                             <div className="text-content-muted text-[9px] uppercase tracking-wider">{language === 'pl' ? 'Znaczenie' : 'Meaning'}</div>
                             <div className="font-bold text-white mt-0.5">{singleEvaluationResults[activeSentenceIndex].breakdown?.meaning_score}/40</div>
                           </div>
                           <div className="bg-black/30 p-2 rounded-lg border border-white/5 text-center flex flex-col items-center justify-center">
                             <div className="text-content-muted text-[9px] uppercase tracking-wider">{language === 'pl' ? 'Gramatyka' : 'Grammar'}</div>
                             <div className="font-bold text-white mt-0.5">{singleEvaluationResults[activeSentenceIndex].breakdown?.grammar_score}/40</div>
                           </div>
                           <div className="bg-black/30 p-2 rounded-lg border border-white/5 text-center flex flex-col items-center justify-center">
                             <div className="text-content-muted text-[9px] uppercase tracking-wider">{language === 'pl' ? 'Słownictwo' : 'Vocab'}</div>
                             <div className="font-bold text-white mt-0.5">{singleEvaluationResults[activeSentenceIndex].breakdown?.vocabulary_score}/20</div>
                           </div>
                         </div>
                       )}
                       
                       <div className="w-full flex flex-col items-center gap-3 p-2.5 liquid-glass-tile rounded-lg mb-3 border border-white/5 text-center">
                         <div 
                           className="font-medium text-primary/90 text-sm"
                           dangerouslySetInnerHTML={{ __html: singleEvaluationResults[activeSentenceIndex].highlighted_better_version || singleEvaluationResults[activeSentenceIndex].correctTranslation }}
                         />
                         <div className="flex items-center justify-center gap-1.5 shrink-0 bg-black/30 p-1 rounded-md mt-2">
                           <button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-US')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-cyan-400 text-xs font-bold transition-all ${isPlayingAudio ? 'opacity-50' : ''}`} title={i18n.t("Wymowa amerykańska")} disabled={isPlayingAudio}>
  <Volume2 className="w-3.5 h-3.5" /> AmE
</button>
                           <button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-GB')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-emerald-400 text-xs font-bold transition-all ${isPlayingAudio ? 'opacity-50' : ''}`} title={i18n.t("Wymowa brytyjska")} disabled={isPlayingAudio}>
  <Volume2 className="w-3.5 h-3.5" /> BrE
</button>

                         </div>
                       </div>

                       <div className="space-y-3 mt-1 text-xs w-full text-left">
                         {singleEvaluationResults[activeSentenceIndex].feedbackSyntax && (
                           <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20 flex flex-col items-start text-left w-full">
                             <div className="flex items-center gap-1.5 font-bold text-red-400 text-[10px] uppercase tracking-wider mb-1">
                               <AlertCircle className="w-3.5 h-3.5" />
                               {language === 'pl' ? 'Szyk i gramatyka' : 'Syntax & Grammar'}
                             </div>
                             <p className="opacity-90 leading-relaxed text-red-100">{singleEvaluationResults[activeSentenceIndex].feedbackSyntax}</p>
                           </div>
                         )}
                         {singleEvaluationResults[activeSentenceIndex].feedbackVocab && (
                           <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/20 flex flex-col items-start text-left w-full">
                             <div className="flex items-center gap-1.5 font-bold text-blue-400 text-[10px] uppercase tracking-wider mb-1">
                               <AlertCircle className="w-3.5 h-3.5" />
                               {language === 'pl' ? 'Słownictwo i naturalność' : 'Vocabulary & Naturalness'}
                             </div>
                             <p className="opacity-90 leading-relaxed text-blue-100">{singleEvaluationResults[activeSentenceIndex].feedbackVocab}</p>
                           </div>
                         )}
                         {singleEvaluationResults[activeSentenceIndex].feedbackRule && (
                           <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 flex flex-col items-start text-left w-full">
                             <div className="flex items-center gap-1.5 font-bold text-amber-500 text-[10px] uppercase tracking-wider mb-1">
                               <Sparkles className="w-3.5 h-3.5" />
                               {language === 'pl' ? 'Złota zasada' : 'Golden Rule'}
                             </div>
                             <p className="opacity-90 leading-relaxed text-amber-100 font-medium">{singleEvaluationResults[activeSentenceIndex].feedbackRule}</p>
                           </div>
                         )}
                         {(!singleEvaluationResults[activeSentenceIndex].feedbackSyntax && !singleEvaluationResults[activeSentenceIndex].feedbackVocab && !singleEvaluationResults[activeSentenceIndex].feedbackRule) && (
                           <p className="whitespace-pre-wrap opacity-90 leading-relaxed text-xs text-center p-3">{singleEvaluationResults[activeSentenceIndex].explanation}</p>
                         )}
                       </div>
                    </div>
                  </div>
                ) : (
                  <>
                {exerciseFormat === 'puzzle' ? (
                  <PuzzleExercise 
                    sentence={exercises[activeSentenceIndex].englishTranslation}
                    displaySentence={exercises[activeSentenceIndex].polishSentence}
                    puzzleChunks={exercises[activeSentenceIndex].puzzleChunks}
                    level={level}
                    currentAnswer={studentAnswers[activeSentenceIndex] || ''}
                    onNext={handleNext}
                    onAnswerChange={(ans) => {
                      handleAnswerChange(activeSentenceIndex, ans);
                      if (ans === exercises[activeSentenceIndex].englishTranslation) {
                        const result = {
                          isCorrect: true,
                          score: 10,
                          feedbackVocab: '',
                          feedbackSyntax: '',
                          explanation: 'Ułożono poprawnie.',
                          improvedTranslation: ans,
                          polishSentence: exercises[activeSentenceIndex].polishSentence,
                          studentAnswer: ans,
                          correctTranslation: ans,
                          highlightedAnswer: ans,
                          mistakes: []
                        };
                        setSingleEvaluationResults(prev => ({ ...prev, [activeSentenceIndex]: result }));
                      }
                    }}
                  />
                ) : (
                  <textarea
                    value={studentAnswers[activeSentenceIndex] || ''}
                    onChange={(e) => handleAnswerChange(activeSentenceIndex, e.target.value)}
                    placeholder={language === 'pl' ? 'Wpisz swoje tłumaczenie tutaj...' : 'Type your translation here...'}
                    rows={2}
                    disabled={evaluationStatuses[activeSentenceIndex] === 'evaluating'}
                    className="w-full bg-black/30 backdrop-blur-sm border border-white/10 shadow-inner focus:border-primary/40 focus:ring-1 focus:ring-primary/20 rounded-xl p-3 text-sm outline-none transition-all duration-200 text-center"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (evaluationStatuses[activeSentenceIndex] !== 'evaluated') {
                          if (studentAnswers[activeSentenceIndex]?.trim()) {
                            handleEvaluateSingle();
                          }
                        } else {
                          handleNext();
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
            <div className="flex justify-between items-center pt-4 flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={handlePrev}
                disabled={activeSentenceIndex === 0}
                className="px-4 py-2 text-sm"
              >
                {language === 'pl' ? 'Poprzednie' : 'Previous'}
              </Button>
              
              {exerciseFormat === 'puzzle' ? (
                <div className="flex-1 flex justify-end">
                  {activeSentenceIndex === exercises.length - 1 && practiceMode === 'fixed' ? (
                    <AILoadingButton
                      onClick={handleFinishAll}
                      disabled={studentAnswers[activeSentenceIndex] !== exercises[activeSentenceIndex].englishTranslation}
                      className="px-4 md:px-6 py-2 md:py-3 bg-primary hover:bg-primary/95 text-black font-extrabold text-sm w-full sm:w-auto"
                    >
                      {language === 'pl' ? 'Zakończ rozgrzewkę' : 'Finish warmup'}
                    </AILoadingButton>
                ) : (
                    <AILoadingButton
                      onClick={handleNext}
                      disabled={studentAnswers[activeSentenceIndex] !== exercises[activeSentenceIndex].englishTranslation || isGeneratingMore}
                      isLoading={isGeneratingMore && activeSentenceIndex === exercises.length - 1}
                      loadingText={language === 'pl' ? 'Ładowanie...' : 'Loading...'}
                      className="px-4 md:px-6 py-2 md:py-3 bg-primary hover:bg-primary/95 text-black font-extrabold text-sm w-full sm:w-auto"
                    >
                      {language === 'pl' ? 'Następne' : 'Next'}
                    </AILoadingButton>
                  )}
                </div>
              ) : evaluationStatuses[activeSentenceIndex] !== 'evaluated' ? (
                <div className="flex gap-2 flex-1 justify-end">
                  <AILoadingButton
                    onClick={handleEvaluateSingle}
                    disabled={!studentAnswers[activeSentenceIndex]?.trim()}
                    isLoading={evaluationStatuses[activeSentenceIndex] === 'evaluating'}
                    loadingText={language === 'pl' ? '...' : '...'}
                    className="px-4 md:px-6 py-2 md:py-3 bg-base-300 hover:bg-base-300/80 text-white font-bold text-sm"
                  >
                    {language === 'pl' ? 'Sprawdź' : 'Check'}
                  </AILoadingButton>

                  {activeSentenceIndex === exercises.length - 1 && practiceMode === 'fixed' ? (
                    <AILoadingButton
                      onClick={handleFinishAll}
                      disabled={!studentAnswers[activeSentenceIndex]?.trim() || isGeneratingMore}
                      isLoading={isGeneratingMore}
                      loadingText={language === 'pl' ? '...' : '...'}
                      className="px-4 md:px-6 py-2 md:py-3 bg-primary hover:bg-primary/95 text-black font-extrabold text-sm"
                    >
                      {language === 'pl' ? 'Zakończ' : 'Finish'}
                    </AILoadingButton>
                ) : (
                    <AILoadingButton
                      onClick={handleNext}
                      disabled={!studentAnswers[activeSentenceIndex]?.trim() || isGeneratingMore}
                      isLoading={isGeneratingMore && activeSentenceIndex === exercises.length - 1}
                      loadingText={language === 'pl' ? '...' : '...'}
                      className="px-4 md:px-6 py-2 md:py-3 bg-primary hover:bg-primary/95 text-black font-extrabold text-sm"
                    >
                      {language === 'pl' ? 'Dalej' : 'Next'}
                    </AILoadingButton>
                  )}
                </div>
              ) : (
                <div className="flex gap-2 flex-1 justify-end">
                  {activeSentenceIndex === exercises.length - 1 && practiceMode === 'fixed' ? (
                    <AILoadingButton
                      onClick={handleFinishAll}
                      className="px-4 md:px-6 py-2 md:py-3 bg-primary hover:bg-primary/95 text-black font-extrabold text-sm"
                    >
                      {language === 'pl' ? 'Zakończ i podsumuj' : 'Finish & Summarize'}
                    </AILoadingButton>
                ) : (
                    <AILoadingButton
                      onClick={handleNext}
                      disabled={isGeneratingMore}
                      isLoading={isGeneratingMore && activeSentenceIndex === exercises.length - 1}
                      loadingText={language === 'pl' ? '...' : '...'}
                      className="px-4 md:px-6 py-2 md:py-3 bg-primary hover:bg-primary/95 text-black font-extrabold text-sm"
                    >
                      {language === 'pl' ? 'Dalej' : 'Next'}
                    </AILoadingButton>
                  )}
                </div>
              )}
            </div>

            {(evaluationStatuses[activeSentenceIndex] === 'evaluating' || isGeneratingMore) && (
              <div className="w-full flex justify-center mt-3 animate-fade-in">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
                  </span>
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    {language === 'pl' ? 'Wysyłam zapytanie do: ' : 'Sending query to: '}
                    <strong className="text-white font-bold">{formatAIModelName(activeGeneratingModel)}</strong>
                  </span>
                </div>
              </div>
            )}
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

      {/* PUZZLE SUCCESS STEP */}
      {step === 'puzzle-success' && (
        <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[50vh] space-y-8 animate-fade-in-up">
          <div className="relative">
            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", bounce: 0.5, duration: 0.8 }}
              className="w-32 h-32 bg-primary/20 rounded-full flex items-center justify-center relative z-10 border-4 border-primary/40 shadow-[0_0_50px_rgba(52,211,153,0.3)]"
            >
              <Award className="w-16 h-16 text-primary" />
            </motion.div>
            <motion.div 
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 bg-primary/30 rounded-full blur-xl z-0"
            />
          </div>
          
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-black text-white bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">
              {language === 'pl' ? 'Gratulacje!' : 'Congratulations!'}
            </h2>
            <p className="text-lg text-content-muted max-w-md mx-auto leading-relaxed">
              {language === 'pl' 
                ? 'Rozgrzewka ukończona śpiewająco. Skonstruowałeś poprawne zdania. Czy jesteś gotowy na prawdziwe wyzwanie polegające na samodzielnym tłumaczeniu?' 
                : 'Warmup completed perfectly. You constructed the sentences. Are you ready for the true challenge of independent translation?'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
            <AILoadingButton 
              onClick={handleProceedToTrueChallenge} 
              isLoading={isLoading}
              loadingText={language === 'pl' ? 'Przygotowywanie...' : 'Preparing...'}
              className="flex-1 py-4 text-lg bg-primary text-black hover:bg-primary/90 hover:scale-105 font-bold shadow-[0_0_20px_rgba(52,211,153,0.2)]"
            >
              {language === 'pl' ? 'Tak? 🔥' : 'Yes? 🔥'}
            </AILoadingButton>
            <Button 
              onClick={handleMaybeLater} 
              variant="secondary"
              className="flex-1 py-4 text-lg bg-base-300 hover:bg-base-200"
            >
              {language === 'pl' ? 'Może później?' : 'Maybe later?'}
            </Button>
          </div>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-black/30 rounded text-xs font-mono text-content-muted">
                        {i18n.t("Zdanie")} {idx + 1}
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-medium shadow-sm">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>
                          {language === 'pl' ? 'Sprawdzone przez: ' : 'Evaluated by: '}
                          <strong className="text-white font-semibold">{formatAIModelName(res.modelUsed)}</strong>
                        </span>
                      </div>
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
                    {res.breakdown && (
                      <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                        <div className="bg-black/30 p-2 rounded-lg border border-white/5 text-center">
                          <div className="text-content-muted text-[9px] uppercase tracking-wider">{language === 'pl' ? 'Znaczenie' : 'Meaning'}</div>
                          <div className="font-bold text-white mt-0.5">{res.breakdown.meaning_score}/40</div>
                        </div>
                        <div className="bg-black/30 p-2 rounded-lg border border-white/5 text-center">
                          <div className="text-content-muted text-[9px] uppercase tracking-wider">{language === 'pl' ? 'Gramatyka' : 'Grammar'}</div>
                          <div className="font-bold text-white mt-0.5">{res.breakdown.grammar_score}/40</div>
                        </div>
                        <div className="bg-black/30 p-2 rounded-lg border border-white/5 text-center">
                          <div className="text-content-muted text-[9px] uppercase tracking-wider">{language === 'pl' ? 'Słownictwo' : 'Vocab'}</div>
                          <div className="font-bold text-white mt-0.5">{res.breakdown.vocabulary_score}/20</div>
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-xs text-content-muted font-bold mb-1 uppercase tracking-wider">{language === 'pl' ? 'Po polsku' : 'In Polish'}</div>
                      <div className="text-base font-semibold text-white">{res.polishSentence}</div>
                    </div>

                    <div className="flex flex-col space-y-4 pt-2 border-t border-white/5">
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
                                className="flex items-center justify-center w-6 h-6 bg-black/30 hover:bg-primary/20 text-primary rounded transition-colors"
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
                        <div className="text-sm p-2.5 bg-primary/[0.02] border border-primary/10 text-primary-light rounded-lg font-medium" dangerouslySetInnerHTML={{ __html: res.highlighted_better_version || res.correctTranslation }}>
                        </div>
                      </div>
                    </div>

                    {/* Explanations & corrections */}
                    <details className="liquid-glass-tile p-4 rounded-xl border border-white/5 space-y-2 mt-2 group">
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
                              <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  {language === 'pl' ? 'Szyk i gramatyka' : 'Syntax & Grammar'}
                                </div>
                                <div className="text-sm text-red-100/90 leading-relaxed">{res.feedbackSyntax}</div>
                              </div>
                            )}
                            {res.feedbackVocab && (
                              <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  {language === 'pl' ? 'Słownictwo i naturalność' : 'Vocabulary & Naturalness'}
                                </div>
                                <div className="text-sm text-blue-100/90 leading-relaxed">{res.feedbackVocab}</div>
                              </div>
                            )}
                            {res.feedbackRule && (
                              <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">
                                  <Sparkles className="w-3.5 h-3.5" />
                                  {language === 'pl' ? 'Złota zasada' : 'Golden Rule'}
                                </div>
                                <div className="text-sm text-amber-100 font-medium leading-relaxed">{res.feedbackRule}</div>
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
          
          <div className="flex justify-center mt-8 space-x-4">
            <Button
              onClick={() => {
                if (resultsRef.current) {
                  const opt = {
                    margin: 10,
                    filename: 'ai_exercise_report.pdf',
                    image: { type: 'jpeg' as const, quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
                  };
                  html2pdf().set(opt).from(resultsRef.current).save();
                }
              }}
            >
              {language === 'pl' ? 'Pobierz raport PDF' : 'Download PDF Report'}
            </Button>
          </div>
        </div>
      )}
      {isTopicModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm" onClick={() => setIsTopicModalOpen(false)}>
          <div 
            className="bg-[#121824] rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-white/10 shadow-[0_16px_64px_rgba(0,0,0,0.6)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-20 flex items-center justify-between p-6 bg-[#121824]/95 backdrop-blur-xl border-b border-white/10">
              <div>
                 <h2 className="text-xl font-bold text-white">Tematyka mieszana (Zasoby)</h2>
                 <p className="text-sm text-content-muted">Wybierz kategorię z bazy, aby wygenerować zdania do ćwiczeń.</p>
              </div>
              <button 
                onClick={() => setIsTopicModalOpen(false)}
                className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {isLoadingTopics ? (
                <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : grammarChapters.length === 0 ? (
                <div className="text-center text-gray-500 py-8">Brak tematów w bazie. Skonfiguruj w panelu admina.</div>
              ) : (
                grammarChapters.map((chapter: any, cIdx: number) => (
                  <div key={chapter.id || cIdx} className="border border-white/5 bg-base-200/50 rounded-xl overflow-hidden">
                    <div className="p-4 bg-white/5 font-bold text-white border-b border-white/5 flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs">{cIdx + 1}</div>
                      {chapter.name}
                    </div>
                    <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                      {chapter.topics.map((topic: any, tIdx: number) => {
                         const hasSentences = (topic.sentences || "").trim().length > 0;
                         return (
                          <button
                            key={topic.id || tIdx}
                            disabled={!hasSentences}
                            onClick={() => {
                               setIsTopicModalOpen(false);
                               const promptAddon = cIdx === 0
                                  ? `[TŁUMACZENIA - Gramatyka 1]: Wygeneruj proste zdania na poziomie A1-A2, używając tych wzorów jako inspiracji:\n${topic.sentences}`
                                  : `[TŁUMACZENIA]: Wygeneruj ćwiczenia, bazując ściśle na tych zdaniach, lekko je modyfikując: \n${topic.sentences}`;
                               handleGenerate(false, promptAddon);
                            }}
                            className={`p-3 rounded-lg border text-left flex flex-col justify-center min-h-[60px] ${hasSentences ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/50 text-emerald-100" : "opacity-50 cursor-not-allowed border-transparent bg-black/10 text-gray-600"}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-content-muted">{tIdx + 1}.</span>
                              <span className="font-semibold text-sm truncate flex-1">{topic.name}</span>
                            </div>
                            {hasSentences && <div className="text-[10px] text-emerald-400 mt-1 ml-6">{topic.sentences.split("\n").filter((s:string) => s.trim()).length} zdań</div>}
                          </button>
                         );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
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
