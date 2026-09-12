import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import gsap from 'gsap';
import { auth, db } from '../../firebase';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import Sidebar from './Sidebar';
import ConfirmModal from '../ui/ConfirmModal';
import BugReporter from '../ui/BugReporter';
import AdminMessageModal from '../ui/AdminMessageModal';
import AIExerciseGeneratorScreen from './AIExerciseGeneratorScreen';

import StudentNotifications from './StudentNotifications';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useSettings } from '../../context/SettingsContext';
import { useVocabulary } from '../../context/VocabularyContext';
import { useFlashcards } from '../../context/FlashcardContext';
import { ExerciseType } from '../../types';
import Button from '../ui/Button';
import { ChevronDown, Sparkles, Menu } from 'lucide-react';
import AssignedTasks from './AssignedTasks';
import i18n from "i18next";

type View = 'dashboard' | 'extra-practice' | 'student-today' | 'preview-vocab' | 'preview-homework' | 'preview-history' | 'preview-tests' | 'practice' | 'settings' | 'flashcard-sets' | 'flashcard-edit' | 'flashcard-study' | 'flashcard-stats' | 'admin' | 'admin-stats' | 'admin-history' | 'admin-profile' | 'admin-tests' | 'admin-debugging' | 'presentation' | 'ai-generator' | 'lesson-history' | 'tests' | 'topic-database' | 'student-stats' | 'homework' | 'mailing' | 'admin-mailing' | 'students-database' | 'admin-students-database' | 'students' | 'lesson-scenarios' | 'admin-scenarios' | 'scratchpad';

import AdminPanel from '../admin/AdminPanel';
import StandaloneStudentDatabaseScreen from '../admin/StandaloneStudentDatabaseScreen';
import StandaloneLessonScenariosScreen from '../admin/StandaloneLessonScenariosScreen';
import AdminMailingScreen from '../admin/AdminMailingScreen';
import StudentStatsScreen from './StudentStatsScreen';
import LessonHistoryScreen from './LessonHistoryScreen';
import StudentScratchpadScreen from '../scratchpad/StudentScratchpadScreen';

import TodayScreen from './TodayScreen';
import StudentPreviewFrame from './StudentPreviewFrame';
import StudentVocabPreview from './StudentVocabPreview';
import { HOMEWORK_ENGINE_V2, isModuleVisible } from '../../config/featureFlags';
import StudentTestsScreen from '../tests/StudentTestsScreen';
import AdminStatsScreen from '../admin/AdminStatsScreen';
import FlashcardSetsScreen from '../flashcards/FlashcardSetsScreen';
import FlashcardStudyScreen from '../flashcards/FlashcardStudyScreen';
import FlashcardEditScreen from '../flashcards/FlashcardEditScreen';
import FlashcardStatsScreen from '../flashcards/FlashcardStatsScreen';
import FlashcardPresentationScreen from '../flashcards/FlashcardPresentationScreen';
import SettingsScreen from '../settings/SettingsScreen';
import TopicDatabaseScreen from '../admin/TopicDatabaseScreen';
import HomeworkScreen from './HomeworkScreen';
import StudentHomeworkScreen from './StudentHomeworkScreen';
import StudentHomeworkV2Screen from './StudentHomeworkV2Screen';
import AdminDebuggingScreen from '../admin/AdminDebuggingScreen';
import OnboardingOverlay from './OnboardingOverlay';
import TeacherHomeworkNotification from './TeacherHomeworkNotification';
import StudentHomeworkGradedModal from './StudentHomeworkGradedModal';
import PasswordChangeSuggestion from './PasswordChangeSuggestion';
import { createPresentationFromScenario, savePresentationToStorage } from '../../services/presentationService';

/**
 * Podstrona przeżywa F5. `sessionStorage` (nie `localStorage`) celowo — stan
 * ma żyć w obrębie jednej karty, nie wyciekać do nowej karty ani przetrwać
 * ponad zamknięcie przeglądarki (żeby świeże otwarcie zawsze zaczynało od
 * dashboardu, a nie sprzed tygodnia).
 */
const PANEL_STATE_KEY = 'cribro_panel_view_state';

interface PersistedPanelState {
  view: View;
  activeSetId: string | null;
  adminSelectedUserId: string | null;
  adminActiveTab: string | null;
  activeTaskId: string | null;
  activeTestId: string | null;
  homeworkFilterStatus: string | null;
  previewStudentId: string;
}

const readPersistedPanelState = (): Partial<PersistedPanelState> => {
  try {
    const raw = sessionStorage.getItem(PANEL_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const persistPanelState = (state: PersistedPanelState): void => {
  try {
    sessionStorage.setItem(PANEL_STATE_KEY, JSON.stringify(state));
  } catch {
    // Prywatna karta / zablokowany storage — podstrona po prostu nie przeżyje F5.
  }
};

/**
 * Widoki bez odpowiednika dla kursanta — jeśli sessionStorage niesie jeden
 * z nich (np. współdzielony komputer, poprzednia sesja była lektorem), a
 * aktualne konto nie jest lektorem, wracamy do dashboardu zamiast pokazać
 * pusty/niewłaściwy ekran. Widoki dzielone (np. 'homework', 'tests') NIE są
 * tutaj — te już poprawnie rozgałęziają się po roli wewnątrz `renderContent`.
 */
const TEACHER_ONLY_VIEWS = new Set<View>([
  'admin',
  'admin-stats',
  'admin-history',
  'admin-profile',
  'admin-tests',
  'admin-debugging',
  'ai-generator',
  'mailing',
  'admin-mailing',
  'students-database',
  'admin-students-database',
  'students',
  'lesson-scenarios',
  'admin-scenarios',
]);

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { sets } = useFlashcards();
  const { words, difficultWords, dueWords, frequency, lastPractice, lastRevisionDate } = useVocabulary();
  const { language } = useLanguage();
  const isTeacher = user?.role === 'admin' || user?.role === 'teacher';
  
  // Nauczyciel ląduje we własnym panelu niezależnie od szerokości ekranu.
  // Wcześniej telefon rzucał go do generatora ćwiczeń, czyli do widoku
  // kursanta — obejście z czasów, gdy panel nie był responsywny. Jest.
  //
  // Podstrona przeżywa odświeżenie (F5): stan panelu jest lustrzany w
  // `sessionStorage` (per karta, czyszczone przy zamknięciu) i odczytywany
  // przy starcie, zamiast zawsze zaczynać od 'dashboard'. `pushState`/
  // `popstate` (obsługa przycisku "Wstecz") zostają nietknięte — to osobny
  // mechanizm, obsługujący nawigację w obrębie tej samej sesji SPA, nie F5.
  const restoredPanelState = readPersistedPanelState();
  const [view, setView] = useState<View>(restoredPanelState.view || 'dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [slogan, setSlogan] = useState('');
  const [activeSetId, setActiveSetId] = useState<string | null>(restoredPanelState.activeSetId ?? null);
  // Wybór kursanta we wszystkich kafelkach „Widoku kursanta" naraz — bez
  // tego przełączenie się między kafelkami zerowałoby wybór za każdym razem.
  const [previewStudentId, setPreviewStudentId] = useState<string>(restoredPanelState.previewStudentId || '');
  const [adminSelectedUserId, setAdminSelectedUserId] = useState<string | null>(restoredPanelState.adminSelectedUserId ?? null);
  const [adminActiveTab, setAdminActiveTab] = useState<string | null>(restoredPanelState.adminActiveTab ?? null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(restoredPanelState.activeTaskId ?? null);
  const [activeTestId, setActiveTestId] = useState<string | null>(restoredPanelState.activeTestId ?? null);
  const [homeworkFilterStatus, setHomeworkFilterStatus] = useState<string | null>(restoredPanelState.homeworkFilterStatus ?? null);

  // Kursant nie ma zobaczyć widoku lektora, gdyby ta sama karta przeglądarki
  // (np. współdzielony komputer) nosiła w sessionStorage widok po lektorze —
  // `isTeacher` nie jest jeszcze pewne przy samym `useState`, więc korekta
  // czeka na ustalenie roli użytkownika.
  useEffect(() => {
    if (!user) return;
    if (!isTeacher && TEACHER_ONLY_VIEWS.has(view)) {
      setView('dashboard');
    }
  }, [user?.id, isTeacher]);

  // Zapis podstrony przy każdej zmianie — jedno miejsce, żeby nie dublować
  // logiki w handleNavigate i wszystkich pojedynczych setterach.
  useEffect(() => {
    persistPanelState({
      view,
      activeSetId,
      adminSelectedUserId,
      adminActiveTab,
      activeTaskId,
      activeTestId,
      homeworkFilterStatus,
      previewStudentId,
    });
  }, [view, activeSetId, adminSelectedUserId, adminActiveTab, activeTaskId, activeTestId, homeworkFilterStatus, previewStudentId]);

  // Handle browser back button
  useEffect(() => {
    window.history.replaceState({ view, activeSetId }, '');

    const handlePopState = (e: PopStateEvent) => {
      if (e.state) {
        if (e.state.view) setView(e.state.view);
        if (e.state.activeSetId !== undefined) setActiveSetId(e.state.activeSetId);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (newView: View, extra?: any) => {
    let newSetId = activeSetId;
    if (extra && (extra.setId || extra.activeSetId)) {
      newSetId = extra.setId || extra.activeSetId;
    } else if (newView === 'dashboard' || newView === 'flashcard-sets' || newView === 'topic-database') {
      newSetId = null;
    }

    if (extra && extra.studentId) {
      setAdminSelectedUserId(extra.studentId);
      setPreviewStudentId(extra.studentId);
    }
    if (extra && extra.tab) {
      setAdminActiveTab(extra.tab);
    }

    if (extra && extra.taskId) {
      setActiveTaskId(extra.taskId);
    } else if (newView !== 'homework') {
      setActiveTaskId(null);
    }

    if (extra && extra.testId) {
      setActiveTestId(extra.testId);
    } else if (newView !== 'tests') {
      setActiveTestId(null);
    }

    if (extra && extra.filterStatus) {
      setHomeworkFilterStatus(extra.filterStatus);
    } else if (newView !== 'homework') {
      setHomeworkFilterStatus(null);
    }
    
    if (newView !== view || newSetId !== activeSetId) {
      window.history.pushState({ view: newView, activeSetId: newSetId, activeTaskId: extra?.taskId || null }, '');
      setView(newView);
      setActiveSetId(newSetId);
    }
  };

  const [isExerciseActive, setIsExerciseActive] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [passwordSuggestionDismissed, setPasswordSuggestionDismissed] = useState(false);

  useEffect(() => {
    if (isTeacher || !user) return;
    if (user.onboardingCompleted) return;
    // Obowiązkowy onboarding po pierwszym logowaniu kursanta
    setShowOnboarding(true);
  }, [user?.id, user?.onboardingCompleted, isTeacher]);

  const showPasswordSuggestion = !isTeacher && 
    Boolean(user?.requirePasswordChange || user?.tempPassword) && 
    !user?.passwordChangeDismissed &&
    !passwordSuggestionDismissed &&
    (typeof window !== 'undefined' ? localStorage.getItem(`password_change_dismissed_${user?.id}`) !== 'true' : true);



  const sloganContainerRef = useRef<HTMLDivElement>(null);
  
  // Slogan logic refactored
  useEffect(() => {
    const slogans: { text: string; color: string }[] = [];
    const colors = ['text-primary', 'text-accent-soft', 'text-content', 'text-primary', 'text-text-2'];
    
    // Hasła o passie wracają wyłącznie przez flagę `streak` — passa nie ma być
    // mechanizmem, wokół którego kręci się główny widok, ale kod zostaje na
    // miejscu i wystarczy przestawić jedną wartość w config/featureFlags.ts.
    const showStreak = isModuleVisible('streak');
    const baseSlogans: string[] = [];
    if (language === 'pl') {
      if (showStreak && user?.streakCount && user.streakCount > 2) baseSlogans.push('Niesamowita passa! Masz już ' + user.streakCount + ' dni z rzędu.');
      baseSlogans.push('Wierzę w Ciebie!');
      baseSlogans.push('Każde słowo ma znaczenie.');
      baseSlogans.push('Sukces to suma małych wysiłków.');
    } else {
      if (showStreak && user?.streakCount && user.streakCount > 2) baseSlogans.push('Amazing streak! ' + user.streakCount + ' days in a row.');
      baseSlogans.push('I believe in you!');
      baseSlogans.push('Every word matters.');
      baseSlogans.push('Success is the sum of small efforts.');
    }
    baseSlogans.forEach((text, i) => {
      slogans.push({ text, color: colors[i % colors.length] });
    });
    let currentIndex = 0;
    const animateSlogan = () => {
      if (slogans.length === 0) return;
      const currentSlogan = slogans[currentIndex];
      if (!currentSlogan) return;
      setSlogan(currentSlogan.text || '');
      
      if (sloganContainerRef.current) {
        // Apply color
        sloganContainerRef.current.className = `font-bold ${currentSlogan.color || 'text-primary'}`;
        
        try {
          gsap.fromTo(sloganContainerRef.current,
            { opacity: 0, x: 20 },
            { opacity: 1, x: 0, duration: 0.8, ease: 'power2.out' }
          );
        } catch (e) {
          console.warn('GSAP animation error:', e);
        }
      }
      
      currentIndex = (currentIndex + 1) % slogans.length;
    };
    animateSlogan();
    const interval = setInterval(animateSlogan, 10000); // Change slogan every 10 seconds
    
    return () => clearInterval(interval);
  }, [language, user?.streakCount, words, difficultWords, dueWords]);

  const renderContent = () => {
    if (view === 'student-stats') {
      if (isTeacher) {
        return (
          <AdminPanel
            initialTab="stats"
            initialSelectedUserId={adminSelectedUserId || previewStudentId}
            onUserSelect={(id) => {
              setAdminSelectedUserId(id);
              if (id) setPreviewStudentId(id);
            }}
            onViewChange={handleNavigate}
          />
        );
      }
      return <StudentStatsScreen />;
    }
    if (view === 'admin-stats') {
      return <AdminStatsScreen />;
    }
    if (view === 'lesson-history') {
      if (isTeacher) {
        return (
          <AdminPanel
            initialTab="history"
            initialSelectedUserId={adminSelectedUserId || previewStudentId}
            onUserSelect={(id) => {
              setAdminSelectedUserId(id);
              if (id) setPreviewStudentId(id);
            }}
            onViewChange={handleNavigate}
          />
        );
      }
      return (
        <LessonHistoryScreen
          onStudySet={(setId) => {
            (window as any)._initialStudyMode = 'flashcards';
            handleNavigate('flashcard-study', { setId });
          }}
          onNavigate={(v: any, extra?: any) => handleNavigate(v as View, extra)}
        />
      );
    }
    if (view === 'scratchpad') {
      return <StudentScratchpadScreen />;
    }
    if (view === 'tests') {

      if (isTeacher) {
        return (
          <AdminPanel
            initialTab="tests"
            initialSelectedUserId={adminSelectedUserId || previewStudentId}
            onUserSelect={(id) => {
              setAdminSelectedUserId(id);
              if (id) setPreviewStudentId(id);
            }}
            onViewChange={handleNavigate}
          />
        );
      }
      return <StudentTestsScreen initialTestId={activeTestId || undefined} onBack={() => handleNavigate('dashboard')} />;
    }
    if (view === 'flashcard-sets') {
      return (
        <FlashcardSetsScreen 
          onStudySet={(setId) => {
            (window as any)._initialStudyMode = 'flashcards';
            handleNavigate('flashcard-study', { setId });
          }} 
          onEditSet={(setId) => {
            handleNavigate('flashcard-edit', { setId });
          }} 
          onStatsSet={(setId) => {
            handleNavigate('flashcard-stats', { setId });
          }} 
          onPresentSet={(setId) => {
            handleNavigate('presentation', { setId });
          }} 
          onNavigate={(v: any, extra?: any) => {
            if (extra && (extra.setId || extra.activeSetId)) {
              setActiveSetId(extra.setId || extra.activeSetId);
            }
            setView(v as View);
          }}
        />
      );
    }
    if (view === 'flashcard-study') {
      return <FlashcardStudyScreen 
        setId={activeSetId || ''} 
        initialMode={(window as any)._initialStudyMode} 
        onBack={() => handleNavigate('dashboard')} 
        onNavigate={(v: any, extra?: any) => {
          if (extra && (extra.setId || extra.activeSetId)) setActiveSetId(extra.setId || extra.activeSetId);
          if (extra && extra.initialMode) {
            (window as any)._initialStudyMode = extra.initialMode === 'match' ? 'matching' : extra.initialMode;
          }
          if (extra && extra.autoGenerate !== undefined) {
              (window as any)._autoGenerate = extra.autoGenerate;
            } else {
              delete (window as any)._autoGenerate;
            }
          setView(v as View);
        }} 
        onStartAIPractice={() => {
          setView('ai-generator');
        }}
      />;
    }
    if (view === 'flashcard-edit') {
      return (
        <FlashcardEditScreen 
          setId={activeSetId || ''} 
          onBack={() => handleNavigate('flashcard-sets')} 
          onStudy={(setId) => {
            (window as any)._initialStudyMode = 'flashcards';
            handleNavigate('flashcard-study', { setId });
          }} 
        />
      );
    }
    if (view === 'flashcard-stats') {
      return (
        <FlashcardStatsScreen 
          setId={activeSetId || ''} 
          onBack={() => handleNavigate('flashcard-sets')} 
        />
      );
    }
    if (view === 'presentation') {
      return (
        <FlashcardPresentationScreen 
          setId={activeSetId || ''} 
          onBack={() => handleNavigate('flashcard-sets')} 
        />
      );
    }
    if (view === 'homework') {
      // Kursant i lektor robią przy pracy domowej dwie różne rzeczy: jeden ją
      // rozwiązuje, drugi układa i ocenia. Jeden ekran dla obu ról znaczył, że
      // kursant przewijał się przez filtry i kreator lektora.
      if (isTeacher) {
        return (
          <HomeworkScreen
            initialTaskId={activeTaskId}
            initialFilterStatus={homeworkFilterStatus}
            onBack={() => handleNavigate('dashboard')}
          />
        );
      }
      const homeworkV1 = (
        <StudentHomeworkScreen
          initialTaskId={activeTaskId}
          onBack={() => handleNavigate('dashboard')}
        />
      );
      // Przy włączonej fladze zestawy v2 dostają własny ekran, a kursant bez
      // zestawów v2 widzi dokładnie to, co widział wcześniej.
      return HOMEWORK_ENGINE_V2 && user ? (
        <StudentHomeworkV2Screen user={user} fallback={homeworkV1} />
      ) : (
        homeworkV1
      );
    }
    if (view === 'settings') {
      return <SettingsScreen />;
    }
    if (view === 'topic-database') {
      return <TopicDatabaseScreen />;
    }
    if (view === 'admin-debugging') {
      return <AdminDebuggingScreen onBack={() => handleNavigate('dashboard')} />;
    }
    if (view === 'mailing' || (view as any) === 'admin-mailing') {
      return <AdminMailingScreen onBack={() => handleNavigate('dashboard')} />;
    }
    if (view === 'students-database' || view === 'students' || (view as any) === 'admin-students-database') {
      return (
        <StandaloneStudentDatabaseScreen
          onSelectUser={(userId, targetTab) => {
            setAdminSelectedUserId(userId);
            setPreviewStudentId(userId);
            setAdminActiveTab(targetTab || 'profile');
            handleNavigate('dashboard');
          }}
          onOpenMailing={() => handleNavigate('mailing')}
          onBack={() => handleNavigate('dashboard')}
        />
      );
    }
    if (view === 'lesson-scenarios' || (view as any) === 'admin-scenarios') {
      return (
        <StandaloneLessonScenariosScreen
          onBack={() => handleNavigate('dashboard')}
          onAdaptWithAI={(scenario) => {
            setAdminActiveTab('lesson-planner');
            handleNavigate('dashboard');
          }}
          onOpenInPresentation={async (scenario) => {
            try {
              const pres = createPresentationFromScenario(scenario, adminSelectedUserId || previewStudentId, null);
              await savePresentationToStorage(pres);
              setAdminActiveTab('presentation');
              handleNavigate('dashboard');
            } catch (e) {
              console.error('Błąd uruchamiania w prezentacji:', e);
            }
          }}
        />
      );
    }
    // Wszystkie widoki admin-* (admin-profile, admin-history, admin-tests itd.)
    // oraz sam 'admin' i domyślny 'dashboard' dla lektora — AdminPanel z właściwą
    // zakładką. Bez tego wybranie kursanta i kliknięcie kafelka przenosiło do
    // widoku kursanta zamiast zostać w panelu nauczyciela.
    if (view === 'admin' || (isTeacher && view === 'dashboard') || (typeof view === 'string' && view.startsWith('admin-'))) {
      const tabFromView = typeof view === 'string' && view.startsWith('admin-')
        ? view.replace('admin-', '')
        : adminActiveTab || undefined;
      return (
        <AdminPanel
          initialTab={tabFromView}
          initialSelectedUserId={adminSelectedUserId || previewStudentId}
          onUserSelect={(id) => {
            setAdminSelectedUserId(id);
            if (id) setPreviewStudentId(id);
          }}
          onViewChange={handleNavigate}
        />
      );
    }

    // „Widok kursanta" — pięć kafelków lektora, każdy dokładnie ten sam
    // ekran, który dostaje kursant. Wybór kursanta jest jeden na całą sekcję
    // (previewStudentId), więc przełączanie kafelków go nie zeruje.
    if (view === 'student-today') {
      return (
        <StudentPreviewFrame studentId={previewStudentId} onStudentIdChange={setPreviewStudentId}>
          {(id) => (
            <TodayScreen
              studentId={id}
              onOpenExtraPractice={() => handleNavigate('extra-practice')}
              onOpenHomework={(taskId) => handleNavigate('homework', taskId ? { taskId } : undefined)}
              onOpenTests={(testId) => handleNavigate('tests', testId ? { testId } : undefined)}
              onStudySet={(setId) => {
                (window as any)._initialStudyMode = 'flashcards';
                handleNavigate('flashcard-study', { setId });
              }}
              onPracticeAI={(setId) => handleNavigate('ai-generator', { setId })}
            />
          )}
        </StudentPreviewFrame>
      );
    }
    if (view === 'preview-vocab') {
      return (
        <StudentPreviewFrame studentId={previewStudentId} onStudentIdChange={setPreviewStudentId}>
          {(id) => <StudentVocabPreview studentId={id} />}
        </StudentPreviewFrame>
      );
    }
    if (view === 'preview-history') {
      return (
        <StudentPreviewFrame studentId={previewStudentId} onStudentIdChange={setPreviewStudentId}>
          {(id) => (
            <LessonHistoryScreen
              studentId={id}
              onNavigate={(v: any, extra?: any) => handleNavigate(v as View, extra)}
            />
          )}
        </StudentPreviewFrame>
      );
    }
    if (view === 'preview-tests') {
      return (
        <StudentPreviewFrame studentId={previewStudentId} onStudentIdChange={setPreviewStudentId}>
          {(id) => <StudentTestsScreen studentId={id} onBack={() => handleNavigate('dashboard')} />}
        </StudentPreviewFrame>
      );
    }
    if (view === 'preview-homework') {
      return (
        <StudentPreviewFrame studentId={previewStudentId} onStudentIdChange={setPreviewStudentId}>
          {(id) => <StudentHomeworkScreen studentId={id} onBack={() => handleNavigate('dashboard')} />}
        </StudentPreviewFrame>
      );
    }

    // Domyślne wejście kursanta to jego panel, nie generator. Generator nadal
    // istnieje i działa pod dwoma wejściami: „Praktyka dodatkowa" w menu oraz
    // `ai-generator`, którego używają przyciski „Przećwicz w zdaniach AI"
    // w zestawach, fiszkach i przy lekcjach. Gdyby `ai-generator` też trafiał
    // tutaj, te przyciski przestałyby cokolwiek robić.
    if (view !== 'extra-practice' && view !== 'ai-generator') {
      if (isTeacher) {
        return (
          <AdminPanel
            initialTab={adminActiveTab || null}
            initialSelectedUserId={adminSelectedUserId || previewStudentId}
            onUserSelect={(id) => {
              setAdminSelectedUserId(id);
              if (id) setPreviewStudentId(id);
            }}
            onViewChange={handleNavigate}
          />
        );
      }

      const panelProps = {
        onOpenExtraPractice: () => handleNavigate('extra-practice'),
        onOpenHomework: (taskId?: string) =>
          handleNavigate('homework', taskId ? { taskId } : undefined),
        onOpenTests: (testId?: string) =>
          handleNavigate('tests', testId ? { testId } : undefined),
        onStudySet: (setId: string) => {
          (window as any)._initialStudyMode = 'flashcards';
          handleNavigate('flashcard-study', { setId });
        },
        onPracticeAI: (setId: string) => handleNavigate('ai-generator', { setId }),
        onOpenScratchpad: () => handleNavigate('scratchpad'),
      };

      // Fallback obsługuje wyłącznie panel własny kursanta
      return <TodayScreen {...panelProps} />;
    }

    return <AIExerciseGeneratorScreen 
      onShowOnboarding={() => setShowOnboarding(true)}
      initialSetId={activeSetId}
      autoGenerate={(window as any)._autoGenerate}
      onChangeView={(newView, extra) => {
        if (extra && (extra.setId || extra.activeSetId)) setActiveSetId(extra.setId || extra.activeSetId);
        if (extra && extra.initialMode) {
          (window as any)._initialStudyMode = extra.initialMode === 'match' ? 'matching' : extra.initialMode;
        }
        setView(newView as View);
      }}
      onStartPractice={(type, mode1, mode2) => {
        // Fallback or specific logic if needed
      }}
    />;
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden">
      <Sidebar 
        currentView={view} 
        onNavigate={(newView, extra) => handleNavigate(newView, extra)}
        onStartPractice={(exercise) => console.log('start practice', exercise)} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpen={() => setIsSidebarOpen(true)}
        isDesktopCollapsed={isDesktopCollapsed}
        onShowOnboarding={() => setShowOnboarding(true)}
        onToggleCollapse={() => {
          setIsDesktopCollapsed(prev => {
            const next = !prev;
            try {
              localStorage.setItem('sidebar_collapsed', String(next));
            } catch (e) {}
            return next;
          });
        }}
      />
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative min-w-0">
        <StudentNotifications onNavigate={(newView) => handleNavigate(newView)} currentView={view} />
        {showPasswordSuggestion && (
          <div className="px-4 pt-4 max-w-5xl mx-auto w-full">
            <PasswordChangeSuggestion onClose={() => setPasswordSuggestionDismissed(true)} />
          </div>
        )}
        {isTeacher && (
          <TeacherHomeworkNotification
            onOpenHomework={(taskId) =>
              handleNavigate('homework', { taskId, filterStatus: 'submitted' })
            }
            onOpenV2Review={() => handleNavigate('homework', { filterStatus: 'v2review' })}
          />
        )}
        {!isTeacher && view !== 'homework' && (
          <StudentHomeworkGradedModal
            onOpenHomework={(taskId) => handleNavigate('homework', { taskId })}
          />
        )}
        {showOnboarding && <OnboardingOverlay onComplete={() => {
          setShowOnboarding(false);
          try { localStorage.setItem('has_seen_onboarding', 'true'); } catch(e) {}
          if (user?.id && !user.onboardingCompleted) {
            updateDoc(doc(db, 'users', user.id), { onboardingCompleted: true }).catch(console.error);
          }
        }} language={language} />}
        {renderContent()}
      </main>
      <AdminMessageModal />
    </div>
  );
};

export default Dashboard;
