import React, { useState, useEffect, useRef, useMemo } from 'react';
import gsap from 'gsap';
import html2pdf from 'html2pdf.js';
import { useLanguage } from '../../context/LanguageContext';
import { useFlashcards } from '../../context/FlashcardContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { collection, getDocs, query, orderBy, limit, addDoc, where, documentId, doc, updateDoc, setDoc, writeBatch, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { getDoc } from 'firebase/firestore';
import { generateTranslationExercises, evaluateTranslations, getUserWeaknesses, logMistakesToFirebase, formatAIModelName } from '../../services/geminiService';
import { HOMEWORK_GENERATION_MODELS } from '../../services/aiModels';
import { generateSpeech, createSpeechAudio, formatTextForTTS, playSpeech } from '../../services/ttsService';
import TTSButtons from '../flashcards/TTSButtons';
import { useSentenceSession } from '../../hooks/useSentenceSession';
import { sentenceToCopy, stampExercises } from '../../utils/sentenceSession';
import { describeEnterTarget, enterKeyAction, isCoarsePointer } from '../../utils/enterKeyAction';
import { TranslationExercise, TranslationEvaluationResult, FlashcardSet, LessonRecord, VocabularySet, PracticeLog, canUserViewAiMonitor } from '../../types';
import { isStudentTodoStatus, isV1Task, studentTasksQuery } from '../../utils/homework';
import { getApprovedVocabularyText } from '../../utils/vocabulary';
import { recordExerciseResults, getStudentAiContext } from '../../services/learningProfile';
import { normalizeLevel } from '../../utils/learningCurve';
import { shouldMarkTaskSubmitted, specialTaskIdFrom } from '../../utils/specialTaskSubmission';
import { FreePracticeApiError, freePracticeErrorKey, requestFreeSentences } from '../../services/freePracticeApi';
import { resolveFreeScopeWords, type LessonLike } from '../../utils/freeSentenceScope';
import type { FreeSentencesLaunch } from '../../utils/freePractice';

export interface CachedExerciseSet {
  id: string;
  timestamp: string;
  sourceId: string;
  sourceTitle: string;
  level: string;
  numSentences: number;
  exercises: TranslationExercise[];
  createdAt: number;
}
import { getVocabularySetsForStudent, markVocabularySetAsUsed } from '../../services/lessonRecord';
import { GENERAL_VOCABULARY_SETS, LEVEL_GROUPS } from '../../data/generalVocabulary';
import { generateFindErrors } from '../../services/homeworkGenerator';
import { animateDropletTransition } from '../../services/gsapAnimations';
import HomeworkWarmupScrambler from './HomeworkWarmupScrambler';
import Card from '../ui/Card';
import GeneratingAnimation from '../ui/GeneratingAnimation';
import MotivationStatLine from '../ui/MotivationStatLine';
import { buildMotivationItems, computeMotivationCounts, mergeMotivationCounts, type PracticeLogLike } from '../../utils/motivationStats';
import { getMotivationCounts } from '../../utils/motivationStatsCache';
import Toast, { useToast } from '../ui/Toast';
import PuzzleExercise from './PuzzleExercise';
import { SentenceActionBar, SentenceAnswerInput, SentencePromptCard } from '../practice/SentencePracticeParts';
import { SentenceFeedbackPanel, SentenceResultCard } from '../practice/SentenceFeedback';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import { motion, AnimatePresence } from 'motion/react';
import { useEscapeModal } from '../../hooks/useEscapeModal';
import {    
  Sparkles, 
  Settings, 
  BookOpen, 
  Award, 
  Lightbulb, 
  CheckCircle, 
  Wrench,
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
  Shuffle, X, Eye, Globe, History, Database, Lock,
  CheckCircle2, LayoutGrid, Mic, AlertCircle,
  Plus, Minus, ShoppingBag, Trash2, Check, Edit3
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
- ZASADA ŻELAZNA - LOGIKA I KONTEKST (IRONCLAD RULE): Zdania MUSZĄ być w 100% logiczne, sensowne, naturalne i przedstawiać prawdziwy, życiowy kontekst. ZABRANIA SIĘ generowania zdań bezsensownych, dziwacznych lub sztucznie ukierunkowanych tylko na przetestowanie słówka. Cel to nauka poprawnego, autentycznego kontekstu i użycia języka w życiu.
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

ZASADA INTERPUNKCJI (PUNCTUATION RULE):
Interpunkcja (kropka na końcu zdania, przecinki, pytajniki, wielkie litery) jest potrzebna i zalecana, ALE NIE SŁUŻY DO ODEJMOWANIA PUNKTÓW. BEZWZGLĘDNIE ZABRANIA SIĘ odejmowania punktów lub obniżania oceny za brak lub błędy interpunkcyjne / brak wielkiej litery.

GRADING RUBRIC (Total Score: 100%):
1. Meaning & Accuracy (40%): Does the translation convey the exact intended meaning? Accept valid synonyms and natural reformulations! (Max 40 points)
2. Grammar & Syntax (40%): Are tenses, word order, prepositions, and articles correct? (Max 40 points)
3. Target Vocabulary & Spelling (20%): Is the key vocabulary used correctly and spelled properly? (Max 20 points)

[HISTORYCZNE BŁĘDY KURSANTA]
Zwróć dodatkową uwagę na te błędy kursanta, jeśli wystąpią: \${weaknessesList || "Brak zidentyfikowanych błędów"}`;

import { ExerciseType } from '../../types';
import i18n from "i18next";

const playSliderSound = () => {};

function getPolishVocative(name: string): string {
  if (!name) return '';
  const cleanName = name.trim();
  const lower = cleanName.toLowerCase();

  const commonMap: Record<string, string> = {
    'maciej': 'Macieju',
    'piotr': 'Piotrze',
    'tomasz': 'Tomaszu',
    'tomek': 'Tomku',
    'jan': 'Janie',
    'michał': 'Michale',
    'michal': 'Michale',
    'marek': 'Marku',
    'paweł': 'Pawle',
    'pawel': 'Pawle',
    'adam': 'Adamie',
    'krzysztof': 'Krzysztofie',
    'krzysiek': 'Krzyśku',
    'aleksander': 'Aleksandrze',
    'aleks': 'Aleksie',
    'bartek': 'Bartku',
    'bartłomiej': 'Bartłomieju',
    'kamil': 'Kamilu',
    'filip': 'Filipie',
    'wiktor': 'Wiktorze',
    'marcin': 'Marcinie',
    'kuba': 'Kubu',
    'jakub': 'Jakubie',
    'łukasz': 'Łukaszu',
    'lukasz': 'Łukaszu',
    'mateusz': 'Mateuszu',
    'wojciech': 'Wojciechu',
    'wojtek': 'Wojtku',
    'kacper': 'Kacprze',
    'szymon': 'Szymonie',
    'daniel': 'Danielu',
    'dawid': 'Dawidzie',
    'dominik': 'Dominiku',
    'grzegorz': 'Grzegorzu',
    'hubert': 'Hubercie',
    'igor': 'Igorze',
    'konrad': 'Konradzie',
    'patryk': 'Patryku',
    'rafał': 'Rafale',
    'rafal': 'Rafale',
    'robert': 'Robercie',
    'sebastian': 'Sebastianie',
    'stanisław': 'Stanisławie',
    'staszek': 'Staszku',
    'artur': 'Arturze',
    'arkadiusz': 'Arkadiuszu',
    'arek': 'Arku',
    'andrzej': 'Andrzeju',
    'damian': 'Damianie',
    'mariusz': 'Mariuszu',
    'dariusz': 'Dariuszu',
    'darek': 'Darku',
    'jacek': 'Jacku',
    'przemysław': 'Przemysławie',
    'przemek': 'Przemku',
    'radosław': 'Radosławie',
    'radek': 'Radku',
    'anna': 'Aniu',
    'ania': 'Aniu',
    'maria': 'Mario',
    'katarzyna': 'Kasiu',
    'kasia': 'Kasiu',
    'aleksandra': 'Ola',
    'ola': 'Olu',
    'maja': 'Maju',
    'zofia': 'Zosiu',
    'zosia': 'Zosiu',
    'natalia': 'Natalio',
    'karolina': 'Karolino',
    'wiktoria': 'Wiktorio',
    'julia': 'Julio',
    'jula': 'Julu',
    'martyna': 'Martyno',
    'monika': 'Moniko',
    'patrycja': 'Pati',
    'magdalena': 'Magdo',
    'magda': 'Magdo',
    'agnieszka': 'Agnieszko',
    'aga': 'Aguś',
    'joanna': 'Joasiu',
    'asia': 'Asiu',
    'ewa': 'Ewo',
    'dominika': 'Dominiko',
    'paulina': 'Paulino',
    'justyna': 'Justyno',
    'kinga': 'Kingo',
    'emilia': 'Emilio',
    'klaudia': 'Klaudio',
    'weronika': 'Weroniko',
    'izabela': 'Izo',
    'iza': 'Izo',
    'beata': 'Beato',
    'dorota': 'Doroto',
    'marta': 'Marto',
    'agata': 'Agato',
    'sylwia': 'Sylwio',
    'kamila': 'Kamilo',
    'milena': 'Mileno',
    'żaneta': 'Żaneto'
  };

  if (commonMap[lower]) {
    return commonMap[lower];
  }

  if (cleanName.endsWith('a') || cleanName.endsWith('A')) {
    return cleanName.slice(0, -1) + 'o';
  }
  if (cleanName.endsWith('ek')) {
    return cleanName.slice(0, -2) + 'ku';
  }

  return cleanName;
}



const AILoadingButton = ({ isLoading, onClick, children, className, disabled, loadingText, variant = 'primary' }: any) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading || disabled}
      className={`relative overflow-hidden pointer-coarse:min-h-11 ${className} ${
        variant === 'primary' 
          ? 'bg-primary text-accent-ink hover:bg-primary/95' 
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
  autoGenerate?: boolean;
  onStartPractice?: (type: any, mode1?: boolean, mode2?: boolean) => void;
  onExerciseStateChange?: (active: boolean) => void;
  onChangeView?: (view: string, extra?: any) => void;
  onShowOnboarding?: () => void;
  /**
   * `free` = „Ćwiczenia dowolne": zakres i format przychodzą z menu (`freeLaunch`), ekran ustawień
   * generatora się nie pokazuje, a nic tu nie czyta ani nie zapisuje zadań lektora (`specialTasks`).
   * Brak = dotychczasowe zachowanie generatora (lektor).
   */
  mode?: 'free';
  freeLaunch?: FreeSentencesLaunch;
  /** Lekcje kursanta wczytane przez menu — dzięki temu start nie czeka na własne pobranie generatora. */
  freeLessons?: ReadonlyArray<LessonLike>;
  /** Powrót do menu Ćwiczeń dowolnych (zamiast ekranu ustawień generatora). */
  onExitFree?: () => void;
}

/** Sztuczne `selectedSetId` w trybie `free` — zakres bierze się z `freeLaunch`, nie z listy generatora. */
const FREE_SCOPE_ID = 'free-scope';

const AIExerciseGeneratorScreen: React.FC<AIExerciseGeneratorScreenProps> = ({ initialSetId = null, autoGenerate = false, onStartPractice, onExerciseStateChange, onOpenSidebar, onChangeView, onShowOnboarding, mode, freeLaunch, freeLessons, onExitFree }) => {
  const isFree = mode === 'free';
  const { language } = useLanguage();
  const { sets, getFlashcards, sessions: flashcardSessions } = useFlashcards();
  // Logi do statystyk motywacyjnych: z odczytu practiceLogs, który ten ekran i tak robi przy wejściu (bez nowych odczytów).
  const [statLogs, setStatLogs] = useState<PracticeLogLike[] | null>(null);
  const { user, updateUserStreak } = useAuth();
  const { soundSettings } = useSettings();
  const isTeacher = user?.role === 'admin' || user?.role === 'teacher';
  const canViewAiModels = canUserViewAiMonitor(user);
  // Licznik trzymany dla zapisów po ćwiczeniu (nie jest już wyświetlany — patrz statystyki motywacyjne).
  const [translatedSentencesCount, setTranslatedSentencesCount] = useState<number>(user?.translatedSentencesCount || 0);

  useEffect(() => {
    if (user?.translatedSentencesCount !== undefined) {
      setTranslatedSentencesCount(user.translatedSentencesCount);
    }
  }, [user?.translatedSentencesCount]);
  // Per-user Vocabulary Basket & Exercise Cache Keys
  const userBasketKey = user?.id ? `ai_vocab_basket_${user.id}` : 'ai_vocab_basket_guest';
  const userCacheKey = user?.id ? `ai_exercise_cache_${user.id}` : 'ai_exercise_cache_guest';

  const [basketWords, setBasketWords] = useState<BasketWordItem[]>([]);
  const [cachedExercises, setCachedExercises] = useState<CachedExerciseSet[]>([]);
  const [isCacheModalOpen, setIsCacheModalOpen] = useState<boolean>(false);

  // Vocabulary Accordion States (Collapsed by default)
  const [isMyLessonsOpen, setIsMyLessonsOpen] = useState<boolean>(false);
  const [isGeneralVocabTabOpen, setIsGeneralVocabTabOpen] = useState<boolean>(false);
  const [expandedGenLevelGroup, setExpandedGenLevelGroup] = useState<string | null>(null);

  const [isBasketModalOpen, setIsBasketModalOpen] = useState(false);

  // Sync basket and cache per user profile
  useEffect(() => {
    try {
      let savedBasket = localStorage.getItem(userBasketKey);
      if (!savedBasket && user?.id) {
        // Legacy fallback migration
        const legacy = localStorage.getItem('ai_vocab_basket');
        if (legacy) {
          savedBasket = legacy;
          localStorage.setItem(userBasketKey, legacy);
        }
      }
      setBasketWords(savedBasket ? JSON.parse(savedBasket) : []);
    } catch {
      setBasketWords([]);
    }

    try {
      const savedCache = localStorage.getItem(userCacheKey);
      setCachedExercises(savedCache ? JSON.parse(savedCache) : []);
    } catch {
      setCachedExercises([]);
    }
  }, [user?.id, userBasketKey, userCacheKey]);

  // Persist basket
  useEffect(() => {
    if (!userBasketKey) return;
    try {
      localStorage.setItem(userBasketKey, JSON.stringify(basketWords));
    } catch (e) {
      console.error(e);
    }
  }, [basketWords, userBasketKey]);

  // Persist cache
  useEffect(() => {
    if (!userCacheKey) return;
    try {
      localStorage.setItem(userCacheKey, JSON.stringify(cachedExercises));
    } catch (e) {
      console.error(e);
    }
  }, [cachedExercises, userCacheKey]);

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
      showToast(language === 'pl' ? 'Koszyk jest pusty — dodaj słówka przyciskiem +' : 'Basket is empty — add words with +', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      const setId = await syncBasketToFirestoreSet(basketWords);
      if (setId && onChangeView) {
        onChangeView('flashcard-study', { 
          setId: setId, 
          initialMode: type === 'match' ? 'matching' : type 
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
      getDocs(collection(db, `users/${user.id}/practiceLogs`)).then(snapshot => {
        setStatLogs(snapshot.docs.map(d => d.data() as PracticeLogLike));
        let total = 0;
        const dateSet = new Set<string>();

        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.exerciseType === 'Aktywność') return;

          if (data.date) {
            const dateStr = typeof data.date === 'string' ? data.date : (data.date.toDate ? data.date.toDate().toISOString() : '');
            if (dateStr) {
              dateSet.add(dateStr.slice(0, 10));
            }
          }

          if (data.totalWords !== undefined && data.totalWords !== null && !isNaN(Number(data.totalWords))) {
            total += Number(data.totalWords);
          } else if (data.detailedFeedback && Array.isArray(data.detailedFeedback)) {
            total += data.detailedFeedback.length;
          } else if (data.exercisesData) {
            if (Array.isArray(data.exercisesData)) {
              total += data.exercisesData.length;
            } else if (typeof data.exercisesData === 'string' && data.exercisesData.includes(' | ')) {
              total += data.exercisesData.split(' | ').length;
            } else {
              total += 1;
            }
          } else {
            total += 1;
          }
        });

        const maxTotal = Math.max(total, user?.translatedSentencesCount || 0);
        setTranslatedSentencesCount(maxTotal);

        // Compute active streak from practice dates
        const getLocalDateStr = (d: Date) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        const todayKey = getLocalDateStr(new Date());
        const yesterdayKey = getLocalDateStr(new Date(Date.now() - 86400000));
        let calculatedStreak = 0;

        let checkDateMs: number | null = null;
        if (dateSet.has(todayKey)) {
          checkDateMs = new Date().setHours(0, 0, 0, 0);
        } else if (dateSet.has(yesterdayKey)) {
          checkDateMs = new Date(Date.now() - 86400000).setHours(0, 0, 0, 0);
        }

        if (checkDateMs !== null) {
          const checkDate = new Date(checkDateMs);
          while (true) {
            const key = getLocalDateStr(checkDate);
            if (dateSet.has(key)) {
              calculatedStreak++;
              checkDate.setDate(checkDate.getDate() - 1);
            } else {
              break;
            }
          }
        }

        const updatesToUser: any = {};
        if (user.translatedSentencesCount !== maxTotal) {
          updatesToUser.translatedSentencesCount = maxTotal;
        }
        if (calculatedStreak > (user.streakCount || 0)) {
          updatesToUser.streakCount = calculatedStreak;
          updatesToUser.lastStreakDate = todayKey;
        }

        if (Object.keys(updatesToUser).length > 0) {
          updateDoc(doc(db, 'users', user.id), updatesToUser).catch(console.error);
        }
      }).catch(() => {
        // Bez logów nie ma statystyk motywacyjnych z tego odczytu — ekran działa dalej (linia zachęty).
        setStatLogs([]);
        if (typeof user?.translatedSentencesCount === 'number') {
          setTranslatedSentencesCount(user.translatedSentencesCount);
        }
      });
    } else {
      setStatLogs([]);
      try {
        const stored = localStorage.getItem(`user_translated_count_${user?.id || 'demo'}`);
        if (stored !== null) {
          setTranslatedSentencesCount(Number(stored) || 0);
        } else if (typeof user?.translatedSentencesCount === 'number') {
          setTranslatedSentencesCount(user.translatedSentencesCount);
        }
      } catch (e) {}
    }
  }, [user?.id, user?.translatedSentencesCount, user?.streakCount]);

  const motivationItems = useMemo(
    () =>
      buildMotivationItems(
        mergeMotivationCounts(
          getMotivationCounts(user?.id),
          statLogs ? computeMotivationCounts({ logs: statLogs, sessions: flashcardSessions }) : null
        )
      ),
    [user?.id, statLogs, flashcardSessions]
  );

  // Settings states
  const [activeTab, setActiveTab] = useState<'ai' | 'other'>('ai');
  const [selectedSetId, setSelectedSetId] = useState<string>(isFree ? FREE_SCOPE_ID : 'all');
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>(() => (isFree && freeLaunch ? [...freeLaunch.lessonIds] : []));
  const { toast, showToast, dismissToast } = useToast();
  /** Reset promptów potwierdzony pierwszym dotknięciem. */
  const [confirmResetPrompts, setConfirmResetPrompts] = useState(false);
  const [level, setLevel] = useState<string>(user?.level || 'B1');
  const [numSentences, setNumSentences] = useState<number>(5);
  const [practiceMode, setPracticeMode] = useState<'fixed' | 'time'>('fixed');
  // „Sprawdź Się" (wpisywanie z pamięci) jest domyślne, bo to aktywne
  // przypomnienie sobie. Dostępne są 4 formaty: Sprawdź Się (tłumaczenia),
  // Napraw Zdanie (korekta błędów), Fiszki oraz Dopasowanie.
  const [exerciseFormat, setExerciseFormat] = useState<'typing' | 'puzzle' | 'test' | 'speaking' | 'correction'>(isFree && freeLaunch ? freeLaunch.format : 'typing');
  // Zdania, które kursant już dostał na tym ekranie. „Generuj kolejne zdania"
  // czyści listę ćwiczeń, więc bez tej pamięci model przy tym samym
  // słownictwie wracał do tych samych zdań.
  const usedSentencesRef = useRef<string[]>([]);
  const [warmupPhase, setWarmupPhase] = useState<'invite' | 'scrambler' | 'exercises'>('invite');
  const [isLessonSelectorOpen, setIsLessonSelectorOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
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

  
  useEffect(() => {
    if (initialSetId) {
      setSelectedSetId(initialSetId);
      if (initialSetId.startsWith('lesson_') || initialSetId.startsWith('vocab-')) {
        const cleanId = initialSetId.replace(/^(lesson_|vocab-|set-)/, '');
        setSelectedLessonIds([cleanId]);
      }
    }
  }, [initialSetId]);


  // Tryb `free`: zakres i format już znamy z menu — generujemy od razu po zamontowaniu.
  const hasFreeStarted = useRef(false);
  useEffect(() => {
    if (!isFree || !freeLaunch || hasFreeStarted.current) return;
    hasFreeStarted.current = true;
    handleGenerate();
  }, []);

  const [hasAutoGenerated, setHasAutoGenerated] = useState(false);
  useEffect(() => {
    if (autoGenerate && !hasAutoGenerated && selectedSetId) {
       // Wait a tiny bit for states to settle
       setTimeout(() => {
          handleGenerate();
          setHasAutoGenerated(true);
       }, 100);
    }
  }, [autoGenerate, hasAutoGenerated, selectedSetId]);


  // App states
  const [exercises, setExercises] = useState<TranslationExercise[]>([]);
  /**
   * Odpowiedzi, wskazówki, statusy sprawdzania i wyniki zdań — PO ID ZADANIA (nie po indeksie).
   * Nowa runda zdań dostaje nowe id, więc nie dziedziczy odpowiedzi ani oceny z poprzedniej.
   * Reszta ekranu czyta je dalej po indeksie zdania przez te widoki.
   */
  const sentences = useSentenceSession<TranslationEvaluationResult>(exercises);
  const studentAnswers = sentences.answers;
  const showHints = sentences.hints;
  const evaluationStatuses = sentences.statuses;
  const singleEvaluationResults = sentences.results;
  const [evaluationResults, setEvaluationResults] = useState<TranslationEvaluationResult[]>([]);
  /**
   * Nieudane próby z rzędu w trybie wpisywania.
   *
   * Po dwóch kursant dostaje propozycję przejścia na Układankę — rusztowanie
   * podsuwa gotowe klocki, więc pomaga wyjść z zacięcia, ale właśnie dlatego
   * nie jest równorzędnym trybem do wyboru na starcie. Licznik zeruje się przy
   * pierwszej poprawnej odpowiedzi: chodzi o zacięcie tu i teraz, a nie
   * o sumę pomyłek w całej sesji.
   */
  const [consecutiveMisses, setConsecutiveMisses] = useState(0);
  /**
   * Indeks zdania, dla którego kursant przyjął podpowiedź z Układanką.
   *
   * Przejście na klocki jest wycieczką w obrębie sesji wpisywania, a nie zmianą
   * jej charakteru. Bez tego znacznika reszta sesji zostałaby w trybie
   * układanki, a jej podsumowanie zapisałoby się jako komplet punktów —
   * bo gałąź „puzzle" w handleFinishAll z założenia liczy 100%.
   */
  const [puzzleHintIndex, setPuzzleHintIndex] = useState<number | null>(null);
  const [selectedVoiceLang, setSelectedVoiceLang] = useState<string>('en-US');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [grammarChapters, setGrammarChapters] = useState<any[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  
  // Loading & error states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [activeGeneratingModel, setActiveGeneratingModel] = useState<string>('openai/gpt-5.6-luna');
  const [lastUsedWords, setLastUsedWords] = useState<string[]>([]);
  // Tryb `free`: dzienny limit generowań wyczerpany (liczba i chwila odnowienia z serwera).
  const [freeLimit, setFreeLimit] = useState<{ limit?: number; resetsAt?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<string>('');
  const addLog = (msg: string) => { console.log(msg); setDebugLogs(prev => prev + "\n" + msg); };
  
  // UI states
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);

  const handlePlaySentenceAudio = async (text: string, lang: string, index: number) => {
    if (!text) return;
    setPlayingAudioIndex(index);
    try {
      await playSpeech(text, {
        accent: lang || soundSettings?.ttsAccent || 'en-US',
        gender: soundSettings?.voiceGender || 'male',
        speed: soundSettings?.voiceSpeed || 1.0,
        engine: soundSettings?.soundEngine || 'auto'
      });
    } catch (err) {
      console.warn("Sentence audio play error:", err);
    } finally {
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
  const [vocabularySets, setVocabularySets] = useState<VocabularySet[]>(() => (isFree && freeLessons ? ([...freeLessons] as VocabularySet[]) : []));

  /**
   * Odmiana „lekcja" przez liczbę. Odkąd domyślnie zaznaczona jest jedna
   * ostatnia lekcja, „1 wybranych lekcji" widzi każdy kursant przy wejściu.
   */
  const lessonsLabel = (count: number): string => {
    if (language !== 'pl') return `${count} selected lesson${count === 1 ? '' : 's'}`;
    if (count === 1) return '1 wybrana lekcja';
    const last = count % 10;
    const lastTwo = count % 100;
    const few = last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14);
    return `${count} ${few ? 'wybrane lekcje' : 'wybranych lekcji'}`;
  };

  /**
   * Domyślnym źródłem jest ostatnia lekcja, nie ogólny miks.
   *
   * Materiał do powtórki ma pochodzić z konkretnych zajęć — otwarty generator
   * („Słownictwo ogólne: miks i koszyk") zostaje opcją dodatkową. Ustawiamy to
   * dopiero, gdy lekcje się wczytają, bo wcześniej nie ma czego wybrać, i tylko
   * raz: późniejsza zmiana przez kursanta ma zostać.
   *
   * `vocabularySets` przychodzi posortowane od najnowszej lekcji, stąd indeks 0.
   */
  const lessonPreselected = useRef(false);
  useEffect(() => {
    if (lessonPreselected.current) return;
    if (initialSetId) return;
    if (vocabularySets.length === 0) return;
    if (selectedSetId !== 'all' || selectedLessonIds.length > 0) return;

    lessonPreselected.current = true;
    setSelectedSetId('lessons');
    setSelectedLessonIds([vocabularySets[0].id]);
  }, [vocabularySets, initialSetId, selectedSetId, selectedLessonIds.length]);

  // Practice Setup Modal states
  const [practiceSetupOpen, setPracticeSetupOpen] = useState(false);
  const [practiceSetupType, setPracticeSetupType] = useState<'flashcards' | 'match' | 'quiz' | 'intro' | 'fill-in-the-blank' | null>(null);
  const [setupSelectedSource, setSetupSelectedSource] = useState<string>(''); // 'basket' or lesson set ID
  const [setupWords, setSetupWords] = useState<BasketWordItem[]>([]);
  const [setupCheckedWordIds, setSetupCheckedWordIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!practiceSetupOpen || !setupSelectedSource) return;

    let wordsList: BasketWordItem[] = [];
    if (setupSelectedSource === 'basket') {
      wordsList = basketWords;
    } else {
      const cleanSource = setupSelectedSource.replace(/^vocab-/, '').replace(/^set-/, '').replace(/^generated-/, '');
      const genSet = GENERAL_VOCABULARY_SETS.find(s => 
        s.id === setupSelectedSource || 
        s.id === cleanSource || 
        `gen-${s.id}` === setupSelectedSource || 
        s.id === `gen-${cleanSource}`
      );
      if (genSet) {
        wordsList = genSet.words.map(w => ({
          id: w.id,
          term: w.english,
          definition: w.polish,
          setTopic: genSet.title
        }));
      } else {
        const selectedSet = vocabularySets.find(s => 
          s.id === setupSelectedSource || 
          s.id === cleanSource || 
          s.id === `generated-${cleanSource}` || 
          s.lessonRecordId === cleanSource ||
          s.lessonRecordId === setupSelectedSource
        );
        if (selectedSet) {
          if (selectedSet.vocabularyText) {
            // Zatwierdzone po lekcji, nie cały wklej — patrz utils/vocabulary.ts.
            wordsList = getApprovedVocabularyText(selectedSet)
              // Split on newlines/semicolons, or on a comma only when it's followed
              // by a real "term — translation" pair (so synonym commas inside a
              // single definition, e.g. "creek — mała rzeka, strumień", survive intact).
              .split(/[\n;]+|,\s*(?=[^,]*\s[-–—]\s)/)
              .map(line => line.trim())
              .filter(line => line.length > 0)
              .map(line => parseLineToWordItem(line, selectedSet.topic));
          } else if ((selectedSet as any).words && Array.isArray((selectedSet as any).words)) {
            wordsList = (selectedSet as any).words.map((w: any, idx: number) => ({
              id: w.id || `word_${idx}`,
              term: w.term || w.english || w.word || '',
              definition: w.definition || w.polish || w.translation || '',
              setTopic: selectedSet.topic
            }));
          }
        }
      }
    }

    setSetupWords(wordsList);
    // By default, check all words
    setSetupCheckedWordIds(new Set(wordsList.map(w => w.id)));
  }, [setupSelectedSource, practiceSetupOpen, basketWords, vocabularySets]);

  useEscapeModal(isConfigModalOpen, () => setIsConfigModalOpen(false), 0);
  useEscapeModal(isLessonSelectorOpen, () => setIsLessonSelectorOpen(false), 0);
  useEscapeModal(isTopicModalOpen, () => setIsTopicModalOpen(false), 0);
  useEscapeModal(!!previewVocabSet, () => setPreviewVocabSet(null), 5);
  useEscapeModal(practiceSetupOpen, () => setPracticeSetupOpen(false), 5);
  useEscapeModal(isBasketModalOpen, () => setIsBasketModalOpen(false), 5);

  const [specialTasks, setSpecialTasks] = useState<any[]>([]);
  const [isLessonsExpanded, setIsLessonsExpanded] = useState<boolean>(false);
  const [isCustomSetsExpanded, setIsCustomSetsExpanded] = useState<boolean>(false);
  const [previewedSetId, setPreviewedSetId] = useState<string | null>(null);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const practiceCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (practiceCardRef.current && step === 'practice' && warmupPhase === 'exercises') {
      animateDropletTransition(practiceCardRef.current, 'next');
    }
  }, [activeSentenceIndex, step, warmupPhase]);

  useEffect(() => {
    if (numSentencesRef.current) {
      const targetScale = 0.7 + (numSentences / 20) * 0.8;
      gsap.fromTo(numSentencesRef.current, 
        { scale: targetScale * 1.5, color: 'var(--text-hi)' }, 
        { scale: targetScale, color: 'var(--accent)', duration: 0.5, ease: 'back.out(2)' }
      );
    }
  }, [numSentences]);

  useEffect(() => {
    if (timeLimitRef.current) {
      const targetScale = 0.7 + (timeLimit / 20) * 0.8;
      gsap.fromTo(timeLimitRef.current, 
        { scale: targetScale * 1.5, color: 'var(--text-hi)' }, 
        { scale: targetScale, color: 'var(--accent)', duration: 0.5, ease: 'back.out(2)' }
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
    if (!user?.id) return;

    getVocabularySetsForStudent(user.id)
      .then(setVocabularySets)
      .catch(console.error);

    // Tryb `free` nie zna zadań lektora — ani nasłuchu, ani odczytu.
    if (isFree) return;

    // Real-time special tasks listener
    const unsub = onSnapshot(studentTasksQuery(user.id), (snap) => {
      // Zadania silnika v2 pomijamy — ten widok renderuje wyłącznie typy v1.
      const tasks: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(isV1Task);
      const getMillis = (val: any) => {
        if (!val) return 0;
        if (typeof val.toMillis === 'function') return val.toMillis();
        if (val.seconds !== undefined) return val.seconds * 1000;
        if (typeof val === 'string' || typeof val === 'number') {
          const t = new Date(val).getTime();
          return isNaN(t) ? 0 : t;
        }
        return 0;
      };
      tasks.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
      setSpecialTasks(tasks.filter(t => isStudentTodoStatus(t.status)));
    }, (err) => {
      console.error("Error loading specialTasks in real-time for student:", err);
    });

    return () => {
      unsub();
    };
  }, [user?.id, user?.username, user?.email, user?.firstName, user?.lastName]);

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
    showToast(language === 'pl' ? 'Prompty zapisane' : 'Prompts saved', 'success');
  };

  /**
   * Reset promptów kasuje własne ustawienia, więc pyta — ale nie oknem
   * systemowym: pierwsze dotknięcie ostrzega, drugie wykonuje.
   */
  const handleResetPrompts = () => {
    if (!confirmResetPrompts) {
      showToast(
        language === 'pl'
          ? 'To przywróci domyślne prompty i skasuje Twoje. Dotknij jeszcze raz, żeby potwierdzić.'
          : 'This restores the default prompts and discards yours. Tap again to confirm.',
        'warning'
      );
      setConfirmResetPrompts(true);
      return;
    }
    setCustomGenPrompt(DEFAULT_GENERATION_PROMPT);
    setCustomEvalPrompt(DEFAULT_EVALUATION_PROMPT);
    (function(){ try { localStorage.removeItem('ai_custom_gen_prompt'); } catch(e) {} })();
    (function(){ try { localStorage.removeItem('ai_custom_eval_prompt'); } catch(e) {} })();
    setConfirmResetPrompts(false);
    showToast(language === 'pl' ? 'Przywrócono domyślne prompty' : 'Default prompts restored', 'success');
  };

  const syncWordsToFirestoreSet = async (items: BasketWordItem[], title: string) => {
    if (!user?.id || items.length === 0) return null;
    const setId = `set-custom-practice-${user.id}`;
    const setRef = doc(db, `sets/${setId}`);
    
    await setDoc(setRef, {
      userId: user.id,
      title: title,
      description: language === 'pl' ? `Wybrane pojęcia (${items.length})` : `Selected terms (${items.length})`,
      isPublic: false,
      cardCount: items.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isCustomPracticeSet: true
    });

    const batch = writeBatch(db);
    for (let i = 0; i < 150; i++) {
      const cardRef = doc(db, `sets/${setId}/flashcards/card-${i}`);
      batch.delete(cardRef);
    }
    
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

  const handleStartPracticeWithConfig = async () => {
    if (!practiceSetupType || !setupSelectedSource) return;

    const selectedWords = setupWords.filter(w => setupCheckedWordIds.has(w.id));
    if (selectedWords.length === 0) {
      showToast(language === 'pl' ? 'Wybierz co najmniej jedno słowo' : 'Select at least one word', 'warning');
      return;
    }

    if (practiceSetupType === 'match' && selectedWords.length < 2) {
      showToast(language === 'pl' ? 'Dopasowywanie wymaga co najmniej dwóch słówek' : 'Matching needs at least two words', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      if (user?.id && setupSelectedSource !== 'basket') {
        const set = vocabularySets.find(s => s.id === setupSelectedSource);
        if (set && set.used === false) {
          set.used = true;
          markVocabularySetAsUsed(user.id, setupSelectedSource).catch(console.error);
        }
      }

      const isAllSelected = selectedWords.length === setupWords.length;
      if (isAllSelected && setupSelectedSource !== 'basket') {
        if (onChangeView) {
          onChangeView('flashcard-study', { 
            setId: setupSelectedSource, 
            initialMode: practiceSetupType === 'match' ? 'matching' : practiceSetupType 
          });
        } else {
          onStartPractice?.(practiceSetupType);
        }
        setPracticeSetupOpen(false);
        return;
      }

      const customTitle = setupSelectedSource === 'basket'
        ? (language === 'pl' ? 'Wybrane z Koszyka' : 'Selected from Basket')
        : `${vocabularySets.find(s => s.id === setupSelectedSource)?.title || 'Lekcja'} (${language === 'pl' ? 'Wybrane' : 'Selected'})`;

      const customSetId = await syncWordsToFirestoreSet(selectedWords, customTitle);
      if (customSetId) {
        if (onChangeView) {
          onChangeView('flashcard-study', { 
            setId: customSetId, 
            initialMode: practiceSetupType === 'match' ? 'matching' : practiceSetupType 
          });
        } else {
          onStartPractice?.(practiceSetupType);
        }
      }
    } catch (err) {
      console.error("Error launching practice with configuration:", err);
    } finally {
      setIsLoading(false);
      setPracticeSetupOpen(false);
    }
  };

  const handleStartOtherPractice = (type: any, mode1?: boolean, mode2?: boolean) => {
    if (type === 'flashcards' || type === 'match' || type === 'quiz' || type === 'intro' || type === 'fill-in-the-blank') {
      setPracticeSetupType(type);
      
      let initialSource = '';
      if (selectedSetId === 'basket' && basketWords.length > 0) {
        initialSource = 'basket';
      } else if (selectedSetId && selectedSetId !== 'all' && selectedSetId !== 'grammar') {
        initialSource = selectedSetId;
      } else if (selectedLessonIds.length > 0) {
        initialSource = selectedLessonIds[0];
      } else if (vocabularySets.length > 0) {
        initialSource = vocabularySets[0].id;
      } else if (basketWords.length > 0) {
        initialSource = 'basket';
      }

      if (!initialSource) {
        showToast(language === 'pl' ? 'Najpierw wybierz źródło słownictwa albo dodaj słówka do koszyka' : 'Choose a vocabulary source or add words to the basket first', 'warning');
        return;
      }

      setSetupSelectedSource(initialSource);
      setPracticeSetupOpen(true);
      return;
    }

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
    
    const setIdToUse = selectedSetId === 'lessons' && selectedLessonIds.length > 0 ? selectedLessonIds[0] : (selectedSetId === 'grammar' ? null : selectedSetId);
    if (onChangeView) {
      onChangeView('flashcard-study', { setId: setIdToUse || '', initialMode: type });
    } else {
      onStartPractice?.(type, mode1, mode2);
    }
  };

  /**
   * Tryb `free`: zdania z AI idą przez serwer (`POST /api/free-practice/generate`) — prompt składa
   * serwer z danych kursanta w ogranicznikach, a dzienny limit liczy serwer. Klient dostarcza tylko
   * zakres (słowa z zestawów i lekcji, tematy, identyfikatory lekcji); poziom, historię błędów i
   * krzywą uczenia serwer odczytuje sam. Wynik trafia do stanu ćwiczenia; błąd z limitem dziennym
   * ustawia `freeLimit`, pozostałe — `error`.
   */
  const generateFreeSentences = async (isAppending: boolean): Promise<void> => {
    if (!freeLaunch) return;
    setFreeLimit(null);
    const words = await resolveFreeScopeWords(
      { setIds: freeLaunch.setIds, lessonIds: freeLaunch.lessonIds },
      { getFlashcards, lessons: vocabularySets },
    );
    const lessonRecordIds = freeLaunch.lessonIds
      .map((id) => vocabularySets.find((set) => set.id === id)?.lessonRecordId)
      .filter((id): id is string => Boolean(id));
    setLastUsedWords(words);
    try {
      const result = await requestFreeSentences(
        {
          format: freeLaunch.mode === 'correction' ? 'correction' : 'translation',
          topics: freeLaunch.topics,
          words,
          lessonRecordIds,
          count: practiceMode === 'time' ? 10 : (freeLaunch.count ?? numSentences),
          focusWords: freeLaunch.focusWords,
          excludeSentences: usedSentencesRef.current.slice(-40),
        },
        {
          fetch: (input, init) => fetch(input, init),
          getToken: async () => auth.currentUser?.getIdToken(),
        },
      );
      const generated = result.exercises;
      generated.forEach((item) => {
        if (item.englishTranslation) usedSentencesRef.current.push(item.englishTranslation);
        if (item.polishSentence) usedSentencesRef.current.push(item.polishSentence);
        if (item.erroneousSentence) usedSentencesRef.current.push(item.erroneousSentence);
      });
      if (isAppending) {
        setExercises((prev) => [...prev, ...stampExercises(generated)]);
      } else {
        setExercises(stampExercises(generated));
        sentences.reset();
        setWarmupPhase('invite');
        setStep('practice');
      }
    } catch (err) {
      if (err instanceof FreePracticeApiError && !isAppending) {
        if (err.code === 'daily_limit') setFreeLimit({ limit: err.limit, resetsAt: err.resetsAt });
        else setError(i18n.t(freePracticeErrorKey(err.code)));
        return;
      }
      throw err;
    }
  };

  // Generate exercises using Gemini
  const handleGenerate = async (isAppending = false, specialPromptOverride?: string) => {
    if (!isFree && selectedSetId?.startsWith('special-task-')) {
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
           setExercises(stampExercises<TranslationExercise>(task.sentences));
           sentences.reset();
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
      sentences.reset();
      setEvaluationResults([]);
      setActiveSentenceIndex(0);
      if (practiceMode === 'time') {
        setTimeLeft(timeLimit * 60);
      } else {
        setTimeLeft(null);
      }
    }

    try {
      if (isFree && freeLaunch) {
        await generateFreeSentences(isAppending);
        return;
      }
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
            
            // If no specific lessons picked or found, fallback to latest 10
            if (lrList.length === 0) {
               const qLR = query(lessonRecordsRef, orderBy('date', 'desc'), limit(10));
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
            const qPL = query(practiceLogsRef, orderBy('date', 'desc'), limit(25));
            const plSnapshot = await getDocs(qPL);
            const plList = plSnapshot.docs
              .map(doc => doc.data() as PracticeLog)
              .filter(pl => (pl.exerciseType as string) !== 'Aktywność');
            
            const pastExercises = plList.map((pl, index) => {
              const dateStr = pl.date ? new Date(pl.date).toLocaleDateString() : '';
              if (Array.isArray(pl.sentences) && pl.sentences.length > 0) {
                const sStr = pl.sentences.map((s: any) => `"${s.englishSentence || s.english_sentence || ''}" (${s.polishTranslation || s.polish_translation || ''})`).join('; ');
                return `Session ${index + 1} (${dateStr}): ${sStr}`;
              } else if (typeof pl.exercisesData === 'string' && pl.exercisesData) {
                return `Session ${index + 1} (${dateStr}): ${pl.exercisesData}`;
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
              wordsToUse = wordsToUse.sort(() => 0.5 - Math.random()).slice(0, 20);
            } else if (selectedSetId === 'lessons' || selectedLessonIds.length > 0) {
              const selectedSets = vocabularySets.filter(s => selectedLessonIds.includes(s.id));
              const allWords: string[] = [];
              selectedSets.forEach(set => {
                if (set.vocabularyText) {
                  const items = getApprovedVocabularyText(set).split(/[\n,;]+/).map(i => i.trim()).filter(i => i.length > 0);
                  allWords.push(...items);
                }
              });
              wordsToUse = Array.from(new Set(allWords)).sort(() => 0.5 - Math.random()).slice(0, 20);
            } else if (selectedSetId.startsWith('vocab-')) {
              const matchedVocab = vocabularySets.find(s => `vocab-${s.id}` === selectedSetId);
              if (matchedVocab && matchedVocab.vocabularyText) {
                 const items = getApprovedVocabularyText(matchedVocab).split(/[\n,;]+/).map(i => i.trim()).filter(i => i.length > 0);
                 wordsToUse = Array.from(new Set(items)).sort(() => 0.5 - Math.random()).slice(0, 20);
              }
            } else if (selectedSetId.startsWith('gen-')) {
              const matchedGenSet = GENERAL_VOCABULARY_SETS.find(s => s.id === selectedSetId);
              if (matchedGenSet) {
                 const items = matchedGenSet.words.map(w => w.polish ? `${w.english} (${w.polish})` : w.english);
                 wordsToUse = Array.from(new Set(items)).sort(() => 0.5 - Math.random()).slice(0, 20);
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
              wordsToUse = Array.from(new Set(allCards.map(c => c.term))).sort(() => 0.5 - Math.random()).slice(0, 20);
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
      // Krzywa uczenia dokłada do opisu od lektora twarde dane: skuteczność,
      // poziom wyliczony z wyników i ostatnie błędy. Nieudany odczyt profilu
      // nie może zablokować ćwiczenia — wtedy zostaje sam opis lektora.
      const learningContext = await getStudentAiContext(user?.id || '', level).catch(() => null);

      const studentProfileContext = `
Spersonalizowany Prompt Kursanta (ŻELAZNE WSKAZÓWKI AI DLA KURSANTA):
${user?.aiPrompt ? user.aiPrompt : 'Brak dodatkowych wskazówek.'}

Profil i tło kursanta:
${user?.description ? user.description : 'Brak dodatkowego opisu.'}

${learningContext?.briefing || ''}
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

      if (exerciseFormat === 'correction') {
        addLog('Calling generateFindErrors');
        setLastUsedWords(wordsToUse);
        const sourceMaterial = wordsToUse.length > 0 ? wordsToUse.join('\n') : (lessonContextString || 'Brak dodatkowego materiału');
        const count = practiceMode === 'time' ? 10 : numSentences;
        const findErrorsResult = await generateFindErrors(
          {
            source: { pastedText: sourceMaterial },
            types: ['find_errors'],
            perType: count,
            level: learningContext?.level || level,
            instruction: additionalInstructions || undefined,
            studentId: user?.id,
            excludeSentences: usedSentencesRef.current,
          },
          sourceMaterial,
          learningContext?.briefing
        );
        addLog('generateFindErrors returned ' + (findErrorsResult?.items ? findErrorsResult.items.length : 'null'));
        const mappedItems: TranslationExercise[] = (findErrorsResult?.items || []).map(item => ({
          polishSentence: item.polishHint || item.incorrectSentence,
          englishTranslation: item.correctSentence,
          erroneousSentence: item.incorrectSentence,
          hint: item.hint || item.explanation,
          format: 'error_hunt',
          modelUsed: findErrorsResult.modelUsed
        }));

        if (mappedItems && mappedItems.length > 0) {
          mappedItems.forEach(item => {
            if (item.englishTranslation) usedSentencesRef.current.push(item.englishTranslation);
            if (item.polishSentence) usedSentencesRef.current.push(item.polishSentence);
            if (item.erroneousSentence) usedSentencesRef.current.push(item.erroneousSentence);
          });
          if (isAppending) {
            setExercises(prev => [...prev, ...stampExercises(mappedItems)]);
          } else {
            setExercises(stampExercises(mappedItems));
            sentences.reset();
            setWarmupPhase('invite');
            setStep('practice');
          }
        } else {
          if (!isAppending) throw new Error('AI returned empty exercises.');
        }
      } else {
        addLog('Calling generateTranslationExercises');
        setLastUsedWords(wordsToUse);
        const generated = await generateTranslationExercises(
          // Poziom z krzywej uczenia bierze górę nad ustawionym ręcznie: zna
          // ostatnie wyniki, a suwak zna tylko to, co kursant kiedyś wybrał.
          learningContext?.level || level,
          wordsToUse,
          resolvedGenPrompt,
          lessonContextString,
          studentProfileContext,
          practiceMode === 'time' ? 10 : numSentences,
          pastExercisesContext,
          weaknessesListStr,
          selectedSetId === 'grammar',
          (model) => setActiveGeneratingModel(model),
          // Wynik tego wywołania zasila też HomeworkWarmupScrambler (patrz JSX
          // niżej) — ta sama granica homework/warm-up, która nie może po
          // cichu schodzić na OpenAI (services/aiModels.ts).
          [...HOMEWORK_GENERATION_MODELS],
          usedSentencesRef.current
        );
        
        addLog('generateTranslationExercises returned ' + (generated ? generated.length : 'null'));
        if (generated && generated.length > 0) {
          generated.forEach(item => {
            if (item.englishTranslation) usedSentencesRef.current.push(item.englishTranslation);
            if (item.polishSentence) usedSentencesRef.current.push(item.polishSentence);
          });
          if (isAppending) {
             setExercises(prev => [...prev, ...stampExercises(generated)]);
          } else {
             setExercises(stampExercises(generated));
             sentences.reset();
             setWarmupPhase(exerciseFormat === 'typing' ? 'invite' : 'exercises');
             setStep('practice');
          }
        } else {
          if (!isAppending) throw new Error('AI returned empty exercises.');
        }
      }
    } catch (err: any) {
      console.error(err);
      if (!isAppending) {
        setError(language === 'pl' 
           ? `Wystąpił błąd podczas przygotowywania ćwiczeń: ${err.message || 'Nieznany błąd'}` 
           : `Error preparing exercises: ${err.message || 'Unknown error'}`);
      }
    } finally {
      if (isAppending) setIsGeneratingMore(false);
      else setIsLoading(false);
    }
  };

  // Submit and grade translations with Gemini
  
  const playAudio = async (text: string, lang?: string) => {
    if (!text) return;
    setIsPlayingAudio(true);
    try {
      await playSpeech(text, {
        accent: lang || soundSettings?.ttsAccent || 'en-US',
        gender: soundSettings?.voiceGender || 'male',
        speed: soundSettings?.voiceSpeed || 1.0,
        engine: soundSettings?.soundEngine || 'auto'
      });
    } catch (err) {
      console.warn("Direct playAudio error:", err);
    } finally {
      setIsPlayingAudio(false);
    }
  };

  const handleEvaluateSingle = async () => {
    const currentIdx = activeSentenceIndex;
    const answer = studentAnswers[currentIdx];
    if (!answer || !answer.trim()) return;

    // Wynik wróci pod id TEGO zadania, nawet jeśli kursant zdąży przejść dalej albo zacząć nową rundę.
    const evaluatedId = sentences.beginEvaluation(currentIdx);
    if (!evaluatedId) return;
    setError(null);
    try {
      if (exerciseFormat === 'correction') {
        const currentExercise = exercises[currentIdx];
        const cleanAnswer = answer.trim().toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ');
        const cleanCorrect = (currentExercise.englishTranslation || '').trim().toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ');
        
        if (cleanAnswer === cleanCorrect) {
          const result: TranslationEvaluationResult = {
            polishSentence: currentExercise.polishSentence,
            correctTranslation: currentExercise.englishTranslation,
            studentAnswer: answer,
            isCorrect: true,
            score: 100,
            explanation: currentExercise.hint ? `Świetnie! Poprawiono zdanie bezbłędnie. (${currentExercise.hint})` : 'Świetnie! Poprawiono zdanie bezbłędnie.',
            suggested_better_version: currentExercise.englishTranslation,
            breakdown: {
              meaning_score: 40,
              grammar_score: 40,
              vocabulary_score: 20
            }
          };
          sentences.completeEvaluation(evaluatedId, result);
          setConsecutiveMisses(0);
          if (soundSettings?.autoPlaySentence && result.correctTranslation) {
            playAudio(result.correctTranslation, soundSettings.ttsAccent || 'en-US');
          }
          return;
        }
      }

      const evalStudentContext = `${user?.firstName ? `Zwracaj się do ucznia po imieniu (${user.firstName}), odmieniając je naturalnie we wszystkich przypadkach w języku polskim zgodnie z regułami języka polskiego.` : ''}`;
      
      let weaknessesListStr = "Brak zidentyfikowanych błędów";
      if (user) {
        weaknessesListStr = await getUserWeaknesses(user.id);
      }

      let strictnessPrompt = customEvalPrompt
        .replace(/\$\{weaknessesList(?: \|\| "[^"]+")?\}/g, weaknessesListStr);
        
      if (exerciseFormat === 'correction') {
        strictnessPrompt += `\n\nTO JEST ĆWICZENIE ZNAJDŹ I POPRAW BŁĄD (Spot & fix the error).
Zdanie wyjściowe z błędem: "${exercises[currentIdx].erroneousSentence || ''}".
Poprawne zdanie wzorcowe: "${exercises[currentIdx].englishTranslation}".
Odpowiedź kursanta: "${answer}".
Oceń, czy kursant poprawnie usunął błąd i czy całe zdanie jest teraz poprawne gramatycznie i leksykalnie.`;
      } else if (evaluationStrictness === 'strict') {
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
        sentences.completeEvaluation(evaluatedId, result);
        setConsecutiveMisses(prev => (result.isCorrect ? 0 : prev + 1));

        // Auto-play sentence pronunciation if user setting autoPlaySentence is enabled
        if (soundSettings?.autoPlaySentence && result.correctTranslation) {
          playAudio(result.correctTranslation, soundSettings.ttsAccent || 'en-US');
        }
      } else {
        throw new Error('AI returned empty evaluation results.');
      }
    } catch (err: any) {
      console.error(err);
      setError(language === 'pl'
        ? 'Wystąpił błąd podczas oceniania odpowiedzi. Spróbuj ponownie. (' + err.message + ')'
        : 'An error occurred while evaluating your answers. Please try again. (' + err.message + ')');
      sentences.failEvaluation(evaluatedId);
    }
  };

    const handleFinishAll = async () => {
    // `puzzleHintIndex` znaczy, że klocki były chwilową pomocą wewnątrz sesji
    // wpisywania — takiej sesji nie wolno podsumować jako układanki na 100%.
    if (exerciseFormat === 'puzzle' && puzzleHintIndex === null) {
      if (user?.id) {
        let setDisplayName = 'Trening ogólny';
        if (selectedSetId === 'all') setDisplayName = 'Cały materiał';
        else if (selectedSetId.startsWith('vocab-')) {
           const vs = vocabularySets.find(s => `vocab-${s.id}` === selectedSetId);
           if (vs) setDisplayName = (vs as any).name || vs.title;
        } else {
           const vs = vocabularySets.find(s => `set-${s.id}` === selectedSetId || s.id === selectedSetId);
           if (vs) setDisplayName = (vs as any).name || vs.title;
        }

        const exercisesDetails = exercises.map(e => `${e.polishSentence} -> ${e.englishTranslation}`).join(' | ');
        const puzzleFeedback = exercises.map(e => ({
          polishSentence: e.polishSentence || '',
          studentAnswer: e.englishTranslation || '',
          correctTranslation: e.englishTranslation || '',
          isCorrect: true,
          score: 100,
          explanation: 'Układanka zdań ułożona poprawnie.'
        }));

        const logData: any = {
          exerciseType: 'ai_translation',
          exerciseFormat: 'puzzle',
          date: new Date().toISOString(),
          isRevisionMode: false,
          score: 100,
          totalWords: exercises.length,
          exercisesData: exercisesDetails,
          detailedFeedback: puzzleFeedback,
          practiceMode: practiceMode,
          selectedSetId: selectedSetId,
          setDisplayName: setDisplayName,
          wordsUsed: lastUsedWords
        };
        if (testName) logData.testName = testName;

        try {
          await addDoc(collection(db, `users/${user.id}/practiceLogs`), logData);
          const newSentencesCount = (translatedSentencesCount || user?.translatedSentencesCount || 0) + exercises.length;
          setTranslatedSentencesCount(newSentencesCount);
          await updateDoc(doc(db, 'users', user.id), { translatedSentencesCount: newSentencesCount });
          if (updateUserStreak) {
            updateUserStreak().catch(console.error);
          }
          if (shouldMarkTaskSubmitted(mode, selectedSetId)) {
             const taskId = specialTaskIdFrom(selectedSetId)!;
             import('firebase/firestore').then(({ doc, updateDoc }) => {
                updateDoc(doc(db, 'specialTasks', taskId), {
                  status: 'submitted',
                  submittedAt: new Date().toISOString()
                });
             });
          }
        } catch (e) {
          console.warn("Could not save puzzle practice log:", e);
        }
      }
      setStep('puzzle-success');
      return;
    }

    const hasAnyAnswer = exercises.some((_, i) => studentAnswers[i]?.trim());
    if (!hasAnyAnswer) {
      alert(language === 'pl'
        ? 'Nie udzielono żadnej odpowiedzi — uzupełnij przynajmniej jedno zdanie przed wysłaniem.'
        : 'No answers were given — fill in at least one sentence before submitting.');
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

    // For error correction, check for direct clean matches first
    if (exerciseFormat === 'correction') {
      for (let i = 0; i < exercises.length; i++) {
        const ans = studentAnswers[i];
        if (ans?.trim() && !currentEvalResults[i]) {
          const cleanAnswer = ans.trim().toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ');
          const cleanCorrect = (exercises[i].englishTranslation || '').trim().toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ');
          if (cleanAnswer === cleanCorrect) {
            currentEvalResults[i] = {
              polishSentence: exercises[i].polishSentence,
              correctTranslation: exercises[i].englishTranslation,
              studentAnswer: ans,
              isCorrect: true,
              score: 100,
              explanation: exercises[i].hint ? `Świetnie! Poprawiono zdanie bezbłędnie. (${exercises[i].hint})` : 'Świetnie! Poprawiono zdanie bezbłędnie.',
              suggested_better_version: exercises[i].englishTranslation,
              breakdown: { meaning_score: 40, grammar_score: 40, vocabulary_score: 20 }
            };
          }
        }
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
        if (exerciseFormat === 'correction') {
          strictnessPrompt += '\n\nTO JEST ĆWICZENIE ZNAJDŹ I POPRAW BŁĄD (Spot & fix the error). Oceń, czy kursant poprawnie usunął błąd gramatyczny/leksykalny w każdym zdaniu i czy całe zdanie jest poprawne.';
        } else if (evaluationStrictness === 'strict') {
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
          sentences.applyResults(currentEvalResults, unevaluatedIndices);
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
      const rawAvg = results.reduce((acc, r) => {
        const itemScore = Number(r?.score);
        return acc + (isNaN(itemScore) ? 0 : itemScore);
      }, 0) / results.length;
      const score = isNaN(rawAvg) ? 0 : Math.round(rawAvg);
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

      // Determine set display name
      let setDisplayName = 'Nieznany zestaw';
      if (selectedSetId === FREE_SCOPE_ID) setDisplayName = 'Ćwiczenia dowolne';
      else if (selectedSetId === 'basket') setDisplayName = 'Koszyk Słówek';
      else if (selectedSetId === 'grammar') setDisplayName = 'Gramatyka';
      else if (selectedSetId === 'lessons') setDisplayName = 'Słówka z lekcji';
      else if (selectedSetId.startsWith('vocab-')) {
         const vs = vocabularySets.find(s => `vocab-${s.id}` === selectedSetId);
         if (vs) setDisplayName = (vs as any).name || vs.title;
      } else if (selectedSetId === 'all') setDisplayName = 'Cały materiał';
      else {
         const vs = vocabularySets.find(s => `set-${s.id}` === selectedSetId || s.id === selectedSetId);
         if (vs) setDisplayName = (vs as any).name || vs.title;
      }

      const logData: any = {
        exerciseType: exerciseFormat === 'correction' ? 'sentence_correction' : 'ai_translation',
        exerciseFormat: exerciseFormat === 'correction' ? 'find_errors' : exerciseFormat,
        date: new Date().toISOString(),
        isRevisionMode: false,
        score: score,
        totalWords: results.length,
        exercisesData: exercisesDetails,
        detailedFeedback: detailedFeedback,
        practiceMode: practiceMode,
        selectedSetId: selectedSetId,
        setDisplayName: setDisplayName,
        wordsUsed: lastUsedWords
      };
      if (testName) logData.testName = testName;
      
      try {
        await addDoc(collection(db, `users/${user.id}/practiceLogs`), logData);
        const allMistakes = results.flatMap(r => r.mistakes || []);
        if (allMistakes.length > 0) {
          await logMistakesToFirebase(user.id, allMistakes);
        }

        // Do krzywej uczenia idą tylko odpowiedzi realnie oceniane. Układanka
        // (`puzzle`) zostaje poza nią celowo: kursant przestawia klocki aż
        // ułoży poprawnie, więc jej stuprocentowy wynik nie mówi nic o poziomie
        // i tylko podbijałby trudność kolejnych zadań.
        recordExerciseResults(
          user.id,
          results.map((r) => ({
            prompt: r.polishSentence,
            expected: r.correctTranslation,
            given: r.studentAnswer,
            isCorrect: r.isCorrect,
            score: Number.isFinite(Number(r.score)) ? Number(r.score) : 0,
            level: normalizeLevel(user.level),
            exerciseType: exerciseFormat === 'correction' ? 'find_errors' : 'translation',
            date: new Date().toISOString(),
          })),
          user.level
        ).catch(console.error);

        const newSentencesCount = (user?.translatedSentencesCount || translatedSentencesCount || 0) + results.length;
        setTranslatedSentencesCount(newSentencesCount);
        await updateDoc(doc(db, 'users', user.id), { translatedSentencesCount: newSentencesCount });
        if (updateUserStreak) {
          updateUserStreak().catch(console.error);
        }

        // mark special task as submitted for teacher review
        if (shouldMarkTaskSubmitted(mode, selectedSetId)) {
           const taskId = specialTaskIdFrom(selectedSetId)!;
           import('firebase/firestore').then(({ doc, updateDoc }) => {
              updateDoc(doc(db, 'specialTasks', taskId), {
                status: 'submitted',
                submittedAt: new Date().toISOString()
              });
           });
        }
      } catch (e) {
        console.warn("Could not save practice log or log mistakes", e);
      }
    }
  };

  /**
   * Przełącza bieżące zdanie na Układankę po dwóch nieudanych próbach.
   *
   * Kasuje ocenę tylko dla tego jednego zdania, bo widok pokazuje ćwiczenie
   * dopiero wtedy, gdy nie ma dla niego wyniku — bez tego kursant zostałby na
   * ekranie informacji zwrotnej. Odpowiedź czyścimy, żeby układał od zera.
   */
  const handleSwitchToPuzzleHint = () => {
    const idx = activeSentenceIndex;
    setExerciseFormat('puzzle');
    setPuzzleHintIndex(idx);
    setConsecutiveMisses(0);
    sentences.clearEvaluation(idx);
    handleAnswerChange(idx, '');
  };

  const handleProceedToTrueChallenge = () => {
    setExerciseFormat('typing');
    if (exercises && exercises.length > 0) {
      sentences.reset();
      setActiveSentenceIndex(0);
      setConsecutiveMisses(0);
      setPuzzleHintIndex(null);
      setStep('practice');
    } else {
      handleGenerate(false);
    }
  };

  /**
   * Powrót „do początku". Domyślnie ekran ustawień generatora; w trybie `free` ustawień nie ma —
   * wracamy do menu Ćwiczeń dowolnych (rodzic odmontowuje ten ekran).
   */
  const returnToSetup = () => {
    if (isFree) {
      onExerciseStateChange?.(false);
      onExitFree?.();
      return;
    }
    setStep('setup');
  };

  const handleMaybeLater = () => {
    setExerciseFormat('typing');
    returnToSetup();
    setExercises([]);
    sentences.reset();
    setTimeLeft(null);
    setActiveSentenceIndex(0);
    setConsecutiveMisses(0);
    setPuzzleHintIndex(null);
    if (onExerciseStateChange) {
      onExerciseStateChange(false);
    }
  };

  const handleNext = () => {
    // Klocki kończą się razem ze zdaniem, na które były podpowiedzią.
    if (puzzleHintIndex !== null && activeSentenceIndex === puzzleHintIndex) {
      setExerciseFormat('typing');
      setPuzzleHintIndex(null);
    }
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

  const handleAnswerChange = (index: number, val: string) => sentences.setAnswer(index, val);

  const toggleHint = (index: number) => sentences.toggleHint(index);

  // Enter w ćwiczeniach ze zdaniami (tłumaczenie, korekta): Sprawdź / Dalej. Logika w utils/enterKeyAction.ts.
  const enterCtxRef = useRef<any>(null);
  const lastEnterActionRef = useRef<number | null>(null);
  {
    const idx = activeSentenceIndex;
    const isLastFixed = idx === exercises.length - 1 && practiceMode === 'fixed';
    enterCtxRef.current = {
      active: step === 'practice' && warmupPhase === 'exercises' && exerciseFormat !== 'puzzle' && Boolean(exercises[idx]),
      evaluating: evaluationStatuses[idx] === 'evaluating',
      evaluated: evaluationStatuses[idx] === 'evaluated',
      answered: Boolean(studentAnswers[idx]?.trim()),
      canForward: isLastFixed ? true : !isGeneratingMore,
      check: handleEvaluateSingle,
      next: isLastFixed ? handleFinishAll : handleNext,
    };
  }
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ctx = enterCtxRef.current;
      if (!ctx?.active || e.key !== 'Enter') return;
      const target = describeEnterTarget(e.target);
      const coarsePointer = isCoarsePointer();
      const now = Date.now();
      const action = enterKeyAction({
        key: e.key, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey,
        repeat: e.repeat, isComposing: e.isComposing || (e as any).keyCode === 229,
        target, coarsePointer,
        evaluating: ctx.evaluating, evaluated: ctx.evaluated, answered: ctx.answered, canForward: ctx.canForward,
        msSinceLastAction: lastEnterActionRef.current === null ? null : now - lastEnterActionRef.current,
      });
      // W polu odpowiedzi Enter nigdy nie wstawia nowej linii (poza dotykiem i Shift+Enter).
      if (action !== 'none' || (target === 'answer' && !e.shiftKey && !coarsePointer && !e.isComposing)) e.preventDefault();
      if (action === 'none') return;
      lastEnterActionRef.current = now;
      if (action === 'check') void ctx.check(); else void ctx.next();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Po przejściu na inne zdanie fokus wraca do pola odpowiedzi (desktop; na dotyku nie wywołujemy klawiatury ekranowej).
  useEffect(() => {
    if (step !== 'practice' || warmupPhase !== 'exercises' || isCoarsePointer()) return;
    const field = document.querySelector<HTMLTextAreaElement>('[data-testid="sentence-answer"]');
    if (field && !field.disabled) field.focus({ preventScroll: true });
  }, [activeSentenceIndex, step, warmupPhase]);

  /** „Kopiuj zdanie do edycji”: wkleja zdanie z błędem BIEŻĄCEGO zadania; fokus tylko poza dotykiem (bez wymuszania klawiatury). */
  const copyErroneousSentence = (idx: number) => {
    const text = sentenceToCopy(exercises[idx]);
    if (!text) return;
    handleAnswerChange(idx, text);
    if (isCoarsePointer()) return;
    requestAnimationFrame(() => {
      const field = document.querySelector<HTMLTextAreaElement>('[data-testid="sentence-answer"]');
      if (!field || field.disabled) return;
      field.focus({ preventScroll: true });
      field.setSelectionRange(text.length, text.length);
    });
  };

  const calcAvg = evaluationResults.length > 0
    ? Math.round(evaluationResults.reduce((acc, r) => {
        const itemScore = Number(r?.score);
        return acc + (isNaN(itemScore) ? 0 : itemScore);
      }, 0) / evaluationResults.length)
    : 0;
  const averageScore = isNaN(calcAvg) ? 0 : calcAvg;

  return (
    <div className="relative">
      <Toast toast={toast} onDismiss={dismissToast} />
      {/* Pulsar effect for the whole screen area */}

      {/* GLOBAL MOBILE HEADER */}
      <div className="md:hidden pt-4 pb-2 px-6 flex items-center justify-between bg-transparent z-40">
        <div className="w-8" />
        <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
          {step === 'setup' ? '' : 
           step === 'practice' ? (language === 'pl' ? 'Ćwiczenie' : 'Practice') :
           step === 'results' ? (language === 'pl' ? 'Wyniki' : 'Results') : 
           (language === 'pl' ? 'Sukces' : 'Success')}
        </h2>
        <div className="flex items-center gap-2">
          {step === 'practice' ? (
            <button
              onClick={() => {
                showConfirm(
                  language === 'pl' ? 'Zakończ trening' : 'End session',
                  language === 'pl' ? 'Czy na pewno chcesz zakończyć trening i wrócić do panelu głównego? Twój postęp nie zostanie zapisany.' : 'Are you sure you want to end training and return to the main panel? Your progress will not be saved.',
                  () => {
                    closeConfirm();
                    returnToSetup();
                    setExercises([]);
                    sentences.reset();
                    setTimeLeft(null);
                  }
                );
              }}
              className="p-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11 flex items-center justify-center text-content-muted hover:text-danger hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          ) : (
            <div className="w-8" />
          )}
        </div>
      </div>

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
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-text-2 hover:text-text-hi transition-colors"
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
                  returnToSetup();
                  setExercises([]);
                  sentences.reset();
                  setTimeLeft(null);
                  return;
                }
                showConfirm(
                  language === 'pl' ? 'Zakończ trening' : 'End session',
                  language === 'pl' ? 'Czy na pewno chcesz zakończyć trening i wrócić do panelu głównego? Twój postęp nie zostanie zapisany.' : 'Are you sure you want to end training and return to the main panel? Your progress will not be saved.',
                  () => {
                    closeConfirm();
                    returnToSetup();
                    setExercises([]);
                    sentences.reset();
                    setTimeLeft(null);
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
        <Card className="p-5 border-warn/30 bg-warn/[0.02] space-y-4 animate-fade-in-up">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-warn flex items-center gap-2 text-sm uppercase tracking-wider">
              <Settings className="w-4 h-4 animate-spin-slow" />
              {language === 'pl' ? 'PROTOTYP: Narzędzia Konfiguracji Promptów' : 'PROTOTYPE: Prompt Configuration Tools'}
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={handleResetPrompts} 
                className={`text-xs underline ${confirmResetPrompts ? 'text-warn font-bold' : 'text-content-muted hover:text-text-hi'}`}
              >
                {confirmResetPrompts
                  ? (language === 'pl' ? 'Potwierdź reset' : 'Confirm reset')
                  : (language === 'pl' ? 'Domyślne' : 'Restore defaults')}
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
                className="w-full bg-black/30 backdrop-blur-sm border border-white/10 shadow-inner rounded-lg p-2.5 text-base font-mono outline-none focus:border-primary/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-content-muted">{language === 'pl' ? 'Prompt Oceny & Korekty' : 'Evaluation Prompt'}</label>
              <textarea 
                value={customEvalPrompt}
                onChange={(e) => setCustomEvalPrompt(e.target.value)}
                rows={5}
                className="w-full bg-black/30 backdrop-blur-sm border border-white/10 shadow-inner rounded-lg p-2.5 text-base font-mono outline-none focus:border-primary/50"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Enhanced Error & Loading Logs */}
      <AnimatePresence>
        {error && !(isFree && step === 'setup') && (
          <motion.div key="error-banner" 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="mb-6 bg-gradient-to-r from-danger/20 to-danger/20 border border-danger/30 backdrop-blur-md text-danger p-4 rounded-2xl shadow-[0_8px_30px_rgba(240, 114, 111,0.15)] flex flex-col gap-3 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-danger/50" />
            <div className="flex items-start gap-3">
              <div className="p-2 bg-danger/20 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5 text-danger" />
              </div>
              <div className="flex-1 mt-1">
                <h4 className="font-bold text-danger text-sm mb-1">{language === 'pl' ? 'Ups, coś poszło nie tak' : 'Oops, something went wrong'}</h4>
                <div className="text-sm text-danger/90 leading-relaxed">{error}</div>
              </div>
              <button 
                onClick={() => setError(null)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors shrink-0"
              >
                <X className="w-5 h-5 text-danger/70" />
              </button>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STEP 1: SETUP */}
      {step === 'setup' && (
        isLoading ? (
          <div className="max-w-2xl mx-auto w-full">
            <GeneratingAnimation />
            {canViewAiModels && activeGeneratingModel && (
              <p className="mt-2 text-center text-sm text-text-2" data-testid="generating-model">
                {language === 'pl' ? 'Generowanie z użyciem: ' : 'Generating with: '}
                <strong className="font-bold text-text-hi">{formatAIModelName(activeGeneratingModel)}</strong>
              </p>
            )}
          </div>
        ) : isFree ? (
          <div
            role="alert"
            data-testid="free-sentences-error"
            className="max-w-2xl mx-auto w-full space-y-4 rounded-2xl border-2 border-danger bg-surface-flat p-5 text-text-hi"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
              <div className="min-w-0 space-y-1">
                <h2 className="text-base font-bold">
                  {freeLimit ? i18n.t('Dzienny limit wykorzystany') : i18n.t('Nie udało się przygotować ćwiczenia')}
                </h2>
                <p className="text-sm text-text-2 break-words">
                  {freeLimit
                    ? i18n.t(freePracticeErrorKey('daily_limit'), { limit: freeLimit.limit ?? '' })
                    : error || i18n.t('Spróbuj ponownie za chwilę')}
                </p>
                {freeLimit && <p className="text-sm text-text-2">{i18n.t('Fiszki, Dopasowanie i Quiz działają bez limitu')}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="secondary" onClick={() => returnToSetup()} className="min-h-12 flex-1 text-text-hi!">
                {i18n.t('Wróć do menu')}
              </Button>
              {!freeLimit && (
                <Button type="button" onClick={() => { setError(null); handleGenerate(false); }} className="min-h-12 flex-1">
                  {i18n.t('Spróbuj ponownie')}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto sm:mt-4 w-full">
            
            <Card className="p-0 md:p-8 border-none md:border-solid md:border md:border-white/10 bg-ink md:bg-ink-2 backdrop-blur-2xl relative overflow-visible md:overflow-hidden flex flex-col rounded-none md:rounded-3xl shadow-none md:shadow-[0_20px_60px_rgba(0,0,0,0.55)] max-w-2xl mx-auto min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] md:min-h-0">


              {/* Single Box Body content */}
              <div>
                {activeTab === 'ai' ? (
                  <>

                  <div className="space-y-6 animate-fade-in-up p-4 sm:p-6">
                    {/* Centered Header Section with Streak Counter */}
                    <div className="flex flex-col items-center justify-center text-center pb-6 border-b border-white/10 gap-3">
                      
                      {/* Top Bar: Notifications on Left, Streak Counter on Right */}
                      <div className="w-full flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {onShowOnboarding && (
                            <button
                              type="button"
                              id="tour-help-button"
                              onClick={onShowOnboarding}
                              title={language === "pl" ? "Pomoc i Przewodnik po aplikacji" : "Help & App Guide"}
                              className="group relative flex items-center gap-2 px-3 min-h-11 rounded-2xl bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary text-primary hover:text-accent-soft shadow-[0_0_12px_rgba(114, 240, 180,0.15)] transition-all duration-300 active:scale-95 cursor-pointer"
                            >
                              <HelpCircle className="w-4 h-4 text-primary group-hover:scale-110 transition-transform drop-shadow-[0_0_6px_rgba(114, 240, 180,0.6)]" />
                              <span className="text-xs font-bold font-sans tracking-wide">
                                {language === "pl" ? "Pomoc" : "Help"}
                              </span>
                            </button>
                          )}
                        </div>

                        {/* Licznik passy („X dni 🔥") stał tutaj i był pierwszą rzeczą,
                            jaką kursant widział po wejściu. Passa jako centralny
                            mechanizm to gamifikacja, nie nauka — decyzja produktowa
                            odsuwa ją z głównego widoku. Liczba nadal jest liczona
                            i widoczna w Statystykach (StudentStatsScreen). */}
                      </div>

                      {/* Centered Heading with Declined Name */}
                      <div id="tour-generator-header" className="space-y-1.5 max-w-lg mx-auto text-center w-full pt-1">
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-center">
                          {(() => {
                            const rawName = user?.firstName || (user?.displayName || user?.name || user?.username || '').split(' ')[0] || '';
                            const inflectedName = getPolishVocative(rawName);
                            return inflectedName 
                              ? `${inflectedName}, czas na trening` 
                              : (language === 'pl' ? 'Czas na trening' : 'Time for training');
                          })()}
                        </h2>
                        <div className="flex justify-center">
                          <MotivationStatLine items={motivationItems} pending={statLogs === null} className="max-w-full" />
                        </div>
                      </div>
                    </div>

                    {/* ASSIGNED HOMEWORK ALERT BANNER FOR STUDENT */}
                    {!isTeacher && specialTasks.length > 0 && (
                      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-primary/20 via-primary/15 to-primary/20 border border-primary/40 shadow-[0_0_25px_rgba(114,240,180,0.15)] space-y-3 relative overflow-hidden animate-fade-in-up">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-base">
                              📝
                            </span>
                            <div>
                              <h3 className="font-extrabold text-white text-sm sm:text-base leading-tight">
                                {language === 'pl' ? 'Nowa praca domowa od nauczyciela' : 'New homework assigned by teacher'}
                              </h3>
                              <span className="text-[12px] text-primary font-semibold">
                                {specialTasks.length} {specialTasks.length === 1 ? (language === 'pl' ? 'zadanie oczekujące na rozwiązanie' : 'pending homework task') : (language === 'pl' ? 'zadania oczekujące na rozwiązanie' : 'pending homework tasks')}
                              </span>
                            </div>
                          </div>
                          <span className="text-[12px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/20 text-primary border border-primary/30">
                            {language === 'pl' ? 'Do zrobienia' : 'Pending'}
                          </span>
                        </div>

                        <div className="space-y-2 pt-1 border-t border-white/10">
                          {specialTasks.slice(0, 2).map((hwTask) => (
                            <div key={hwTask.id} className="p-3 rounded-xl bg-black/40 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-white text-xs sm:text-sm truncate">
                                  {hwTask.title || (language === 'pl' ? 'Praca domowa: Tłumaczenia' : 'Homework: Translations')}
                                </h4>
                                <p className="text-[12px] text-text-2 mt-0.5 line-clamp-1">
                                  {hwTask.instructions || `${hwTask.sentences?.length || 0} zdań w zestawie`}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onChangeView) {
                                      onChangeView('homework', { taskId: hwTask.id });
                                    }
                                  }}
                                  className="text-xs py-1.5 px-3 bg-primary hover:bg-primary/90 text-accent-ink font-bold rounded-xl flex items-center gap-1.5 shadow-[0_0_15px_rgba(114,240,180,0.3)] hover:scale-105 transition-all cursor-pointer"
                                >
                                  <Edit3 size={13} />
                                  <span>{language === 'pl' ? 'Rozwiąż zadanie' : 'Start homework'}</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {specialTasks.length > 2 && (
                          <div className="text-right pt-1">
                            <button
                              type="button"
                              onClick={() => onChangeView && onChangeView('homework')}
                              className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                            >
                              {language === 'pl' ? `Zobacz wszystkie (${specialTasks.length}) →` : `View all (${specialTasks.length}) →`}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SECTION 1: TRYB ĆWICZENIA */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[12px] font-bold text-text-2 uppercase tracking-widest">
                          {language === 'pl' ? 'Tryb ćwiczenia' : 'Exercise mode'}
                        </label>
                        <span className="text-xs font-mono text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full font-semibold">
                          {language === 'pl' ? '4 formaty' : '4 formats'}
                        </span>
                      </div>

                      {/* 4 Exercise Format Cards Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Card 1: Sprawdź Się (Tłumaczenia) */}
                        <div id="tour-mode-typing" className="relative group">
                          <button
                            type="button"
                            onClick={() => {
                              setExerciseFormat('typing');
                              setIsConfigModalOpen(true);
                            }}
                            className={`w-full group/card relative text-left rounded-3xl p-5 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer min-h-[160px] liquid-glass-tile ${
                              exerciseFormat === 'typing'
                                ? 'border-2 border-primary shadow-[0_0_35px_rgba(114,240,180,0.4)] scale-[1.01]'
                                : 'hover:border-primary/60 hover:shadow-[0_0_25px_rgba(114,240,180,0.2)]'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full z-10">
                              <div className={`w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover/card:scale-110 transition-transform ${exerciseFormat === 'typing' ? 'text-primary bg-primary/20 border-primary shadow-[0_0_15px_rgba(114,240,180,0.5)]' : ''}`}>
                                <Keyboard className="w-5 h-5 drop-shadow-[0_0_8px_rgba(114,240,180,0.8)]" />
                              </div>
                              <span className="px-2.5 py-1 rounded-full text-[12px] font-mono font-bold text-primary bg-primary/10 border border-primary/20">
                                {language === 'pl' ? 'Tłumaczenia' : 'Translations'}
                              </span>
                            </div>

                            <div className="z-10 mt-3">
                              <h3 className="text-xl font-serif font-bold text-white group-hover/card:text-primary transition-colors flex items-center gap-1.5">
                                {language === 'pl' ? 'Sprawdź Się' : 'Check Yourself'} <ChevronRight className="w-4 h-4 text-primary group-hover/card:translate-x-1 transition-transform" />
                              </h3>
                              <p className="text-[12px] text-text-2 mt-1 leading-relaxed">
                                {language === 'pl' ? 'Tłumaczenie pełnych zdań z pamięci i natychmiastowa korekta AI.' : 'Full sentence translation from memory with instant AI grading.'}
                              </p>
                              <div className="mt-2.5 flex items-center gap-1.5">
                                <span className="text-[12px] text-primary/90 font-mono bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 flex items-center gap-1 font-semibold">
                                  <span>🧩</span> {language === 'pl' ? 'Tryb rozgrzewki' : 'Warm-up mode'}
                                </span>
                              </div>
                            </div>
                          </button>
                        </div>

                        {/* Card 2: Napraw Zdanie (Korekta) */}
                        <div id="tour-mode-correction" className="relative group">
                          <button
                            type="button"
                            onClick={() => {
                              setExerciseFormat('correction');
                              setIsConfigModalOpen(true);
                            }}
                            className={`w-full group/card relative text-left rounded-3xl p-5 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer min-h-[160px] liquid-glass-tile ${
                              exerciseFormat === 'correction'
                                ? 'border-2 border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.4)] scale-[1.01]'
                                : 'hover:border-amber-400/60 hover:shadow-[0_0_25px_rgba(251,191,36,0.2)]'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full z-10">
                              <div className={`w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover/card:scale-110 transition-transform ${exerciseFormat === 'correction' ? 'text-amber-400 bg-amber-500/20 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)]' : ''}`}>
                                <Wrench className="w-5 h-5 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                              </div>
                              <span className="px-2.5 py-1 rounded-full text-[12px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20">
                                {language === 'pl' ? 'Korekta' : 'Correction'}
                              </span>
                            </div>

                            <div className="z-10 mt-3">
                              <h3 className="text-xl font-serif font-bold text-white group-hover/card:text-amber-400 transition-colors flex items-center gap-1.5">
                                {language === 'pl' ? 'Napraw Zdanie' : 'Fix the Sentence'} <ChevronRight className="w-4 h-4 text-amber-400 group-hover/card:translate-x-1 transition-transform" />
                              </h3>
                              <p className="text-[12px] text-text-2 mt-1 leading-relaxed">
                                {language === 'pl' ? 'Wyszukaj błąd gramatyczny lub leksykalny i wpisz poprawne zdanie.' : 'Spot grammatical or lexical errors and type the corrected sentence.'}
                              </p>
                              <div className="mt-2.5 flex items-center gap-1.5">
                                <span className="text-[12px] text-amber-300/90 font-mono bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1 font-semibold">
                                  <span>🎯</span> {language === 'pl' ? 'Zadanie z pracy domowej' : 'Homework task'}
                                </span>
                              </div>
                            </div>
                          </button>
                        </div>

                        {/* Card 3: Fiszki */}
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={() => handleStartOtherPractice('flashcards')}
                            className="w-full group/card relative rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer liquid-glass-tile hover:border-primary/70 hover:shadow-[0_0_20px_rgba(114,240,180,0.25)] text-left min-h-[120px]"
                          >
                            <div className="flex items-center justify-between w-full z-10">
                              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xl group-hover/card:scale-110 transition-transform">
                                🗂️
                              </div>
                              <span className="px-2.5 py-0.5 rounded-full text-[12px] font-mono font-bold text-primary bg-primary/10 border border-primary/20">
                                {language === 'pl' ? 'Nauka' : 'Learn'}
                              </span>
                            </div>
                            <div className="z-10 mt-3">
                              <h4 className="text-base font-serif font-bold text-white group-hover/card:text-primary transition-colors flex items-center gap-1">
                                {language === 'pl' ? 'Fiszki' : 'Flashcards'} <ChevronRight className="w-4 h-4 text-primary group-hover/card:translate-x-1 transition-transform" />
                              </h4>
                              <p className="text-[12px] text-text-2 mt-0.5">
                                {language === 'pl' ? 'Aktywne przypominanie słownictwa' : 'Active vocabulary recall'}
                              </p>
                            </div>
                          </button>
                        </div>
                        
                        {/* Card 4: Dopasowanie */}
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={() => handleStartOtherPractice('match')}
                            className="w-full group/card relative rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer liquid-glass-tile hover:border-warn/70 hover:shadow-[0_0_20px_rgba(224,168,58,0.25)] text-left min-h-[120px]"
                          >
                            <div className="flex items-center justify-between w-full z-10">
                              <div className="w-10 h-10 rounded-2xl bg-warn/10 border border-warn/20 flex items-center justify-center text-warn text-xl group-hover/card:scale-110 transition-transform">
                                🧩
                              </div>
                              <span className="px-2.5 py-0.5 rounded-full text-[12px] font-mono font-bold text-warn bg-warn/10 border border-warn/20">
                                {language === 'pl' ? 'Gra' : 'Game'}
                              </span>
                            </div>
                            <div className="z-10 mt-3">
                              <h4 className="text-base font-serif font-bold text-white group-hover/card:text-warn transition-colors flex items-center gap-1">
                                {language === 'pl' ? 'Dopasowanie' : 'Match'} <ChevronRight className="w-4 h-4 text-warn group-hover/card:translate-x-1 transition-transform" />
                              </h4>
                              <p className="text-[12px] text-text-2 mt-0.5">
                                {language === 'pl' ? 'Szybkie łączenie par na czas' : 'Fast-paced word matching'}
                              </p>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* LOWER SECTION: EXPANDED BARS (ŹRÓDŁO MATERIAŁU & ILOŚĆ ZDAŃ STACKED VERTICALLY - DESKTOP ONLY) */}
                    <div id="tour-vocab-source" className="hidden sm:flex flex-col gap-4 w-full">
                      {/* Bar 1: Źródło materiału */}
                      <div className="w-full bg-ink-2 border-2 border-line-strong/80 p-4 rounded-3xl shadow-md space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[12px] font-bold text-text-2 uppercase tracking-widest">
                            {language === 'pl' ? 'Źródło materiału' : 'Material Source'}
                          </label>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsLessonSelectorOpen(true)}
                          className="w-full group relative flex items-center justify-between px-4 py-3.5 rounded-2xl bg-ink border border-white/20 hover:border-primary/60 shadow-[0_4px_15px_rgba(0,0,0,0.4)] hover:shadow-[0_0_20px_rgba(114, 240, 180,0.25)] transition-all duration-300 cursor-pointer overflow-hidden text-left"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                          
                          <div className="flex items-center gap-3 z-10 min-w-0 flex-1 mr-2">
                            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shrink-0 shadow-[0_0_10px_rgba(114, 240, 180,0.2)]">
                              {selectedSetId === 'basket' ? <ShoppingBag className="w-4.5 h-4.5" /> : <BookOpen className="w-4.5 h-4.5" />}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold text-white group-hover:text-primary transition-colors truncate">
                                {language === 'pl' ? 'Źródło słownictwa' : 'Vocabulary Source'}
                              </span>
                              <span className="text-xs text-text-2 truncate">
                                {selectedSetId === 'basket' ? (
                                  language === 'pl' ? `Koszyk słówek (${basketWords.length})` : `Word Basket (${basketWords.length})`
                                ) : selectedLessonIds.length > 0 ? (
                                  lessonsLabel(selectedLessonIds.length)
                                ) : (
                                  language === 'pl' ? 'Słownictwo ogólne: miks i koszyk' : 'General vocabulary mix'
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 z-10 shrink-0">
                            {basketWords.length > 0 && (
                              <span 
                                onClick={(e) => { e.stopPropagation(); setIsBasketModalOpen(true); }}
                                className="text-xs font-bold text-primary bg-primary/15 border border-primary/30 px-2.5 py-1 rounded-full flex items-center gap-1 hover:scale-105 transition-transform"
                              >
                                <ShoppingBag className="w-3.5 h-3.5" />
                                <span>{basketWords.length}</span>
                              </span>
                            )}
                            <div className="px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-bold text-primary group-hover:bg-primary group-hover:text-accent-ink transition-all flex items-center gap-1">
                              <span>{language === 'pl' ? 'Wybierz' : 'Select'}</span>
                              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        </button>

                        {/* Selected chips list */}
                        <div className="flex flex-wrap items-center gap-1.5 px-1 pt-1">
                          {selectedSetId === 'basket' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/15 border border-primary/30 text-primary shadow-[0_0_12px_rgba(114, 240, 180,0.15)]">
                              <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                              {language === 'pl' ? `Koszyk Słówek (${basketWords.length} słów)` : `Word Basket (${basketWords.length} words)`}
                            </span>
                          ) : selectedLessonIds.length > 0 ? (
                            vocabularySets
                              .filter(s => selectedLessonIds.includes(s.id))
                              .map((set, i) => (
                                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/15 border border-primary/30 text-primary shadow-[0_0_12px_rgba(114, 240, 180,0.15)]">
                                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                                  {set.topic.replace(/^\d+\.\s*/, '').replace(/\(Lekcja\s*\d+\)\s*/gi, '').trim()}
                                </span>
                              ))
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-text-2">
                              <BookOpen className="w-3.5 h-3.5 text-text-2" />
                              {language === 'pl' ? 'Słownictwo Ogólne: Miks i Koszyk' : 'General Vocabulary Mix'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bar 2: Ilość zadań */}
                      <div className="w-full bg-ink-2 border-2 border-line-strong/80 p-4 rounded-3xl shadow-md space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[12px] font-bold text-text-2 uppercase tracking-widest">
                            {language === 'pl' ? 'Ilość zdań' : 'Number of sentences'}
                          </label>
                          <span className="text-2xl font-black text-white font-mono leading-none">
                            {numSentences}
                          </span>
                        </div>

                        <div className="bg-ink border border-white/10 rounded-2xl p-4 space-y-3">
                          <input
                            type="range"
                            min="1"
                            max="25"
                            step="1"
                            value={numSentences}
                            onChange={(e) => {
                              setNumSentences(parseInt(e.target.value));
                            }}
                            className="w-full h-2 bg-surface-flat rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                          />

                          <div className="grid grid-cols-4 gap-2 pt-0.5">
                            {[5, 10, 15, 20].map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => {
                                  setNumSentences(val);
                                }}
                                className={`py-2 rounded-xl font-bold text-xs transition-all duration-200 ${
                                  numSentences === val
                                    ? 'bg-surface-flat border border-white/20 text-white shadow-inner'
                                    : 'bg-[var(--surface-flat)] border border-white/5 text-text-2 hover:text-text-hi hover:bg-surface-flat'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* GENERATE BUTTON (DESKTOP ONLY) */}
                    <div className="hidden sm:block pt-2">
                      <AILoadingButton
                        onClick={() => handleGenerate(false)}
                        isLoading={isLoading}
                        loadingText={language === 'pl' ? 'Przygotowywanie ćwiczenia...' : 'Preparing the exercise...'}
                        className="w-full py-4 px-6 rounded-2xl border border-primary/50 bg-gradient-to-r from-primary/80 via-primary/10 to-primary/80 hover:from-primary/90 hover:to-primary/90 text-white font-bold text-base flex items-center justify-center gap-3 transition-all duration-300 shadow-[0_0_25px_rgba(114, 240, 180,0.2)] hover:shadow-[0_0_35px_rgba(114, 240, 180,0.35)] hover:scale-[1.008] active:scale-[0.995] group"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(114, 240, 180,0.9)] animate-pulse shrink-0" />
                        <span>
                          {language === 'pl'
                            ? `Wygeneruj ${numSentences === 1 ? '1 zdanie' : numSentences >= 2 && numSentences <= 4 ? `${numSentences} zdania` : `${numSentences} zdań`}`
                            : `Generate ${numSentences} ${numSentences === 1 ? 'sentence' : 'sentences'}`}
                        </span>
                        <ArrowRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
                      </AILoadingButton>
                    </div>
                  </div>

                  {/* Exercise Configuration Menu Modal (Mobile & Tile Click) */}
                  <AnimatePresence>
                    {isConfigModalOpen && (
                      <motion.div
                        key="exercise-config-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
                        onClick={() => setIsConfigModalOpen(false)}
                      >
                        <motion.div
                          initial={{ y: '100%' }}
                          animate={{ y: 0 }}
                          exit={{ y: '100%' }}
                          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-ink-2 border border-white/15 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-3xl p-5 sm:p-6 max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[92dvh]"
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-3">
                              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${
                                exerciseFormat === 'correction'
                                  ? 'bg-amber-500/20 border-amber-400 text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]'
                                  : 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(114, 240, 180,0.4)]'
                              }`}>
                                {exerciseFormat === 'correction' ? (
                                  <Wrench className="w-5 h-5 text-amber-400" />
                                ) : exerciseFormat === 'puzzle' ? (
                                  <LayoutGrid className="w-5 h-5 text-primary" />
                                ) : (
                                  <Keyboard className="w-5 h-5 text-primary" />
                                )}
                              </div>
                              <div>
                                <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                                  {exerciseFormat === 'correction'
                                    ? (language === 'pl' ? 'Napraw Zdanie' : 'Fix the Sentence')
                                    : exerciseFormat === 'puzzle'
                                      ? (language === 'pl' ? 'Układanka' : 'Puzzle')
                                      : (language === 'pl' ? 'Sprawdź Się' : 'Check Yourself')}
                                </h3>
                                <p className="text-xs text-text-2">
                                  {exerciseFormat === 'correction'
                                    ? (language === 'pl' ? 'Wyszukiwanie i poprawa błędów w zdaniach' : 'Spot & fix mistakes in sentences')
                                    : (language === 'pl' ? 'Tłumaczenie pełnych zdań z pamięci' : 'Sentence translation from memory')}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setIsConfigModalOpen(false)}
                              className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-text-2 hover:text-text-hi transition-colors cursor-pointer"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>

                          {/* Przełącznik Układanka / Wpisywanie stał tutaj i był drugą
                              furtką do Układanki — konfiguracja treningu to nadal start,
                              a tryb ma być podpowiedzią po nieudanych próbach, nie wyborem
                              z listy. Nagłówek modalu wciąż rozpoznaje oba formaty, bo
                              podpowiedź potrafi przełączyć tryb w trakcie sesji. */}

                          {/* Scrollable Content */}
                          <div className="overflow-y-auto space-y-4 py-4 my-1 pr-1 custom-scrollbar flex-1">
                            {/* Section 1: Źródło materiału */}
                            <div className="bg-ink-2 border border-white/10 p-4 rounded-2xl space-y-3">
                              <div className="flex items-center justify-between">
                                <label className="text-[12px] font-bold text-text-2 uppercase tracking-widest">
                                  {language === 'pl' ? 'Źródło słownictwa' : 'Vocabulary Source'}
                                </label>
                              </div>

                              <button
                                type="button"
                                onClick={() => setIsLessonSelectorOpen(true)}
                                className="w-full group relative flex items-center justify-between px-4 py-3 rounded-xl bg-ink border border-white/20 hover:border-primary/60 shadow-md transition-all cursor-pointer text-left"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                                  <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0">
                                    {selectedSetId === 'basket' ? <ShoppingBag className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold text-white truncate">
                                      {language === 'pl' ? 'Źródło materiału' : 'Material Source'}
                                    </span>
                                    <span className="text-[12px] text-text-2 truncate">
                                      {selectedSetId === 'basket' ? (
                                        language === 'pl' ? `Koszyk słówek (${basketWords.length})` : `Word Basket (${basketWords.length})`
                                      ) : selectedLessonIds.length > 0 ? (
                                        lessonsLabel(selectedLessonIds.length)
                                      ) : (
                                        language === 'pl' ? 'Słownictwo ogólne: miks i koszyk' : 'General vocabulary mix'
                                      )}
                                    </span>
                                  </div>
                                </div>

                                <div className="px-3 py-1.5 rounded-lg bg-primary/20 text-xs font-bold text-primary hover:bg-primary hover:text-accent-ink transition-all flex items-center gap-1 shrink-0">
                                  <span>{language === 'pl' ? 'Wybierz' : 'Select'}</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </div>
                              </button>

                              {/* Chips list */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {selectedSetId === 'basket' ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/15 border border-primary/30 text-primary">
                                    <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                                    {language === 'pl' ? `Koszyk Słówek (${basketWords.length} słów)` : `Word Basket (${basketWords.length} words)`}
                                  </span>
                                ) : selectedLessonIds.length > 0 ? (
                                  vocabularySets
                                    .filter(s => selectedLessonIds.includes(s.id))
                                    .map((set, i) => (
                                      <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/15 border border-primary/30 text-primary">
                                        <BookOpen className="w-3.5 h-3.5 text-primary" />
                                        {set.topic.replace(/^\d+\.\s*/, '').replace(/\(Lekcja\s*\d+\)\s*/gi, '').trim()}
                                      </span>
                                    ))
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-text-2">
                                    <BookOpen className="w-3.5 h-3.5 text-text-2" />
                                    {language === 'pl' ? 'Słownictwo Ogólne: Miks i Koszyk' : 'General Vocabulary Mix'}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Section 2: Ilość zadań */}
                            <div className="bg-ink-2 border border-white/10 p-4 rounded-2xl space-y-3">
                              <div className="flex items-center justify-between">
                                <label className="text-[12px] font-bold text-text-2 uppercase tracking-widest">
                                  {language === 'pl' ? 'Ilość zdań' : 'Number of sentences'}
                                </label>
                                <span className="text-2xl font-black text-white font-mono leading-none">
                                  {numSentences}
                                </span>
                              </div>

                              <div className="bg-ink border border-white/10 rounded-xl p-3 space-y-3">
                                <input
                                  type="range"
                                  min="1"
                                  max="25"
                                  step="1"
                                  value={numSentences}
                                  onChange={(e) => setNumSentences(parseInt(e.target.value))}
                                  className="w-full h-2 bg-surface-flat rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                                />

                                <div className="grid grid-cols-4 gap-2">
                                  {[5, 10, 15, 20].map((val) => (
                                    <button
                                      key={val}
                                      type="button"
                                      onClick={() => setNumSentences(val)}
                                      className={`py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                                        numSentences === val
                                          ? 'bg-surface-flat border border-white/20 text-white shadow-inner'
                                          : 'bg-[var(--surface-flat)] border border-white/5 text-text-2 hover:text-text-hi'
                                      }`}
                                    >
                                      {val}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Footer: Generate Button */}
                          <div className="pt-3 border-t border-white/10 shrink-0">
                            <AILoadingButton
                              onClick={() => {
                                setIsConfigModalOpen(false);
                                handleGenerate(false);
                              }}
                              isLoading={isLoading}
                              loadingText={language === 'pl' ? 'Przygotowywanie ćwiczenia...' : 'Preparing...'}
                              className="w-full py-4 px-6 rounded-2xl border border-primary/50 bg-gradient-to-r from-primary/90 via-primary/10 to-primary/90 hover:from-primary hover:to-primary text-white font-bold text-base flex items-center justify-center gap-3 shadow-[0_0_25px_rgba(114, 240, 180,0.3)] transition-all cursor-pointer"
                            >
                              <span className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(114, 240, 180,0.9)] animate-pulse shrink-0" />
                              <span>
                                {language === 'pl'
                                  ? `Wygeneruj ${numSentences === 1 ? '1 zdanie' : numSentences >= 2 && numSentences <= 4 ? `${numSentences} zdania` : `${numSentences} zdań`}`
                                  : `Generate ${numSentences} ${numSentences === 1 ? 'sentence' : 'sentences'}`}
                              </span>
                              <ArrowRight className="w-5 h-5 text-primary" />
                            </AILoadingButton>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Vocabulary Source Selection Modal */}
                  <AnimatePresence>
                    {isLessonSelectorOpen && (
                      <motion.div key="lesson-selector"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
                      >
                        <motion.div
                          initial={{ y: '100%' }}
                          animate={{ y: 0 }}
                          exit={{ y: '100%' }}
                          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                          className="bg-[var(--ink-2)] border border-white/10 w-full max-w-lg rounded-t-[2rem] sm:rounded-3xl p-6 max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl overflow-hidden flex flex-col max-h-[85dvh]"
                        >
                          <div className="flex justify-between items-center mb-5 border-b border-white/10 pb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                              <BookOpen className="w-5 h-5 text-primary" />
                              {language === 'pl' ? 'Źródło słownictwa' : 'Vocabulary source'}
                            </h3>
                            <button 
                              onClick={() => setIsLessonSelectorOpen(false)}
                              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-text-2 hover:text-text-hi transition-colors"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          
                          <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 space-y-3 pb-4">
                            
                            {/* CATEGORY 1: MOJE LEKCJE (Rozwijany przycisk, domyślnie zwinięty) */}
                            <div className="rounded-2xl border border-white/10 bg-[var(--surface-flat)] overflow-hidden">
                              <div 
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
                                onClick={() => setIsMyLessonsOpen(!isMyLessonsOpen)}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold text-base">
                                    📚
                                  </div>
                                  <div>
                                    <h4 className="text-base font-bold text-white">
                                      {language === 'pl' ? 'Moje Lekcje' : 'My Lessons'}
                                    </h4>
                                    <p className="text-xs text-text-2">
                                      {language === 'pl' ? 'Lekcje z zajęć, miks oraz koszyk' : 'Class lessons, mix & basket'}
                                    </p>
                                  </div>
                                </div>
                                <ChevronDown className={`w-5 h-5 text-text-2 transition-transform duration-300 ${isMyLessonsOpen ? 'rotate-180' : ''}`} />
                              </div>

                              <AnimatePresence>
                                {isMyLessonsOpen && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden bg-black/20 p-3 pt-1 space-y-2 border-t border-white/5"
                                  >
                                    {/* Option 3: Dedykowane zadania od nauczyciela (if present) */}
                                    {specialTasks.length > 0 && specialTasks.map(task => (
                                      <label key={task.id} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                                        selectedSetId === 'special-task-' + task.id ? 'bg-primary/10 border-primary/50 shadow-[0_0_15px_rgba(114, 240, 180,0.15)]' : 'bg-[var(--surface-flat)] border-white/5 hover:border-white/10'
                                      }`}>
                                        <input 
                                          type="radio" 
                                          name="vocabSourceRadio"
                                          checked={selectedSetId === 'special-task-' + task.id}
                                          onChange={() => {
                                            setSelectedSetId('special-task-' + task.id);
                                            setSelectedLessonIds([]);
                                          }}
                                          className="w-4 h-4 text-primary focus:ring-primary rounded-full border-white/20 bg-black/40 cursor-pointer accent-primary"
                                        />
                                        <span className={`text-sm font-semibold ${selectedSetId === 'special-task-' + task.id ? 'text-primary' : 'text-content'}`}>
                                          {task.title}
                                        </span>
                                      </label>
                                    ))}

                                    {/* Option 4: Lekcje indywidualne (Checkboxy) */}
                                    {vocabularySets.length > 0 ? (
                                      <div className="pt-1 space-y-2">
                                        <p className="text-[12px] font-bold text-text-2 uppercase tracking-wider px-1 pt-1">
                                          {language === 'pl' ? 'Lekcje indywidualne:' : 'Individual lessons:'}
                                        </p>
                                        {vocabularySets.map((set, index) => {
                                          const isSelected = selectedLessonIds.includes(set.id);
                                          const lessonNumber = vocabularySets.length - index;
                                          
                                          return (
                                            <label 
                                              key={set.id} 
                                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                                
                                                isSelected ? 'bg-primary/10 border-primary/50 shadow-[0_0_15px_rgba(114, 240, 180,0.15)]' : 'bg-[var(--surface-flat)] border-white/5 hover:border-white/10'
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
                                                className="w-4 h-4 text-primary focus:ring-primary rounded border-white/20 bg-black/40 cursor-pointer accent-primary"
                                              />
                                              <div className="flex-1 flex flex-col min-w-0 gap-0.5">
                                                <span className="text-[12px] font-bold text-primary uppercase tracking-wider">
                                                  Lesson {lessonNumber}
                                                </span>
                                                <span className={`text-xs font-semibold leading-relaxed ${isSelected ? 'text-white' : 'text-content'} break-words`}>
                                                  {set.topic.replace(/^\d+\.\s*/, '').replace(/\(Lekcja\s*\d+\)\s*/gi, '').trim()}
                                                </span>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  setPreviewVocabSet(set);
                                                }}
                                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-primary hover:text-accent-soft transition-colors flex-shrink-0 flex items-center gap-1 text-xs font-semibold"
                                              >
                                                <Eye className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">{language === 'pl' ? 'Podgląd' : 'Preview'}</span>
                                              </button>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="text-center text-xs text-text-2 py-3">Brak dodanych lekcji</div>
                                    )}

                                    {/* Option 5: Słownictwo prywatne (Flashcards) */}
                                    {availableSets.length > 0 && (
                                      <div className="pt-2 space-y-2 border-t border-white/5 mt-2">
                                        <p className="text-[12px] font-bold text-text-2 uppercase tracking-wider px-1 pt-1">
                                          {language === 'pl' ? 'Słownictwo prywatne:' : 'Private vocabulary:'}
                                        </p>
                                        {availableSets.map((set) => {
                                          const isSelected = selectedSetId === set.id;
                                          return (
                                            <label 
                                              key={set.id} 
                                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                                isSelected ? 'bg-primary/10 border-primary/50 shadow-[0_0_15px_rgba(114, 240, 180,0.15)]' : 'bg-[var(--surface-flat)] border-white/5 hover:border-white/10'
                                              }`}
                                            >
                                              <input 
                                                type="radio"
                                                name="vocabSourceRadio"
                                                checked={isSelected}
                                                onChange={() => {
                                                  setSelectedSetId(set.id);
                                                  setSelectedLessonIds([]);
                                                }}
                                                className="w-4 h-4 text-primary focus:ring-primary rounded-full border-white/20 bg-black/40 cursor-pointer accent-primary"
                                              />
                                              <div className="flex-1 flex flex-col min-w-0 gap-0.5">
                                                <span className={`text-xs font-semibold leading-relaxed ${isSelected ? 'text-primary' : 'text-content'} break-words`}>
                                                  {set.title}
                                                </span>
                                              </div>
                                              <span className="text-[12px] font-bold bg-white/5 text-text-2 px-2 py-0.5 rounded">
                                                {set.cardCount}
                                              </span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Materiał spoza lekcji — świadomie na końcu listy.
                                        Decyzja produktowa: powtórki mają iść z materiału
                                        zatwierdzonego po konkretnej lekcji, a otwarty
                                        generator jest opcją dodatkową, nie główną ścieżką. */}
                                    <p className="text-[12px] font-bold text-text-2 uppercase tracking-wider px-1 pt-3">
                                      {language === 'pl' ? 'Opcje dodatkowe:' : 'Additional options:'}
                                    </p>
                                    {/* Option 1: Słownictwo ogólne: miks i koszyk */}
                                    <label className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                                      selectedSetId === 'all' && selectedLessonIds.length === 0 ? 'bg-primary/10 border-primary/50 shadow-[0_0_15px_rgba(114, 240, 180,0.15)]' : 'bg-[var(--surface-flat)] border-white/5 hover:border-white/10'
                                    }`}>
                                      <input 
                                        type="radio" 
                                        name="vocabSourceRadio"
                                        checked={selectedSetId === 'all' && selectedLessonIds.length === 0}
                                        onChange={() => {
                                          setSelectedSetId('all');
                                          setSelectedLessonIds([]);
                                        }}
                                        className="w-4 h-4 text-primary focus:ring-primary rounded-full border-white/20 bg-black/40 cursor-pointer accent-primary"
                                      />
                                      <div className="flex-1">
                                        <span className={`text-sm font-bold ${selectedSetId === 'all' && selectedLessonIds.length === 0 ? 'text-primary' : 'text-content'}`}>
                                          {language === 'pl' ? 'Słownictwo ogólne: miks i koszyk' : 'General vocabulary: mix & basket'}
                                        </span>
                                        <p className="text-[12px] text-text-2">
                                          {language === 'pl'
                                            ? 'Opcja dodatkowa: miks ze wszystkich lekcji i koszyka, bez powiązania z konkretnymi zajęciami'
                                            : 'Additional option: a mix from all lessons and the basket, not tied to a specific class'}
                                        </p>
                                      </div>
                                    </label>

                                    {/* Option 2: Mój koszyk */}
                                    <label className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                                      selectedSetId === 'basket' ? 'bg-primary/10 border-primary/50 shadow-[0_0_15px_rgba(114, 240, 180,0.15)]' : 'bg-[var(--surface-flat)] border-white/5 hover:border-white/10'
                                    }`}>
                                      <input 
                                        type="radio" 
                                        name="vocabSourceRadio"
                                        checked={selectedSetId === 'basket'}
                                        onChange={() => {
                                          setSelectedSetId('basket');
                                          setSelectedLessonIds([]);
                                        }}
                                        className="w-4 h-4 text-primary focus:ring-primary rounded-full border-white/20 bg-black/40 cursor-pointer accent-primary"
                                      />
                                      <div className="flex-1 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <ShoppingBag className="w-4 h-4 text-primary" />
                                          <span className={`text-sm font-bold ${selectedSetId === 'basket' ? 'text-primary' : 'text-content'}`}>
                                            {language === 'pl' ? `Mój Koszyk (${basketWords.length})` : `My Basket (${basketWords.length})`}
                                          </span>
                                        </div>
                                        {basketWords.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setIsBasketModalOpen(true);
                                            }}
                                            className="text-xs px-2.5 py-1 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 font-medium transition-colors"
                                          >
                                            {language === 'pl' ? 'Otwórz koszyk' : 'Open basket'}
                                          </button>
                                        )}
                                      </div>
                                    </label>


                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* CATEGORY 2: SŁOWNICTWO OGÓLNE (Rozwijany przycisk, domyślnie zwinięty) */}
                            <div className="rounded-2xl border border-white/10 bg-[var(--surface-flat)] overflow-hidden">
                              <div 
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
                                onClick={() => setIsGeneralVocabTabOpen(!isGeneralVocabTabOpen)}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold text-base">
                                    🌐
                                  </div>
                                  <div>
                                    <h4 className="text-base font-bold text-white">
                                      {language === 'pl' ? 'Słownictwo Ogólne' : 'General Vocabulary'}
                                    </h4>
                                    <p className="text-xs text-primary">
                                      {language === 'pl' ? '3 Poziomy Zaawansowania (A1 - C2)' : '3 Proficiency Levels (A1 - C2)'}
                                    </p>
                                  </div>
                                </div>
                                <ChevronDown className={`w-5 h-5 text-text-2 transition-transform duration-300 ${isGeneralVocabTabOpen ? 'rotate-180' : ''}`} />
                              </div>

                              <AnimatePresence>
                                {isGeneralVocabTabOpen && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden bg-black/20 p-3 pt-1 space-y-2 border-t border-white/5"
                                  >
                                    {LEVEL_GROUPS.map((group) => {
                                      const isGroupExpanded = expandedGenLevelGroup === group.key;
                                      const groupSets = GENERAL_VOCABULARY_SETS.filter(s => s.levelGroup === group.key);
                                      
                                      return (
                                        <div key={group.key} className="rounded-xl border border-white/10 bg-[var(--surface-flat)] overflow-hidden">
                                          <div 
                                            className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors"
                                            onClick={() => setExpandedGenLevelGroup(isGroupExpanded ? null : group.key)}
                                          >
                                            <div className="flex items-center gap-2.5">
                                              <span className={`text-[12px] font-mono font-bold px-2 py-0.5 rounded border ${group.badgeClass}`}>
                                                {group.levels}
                                              </span>
                                              <span className="text-sm font-bold text-content">{group.name}</span>
                                            </div>
                                            <ChevronDown className={`w-4 h-4 text-text-2 transition-transform duration-300 ${isGroupExpanded ? 'rotate-180' : ''}`} />
                                          </div>

                                          <AnimatePresence>
                                            {isGroupExpanded && (
                                              <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden bg-black/30 p-2.5 space-y-2 border-t border-white/5"
                                              >
                                                <p className="text-[12px] text-text-2 italic px-1 mb-1">{group.description}</p>
                                                {groupSets.map((gSet) => {
                                                  const isSelected = selectedSetId === gSet.id;
                                                  return (
                                                    <label
                                                      key={gSet.id}
                                                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                                        isSelected
                                                          ? 'bg-primary/10 border-primary/50 shadow-[0_0_15px_rgba(114, 240, 180,0.15)]'
                                                          : 'bg-[var(--surface-flat)] border-white/5 hover:border-white/10'
                                                      }`}
                                                    >
                                                      <input
                                                        type="radio"
                                                        name="vocabSourceRadio"
                                                        checked={isSelected}
                                                        onChange={() => {
                                                          setSelectedSetId(gSet.id);
                                                          setSelectedLessonIds([]);
                                                        }}
                                                        className="w-4 h-4 text-primary focus:ring-primary rounded-full border-white/20 bg-black/40 cursor-pointer accent-primary"
                                                      />
                                                      <div className="flex-1 flex flex-col min-w-0">
                                                        <div className="flex items-center gap-2">
                                                          <span className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-white'} truncate`}>{gSet.title}</span>
                                                          <span className="text-[12px] font-mono bg-white/10 text-primary px-1.5 py-0.5 rounded">
                                                            {gSet.words.length} słówek
                                                          </span>
                                                        </div>
                                                        <span className="text-[12px] text-text-2 truncate">{gSet.description}</span>
                                                      </div>
                                                      <button
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.preventDefault();
                                                          e.stopPropagation();
                                                          setPreviewVocabSet({
                                                            id: gSet.id,
                                                            studentId: 'all',
                                                            lessonRecordId: '',
                                                            title: gSet.title,
                                                            date: new Date().toISOString(),
                                                            topic: gSet.title,
                                                            vocabularyText: gSet.words.map(w => `${w.english} - ${w.polish}`).join('\n'),
                                                            itemCount: gSet.words.length,
                                                            status: 'ready',
                                                            source: 'lesson_record',
                                                            createdAt: new Date().toISOString(),
                                                            updatedAt: new Date().toISOString()
                                                          });
                                                        }}
                                                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-primary hover:text-accent-soft transition-colors flex-shrink-0 flex items-center gap-1 text-xs font-semibold"
                                                      >
                                                        <Eye className="w-3.5 h-3.5" />
                                                        <span className="hidden sm:inline">{language === 'pl' ? 'Podgląd' : 'Preview'}</span>
                                                      </button>
                                                    </label>
                                                  );
                                                })}
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </div>
                                      );
                                    })}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                          </div>

                          <div className="mt-4 pt-4 border-t border-white/10">
                            <button 
                              onClick={() => setIsLessonSelectorOpen(false)}
                              className="w-full py-3.5 rounded-2xl bg-[var(--accent)] text-accent-ink font-bold text-base shadow-[0_0_20px_rgba(114, 240, 180,0.3)] hover:bg-primary transition-colors"
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
                                className="bg-[var(--ink-2)] border border-white/10 w-full max-w-lg rounded-[2rem] p-6 shadow-2xl flex flex-col max-h-[85dvh]"
                              >
                                <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4">
                                  <div>
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                      <BookOpen className="w-5 h-5 text-primary" />
                                      {previewVocabSet.topic.replace(/^\d+\.\s*/, '').replace(/\(Lekcja\s*\d+\)\s*/gi, '').trim()}
                                    </h3>
                                    <p className="text-xs text-text-2 mt-0.5">
                                      {language === 'pl' ? 'Kliknij +, aby dodać konkretne słówko do koszyka' : 'Click + to add specific words to basket'}
                                    </p>
                                  </div>
                                  <button 
                                    onClick={() => setPreviewVocabSet(null)}
                                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-text-2 hover:text-text-hi transition-colors"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>

                                {previewVocabSet.vocabularyText && (
                                  <div className="mb-4 flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl p-3">
                                    <span className="text-xs font-medium text-primary">
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
                                      className="text-xs px-3 py-1.5 rounded-lg bg-primary text-accent-ink font-bold hover:brightness-110 transition-colors flex items-center gap-1 shadow-[0_0_10px_rgba(114, 240, 180,0.3)]"
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
                                              ? 'bg-primary/10 border-primary/40 text-primary' 
                                              : 'bg-white/5 border-white/10 text-content hover:border-white/20'
                                          }`}>
                                            <div className="flex-1 min-w-0">
                                              <span className="font-semibold text-white block truncate">{wordItem.term}</span>
                                              {wordItem.definition && (
                                                <span className="text-xs text-text-2 block truncate">{wordItem.definition}</span>
                                              )}
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => toggleBasketWord(wordItem)}
                                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-all shrink-0 ${
                                                inBasket
                                                  ? 'bg-primary text-accent-ink shadow-[0_0_10px_rgba(114, 240, 180,0.4)]'
                                                  : 'bg-white/10 hover:bg-primary/20 hover:text-primary text-content border border-white/10'
                                              }`}
                                              title={inBasket ? 'Usuń z koszyka' : 'Dodaj do koszyka'}
                                            >
                                              {inBasket ? <Check className="w-4 h-4 stroke-[3]" /> : <Plus className="w-4 h-4" />}
                                            </button>
                                          </div>
                                        );
                                      })
                                  ) : (
                                    <div className="text-center text-text-2 py-8">
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
                                      <ShoppingBag className="w-4 h-4 text-primary" />
                                      <span>{language === 'pl' ? `Zobacz koszyk (${basketWords.length})` : `View basket (${basketWords.length})`}</span>
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => setPreviewVocabSet(null)}
                                    className="flex-1 py-3.5 rounded-xl bg-[var(--accent)] text-black font-bold text-sm shadow-[0_0_20px_rgba(114, 240, 180,0.3)]"
                                  >
                                    {language === 'pl' ? 'Gotowe' : 'Done'}
                                  </button>
                                </div>
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Modal: Practice Configuration Setup */}
                        <AnimatePresence>
                          {practiceSetupOpen && (
                            <motion.div key="practice-setup-modal"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
                            >
                              <motion.div
                                initial={{ y: 20, opacity: 0, scale: 0.95 }}
                                animate={{ y: 0, opacity: 1, scale: 1 }}
                                exit={{ y: 20, opacity: 0, scale: 0.95 }}
                                className="bg-[var(--ink-2)] border border-white/10 w-full max-w-lg rounded-[2rem] p-6 shadow-2xl flex flex-col max-h-[85dvh]"
                              >
                                {/* Header */}
                                <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xl ${
                                      practiceSetupType === 'match' 
                                        ? 'bg-warn/20 text-warn border border-warn/30' 
                                        : 'bg-primary/20 text-primary border border-primary/30'
                                    }`}>
                                      {practiceSetupType === 'match' ? '🧩' : '🗂️'}
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-bold text-white">
                                        {language === 'pl' ? 'Skonfiguruj zadanie' : 'Configure Exercise'}
                                      </h3>
                                      <p className="text-xs text-text-2">
                                        {practiceSetupType === 'match' 
                                          ? (language === 'pl' ? 'Gra w dopasowywanie pojęć' : 'Vocabulary matching game')
                                          : (language === 'pl' ? 'Nauka i testowanie z fiszkami' : 'Learn and test with flashcards')}
                                      </p>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => setPracticeSetupOpen(false)}
                                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-text-2 hover:text-text-hi transition-colors"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>

                                {/* Step 1: Source Selection */}
                                <div className="space-y-2 mb-4">
                                  <label className="text-xs font-bold text-text-2 uppercase tracking-wider block">
                                    {language === 'pl' ? '1. Wybierz lekcję / źródło' : '1. Choose lesson / source'}
                                  </label>
                                  <div className="relative">
                                    <select
                                      value={setupSelectedSource}
                                      onChange={(e) => setSetupSelectedSource(e.target.value)}
                                      className="w-full bg-[var(--surface-flat)] text-white border border-white/10 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-primary/50 appearance-none pr-10"
                                    >
                                      {basketWords.length > 0 && (
                                        <option value="basket">
                                          🧺 {language === 'pl' ? `Koszyk Słówek (${basketWords.length})` : `Vocabulary Basket (${basketWords.length})`}
                                        </option>
                                      )}
                                      {vocabularySets.length > 0 && (
                                        <optgroup label={language === 'pl' ? "Zestawy z Lekcji Kursantów" : "Student Lesson Sets"}>
                                          {vocabularySets.map((set, idx) => {
                                            const lessonNumber = vocabularySets.length - idx;
                                            return (
                                              <option key={set.id} value={set.id}>
                                                📚 Lesson {lessonNumber}: {set.topic ? set.topic.replace(/^\d+\.\s*/, '').replace(/\(Lekcja\s*\d+\)\s*/gi, '').trim() : set.title} ({set.itemCount} {language === 'pl' ? 'słówek' : 'words'})
                                              </option>
                                            );
                                          })}
                                        </optgroup>
                                      )}
                                      {LEVEL_GROUPS.map(group => {
                                        const groupSets = GENERAL_VOCABULARY_SETS.filter(s => s.levelGroup === group.key);
                                        return (
                                          <optgroup key={group.key} label={`🌐 Słownictwo Ogólne: ${group.name} (${group.levels})`}>
                                            {groupSets.map(gSet => (
                                              <option key={gSet.id} value={gSet.id}>
                                                [{gSet.levelBadge}] {gSet.title} ({gSet.words.length} słówek)
                                              </option>
                                            ))}
                                          </optgroup>
                                        );
                                      })}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-text-2">
                                      <ChevronDown className="w-4 h-4" />
                                    </div>
                                  </div>
                                </div>

                                {/* Step 2: Words list */}
                                <div className="flex-1 flex flex-col min-h-0 space-y-2 mb-6">
                                  <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-text-2 uppercase tracking-wider">
                                      {practiceSetupType === 'flashcards' 
                                        ? (language === 'pl' ? `2. Słówka w zestawie (${setupWords.length} słówek - Cała kategoria)` : `2. Words in set (${setupWords.length} words - Full category)`)
                                        : (language === 'pl' ? `2. Wybierz słówka (${setupCheckedWordIds.size} z ${setupWords.length})` : `2. Select words (${setupCheckedWordIds.size} of ${setupWords.length})`)}
                                    </label>
                                    {practiceSetupType === 'flashcards' ? (
                                      <span className="text-[12px] font-bold text-primary bg-primary/15 border border-primary/30 px-2.5 py-1 rounded-lg">
                                        {language === 'pl' ? 'Kategoria w całości' : 'Full category'}
                                      </span>
                                    ) : (
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setSetupCheckedWordIds(new Set(setupWords.map(w => w.id)))}
                                          className="text-[12px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors border border-primary/20"
                                        >
                                          {language === 'pl' ? 'Zaznacz wszystkie' : 'Select all'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setSetupCheckedWordIds(new Set())}
                                          className="text-[12px] font-bold text-text-2 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg transition-colors border border-white/10"
                                        >
                                          {language === 'pl' ? 'Odznacz wszystkie' : 'Deselect all'}
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {practiceSetupType === 'flashcards' && (
                                    <p className="text-[12px] text-primary/90 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5">
                                      🎴 {language === 'pl' 
                                        ? 'Fiszki realizujesz jako pełną kategorię (zestaw). Wszystkie słówka są automatycznie dołączone.' 
                                        : 'Flashcards are studied as a complete category set. All words are automatically included.'}
                                    </p>
                                  )}

                                  {/* Scrollable list of words with checkboxes */}
                                  <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/5 rounded-2xl bg-ink-2 p-2 space-y-1 max-h-[300px]">
                                    {setupWords.length === 0 ? (
                                      <div className="text-center py-8 text-text-mute text-sm">
                                        {language === 'pl' ? 'Brak słówek w wybranym źródle' : 'No words in the selected source'}
                                      </div>
                                    ) : (
                                      setupWords.map((word) => {
                                        const isChecked = setupCheckedWordIds.has(word.id);
                                        const accentClass = practiceSetupType === 'match' 
                                          ? 'bg-warn/10 border-warn/30 text-warn' 
                                          : 'bg-primary/10 border-primary/30 text-primary';
                                        
                                        const checkColor = practiceSetupType === 'match' ? 'accent-warn' : 'accent-primary';

                                        return (
                                          <label
                                            key={word.id}
                                            className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                                              practiceSetupType === 'flashcards' ? 'cursor-default opacity-90' : 'cursor-pointer'
                                            } ${
                                              isChecked
                                                ? `${accentClass}`
                                                : 'bg-white/[0.01] border-white/5 text-text-2 hover:border-white/10 hover:bg-white/[0.03]'
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              disabled={practiceSetupType === 'flashcards'}
                                              onChange={() => {
                                                if (practiceSetupType === 'flashcards') return;
                                                const newChecked = new Set(setupCheckedWordIds);
                                                if (newChecked.has(word.id)) {
                                                  newChecked.delete(word.id);
                                                } else {
                                                  newChecked.add(word.id);
                                                }
                                                setSetupCheckedWordIds(newChecked);
                                              }}
                                              className={`w-4 h-4 rounded border-white/20 bg-black/40 focus:ring-0 ${checkColor} ${
                                                practiceSetupType === 'flashcards' ? 'cursor-default opacity-80' : 'cursor-pointer'
                                              }`}
                                            />
                                            <div className="flex-1 min-w-0">
                                              <span className={`font-semibold text-xs block ${isChecked ? 'text-white' : 'text-content'}`}>{word.term}</span>
                                              {word.definition && (
                                                <span className="text-[12px] text-text-2 block truncate">{word.definition}</span>
                                              )}
                                            </div>
                                          </label>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>

                                {/* Actions Footer */}
                                <div className="flex gap-3 pt-2">
                                  <button
                                    type="button"
                                    onClick={() => setPracticeSetupOpen(false)}
                                    className="flex-1 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-content font-bold text-sm border border-white/10 transition-colors"
                                  >
                                    {language === 'pl' ? 'Anuluj' : 'Cancel'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleStartPracticeWithConfig}
                                    disabled={setupCheckedWordIds.size === 0 || isLoading}
                                    className={`flex-1 py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 text-black ${
                                      setupCheckedWordIds.size === 0 || isLoading
                                        ? 'bg-base-200 text-text-mute cursor-not-allowed border-none'
                                        : practiceSetupType === 'match'
                                          ? 'bg-warn hover:brightness-110 shadow-[0_0_20px_rgba(224, 168, 58,0.3)]'
                                          : 'bg-primary hover:brightness-110 shadow-[0_0_20px_rgba(114, 240, 180,0.3)]'
                                    }`}
                                  >
                                    {isLoading ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Play className="w-4 h-4 fill-current" />
                                    )}
                                    <span>
                                      {language === 'pl' 
                                        ? `Graj (${setupCheckedWordIds.size} sł.)` 
                                        : `Play (${setupCheckedWordIds.size} w.)`}
                                    </span>
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
                                className="bg-[var(--ink-2)] border border-white/10 w-full max-w-lg rounded-[2rem] p-6 shadow-2xl flex flex-col max-h-[85dvh]"
                              >
                                <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold">
                                      <ShoppingBag className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        {language === 'pl' ? 'Koszyk Słówek' : 'Vocabulary Basket'}
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                                          {basketWords.length}
                                        </span>
                                      </h3>
                                      <p className="text-xs text-text-2">
                                        {language === 'pl' ? 'Twój własny zestaw słów wymiksowany z lekcji' : 'Your custom mix of vocabulary from lessons'}
                                      </p>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => setIsBasketModalOpen(false)}
                                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-text-2 hover:text-text-hi transition-colors"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>

                                {basketWords.length > 0 && (
                                  <div className="flex justify-end mb-2">
                                    <button
                                      type="button"
                                      onClick={clearBasket}
                                      className="text-xs text-danger hover:opacity-80 flex items-center gap-1 font-medium px-2 py-1 rounded hover:bg-danger/10 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>{language === 'pl' ? 'Wyczyść koszyk' : 'Clear basket'}</span>
                                    </button>
                                  </div>
                                )}

                                <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 space-y-2">
                                  {basketWords.length > 0 ? (
                                    basketWords.map((item, idx) => (
                                      <div key={item.id + idx} className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-3 text-sm text-content transition-all">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="font-semibold text-white truncate">{item.term}</span>
                                            {item.sourceTopic && (
                                              <span className="text-[12px] font-mono bg-white/10 px-2 py-0.5 rounded text-text-2 truncate max-w-[120px]">
                                                {item.sourceTopic}
                                              </span>
                                            )}
                                          </div>
                                          {item.definition && (
                                            <span className="text-xs text-text-2 block truncate mt-0.5">{item.definition}</span>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => toggleBasketWord(item)}
                                          className="p-2 text-text-2 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors shrink-0"
                                          title="Usuń z koszyka"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-center text-text-2 py-12 space-y-3">
                                      <ShoppingBag className="w-12 h-12 text-text-faint mx-auto stroke-[1.5]" />
                                      <p className="text-sm font-medium">
                                        {language === 'pl' ? 'Twój koszyk jest pusty.' : 'Your basket is empty.'}
                                      </p>
                                      <p className="text-xs text-text-mute max-w-xs mx-auto">
                                        {language === 'pl' ? 'Wejdź w dowolną lekcję i kliknij przycisk +, aby dodać słówka do koszyka.' : 'Open any lesson and click + to add words into your basket.'}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {basketWords.length > 0 && (
                                  <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                                    <label className="block text-[12px] font-bold text-text-2 uppercase tracking-wider">
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
                                        className="py-3 px-3 rounded-xl bg-primary text-accent-ink font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(114, 240, 180,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                                      >
                                        <Sparkles className="w-4 h-4" />
                                        <span>{language === 'pl' ? 'Trening zdań' : 'Sentence Practice'}</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsBasketModalOpen(false);
                                          handleStartBasketPractice('flashcards');
                                        }}
                                        className="py-3 px-3 rounded-xl bg-white/10 border border-white/10 hover:border-primary/40 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-white/15 transition-all"
                                      >
                                        <span>🗂️ {language === 'pl' ? 'Fiszki' : 'Flashcards'}</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsBasketModalOpen(false);
                                          handleStartBasketPractice('quiz');
                                        }}
                                        className="py-3 px-3 rounded-xl bg-white/10 border border-white/10 hover:border-primary/40 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-white/15 transition-all"
                                      >
                                        <span>📝 {language === 'pl' ? 'Quiz' : 'Quiz'}</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsBasketModalOpen(false);
                                          handleStartBasketPractice('match');
                                        }}
                                        className="py-3 px-3 rounded-xl bg-white/10 border border-white/10 hover:border-primary/40 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-white/15 transition-all"
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
        warmupPhase === 'invite' && (exerciseFormat === 'typing' || exerciseFormat === 'correction') ? (
          <div className="max-w-2xl mx-auto space-y-4 px-3 sm:px-0 pb-28 md:pb-8 animate-fade-in">
            <div className="liquid-glass-card rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden border border-primary/30 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
              {/* Glow accent */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-2 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold text-text-hi bg-primary/10 border border-primary">
                    {isFree
                      ? (exerciseFormat === 'correction' ? i18n.t('Korekta zdań') : i18n.t('Tłumaczenie zdań'))
                      : exerciseFormat === 'correction'
                        ? (language === 'pl' ? 'Napraw Zdanie' : 'Fix the Sentence')
                        : (language === 'pl' ? 'Sprawdź Się' : 'Check Yourself')}
                  </span>
                  <span className="text-text-hi font-bold text-xs font-mono">
                    {exercises.length} {exercises.length === 1 ? 'zadanie' : exercises.length < 5 ? 'zadania' : 'zadań'}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white leading-snug">
                  {exerciseFormat === 'correction'
                    ? (language === 'pl' ? 'Trening wyszukiwania i korekty błędów' : 'Find & Fix Mistake Training')
                    : (language === 'pl' ? 'Trening tłumaczenia pełnych zdań z pamięci' : 'Sentence Translation Practice')}
                </h3>
                <p className="text-xs text-text-2">
                  {language === 'pl' 
                    ? 'Ćwiczenie oparte na wybranym materiale z natychmiastową oceną i podpowiedziami AI.' 
                    : 'Exercise based on selected material with instant AI grading.'}
                </p>
              </div>

              {/* Warm-up Callout */}
              <div className="bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-emerald-500/5 border border-emerald-500/30 rounded-2xl p-5 space-y-2.5 relative z-10">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🧩</span>
                  <h4 className="text-base font-bold text-emerald-300">
                    {language === 'pl' ? 'Czy chcesz zacząć od rozgrzewki?' : 'Would you like to start with a warm-up?'}
                  </h4>
                </div>
                <p className="text-xs sm:text-sm text-text-2 leading-relaxed">
                  {language === 'pl'
                    ? 'Krótka układanka klockowa (1–2 min) pomoże Ci płynnie wejść w tryb myślenia po angielsku i rozgrzać pamięć przed głównymi zadaniami. Rozgrzewkę możesz w każdej chwili pominąć.'
                    : 'A quick scrambler puzzle (1–2 min) helps you transition into English mode and warms up your memory before the main tasks. You can skip it at any time.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2 relative z-10">
                <button
                  type="button"
                  onClick={() => setWarmupPhase('scrambler')}
                  className="w-full min-h-[3.25rem] sm:min-h-[3.5rem] rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  <span>🚀 {language === 'pl' ? 'Zacznij od rozgrzewki (Zalecane)' : 'Start with warm-up (Recommended)'}</span>
                  <ArrowRight size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => setWarmupPhase('exercises')}
                  className="w-full min-h-[3rem] rounded-2xl bg-white/5 hover:bg-white/10 text-text-2 hover:text-white font-semibold text-xs sm:text-sm border border-white/10 transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  <span>⚡ {language === 'pl' ? 'Przejdź od razu do zdań' : 'Go directly to sentences'}</span>
                </button>
              </div>
            </div>
          </div>
        ) : warmupPhase === 'scrambler' ? (
          <div className="max-w-2xl mx-auto px-3 sm:px-0 pb-28 md:pb-8 animate-fade-in">
            <HomeworkWarmupScrambler
              sentences={exercises}
              task={{ type: 'translation' }}
              onComplete={() => setWarmupPhase('exercises')}
              onSkip={() => setWarmupPhase('exercises')}
              finishLabel={isFree ? i18n.t('Przejdź do zdań') : undefined}
            />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4 px-3 sm:px-0 pb-28 md:pb-8">
            {/* Progress header */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-content-muted">
                {language === 'pl' ? 'Postęp:' : 'Progress:'} {activeSentenceIndex + 1} {practiceMode === 'fixed' ? `/ ${exercises.length}` : ''}
              </span>
            {practiceMode === 'time' && timeLeft !== null && (
              <div className={`font-mono text-base font-bold flex items-center gap-1.5 ${timeLeft <= 10 ? 'text-danger animate-pulse' : 'text-primary'}`}>
                <Clock className="w-4 h-4" />
                {Number.isNaN(Number(timeLeft)) ? 0 : Math.floor((timeLeft as number) / 60)}:{Number.isNaN(Number(timeLeft)) ? '00' : ((timeLeft as number) % 60).toString().padStart(2, '0')}
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
                  {motivationItems.length > 0 && (
                    <div className="max-w-[16rem] rounded-2xl rounded-bl-none border-2 border-primary bg-surface-flat px-3.5 py-1 shadow-md">
                      <MotivationStatLine items={motivationItems} autoRotate={false} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <Card ref={practiceCardRef} className="liquid-glass-card p-4 md:p-6 space-y-3 relative overflow-hidden flex flex-col">
              {/* Background design accents */}
              <div className="absolute top-0 right-0 p-6 opacity-[0.02] pointer-events-none select-none">
                <Sparkles className="w-48 h-48 text-primary" />
              </div>

            <div className="space-y-3 relative z-10 flex flex-col items-center text-center">
              {exerciseFormat === 'puzzle' && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 border border-line-strong text-text-hi rounded-full text-[12px] font-mono font-bold mx-auto">
                  {i18n.t("Zdanie")} {activeSentenceIndex + 1}
                </div>
              )}

              {/* Karta zdania (Tłumaczenie / Korekta) — wspólny komponent, tokeny obu motywów */}
              {exerciseFormat === 'correction' ? (
                <SentencePromptCard
                  variant="correction"
                  index={activeSentenceIndex}
                  sentence={exercises[activeSentenceIndex].erroneousSentence || exercises[activeSentenceIndex].polishSentence}
                  context={exercises[activeSentenceIndex].polishSentence}
                  hint={exercises[activeSentenceIndex].hint}
                  hintOpen={Boolean(showHints[activeSentenceIndex])}
                  onToggleHint={() => toggleHint(activeSentenceIndex)}
                  onCopy={sentenceToCopy(exercises[activeSentenceIndex]) ? () => copyErroneousSentence(activeSentenceIndex) : undefined}
                />
              ) : exerciseFormat !== 'puzzle' ? (
                <SentencePromptCard
                  variant="translation"
                  index={activeSentenceIndex}
                  sentence={exercises[activeSentenceIndex].polishSentence}
                  hint={exercises[activeSentenceIndex].hint}
                  hintOpen={Boolean(showHints[activeSentenceIndex])}
                  onToggleHint={() => toggleHint(activeSentenceIndex)}
                />
              ) : null}

              {/* Pole odpowiedzi i wynik */}
              <div className="w-full space-y-3 mt-2 flex flex-col items-center">
                {evaluationStatuses[activeSentenceIndex] === 'evaluated' && singleEvaluationResults[activeSentenceIndex] ? (
                  <SentenceFeedbackPanel
                    result={singleEvaluationResults[activeSentenceIndex]}
                    modelLabel={canViewAiModels ? formatAIModelName(singleEvaluationResults[activeSentenceIndex].modelUsed) : undefined}
                    onPlay={(text, accent) => playAudio(text, accent)}
                    playing={isPlayingAudio}
                  >
                    {/* Rusztowanie po dwóch nieudanych próbach z rzędu. Jedyne wejście w Układankę —
                        stąd propozycja, a nie kolejny kafelek na ekranie startowym. */}
                    {consecutiveMisses >= 2 && exerciseFormat === 'typing' && (
                      <div className="w-full rounded-xl border border-warn p-3 text-left">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-hi mb-1">
                          <LayoutGrid className="w-3.5 h-3.5 text-warn" aria-hidden="true" />
                          {i18n.t('Może rozłożyć to na części?')}
                        </div>
                        <p className="text-sm text-text-2 leading-snug">
                          {i18n.t('To zdanie nie chce się ułożyć — spróbuj złożyć je z gotowych klocków, potem wrócisz do pisania z pamięci')}
                        </p>
                        <button
                          type="button"
                          onClick={handleSwitchToPuzzleHint}
                          className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-text-mute px-4 text-sm font-bold text-text-hi hover:border-primary transition-colors motion-reduce:transition-none cursor-pointer"
                        >
                          <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                          {i18n.t('Ułóż z klocków')}
                        </button>
                      </div>
                    )}
                  </SentenceFeedbackPanel>
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
                        sentences.setResult(activeSentenceIndex, result);
                      }
                    }}
                  />
                ) : (
                  <div className="w-full space-y-2">
                    <SentenceAnswerInput
                      tone={exerciseFormat === 'correction' ? 'cool' : 'default'}
                      label={exerciseFormat === 'correction' ? i18n.t('Twoja poprawiona wersja') : i18n.t('Twoje tłumaczenie na angielski')}
                      value={studentAnswers[activeSentenceIndex] || ''}
                      onChange={(e) => handleAnswerChange(activeSentenceIndex, e.target.value)}
                      placeholder={exerciseFormat === 'correction' ? i18n.t('Wpisz w pełni poprawione zdanie po angielsku') : i18n.t('Wpisz swoje tłumaczenie tutaj')}
                      disabled={evaluationStatuses[activeSentenceIndex] === 'evaluating'}
                    />
                  </div>
                )}
                  </>
                )}
              </div>
            </div>
            {/* Pasek akcji: Poprzednie / Sprawdź (główna) / Dalej (drugorzędna); układanka ma własne przyciski */}
            {exerciseFormat !== 'puzzle' ? (
              (() => {
                const idx = activeSentenceIndex;
                const isLastFixed = idx === exercises.length - 1 && practiceMode === 'fixed';
                const answered = Boolean(studentAnswers[idx]?.trim());
                const evaluated = evaluationStatuses[idx] === 'evaluated';
                const loadingMore = isGeneratingMore && idx === exercises.length - 1;
                const forward = isLastFixed
                  ? { label: evaluated ? i18n.t('Zakończ i podsumuj') : i18n.t('Zakończ'), shortcutHint: evaluated ? i18n.t('Enter: Dalej') : undefined, onClick: handleFinishAll, disabled: !evaluated && (!answered || isGeneratingMore), loading: !evaluated && isGeneratingMore }
                  : { label: i18n.t('Dalej'), shortcutHint: evaluated ? i18n.t('Enter: Dalej') : undefined, onClick: handleNext, disabled: (!evaluated && !answered) || isGeneratingMore, loading: loadingMore };
                return (
                  <SentenceActionBar
                    previous={{ label: i18n.t('Poprzednie'), onClick: handlePrev, disabled: idx === 0 }}
                    primary={
                      evaluated
                        ? forward
                        : { label: i18n.t('Sprawdź'), shortcutHint: i18n.t('Enter: Sprawdź'), onClick: handleEvaluateSingle, disabled: !answered, loading: evaluationStatuses[idx] === 'evaluating' }
                    }
                    secondary={evaluated ? undefined : forward}
                  />
                );
              })()
            ) : (
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
                      className="px-4 md:px-6 py-2 md:py-3 bg-primary hover:bg-primary/95 text-accent-ink font-extrabold text-sm w-full sm:w-auto"
                    >
                      {language === 'pl' ? 'Zakończ rozgrzewkę' : 'Finish warmup'}
                    </AILoadingButton>
                ) : (
                    <AILoadingButton
                      onClick={handleNext}
                      disabled={studentAnswers[activeSentenceIndex] !== exercises[activeSentenceIndex].englishTranslation || isGeneratingMore}
                      isLoading={isGeneratingMore && activeSentenceIndex === exercises.length - 1}
                      loadingText={language === 'pl' ? 'Ładowanie...' : 'Loading...'}
                      className="px-4 md:px-6 py-2 md:py-3 bg-primary hover:bg-primary/95 text-accent-ink font-extrabold text-sm w-full sm:w-auto"
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
                      className="px-4 md:px-6 py-2 md:py-3 bg-primary hover:bg-primary/95 text-accent-ink font-extrabold text-sm"
                    >
                      {language === 'pl' ? 'Zakończ' : 'Finish'}
                    </AILoadingButton>
                ) : (
                    <AILoadingButton
                      onClick={handleNext}
                      disabled={!studentAnswers[activeSentenceIndex]?.trim() || isGeneratingMore}
                      isLoading={isGeneratingMore && activeSentenceIndex === exercises.length - 1}
                      loadingText={language === 'pl' ? '...' : '...'}
                      className="px-4 md:px-6 py-2 md:py-3 bg-primary hover:bg-primary/95 text-accent-ink font-extrabold text-sm"
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
                      className="px-4 md:px-6 py-2 md:py-3 bg-primary hover:bg-primary/95 text-accent-ink font-extrabold text-sm"
                    >
                      {language === 'pl' ? 'Zakończ i podsumuj' : 'Finish & Summarize'}
                    </AILoadingButton>
                ) : (
                    <AILoadingButton
                      onClick={handleNext}
                      disabled={isGeneratingMore}
                      isLoading={isGeneratingMore && activeSentenceIndex === exercises.length - 1}
                      loadingText={language === 'pl' ? '...' : '...'}
                      className="px-4 md:px-6 py-2 md:py-3 bg-primary hover:bg-primary/95 text-accent-ink font-extrabold text-sm"
                    >
                      {language === 'pl' ? 'Dalej' : 'Next'}
                    </AILoadingButton>
                  )}
                </div>
              )}
            </div>

            )}

            {(evaluationStatuses[activeSentenceIndex] === 'evaluating' || isGeneratingMore) && (
              <div className="w-full flex justify-center mt-3 animate-fade-in">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold shadow-[0_0_15px_rgba(114, 240, 180,0.15)]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  {canViewAiModels ? (
                    <span>
                      {language === 'pl' ? 'Wysyłam zapytanie do: ' : 'Sending query to: '}
                      <strong className="text-white font-bold">{formatAIModelName(activeGeneratingModel)}</strong>
                    </span>
                  ) : (
                    <span>
                      {language === 'pl' ? 'Trwa sprawdzanie tłumaczenia...' : 'Evaluating translation...'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </Card>
          </div>

          {/* Prompt warning if fields are not completed */}
          {studentAnswers.some(ans => !ans?.trim()) && (
            <div className="text-center text-xs text-content-muted">
              {language === 'pl' 
                ? (exerciseFormat === 'correction' ? 'Popraw wszystkie zdania, aby odblokować przycisk oceny.' : 'Przetłumacz wszystkie zdania, aby odblokować przycisk oceny.') 
                : 'Please complete all sentences to enable the submission button.'}
            </div>
          )}
        </div>
        )
      )}

      {/* PUZZLE SUCCESS STEP */}
      
{step === 'puzzle-success' && (
        <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[50dvh] space-y-6 animate-fade-in-up relative z-10">
          <div className="relative w-48 h-48 flex items-center justify-center mb-6 pointer-events-none">
            {/* Explosion of puzzle pieces */}
            {Array.from({ length: 16 }).map((_, i) => (
              <motion.div
                key={'particle-'+i}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{ 
                  x: Math.cos((i * 22.5) * Math.PI / 180) * (120 + Math.random() * 80), 
                  y: Math.sin((i * 22.5) * Math.PI / 180) * (120 + Math.random() * 80),
                  scale: Math.random() * 1 + 0.5,
                  opacity: 0,
                  rotate: Math.random() * 720 - 360
                }}
                transition={{ duration: 1.5 + Math.random() * 0.5, ease: "easeOut" }}
                className={`absolute w-8 h-8 rounded-md mix-blend-screen pointer-events-none ${['bg-primary', 'bg-primary', 'bg-primary', 'bg-primary'][i % 4]}`}
                style={{ clipPath: 'polygon(10% 0, 90% 0, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0 90%, 0 10%)' }}
              />
            ))}

            {/* Impact wave */}
            <motion.div
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 4, opacity: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute inset-0 rounded-full border-4 border-primary/60 pointer-events-none"
            />

            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", bounce: 0.6, duration: 1 }}
              className="w-28 h-28 bg-gradient-to-br from-primary to-primary rounded-3xl flex items-center justify-center relative z-10 shadow-[0_0_60px_rgba(114, 240, 180,0.8)] backdrop-blur-xl border border-white/30 pointer-events-auto"
            >
              <Puzzle className="w-14 h-14 text-black/90 drop-shadow-lg" />
            </motion.div>
          </div>
          
          <div className="text-center space-y-3 mb-4">
            <h2 className="text-4xl md:text-5xl font-black text-white drop-shadow-md">
              {language === 'pl' ? 'Świetna robota!' : 'Great job!'}
            </h2>
            <p className="text-xl text-primary font-medium drop-shadow">
              {language === 'pl' 
                 ? 'Teraz czas na samodzielne tłumaczenie.' 
                 : 'Now it\'s time for independent translation.'}
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 w-full max-w-sm mt-4 relative z-20 pointer-events-auto">
            <AILoadingButton 
              onClick={handleProceedToTrueChallenge} 
              isLoading={isLoading}
              loadingText={language === 'pl' ? 'Przygotowywanie...' : 'Preparing...'}
              className="relative w-full py-5 text-xl font-black text-white rounded-2xl overflow-hidden group border border-primary/40 bg-gradient-to-b from-primary/50 to-primary/50 backdrop-blur-xl shadow-[0_8px_32px_rgba(114, 240, 180,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_8px_40px_rgba(114, 240, 180,0.5)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-[150%] skew-x-[-30deg] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out" />
              <span className="relative z-10 drop-shadow-md">
                {language === 'pl' ? 'Podejmij Wyzwanie 🔥' : 'Take the Challenge 🔥'}
              </span>
            </AILoadingButton>
            
            <button 
              type="button"
              onClick={handleMaybeLater} 
              className="relative z-30 cursor-pointer text-sm font-medium text-content-muted hover:text-text-hi transition-colors py-2 px-4 hover:underline"
            >
              {language === 'pl' ? 'Może później' : 'Maybe later'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: RESULTS EVALUATION */}
      {step === 'results' && evaluationResults.length > 0 && (
        <div ref={resultsRef} className="max-w-3xl mx-auto space-y-8 px-3 sm:px-0">
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
              <span className="score-text inline-block text-6xl font-black text-primary font-mono drop-shadow-[0_0_15px_rgba(114,240,180,0.4)]">{Number.isNaN(Number(averageScore)) ? 0 : averageScore}%</span>
              <span className="text-sm text-content-muted">/ 100%</span>
            </div>

            <div className="max-w-md mx-auto text-sm text-content-muted">
              {averageScore >= 80 
                ? (language === 'pl' ? 'Fantastyczna robota! Wykazujesz się świetnym wyczuciem językowym.' : 'Fantastic job! You show excellent language proficiency.')
                : averageScore >= 50
                  ? (language === 'pl' ? 'Dobry krok naprzód! Przeanalizuj wskazówki poniżej, aby wyeliminować błędy.' : 'Good progress! Check out the tips below to eliminate mistakes.')
                  : (language === 'pl' ? 'Trening czyni mistrza. Przyjrzyj się objaśnieniom i spróbuj jeszcze raz.' : 'Practice makes perfect. Carefully review the explanations and try again.')}
            </div>

            <div className="pt-4 flex justify-center gap-3">
              <Button onClick={() => returnToSetup()} variant="secondary">
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
          <div className="space-y-3">
            <h3 className="text-lg font-bold border-b border-base-300 pb-2">
              {language === 'pl' ? 'Szczegółowa analiza każdego zdania' : 'Detailed analysis of each sentence'}
            </h3>

            {evaluationResults.map((res, idx) => (
              <SentenceResultCard
                key={idx}
                result={res}
                index={idx}
                modelLabel={canViewAiModels ? formatAIModelName(res.modelUsed) : undefined}
                onPlay={(text, accent) => handlePlaySentenceAudio(text, accent, idx)}
                playing={playingAudioIndex === idx}
              />
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
            className="bg-[var(--surface-flat)] rounded-3xl w-full max-w-4xl max-h-[90dvh] overflow-y-auto border border-white/10 shadow-[0_16px_64px_rgba(0,0,0,0.6)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-20 flex items-center justify-between p-6 bg-[var(--surface-flat)]/95 backdrop-blur-xl border-b border-white/10">
              <div>
                 <h2 className="text-xl font-bold text-white">Tematyka mieszana (Zasoby)</h2>
                 <p className="text-sm text-content-muted">Wybierz kategorię z bazy, aby wygenerować zdania do ćwiczeń.</p>
              </div>
              <button 
                onClick={() => setIsTopicModalOpen(false)}
                className="p-2 rounded-full hover:bg-white/10 text-text-2 hover:text-text-hi transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {isLoadingTopics ? (
                <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : grammarChapters.length === 0 ? (
                <div className="text-center text-text-mute py-8">Brak tematów w bazie. Skonfiguruj w panelu admina.</div>
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
                            className={`p-3 rounded-lg border text-left flex flex-col justify-center min-h-[60px] ${hasSentences ? "border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 text-primary" : "opacity-50 cursor-not-allowed border-transparent bg-black/10 text-text-faint"}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-content-muted">{tIdx + 1}.</span>
                              <span className="font-semibold text-sm truncate flex-1">{topic.name}</span>
                            </div>
                            {hasSentences && <div className="text-[12px] text-primary mt-1 ml-6">{topic.sentences.split("\n").filter((s:string) => s.trim()).length} zdań</div>}
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
