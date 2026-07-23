import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useLanguage } from '../../context/LanguageContext';
import { useFlashcards } from '../../context/FlashcardContext';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs, query, orderBy, limit, addDoc, where, documentId, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { generateTranslationExercises, evaluateTranslations, getUserWeaknesses, logMistakesToFirebase } from '../../services/geminiService';
import { TranslationExercise, TranslationEvaluationResult, FlashcardSet, LessonRecord, VocabularySet, PracticeLog } from '../../types';
import { getVocabularySetsForStudent, markVocabularySetAsUsed } from '../../services/lessonRecord';
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
  Target,
  Layers,
  Shuffle, X, Eye
} from 'lucide-react';


const ACCENTS = ['en-US', 'en-GB', 'en-AU', 'en-SCT'];
const ACCENT_FLAGS: Record<string, string> = {
  'en-US': '🇺🇸',
  'en-GB': '🇬🇧',
  'en-AU': '🇦🇺',
  'en-SCT': '🏴󠁧󠁢󠁳󠁣󠁴󠁿'
};

const DEFAULT_GENERATION_PROMPT = `Jesteś wirtualnym nauczycielem języka angielskiego. Twoim absolutnym priorytetem jest personalizacja UX - wygenerowane zdania muszą być maksymalnie dopasowane do ucznia.\n\n[START KONTEKST UCZNIA]\n\nProfil (hobby, praca, wiek): \${userProfile || "Brak danych"}\n\nNajczęstsze błędy: \${weaknessesList || "Brak zidentyfikowanych błędów"}\n[KONIEC KONTEKST UCZNIA]\n\nWygeneruj dokładnie [NUM_SENTENCES] unikalnych zdań po polsku do przetłumaczenia na język angielski, na wybranym poziomie CEFR.\n\nZASADY TWORZENIA:\n\nPobierz dostarczony zestaw słówek z historii lekcji i zbuduj na ich podstawie zdania. Nawiązuj do tematu lekcji.\n\nWykorzystaj Profil kursanta, aby zdania były angażujące i osobiście interesujące.\n\nPRIORYTET: Skonstruuj zdania w taki sposób, aby WYMUSIĆ na uczniu użycie gramatyki/słownictwa z listy "Najczęstsze błędy" (jeśli występuje).\n\nWAŻNE DLA UKŁADANKI: Buduj zdania, które naturalnie dzielą się na pełne frazy i bloki znaczeniowe (np. podmiot + orzeczenie, wyrażenia przyimkowe), co ułatwi ich późniejsze pocięcie na logiczne "kostki" w ćwiczeniu.\n\nZapewnij krótką wskazówkę (po polsku) dla każdego zdania, ułatwiającą tłumaczenie.`;

const DEFAULT_EVALUATION_PROMPT = `Przeanalizuj i oceń tłumaczenie angielskie wykonane przez ucznia dla każdego zdania po polsku. Zwróć uwagę na poprawność gramatyczną, słownictwo, idiomy i naturalność wypowiedzi.\n\n[START KONTEKST BŁĘDÓW]\nMiej szczególną uwagę na te historyczne błędy ucznia: \${weaknessesList || "Brak danych"}. Jeśli uczeń ponownie popełnił błąd z tej listy, zaznacz to w swoim feedbacku, przypominając mu o tym problemie.\n[KONIEC KONTEKST BŁĘDÓW]\n\nWskaż mocne strony, alternatywne poprawne opcje i precyzyjnie wyjaśnij ewentualne błędy po polsku.\nDla każdego zdania określ procentowy wynik poprawności (score) od 0 do 100.`;

import { ExerciseType } from '../../types';

let audioCtx: AudioContext | null = null;
const playSliderSound = () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const now = audioCtx.currentTime;
    
    // Wooden block knock / click synthesis
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'sine';
    // Frequency drop for wooden click timbre
    osc.frequency.setValueAtTime(850, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.025);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, now);
    filter.Q.setValueAtTime(3.8, now);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  } catch (e) {
    // Ignore audio errors
  }
};


const AIGenerationLoader: React.FC<{ language: 'pl' | 'en'; level: string; logs?: string }> = ({ language, level }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tangledGroupRef = useRef<SVGGElement>(null);
  const organizedGroupRef = useRef<SVGGElement>(null);
  const strandPathRef = useRef<SVGPathElement>(null);
  const coreGlowRef = useRef<HTMLDivElement>(null);
  const statusTextRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Create master timeline that continuously morphs chaos -> structure
      const tl = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.5 });

      // 1. Rotate the chaotic tangled ball continuously
      if (tangledGroupRef.current) {
        gsap.to(tangledGroupRef.current, {
          rotation: 360,
          transformOrigin: '50% 50%',
          duration: 12,
          repeat: -1,
          ease: 'none',
        });

        // Individual tangled strands wobble organically
        const strands = tangledGroupRef.current.querySelectorAll('.tangled-strand');
        strands.forEach((strand, i) => {
          gsap.to(strand, {
            rotation: (i % 2 === 0 ? 1 : -1) * (15 + i * 10),
            scale: 0.85 + (i % 3) * 0.1,
            transformOrigin: '50% 50%',
            duration: 2.5 + i * 0.4,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          });
        });
      }

      // 2. Rotate organized concentric rings in opposite directions
      if (organizedGroupRef.current) {
        const rings = organizedGroupRef.current.querySelectorAll('.organized-ring');
        rings.forEach((ring, i) => {
          gsap.to(ring, {
            rotation: (i % 2 === 0 ? 360 : -360),
            transformOrigin: '50% 50%',
            duration: 10 + i * 4,
            repeat: -1,
            ease: 'none',
          });
        });
      }

      // 3. Main transformation timeline: Untangling from chaotic yarn ball into pristine concentric lines
      tl.to(tangledGroupRef.current, {
        scale: 0.4,
        opacity: 0.15,
        filter: 'blur(2px)',
        duration: 3.5,
        ease: 'power2.inOut',
      }, 0);

      tl.to(organizedGroupRef.current, {
        scale: 1,
        opacity: 1,
        stagger: 0.15,
        duration: 3.5,
        ease: 'power2.inOut',
      }, 0);

      // Animate strand unspooling length
      if (strandPathRef.current) {
        gsap.fromTo(strandPathRef.current, 
          { strokeDashoffset: 600 },
          {
            strokeDashoffset: 0,
            duration: 4,
            repeat: -1,
            ease: 'sine.inOut',
          }
        );
      }

      // Core pulsing light
      if (coreGlowRef.current) {
        gsap.to(coreGlowRef.current, {
          scale: 1.25,
          opacity: 0.9,
          duration: 1.8,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }

      // Subtle pulse on status text
      if (statusTextRef.current) {
        gsap.to(statusTextRef.current, {
          opacity: 0.6,
          duration: 1.2,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }
    }, containerRef);

    return () => ctx.revert();
  }, [language, level]);

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[420px] w-full max-w-xl mx-auto my-auto animate-fade-in">
      {/* GSAP Tangled Yarn -> Organized Geometry Canvas */}
      <div className="relative w-64 h-64 mb-6 flex items-center justify-center select-none">
        {/* Ambient Glow Aura */}
        <div 
          ref={coreGlowRef} 
          className="absolute w-44 h-44 rounded-full bg-gradient-to-tr from-emerald-500/25 via-teal-400/20 to-cyan-500/15 blur-3xl pointer-events-none" 
        />

        {/* Central SVG Stage */}
        <svg
          className="w-full h-full drop-shadow-[0_0_25px_rgba(52,211,153,0.35)]"
          viewBox="0 0 200 200"
          fill="none"
        >
          <defs>
            <linearGradient id="emeraldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="50%" stopColor="#2dd4bf" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <linearGradient id="yarnGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#a7f3d0" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* LAYER 1: Tangled Yarn Ball (Chaotic overlapping loops) */}
          <g ref={tangledGroupRef} className="origin-center">
            {/* Tangled loop 1 */}
            <path
              className="tangled-strand"
              d="M 100,40 C 140,30 160,80 150,110 C 140,140 110,160 80,150 C 50,140 40,100 60,70 C 80,40 120,50 140,70 C 160,90 140,140 100,160 C 60,180 30,120 50,90 C 70,60 130,30 100,40 Z"
              stroke="url(#yarnGradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.85"
            />
            {/* Tangled loop 2 */}
            <path
              className="tangled-strand"
              d="M 60,100 C 40,60 90,30 130,50 C 170,70 160,120 130,150 C 100,180 50,150 40,110 C 30,70 80,40 120,60 C 160,80 150,130 110,150 C 70,170 50,130 60,100 Z"
              stroke="#34d399"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity="0.75"
            />
            {/* Tangled loop 3 */}
            <path
              className="tangled-strand"
              d="M 110,50 C 150,60 170,110 140,140 C 110,170 60,160 40,120 C 20,80 60,40 100,50 C 140,60 150,110 130,140 C 110,170 70,150 60,110 Z"
              stroke="#22d3ee"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
              opacity="0.7"
            />
            {/* Tangled loop 4 */}
            <path
              className="tangled-strand"
              d="M 80,60 C 120,40 160,70 150,120 C 140,170 90,160 60,130 C 30,100 50,50 90,60 C 130,70 140,120 110,150 C 80,180 50,130 80,60 Z"
              stroke="#a7f3d0"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.6"
            />
            {/* Chaotic density core lines */}
            <path
              className="tangled-strand"
              d="M 75,85 Q 125,65 135,115 Q 145,165 95,145 Q 45,125 75,85 Z"
              stroke="#fbbf24"
              strokeWidth="1.2"
              fill="none"
              opacity="0.65"
            />
          </g>

          {/* LAYER 2: Unspooling Thread Strand */}
          <path
            ref={strandPathRef}
            d="M 100,20 C 150,20 180,50 180,100 C 180,150 150,180 100,180 C 50,180 20,150 20,100 C 20,50 50,20 100,20"
            stroke="url(#emeraldGradient)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="600"
            fill="none"
            filter="url(#glow)"
          />

          {/* LAYER 3: Organized Harmonious Circles (Revealed as yarn untangles) */}
          <g ref={organizedGroupRef} className="origin-center opacity-0 scale-50">
            {/* Outer pristine ring */}
            <circle
              className="organized-ring"
              cx="100"
              cy="100"
              r="78"
              stroke="url(#emeraldGradient)"
              strokeWidth="2"
              strokeDasharray="180 20 60 20"
              fill="none"
              filter="url(#glow)"
            />
            {/* Second concentric ring */}
            <circle
              className="organized-ring"
              cx="100"
              cy="100"
              r="60"
              stroke="#22d3ee"
              strokeWidth="1.8"
              strokeDasharray="120 15 40 15"
              fill="none"
              opacity="0.85"
            />
            {/* Third concentric ring */}
            <circle
              className="organized-ring"
              cx="100"
              cy="100"
              r="42"
              stroke="#34d399"
              strokeWidth="1.5"
              strokeDasharray="80 10 30 10"
              fill="none"
              opacity="0.9"
            />
            {/* Innermost pristine circle */}
            <circle
              className="organized-ring"
              cx="100"
              cy="100"
              r="24"
              stroke="#a7f3d0"
              strokeWidth="2"
              fill="none"
            />
            {/* Orbiting geometric nodes */}
            <circle cx="100" cy="22" r="3.5" fill="#34d399" filter="url(#glow)" />
            <circle cx="178" cy="100" r="3" fill="#22d3ee" filter="url(#glow)" />
            <circle cx="100" cy="178" r="3.5" fill="#38bdf8" filter="url(#glow)" />
            <circle cx="22" cy="100" r="3" fill="#a7f3d0" filter="url(#glow)" />
          </g>

          {/* Center Glowing AI Core Icon */}
          <g className="origin-center">
            <circle cx="100" cy="100" r="16" fill="#064e3b" stroke="#34d399" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="6" fill="#34d399" className="animate-pulse" />
          </g>
        </svg>
      </div>

      {/* Title & Subtitle (Clean & Elegant, No Console Box) */}
      <h3 className="text-xl font-bold text-white mb-2 tracking-tight flex items-center justify-center gap-2">
        <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
        <span>{language === 'pl' ? 'Sztuczna inteligencja tworzy zadania...' : 'AI is crafting your exercises...'}</span>
      </h3>
      <p ref={statusTextRef} className="text-xs text-emerald-300/80 font-medium tracking-wide max-w-sm mx-auto">
        {language === 'pl' 
          ? 'Porządkowanie myśli i dopasowywanie treści do Twojego poziomu' 
          : 'Organizing concepts and tailoring content to your level'}
      </p>
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
  initialSetId?: string | null;
  onStartPractice?: (type: any, mode1?: boolean, mode2?: boolean) => void;
  onExerciseStateChange?: (active: boolean) => void;
}

const AIExerciseGeneratorScreen: React.FC<AIExerciseGeneratorScreenProps> = ({ initialSetId = null, onStartPractice, onExerciseStateChange }) => {
  const { language } = useLanguage();
  const { sets, getFlashcards } = useFlashcards();
  const { user } = useAuth();
  const isTeacher = user?.role === 'admin' || user?.role === 'teacher';

  // Settings states
  const [activeTab, setActiveTab] = useState<'ai' | 'other'>(typeof window !== 'undefined' && window.innerWidth < 1024 ? 'other' : 'ai');
  const [selectedSetId, setSelectedSetId] = useState<string>('all');
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [level, setLevel] = useState<string>(user?.level || 'B1');
  const [numSentences, setNumSentences] = useState<number>(5);
  const [practiceMode, setPracticeMode] = useState<'fixed' | 'time'>('fixed');
  const [exerciseFormat, setExerciseFormat] = useState<'typing' | 'puzzle'>('puzzle');
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
  const [debugLogs, setDebugLogs] = useState<string>('');
  const addLog = (msg: string) => { console.log(msg); setDebugLogs(prev => prev + "\n" + msg); };
  
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
      if (blob.size === 0) throw new Error('Empty audio blob');
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

  const handleStartOtherPractice = (type: any, mode1?: boolean, mode2?: boolean) => {
    if (user?.id && (selectedSetId === 'lessons' || selectedLessonIds.length > 0)) {
      selectedLessonIds.forEach(id => {
        const set = vocabularySets.find(s => s.id === id);
        if (set && set.used === false) {
          set.used = true;
          markVocabularySetAsUsed(user.id, id).catch(console.error);
        }
      });
    }
    onStartPractice?.(type, mode1, mode2);
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
            if (selectedSetId === 'lessons' || selectedLessonIds.length > 0) {
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
      const studentProfileContext = `Kluczowy profil kursanta: ${user?.firstName ? `Imię kursanta: ${user.firstName}. ` : ''}${user?.description ? `Cały wpis z profilu kursanta (zainteresowania, cele, przykładowe zdania): ${user.description}` : 'Brak dodatkowych danych profilu.'}${user?.aiPrompt ? `\nSpersonalizowany Prompt (ŻELAZNA ZASADA DLA AI - uczeń musi widzieć przykłady w tym stylu): ${user.aiPrompt}` : ''}`;
      
      let userProfileStr = user?.description || "Brak danych";
      
let finalGenPrompt = customGenPrompt;
      if (additionalInstructions.trim().length > 0) {
        finalGenPrompt += '\n\nDODATKOWE INSTRUKCJE OD NAUCZYCIELA: ' + additionalInstructions;
      }
      if (specialPromptOverride) {
        finalGenPrompt += '\n\n' + specialPromptOverride;
      }
      const resolvedGenPrompt = finalGenPrompt
        .replace(/\$\{userProfile(?: \|\| "[^"]+")?\}/g, userProfileStr)
        .replace(/\$\{weaknessesList(?: \|\| "[^"]+")?\}/g, weaknessesListStr);

      addLog('Calling generateTranslationExercises');
      const generated = await generateTranslationExercises(level, wordsToUse, resolvedGenPrompt, lessonContextString, studentProfileContext, practiceMode === 'time' ? 10 : numSentences, pastExercisesContext);
      
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
    try {
      const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`);
      if (!res.ok) throw new Error('Audio generation failed');
      const blob = await res.blob();
      if (blob.size === 0) throw new Error('Empty audio blob');
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
    if (exerciseFormat === 'puzzle') {
      setStep('puzzle-success');
      return;
    }

    setIsGeneratingMore(true);
    let currentEvalResults = { ...singleEvaluationResults };
    
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
        const batchResults = await evaluateTranslations(exercisesToEval, answersToEval, strictnessPrompt, evalStudentContext);

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
        setError(language === 'pl' ? "Błąd podczas masowej oceny: " + err.message : "Error during batch evaluation: " + err.message);
        setIsGeneratingMore(false);
        return;
      }
    }

    setIsGeneratingMore(false);

    // Generate full results
    const results = exercises.map((_, i) => currentEvalResults[i]).filter(Boolean);
    setEvaluationResults(results);
    setStep('results');
    setTimeLeft(null);

    if (user && results.length > 0) {
      const score = Math.round(results.reduce((acc, r) => acc + r.score, 0) / results.length);
      const exercisesDetails = results.map((r) => {
        if (r.explanation === 'Ułożono poprawnie.') {
           return `${r.polishSentence} -> ${r.studentAnswer} [UKŁADANKA - Wymagane powtórzenie przez samodzielne Wpisywanie]`;
        }
        return `${r.polishSentence} -> ${r.studentAnswer}`;
      }).join(' | ');
      
      const logData: any = {
        exerciseType: 'ai_translation',
        date: new Date().toISOString(),
        isRevisionMode: false,
        score: score,
        totalWords: results.length,
        exercisesData: exercisesDetails
      };
      if (testName) logData.testName = testName;
      
      try {
        await addDoc(collection(db, `users/${user.id}/practiceLogs`), logData);
        const allMistakes = results.flatMap(r => r.mistakes || []);
        if (allMistakes.length > 0) {
          await logMistakesToFirebase(user.id, allMistakes);
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
            ✨ {language === 'pl' ? 'Widok kursanta' : 'Student View'}
          </h1>
          <p className="text-content-muted text-sm mt-1">
            {language === 'pl' 
              ? 'Ćwicz tłumaczenie zdań z języka polskiego na angielski na podstawie Twoich słówek i poziomu zaawansowania.'
              : 'Practice translating sentences from Polish to English based on your word lists and CEFR level.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isTeacher && (
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
          <motion.div 
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
          <AIGenerationLoader language={language} level={level} logs={debugLogs} />
        ) : (
          <div className="max-w-2xl mx-auto mt-4 px-4">
            <AnimatePresence>
              {user?.hasNewVocabulary && !isBannerDismissed && (
                <motion.div 
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  className="relative group mb-6"
                >
                  <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary/30 to-secondary/30 opacity-70 blur-md animate-pulse group-hover:opacity-100 transition duration-1000" />
                  <div className="relative border border-primary/40 rounded-2xl bg-gradient-to-r from-primary/15 to-base-100/90 p-4 flex items-center justify-between backdrop-blur-md gap-4">
                    <div 
                      className="flex items-center gap-4 cursor-pointer flex-1"
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
                    >
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-base-100 animate-ping" />
                        <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-base-100" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-white text-sm md:text-base leading-tight">
                          {language === 'pl' ? 'Masz przypisany nowy zestaw! 🎉' : 'You have a new vocabulary set! 🎉'}
                        </h3>
                        <p className="text-primary/90 text-xs md:text-sm mt-0.5 font-medium">
                          {language === 'pl' ? 'Twój nauczyciel dodał nowe słówka z lekcji. Kliknij, aby je poćwiczyć.' : 'Your teacher shared new vocabulary. Click to practice.'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
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
                        className="px-3 py-1.5 bg-primary text-black font-bold rounded-lg text-xs hover:bg-primary/95 transition-all shadow-md active:scale-95"
                      >
                        {language === 'pl' ? 'Przejdź' : 'Go'}
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsBannerDismissed(true);
                          if (user?.id) {
                            updateDoc(doc(db, 'users', user.id), { hasNewVocabulary: false }).catch(console.error);
                          }
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <Card className="p-6 sm:p-8 border border-white/10 bg-[#0d131d] backdrop-blur-2xl relative overflow-hidden flex flex-col rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] max-w-2xl mx-auto">
              {/* Top Segmented Navigation Tabs Bar */}
              <div className="bg-[#141d2a] border border-white/5 p-1 rounded-2xl flex gap-1 mb-7">
                <button
                  type="button"
                  onClick={() => setActiveTab('ai')}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 text-center ${
                    activeTab === 'ai' 
                      ? 'bg-[#222d3e] text-white shadow-sm border border-white/10' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {language === 'pl' ? 'Trening AI' : 'AI Training'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('other')}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 text-center flex items-center justify-center gap-2 ${
                    activeTab === 'other' 
                      ? 'bg-[#222d3e] text-white shadow-sm border border-white/10' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>{language === 'pl' ? 'Pozostałe ćwiczenia' : 'Other exercises'}</span>
                  <span className="px-1.5 py-0.5 text-[10px] font-mono tracking-wider bg-white/10 text-gray-300 rounded uppercase">
                    BETA
                  </span>
                </button>
              </div>

              {/* Single Box Body content */}
              <div>
                {activeTab === 'ai' ? (
                  <div className="space-y-7 animate-fade-in-up">
                    {/* Title & Subtitle */}
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        {language === 'pl' ? 'Konfiguracja Treningu' : 'Training Configuration'}
                      </h2>
                      <p className="text-sm text-gray-400 mt-1 font-normal">
                        {language === 'pl' ? 'Dostosuj parametry wyzwania i rozpocznij sesję AI.' : 'Customize challenge parameters and launch AI session.'}
                      </p>
                    </div>

                    {/* SECTION 1: ŹRÓDŁO SŁOWNICTWA */}
                    <div className="space-y-3">
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                        {language === 'pl' ? 'Źródło słownictwa' : 'Vocabulary source'}
                      </label>

                      {/* Special tasks from teacher if available */}
                      {specialTasks.length > 0 && specialTasks.map(task => (
                        <div key={task.id} className="mb-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedSetId !== 'special-task-' + task.id) {
                                setSelectedSetId('special-task-' + task.id);
                                setSelectedLessonIds([]);
                              } else {
                                setSelectedSetId('all');
                              }
                            }}
                            className={`w-full p-4 rounded-2xl border text-left transition-all duration-300 flex items-center justify-between ${
                              selectedSetId === 'special-task-' + task.id
                                ? 'border-emerald-500/60 bg-gradient-to-r from-emerald-950/40 via-[#15232d] to-[#131d28] text-white shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                                : 'border-white/10 bg-[#121824] hover:bg-[#17202e] hover:border-white/20 text-gray-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
                              <div>
                                <span className="font-bold text-sm text-white block">
                                  {language === 'pl' ? 'Zadanie specjalne' : 'Special Task'}
                                </span>
                                <span className="text-xs text-emerald-400/90 font-mono">
                                  {language === 'pl' ? 'Od Nauczyciela' : 'From Teacher'} • {task.sentences?.length} {language === 'pl' ? 'zdań' : 'sentences'}
                                </span>
                              </div>
                            </div>
                            {selectedSetId === 'special-task-' + task.id && (
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse shrink-0" />
                            )}
                          </button>
                        </div>
                      ))}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Option 1: Wszystkie słówka (Mix) */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSetId('all');
                            setSelectedLessonIds([]);
                          }}
                          className={`p-4 rounded-2xl border text-left transition-all duration-300 flex items-center justify-between min-h-[56px] ${
                            selectedSetId === 'all' && selectedLessonIds.length === 0
                              ? 'border-emerald-500/60 bg-gradient-to-r from-emerald-950/40 via-[#15232d] to-[#131d28] text-white shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                              : 'border-white/10 bg-[#121824] hover:bg-[#17202e] hover:border-white/20 text-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {selectedSetId === 'all' && selectedLessonIds.length === 0 ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse shrink-0" />
                            ) : (
                              <span className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0" />
                            )}
                            <span className="font-semibold text-sm">
                              {language === 'pl' ? 'Wszystkie słówka (Mix)' : 'All vocabulary (Mix)'}
                            </span>
                          </div>
                        </button>

                        {/* Option 2: Wybierz lekcję */}
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedSetId !== 'lessons') {
                              setSelectedSetId('lessons');
                              if (vocabularySets.length > 0 && selectedLessonIds.length === 0) {
                                setSelectedLessonIds([vocabularySets[0].id]);
                              }
                            } else {
                              setSelectedSetId('all');
                              setSelectedLessonIds([]);
                            }
                          }}
                          className={`p-4 rounded-2xl border text-left transition-all duration-300 flex items-center justify-between min-h-[56px] ${
                            selectedSetId === 'lessons' || selectedLessonIds.length > 0
                              ? 'border-emerald-500/60 bg-gradient-to-r from-emerald-950/40 via-[#15232d] to-[#131d28] text-white shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                              : 'border-white/10 bg-[#121824] hover:bg-[#17202e] hover:border-white/20 text-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <BookOpen className={`w-4 h-4 shrink-0 ${
                              selectedSetId === 'lessons' || selectedLessonIds.length > 0 ? 'text-emerald-400' : 'text-gray-400'
                            }`} />
                            <span className="font-semibold text-sm">
                              {language === 'pl' ? 'Wybierz lekcję' : 'Select lesson'}
                            </span>
                          </div>
                          {selectedSetId === 'lessons' || selectedLessonIds.length > 0 ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse shrink-0" />
                          ) : null}
                        </button>
                      </div>

                      {/* Expandable Lesson Drawer when "Wybierz lekcję" is active */}
                      <AnimatePresence initial={false}>
                        {(selectedSetId === 'lessons' || selectedLessonIds.length > 0) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="overflow-hidden pt-1"
                          >
                            <div className="p-4 border border-white/10 bg-[#121824] rounded-2xl space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar">
                              {vocabularySets.length > 0 ? vocabularySets.map((set, index) => {
                                const isSelected = selectedLessonIds.includes(set.id);
                                const lessonNumber = vocabularySets.length - index;
                                return (
                                  <div 
                                    key={set.id} 
                                    className={`flex flex-col p-3 rounded-xl border transition-all ${
                                      isSelected 
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-white' 
                                        : set.used === false
                                          ? 'bg-red-500/[0.04] border-red-500/25 hover:border-red-500/40'
                                          : 'bg-[#18212e] border-white/5 hover:border-white/10'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
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
                                          className="w-4 h-4 text-emerald-400 focus:ring-emerald-400 rounded border-white/20 bg-black/40 cursor-pointer accent-emerald-400"
                                        />
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-xs font-semibold leading-none flex items-center flex-wrap gap-y-1">
                                            <span className="text-[9px] font-mono bg-white/10 px-1.5 py-0.5 rounded text-emerald-300 mr-2 border border-white/5">L{lessonNumber}</span>
                                            <span className={`${isSelected ? 'text-white' : 'text-gray-300 hover:text-white'} truncate max-w-[160px] xs:max-w-none`}>
                                              {set.topic.replace(/^\d+\.\s*/, '').replace(/\(Lekcja\s*\d+\)\s*/gi, '').trim()}
                                            </span>
                                            {set.used === false && (
                                              <span className="ml-2 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-widest rounded bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                                                {language === 'pl' ? 'Nowy' : 'New'}
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                      </label>
                                      
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          const isExpanding = previewedSetId !== set.id;
                                          setPreviewedSetId(isExpanding ? set.id : null);
                                          if (isExpanding && set.used === false) {
                                            set.used = true;
                                            if (user?.id) {
                                              markVocabularySetAsUsed(user.id, set.id).catch(console.error);
                                            }
                                          }
                                        }}
                                        className={`p-1.5 rounded-lg transition-all shrink-0 ${
                                          previewedSetId === set.id 
                                            ? 'bg-emerald-500/20 text-emerald-400' 
                                            : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
                                        }`}
                                        title={language === 'pl' ? 'Przejrzyj słówka' : 'Preview vocabulary'}
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    <AnimatePresence>
                                      {previewedSetId === set.id && set.vocabularyText && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                          animate={{ height: 'auto', opacity: 1, marginTop: 10 }}
                                          exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                          transition={{ duration: 0.2 }}
                                          className="overflow-hidden border-t border-white/5 pt-2.5"
                                        >
                                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5 flex justify-between">
                                            <span>{language === 'pl' ? 'Lista Słówek:' : 'Vocabulary List:'}</span>
                                            <span className="text-emerald-400 font-mono">{set.itemCount} {language === 'pl' ? 'pozycji' : 'items'}</span>
                                          </div>
                                          <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto custom-scrollbar p-1.5 bg-black/30 rounded-lg">
                                            {set.vocabularyText.split(/[\n,;]+/).map((item, idx) => {
                                              const cleanItem = item.trim();
                                              if (!cleanItem) return null;
                                              return (
                                                <span 
                                                  key={idx} 
                                                  className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-gray-200"
                                                >
                                                  {cleanItem}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                );
                              }) : (
                                <div className="text-center text-xs text-gray-400 py-4">
                                  {language === 'pl' ? 'Brak dostępnych lekcji' : 'No lessons available'}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* SECTION 2: TRYB ĆWICZENIA */}
                    <div className="space-y-3">
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                        {language === 'pl' ? 'Tryb ćwiczenia' : 'Exercise mode'}
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Card 1: Rozgrzewka */}
                        <div
                          onClick={() => setExerciseFormat('puzzle')}
                          className={`p-5 rounded-2xl border text-left transition-all duration-300 cursor-pointer relative ${
                            exerciseFormat === 'puzzle'
                              ? 'border-emerald-500/60 bg-gradient-to-br from-[#0e2722] via-[#102026] to-[#121b27] shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                              : 'border-white/10 bg-[#121824] hover:bg-[#17202e] hover:border-white/20'
                          }`}
                        >
                          {exerciseFormat === 'puzzle' && (
                            <div className="absolute top-4 right-4 flex items-center justify-center">
                              <span className="animate-ping absolute inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                            </div>
                          )}
                          <h4 className="text-base font-bold text-white mb-1">
                            {language === 'pl' ? 'Rozgrzewka' : 'Warmup'}
                          </h4>
                          <p className="text-xs text-gray-400 leading-relaxed font-normal pr-4">
                            {language === 'pl' 
                              ? 'Układaj rozrzucone słowa we właściwej kolejności.'
                              : 'Arrange scattered words in the correct order.'}
                          </p>
                        </div>

                        {/* Card 2: Prawdziwe Wyzwanie */}
                        <div
                          onClick={() => setExerciseFormat('typing')}
                          className={`p-5 rounded-2xl border text-left transition-all duration-300 cursor-pointer relative ${
                            exerciseFormat === 'typing'
                              ? 'border-emerald-500/60 bg-gradient-to-br from-[#0e2722] via-[#102026] to-[#121b27] shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                              : 'border-white/10 bg-[#121824] hover:bg-[#17202e] hover:border-white/20'
                          }`}
                        >
                          {exerciseFormat === 'typing' && (
                            <div className="absolute top-4 right-4 flex items-center justify-center">
                              <span className="animate-ping absolute inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                            </div>
                          )}
                          <h4 className="text-base font-bold text-white mb-1">
                            {language === 'pl' ? 'Prawdziwe Wyzwanie' : 'Real Challenge'}
                          </h4>
                          <p className="text-xs text-gray-400 leading-relaxed font-normal pr-4">
                            {language === 'pl' 
                              ? 'Wpisuj całe zdania z klawiatury. Weryfikacja błędów przez AI.'
                              : 'Type full sentences with keyboard. AI error verification.'}
                          </p>
                        </div>
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

                      <div className="bg-[#121824] border border-white/10 rounded-2xl p-5 space-y-4">
                        <input
                          type="range"
                          min="1"
                          max="20"
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
        <div className="max-w-2xl mx-auto space-y-4">
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
                <motion.div 
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
            <Card ref={practiceCardRef} className="liquid-glass-card p-5 md:p-6 space-y-4 relative overflow-hidden">
              {/* Background design accents */}
              <div className="absolute top-0 right-0 p-6 opacity-[0.02] pointer-events-none select-none">
                <Sparkles className="w-48 h-48 text-primary" />
              </div>

            <div className="space-y-3 relative z-10">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-mono font-bold">
                Zdanie {activeSentenceIndex + 1}
              </div>

              {/* Polish Sentence */}
              <div className="text-base sm:text-lg font-bold text-white tracking-tight leading-relaxed">
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
                    <div className="mt-1.5 bg-amber-500/[0.04] border border-amber-500/15 rounded-xl p-3 text-xs text-amber-400 animate-fade-in-up">
                      {exercises[activeSentenceIndex].hint}
                    </div>
                  )}
                </div>
              )}

              {/* Student answer field */}
              <div className="space-y-1 mt-4 pt-3.5 border-t border-white/5">
                <label className="block text-xs font-semibold text-content-muted/80 mb-1">
                  {language === 'pl' ? 'Twoje tłumaczenie na angielski:' : 'Your translation to English:'}
                </label>
                
                {evaluationStatuses[activeSentenceIndex] === 'evaluated' && singleEvaluationResults[activeSentenceIndex] ? (
                  <div className="space-y-3">
                    <div 
                      className="w-full bg-black/30 backdrop-blur-sm border border-white/10 shadow-inner rounded-xl p-3.5 text-sm"
                      dangerouslySetInnerHTML={{ __html: singleEvaluationResults[activeSentenceIndex].highlightedAnswer || singleEvaluationResults[activeSentenceIndex].studentAnswer }}
                    />
                    
                    <div className={`p-3.5 rounded-xl border ${singleEvaluationResults[activeSentenceIndex].isCorrect ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                       <div className="font-bold flex items-center gap-2 mb-3 text-sm">
                         {singleEvaluationResults[activeSentenceIndex].isCorrect ? '✅ Poprawnie!' : '❌ Błędy w tłumaczeniu'}
                       </div>
                       
                       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 liquid-glass-tile rounded-lg mb-3 border border-white/5">
                         <div className="font-medium text-primary/90 text-sm">
                           {singleEvaluationResults[activeSentenceIndex].correctTranslation}
                         </div>
                         <div className="flex items-center gap-1.5 shrink-0 bg-black/30 p-1 rounded-md">
                           <button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-US')} className={`text-lg hover:scale-110 transition-transform ${isPlayingAudio ? 'opacity-50' : ''}`} title="🇺🇸 Amerykański" disabled={isPlayingAudio}>🇺🇸</button>
                           <button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-GB')} className={`text-lg hover:scale-110 transition-transform ${isPlayingAudio ? 'opacity-50' : ''}`} title="🇬🇧 Brytyjski" disabled={isPlayingAudio}>🇬🇧</button>
                           <button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-AU')} className={`text-lg hover:scale-110 transition-transform ${isPlayingAudio ? 'opacity-50' : ''}`} title="🇦🇺 Australijski" disabled={isPlayingAudio}>🇦🇺</button>
                           <button onClick={() => playAudio(singleEvaluationResults[activeSentenceIndex].correctTranslation, 'en-SCT')} className={`text-lg hover:scale-110 transition-transform ${isPlayingAudio ? 'opacity-50' : ''}`} title="🏴󠁧󠁢󠁳󠁣󠁴󠁿 Szkocki" disabled={isPlayingAudio}>🏴󠁧󠁢󠁳󠁣󠁴󠁿</button>
                         </div>
                       </div>

                       <div className="space-y-3 mt-1 text-xs">
                         {singleEvaluationResults[activeSentenceIndex].feedbackSyntax && (
                           <div>
                             <span className="font-bold text-content-muted text-[10px] uppercase tracking-wider">{language === 'pl' ? 'Szyk i gramatyka' : 'Syntax & Grammar'}</span>
                             <p className="mt-0.5 opacity-90 leading-relaxed">{singleEvaluationResults[activeSentenceIndex].feedbackSyntax}</p>
                           </div>
                         )}
                         {singleEvaluationResults[activeSentenceIndex].feedbackVocab && (
                           <div>
                             <span className="font-bold text-content-muted text-[10px] uppercase tracking-wider">{language === 'pl' ? 'Słownictwo i naturalność' : 'Vocabulary & Naturalness'}</span>
                             <p className="mt-0.5 opacity-90 leading-relaxed">{singleEvaluationResults[activeSentenceIndex].feedbackVocab}</p>
                           </div>
                         )}
                         {singleEvaluationResults[activeSentenceIndex].feedbackRule && (
                           <div className="bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                             <span className="font-bold text-amber-500/90 text-[10px] uppercase tracking-wider">{language === 'pl' ? 'Złota zasada' : 'Golden Rule'}</span>
                             <p className="mt-0.5 opacity-90 leading-relaxed">{singleEvaluationResults[activeSentenceIndex].feedbackRule}</p>
                           </div>
                         )}
                         {(!singleEvaluationResults[activeSentenceIndex].feedbackSyntax && !singleEvaluationResults[activeSentenceIndex].feedbackVocab) && (
                           <p className="whitespace-pre-wrap opacity-90 leading-relaxed text-xs">{singleEvaluationResults[activeSentenceIndex].explanation}</p>
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
                    className="w-full bg-black/30 backdrop-blur-sm border border-white/10 shadow-inner focus:border-primary/40 focus:ring-1 focus:ring-primary/20 rounded-xl p-3 text-sm outline-none transition-all duration-200"
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
              
              {exerciseFormat === 'puzzle' ? (
                <>
                  {activeSentenceIndex === exercises.length - 1 && practiceMode === 'fixed' ? (
                    <AILoadingButton
                      onClick={handleFinishAll}
                      disabled={studentAnswers[activeSentenceIndex] !== exercises[activeSentenceIndex].englishTranslation}
                      className="px-6 py-3 bg-primary hover:bg-primary/95 text-black font-extrabold"
                    >
                      {language === 'pl' ? 'Zakończ rozgrzewkę' : 'Finish warmup'}
                    </AILoadingButton>
                  ) : (
                    <AILoadingButton
                      onClick={handleNext}
                      disabled={studentAnswers[activeSentenceIndex] !== exercises[activeSentenceIndex].englishTranslation || isGeneratingMore}
                      isLoading={isGeneratingMore && activeSentenceIndex === exercises.length - 1}
                      loadingText={language === 'pl' ? 'Ładowanie ćwiczenia...' : 'Loading exercise...'}
                      className="px-6 py-3 bg-primary hover:bg-primary/95 text-black font-extrabold"
                    >
                      {language === 'pl' ? 'Następne' : 'Next'}
                    </AILoadingButton>
                  )}
                </>
              ) : evaluationStatuses[activeSentenceIndex] !== 'evaluated' ? (
                <div className="flex gap-2">
                  <AILoadingButton
                    onClick={handleEvaluateSingle}
                    disabled={!studentAnswers[activeSentenceIndex]?.trim()}
                    isLoading={evaluationStatuses[activeSentenceIndex] === 'evaluating'}
                    loadingText={language === 'pl' ? 'Sprawdzanie...' : 'Checking...'}
                    className="px-6 py-3 bg-base-300 hover:bg-base-300/80 text-white font-bold"
                  >
                    {language === 'pl' ? 'Sprawdź aktualne' : 'Check current'}
                  </AILoadingButton>

                  {activeSentenceIndex === exercises.length - 1 && practiceMode === 'fixed' ? (
                    <AILoadingButton
                      onClick={handleFinishAll}
                      disabled={!studentAnswers[activeSentenceIndex]?.trim() || isGeneratingMore}
                      isLoading={isGeneratingMore}
                      loadingText={language === 'pl' ? 'Ocenianie...' : 'Evaluating...'}
                      className="px-6 py-3 bg-primary hover:bg-primary/95 text-black font-extrabold"
                    >
                      {language === 'pl' ? 'Zakończ i podsumuj' : 'Finish & Summarize'}
                    </AILoadingButton>
                  ) : (
                    <AILoadingButton
                      onClick={handleNext}
                      disabled={!studentAnswers[activeSentenceIndex]?.trim() || isGeneratingMore}
                      isLoading={isGeneratingMore && activeSentenceIndex === exercises.length - 1}
                      loadingText={language === 'pl' ? 'Ładowanie...' : 'Loading...'}
                      className="px-6 py-3 bg-primary hover:bg-primary/95 text-black font-extrabold"
                    >
                      {language === 'pl' ? 'Następne' : 'Next'}
                    </AILoadingButton>
                  )}
                </div>
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
                      className="px-6 py-3 bg-primary hover:bg-primary/95 text-black font-extrabold"
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
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-black/30 rounded text-xs font-mono text-content-muted">
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
                        <div className="text-sm p-2.5 bg-primary/[0.02] border border-primary/10 text-primary-light rounded-lg font-medium">
                          {res.correctTranslation}
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
