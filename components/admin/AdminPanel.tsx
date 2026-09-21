import { 
  createLessonRecordWithVocabularySet, 
  syncFlashcardSetForLesson, 
  getLessonRecordsForStudent, 
  getAllLessonRecordsForTeacher,
  deleteLessonRecord,
  rejectNotionLesson,
  restoreRejectedNotionLesson,
  getRejectedNotionLessons,
  confirmPendingLesson
} from '../../services/lessonRecord';
import { getAllUsers, invalidateUsersCache, updateCachedUser, removeCachedUser, addCachedUser } from '../../services/userService';

import VocabularyApproval from './VocabularyApproval';
import RecallItemsReview, { ReviewedCandidate } from './RecallItemsReview';
import { saveRecallReview } from '../../services/recallItems';
import { countVocabularyItems, buildVocabularySetTitle, splitVocabularyLines } from '../../utils/vocabulary';
import { isLessonPendingConfirmation, extractLessonBlocks } from '../../utils/lessonBlocks';
import { getDisplayLessonTopic } from '../../utils/lessonDisplay';
import { CascadingLessonDetails } from './CascadingLessonDetails';
import { getGeneratedScenarios } from '../../services/scenarioService';
import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { motion, AnimatePresence } from 'motion/react';
import { collection, getDocs, getDoc, doc, deleteDoc, query, orderBy, setDoc, writeBatch, updateDoc, addDoc, where, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { User, PracticeLog, FlashcardSet, LessonRecord, GeneratedLessonScenario, RejectedNotionItem } from '../../types';
import { useFlashcards } from '../../context/FlashcardContext';
import { useAuth } from '../../context/AuthContext';
import { generateLessonSummary, generateBulkLessonSummary } from '../../services/geminiService';
import { useFirebaseAdminApi } from '../../hooks/useFirebaseAdminApi';
import { importVocabularyFromLessons } from '../../services/vocabularyService';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { GSAPModal } from '../ui/GSAPModal';
import AdminTestGenerator from './AdminTestGenerator';
import AllTestsTeacherView from './AllTestsTeacherView';
import PublicTestPanel from './PublicTestPanel';

import TeacherDashboardStats from './TeacherDashboardStats';
import TeacherSpecialTaskModal from './TeacherSpecialTaskModal';
import AssignVocabularyModal from './AssignVocabularyModal';
import HomeworkScreen from '../dashboard/HomeworkScreen';
import TeacherWorkScreen from '../dashboard/TeacherWorkScreen';
import FlashcardSetsScreen from '../flashcards/FlashcardSetsScreen';
import AdminStatsScreen from './AdminStatsScreen';
import { isTaskForStudent } from '../../utils/homework';
import TeacherOverview from './TeacherOverview';
import LessonPlannerStudio from './LessonPlannerStudio';
import { LessonPresentationView } from './presentation/LessonPresentationView';
import { createPresentationFromScenario, savePresentationToStorage } from '../../services/presentationService';
import LessonSourceBar from './LessonSourceBar';
import MenuDropdown from '../ui/MenuDropdown';
import StudentPanelSection from './StudentPanelSection';
import StudentProfileHeader from './StudentProfileHeader';
import StudentInviteEmailModal from './StudentInviteEmailModal';
import CleanLessonsModal from './CleanLessonsModal';
import LessonDuplicatesPanel from './LessonDuplicatesPanel';
import { sortChronologically } from '../../utils/lessonDuplicates';
import { confirmAsync } from '../../utils/appAlert';
import AdminMailingScreen from './AdminMailingScreen';
import ScratchpadStudentPicker from '../scratchpad/ScratchpadStudentPicker';
import { openScratchpadTab } from '../../services/scratchpadService';
import TeacherAttentionBanner from './TeacherAttentionBanner';
import TeacherLessonHistoryView from './TeacherLessonHistoryView';
import { NotionImportPreviewModal, NotionPreviewItem } from './NotionImportPreviewModal';
import { formatStudentDisplayName } from '../../utils/studentFormat';
import { StandaloneStudentDatabaseScreen } from './StandaloneStudentDatabaseScreen';
import TeacherAssistant from './TeacherAssistant';
import { LessonDraftProposal } from '../../services/teacherAssistant';
import TeacherTodayCockpit from './TeacherTodayCockpit';
import TeacherMobileHub from './TeacherMobileHub';
import DesktopOnlyNotice from '../ui/DesktopOnlyNotice';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import StudentOperationalHub from './StudentOperationalHub';
import { StudentRecallHub } from '../recall/StudentRecallHub';
import GSAPModuleTransition from '../ui/GSAPModuleTransition';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Trash2, Download, Printer, FileText, CheckCircle2, AlertCircle,
  User as UserIcon, Users, Search, X, ChevronRight, ChevronDown, ChevronUp, Sparkles, BarChart2, Clock, 
  BookOpen, BookMarked, UserCheck, Filter, Award, Activity, Calendar, 
  RefreshCw, Plus, Eye, Shield, Target, CalendarClock, Layers, Link as LinkIcon, Airplay, Mail, Database, Wand2,
  AlertTriangle, Edit3, Save, Bell, BellOff, Lock, Copy, Key, Send, Archive, CheckSquare, Square, Edit2, FileEdit, Mic,
  ClipboardList, Brain
} from 'lucide-react';

import i18n from "i18next";
import html2pdf from 'html2pdf.js';
import { useEscapeModal } from '../../hooks/useEscapeModal';

interface UserWithId extends User {
  id: string;
}

interface AdminPanelProps { 
  initialTab?: string | null; 
  onViewChange?: (view: any, extra?: any) => void; 
  initialSelectedUserId?: string | null; 
  initialLessonDraft?: LessonDraftProposal | null;
  initialScenario?: GeneratedLessonScenario | null;
  onUserSelect?: (userId: string | null) => void; 
  onTabChange?: (tab: string | null) => void;
}

/**
 * Przebudowa panelu wg docs/kolejka-przebudowa-panelu.md: Przegląd panelu i
 * skróty "AI Lesson Generator" / "Dodaj kursanta" chowają się stąd (nie są
 * kasowane — kod zostaje pod spodem), bo:
 * - "Dodaj kursanta" ma już własny, pełny odpowiednik w zakładce sidebara
 *   "Baza kursantów" (StandaloneStudentDatabaseScreen.tsx) — bez regresji.
 * - "AI Lesson Generator" i "Przegląd panelu" to świadomie odłożone na
 *   później, mniej używane narzędzia (brief: "mniej znaczy lepiej").
 * Odwrócenie: jedna zmiana tej stałej na `true`.
 */
const SHOW_LEGACY_PANEL_TOOLS = false;

/**
 * Zakładki profilu kursanta scalone z 6+ do 4 (Hub / Moje lekcje / Praca
 * domowa / Profil & Dane) — CRM: tabela kursantów, tooltipy i nowy profil
 * ucznia. „Spaced Repetition (Recall)" (metryki wchłonięte przez Hub) i
 * „Aktywność i statystyki" (wchłonięte przez „Profil & Dane") oraz
 * „Słownictwo & AI" i „Testy AI" nie zostały usunięte — tylko schowane z
 * paska zakładek, żeby dało się je łatwo przywrócić bez grzebania w git.
 * Odwrócenie: jedna zmiana tej stałej na `true`.
 */
const SHOW_LEGACY_STUDENT_TABS = false;

const AdminPanel: React.FC<AdminPanelProps> = ({ initialTab, onViewChange, initialSelectedUserId, initialLessonDraft, initialScenario, onUserSelect, onTabChange }) => {
  const { sets: adminSets, getFlashcards } = useFlashcards();
  const { language } = useLanguage();
  const { connectGoogleDrive, connectGoogleWorkspace } = useAuth();
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('google_workspace_access_token');
    } catch {
      return null;
    }
  });
  const { createUser, deleteUser, changeUserRole: updateRoleApi, changeUserPassword, changeUserEmail } = useFirebaseAdminApi();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  /** Próg `md` (768px) — poniżej niego pulpit lektora zamienia się w Pocket Companion. */
  const isDesktopUI = useIsDesktop();
  const [assistantOverlayOpen, setAssistantOverlayOpen] = useState(false);
  /** Kafelek "Narzędzia lektora" otwiera lekki podwidok z zestawem narzędzi drugorzędnych. */
  const [toolsDrawerOpen, setToolsDrawerOpen] = useState(false);
  const [profileSaveModal, setProfileSaveModal] = useState<{ isOpen: boolean; success: boolean; title: string; message: string } | null>(null);
  /**
   * Która sekcja profilu jest widoczna.
   *
   * ══ DLACZEGO JEDNA NARAZ ══
   *
   * Profil kursanta miał pięć rozłożonych kart pod sobą: dane, mailing, poziom
   * i prompty AI, Notion, uprawnienia. Razem około dwudziestu pól, trzech
   * przełączników i siedmiu przycisków na jednym przewijanym ekranie — z czego
   * przy każdym wejściu rusza się jedną, najwyżej dwie rzeczy. Reszta była
   * tłem, przez które trzeba przewinąć.
   *
   * Teraz jest to lista sekcji i JEDNA otwarta. Wysokość ekranu przestaje
   * zależeć od tego, ile pól ma akurat wybrana sekcja — panel jest za każdym
   * razem tego samego kształtu.
   */
  const [profileSection, setProfileSection] = useState<
    'basic' | 'mail' | 'level' | 'activity' | 'access'
  >('basic');
  

  const fetchUsers = async (forceRefresh = false) => {
    try {
      const usersList = (await getAllUsers(forceRefresh)) as UserWithId[];
      setUsers(usersList);
      fetchAllLessons(usersList, forceRefresh);
      setIsLoading(false);
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  const fetchUserLogsAndStats = async (userId: string) => {
    try {
      // Fetch fresh User doc to get latest loginCount and lastLoginDate
      try {
        const uDoc = await getDoc(doc(db, 'users', userId));
        if (uDoc.exists()) {
          const freshData = { id: uDoc.id, ...uDoc.data() } as UserWithId;
          setSelectedUser(prev => prev && prev.id === userId ? { ...prev, ...freshData } : freshData);
          setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...freshData } : u));
        }
      } catch (e) {}

      // Fetch Lesson Records
      const lessonsQ = query(collection(db, `users/${userId}/lessonRecords`));
      const lessonsSnapshot = await getDocs(lessonsQ);
      const lessonsList = lessonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonRecord));
      lessonsList.sort((a, b) => {
        const dateB = new Date(b.date).getTime();
        const dateA = new Date(a.date).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      setLessonRecords(lessonsList);

      // Fetch Rejected Notion Lessons
      try {
        const rej = await getRejectedNotionLessons(userId);
        setRejectedLessons(rej);
      } catch (e) {
        console.warn('Could not fetch rejected lessons:', e);
      }

      // Fetch Practice Logs
      const logsQ = query(collection(db, `users/${userId}/practiceLogs`));
      const logsSnapshot = await getDocs(logsQ);
      const logsList = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PracticeLog));
      logsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPracticeLogs(logsList);

      let fetchedSets: FlashcardSet[] = [];
      // Fetch User's Flashcard Sets
      try {
        const setsQ = query(collection(db, `users/${userId}/wordSets`));
        const setsSnapshot = await getDocs(setsQ);
        fetchedSets = setsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FlashcardSet));
        fetchedSets.sort((a, b) => new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt).getTime() - new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt).getTime());
        setUserSets(fetchedSets);
      } catch(e) { console.error("Error fetching sets", e); }

      let fetchedTasks: any[] = [];
      try {
        const targetStudent = users.find(u => u.id === userId) || selectedUser || { id: userId };
        const tasksSnapshot = await getDocs(collection(db, 'specialTasks'));
        tasksSnapshot.docs.forEach(doc => {
          const t = { id: doc.id, ...doc.data() } as any;
          if (isTaskForStudent(t, targetStudent)) {
            fetchedTasks.push(t);
          }
        });
        fetchedTasks.sort((a, b) => new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt).getTime() - new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt).getTime());
        setSpecialTasks(fetchedTasks);
      } catch(e) { console.error("Error fetching special tasks", e); }

      // Dynamic real stats calculation
      let totalSentencesCount = 0;
      let totalScoreSum = 0;
      let validLogsCount = 0;

      logsList.forEach(l => {
        if ((l.exerciseType as string) === 'Aktywność') return;
        validLogsCount++;
        
        const scoreVal = Number(l.score);
        totalScoreSum += isNaN(scoreVal) ? 0 : scoreVal;

        let count = 0;
        if (l.totalWords !== undefined && l.totalWords !== null) {
          const wNum = Number(l.totalWords);
          count = isNaN(wNum) ? 0 : wNum;
        } else if (Array.isArray(l.exercisesData)) {
          count = l.exercisesData.length;
        } else if (Array.isArray((l as any).detailedFeedback)) {
          count = (l as any).detailedFeedback.length;
        } else if (typeof l.exercisesData === 'string' && l.exercisesData) {
          count = l.exercisesData.split(' | ').length;
        }
        totalSentencesCount += isNaN(count) ? 0 : count;
      });

      const calcAvg = validLogsCount > 0 ? Math.round(totalScoreSum / validLogsCount) : 0;
      const avgScore = isNaN(calcAvg) ? 0 : calcAvg;

      let totalVocabCount = 0;
      let difficultVocabCount = 0;

      fetchedSets.forEach(set => {
        if (Array.isArray(set.words)) {
          totalVocabCount += set.words.length;
          set.words.forEach((w: any) => {
            if (w.status === 'difficult' || w.difficulty === 'hard' || w.isDifficult) {
              difficultVocabCount++;
            }
          });
        }
      });

      const finalSentencesCount = Math.max(totalSentencesCount, selectedUser?.translatedSentencesCount || 0);

      setUserStats({
        totalTasks: validLogsCount,
        totalSentences: finalSentencesCount,
        averageScore: avgScore,
        totalWords: totalVocabCount || finalSentencesCount,
        difficultWords: difficultVocabCount,
        masteryCount: avgScore
      });
    } catch (e: any) {
      console.error('Error fetching logs and stats:', e);
    }
  };

  const handleSelectUser = (user: UserWithId, targetTab?: string) => {
    setSelectedUser(user);
    // 'context' zniknął z tej listy razem z zakładką — kontekst przed lekcją
    // jest kafelkiem pulpitu z własnym wyborem kursanta (PreLessonContextModal).
    const validStudentTabs = ['hub', 'profile', 'history', 'homework', 'vocabulary', 'tests', 'stats'];
    const nextTab = targetTab || (activeTab && validStudentTabs.includes(activeTab) ? activeTab : 'hub');
    setActiveTab(nextTab);
    if (onUserSelect) onUserSelect(user.id);
    fetchUserLogsAndStats(user.id);
    setIsStudentPickerOpen(false);
    setTimeout(() => {
      tabContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const handleTileClick = (tabId: string) => {
    if (tabId === 'notatnik') {
      setIsNotebookPickerOpen(true);
      return;
    }
    const mappedTab = tabId === 'history' ? 'lesson-history' : tabId;
    setActiveTab((prev) => (prev === mappedTab || (mappedTab === 'lesson-history' && prev === 'history') ? null : mappedTab));
    setTimeout(() => {
      tabContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const handleSaveProfile = async (silent = false, formState = profileForm) => {
    if (!selectedUser) return;
    setIsSavingProfile(true);
    try {
      const trimmedEmail = (formState.email || '').trim().toLowerCase();
      const currentEmail = (selectedUser.email || '').trim().toLowerCase();
      const emailChanged = Boolean(trimmedEmail && trimmedEmail !== currentEmail);

      if (emailChanged) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
          throw new Error(i18n.t('Podano niepoprawny format adresu e-mail.'));
        }
      }

      const userRef = doc(db, 'users', selectedUser.id);
      const updates: any = {
        firstName: formState.firstName,
        lastName: formState.lastName,
        level: formState.level,
        description: formState.description,
        aiPrompt: formState.aiPrompt,
        emailNotificationsDisabled: Boolean(formState.emailNotificationsDisabled),
        role: formState.role || selectedUser.role || 'user',
      };
      if (trimmedEmail) {
        updates.email = trimmedEmail;
      }

      await updateDoc(userRef, updates);

      if (emailChanged) {
        changeUserEmail(selectedUser.id, trimmedEmail).catch((authErr) => {
          console.warn('[Admin Auth Email Sync Warning]:', authErr);
        });
      }
      const updatedUser = { 
        ...selectedUser, 
        ...formState, 
        email: trimmedEmail || selectedUser.email,
        emailNotificationsDisabled: Boolean(formState.emailNotificationsDisabled),
        role: formState.role || selectedUser.role || 'user',
      };
      setSelectedUser(updatedUser);
      setUsers(users.map(u => u.id === selectedUser.id ? updatedUser : u));
      if (!silent) {
        setProfileSaveModal({
          isOpen: true,
          success: true,
          title: i18n.t('Profil Zapisany Pomyślnie'),
          message: i18n.t(`Zmiany w profilu kursanta ${formState.firstName || ''} ${formState.lastName || ''} zostały pomyślnie zaktualizowane w bazie danych.`)
        });
      }
    } catch (e: any) {
      if (!silent) {
        setProfileSaveModal({
          isOpen: true,
          success: false,
          title: i18n.t('Błąd Zapisywania Profilu'),
          message: i18n.t(`Nie udało się zapisać zmian: ${e.message || e}`)
        });
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    try {
      await deleteUser(uid);
      await deleteDoc(doc(db, 'users', uid));
      removeCachedUser(uid);
      setUsers(users.filter(u => u.id !== uid));
      if (selectedUser?.id === uid) setSelectedUser(null);
    } catch (e: any) {
      alert('Błąd podczas usuwania użytkownika: ' + e.message);
    }
  };
  const fetchDriveFiles = async (mode?: 'single' | 'bulk') => {
    setDriveModalMode(mode || 'single');
    setDriveLoading(true);
    setDriveError(null);
    setShowDriveModal(true);

    try {
      let token = driveAccessToken;
      if (!token) {
        token = connectGoogleWorkspace ? await connectGoogleWorkspace() : await connectGoogleDrive();
        setDriveAccessToken(token);
      }

      const q = encodeURIComponent("mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain' or mimeType = 'application/pdf' or mimeType = 'application/vnd.google-apps.file' and trashed = false");
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=30&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime%20desc`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          token = connectGoogleWorkspace ? await connectGoogleWorkspace() : await connectGoogleDrive();
          setDriveAccessToken(token);
          const retryRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=30&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime%20desc`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          if (!retryRes.ok) throw new Error(`Google Drive error (${retryRes.status})`);
          const data = await retryRes.json();
          setDriveFiles(data.files || []);
        } else {
          throw new Error(`Google Drive error (${response.status})`);
        }
      } else {
        const data = await response.json();
        setDriveFiles(data.files || []);
      }
    } catch (err: any) {
      console.error("Error fetching Drive files:", err);
      setDriveError(err.message || 'Nie udało się pobrać plików z Google Drive.');
    } finally {
      setDriveLoading(false);
    }
  };

  const processDriveFile = async (file: any) => {
    setDriveLoading(true);
    setDriveError(null);
    try {
      let token = driveAccessToken;
      if (!token) {
        token = connectGoogleWorkspace ? await connectGoogleWorkspace() : await connectGoogleDrive();
        setDriveAccessToken(token);
      }

      let textContent = '';
      if (file.mimeType === 'application/vnd.google-apps.document') {
        const exportRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!exportRes.ok) throw new Error('Nie udało się wyeksportować pliku Google Docs');
        textContent = await exportRes.text();
      } else if (file.mimeType === 'text/plain') {
        const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!fileRes.ok) throw new Error('Nie udało się pobrać zawartości pliku tekstowego');
        textContent = await fileRes.text();
      } else if (file.mimeType === 'application/pdf') {
        const pdfRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!pdfRes.ok) throw new Error('Nie udało się pobrać pliku PDF');
        const pdfBlob = await pdfRes.blob();
        const arrayBuffer = await pdfBlob.arrayBuffer();
        try {
          const pdfjsLib = (window as any).pdfjsLib;
          if (pdfjsLib) {
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const text = await page.getTextContent();
              fullText += text.items.map((item: any) => item.str).join(' ') + '\n';
            }
            textContent = fullText;
          } else {
            textContent = await pdfBlob.text();
          }
        } catch {
          textContent = await pdfBlob.text();
        }
      } else {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        textContent = await res.text();
      }

      if (driveModalMode === 'bulk') {
        setBulkNotes(textContent);
      } else {
        setRawMeetingNotes(textContent);
      }
      setShowDriveModal(false);
      showToast('Wczytano treść pliku z Google Drive!');
    } catch (err: any) {
      console.error("Error processing Drive file:", err);
      setDriveError(err.message || 'Błąd podczas odczytywania pliku z Google Drive.');
    } finally {
      setDriveLoading(false);
    }
  };

  const mapStudents = () => users.map(u => ({ id: u.id, name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username, level: u.level, description: u.description }));

  const applySingleSummary = (data: any) => {
    const ids: string[] = data.studentIds && Array.isArray(data.studentIds) && data.studentIds.length > 0
      ? data.studentIds
      : (data.studentId ? [data.studentId] : (selectedUser?.id ? [selectedUser.id] : []));

    setLessonFormStudentIds(ids);
    setLessonFormStudentId(ids[0] || '');
    if (data.lessonTopic) setLessonFormTopic(data.lessonTopic);
    if (data.revisionNotes) setLessonFormSummary(data.revisionNotes);
    if (data.vocabularyText) setLessonFormWords(data.vocabularyText);
    if (data.studentSpeaking) setLessonFormStudentSpeaking(data.studentSpeaking);
    /* Korekty i plan na kolejną lekcję mają teraz własne pola w odpowiedzi.
       Starsze wywołania (notatki, import zbiorczy) ich nie zwracają, więc
       wpadamy z powrotem na `thingsToImprove` / `suggestedFollowUp`. */
    const correctionsText = data.corrections || data.thingsToImprove;
    if (correctionsText) setLessonFormThingsToImprove(correctionsText);
    const nextLessonText = data.nextLessonPlan || data.suggestedFollowUp;
    if (nextLessonText) setLessonFormSuggestedFollowUp(nextLessonText);
    if (data.homeworkText) setLessonFormHomework(data.homeworkText);
    if (data.homeworkAnswerKey) setLessonFormAnswerKey(data.homeworkAnswerKey);

    /* Data z materiału ma pierwszeństwo nad dzisiejszą. Wstawianie dzisiejszej
       zawsze było zgadywaniem: lekcję z transkrypcji opracowuje się często
       dzień czy dwa po zajęciach, a zła data rozjeżdża numerację w historii. */
    const parsedDate = typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date.trim())
      ? data.date.trim()
      : '';
    setLessonFormDate(parsedDate || new Date().toISOString().split('T')[0]);
    setShowAIModal(false);
    setRawMeetingNotes('');
    setLessonRecordModalMode('edit');
    setShowLessonRecordModal(true);
    setEditingRecordId(null);
  };

  /**
   * Wczytanie pliku TEKSTOWEGO do pola materiału.
   *
   * Transkrypcje z narzędzi nagrywających przychodzą jako .txt, .md, .vtt
   * albo .srt — nie jako PDF. Dotąd jedynym przyciskiem był „Załaduj plik
   * PDF", więc transkrypcję trzeba było otworzyć w innym programie,
   * zaznaczyć całość i wkleić ręcznie.
   *
   * Znaczniki czasu z napisów (.vtt/.srt) lecą do kosza przy wczytaniu:
   * dla modelu to szum, a przy godzinnej lekcji potrafią być połową znaków
   * przesyłanych do API.
   */
  const handleTranscriptFileUpload = async (e: any, mode?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const cleaned = raw
        // Nagłówek WebVTT i numery kolejnych napisów.
        .replace(/^WEBVTT.*$/gim, '')
        .replace(/^\d+\s*$/gm, '')
        // Linie znaczników czasu: 00:00:12.500 --> 00:00:15.000
        .replace(/^\s*\d{1,2}:\d{2}(:\d{2})?[.,]\d{1,3}\s*-->.*$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (!cleaned) {
        const msg = 'Plik jest pusty albo nie zawiera tekstu do przetworzenia.';
        if (mode === 'bulk') setBulkSummaryError(msg);
        else setSummaryError(msg);
        return;
      }

      if (mode === 'bulk') setBulkNotes(cleaned);
      else setRawMeetingNotes(cleaned);
      showToast(`Wczytano ${file.name} (${cleaned.length.toLocaleString('pl-PL')} znaków).`);
    } catch (err: any) {
      const msg = err?.message || 'Nie udało się odczytać pliku.';
      if (mode === 'bulk') setBulkSummaryError(msg);
      else setSummaryError(msg);
    } finally {
      e.target.value = '';
    }
  };

  const handlePdfUpload = async (e: any, mode?: string) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result?.toString().split(',')[1];
      if (!base64) return;
      
      setIsGenerating(true);
      setSummaryError('');
      setBulkSummaryError('');
      try {
        const studentsStr = mapStudents().map((s: any) => `ID: ${s.id} | Imię/Nazwisko: ${s.name} | Poziom: ${s.level} | Opis: ${s.description}`).join('\n');
        const fallbackStudentId = selectedUser?.id || '';
        const targetStudentName = selectedUser ? (`${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.username) : '';

        // Plik z transkrypcją idzie tą samą drogą co wklejona transkrypcja:
        // jedna lekcja, polecenie systemowe dla zapisu rozmowy.
        if (mode !== 'bulk' && aiSourceKind === 'transcript') {
          const transcriptData = await generateLessonSummary('', base64, studentsStr, 'transcript');
          if (selectedUser?.id && !transcriptData.studentId) transcriptData.studentId = selectedUser.id;
          applySingleSummary(transcriptData);
          return;
        }

        const data = await generateBulkLessonSummary('', base64, studentsStr, fallbackStudentId, targetStudentName);

        if (data?.lessons && Array.isArray(data.lessons) && data.lessons.length > 0) {
          const lessonsWithStudent = data.lessons.map((l: any) => {
            let ids = l.studentIds && Array.isArray(l.studentIds) && l.studentIds.length > 0
              ? l.studentIds
              : (l.studentId ? [l.studentId] : []);
            if (fallbackStudentId && (ids.length === 0 || !users.some(u => ids.includes(u.id)))) {
              ids = [fallbackStudentId];
            }
            return {
              ...l,
              studentId: ids[0] || fallbackStudentId || '',
              studentIds: ids.length > 0 ? ids : (fallbackStudentId ? [fallbackStudentId] : [])
            };
          });

          if (lessonsWithStudent.length > 1 || mode === 'bulk') {
            setBulkPreviewLessons(lessonsWithStudent);
            setShowBulkPreviewModal(true);
            setShowBulkModal(false);
            setShowAIModal(false);
          } else {
            applySingleSummary(lessonsWithStudent[0]);
          }
        } else {
          const singleData = await generateLessonSummary('', base64, studentsStr);
          if (selectedUser?.id && !singleData.studentId) singleData.studentId = selectedUser.id;
          applySingleSummary(singleData);
        }
      } catch (err: any) {
        const errMsg = err.message || 'Wystąpił błąd podczas analizowania pliku PDF.';
        if (mode === 'bulk') setBulkSummaryError(errMsg);
        else setSummaryError(errMsg);
      } finally {
        setIsGenerating(false);
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateFromNotes = async () => {
    if (!rawMeetingNotes.trim()) return;
    setIsGenerating(true);
    setSummaryError('');
    try {
      const studentsStr = mapStudents().map((s: any) => `ID: ${s.id} | Imię/Nazwisko: ${s.name} | Poziom: ${s.level} | Opis: ${s.description}`).join('\n');
      const fallbackStudentId = selectedUser?.id || '';
      const targetStudentName = selectedUser ? (`${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.username) : '';

      /* Transkrypcja = JEDNA lekcja. Droga zbiorcza szuka w materiale
         nagłówków kolejnych lekcji i przy zapisie rozmowy rozcinała jedne
         zajęcia na kilka wpisów w miejscach, gdzie zmieniał się temat. */
      if (aiSourceKind === 'transcript') {
        const transcriptData = await generateLessonSummary(rawMeetingNotes, '', studentsStr, 'transcript');
        if (selectedUser?.id && !transcriptData.studentId) transcriptData.studentId = selectedUser.id;
        applySingleSummary(transcriptData);
        return;
      }

      const data = await generateBulkLessonSummary(rawMeetingNotes, '', studentsStr, fallbackStudentId, targetStudentName);

      if (data?.lessons && Array.isArray(data.lessons) && data.lessons.length > 0) {
        const lessonsWithStudent = data.lessons.map((l: any) => {
          let ids = l.studentIds && Array.isArray(l.studentIds) && l.studentIds.length > 0
            ? l.studentIds
            : (l.studentId ? [l.studentId] : []);
          if (fallbackStudentId && (ids.length === 0 || !users.some(u => ids.includes(u.id)))) {
            ids = [fallbackStudentId];
          }
          return {
            ...l,
            studentId: ids[0] || fallbackStudentId || '',
            studentIds: ids.length > 0 ? ids : (fallbackStudentId ? [fallbackStudentId] : [])
          };
        });

        if (lessonsWithStudent.length > 1) {
          setBulkPreviewLessons(lessonsWithStudent);
          setShowBulkPreviewModal(true);
          setShowAIModal(false);
          setRawMeetingNotes('');
        } else {
          applySingleSummary(lessonsWithStudent[0]);
        }
      } else {
        const singleData = await generateLessonSummary(rawMeetingNotes, '', studentsStr);
        if (selectedUser?.id && !singleData.studentId) singleData.studentId = selectedUser.id;
        applySingleSummary(singleData);
      }
    } catch (err: any) {
      setSummaryError(err.message || 'Wystąpił błąd podczas generowania podsumowania.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateBulkSummary = async ({ notes, pdfBase64, driveFile }: any) => {
    setIsGenerating(true);
    setBulkSummaryError('');
    try {
      if (driveFile) {
        throw new Error("Direct Drive file fetching is not supported in client-side mode yet. Please upload PDF or paste text.");
      }
      const studentsStr = mapStudents().map((s: any) => `ID: ${s.id} | Imię/Nazwisko: ${s.name} | Poziom: ${s.level} | Opis: ${s.description}`).join('\n');
      const fallbackStudentId = selectedUser?.id || '';
      const targetStudentName = selectedUser ? (`${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.username) : '';

      const data = await generateBulkLessonSummary(notes || '', pdfBase64 || '', studentsStr, fallbackStudentId, targetStudentName);

      if (data.lessons && Array.isArray(data.lessons)) {
        const lessonsWithStudents = data.lessons.map((l: any) => {
          let ids = l.studentIds && Array.isArray(l.studentIds) && l.studentIds.length > 0
            ? l.studentIds
            : (l.studentId ? [l.studentId] : []);
          if (fallbackStudentId && (ids.length === 0 || !users.some(u => ids.includes(u.id)))) {
            ids = [fallbackStudentId];
          }
          return {
            ...l,
            studentId: ids[0] || fallbackStudentId || '',
            studentIds: ids.length > 0 ? ids : (fallbackStudentId ? [fallbackStudentId] : [])
          };
        });
        setBulkPreviewLessons(lessonsWithStudents);
        setShowBulkPreviewModal(true);
        setShowBulkModal(false);
        setBulkNotes('');
      } else {
        setBulkSummaryError('Unexpected response format');
      }
    } catch (err: any) {
      setBulkSummaryError(err.message || 'Wystąpił nieznany błąd podczas generowania podsumowania zbiorczego.');
    } finally {
      setIsGenerating(false);
    }
  };
  const handleSaveBulkLessons = async () => {
    setIsGenerating(true);
    try {
      let savedCount = 0;
      for (const lesson of bulkPreviewLessons) {
        const targetStudentIds: string[] = lesson.studentIds && Array.isArray(lesson.studentIds) && lesson.studentIds.length > 0
          ? lesson.studentIds
          : (lesson.studentId ? [lesson.studentId] : []);

        if (targetStudentIds.length === 0) continue;

        for (const sId of targetStudentIds) {
          await createLessonRecordWithVocabularySet({
            studentId: sId,
            date: lesson.date || new Date().toISOString().split('T')[0],
            topic: lesson.lessonTopic || 'Podsumowanie lekcji',
            vocabularyText: lesson.vocabularyText || '',
            lessonSummary: lesson.revisionNotes || '',
            studentSpeaking: lesson.studentSpeaking || '',
            thingsToImprove: lesson.thingsToImprove || '',
            suggestedFollowUp: lesson.suggestedFollowUp || '',
            /* Bloki, jeśli model je podał. Import zbiorczy ich nie wymaga —
               dokument z historią lekcji rzadko zawiera pracę domową — ale
               gdy przyjdą, mają trafić we własne pola, a nie zginąć. */
            corrections: lesson.corrections || lesson.thingsToImprove || '',
            homeworkText: lesson.homeworkText || '',
            homeworkAnswerKey: lesson.homeworkAnswerKey || '',
            nextLessonPlan: lesson.nextLessonPlan || lesson.suggestedFollowUp || ''
          });
          
          await updateDoc(doc(db, 'users', sId), {
             hasNewLesson: true,
             hasNewVocabulary: true
          });
          savedCount++;
        }
      }
      
      showToast(`Zapisano ${savedCount} wpisów z lekcji dla wybranych kursantów.`);
      setShowBulkPreviewModal(false);
      setBulkPreviewLessons([]);
      
      if (selectedUser) {
        fetchUserLogsAndStats(selectedUser.id);
      }
    } catch (e: any) {
      alert('Błąd podczas zapisywania lekcji: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };
  const handleAssignSet = async () => {
    if (!selectedSetIdToAssign || !selectedUser) {
      alert("Wybierz zestaw z listy.");
      return;
    }
    const setToAssign = adminSets.find(s => s.id === selectedSetIdToAssign);
    if (!setToAssign) return;

    setIsAssigningSet(true);
    try {
      // Create new set copy
      const newSetId = `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newSetData = {
        ...setToAssign,
        id: newSetId,
        userId: selectedUser.id,
        isPublic: false,
        assignedByTeacher: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const batch = writeBatch(db);
      batch.set(doc(db, `sets/${newSetId}`), newSetData);

      // Copy flashcards
      const cardsSnap = await getDocs(collection(db, `sets/${setToAssign.id}/flashcards`));
      cardsSnap.docs.forEach(cardDoc => {
        const newCardId = `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        batch.set(doc(db, `sets/${newSetId}/flashcards/${newCardId}`), {
          ...cardDoc.data(),
          id: newCardId,
          createdAt: new Date().toISOString()
        });
      });

      batch.update(doc(db, 'users', selectedUser.id), { hasNewVocabulary: true });

      await batch.commit();
      setShowAssignModal(false);
      setSelectedSetIdToAssign('');
      fetchUserLogsAndStats(selectedUser.id);
      alert('Zestaw został przypisany!');
    } catch (e: any) {
      alert('Błąd podczas przypisywania zestawu: ' + e.message);
    } finally {
      setIsAssigningSet(false);
    }
  };
  const handleSaveLessonRecord = async () => {
    const targetStudentIds = lessonFormStudentIds.length > 0 
      ? lessonFormStudentIds 
      : (lessonFormStudentId ? [lessonFormStudentId] : []);

    if (targetStudentIds.length === 0) {
      alert("Wybierz przynajmniej jednego kursanta.");
      return;
    }
    // Zatwierdzone = wszystko, co wklejono, minus ręcznie odznaczone.
    const approvedItems = splitVocabularyLines(lessonFormWords)
      .filter(line => !lessonFormExcludedItems.includes(line));

    setIsSavingLessonRecord(true);
    try {
      if (editingRecordId) {
        const primaryStudentId = lessonFormStudentId || targetStudentIds[0];
        const recordData = {
          studentId: primaryStudentId,
          date: lessonFormDate,
          topic: lessonFormTopic,
          vocabularyText: lessonFormWords,
          lessonSummary: lessonFormSummary,
          studentSpeaking: lessonFormStudentSpeaking,
          thingsToImprove: lessonFormThingsToImprove,
          suggestedFollowUp: lessonFormSuggestedFollowUp,
          corrections: lessonFormThingsToImprove,
          homeworkText: lessonFormHomework,
          homeworkAnswerKey: lessonFormAnswerKey,
          nextLessonPlan: lessonFormSuggestedFollowUp,
          scenarioId: lessonFormScenarioId || '',
          scenarioTopic: lessonFormScenarioTopic || '',
          scenarioContent: lessonFormScenarioContent || '',
          status: 'confirmed' as const,
          isPendingConfirmation: false,
          isDateMissing: false,
          pendingReason: '',
          updatedAt: new Date().toISOString()
        };
        
        // Fetch the existing record to see if it has a vocabularySetId
        const recordDoc = await getDocs(query(collection(db, `users/${primaryStudentId}/lessonRecords`), where("__name__", "==", editingRecordId)));
        let vocabSetId = "";
        if (!recordDoc.empty) {
           vocabSetId = recordDoc.docs[0].data().vocabularySetId;
        }

        await updateDoc(doc(db, `users/${primaryStudentId}/lessonRecords`, editingRecordId), recordData);
        
        if (vocabSetId) {
           await updateDoc(doc(db, `users/${primaryStudentId}/vocabularySets`, vocabSetId), {
              date: lessonFormDate,
              topic: lessonFormTopic,
              title: buildVocabularySetTitle(lessonFormDate, lessonFormTopic),
              vocabularyText: lessonFormWords,
              approvedItems: approvedItems,
              itemCount: countVocabularyItems(lessonFormWords),
              updatedAt: new Date().toISOString()
           });
        }

        // Elementy powstają tylko wtedy, gdy lektor faktycznie przygotował je
        // w tej sesji. Pusta lista przy edycji znaczy „nie dotykam powtórek",
        // a nie „skasuj to, co już zatwierdzone".
        if (lessonFormRecallCandidates.length > 0) {
          await saveRecallReview(primaryStudentId, editingRecordId, lessonFormRecallCandidates);
        }

        if (lessonFormWords && lessonFormWords.trim().length > 0) {
          await syncFlashcardSetForLesson(
            editingRecordId,
            primaryStudentId,
            lessonFormDate,
            lessonFormTopic,
            approvedItems.join('\n')
          );
        }

        // If additional students were selected during edit, create record for them too
        for (const sId of targetStudentIds) {
          if (sId === primaryStudentId) continue;
          const extra = await createLessonRecordWithVocabularySet({
            studentId: sId,
            date: lessonFormDate,
            topic: lessonFormTopic,
            vocabularyText: lessonFormWords,
            lessonSummary: lessonFormSummary,
            studentSpeaking: lessonFormStudentSpeaking,
            thingsToImprove: lessonFormThingsToImprove,
            suggestedFollowUp: lessonFormSuggestedFollowUp,
            corrections: lessonFormThingsToImprove,
            homeworkText: lessonFormHomework,
            homeworkAnswerKey: lessonFormAnswerKey,
            nextLessonPlan: lessonFormSuggestedFollowUp,
            scenarioId: lessonFormScenarioId || '',
            scenarioTopic: lessonFormScenarioTopic || '',
            scenarioContent: lessonFormScenarioContent || '',
            approvedItems: approvedItems
          });
          if (lessonFormRecallCandidates.length > 0) {
            await saveRecallReview(sId, extra.lessonRecordId, lessonFormRecallCandidates);
          }
          await updateDoc(doc(db, 'users', sId), {
             hasNewLesson: true,
             hasNewVocabulary: true
          });
        }
      } else {
        // Create lesson record for all selected students
        for (const sId of targetStudentIds) {
          const created = await createLessonRecordWithVocabularySet({
            studentId: sId,
            date: lessonFormDate,
            topic: lessonFormTopic,
            vocabularyText: lessonFormWords,
            lessonSummary: lessonFormSummary,
            studentSpeaking: lessonFormStudentSpeaking,
            thingsToImprove: lessonFormThingsToImprove,
            suggestedFollowUp: lessonFormSuggestedFollowUp,
            corrections: lessonFormThingsToImprove,
            homeworkText: lessonFormHomework,
            homeworkAnswerKey: lessonFormAnswerKey,
            nextLessonPlan: lessonFormSuggestedFollowUp,
            scenarioId: lessonFormScenarioId || '',
            scenarioTopic: lessonFormScenarioTopic || '',
            scenarioContent: lessonFormScenarioContent || '',
            approvedItems: approvedItems
          });

          if (lessonFormRecallCandidates.length > 0) {
            await saveRecallReview(sId, created.lessonRecordId, lessonFormRecallCandidates);
          }

          await updateDoc(doc(db, 'users', sId), {
             hasNewLesson: true,
             hasNewVocabulary: true
          });
        }
      }
      
      showToast(targetStudentIds.length > 1 
        ? `Zapisano lekcję dla ${targetStudentIds.length} kursantów (zajęcia grupowe)!` 
        : `Zapisano lekcję.`);
      closeLessonRecordModal();
      if (selectedUser?.id && targetStudentIds.includes(selectedUser.id)) {
        fetchUserLogsAndStats(selectedUser.id);
      }
      fetchAllLessons(users);
    } catch (e: any) {
      alert('Błąd podczas zapisywania lekcji: ' + e.message);
    } finally {
      setIsSavingLessonRecord(false);
    }
  };

  const handleDeleteLessonRecord = async (record: LessonRecord) => {
    if (!selectedUser) return;
    if (!(await confirmAsync(`Czy na pewno chcesz usunąć lekcję "${record.topic}" z dnia ${record.date}? Operacja jest nieodwracalna.`))) {
      return;
    }
    try {
      await deleteLessonRecord(selectedUser.id, record);
      showToast("Lekcja została usunięta.");
      fetchUserLogsAndStats(selectedUser.id);
      if (viewingRecord?.id === record.id) {
        setShowLessonRecordModal(false);
      }
    } catch (e: any) {
      alert("Błąd podczas usuwania lekcji: " + e.message);
    }
  };

  const handleRejectNotionLesson = async (record: LessonRecord, studentIdOverride?: string) => {
    const studentId = studentIdOverride || selectedUser?.id;
    if (!studentId) return;
    const confirmMsg = `Czy na pewno chcesz odrzucić lekcję „${record.topic}”?\n\nZostanie ona trwale usunięta z widoku i dodana do listy odrzuconych wpisów Notion, aby kolejne synchronizacje już jej nie importowały.`;
    if (!(await confirmAsync(confirmMsg))) return;

    setIsRejectingLessonId(record.id);

    // Optymistyczna aktualizacja lokalnego stanu profilu kursanta — dotyczy
    // tylko widoku, w którym ten kursant jest aktualnie otwarty.
    const isForOpenProfile = selectedUser?.id === studentId;
    const rejectedEntry = {
      id: record.notionPageId || record.id,
      studentId,
      topic: record.topic,
      date: record.date,
      rejectedAt: new Date().toISOString(),
      reason: 'Odrzucono przez nauczyciela (manualny przegląd)',
    };
    if (isForOpenProfile) {
      setLessonRecords(prev => prev.filter(r => r.id !== record.id));
      setRejectedLessons(prev => [rejectedEntry, ...prev]);
      if (viewingRecord?.id === record.id) {
        setShowLessonRecordModal(false);
        setViewingRecord(null);
      }
    }

    try {
      await rejectNotionLesson(studentId, record);
      showToast(`Odrzucono lekcję „${record.topic}”. Dodano do listy ignorowanych z Notion.`);
      fetchAllLessons(users);
    } catch (err: any) {
      // Rollback: przywracamy lekcję na liście i usuwamy wpis z czarnej listy.
      if (isForOpenProfile) {
        setLessonRecords(prev => [record, ...prev]);
        setRejectedLessons(prev => prev.filter(r => r.id !== rejectedEntry.id));
      }
      alert("Błąd podczas odrzucania lekcji: " + (err?.message || String(err)));
    } finally {
      setIsRejectingLessonId(null);
    }
  };

  const handleRestoreRejectedLesson = async (rejectedId: string, topic: string) => {
    if (!selectedUser) return;
    try {
      await restoreRejectedNotionLesson(selectedUser.id, rejectedId);
      setRejectedLessons(prev => prev.filter(r => r.id !== rejectedId));
      showToast(`Przywrócono „${topic}”. Kolejna synchronizacja Notion może ponownie pobrać ten temat.`);
    } catch (err: any) {
      alert("Błąd podczas przywracania lekcji: " + (err?.message || String(err)));
    }
  };

  /**
   * Pull-on-Demand z zakładki „Historia Lekcji" profilu kursanta — ten sam
   * endpoint co w TeacherLessonHistoryView, ale zawsze zawężony do
   * `selectedUser`, więc nie trzeba dodatkowo wybierać kursanta z listy.
   */
  const handleCheckNotionForOpenStudent = async () => {
    if (!selectedUser) return;
    setIsCheckingNotionForStudent(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/notion/fetch-transcripts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ mode: 'preview', studentId: selectedUser.id }),
      });
      const contentType = res.headers.get('content-type') || '';
      const data: any = contentType.includes('application/json') ? await res.json() : {};
      if (!res.ok) throw new Error(data.error || 'Nie udało się połączyć z Notion');

      const items = (data.items || []) as NotionPreviewItem[];
      if (items.length === 0) {
        showToast('Nie znaleziono nowych transkrypcji w Notion dla tego kursanta.');
        return;
      }
      setNotionPreviewItemsForStudent(items);
      setIsNotionPreviewOpenForStudent(true);
    } catch (err: any) {
      showToast(`Błąd sprawdzania Notion: ${err?.message || String(err)}`);
    } finally {
      setIsCheckingNotionForStudent(false);
    }
  };

  const handleImportNotionForOpenStudent = async (pageIds: string[], topicOverrides: Record<string, string>) => {
    if (!selectedUser || pageIds.length === 0) return;
    setIsImportingNotionForStudent(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/notion/fetch-transcripts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ mode: 'import', studentId: selectedUser.id, pageIds, topicOverrides }),
      });
      const contentType = res.headers.get('content-type') || '';
      const data: any = contentType.includes('application/json') ? await res.json() : {};
      if (!res.ok) throw new Error(data.error || 'Nie udało się zaimportować z Notion');

      const imported = Number(data.importedCount || 0);
      setIsNotionPreviewOpenForStudent(false);
      showToast(`Zaimportowano ${imported} ${imported === 1 ? 'lekcję' : 'lekcji'} z Notion.`);
      fetchUserLogsAndStats(selectedUser.id);
    } catch (err: any) {
      showToast(`Błąd importu z Notion: ${err?.message || String(err)}`);
    } finally {
      setIsImportingNotionForStudent(false);
    }
  };

  const handleConfirmLessonDirectly = async (record: LessonRecord, customDate?: string, studentIdOverride?: string) => {
    const studentId = studentIdOverride || selectedUser?.id;
    if (!studentId) return;
    setIsConfirmingLessonId(record.id);
    try {
      let targetDate = customDate || record.date;
      if (!targetDate || /brak daty/i.test(targetDate)) {
        targetDate = new Date().toISOString().split('T')[0];
      }
      const cleanTopic = record.topic.replace(/^Podsumowanie lekcji\s*—\s*brak daty\s*—\s*/i, '').trim();

      await confirmPendingLesson(studentId, record.id, {
        date: targetDate,
        topic: cleanTopic,
        status: 'confirmed',
        isPendingConfirmation: false,
        isDateMissing: false,
        pendingReason: '',
      });

      const updatedRecord: LessonRecord = {
        ...record,
        date: targetDate,
        topic: cleanTopic,
        status: 'confirmed',
        isPendingConfirmation: false,
        isDateMissing: false,
        pendingReason: '',
        updatedAt: new Date().toISOString(),
      };

      if (selectedUser?.id === studentId) {
        setLessonRecords(prev => prev.map(r => r.id === record.id ? updatedRecord : r));
        if (viewingRecord?.id === record.id) {
          setViewingRecord(updatedRecord);
        }
      }
      showToast(`Lekcja „${cleanTopic}” została zatwierdzona i jest widoczna dla kursanta!`);
      fetchAllLessons(users);
    } catch (err: any) {
      alert("Błąd podczas zatwierdzania lekcji: " + (err?.message || String(err)));
    } finally {
      setIsConfirmingLessonId(null);
    }
  };

  const handleUpdateExistingLessonRecord = async (pendingRecord: LessonRecord, existingRecord: LessonRecord) => {
    if (!selectedUser) return;
    setIsConfirmingLessonId(pendingRecord.id);
    try {
      const blocks = extractLessonBlocks(pendingRecord);
      const targetDate = (!pendingRecord.isDateMissing && pendingRecord.date && !/brak daty|empty/i.test(pendingRecord.date))
        ? pendingRecord.date
        : existingRecord.date;

      const cleanTopic = pendingRecord.topic
        ? pendingRecord.topic.replace(/^Podsumowanie lekcji\s*—\s*brak daty\s*—\s*/i, '').trim()
        : existingRecord.topic;

      const updatedFields: Partial<LessonRecord> = {
        structuredBlocks: blocks,
        vocabularyText: blocks.vocabulary || pendingRecord.vocabularyText || existingRecord.vocabularyText || '',
        corrections: blocks.corrections || pendingRecord.corrections || existingRecord.corrections || '',
        thingsToImprove: blocks.corrections || pendingRecord.thingsToImprove || existingRecord.thingsToImprove || '',
        homeworkText: blocks.homework || pendingRecord.homeworkText || existingRecord.homeworkText || '',
        homeworkAnswerKey: blocks.answerKey || pendingRecord.homeworkAnswerKey || existingRecord.homeworkAnswerKey || '',
        lessonSummary: blocks.summary || pendingRecord.lessonSummary || existingRecord.lessonSummary || '',
        studentSpeaking: blocks.learningCurve || pendingRecord.studentSpeaking || existingRecord.studentSpeaking || '',
        nextLessonPlan: blocks.nextLesson || pendingRecord.nextLessonPlan || existingRecord.nextLessonPlan || '',
        topic: cleanTopic,
        date: targetDate,
        notionPageId: pendingRecord.notionPageId || existingRecord.notionPageId,
        source: 'notion',
        status: 'confirmed',
        isPendingConfirmation: false,
        isDateMissing: false,
        pendingReason: '',
        updatedAt: new Date().toISOString(),
      };

      // 1. Update existing confirmed record in Firestore
      await updateDoc(doc(db, `users/${selectedUser.id}/lessonRecords/${existingRecord.id}`), updatedFields);

      // 2. If the pending record is a separate document, delete the draft doc
      if (pendingRecord.id !== existingRecord.id) {
        try {
          await deleteDoc(doc(db, `users/${selectedUser.id}/lessonRecords/${pendingRecord.id}`));
        } catch (delErr) {
          console.warn('Could not delete pending doc after update:', delErr);
        }
      }

      // 3. Sync flashcards if vocabulary present
      if (updatedFields.vocabularyText && updatedFields.vocabularyText.trim().length > 0) {
        syncFlashcardSetForLesson(
          existingRecord.id,
          selectedUser.id,
          targetDate,
          cleanTopic,
          updatedFields.vocabularyText
        ).catch(e => console.warn('Flashcard sync warning:', e));
      }

      const mergedRecord: LessonRecord = {
        ...existingRecord,
        ...updatedFields,
      };

      setLessonRecords(prev =>
        prev
          .filter(r => r.id !== pendingRecord.id)
          .map(r => r.id === existingRecord.id ? mergedRecord : r)
      );

      if (viewingRecord?.id === pendingRecord.id || viewingRecord?.id === existingRecord.id) {
        setViewingRecord(mergedRecord);
      }

      showToast(`Zaktualizowano lekcję „${cleanTopic}” (${targetDate}) do najnowszego widoku 4 bloków!`);
    } catch (err: any) {
      console.error('Błąd aktualizacji rekordu lekcji:', err);
      alert('Nie udało się zaktualizować rekordu lekcji: ' + (err?.message || String(err)));
    } finally {
      setIsConfirmingLessonId(null);
    }
  };

  const generateStrongPassword = () => {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()";
    const all = uppercase + lowercase + numbers + symbols;
    
    let password = "";
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    for (let i = 4; i < 12; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }
    
    return password.split('').sort(() => 0.5 - Math.random()).join('');
  };


  const handleSendMessage = async () => {
    if (!selectedUser || !messageText.trim()) return;
    setIsSendingMessage(true);
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      const newMessage = {
        title: messageTitle || 'Wiadomość',
        text: messageText,
        createdAt: new Date().toISOString()
      };
      await updateDoc(userRef, { adminMessage: newMessage });
      
      const updated = { ...selectedUser, adminMessage: newMessage };
      setSelectedUser(updated);
      setUsers(users.map(u => u.id === updated.id ? updated : u));
      
      showToast('Wiadomość została wysłana.');
      setShowMessageModal(false);
      setMessageText('');
    } catch (e: any) {
      alert('Błąd podczas wysyłania: ' + e.message);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleChangePassword = async (e: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedUser) return;
    if (newPasswordForUser.length < 6) {
      setChangePasswordError('Hasło musi mieć co najmniej 6 znaków.');
      return;
    }
    
    setIsChangingPassword(true);
    setChangePasswordError('');
    try {
      // 1. Change password via firebase-admin endpoint
      try {
        await changeUserPassword(selectedUser.id, newPasswordForUser);
      } catch (apiErr: any) {
        throw new Error("API Error: " + (apiErr.message || String(apiErr)));
      }
      
      // 2. Set requirePasswordChange to true in Firestore so the student has to change it on login
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, { requirePasswordChange: true, tempPassword: newPasswordForUser });
      
      // 3. Update local state
      const updated = { ...selectedUser, requirePasswordChange: true, tempPassword: newPasswordForUser };
      setSelectedUser(updated);
      setUsers(users.map(u => u.id === updated.id ? updated : u));
      
      // Removed alert to prevent iframe block
      setShowChangePasswordModal(false);
      setNewPasswordForUser('');
      showToast('Hasło zostało zmienione.');
    } catch (err: any) {
      setChangePasswordError(err.message || 'Wystąpił błąd podczas zmiany hasła.');
    } finally {
      setIsChangingPassword(false);
    }
  };
  
  const normalizeUsername = (u: string) => u.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '.').toLowerCase();

  const handleCreateStudent = async () => {
    setIsCreatingStudent(true);
    setCreateStudentError('');
    try {
      const trimmedEmail = newStudentEmail.trim().toLowerCase();
      if (trimmedEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
          throw new Error(i18n.t('Podano niepoprawny format adresu e-mail.'));
        }
      }
      const email = trimmedEmail || (normalizeUsername(newStudentUsername) + '@student.vocabboost.com');
      const password = isAutoGeneratePassword ? Math.random().toString(36).slice(-8) : passwordInput;
      const nameParts = newStudentUsername.trim().split(' ');
      const firstName = nameParts[0] || newStudentUsername.trim();
      const lastName = nameParts.slice(1).join(' ') || '';

      const newUserDoc = {
        email,
        username: newStudentUsername.trim(),
        displayName: newStudentUsername.trim(),
        firstName,
        lastName,
        role: 'user' as const,
        createdAt: new Date().toISOString(),
        loginCount: 0,
        streakCount: 0,
        requirePasswordChange: true,
        tempPassword: password,
        statusWspolpracy: 'Aktywny' as const,
      };

      const userRecord = await createUser(email, password, 'user', newUserDoc);
      
      try {
        await setDoc(doc(db, 'users', userRecord.uid), newUserDoc, { merge: true });
      } catch (clientErr) {
        console.warn('[AdminPanel] Klient pominął bezpośredni setDoc (zapisany przez Admin API):', clientErr);
      }

      addCachedUser({ id: userRecord.uid, ...newUserDoc } as UserWithId);
      
      setNewStudentPassword(password);
      setCreatedStudentEmail(email);
      fetchUsers(true);
    } catch (e: any) {
      setCreateStudentError(e.message);
    } finally {
      setIsCreatingStudent(false);
    }
  };

const [users, setUsers] = useState<UserWithId[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserWithId | null>(null);

  useEffect(() => {
    if (!initialSelectedUserId) {
      if (selectedUser) setSelectedUser(null);
    } else if (users.length > 0) {
      if (!selectedUser || selectedUser.id !== initialSelectedUserId) {
        const user = users.find(u => u.id === initialSelectedUserId);
        if (user) {
          setSelectedUser(user);
          fetchUserLogsAndStats(user.id);
        }
      }
    }
  }, [users, initialSelectedUserId]);

  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([]);
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [allTeacherLessons, setAllTeacherLessons] = useState<LessonRecord[]>([]);
  const [isLoadingAllLessons, setIsLoadingAllLessons] = useState(false);
  const [rejectedLessons, setRejectedLessons] = useState<RejectedNotionItem[]>([]);
  const [showRejectedLessonsSection, setShowRejectedLessonsSection] = useState(false);
  const [isRejectingLessonId, setIsRejectingLessonId] = useState<string | null>(null);
  const [isConfirmingLessonId, setIsConfirmingLessonId] = useState<string | null>(null);
  const [isCheckingNotionForStudent, setIsCheckingNotionForStudent] = useState(false);
  const [isImportingNotionForStudent, setIsImportingNotionForStudent] = useState(false);
  const [isNotionPreviewOpenForStudent, setIsNotionPreviewOpenForStudent] = useState(false);
  const [notionPreviewItemsForStudent, setNotionPreviewItemsForStudent] = useState<NotionPreviewItem[]>([]);
  const [groupByMonth, setGroupByMonth] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [userSets, setUserSets] = useState<FlashcardSet[]>([]);
  const [specialTasks, setSpecialTasks] = useState<any[]>([]);
  const [userStats, setUserStats] = useState<{ totalWords: number; difficultWords: number; masteryCount: number; totalTasks?: number; totalSentences?: number; averageScore?: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigningSet, setIsAssigningSet] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showSpecialTaskModal, setShowSpecialTaskModal] = useState(false);
  const [selectedSetIdToAssign, setSelectedSetIdToAssign] = useState('');
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  const fetchAllLessons = async (userList: UserWithId[] = users, forceRefresh = false) => {
    if (!userList || userList.length === 0) return;
    setIsLoadingAllLessons(true);
    try {
      const list = await getAllLessonRecordsForTeacher(userList, forceRefresh);
      setAllTeacherLessons(list);
    } catch (e) {
      console.warn('Błąd pobierania lekcji dla panelu głównego:', e);
    } finally {
      setIsLoadingAllLessons(false);
    }
  };

  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const pdfExportContainerRef = useRef<HTMLDivElement>(null);

  const handleExportLessonsToPDF = async () => {
    if (!selectedUser || !pdfExportContainerRef.current) return;
    setIsExportingPDF(true);
    try {
      const studentFullName = selectedUser.displayName || selectedUser.name || `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.email || 'Kursant';
      const cleanFileName = `Historia_Lekcji_${studentFullName.replace(/[^a-zA-Z0-9ąĆęŁńÓśŹŻĄĆĘŁŃÓŚŹŻ]/g, '_')}.pdf`;
      
      const opt: any = {
        margin: [10, 10, 10, 10],
        filename: cleanFileName,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().set(opt).from(pdfExportContainerRef.current).save();
      showToast("Pomyślnie wyeksportowano historię lekcji do PDF!");
    } catch (err: any) {
      console.error("PDF Export error:", err);
      showToast("Wystąpił błąd podczas eksportowania pliku PDF.");
    } finally {
      setIsExportingPDF(false);
    }
  };

  // GSAP animation for modals
  const useModalGSAP = (isOpen: boolean | string | null | object) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (isOpen) {
        if (overlayRef.current) gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
        if (contentRef.current) gsap.fromTo(contentRef.current, { opacity: 0, scale: 0.95, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(1.2)" });
      }
    }, [isOpen]);
    return { overlayRef, contentRef };
  };



   const [showCreateStudentModal, setShowCreateStudentModal] = useState(false);
  const [newStudentUsername, setNewStudentUsername] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [createdStudentEmail, setCreatedStudentEmail] = useState('');
  const [newStudentPassword, setNewStudentPassword] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isAutoGeneratePassword, setIsAutoGeneratePassword] = useState(true);
  const [isCreatingStudent, setIsCreatingStudent] = useState(false);
  const [createStudentError, setCreateStudentError] = useState('');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);

  const [messageTitle, setMessageTitle] = useState('Wiadomość od nauczyciela');
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [newPasswordForUser, setNewPasswordForUser] = useState('');
  const [toastMessage, setToastMessage] = useState<{text: string, id: number} | null>(null);
  const showToast = (text: string) => {
    const id = Date.now();
    setToastMessage({text, id});
    setTimeout(() => {
      setToastMessage(prev => prev?.id === id ? null : prev);
    }, 3000);
  };
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');
  const [isLessonVocabulary, setIsLessonVocabulary] = useState(false);
  const [lessonDate, setLessonDate] = useState(new Date().toISOString().split('T')[0]);
  const [lessonTopic, setLessonTopic] = useState('');

  // Lesson Record Form States
  const [showLessonRecordModal, setShowLessonRecordModal] = useState(false);
  const [lessonFormStudentId, setLessonFormStudentId] = useState('');
  const [lessonFormStudentIds, setLessonFormStudentIds] = useState<string[]>([]);
  const [lessonFormDate, setLessonFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [lessonFormTopic, setLessonFormTopic] = useState('');
  const [lessonFormWords, setLessonFormWords] = useState('');
  // Pozycje odrzucone przy zatwierdzaniu materiału po lekcji; puste = wszystko idzie do powtórek.
  const [lessonFormExcludedItems, setLessonFormExcludedItems] = useState<string[]>([]);
  // Kandydaci do powtórek — zatwierdzani przy zapisie lekcji (Priorytet 0).
  const [lessonFormRecallCandidates, setLessonFormRecallCandidates] = useState<ReviewedCandidate[]>([]);
  const [lessonFormSummary, setLessonFormSummary] = useState('');
  const [lessonFormStudentSpeaking, setLessonFormStudentSpeaking] = useState('');
  const [lessonFormThingsToImprove, setLessonFormThingsToImprove] = useState('');
  const [lessonFormSuggestedFollowUp, setLessonFormSuggestedFollowUp] = useState('');
  /* Blok 3 wprost, a nie doklejony do „Things to Improve" pod znacznikiem
     „Zadanie domowe:". Kursant widzi pracę domową jako osobny blok, więc
     lektor ma ją wpisywać w osobne pole — nie w dopisek do innego. */
  /*
   * Rodzaj materiału wklejonego w „AI Lesson Summary".
   *
   * Nie jest to ustawienie kosmetyczne: transkrypcja i gotowe notatki dostają
   * DWA RÓŻNE polecenia systemowe (patrz server.ts) i dwie różne ścieżki.
   * Transkrypcja idzie zawsze jako JEDNA lekcja — godzina rozmowy to jedne
   * zajęcia, a wysłanie jej przez import zbiorczy kończyło się rozcięciem
   * jednej lekcji na kilka wpisów po zmianach tematu w rozmowie.
   */
  const [aiSourceKind, setAiSourceKind] = useState<'notes' | 'transcript'>('notes');
  const [lessonFormHomework, setLessonFormHomework] = useState('');
  const [lessonFormAnswerKey, setLessonFormAnswerKey] = useState('');
  const [lessonFormScenarioId, setLessonFormScenarioId] = useState('');
  const [lessonFormScenarioTopic, setLessonFormScenarioTopic] = useState('');
  const [lessonFormScenarioContent, setLessonFormScenarioContent] = useState('');
  const [availableScenariosForForm, setAvailableScenariosForForm] = useState<GeneratedLessonScenario[]>([]);
  const [plannerInitialScenario, setPlannerInitialScenario] = useState<GeneratedLessonScenario | null>(initialScenario || null);
  const [lessonRecordModalMode, setLessonRecordModalMode] = useState<'view' | 'edit'>('view');
  
  // Lesson Database clone States
  const [allLessonsDatabase, setAllLessonsDatabase] = useState<{record: LessonRecord; studentName: string; studentId: string}[]>([]);
  const [isLoadingLessonsDb, setIsLoadingLessonsDb] = useState(false);
  const [lessonsDbSearch, setLessonsDbSearch] = useState('');
  const [activeLessonFormTab, setActiveLessonFormTab] = useState<'manual' | 'database'>('manual');
  const [selectedDbLessonKeys, setSelectedDbLessonKeys] = useState<string[]>([]);

  const fetchAllUsersLessons = async () => {
    setIsLoadingLessonsDb(true);
    try {
      const fetchedLessons: {record: LessonRecord; studentName: string; studentId: string}[] = [];
      await Promise.all(users.map(async (u) => {
        try {
          const records = await getLessonRecordsForStudent(u.id);
          const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
          records.forEach(rec => {
            fetchedLessons.push({
              record: rec,
              studentName: name,
              studentId: u.id
            });
          });
        } catch (err) {
          console.warn(`Could not fetch lessons for user ${u.id}:`, err);
        }
      }));
      fetchedLessons.sort((a, b) => new Date(b.record.date).getTime() - new Date(a.record.date).getTime());
      setAllLessonsDatabase(fetchedLessons);
    } catch (err) {
      console.error("Error fetching all users lessons:", err);
    } finally {
      setIsLoadingLessonsDb(false);
    }
  };

  useEffect(() => {
    if (showLessonRecordModal && activeLessonFormTab === 'database' && allLessonsDatabase.length === 0) {
      fetchAllUsersLessons();
    }
  }, [showLessonRecordModal, activeLessonFormTab, allLessonsDatabase.length]);
  
  // AI Modal State
  const [showAIModal, setShowAIModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showBulkPreviewModal, setShowBulkPreviewModal] = useState(false);
  const [showCleanLessonsModal, setShowCleanLessonsModal] = useState(false);
  const [isPendingSectionOpen, setIsPendingSectionOpen] = useState(false);
  const [bulkPreviewLessons, setBulkPreviewLessons] = useState<any[]>([]);
  const [expandedBulkIndex, setExpandedBulkIndex] = useState<number | null>(null);
  const [bulkNotes, setBulkNotes] = useState('');
  
  // Meeting Notes AI State
  const [rawMeetingNotes, setRawMeetingNotes] = useState('');
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [driveModalMode, setDriveModalMode] = useState<'single'|'bulk'>('single');
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const assignModalAnim = useModalGSAP(showAssignModal);
  const deleteModalAnim = useModalGSAP(userToDelete);
  const driveModalAnim = useModalGSAP(showDriveModal);
  const aiModalAnim = useModalGSAP(showAIModal);
  const bulkModalAnim = useModalGSAP(showBulkModal);
  const bulkPreviewModalAnim = useModalGSAP(showBulkPreviewModal);
  const lessonRecordModalAnim = useModalGSAP(showLessonRecordModal);
  const changePasswordModalAnim = useModalGSAP(showChangePasswordModal);
  const createStudentModalAnim = useModalGSAP(showCreateStudentModal);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [bulkSummaryError, setBulkSummaryError] = useState('');
  const [viewingRecord, setViewingRecord] = useState<LessonRecord | null>(null);
  const [specialTaskInitialLesson, setSpecialTaskInitialLesson] = useState<LessonRecord | null>(null);
  const [specialTaskInitialWords, setSpecialTaskInitialWords] = useState<string[]>([]);
  const [specialTaskInitialTopic, setSpecialTaskInitialTopic] = useState<string>('');
  const [isSavingLessonRecord, setIsSavingLessonRecord] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [isStudentPickerOpen, setIsStudentPickerOpen] = useState(false);
  const [isNotebookPickerOpen, setIsNotebookPickerOpen] = useState(false);
  const [targetTabAfterSelect, setTargetTabAfterSelect] = useState<string | null>(null);

  // Archiwum to zamknięta współpraca, nie usunięte konto: domyślnie znika
  // z list, ale wystarczy przełącznik, żeby wrócić do historii kursanta.
  const [showArchived, setShowArchived] = useState(false);
  const activeUsers = users.filter(u => !u.isArchived);
  const archivedCount = users.length - activeUsers.length;

  const filteredUsers = users.filter(u => {
    if (u.isArchived && !showArchived) return false;
    const searchStr = `${u.firstName || ''} ${u.lastName || ''} ${u.username} ${u.email || ''}`.toLowerCase();
    const matchesSearch = searchStr.includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesLevel = levelFilter === 'all' || u.level === levelFilter || (levelFilter !== 'all' && u.level?.includes(levelFilter));
    return matchesSearch && matchesRole && matchesLevel;
  });

  const openLessonRecordModal = (mode: 'view' | 'edit', record?: LessonRecord, preserveData: boolean = false) => {
    setLessonRecordModalMode(mode);
    setActiveLessonFormTab('manual');
    setLessonsDbSearch('');
    setSelectedDbLessonKeys([]);
    getGeneratedScenarios().then(setAvailableScenariosForForm).catch(() => {});
    if (record) {
      setEditingRecordId(record.id);
      setViewingRecord(record);
      const sId = record.studentId || selectedUser?.id || '';
      setLessonFormStudentId(sId);
      setLessonFormStudentIds(sId ? [sId] : []);
      let initialDate = record.date;
      if (!initialDate || /brak daty/i.test(initialDate) || record.isDateMissing) {
        initialDate = new Date().toISOString().split('T')[0];
      }
      setLessonFormDate(initialDate);
      let initialTopic = record.topic || '';
      if (/^Podsumowanie lekcji\s*—\s*brak daty\s*—\s*/i.test(initialTopic)) {
        initialTopic = initialTopic.replace(/^Podsumowanie lekcji\s*—\s*brak daty\s*—\s*/i, '');
      }
      setLessonFormTopic(initialTopic);
      setLessonFormWords(record.vocabularyText || (record as any).words || '');
      setLessonFormExcludedItems([]);
      setLessonFormRecallCandidates([]);
      setLessonFormSummary(record.lessonSummary || (record as any).summary || '');
      setLessonFormStudentSpeaking(record.studentSpeaking || '');
      /* Stare wpisy trzymają pracę domową doklejoną do `thingsToImprove`.
         `extractLessonBlocks` wie, jak ją stamtąd wyjąć — dzięki temu
         formularz pokazuje bloki tak, jak widzi je kursant, a nie tak, jak
         akurat leżą w bazie. */
      const formBlocks = extractLessonBlocks(record);
      setLessonFormThingsToImprove(formBlocks.corrections || record.thingsToImprove || '');
      setLessonFormSuggestedFollowUp(formBlocks.nextLesson || record.suggestedFollowUp || '');
      setLessonFormHomework(formBlocks.homework || '');
      setLessonFormAnswerKey(formBlocks.answerKey || '');
      setLessonFormScenarioId(record.scenarioId || '');
      setLessonFormScenarioTopic(record.scenarioTopic || '');
      setLessonFormScenarioContent(record.scenarioContent || '');
      setRawMeetingNotes('');
    } else {
      if (!preserveData) {
        const defaultStudentId = selectedUser?.id || '';
        setLessonFormStudentId(defaultStudentId);
        setLessonFormStudentIds(defaultStudentId ? [defaultStudentId] : []);
        setEditingRecordId(null);
        setViewingRecord(null);
        setLessonFormDate(new Date().toISOString().split('T')[0]);
        setLessonFormTopic('');
        setLessonFormWords('');
        setLessonFormExcludedItems([]);
        setLessonFormRecallCandidates([]);
        setLessonFormSummary('');
        setLessonFormStudentSpeaking('');
        setLessonFormThingsToImprove('');
        setLessonFormSuggestedFollowUp('');
        setLessonFormHomework('');
        setLessonFormAnswerKey('');
        setLessonFormScenarioId('');
        setLessonFormScenarioTopic('');
        setLessonFormScenarioContent('');
        setRawMeetingNotes('');
      }
    }
    setShowLessonRecordModal(true);
  };

  const closeLessonRecordModal = () => {
    setShowLessonRecordModal(false);
    setEditingRecordId(null);
    setLessonFormTopic('');
    setLessonFormWords('');
    setLessonFormExcludedItems([]);
    setLessonFormRecallCandidates([]);
    setLessonFormSummary('');
    setLessonFormScenarioId('');
    setLessonFormScenarioTopic('');
    setLessonFormScenarioContent('');
  };

  const handleLinkScenarioToRecord = async (scenario: GeneratedLessonScenario) => {
    if (!viewingRecord || !selectedUser) return;
    try {
      const updated: LessonRecord = {
        ...viewingRecord,
        scenarioId: scenario.id,
        scenarioTopic: scenario.topic || scenario.title,
        scenarioContent: scenario.content,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(doc(db, `users/${selectedUser.id}/lessonRecords`, viewingRecord.id), {
        scenarioId: scenario.id,
        scenarioTopic: scenario.topic || scenario.title,
        scenarioContent: scenario.content,
        updatedAt: new Date().toISOString()
      });
      setViewingRecord(updated);
      setLessonRecords(prev => prev.map(r => r.id === viewingRecord.id ? updated : r));
      showToast('Powiązano scenariusz z lekcją kursanta!');
    } catch (err: any) {
      alert('Błąd podczas powiązywania scenariusza: ' + err.message);
    }
  };

  const handleUpdateViewingRecord = async (updatedFields: Partial<LessonRecord>) => {
    if (!selectedUser || !viewingRecord) return;
    try {
      const updated = {
        ...viewingRecord,
        ...updatedFields,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(doc(db, `users/${selectedUser.id}/lessonRecords`, viewingRecord.id), updatedFields);
      setViewingRecord(updated);
      setLessonRecords(prev => prev.map(r => r.id === viewingRecord.id ? updated : r));
      showToast('Zaktualizowano lekcję kursanta do formatu bloków Notion!');
    } catch (err: any) {
      alert('Błąd aktualizacji lekcji: ' + (err?.message || err));
    }
  };

  /**
   * Wariant `handleUpdateViewingRecord` dla podglądu z globalnej Historii Lekcji
   * (`TeacherLessonHistoryView`), gdzie lekcja nie musi należeć do `selectedUser`
   * — kursanta trzeba podać jawnie zamiast polegać na aktualnie otwartym profilu.
   */
  const handleUpdateLessonRecordForStudent = async (
    studentId: string,
    lesson: LessonRecord,
    updatedFields: Partial<LessonRecord>
  ) => {
    try {
      const updated = { ...lesson, ...updatedFields, updatedAt: new Date().toISOString() };
      await updateDoc(doc(db, `users/${studentId}/lessonRecords`, lesson.id), updatedFields);
      if (selectedUser?.id === studentId) {
        setLessonRecords(prev => prev.map(r => (r.id === lesson.id ? updated : r)));
        if (viewingRecord?.id === lesson.id) setViewingRecord(updated);
      }
      fetchAllLessons(users);
    } catch (err: any) {
      alert('Błąd aktualizacji lekcji: ' + (err?.message || err));
      throw err;
    }
  };


  const handleGenerateHomeworkFromLesson = (record: LessonRecord) => {
    let targetUser = selectedUser;
    if (!targetUser || (record.studentId && targetUser.id !== record.studentId)) {
      targetUser = users.find(u => u.id === record.studentId) || selectedUser;
    }
    if (!targetUser) {
      alert('Nie znaleziono kursanta przypisanego do tej lekcji.');
      return;
    }
    setSelectedUser(targetUser);
    setSpecialTaskInitialLesson(record);
    setShowLessonRecordModal(false);
    setShowSpecialTaskModal(true);
  };

  // User Profile Edit States
  const [activeTab, setActiveTab] = useState<string | null>(initialTab || null);

  const [unreadMailingCount, setUnreadMailingCount] = useState<number>(0);

  useEffect(() => {
    try {
      const q = query(collection(db, 'inboundMessages'), where('read', '==', false));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          setUnreadMailingCount(snapshot.size);
        },
        (err) => {
          console.warn('inboundMessages snapshot listener warning:', err);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.warn('Error setting up inboundMessages listener in AdminPanel:', err);
    }
  }, []);

  const tabContentRef = useRef<HTMLDivElement>(null);
  
  const profileContainerRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const mainMenuRef = useRef<HTMLDivElement>(null);

  /*
   * Odbiór „Do dziennika" z notatnika stojącego jako osobny ekran.
   *
   * Notatnik był oknem wewnątrz panelu i wołał formularz lekcji wprost.
   * Jako ekran stoi obok panelu, więc dane jadą tą samą drogą, którą w tej
   * aplikacji jeżdżą już `_autoGenerate` i `_initialStudyMode`: globalną
   * zmienną odczytywaną RAZ, przy wejściu w panel, i od razu kasowaną —
   * inaczej powrót do panelu po czymkolwiek innym otwierałby formularz
   * drugi raz, z tą samą treścią.
   */
  useEffect(() => {
    const pending = (window as any)._pendingLessonFromScratchpad;
    if (!pending) return;
    delete (window as any)._pendingLessonFromScratchpad;

    setEditingRecordId(null);
    setViewingRecord(null);
    setLessonFormDate(new Date().toISOString().split('T')[0]);
    setLessonFormTopic(pending.topic || '');
    setLessonFormWords(pending.words || '');
    setLessonFormSummary(pending.summary || '');
    setLessonFormThingsToImprove(pending.thingsToImprove || '');
    setLessonFormSuggestedFollowUp(pending.followUp || '');
    setLessonRecordModalMode('edit');
    setShowLessonRecordModal(true);
    showToast('Przeniesiono notatki z notatnika do formularza lekcji.');
  }, []);

  useEffect(() => {
    if (tabContentRef.current && selectedUser) {
      gsap.fromTo(tabContentRef.current, 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", clearProps: "all" }
      );
    }
  }, [activeTab, selectedUser]);

  

  

  useEffect(() => {
    if (profileContainerRef.current && selectedUser) {
      gsap.fromTo(profileContainerRef.current,
        { opacity: 0, scale: 0.98, y: 10 },
        { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "power2.out", clearProps: "all" }
      );
    }
  }, [selectedUser]);

  const prevActiveTabRef = useRef<string | null>(activeTab);
  const onTabChangeRef = useRef(onTabChange);
  useEffect(() => {
    onTabChangeRef.current = onTabChange;
  }, [onTabChange]);

  useEffect(() => {
    const prevTab = prevActiveTabRef.current;
    if (prevTab !== activeTab) {
      prevActiveTabRef.current = activeTab;
      onTabChangeRef.current?.(activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    if (mainMenuRef.current && mainMenuRef.current.children.length > 0 && activeTab === null) {
      gsap.fromTo(gsap.utils.toArray(mainMenuRef.current.children),
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", stagger: 0.05, clearProps: "all" }
      );
    }
  }, [activeTab]);


  useEffect(() => {
    setActiveTab(initialTab || null);
  }, [initialTab]);

  useEffect(() => {
    if (initialLessonDraft) {
      setEditingRecordId(null);
      setViewingRecord(null);
      const sId = initialLessonDraft.studentId || selectedUser?.id || '';
      setLessonFormStudentId(sId);
      setLessonFormStudentIds(sId ? [sId] : []);
      setLessonFormDate(new Date().toISOString().split('T')[0]);
      setLessonFormTopic(initialLessonDraft.topic || '');
      setLessonFormSummary(initialLessonDraft.summary || '');
      setLessonFormWords(initialLessonDraft.vocabulary || '');
      setLessonFormThingsToImprove(initialLessonDraft.grammar || '');
      setLessonFormSuggestedFollowUp(initialLessonDraft.homework || '');
      setLessonFormStudentSpeaking('');
      setLessonFormScenarioId('');
      setLessonFormScenarioTopic(initialLessonDraft.topic || '');
      setLessonFormScenarioContent(initialLessonDraft.summary || '');
      openLessonRecordModal('edit', undefined, true);
    }
  }, [initialLessonDraft]);

  useEffect(() => {
    if (initialScenario) {
      setPlannerInitialScenario(initialScenario);
      setActiveTab('lesson-planner');
    }
  }, [initialScenario]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };
  useEffect(() => {
    if (selectedUser) {
      setProfileForm({
        firstName: selectedUser.firstName || '',
        lastName: selectedUser.lastName || '',
        email: selectedUser.email || '',
        level: selectedUser.level || '',
        description: selectedUser.description || '',
        aiPrompt: selectedUser.aiPrompt || '',
        role: (selectedUser.role || 'user') as 'admin' | 'user' | 'teacher',
        emailNotificationsDisabled: Boolean(selectedUser.emailNotificationsDisabled)
      });
    }
  }, [selectedUser]);

  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    level: '',
    description: '',
    aiPrompt: '',
    role: 'user' as 'admin' | 'user' | 'teacher',
    emailNotificationsDisabled: false
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEscapeModal(isStudentPickerOpen, () => setIsStudentPickerOpen(false));
  useEscapeModal(isNotebookPickerOpen, () => setIsNotebookPickerOpen(false));
  useEscapeModal(showCreateStudentModal, () => {
    setShowCreateStudentModal(false);
    setCreateStudentError('');
    setNewStudentPassword('');
    setNewStudentUsername('');
    setNewStudentEmail('');
    setCreatedStudentEmail('');
  });
  useEscapeModal(showChangePasswordModal, () => {
    setShowChangePasswordModal(false);
    setChangePasswordError('');
    setNewPasswordForUser('');
  });
  useEscapeModal(showMessageModal, () => setShowMessageModal(false));
  useEscapeModal(showDriveModal, () => setShowDriveModal(false), 5);
  useEscapeModal(showAIModal, () => setShowAIModal(false));
  useEscapeModal(showBulkModal, () => setShowBulkModal(false));
  useEscapeModal(showBulkPreviewModal, () => setShowBulkPreviewModal(false));
  useEscapeModal(showInviteModal, () => setShowInviteModal(false));
  useEscapeModal(showCleanLessonsModal, () => setShowCleanLessonsModal(false));
  useEscapeModal(showLessonRecordModal, () => closeLessonRecordModal());
  useEscapeModal(!!userToDelete, () => setUserToDelete(null), 5);
  useEscapeModal(!!(profileSaveModal && profileSaveModal.isOpen), () => setProfileSaveModal(null), 5);
  
  const handleRoleChangeForUser = async (targetUser: User, newRole: 'admin' | 'user' | 'teacher') => {
    if (!targetUser.id) return;
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, { role: newRole });
      
      const updatedUser = { ...targetUser, role: newRole } as UserWithId;
      if (selectedUser?.id === targetUser.id) {
        setSelectedUser(updatedUser);
      }
      setUsers(users.map(u => u.id === targetUser.id ? updatedUser : u));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${targetUser.id}`);
    }
  };

  const handleRoleChange = async (newRole: 'admin' | 'user' | 'teacher') => {
    if (!selectedUser) return;
    await handleRoleChangeForUser(selectedUser, newRole);
  };

  /*
   * Uchwyty Asystenta AI wyciągnięte poza JSX, bo w wersji mobilnej ten sam
   * czat wyświetlamy w pełnoekranowej nakładce po kliknięciu paska w stopce
   * (patrz `assistantOverlayOpen` niżej) — bez wydzielenia trzeba by je
   * powielić w dwóch miejscach i pielić dwa razy przy każdej zmianie.
   */
  const handleAssistantNavigate = (mod: string, extra?: any) => {
    if (mod === 'scratchpad') {
      openScratchpadTab(extra?.studentId ? `sp_${extra.studentId}` : undefined);
    } else if (
      mod === 'students' ||
      mod === 'lesson-history' ||
      mod === 'mailing' ||
      mod === 'lesson-planner' ||
      (mod === 'admin' && extra?.tab === 'lesson-planner')
    ) {
      const targetTab = mod === 'admin' && extra?.tab ? extra.tab : mod;
      setActiveTab(targetTab);
      if (extra?.initialScenario) {
        setPlannerInitialScenario(extra.initialScenario);
      }
      const sId = extra?.studentId || extra?.userId;
      if (sId) {
        const u = users.find((x) => x.id === sId);
        if (u) setSelectedUser(u as UserWithId);
      }
      setAssistantOverlayOpen(false);
      setTimeout(() => {
        tabContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } else if (onViewChange) {
      onViewChange(mod, extra);
    }
  };

  const handleAssistantSelectStudent = (studentId: string) => {
    const u = users.find((x) => x.id === studentId);
    if (u) {
      handleSelectUser(u as UserWithId, 'profile');
      setAssistantOverlayOpen(false);
    }
  };

  const handleAssistantCreateLessonRecord = (lessonDraft: LessonDraftProposal) => {
    setEditingRecordId(null);
    setViewingRecord(null);
    const targetStudent = (lessonDraft.studentId ? users.find((x) => x.id === lessonDraft.studentId) : null) || selectedUser;
    if (targetStudent) {
      setSelectedUser(targetStudent as UserWithId);
    }
    const sId = targetStudent?.id || '';
    setLessonFormStudentId(sId);
    setLessonFormStudentIds(sId ? [sId] : []);
    setLessonFormDate(new Date().toISOString().split('T')[0]);
    setLessonFormTopic(lessonDraft.topic || '');
    setLessonFormSummary(lessonDraft.summary || '');
    setLessonFormWords(lessonDraft.vocabulary || '');
    setLessonFormThingsToImprove(lessonDraft.grammar || '');
    setLessonFormSuggestedFollowUp(lessonDraft.homework || '');
    setLessonFormStudentSpeaking('');
    setLessonFormScenarioId('');
    setLessonFormScenarioTopic(lessonDraft.topic || '');
    setLessonFormScenarioContent(lessonDraft.summary || '');
    openLessonRecordModal('edit', undefined, true);
    showToast('Przeniesiono propozycję lekcji z Asystenta AI do Dziennika!');
    setAssistantOverlayOpen(false);
  };

  const handleAssistantOpenInPresentation = async (scenarioData: any, studentId?: string, studentName?: string) => {
    try {
      const targetStudent = studentId ? users.find((x) => x.id === studentId) : selectedUser;
      if (targetStudent) {
        setSelectedUser(targetStudent as UserWithId);
      }
      const sName = studentName || (targetStudent ? (targetStudent.firstName ? `${targetStudent.firstName} ${targetStudent.lastName || ''}`.trim() : targetStudent.username) : null);
      const scenario: GeneratedLessonScenario = (scenarioData && scenarioData.stages) ? scenarioData : {
        id: scenarioData?.id || `scen_${Date.now()}`,
        title: scenarioData?.topic || 'Temat lekcji',
        topic: scenarioData?.topic || 'Temat lekcji',
        content: scenarioData?.summary || '',
        summary: scenarioData?.summary || '',
        vocabularyText: scenarioData?.vocabulary || '',
        grammar: scenarioData?.grammar || '',
        homework: scenarioData?.homework || '',
        targetLevel: targetStudent?.level || scenarioData?.targetLevel || 'B2',
        lessonDuration: scenarioData?.lessonDuration || '60 min',
        createdAt: new Date().toISOString(),
      };
      const pres = createPresentationFromScenario(scenario, targetStudent?.id, sName);
      await savePresentationToStorage(pres);
      setActiveTab('presentation');
      showToast('Scenariusz z Asystenta AI załadowany do Prezentacji Live!');
      setAssistantOverlayOpen(false);
      setTimeout(() => {
        tabContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (e) {
      console.error('Błąd uruchamiania w prezentacji:', e);
      showToast('Nie udało się załadować scenariusza do prezentacji.');
    }
  };

  return (
    <div className="w-full pb-28 min-w-0 space-y-6">
      {!selectedUser && (
        <>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 sm:pt-0 pl-7 sm:pl-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-hi flex items-center gap-3">
            <span>{i18n.t("Teacher Panel")}</span>
            <span className="text-xs font-mono uppercase bg-primary/20 text-primary border border-primary/30 px-2.5 py-1 rounded-full font-bold">
              Panel Nauczyciela
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-content-muted mt-1">
            Zarządzaj kursantami, edytuj opisy i prompty AI, śledź statystyki oraz historię lekcji i sesji
          </p>
        </div>

        {SHOW_LEGACY_PANEL_TOOLS && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => openScratchpadTab()}
              className="px-3.5 min-h-11 bg-base-200/80 text-content border border-line-strong rounded-xl text-xs sm:text-sm font-bold hover:bg-white/[0.08] transition-colors flex items-center justify-center gap-2"
              title="Otwórz wspólny notatnik wybranego kursanta"
            >
              <FileEdit size={16} />
              Notatnik
            </button>
            <button
              onClick={() => setShowAIModal(true)}
              className="px-3.5 min-h-11 bg-base-200/80 text-primary border border-primary/40 rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/10 transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles size={16} />
              {i18n.t("✨ AI Lesson Generator")}
            </button>
            <button
              onClick={() => setShowCreateStudentModal(true)}
              className="px-3.5 min-h-11 bg-primary text-accent-ink rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-btn"
            >
              <Plus size={16} />
              {i18n.t("Dodaj kursanta")}
            </button>
          </div>
        )}
      </div>

      {/* Sygnał "wymaga uwagi" — trwały nad treścią panelu */}
      <TeacherAttentionBanner
        onOpenHomework={(filterStatus) => onViewChange?.('homework', { filterStatus })}
      />

      {SHOW_LEGACY_PANEL_TOOLS && <TeacherOverview students={activeUsers} language={language} />}

      {/* Pocket Companion — telefon (< md): 3 kafelki + wejście do Asystenta AI w stopce,
          zamiast pełnego pulpitu desktopowego. Widoczny tylko na stronie głównej
          (activeTab === null); dalsze moduły otwierane z kafelków są nadal ekranami
          desktopowymi — to świadomy zasięg tego zadania, nie każdy z nich jest jeszcze
          dostosowany do telefonu. */}
      {!isDesktopUI && activeTab === null && (
        <TeacherMobileHub
          currentUser={currentUser as UserWithId | null}
          users={users as UserWithId[]}
          lessons={allTeacherLessons}
          onSelectStudent={handleAssistantSelectStudent}
          onOpenHistory={(sId, lessonId) => {
            if (sId) {
              const u = users.find((x) => x.id === sId);
              if (u) handleSelectUser(u as UserWithId, 'history');
            } else {
              handleTileClick('lesson-history');
            }
          }}
          onOpenHomeworkReview={(taskId, sId) => {
            if (sId) {
              const u = users.find((x) => x.id === sId);
              if (u) handleSelectUser(u as UserWithId, 'homework');
            }
            setActiveTab('homework');
          }}
          onOpenAssistant={() => setAssistantOverlayOpen(true)}
        />
      )}

      {/* Pełnoekranowa nakładka Asystenta AI — wywoływana z paska szybkiego zapytania
          pod siatką 4 kafelków na desktopie oraz z paska w stopce Pocket Companion na
          telefonie (patrz uchwyty `handleAssistant*` wyżej). Ten sam czat co embedded,
          tylko bez współdzielenia layoutu z resztą panelu, żeby otwierał się natychmiast
          na cały ekran zamiast kolidować z kafelkami. */}
      {assistantOverlayOpen && (
        <div className="fixed inset-0 z-[96] bg-base-100 flex flex-col">
          <header className="shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-line-strong bg-base-200/80">
            <span className="text-sm font-bold text-text-hi">Asystent AI</span>
            <button
              type="button"
              onClick={() => setAssistantOverlayOpen(false)}
              className="p-2 rounded-xl border border-line-strong text-content-muted hover:text-text-hi cursor-pointer"
              aria-label="Zamknij"
            >
              <X size={18} />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-3">
            <TeacherAssistant
              mode="embedded"
              onNavigateToModule={handleAssistantNavigate}
              onSelectStudent={handleAssistantSelectStudent}
              onCreateLessonRecord={handleAssistantCreateLessonRecord}
              onOpenInPresentation={handleAssistantOpenInPresentation}
            />
          </div>
        </div>
      )}

      {/* GŁÓWNE KAFELKI LEKTORA — symetryczne i wyśrodkowane (tylko desktop, patrz Pocket Companion wyżej) */}
      <div className="hidden md:block space-y-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-content-muted flex items-center gap-2">
            <span>Główne Narzędzia Lektora</span>
            <span className="text-[10px] font-mono bg-line-soft text-content-muted px-2 py-0.5 rounded-full border border-line-strong">
              Tryb ogólny
            </span>
          </h2>
          {activeTab && (
            <button
              onClick={() => setActiveTab(null)}
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X size={13} /> Wróć do strony głównej
            </button>
          )}
        </div>

        {/* Główne 4 kafelki lektora (Dzisiaj/Cockpit, Moi kursanci, Moje lekcje, Narzędzia lektora) */}
        <div
          ref={mainMenuRef}
          data-coach="tour-teacher-main"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 max-w-5xl mx-auto w-full justify-center"
        >
          {[
            {
              id: 'today',
              title: 'Dzisiaj (Cockpit)',
              badge: 'Centrum dnia',
              desc: 'Operacyjny widok dnia — rozkład zajęć, zadania do sprawdzenia, szybki briefing',
              icon: Calendar,
            },
            {
              id: 'students',
              title: 'Moi kursanci',
              badge: 'Baza CRM',
              desc: 'Baza kursantów — profile, postępy, historia współpracy i przypisywanie zadań',
              icon: Users,
            },
            {
              id: 'lesson-history',
              title: 'Moje lekcje',
              badge: 'Lekcje i notatki',
              desc: 'Zrealizowane i zaplanowane lekcje, tematy, notatki oraz materiały powtórkowe',
              icon: BookOpen,
            },
            {
              id: 'tools',
              title: 'Narzędzia lektora',
              badge: 'Zestaw narzędzi',
              desc: 'Notatnik na żywo, zadania i testy, planer lekcji, mailing, baza słownictwa i statystyki',
              icon: Layers,
              hasNotification: unreadMailingCount > 0,
              notificationCount: unreadMailingCount,
            }
          ].map((tile) => {
            const IconComp = tile.icon;
            const isActive = tile.id === 'tools'
              ? toolsDrawerOpen
              : activeTab === tile.id || (tile.id === 'today' && activeTab === 'cockpit') || (tile.id === 'lesson-history' && (activeTab === 'lesson-history' || activeTab === 'history'));
            const hasNotification = Boolean((tile as any).hasNotification);
            const notificationCount = Number((tile as any).notificationCount || 0);

            return (
              <div
                key={tile.id}
                data-coach={tile.id === 'tools' ? 'tour-teacher-tools' : undefined}
                onClick={() =>
                  tile.id === 'tools' ? setToolsDrawerOpen(true) : handleTileClick(tile.id)
                }
                className={`p-4.5 sm:p-5 cursor-pointer flex flex-col justify-between select-none transition-[border-color,box-shadow,background-color] duration-200 rounded-2xl relative overflow-hidden transform-gpu ${
                  hasNotification
                    ? 'border-amber-400/80 bg-gradient-to-br from-amber-500/[0.08] via-base-200/80 to-base-200 shadow-[0_0_30px_rgba(245,158,11,0.22)] ring-1 ring-amber-400/50 hover:border-amber-300'
                    : isActive
                      ? 'border-primary ring-2 ring-primary/90 ring-offset-2 ring-offset-base-300 shadow-[0_0_35px_rgba(114,240,180,0.38),inset_0_0_22px_rgba(114,240,180,0.14)] bg-gradient-to-br from-primary/[0.18] via-base-200 to-base-200/95 z-10'
                      : 'liquid-glass-tile'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-xl transition-all relative ${
                      hasNotification
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                        : isActive
                          ? 'bg-primary text-accent-ink shadow-[0_0_18px_rgba(114,240,180,0.6)] ring-2 ring-primary/50'
                          : 'bg-ink/72 text-primary border border-line-strong group-hover:border-primary/40'
                    }`}>
                      <IconComp size={20} />
                      {hasNotification && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border border-black/50"></span>
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md border font-mono transition-all ${
                      hasNotification
                        ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 animate-pulse font-extrabold shadow-sm'
                        : isActive
                          ? 'bg-primary text-accent-ink border-primary font-black shadow-[0_0_12px_rgba(114,240,180,0.5)] flex items-center gap-1.5'
                          : 'bg-base-100/70 text-content-muted border-line'
                    }`}>
                      {hasNotification ? (
                        `${notificationCount} NOWYCH`
                      ) : isActive ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-ink animate-pulse" />
                          AKTYWNY MODUŁ
                        </>
                      ) : (
                        tile.badge
                      )}
                    </span>
                  </div>
                  <h3 className={`font-extrabold text-base sm:text-lg transition-colors truncate ${
                    hasNotification ? 'text-amber-200 group-hover:text-amber-100' : isActive ? 'text-primary font-black' : 'text-text-hi group-hover:text-primary'
                  }`}>
                    {tile.title}
                  </h3>
                  <p className="text-xs sm:text-[13px] text-content-muted mt-1 leading-relaxed line-clamp-2 min-h-[2.5rem]">
                    {tile.desc}
                  </p>
                </div>

                <div className={`mt-4 pt-2.5 border-t flex items-center justify-between text-xs font-semibold transition-colors ${
                  isActive ? 'border-primary/30' : 'border-line'
                }`}>
                  <span className={hasNotification ? 'text-amber-400 font-bold' : (isActive ? 'text-primary font-extrabold flex items-center gap-1.5' : 'text-content-muted')}>
                    {hasNotification ? `Otwórz skrzynkę (${notificationCount})` : (isActive ? '● Przeglądasz ten moduł' : 'Otwórz moduł')}
                  </span>
                  <ChevronRight size={14} className={`transition-transform group-hover:translate-x-0.5 ${
                    hasNotification ? 'text-amber-400' : (isActive ? 'text-primary' : 'text-content-muted')
                  }`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Hero Asystenta AI — wpięty na stałe pod siatką kafelków (przywrócony
            z pełnoekranowej nakładki, gdzie był schowany za przyciskiem).
            Montowany warunkiem JS (nie samym CSS `hidden md:block`), żeby na
            telefonie nie odpalał się w tle `buildStudentIndex()` — tam wejście
            do czatu zostaje przez stopkę `TeacherMobileHub` -> nakładkę. */}
        {isDesktopUI && (
          <TeacherAssistant
            mode="embedded"
            onNavigateToModule={handleAssistantNavigate}
            onSelectStudent={handleAssistantSelectStudent}
            onCreateLessonRecord={handleAssistantCreateLessonRecord}
            onOpenInPresentation={handleAssistantOpenInPresentation}
          />
        )}
      </div>
      </div>

      {/* Podwidok "Narzędzia lektora" — kafelki drugorzędne otwierane z Kafelka 4 */}
      <GSAPModal isOpen={toolsDrawerOpen} onClose={() => setToolsDrawerOpen(false)} maxWidth="max-w-3xl">
        <div className="bg-base-200 border border-line-strong rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-text-hi flex items-center gap-2">
              <Layers size={16} className="text-primary" />
              Narzędzia lektora
            </h2>
            <button
              type="button"
              onClick={() => setToolsDrawerOpen(false)}
              className="p-1.5 rounded-lg border border-line-strong text-content-muted hover:text-text-hi cursor-pointer"
              aria-label="Zamknij"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { id: 'notatnik', title: 'Notatnik lekcyjny (A4)', icon: FileEdit },
              { id: 'homework', title: 'Zadania i testy', icon: ClipboardList },
              { id: 'lesson-planner', title: 'Planer lekcji', icon: Sparkles },
              {
                id: 'mailing',
                title: 'Mailing',
                icon: Mail,
                badge: unreadMailingCount > 0 ? String(unreadMailingCount) : undefined,
              },
              { id: 'flashcard-sets', title: 'Słownictwo', icon: BookMarked },
              { id: 'admin-stats', title: 'Statystyki', icon: BarChart2 },
            ].map((item) => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setToolsDrawerOpen(false);
                    handleTileClick(item.id);
                  }}
                  className={`relative flex flex-col items-center justify-center gap-1.5 min-h-[5rem] py-3.5 px-2 rounded-2xl border text-xs sm:text-sm font-semibold transition-[border-color,box-shadow,background-color] duration-200 text-center cursor-pointer transform-gpu ${
                    item.badge
                      ? 'border-amber-400/60 bg-amber-500/10 text-amber-200'
                      : isActive
                      ? 'border-primary ring-2 ring-primary/80 ring-offset-1 ring-offset-base-300 shadow-[0_0_25px_rgba(114,240,180,0.35)] bg-gradient-to-br from-primary/[0.22] via-primary/[0.08] to-base-200 text-primary font-black'
                      : 'liquid-glass-tile text-content-muted hover:text-text-hi'
                  }`}
                >
                  {item.badge && (
                    <span className="absolute -top-1.5 -right-1.5 h-5 min-w-[1.25rem] px-1 rounded-full bg-amber-500 text-accent-ink text-[10px] font-bold flex items-center justify-center border border-black/20">
                      {item.badge}
                    </span>
                  )}
                  <IconComp size={18} className={isActive ? 'text-primary' : ''} />
                  <span className="leading-tight">{item.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </GSAPModal>

      {/* GŁÓWNY WIDOK: MODUŁ MAILING / PLANER / PREZENTACJA / KURSANCI / HISTORIA LEKCJI / ZADANIA / SŁOWNICTWO / STATYSTYKI LUB STRONA GŁÓWNA (CHAT) */}
      <div className="w-full max-w-[1640px] mx-auto px-3 sm:px-6 lg:px-8">
        <GSAPModuleTransition activeKey={activeTab || 'home'}>
          {activeTab === 'today' || activeTab === 'cockpit' ? (
            <div className="space-y-4 animate-in fade-in duration-200 mt-2">
              <TeacherTodayCockpit
                currentUser={currentUser}
                students={users}
                lessons={allTeacherLessons}
                onSelectStudent={(sId, targetTab) => {
                  const u = users.find((x) => x.id === sId);
                  if (u) handleSelectUser(u as UserWithId, targetTab || 'hub');
                }}
                onOpenPlanner={(sId) => {
                  if (sId) {
                    const u = users.find((x) => x.id === sId);
                    if (u) setSelectedUser(u as UserWithId);
                  }
                  handleTileClick('lesson-planner');
                }}
                onOpenHistory={(sId, lessonId) => {
                  if (sId) {
                    const u = users.find((x) => x.id === sId);
                    if (u) handleSelectUser(u as UserWithId, 'history');
                  } else {
                    handleTileClick('lesson-history');
                  }
                }}
                onOpenHomeworkReview={(taskId, sId) => {
                  if (sId) {
                    const u = users.find((x) => x.id === sId);
                    if (u) handleSelectUser(u as UserWithId, 'homework');
                  }
                  setActiveTab('homework');
                }}
                onOpenScratchpad={(sId) => {
                  openScratchpadTab(sId ? `sp_${sId}` : null);
                }}
                onOpenTopicDatabase={() => {
                  handleTileClick('topics');
                }}
              />
            </div>
          ) : activeTab === 'students' ? (
        <div className="space-y-4 animate-in fade-in duration-200 mt-2">
          <StandaloneStudentDatabaseScreen
            initialUsers={users}
            initialLessons={allTeacherLessons}
            onRefreshUsers={() => fetchUsers(true)}
            onSelectUser={(uId, targetTab) => {
              const u = users.find((x) => x.id === uId);
              if (u) handleSelectUser(u as UserWithId, targetTab || 'profile');
            }}
            onOpenMailing={() => setActiveTab('mailing')}
            onBack={() => setActiveTab(null)}
          />
        </div>
      ) : activeTab === 'lesson-history' || activeTab === 'history' ? (
        <div className="space-y-4 animate-in fade-in duration-200 mt-2">
          <TeacherLessonHistoryView
            lessons={allTeacherLessons}
            students={users}
            isLoading={isLoadingAllLessons}
            onRefresh={() => fetchAllLessons(users)}
            onSelectStudent={(student, targetTab) => {
              if (student.id) {
                handleSelectUser(student as UserWithId, targetTab || 'profile');
              }
            }}
            onOpenNotebook={(student) => {
              if (student.id) {
                handleSelectUser(student as UserWithId, 'scratchpad');
                openScratchpadTab(`sp_${student.id}`);
              }
            }}
            onOpenHomework={(student, lesson) => {
              if (student.id) {
                handleSelectUser(student as UserWithId, 'homework');
                setActiveTab('homework');
              }
            }}
            onOpenPresentation={async (lesson, student) => {
              if (student?.id) {
                handleSelectUser(student as UserWithId, 'lesson-planner');
                setActiveTab('lesson-planner');
              }
            }}
            onDeleteLesson={async (studentId, lesson) => {
              try {
                await deleteLessonRecord(studentId, lesson);
                showToast("Lekcja została usunięta.");
                if (selectedUser && selectedUser.id === studentId) {
                  fetchUserLogsAndStats(studentId);
                }
                fetchAllLessons(users);
              } catch (e: any) {
                alert("Błąd podczas usuwania lekcji: " + (e.message || String(e)));
              }
            }}
            onEditLesson={(_studentId, lesson) => {
              openLessonRecordModal('edit', lesson);
            }}
            onGenerateHomeworkFromLesson={(_studentId, lesson) => {
              handleGenerateHomeworkFromLesson(lesson);
            }}
            onConfirmLesson={(studentId, lesson) => handleConfirmLessonDirectly(lesson, undefined, studentId)}
            onRejectLesson={(studentId, lesson) => handleRejectNotionLesson(lesson, studentId)}
            onUpdateLesson={handleUpdateLessonRecordForStudent}
            onCleanupDuplicatePendingLessons={async (duplicates) => {
              for (const dup of duplicates) {
                await deleteLessonRecord(dup.studentId, dup);
              }
              fetchAllLessons(users);
            }}
            onAddNewLesson={() => {
              handleTileClick('lesson-planner');
            }}
          />
        </div>
      ) : activeTab === 'mailing' ? (
        <div className="space-y-4 animate-in fade-in duration-200 mt-4">
          <AdminMailingScreen onBack={() => setActiveTab(null)} />
        </div>
      ) : activeTab === 'homework' ? (
        <div className="space-y-4 animate-in fade-in duration-200 mt-4">
          <div className="flex items-center justify-between pb-3 border-b border-line-strong">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <h2 className="text-base sm:text-lg font-bold text-text-hi flex items-center gap-2">
                Zadania i testy (Centrum sprawdzania prac)
              </h2>
            </div>
            <button
              onClick={() => setActiveTab(null)}
              className="px-3 py-1.5 rounded-xl bg-line-soft hover:bg-line-soft text-content-muted hover:text-text-hi text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-line-strong"
            >
              <X size={14} />
              Wróć do strony głównej
            </button>
          </div>
          <TeacherWorkScreen onBack={() => setActiveTab(null)} />
        </div>
      ) : activeTab === 'flashcard-sets' ? (
        <div className="space-y-4 animate-in fade-in duration-200 mt-4">
          <div className="flex items-center justify-between pb-3 border-b border-line-strong">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <h2 className="text-base sm:text-lg font-bold text-text-hi flex items-center gap-2">
                Baza słownictwa i zestawy fiszek
              </h2>
            </div>
            <button
              onClick={() => setActiveTab(null)}
              className="px-3 py-1.5 rounded-xl bg-line-soft hover:bg-line-soft text-content-muted hover:text-text-hi text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-line-strong"
            >
              <X size={14} />
              Wróć do strony głównej
            </button>
          </div>
          <FlashcardSetsScreen
            onStudySet={(setId) => onViewChange?.('flashcard-study', { setId })}
            onEditSet={(setId) => onViewChange?.('flashcard-edit', { setId })}
            onStatsSet={(setId) => onViewChange?.('flashcard-stats', { setId })}
            onPresentSet={(setId) => onViewChange?.('flashcard-study', { setId, mode: 'presentation' })}
            onNavigate={onViewChange}
          />
        </div>
      ) : activeTab === 'admin-stats' ? (
        <div className="space-y-4 animate-in fade-in duration-200 mt-4">
          <div className="flex items-center justify-between pb-3 border-b border-line-strong">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <h2 className="text-base sm:text-lg font-bold text-text-hi flex items-center gap-2">
                Statystyki i analityka platformy
              </h2>
            </div>
            <button
              onClick={() => setActiveTab(null)}
              className="px-3 py-1.5 rounded-xl bg-line-soft hover:bg-line-soft text-content-muted hover:text-text-hi text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-line-strong"
            >
              <X size={14} />
              Wróć do strony głównej
            </button>
          </div>
          <AdminStatsScreen />
        </div>
      ) : activeTab === 'lesson-planner' && !isDesktopUI ? (
        <DesktopOnlyNotice moduleName="Planer lekcji" onBack={() => setActiveTab(null)} />
      ) : activeTab && ['lesson-planner', 'presentation'].includes(activeTab) ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-base-200/60 border border-primary/40 shadow-[0_0_30px_rgba(114,240,180,0.1)] space-y-4 mt-4">
          <div className="flex items-center justify-between pb-3 border-b border-line-strong">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <h2 className="text-base sm:text-lg font-bold text-text-hi flex items-center gap-2">
                {activeTab === 'lesson-planner' && 'Planer lekcji AI (Tworzenie scenariuszy)'}
                {activeTab === 'presentation' && 'Prezentacja & Notatnik Live'}
              </h2>
            </div>
            <button
              onClick={() => setActiveTab(null)}
              className="px-3 py-1.5 rounded-xl bg-line-soft hover:bg-line-soft text-content-muted hover:text-text-hi text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-line-strong"
            >
              <X size={14} />
              Wróć do strony głównej
            </button>
          </div>

          <div>
            {activeTab === 'presentation' && (
              <LessonPresentationView
                selectedUser={selectedUser}
                lessonRecords={lessonRecords}
                onOpenLessonFormWithData={(data) => {
                  setEditingRecordId(null);
                  setViewingRecord(null);
                  const sId = selectedUser?.id || '';
                  setLessonFormStudentId(sId);
                  setLessonFormStudentIds(sId ? [sId] : []);
                  setLessonFormDate(new Date().toISOString().split('T')[0]);
                  setLessonFormTopic(data.topic || '');
                  setLessonFormSummary(data.summary || '');
                  setLessonFormWords(data.words || '');
                  setLessonFormThingsToImprove(data.thingsToImprove || '');
                  setLessonFormSuggestedFollowUp(data.followUp || '');
                  setLessonFormStudentSpeaking('');
                  openLessonRecordModal('edit', undefined, true);
                  showToast('Przeniesiono podsumowanie prezentacji do formularza lekcji!');
                }}
                onClose={() => setActiveTab(null)}
              />
            )}
            {activeTab === 'lesson-planner' && (
              <>
                <div className="flex items-center justify-end gap-2 mb-4">
                  <MenuDropdown
                    align="end"
                    width={252}
                    aria-label="Bazy materiałów"
                    triggerTitle="Gotowe scenariusze i tematy źródłowe"
                    triggerClassName="px-3 py-1.5 rounded-xl border border-line-strong bg-base-100/50 text-xs font-bold text-content-muted hover:text-text-hi hover:border-primary/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                    trigger={
                      <>
                        <Layers size={13} />
                        <span>Bazy</span>
                        <ChevronDown size={12} />
                      </>
                    }
                    sections={[
                      {
                        id: 'bases',
                        items: [
                          {
                            id: 'scenarios',
                            label: 'Baza scenariuszy',
                            description: 'Lekcje ułożone wcześniej',
                            icon: <Layers size={14} />,
                            onSelect: () => onViewChange?.('lesson-scenarios'),
                          },
                          {
                            id: 'topics',
                            label: 'Baza tematów',
                            description: 'Materiał źródłowy do scenariusza',
                            icon: <Database size={14} />,
                            onSelect: () => onViewChange?.('topic-database'),
                          },
                        ],
                      },
                    ]}
                  />
                </div>
                <LessonPlannerStudio
                  selectedUser={selectedUser}
                  users={users}
                  initialScenario={plannerInitialScenario}
                  onSelectUser={(u) => {
                    if (u) {
                      handleSelectUser(u, 'lesson-planner');
                    } else {
                      setSelectedUser(null);
                    }
                  }}
                  recentLessons={lessonRecords}
                  onInsertLessonRecord={(data) => {
                    setEditingRecordId(null);
                    setViewingRecord(null);
                    const sId = selectedUser?.id || '';
                    setLessonFormStudentId(sId);
                    setLessonFormStudentIds(sId ? [sId] : []);
                    setLessonFormDate(new Date().toISOString().split('T')[0]);
                    setLessonFormTopic(data.topic || '');
                    setLessonFormSummary(data.summary || '');
                    setLessonFormWords(data.vocabulary || '');
                    setLessonFormSuggestedFollowUp(data.followUp || '');
                    setLessonFormThingsToImprove('');
                    setLessonFormStudentSpeaking('');
                    setLessonFormScenarioId(data.scenarioId || '');
                    setLessonFormScenarioTopic(data.scenarioTopic || data.topic || '');
                    setLessonFormScenarioContent(data.scenarioContent || '');
                    openLessonRecordModal('edit', undefined, true);
                    showToast('Przeniesiono scenariusz do nowej notatki z lekcji!');
                  }}
                  onOpenInPresentation={async (scenario) => {
                    try {
                      const sName = selectedUser?.firstName
                        ? `${selectedUser.firstName} ${selectedUser.lastName || ''}`.trim()
                        : selectedUser?.username || null;
                      const pres = createPresentationFromScenario(scenario, selectedUser?.id, sName);
                      await savePresentationToStorage(pres);
                      setActiveTab('presentation');
                      showToast('Scenariusz lekcji załadowany do Prezentacji Live!');
                      setTimeout(() => {
                        tabContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 150);
                    } catch (e) {
                      console.error('Błąd otwierania prezentacji:', e);
                      showToast('Nie udało się załadować scenariusza do prezentacji.');
                    }
                  }}
                  onCreateHomework={(data) => {
                    if (data.student) {
                      setSelectedUser(data.student);
                    }
                    setSpecialTaskInitialTopic(data.topic);
                    setSpecialTaskInitialWords(data.words);
                    setSpecialTaskInitialLesson(null);
                    setShowSpecialTaskModal(true);
                  }}
                />
              </>
            )}
          </div>
        </div>
      ) : (
        /* activeTab === null: strona główna panelu lektora — wyłącznie 4 kafelki
           i pasek szybkiego zapytania (patrz wyżej), bez oddzielnego, pełnego
           czatu na stronie głównej. Czat otwiera się w pełnoekranowej nakładce
           `assistantOverlayOpen` (pasek na desktopie / stopka Pocket Companion
           na telefonie). */
        null
      )}
        </GSAPModuleTransition>
      </div>
        </>
      )}

      {/* SEKCJA KURSANTA (ZAKŁADKI NA GÓRZE I DANE PROFILOWE) */}
      {!selectedUser ? null : (
        <div ref={profileContainerRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 pt-1">
          {/* NAGŁÓWEK KURSANTA — patrz components/admin/StudentProfileHeader.tsx */}
          <StudentProfileHeader
            student={selectedUser}
            onBack={() => {
              setSelectedUser(null);
              setActiveTab(null);
              if (onUserSelect) onUserSelect(null);
              if (onViewChange) onViewChange('admin');
              setPracticeLogs([]);
              setLessonRecords([]);
            }}
            onChangeStudent={() => setIsStudentPickerOpen(true)}
            onEditContact={() => {
              setActiveTab('profile');
              setProfileSection('mail');
              setTimeout(() => {
                tabContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 150);
            }}
            onEditLevel={() => {
              setActiveTab('profile');
              setProfileSection('level');
              setTimeout(() => {
                tabContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 150);
            }}
            onToggleInvitationSent={(sent) => {
              const nowIso = new Date().toISOString();
              setSelectedUser(prev => prev ? { ...prev, invitationSent: sent, ...(sent ? { invitationSentAt: nowIso } : {}) } : null);
              setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, invitationSent: sent, ...(sent ? { invitationSentAt: nowIso } : {}) } : u));
            }}
          />

          {/* PASEK ZAKŁADEK NA SAMEJ GÓRZE PROFILU KURSANTA — scalone do 4 głównych
              zakładek. Recall, Słownictwo & AI, Testy AI i osobne Statystyki nie
              zostały usunięte (SHOW_LEGACY_STUDENT_TABS === false tylko chowa
              przyciski), ich treść nadal się renderuje niżej i wchłaniają je Hub
              (metryki Recall) oraz „Profil & Dane" (metryki aktywności). */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-base-200/90 border border-line-strong backdrop-blur-md overflow-x-auto no-scrollbar shadow-inner select-none">
            {[
              { id: 'hub', label: 'Centrum kursanta (Hub)', icon: Target },
              { id: 'history', label: 'Historia Lekcji', icon: Clock, count: lessonRecords.length },
              { id: 'homework', label: 'Praca domowa', icon: BookOpen, count: specialTasks.length },
              { id: 'profile', label: 'Profil & Dane', icon: UserIcon },
              { id: 'recall', label: 'Spaced Repetition (Recall)', icon: Brain, hidden: true },
              { id: 'vocabulary', label: 'Słownictwo & AI', icon: BookMarked, count: userSets.length, hidden: true },
              { id: 'tests', label: 'Testy AI', icon: Award, hidden: true },
              { id: 'stats', label: 'Statystyki & Wyniki', icon: BarChart2, hidden: true },
            ].filter((tab) => SHOW_LEGACY_STUDENT_TABS || !tab.hidden).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setTimeout(() => {
                      tabContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-primary text-accent-ink font-extrabold shadow-md shadow-primary/20 border border-primary/50'
                      : 'text-content-muted hover:text-text-hi hover:bg-line-soft border border-transparent'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-accent-ink' : 'text-primary'} />
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold ${
                        isActive ? 'bg-accent-ink/15 text-accent-ink' : 'bg-line-soft text-primary'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ZAWARTOŚĆ ZAKŁADKI KURSANTA */}
          <div ref={tabContentRef} className="pt-2">

          {activeTab === 'hub' && (
            <StudentOperationalHub
              studentId={selectedUser.id}
              cachedStudent={selectedUser}
              currentUser={currentUser}
              onBack={() => setSelectedUser(null)}
              onOpenPlanner={(_sId, _lessonId) => {
                handleSelectUser(selectedUser as UserWithId, 'lesson-planner');
                setActiveTab('lesson-planner');
              }}
              onOpenHistory={(_sId, _lessonId) => {
                setActiveTab('history');
              }}
              onOpenHomeworkModal={(_sId) => {
                setActiveTab('homework');
                setShowSpecialTaskModal(true);
              }}
              onOpenRecall={(_sId) => {
                setActiveTab('recall');
              }}
              onEditContact={() => {
                setActiveTab('profile');
                setProfileSection('basic');
              }}
              onEditLevel={() => {
                setActiveTab('profile');
                setProfileSection('level');
              }}
            />
          )}

          {activeTab === 'recall' && (
            <div className="space-y-5 animate-fade-in">
              <StudentRecallHub
                studentId={selectedUser.id}
                studentName={selectedUser.displayName || selectedUser.firstName || selectedUser.username}
                onClose={() => setActiveTab('hub')}
              />
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-5">
              <StudentPanelSection
                title={i18n.t("Aktywność konta")}
                subtitle="Jak często kursant tu zagląda i ile przerobił"
                icon={<BarChart2 size={16} />}
              >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-base-100/45 p-5 rounded-xl border border-line-strong text-center flex flex-col items-center justify-center">
                  <div className="text-[11px] text-content-muted mb-2 font-mono uppercase tracking-wider">{i18n.t("Ilość Logowań")}</div>
                  <div className="text-3xl font-display font-bold text-text-hi">{selectedUser.loginCount || (selectedUser.lastLoginDate ? 1 : 0)}</div>
                </div>
                <div className="bg-base-100/45 p-5 rounded-xl border border-line-strong text-center flex flex-col items-center justify-center">
                  <div className="text-[11px] text-content-muted mb-2 font-mono uppercase tracking-wider">{i18n.t("Ostatnie Logowanie")}</div>
                  <div className="text-lg font-display font-bold text-primary">
                    {selectedUser.lastLoginDate ? new Date(selectedUser.lastLoginDate).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Nigdy'}
                  </div>
                </div>
                <div className="bg-base-100/45 p-5 rounded-xl border border-line-strong text-center flex flex-col items-center justify-center">
                  <div className="text-[11px] text-content-muted mb-2 font-mono uppercase tracking-wider">{i18n.t("Wykonane Zadania")}</div>
                  <div className="text-3xl font-display font-bold text-primary">{userStats?.totalTasks || 0}</div>
                </div>
                <div className="bg-base-100/45 p-5 rounded-xl border border-line-strong text-center flex flex-col items-center justify-center">
                  <div className="text-[11px] text-content-muted mb-2 font-mono uppercase tracking-wider">{i18n.t("Przetłumaczone Zdania")}</div>
                  <div className="text-3xl font-display font-bold text-primary">{userStats?.totalSentences || 0}</div>
                </div>
              </div>

              </StudentPanelSection>

              {userStats && (
                <StudentPanelSection
                  title={i18n.t("Wyniki nauki")}
                  subtitle="Skuteczność i zasób słownictwa"
                  icon={<Award size={16} />}
                >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-base-100/45 p-5 rounded-xl border border-line-strong text-center flex flex-col items-center justify-center">
                    <div className="text-[11px] text-content-muted mb-2 font-mono uppercase tracking-wider">{i18n.t("Średni Wynik")}</div>
                    <div className="text-3xl font-display font-bold text-primary">{Number.isNaN(Number(userStats.averageScore)) ? 0 : userStats.averageScore}%</div>
                  </div>
                  <div className="bg-base-100/45 p-5 rounded-xl border border-line-strong text-center flex flex-col items-center justify-center">
                    <div className="text-[11px] text-content-muted mb-2 font-mono uppercase tracking-wider">{i18n.t("Słownictwo Ogółem")}</div>
                    <div className="text-3xl font-display font-bold text-text-hi">{userStats.totalWords}</div>
                  </div>
                  <div className="bg-base-100/45 p-5 rounded-xl border border-line-strong text-center flex flex-col items-center justify-center">
                    <div className="text-[11px] text-content-muted mb-2 font-mono uppercase tracking-wider">{i18n.t("Trudne Słowa")}</div>
                    <div className="text-3xl font-display font-bold text-warn">{userStats.difficultWords}</div>
                  </div>
                </div>
                </StudentPanelSection>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-5">
              {/* JEDEN ZESTAW NARZĘDZI NA CAŁĄ HISTORIĘ.

                  Wcześniej czynności na historii lekcji stały w TRZECH
                  miejscach naraz: „Pobierz z Notion" w nagłówku kursanta,
                  „Sprawdź Notion" w pasku źródeł i pięć przycisków nad listą
                  (PDF, porządkowanie, AI Summary, Bulk Import, Dodaj wpis).
                  Trzy z nich robiły to samo — dokładały lekcję — a wyglądały
                  jak trzy różne funkcje, bo stały w trzech różnych rzędach.

                  Teraz jest jedno pytanie i jedno menu: „Lekcje" zbiera
                  WSZYSTKIE sposoby dołożenia lekcji (ręcznie, z Notion,
                  z transkrypcji, hurtem), a pod kreską porządki na tym, co
                  już jest (uporządkowanie bloków, eksport). Funkcje Notion
                  istnieją wyłącznie tutaj, bo wyłącznie tej zakładki
                  dotyczą. */}
              <StudentPanelSection
                title={i18n.t("Historia lekcji")}
                subtitle="Notatki z Notion, transkrypcje z Sifta i wpisy ręczne — jedna oś czasu"
                icon={<Clock size={16} />}
                count={lessonRecords.length}
                actions={
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCheckNotionForOpenStudent}
                      isLoading={isCheckingNotionForStudent}
                      className="text-xs flex items-center gap-1.5 py-2 px-3 border-line-strong hover:border-amber-400/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 font-semibold"
                      title={`Sprawdź w Notion, czy jest coś nowego do zaimportowania dla: ${selectedUser?.firstName || selectedUser?.username || 'tego kursanta'}`}
                    >
                      <RefreshCw size={13} className={isCheckingNotionForStudent ? 'animate-spin' : ''} />
                      Sprawdź transkrypcje w Notion
                    </Button>
                    <MenuDropdown
                      align="end"
                      width={292}
                      aria-label="Czynności na historii lekcji"
                      triggerTitle="Dodaj lekcję albo uporządkuj historię"
                      triggerClassName="px-3.5 py-2 rounded-xl bg-primary text-accent-ink text-xs sm:text-sm font-bold hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer shadow-btn"
                      trigger={
                        <>
                          <Plus size={15} />
                          <span>Lekcje</span>
                          <ChevronDown size={13} />
                        </>
                      }
                      sections={[
                        {
                          id: 'add',
                          label: 'Dołóż lekcję',
                          items: [
                            {
                              id: 'manual',
                              label: 'Wpis ręczny',
                              description: 'Pusty formularz lekcji',
                              icon: <Plus size={14} />,
                              onSelect: () => openLessonRecordModal('edit'),
                            },
                            {
                              id: 'ai',
                              label: 'Z transkrypcji lub notatek (AI)',
                              description: 'Wklej tekst albo wczytaj plik',
                              icon: <Sparkles size={14} />,
                              onSelect: () => setShowAIModal(true),
                            },
                            {
                              id: 'bulk',
                              label: 'Import zbiorczy (AI)',
                              description: 'Wiele lekcji z jednego dokumentu',
                              icon: <BookOpen size={14} />,
                              onSelect: () => setShowBulkModal(true),
                            },
                          ],
                        },
                        {
                          id: 'maintain',
                          label: 'Porządki na historii',
                          items: [
                            {
                              id: 'clean',
                              label: 'Uporządkuj lekcje (Notion)',
                              description: 'Przepisz stare wpisy na 4 bloki',
                              icon: <Wand2 size={14} />,
                              onSelect: () => setShowCleanLessonsModal(true),
                            },
                            {
                              id: 'pdf',
                              label: isExportingPDF ? 'Generowanie PDF…' : 'Eksportuj do PDF',
                              description: 'Cała historia w jednym pliku',
                              icon: <Download size={14} />,
                              disabled: isExportingPDF,
                              onSelect: () => handleExportLessonsToPDF(),
                            },
                          ],
                        },
                      ]}
                    />
                  </>
                }
                toolbar={
                  <>
                    <LessonSourceBar
                      lessons={lessonRecords}
                      studentName={selectedUser?.firstName || selectedUser?.username}
                    />
                    {lessonRecords.length > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-content-muted hover:text-text-hi transition-colors">
                        <input
                          type="checkbox"
                          className="toggle toggle-primary toggle-sm"
                          checked={groupByMonth}
                          onChange={(e) => setGroupByMonth(e.target.checked)}
                        />
                        <span>Grupuj wg miesięcy</span>
                      </label>
                    )}
                  </>
                }
              >
              <div className="space-y-5">
                {selectedUser && (
                  <LessonDuplicatesPanel
                    studentId={selectedUser.id}
                    lessonRecords={lessonRecords}
                    onRemoved={(removedIds) => {
                      setLessonRecords((prev) => prev.filter((r) => !removedIds.includes(r.id)));
                      showToast(`Usunięto ${removedIds.length} zdublowanych wpisów.`);
                    }}
                  />
                )}

                {(() => {
                  const pendingLessons = lessonRecords.filter(isLessonPendingConfirmation);
                  const confirmedLessons = lessonRecords.filter(r => !isLessonPendingConfirmation(r) && r.status !== 'rejected');
                  /* Numer lekcji jest przypisany RAZ, po dacie rosnąco, i nie
                     zależy od tego, w jakiej kolejności ekran akurat wyświetla
                     wpisy — grupowanie po miesiącach przestawia kolejność, a
                     numer ma zostać ten sam. */
                  const chronologicalNumbers = new Map<string, number>(
                    sortChronologically(confirmedLessons).map((record, index) => [record.id, index + 1])
                  );

                  // Helper: weryfikacja czy dana lekcja z Notion istnieje już w bazie kursanta
                  const findExistingMatch = (pending: LessonRecord): LessonRecord | undefined => {
                    return confirmedLessons.find(c => {
                      if (pending.id === c.id) return false;
                      // 1. Zgodność po ID strony Notion
                      if (pending.notionPageId && c.notionPageId && pending.notionPageId === c.notionPageId) {
                        return true;
                      }
                      // 2. Zgodność po dokładnej dacie
                      const pDate = pending.date?.trim();
                      const cDate = c.date?.trim();
                      if (pDate && cDate && !pending.isDateMissing && pDate === cDate && !/brak daty|empty/i.test(pDate)) {
                        return true;
                      }
                      // 3. Zgodność po znormalizowanym temacie lekcji
                      const cleanTopic = (t?: string) =>
                        (t || '').replace(/^Podsumowanie lekcji\s*—\s*brak daty\s*—\s*/i, '').trim().toLowerCase();
                      const pTopic = cleanTopic(pending.topic);
                      const cTopic = cleanTopic(c.topic);
                      if (pTopic && cTopic && pTopic === cTopic && pTopic.length > 4) {
                        return true;
                      }
                      return false;
                    });
                  };

                  const pendingWithMatches = pendingLessons.map(p => ({
                    record: p,
                    existingMatch: findExistingMatch(p),
                  }));

                  const existingUpdates = pendingWithMatches.filter(item => Boolean(item.existingMatch));
                  const brandNewPending = pendingWithMatches.filter(item => !item.existingMatch);

                  // Analiza dat: najnowsze daty z bazy i z Notion
                  const confirmedDates = confirmedLessons
                    .map(l => l.date)
                    .filter(d => d && !/brak daty/i.test(d))
                    .sort((a, b) => b.localeCompare(a));
                  const latestConfirmedDate = confirmedDates[0] || null;

                  const pendingDates = pendingLessons
                    .map(l => l.date)
                    .filter(d => d && !/brak daty/i.test(d))
                    .sort((a, b) => b.localeCompare(a));
                  const newestPendingDate = pendingDates[0] || null;
                  const newestPendingItem = pendingLessons.find(p => p.date === newestPendingDate);

                  // Lekcje nowsze niż ostatnia zatwierdzona data kursanta
                  const strictlyNewerLessons = brandNewPending.filter(
                    item => item.record.date && (!latestConfirmedDate || item.record.date > latestConfirmedDate)
                  );

                  return (
                    <div className="space-y-6">
                      {/* Wyraźne podsumowanie na samej górze na podstawie dat lekcji */}
                      {(brandNewPending.length > 0 || existingUpdates.length > 0) && (
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/15 via-base-200/90 to-amber-500/10 border border-primary/30 shadow-lg space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line-strong pb-2.5">
                            <div className="flex items-center gap-2">
                              <Sparkles size={18} className="text-primary animate-pulse shrink-0" />
                              <h4 className="text-sm font-bold text-text-hi flex items-center gap-2 flex-wrap">
                                <span>Nowości z Notion wg dat lekcji</span>
                                {strictlyNewerLessons.length > 0 && (
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-bold uppercase">
                                    {strictlyNewerLessons.length} nowszych niż ostatnia lekcja
                                  </span>
                                )}
                              </h4>
                            </div>
                            {latestConfirmedDate && (
                              <span className="text-xs font-mono text-content-muted">
                                Ostatnia data w bazie: <strong className="text-primary">{latestConfirmedDate}</strong>
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {newestPendingDate && (
                              <span className="text-xs px-3 py-1.5 rounded-xl bg-base-100/90 text-text-hi font-mono border border-line-strong flex items-center gap-1.5 shadow-sm">
                                📅 <strong className="text-primary">{newestPendingDate}</strong>
                                <span className="text-content-muted truncate max-w-[180px] sm:max-w-[320px]">
                                  — {newestPendingItem?.topic || 'Lekcja'}
                                </span>
                              </span>
                            )}

                            <span className="text-xs px-2.5 py-1.5 rounded-xl bg-primary/20 text-primary border border-primary/30 font-bold flex items-center gap-1">
                              ✨ {brandNewPending.length} nowych lekcji
                            </span>

                            {existingUpdates.length > 0 && (
                              <span className="text-xs px-2.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                                🔄 {existingUpdates.length} do zaktualizowania w bazie
                              </span>
                            )}
                          </div>

                          {strictlyNewerLessons.length > 0 && (
                            <div className="pt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="text-content-muted font-semibold">Nowe terminy z Notion:</span>
                              {strictlyNewerLessons.slice(0, 5).map(({ record }) => (
                                <span
                                  key={record.id}
                                  className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-mono font-bold"
                                >
                                  {record.date}
                                </span>
                              ))}
                              {strictlyNewerLessons.length > 5 && (
                                <span className="text-content-muted font-mono">
                                  +{strictlyNewerLessons.length - 5} więcej
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Sekcja: Do potwierdzenia (Notion-style Toggle Heading) */}
                      {pendingLessons.length > 0 && (
                        <div className="rounded-2xl bg-amber-950/20 border border-amber-500/30 shadow-md overflow-hidden transition-all">
                          {/* Toggle Heading Header - Zmniejsza zajmowane miejsce */}
                          <button
                            type="button"
                            onClick={() => setIsPendingSectionOpen(prev => !prev)}
                            className="w-full p-3.5 sm:p-4 flex items-center justify-between gap-3 text-left hover:bg-amber-500/10 transition-colors cursor-pointer select-none"
                            title="Kliknij, aby rozwinąć lub zwinąć listę lekcji do potwierdzenia"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                                {isPendingSectionOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-sm sm:text-base font-bold text-amber-300 flex items-center gap-1.5">
                                    Do potwierdzenia ({pendingLessons.length})
                                  </h4>
                                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                                    Tylko dla lektora
                                  </span>
                                  {!isPendingSectionOpen && (
                                    <span className="text-[11px] text-amber-200/70 font-mono hidden sm:inline">
                                      ({brandNewPending.length} nowych • {existingUpdates.length} do aktualizacji — kliknij, aby rozwinąć)
                                    </span>
                                  )}
                                </div>
                                {isPendingSectionOpen && (
                                  <p className="text-xs text-amber-200/80 mt-0.5">
                                    Te lekcje pochodzą z Notion, lecz mają brakującą datę lub wymagają weryfikacji. Kursant ich nie widzi dopóki ich nie zatwierdzisz.
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="text-xs font-semibold text-amber-400/80 shrink-0 flex items-center gap-1">
                              <span>{isPendingSectionOpen ? 'Zwiń' : 'Rozwiń listę'}</span>
                              {isPendingSectionOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                          </button>

                          {/* Zawartość Toggle Heading (rozwijana) */}
                          {isPendingSectionOpen && (
                            <div className="p-4 sm:p-5 pt-0 border-t border-amber-500/20 space-y-3 animate-fade-in">
                              <div className="grid grid-cols-1 gap-2.5 pt-3">
                                {pendingWithMatches.map(({ record, existingMatch }) => {
                                  const isDateBad = !record.date || /brak daty|empty/i.test(record.date) || record.isDateMissing;
                                  const isUpdatingThis = isConfirmingLessonId === record.id;

                                  return (
                                    <div
                                      key={record.id}
                                      className="p-3.5 rounded-xl bg-base-200/90 border border-amber-500/25 hover:border-amber-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                    >
                                      <div className="space-y-1 min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                                            isDateBad ? 'bg-danger/20 text-danger border border-danger/30 animate-pulse' : 'bg-base-300 text-content-muted'
                                          }`}>
                                            {isDateBad ? '⚠️ Brak daty w Notion' : record.date}
                                          </span>

                                          {existingMatch ? (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                              <RefreshCw size={10} /> Istnieje w bazie (Aktualizacja: {existingMatch.date})
                                            </span>
                                          ) : (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/20 text-primary border border-primary/30 flex items-center gap-1">
                                              <Sparkles size={10} /> Nowa lekcja
                                            </span>
                                          )}

                                          {/* Skąd ta lekcja przyszła. Dwa źródła znaczą dwie różne
                                              czynności: lekcja z Notion jest gotowa i czeka na
                                              zatwierdzenie, lekcja z transkrypcji jest surowym zapisem
                                              rozmowy i czeka na wygenerowanie bloków. */}
                                          {record.source === 'live_transcript' && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/20 text-primary border border-primary/30 flex items-center gap-1">
                                              <Mic size={10} /> Transkrypcja z Sift
                                            </span>
                                          )}

                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/25">
                                            {record.pendingReason || (record.isDateMissing ? 'Brak daty spotkania w Notion' : 'Format do weryfikacji')}
                                          </span>
                                        </div>

                                        <h5 className="font-bold text-sm text-text-hi truncate">{getDisplayLessonTopic(record)}</h5>

                                        {record.lessonSummary ? (
                                          <p className="text-xs text-content-muted line-clamp-1 italic">{record.lessonSummary}</p>
                                        ) : (
                                          <p className="text-xs text-content-muted italic">Brak wpisanego streszczenia z Notion.</p>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                        {existingMatch ? (
                                          <Button
                                            size="sm"
                                            variant="primary"
                                            onClick={() => handleUpdateExistingLessonRecord(record, existingMatch)}
                                            isLoading={isUpdatingThis}
                                            className="text-xs font-bold bg-gradient-to-r from-blue-600 to-primary text-text-hi hover:brightness-110 flex items-center gap-1.5 shadow-sm"
                                            title="Zaktualizuj istniejący rekord w bazie kursanta do widoku 4 bloków"
                                          >
                                            <RefreshCw size={13} />
                                            Zaktualizuj rekord
                                          </Button>
                                        ) : (
                                          <Button
                                            size="sm"
                                            variant="primary"
                                            onClick={() => openLessonRecordModal('edit', record)}
                                            className="text-xs font-bold bg-primary text-accent-ink hover:brightness-110 flex items-center gap-1.5 shadow-sm"
                                          >
                                            <Edit3 size={13} />
                                            Przejrzyj i zatwierdź
                                          </Button>
                                        )}

                                        {existingMatch && (
                                          <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => openLessonRecordModal('edit', record)}
                                            className="text-xs font-bold text-content-muted hover:text-text-hi flex items-center gap-1"
                                            title="Edytuj treść przed aktualizacją"
                                          >
                                            <Edit3 size={12} />
                                            Edytuj
                                          </Button>
                                        )}

                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleRejectNotionLesson(record)}
                                          isLoading={isRejectingLessonId === record.id}
                                          className="text-xs font-bold text-danger hover:bg-danger/15 hover:text-danger flex items-center gap-1"
                                          title="Odrzuć ten wpis i zablokuj przed kolejnym importem"
                                        >
                                          <X size={14} />
                                          Odrzuć
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Lista zatwierdzonych lekcji */}
                      {confirmedLessons.length > 0 ? (
                        <div className="space-y-4">
                          {(() => {
                            if (!groupByMonth) {
                              return (
                                <div className="grid grid-cols-1 gap-2.5">
                                  {confirmedLessons.map((record, index) => (
                                    <Card 
                                      key={record.id}
                                      className="relative group cursor-pointer p-3 rounded-xl liquid-glass-hover bg-base-200/40 border border-line"
                                      onClick={() => openLessonRecordModal('view', record)}
                                    >
                                      <div className="absolute top-1/2 -translate-y-1/2 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleGenerateHomeworkFromLesson(record); }}
                                          className="p-1.5 bg-base-100 rounded-lg text-content-muted hover:text-primary hover:bg-primary/10 transition-colors"
                                          title="Wygeneruj pracę domową z tej lekcji"
                                        >
                                          <Sparkles className="h-4 w-4 text-primary" />
                                        </button>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); openLessonRecordModal('edit', record); }}
                                          className="p-1.5 bg-base-100 rounded-lg text-content-muted hover:text-primary hover:bg-base-200 transition-colors"
                                          title="Edytuj lekcję"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                          </svg>
                                        </button>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleDeleteLessonRecord(record); }}
                                          className="p-1.5 bg-base-100 rounded-lg text-content-muted hover:text-danger hover:bg-base-200 transition-colors"
                                          title="Usuń lekcję"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </div>
                                      <div className="flex items-center gap-3 pr-20">
                                        <div className="w-10 h-10 flex-shrink-0 bg-primary/10 text-primary font-mono text-sm font-bold rounded-lg flex items-center justify-center">
                                          #{confirmedLessons.length - index}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                           <div className="flex items-center gap-2 flex-wrap">
                                             <h4 className="font-bold text-base line-clamp-1">{getDisplayLessonTopic(record)}</h4>
                                             {record.scenarioTopic && (
                                               <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 truncate max-w-[220px]" title={`Podstawa lekcji: ${record.scenarioTopic}`}>
                                                 🔗 {record.scenarioTopic}
                                               </span>
                                             )}
                                           </div>
                                           <span className="text-xs font-mono text-content-muted">{record.date}</span>
                                        </div>
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              );
                            }

                            const groups: { key: string, items: typeof confirmedLessons }[] = [];
                            let currentGroupKey = '';
                            let currentGroup: { key: string, items: typeof confirmedLessons } | null = null;
                            
                            const startOfWeek = new Date();
                            startOfWeek.setHours(0, 0, 0, 0);
                            startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));

                            confirmedLessons.forEach(record => {
                                const d = new Date(record.date);

                                let groupKey = '';
                                if (Number.isNaN(d.getTime())) {
                                    groupKey = 'Inne';
                                } else if (d.getTime() >= startOfWeek.getTime()) {
                                    groupKey = 'Ten tydzień';
                                } else {
                                    groupKey = d.toLocaleString('pl-PL', { month: 'long', year: 'numeric' }).toUpperCase();
                                }

                                if (groupKey !== currentGroupKey) {
                                    currentGroupKey = groupKey;
                                    currentGroup = { key: groupKey, items: [] };
                                    groups.push(currentGroup);
                                }
                                currentGroup?.items.push(record);
                            });

                            return groups.map((group) => {
                                const isExpanded = expandedMonths[group.key] === true; // Default to false
                                
                                return (
                                    <div key={group.key} className="flex flex-col gap-2.5">
                                        <div 
                                            className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all border liquid-glass-tile ${
                                                isExpanded 
                                                    ? 'bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(114,240,180,0.15)]' 
                                                    : 'bg-base-200/40 border-line-strong hover:bg-base-200 hover:border-line-strong'
                                            }`}
                                            onClick={() => setExpandedMonths(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                                        >
                                            <div className="flex items-center gap-3.5">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                                    isExpanded ? 'bg-primary text-accent-ink' : 'bg-base-300 text-content-muted'
                                                }`}>
                                                    <Calendar className="w-4 h-4" />
                                                </div>
                                                <span className={`text-sm font-bold tracking-wide ${isExpanded ? 'text-primary' : 'text-content'}`}>
                                                    {group.key}
                                                </span>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-base-300 text-content-muted">
                                                    {group.items.length}
                                                </span>
                                            </div>
                                            <div className={`p-1 rounded-md transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                                <ChevronDown className={`w-4 h-4 ${isExpanded ? 'text-primary' : 'text-content-muted'}`} />
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="grid grid-cols-1 gap-2.5 pl-2 sm:pl-4 border-l-2 border-primary/10 ml-2 sm:ml-4 mt-1 mb-2 animate-fadeIn">
                                                {group.items.map(record => {
                                                    /* Numeracja OD NAJSTARSZEJ: #1 to pierwsze zajęcia
                                                       z tym kursantem i ten numer nigdy się nie zmienia.
                                                       Wcześniej liczyliśmy od końca, więc każda nowa lekcja
                                                       przesuwała numery wszystkich poprzednich — „wróć do
                                                       lekcji 5" znaczyło co tydzień co innego. */
                                                    const lessonNumber = chronologicalNumbers.get(record.id) || 0;

                                                    return (
                                                        <Card 
                                                          key={record.id}
                                                          className="relative group cursor-pointer p-3 rounded-xl liquid-glass-hover bg-base-200/40 border border-line"
                                                          onClick={() => openLessonRecordModal('view', record)}
                                                        >
                                                          <div className="absolute top-1/2 -translate-y-1/2 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                              onClick={(e) => { e.stopPropagation(); handleGenerateHomeworkFromLesson(record); }}
                                                              className="p-1.5 bg-base-100 rounded-lg text-content-muted hover:text-primary hover:bg-primary/10 transition-colors"
                                                              title="Wygeneruj pracę domową z tej lekcji"
                                                            >
                                                              <Sparkles className="h-4 w-4 text-primary" />
                                                            </button>
                                                            <button 
                                                              onClick={(e) => { e.stopPropagation(); openLessonRecordModal('edit', record); }}
                                                              className="p-1.5 bg-base-100 rounded-lg text-content-muted hover:text-primary hover:bg-base-200 transition-colors"
                                                              title="Edytuj lekcję"
                                                            >
                                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                              </svg>
                                                            </button>
                                                            <button 
                                                              onClick={(e) => { e.stopPropagation(); handleDeleteLessonRecord(record); }}
                                                              className="p-1.5 bg-base-100 rounded-lg text-content-muted hover:text-danger hover:bg-base-200 transition-colors"
                                                              title="Usuń lekcję"
                                                            >
                                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                              </svg>
                                                            </button>
                                                          </div>
                                                          <div className="flex items-center gap-3 pr-20">
                                                            <div className="w-10 h-10 flex-shrink-0 bg-primary/10 text-primary font-mono text-sm font-bold rounded-lg flex items-center justify-center">
                                                              #{lessonNumber}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                               <div className="flex items-center gap-2 flex-wrap">
                                                                 <h4 className="font-bold text-base line-clamp-1">{getDisplayLessonTopic(record)}</h4>
                                                                 {record.scenarioTopic && (
                                                                   <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 truncate max-w-[220px]" title={`Podstawa lekcji: ${record.scenarioTopic}`}>
                                                                     🔗 {record.scenarioTopic}
                                                                   </span>
                                                                 )}
                                                               </div>
                                                               <span className="text-xs font-mono text-content-muted">{record.date}</span>
                                                            </div>
                                                          </div>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                          })()}
                        </div>
                      ) : (
                        <p className="text-content-muted italic">
                          {pendingLessons.length > 0 
                            ? `Wszystkie wpisy (${pendingLessons.length}) oczekują na Twoje potwierdzenie w sekcji powyżej.`
                            : i18n.t("Brak historii lekcji.")}
                        </p>
                      )}

                      {/* Sekcja podręczna: Odrzucone z Notion */}
                      {rejectedLessons.length > 0 && (
                        <div className="mt-6 border border-line-strong rounded-2xl bg-base-200/30 overflow-hidden text-xs">
                          <div
                            onClick={() => setShowRejectedLessonsSection(prev => !prev)}
                            className="p-3.5 bg-base-300/40 flex items-center justify-between cursor-pointer hover:bg-base-300/70 transition-colors select-none"
                          >
                            <div className="flex items-center gap-2 text-content-muted font-medium">
                              <span className="text-sm">🛡️</span>
                              <span className="font-bold text-text-hi">Odrzucone tematy z Notion ({rejectedLessons.length})</span>
                              <span className="text-[11px] text-content-muted hidden sm:inline">
                                — aplikacja nie importuje ich przy kolejnych synchronizacjach
                              </span>
                            </div>
                            <ChevronDown
                              size={16}
                              className={`text-content-muted transition-transform duration-200 ${
                                showRejectedLessonsSection ? 'rotate-180' : ''
                              }`}
                            />
                          </div>

                          {showRejectedLessonsSection && (
                            <div className="p-4 space-y-2 border-t border-line bg-base-200/20">
                              <p className="text-[11px] text-content-muted mb-3 leading-relaxed">
                                Poniższe pozycje zostały odrzucone z Notion. Dzięki temu przy kolejnych synchronizacjach nie pojawią się ponownie w historii ani w podsumowaniach. Jeśli chcesz przywrócić dany temat, aby móc go ponownie zaimportować, kliknij „Przywróć”.
                              </p>
                              <div className="divide-y divide-white/5">
                                {rejectedLessons.map((rej) => (
                                  <div key={rej.id} className="py-2.5 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="font-bold text-text-hi truncate text-xs">{rej.topic}</div>
                                      <div className="text-[10px] text-content-muted flex items-center gap-3 mt-0.5">
                                        {rej.date && <span>Data: {rej.date}</span>}
                                        <span>Odrzucono: {new Date(rej.rejectedAt).toLocaleDateString('pl-PL')}</span>
                                        {rej.reason && <span className="italic text-content-muted/80">({rej.reason})</span>}
                                      </div>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleRestoreRejectedLesson(rej.id, rej.topic)}
                                      className="text-xs text-primary hover:underline hover:bg-primary/10 shrink-0 font-bold"
                                    >
                                      Przywróć
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              </StudentPanelSection>

              <StudentPanelSection
                title={i18n.t("Historia ćwiczeń (App)")}
                subtitle="Co kursant przećwiczył samodzielnie w aplikacji"
                icon={<BarChart2 size={16} />}
                count={practiceLogs.length}
              >
                {practiceLogs.length > 0 ? (
                  <div className="rounded-xl border border-line-strong overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-base-100/50 text-content-muted font-mono uppercase text-xs">
                        <tr>
                          <th className="p-3">{i18n.t("Data")}</th>
                          <th className="p-3">{i18n.t("Typ")}</th>
                          <th className="p-3">{i18n.t("Zestaw")}</th>
                          <th className="p-3 text-right">{i18n.t("Wynik")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {practiceLogs.map(log => {
                          let scorePercent = null;
                          if (log.score !== undefined) {
                            const scoreNum = Number(log.score) || 0;
                            scorePercent = Number.isNaN(Number(scoreNum)) ? 0 : ((scoreNum <= 1 && scoreNum > 0) ? Math.round(scoreNum * 100) : Math.round(scoreNum));
                          }
                          
                          return (
                          <tr key={log.id} className="cursor-pointer liquid-glass-hover">
                            <td className="p-3 whitespace-nowrap">{new Date(log.date).toLocaleString()}</td>
                            <td className="p-3 capitalize">
                               <div className="flex items-center gap-2">
                                  {log.exerciseType}
                                  {log.exerciseFormat && (
                                     <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded border border-primary/20">{log.exerciseFormat}</span>
                                  )}
                               </div>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col">
                                <span>{log.setDisplayName || '-'}</span>
                                {log.wordsUsed && log.wordsUsed.length > 0 && (
                                  <span className="text-[10px] text-content-muted mt-0.5 line-clamp-1" title={log.wordsUsed.join(', ')}>
                                    {log.wordsUsed.join(', ')}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-right font-mono font-medium">
                              {scorePercent !== null ? (
                                <span className={scorePercent >= 80 ? 'text-primary font-bold' : scorePercent >= 50 ? 'text-warn' : 'text-danger'}>
                                  {scorePercent}% {log.totalWords ? `(${log.totalWords} el.)` : ''}
                                </span>
                              ) : '-'}
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-content-muted italic text-sm">{i18n.t("Brak ćwiczeń.")}</p>
                )}
              </StudentPanelSection>
            </div>
          )}

          {activeTab === 'homework' && (
            <div className="space-y-5">
              <HomeworkScreen
                initialStudentId={selectedUser?.id || null}
              />
            </div>
          )}

          {/* Zakładka testów. Kafelek i nagłówek istniały, ale nic pod nimi się
              nie renderowało — generator i przegląd testów były zaimportowane i
              nieużywane, więc kliknięcie „Testy" prowadziło na pustą stronę. */}
          {activeTab === 'tests' && (
            <div className="space-y-5">
              <StudentPanelSection
                title="Generator testów AI"
                subtitle="Ułóż test dla tego kursanta albo wystaw test otwarty"
                icon={<Award size={16} />}
              >
                <AdminTestGenerator user={selectedUser} users={users} />
              </StudentPanelSection>

              {/* Testy otwarte: dla kandydatów, których nie ma jeszcze w bazie.
                  Wystawia się je w generatorze wyżej, a tutaj żyją ich kody,
                  linki i podejścia. */}
              <StudentPanelSection
                title="Testy otwarte"
                subtitle="Bez przypisanego kursanta — kody, linki i podejścia"
                icon={<Shield size={16} />}
              >
                {currentUser?.id && <PublicTestPanel teacherId={currentUser.id} />}
              </StudentPanelSection>

              <StudentPanelSection
                title="Wszystkie testy"
                subtitle="Podejścia i wyniki w całej bazie"
                icon={<ClipboardList size={16} />}
              >
                <AllTestsTeacherView />
              </StudentPanelSection>
            </div>
          )}

          {activeTab === 'vocabulary' && (
            <div className="space-y-5">
              {specialTasks.length > 0 && (
                <StudentPanelSection
                  title={i18n.t("Zadania specjalne")}
                  subtitle="Zdania ułożone pod tego kursanta"
                  icon={<Sparkles size={16} />}
                  count={specialTasks.length}
                  actions={
                    <Button size="sm" variant="secondary" onClick={() => setShowSpecialTaskModal(true)}>
                      {i18n.t("Nowe zadanie (AI)")}
                    </Button>
                  }
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {specialTasks.map(task => (
                      <Card key={task.id} className="p-4 rounded-xl bg-primary/5 border border-primary/20 relative group">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-lg pr-2">{task.title}</h4>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">
                              {i18n.t("Zadanie specjalne")}
                            </span>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!(await confirmAsync(i18n.t("Czy na pewno chcesz usunąć to zadanie specjalne? Kursant nie będzie go już widział.")))) return;
                                try {
                                  await deleteDoc(doc(db, 'specialTasks', task.id));
                                  setSpecialTasks(prev => prev.filter(t => t.id !== task.id));
                                } catch (err) {
                                  console.error(err);
                                  alert(i18n.t("Błąd podczas usuwania zadania"));
                                }
                              }}
                              className="p-1 rounded text-content-muted hover:text-danger hover:bg-danger/10 transition-colors"
                              title={i18n.t("Usuń zadanie specjalne")}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-content-muted mb-4">{i18n.t("Ilość zdań:")} {task.sentences?.length || 0}</p>
                        <div className="flex items-center justify-between text-xs font-mono text-content-muted">
                          <span className={task.status === 'completed' ? 'text-primary' : 'text-warn'}>
                            {task.status === 'completed' ? 'Ukończone' : 'Oczekujące'}
                          </span>
                          <span>{new Date(task.createdAt?.seconds ? task.createdAt.seconds * 1000 : task.createdAt).toLocaleDateString()}</span>
                        </div>
                      </Card>
                    ))}
                  </div>
                </StudentPanelSection>
              )}

              <StudentPanelSection
                title={i18n.t("Zestawy słówek")}
                subtitle="Przypisane fiszki — z lekcji i od lektora"
                icon={<BookMarked size={16} />}
                count={userSets.length}
                actions={
                  <>
                    {specialTasks.length === 0 && (
                      <Button size="sm" variant="secondary" onClick={() => setShowSpecialTaskModal(true)}>
                        {i18n.t("Zadanie specjalne (AI)")}
                      </Button>
                    )}
                    <Button size="sm" onClick={() => setShowAssignModal(true)}>
                      {i18n.t("Przypisz zestaw")}
                    </Button>
                  </>
                }
              >
              {userSets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {userSets.map(set => (
                    <Card key={set.id} className="p-4 cursor-pointer rounded-xl liquid-glass-hover bg-base-200/40 border border-line">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-lg">{set.title || (set as any).name}</h4>
                        {set.assignedByTeacher && (
                          <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">{i18n.t("Od Nauczyciela")}</span>
                        )}
                      </div>
                      <p className="text-sm text-content-muted mb-4">{set.description || 'Brak opisu'}</p>
                      <div className="flex items-center gap-4 text-xs font-mono text-content-muted">
                        <span>{i18n.t("Fiszki:")} {set.cardCount}</span>
                        <span>{new Date(set.createdAt?.seconds ? set.createdAt.seconds * 1000 : set.createdAt).toLocaleDateString()}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-content-muted">
                  {i18n.t("Brak przypisanych zestawów słówek.")}
                </div>
              )}
              </StudentPanelSection>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-5 animate-fade-in">
              <StudentPanelSection
                title={i18n.t("Profil i parametry kursanta")}
                subtitle={i18n.t("Wybierz sekcję po lewej. Zmiany zapisuje przycisk obok.")}
                icon={<UserIcon size={16} />}
                actions={
                  <Button
                    size="sm"
                    onClick={() => handleSaveProfile()}
                    isLoading={isSavingProfile}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save size={15} />
                    {i18n.t("Zapisz profil")}
                  </Button>
                }
              >

              {/* SPIS SEKCJI — pięć równych pozycji, jedna otwarta.

                  Na komputerze kolumna z lewej, na telefonie przewijany pasek.
                  To ten sam wzór, co w ustawieniach systemowych i z tego samego
                  powodu: ustawień się nie czyta po kolei, tylko wchodzi się po
                  jedną rzecz i wychodzi. */}
              <div className="flex flex-col md:flex-row gap-4 md:gap-5">
                <nav
                  aria-label="Sekcje profilu"
                  className="md:w-52 shrink-0 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible no-scrollbar -mx-1 px-1 md:mx-0 md:px-0"
                >
                  {[
                    { id: 'basic', label: 'Dane podstawowe i poziom', icon: UserIcon },
                    { id: 'access', label: 'E-mail, dostęp i uprawnienia', icon: Shield },
                    { id: 'activity', label: 'Aktywność i statystyki', icon: Activity },
                  ].map(section => {
                    const SectionIcon = section.icon;
                    const isActive =
                      profileSection === section.id ||
                      (section.id === 'basic' && profileSection === 'level') ||
                      (section.id === 'access' && profileSection === 'mail');
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setProfileSection(section.id as any)}
                        className={`shrink-0 md:w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                          isActive
                            ? 'bg-primary/12 border-primary/40 text-primary'
                            : 'bg-base-200/40 border-line-strong text-content-muted hover:text-text-hi hover:border-primary/30'
                        }`}
                      >
                        <SectionIcon size={15} className="shrink-0" />
                        <span className="truncate">{section.label}</span>
                      </button>
                    );
                  })}
                </nav>

                <div className="flex-1 min-w-0 space-y-4">

              {/* CARD 1: DANE PODSTAWOWE I IDENTYFIKACJA */}
              {(profileSection === 'basic' || profileSection === 'level') && (
              <div className="rounded-xl border border-line-strong bg-base-100/40 p-4 md:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <UserIcon size={16} />
                    </span>
                    <h4 className="font-bold text-text-hi text-base">{i18n.t("Dane podstawowe i identyfikacja")}</h4>
                  </div>
                  <span className="text-xs text-content-muted font-mono">
                    ID: <span className="text-text-hi/80 select-all" title="Kliknij, aby zaznaczyć">{selectedUser.id}</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-1.5">
                      {i18n.t("Imię")}
                    </label>
                    <input
                      type="text"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
                      placeholder={i18n.t("Wprowadź imię...")}
                      className="w-full bg-base-100/60 border border-line-strong rounded-xl px-3.5 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all text-sm text-text-hi"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-1.5">
                      {i18n.t("Nazwisko")}
                    </label>
                    <input
                      type="text"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
                      placeholder={i18n.t("Wprowadź nazwisko...")}
                      className="w-full bg-base-100/60 border border-line-strong rounded-xl px-3.5 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all text-sm text-text-hi"
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-base-100/40 p-3.5 rounded-xl border border-line">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-content-muted uppercase tracking-wider block">
                      {i18n.t("Nazwa konta / Login (username)")}
                    </span>
                    <span className="text-sm font-mono font-bold text-primary">
                      @{selectedUser.username}
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex items-center gap-1.5 text-xs bg-line-soft hover:bg-line-soft border-line-strong text-text-hi cursor-pointer"
                    onClick={() => {
                      const newName = prompt('Podaj nową nazwę konta (username):', selectedUser.username);
                      if (newName && newName.trim() && newName.trim() !== selectedUser.username) {
                        const trimmedName = newName.trim();
                        const userRef = doc(db, 'users', selectedUser.id);
                        updateDoc(userRef, { username: trimmedName }).then(() => {
                          const updated = { ...selectedUser, username: trimmedName };
                          setSelectedUser(updated);
                          setUsers(users.map(u => u.id === updated.id ? updated : u));
                          showToast('Nazwa konta została zaktualizowana.');
                        }).catch(err => alert('Błąd: ' + err.message));
                      }
                    }}
                  >
                    <Edit2 size={13} />
                    {i18n.t("Zmień login")}
                  </Button>
                </div>
              </div>
              )}

              {/* CARD 2: KOMUNIKACJA I MAILING */}
              {(profileSection === 'mail' || profileSection === 'access') && (
              <div className="rounded-xl border border-line-strong bg-base-100/40 p-4 md:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <Mail size={16} />
                    </span>
                    <h4 className="font-bold text-text-hi text-base">{i18n.t("Komunikacja i powiadomienia e-mail (Mailing)")}</h4>
                  </div>
                  {profileForm.email && !profileForm.email.includes('@student.vocabboost.com') && profileForm.email.includes('@') && profileForm.email.includes('.') ? (
                    <span className="text-xs text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full flex items-center gap-1 font-semibold">
                      ✓ {i18n.t("Dostarczalny (Resend)")}
                    </span>
                  ) : (
                    <span className="text-xs text-warn bg-warn/10 border border-warn/20 px-2.5 py-1 rounded-full flex items-center gap-1 font-semibold">
                      ⚠ {i18n.t("Zastępczy / brak wysyłki")}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-1.5">
                    {i18n.t("Adres e-mail kursanta")}
                  </label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder={i18n.t("np. kursant@gmail.com")}
                    className="w-full bg-base-100/60 border border-line-strong rounded-xl px-3.5 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all font-mono text-sm text-text-hi"
                  />
                  <p className="text-xs text-content-muted mt-1.5">
                    {i18n.t("Adres wykorzystywany do wysyłki prac domowych i ogłoszeń przez Resend API oraz do logowania konta.")}
                  </p>
                </div>

                {/* Mailing subscription toggle */}
                <div className="p-4 rounded-xl bg-base-100/40 border border-line-strong flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-text-hi flex items-center gap-2">
                      {profileForm.emailNotificationsDisabled ? (
                        <span className="text-warn flex items-center gap-1.5">
                          <BellOff size={16} />
                          {i18n.t("Mailing wyłączony (wypisany)")}
                        </span>
                      ) : (
                        <span className="text-primary flex items-center gap-1.5">
                          <Bell size={16} />
                          {i18n.t("Powiadomienia i mailing aktywne")}
                        </span>
                      )}
                    </span>
                    <p className="text-xs text-content-muted max-w-lg">
                      {profileForm.emailNotificationsDisabled 
                        ? i18n.t("Kursant nie będzie otrzymywał automatycznych e-maili z pracami domowymi ani wiadomości z modułu Mailing.")
                        : i18n.t("Kursant może otrzymywać powiadomienia o nowych zadaniach domowych i wiadomości e-mail z modułu Mailing.")}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className={`shrink-0 cursor-pointer font-semibold ${
                      profileForm.emailNotificationsDisabled 
                        ? 'bg-warn/15 text-warn hover:bg-warn/25 border-warn/30' 
                        : 'bg-primary/15 text-primary hover:bg-primary/25 border-primary/30'
                    }`}
                    onClick={() => {
                      setProfileForm(prev => ({
                        ...prev,
                        emailNotificationsDisabled: !prev.emailNotificationsDisabled
                      }));
                    }}
                  >
                    {profileForm.emailNotificationsDisabled ? (
                      <>
                        <Bell size={14} className="mr-1" />
                        {i18n.t("Włącz powiadomienia")}
                      </>
                    ) : (
                      <>
                        <BellOff size={14} className="mr-1" />
                        {i18n.t("Wyłącz powiadomienia")}
                      </>
                    )}
                  </Button>
                </div>

                {/* Zaproszenie do aplikacji (Login, hasło, link) */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-sm font-bold text-text-hi flex items-center gap-2">
                      <Send size={15} className="text-primary" />
                      {i18n.t("Zaproszenie do aplikacji (Login, hasło, link)")}
                      {selectedUser.lastInviteSentAt && (
                        <span className="text-[11px] font-normal text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          Wysłano: {new Date(selectedUser.lastInviteSentAt).toLocaleDateString('pl-PL')}
                        </span>
                      )}
                    </span>
                    <p className="text-xs text-content-muted max-w-lg">
                      {i18n.t("Wyślij spersonalizowaną wiadomość e-mail z wygenerowanym loginem, hasłem oraz bezpośrednim linkiem do platformy.")}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-primary text-accent-ink hover:brightness-110 font-bold flex items-center gap-2 shrink-0 cursor-pointer text-xs"
                    onClick={() => setShowInviteModal(true)}
                  >
                    <Send size={14} />
                    {i18n.t("Wyślij zaproszenie")}
                  </Button>
                </div>

                {/* Współdzielony Notatnik lekcyjny */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-sm font-bold text-text-hi flex items-center gap-2">
                      <FileEdit size={15} className="text-emerald-400" />
                      {i18n.t("Współdzielony Notatnik")}
                    </span>
                    <p className="text-xs text-content-muted max-w-lg">
                      {i18n.t("Stały notatnik z notatkami z lekcji. Kursant może zawsze sprawdzić notatki przez kod PIN lub link bez logowania.")}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 font-bold flex items-center gap-2 shrink-0 cursor-pointer text-xs"
                    onClick={() => openScratchpadTab(selectedUser ? `sp_${selectedUser.id}` : null)}
                  >
                    <FileEdit size={14} />
                    {i18n.t("Otwórz Notatnik")}
                  </Button>
                </div>
              </div>
              )}


              {/* CARD 3: POZIOM CEFR & KONFIGURACJA AI */}
              {(profileSection === 'basic' || profileSection === 'level') && (
              <div className="rounded-xl border border-line-strong bg-base-100/40 p-4 md:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <Sparkles size={16} />
                    </span>
                    <h4 className="font-bold text-text-hi text-base">{i18n.t("Poziom zaawansowania i konfiguracja AI")}</h4>
                  </div>
                  {profileForm.level && (
                    <span className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/30 rounded-lg text-xs font-mono font-bold">
                      {profileForm.level}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-1.5">
                    {i18n.t("Poziom biegłości językowej (CEFR)")}
                  </label>
                  <select
                    value={profileForm.level}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, level: e.target.value }))}
                    className="w-full bg-base-100/60 border border-line-strong rounded-xl px-3.5 py-2.5 outline-none focus:border-primary text-text-hi cursor-pointer transition-colors text-sm"
                  >
                    <option value="">{i18n.t("Brak wybranego poziomu")}</option>
                    <option value="A1">A1 — Początkujący</option>
                    <option value="A2">A2 — Podstawowy</option>
                    <option value="A2/B1">A2/B1 — Średniozaawansowany niższy</option>
                    <option value="B1">B1 — Średniozaawansowany</option>
                    <option value="B1/B2">B1/B2 — Średniozaawansowany wyższy</option>
                    <option value="B2">B2 — Wyższy średniozaawansowany</option>
                    <option value="B2/C1">B2/C1 — Zaawansowany niższy</option>
                    <option value="C1">C1 — Zaawansowany</option>
                    <option value="C2">C2 — Biegły / Profesjonalny</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-1.5">
                    {i18n.t("Opis profilu kursanta (kontekst dla modeli AI)")}
                  </label>
                  <textarea
                    value={profileForm.description}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={i18n.t("Zainteresowania, branża, cele językowe, trudności gramatyczne...")}
                    rows={4}
                    className="w-full bg-base-100/60 border border-line-strong rounded-xl p-3 outline-none focus:border-primary resize-y transition-colors text-sm text-text-hi"
                  />
                  <p className="text-xs text-content-muted mt-1.5">
                    {i18n.t("AI uwzględnia ten opis podczas generowania zadań domowych, fiszek i scenariuszy lekcji.")}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-1.5">
                    {i18n.t("Żelazne reguły i prompt dla AI (absolutny priorytet)")}
                  </label>
                  <textarea
                    value={profileForm.aiPrompt}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, aiPrompt: e.target.value }))}
                    placeholder={i18n.t("Wpisz specyficzne zasady, wzornictwo lub słownictwo, którego AI ma ściśle przestrzegać...")}
                    rows={3}
                    className="w-full bg-base-100/60 border border-line-strong rounded-xl p-3 outline-none focus:border-primary resize-y font-mono text-sm text-text-hi transition-colors"
                  />
                  <p className="text-xs text-content-muted mt-1.5">
                    {i18n.t("Reguły te nadpisują domyślne zachowanie asystenta AI przy generowaniu ćwiczeń dla tego ucznia.")}
                  </p>
                </div>
              </div>
              )}

              {/* CARD 4: METRYKI AKTYWNOŚCI */}
              {profileSection === 'activity' && (
              <div className="rounded-xl border border-line-strong bg-base-100/40 p-4 md:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <Activity size={16} />
                    </span>
                    <h4 className="font-bold text-text-hi text-base">{i18n.t("Aktywność i Statystyki")}</h4>
                  </div>
                  <span className="text-xs text-content-muted font-mono">
                    {selectedUser.id}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-base-100/40 border border-line text-center">
                    <div className="text-xs text-content-muted uppercase tracking-wider mb-1 font-mono">
                      {i18n.t("Liczba wizyt")}
                    </div>
                    <div className="text-2xl font-bold text-text-hi">
                      {selectedUser.loginCount || 0}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-base-100/40 border border-line text-center">
                    <div className="text-xs text-content-muted uppercase tracking-wider mb-1 font-mono">
                      {i18n.t("Lekcje w bazie")}
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      {lessonRecords.length}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-base-100/40 border border-line text-center">
                    <div className="text-xs text-content-muted uppercase tracking-wider mb-1 font-mono">
                      {i18n.t("Ostatnia aktywność")}
                    </div>
                    <div className="text-xs font-mono text-text-hi mt-1.5 truncate">
                      {selectedUser.lastLoginDate ? new Date(selectedUser.lastLoginDate).toLocaleDateString('pl-PL') : i18n.t('Brak danych')}
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* CARD 5: UPRAWNIENIA I ZARZĄDZANIE KONTEM */}
              {(profileSection === 'mail' || profileSection === 'access') && (
              <div className="rounded-xl border border-line-strong bg-base-100/40 p-4 md:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <Shield size={16} />
                    </span>
                    <h4 className="font-bold text-text-hi text-base">{i18n.t("Uprawnienia i zarządzanie kontem")}</h4>
                  </div>
                </div>

                {/* Role Switcher */}
                <div>
                  <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-2">
                    {i18n.t("Rola w systemie:")}
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileForm(prev => ({ ...prev, role: 'user' }));
                        handleRoleChange('user');
                      }}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                        (profileForm.role || selectedUser.role) === 'user' 
                          ? 'bg-primary text-accent-ink shadow-md scale-[1.02]' 
                          : 'bg-base-100/60 text-content-muted hover:text-text-hi border border-line-strong'
                      }`}
                    >
                      <UserIcon size={14} />
                      {i18n.t("Kursant (User)")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileForm(prev => ({ ...prev, role: 'teacher' }));
                        handleRoleChange('teacher');
                      }}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                        (profileForm.role || selectedUser.role) === 'teacher' 
                          ? 'bg-blue-500 text-[#ffffff] shadow-md scale-[1.02]' 
                          : 'bg-base-100/60 text-content-muted hover:text-text-hi border border-line-strong'
                      }`}
                    >
                      <Sparkles size={14} />
                      {i18n.t("Nauczyciel (Teacher)")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileForm(prev => ({ ...prev, role: 'admin' }));
                        handleRoleChange('admin');
                      }}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                        (profileForm.role || selectedUser.role) === 'admin' 
                          ? 'bg-danger text-[#ffffff] shadow-md scale-[1.02]' 
                          : 'bg-base-100/60 text-content-muted hover:text-text-hi border border-line-strong'
                      }`}
                    >
                      <Shield size={14} />
                      {i18n.t("Administrator (Admin)")}
                    </button>
                  </div>
                </div>

                {/* AI Live Monitor Setting */}
                <div className="p-3.5 rounded-xl bg-base-100/40 border border-line-strong flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-text-hi block">
                      {selectedUser.showAiMonitor || selectedUser.canViewAiMonitor 
                        ? i18n.t("Widoczność modeli AI & Live Monitor: Włączone") 
                        : i18n.t("Widoczność modeli AI: Ukryte przed kursantem (domyślne)")}
                    </span>
                    <p className="text-xs text-content-muted">
                      {selectedUser.showAiMonitor || selectedUser.canViewAiMonitor
                        ? i18n.t("Uczeń może podejrzeć nazwy modeli AI (OpenAI/Gemini) i logi zapytań.")
                        : i18n.t("Domyślnie uczeń nie widzi nazw modeli AI ani zapytań technicznych.")}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className={selectedUser.showAiMonitor || selectedUser.canViewAiMonitor ? "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/40 shrink-0 cursor-pointer" : "bg-base-300 text-content-muted hover:text-text-hi shrink-0 cursor-pointer"}
                    onClick={() => {
                      const currentVal = Boolean(selectedUser.showAiMonitor || selectedUser.canViewAiMonitor);
                      const newStatus = !currentVal;
                      const userRef = doc(db, 'users', selectedUser.id);
                      updateDoc(userRef, { showAiMonitor: newStatus, canViewAiMonitor: newStatus }).then(() => {
                        const updated = { ...selectedUser, showAiMonitor: newStatus, canViewAiMonitor: newStatus };
                        setSelectedUser(updated);
                        setUsers(users.map(u => u.id === updated.id ? updated : u));
                        showToast(newStatus ? 'Włączono podgląd modeli AI i Live Monitor dla tego kursanta.' : 'Ukryto modele AI i wyłączono monitor dla tego kursanta.');
                      }).catch(err => alert('Błąd: ' + err.message));
                    }}
                  >
                    <Eye size={14} className="mr-1.5" />
                    {selectedUser.showAiMonitor || selectedUser.canViewAiMonitor ? i18n.t("Podgląd AI: Włączony") : i18n.t("Podgląd AI: Wyłączony")}
                  </Button>
                </div>

                {/* Account Actions Grid */}
                <div>
                  <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-2">
                    {i18n.t("Akcje i zabezpieczenia konta:")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="secondary" 
                      size="sm"
                      className="cursor-pointer text-xs"
                      onClick={() => {
                        setNewPasswordForUser('');
                        setChangePasswordError('');
                        setShowChangePasswordModal(true);
                      }}
                    >
                      <Key size={13} className="mr-1" />
                      {i18n.t("Zmień hasło")}
                    </Button>

                    {selectedUser?.tempPassword ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 cursor-pointer text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedUser.tempPassword || '');
                          showToast('Hasło początkowe zostało skopiowane do schowka.');
                        }}
                      >
                        <Copy size={13} className="mr-1" />
                        {i18n.t("Skopiuj hasło startowe")}
                      </Button>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-base-200/80 border border-line-strong text-content-muted text-xs font-medium">
                        🔒 {selectedUser?.isGoogleLinked || selectedUser?.authProvider === 'google' ? 'Konto połączone z Google' : 'Hasło własne kursanta (chronione)'}
                      </span>
                    )}

                    <Button 
                      variant="secondary" 
                      size="sm"
                      className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 cursor-pointer text-xs flex items-center gap-1"
                      onClick={() => setShowInviteModal(true)}
                    >
                      <Send size={13} />
                      {i18n.t("Wyślij zaproszenie do aplikacji")}
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      className="cursor-pointer text-xs"
                      onClick={() => {
                        setMessageTitle('Wiadomość od nauczyciela');
                        setMessageText('');
                        setShowMessageModal(true);
                      }}
                    >
                      <Send size={13} className="mr-1" />
                      {i18n.t("Wyślij wiadomość")}
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      className={`cursor-pointer text-xs ${selectedUser.onboardingCompleted ? "bg-primary/15 text-primary border-primary/30" : "bg-base-100/60 text-content-muted"}`}
                      onClick={() => {
                        const newStatus = !selectedUser.onboardingCompleted;
                        const userRef = doc(db, 'users', selectedUser.id);
                        updateDoc(userRef, { onboardingCompleted: newStatus }).then(() => {
                          const updated = { ...selectedUser, onboardingCompleted: newStatus };
                          setSelectedUser(updated);
                          setUsers(users.map(u => u.id === updated.id ? updated : u));
                          showToast(newStatus ? 'Onboarding oznaczony jako ukończony.' : 'Onboarding zresetowany.');
                        }).catch(err => alert('Błąd: ' + err.message));
                      }}
                    >
                      {selectedUser.onboardingCompleted ? (
                        <>
                          <CheckSquare size={13} className="mr-1" />
                          {i18n.t("Onboarding: Ukończony")}
                        </>
                      ) : (
                        <>
                          <Square size={13} className="mr-1" />
                          {i18n.t("Onboarding: Do zrobienia")}
                        </>
                      )}
                    </Button>

                    <Button 
                      variant="secondary" 
                      size="sm"
                      className={`cursor-pointer text-xs ${selectedUser.isSuspended ? "bg-primary/20 text-primary hover:bg-primary/30 border-transparent" : "bg-warn/20 text-warn hover:bg-warn/30 border-transparent"}`}
                      onClick={() => {
                        const newSuspended = !selectedUser.isSuspended;
                        const userRef = doc(db, 'users', selectedUser.id);
                        updateDoc(userRef, { isSuspended: newSuspended }).then(() => {
                          const updated = { ...selectedUser, isSuspended: newSuspended };
                          setSelectedUser(updated);
                          setUsers(users.map(u => u.id === updated.id ? updated : u));
                          showToast(newSuspended ? 'Konto zostało zawieszone.' : 'Konto zostało odwieszone.');
                        }).catch(err => alert('Błąd: ' + err.message));
                      }}
                    >
                      <Lock size={13} className="mr-1" />
                      {selectedUser.isSuspended ? i18n.t("Odwieś konto") : i18n.t("Zawieś konto")}
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      className={`cursor-pointer text-xs ${selectedUser.isArchived ? "bg-primary/20 text-primary hover:bg-primary/30 border-transparent" : "bg-base-100/60 text-content hover:bg-base-100 border-line-strong"}`}
                      onClick={() => {
                        const archived = !selectedUser.isArchived;
                        const userRef = doc(db, 'users', selectedUser.id);
                        updateDoc(userRef, {
                          isArchived: archived,
                          archivedAt: archived ? new Date().toISOString() : null,
                        }).then(() => {
                          const updated = { ...selectedUser, isArchived: archived };
                          setSelectedUser(updated);
                          setUsers(users.map(u => u.id === updated.id ? updated : u));
                          showToast(archived ? 'Przeniesiono do archiwum.' : 'Przywrócono z archiwum.');
                        }).catch(err => alert('Błąd: ' + err.message));
                      }}
                    >
                      <Archive size={13} className="mr-1" />
                      {selectedUser.isArchived ? i18n.t("Przywróć z archiwum") : i18n.t("Przenieś do archiwum")}
                    </Button>

                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="bg-danger/20 text-danger hover:bg-danger/30 border-danger/30 cursor-pointer text-xs"
                      onClick={async () => {
                        if (await confirmAsync('Czy na pewno chcesz usunąć to konto? Tej operacji nie można cofnąć.')) {
                          handleDeleteUser(selectedUser.id);
                        }
                      }}
                    >
                      <Trash2 size={13} className="mr-1" />
                      {i18n.t("Skasuj konto")}
                    </Button>
                  </div>
                </div>
              </div>
              )}

                </div>
              </div>

              {/* Drugi przycisk zapisu USUNIĘTY. Był kopią tego z nagłówka,
                  postawioną na końcu ściany pięciu kart — a że karty są teraz
                  pokazywane po jednej, do przycisku w nagłówku jest zawsze
                  blisko. Dwa przyciski robiące to samo na jednym ekranie każą
                  zastanawiać się, czym się różnią. */}
              </StudentPanelSection>
            </div>
          )}
        </div>
      </div>
    )}

      {showSpecialTaskModal && selectedUser && (
        <TeacherSpecialTaskModal
          user={selectedUser}
          initialLesson={specialTaskInitialLesson || undefined}
          initialWords={specialTaskInitialWords.length > 0 ? specialTaskInitialWords : undefined}
          initialTopic={specialTaskInitialTopic || undefined}
          onClose={() => {
            setShowSpecialTaskModal(false);
            setSpecialTaskInitialLesson(null);
            setSpecialTaskInitialWords([]);
            setSpecialTaskInitialTopic('');
          }}
          onTaskCreated={() => {
            fetchUserLogsAndStats(selectedUser.id);
            setSpecialTaskInitialLesson(null);
            setSpecialTaskInitialWords([]);
            setSpecialTaskInitialTopic('');
          }}
        />
      )}

      {/* Assign Set Modal */}
      <AssignVocabularyModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        targetUser={selectedUser}
        onSetAssigned={() => {
          if (selectedUser) {
            fetchUserLogsAndStats(selectedUser.id);
          }
        }}
      />

      {/* Delete User Modal */}
      {userToDelete && (
        <div ref={deleteModalAnim.overlayRef} className="fixed inset-0 bg-ink/72 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div ref={deleteModalAnim.contentRef} className="w-full max-w-md">
            <Card className="w-full shadow-2xl border-primary/20">
            <h3 className="text-xl font-bold mb-4">{i18n.t("Confirm Deletion")}</h3>
            <p className="mb-6 opacity-80">
              
                                            {i18n.t("Are you sure you want to delete this user document? This action cannot be undone.")}
                                          </p>
            <div className="flex justify-end gap-3">
              <Button onClick={() => setUserToDelete(null)} variant="secondary">
                
                                                  {i18n.t("Cancel")}
                                                </Button>
              <Button 
                onClick={() => {
                  handleDeleteUser(userToDelete);
                  setUserToDelete(null);
                }} 
                variant="danger"
              >
                
                                                  {i18n.t("Delete Account")}
                                                </Button>
            </div>
          </Card>
          </div>
        </div>
      )}

      {/* Google Drive Files Modal */}
      {showDriveModal && (
        <div ref={driveModalAnim.overlayRef} className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 md:p-6 overflow-y-auto">
          <div ref={driveModalAnim.contentRef} className="w-full max-w-2xl my-auto">
            <div className="bg-base-100 p-6 rounded-xl border border-line-strong shadow-2xl relative">
            <h3 className="text-xl font-bold mb-4">{i18n.t("Wybierz plik z Google Drive")}</h3>
            
            {driveError && (
              <div className="bg-danger/10 border border-danger/50 text-danger p-4 rounded-lg mb-4 text-sm">
                {driveError}
              </div>
            )}
            {driveLoading ? (

              <div className="text-center p-8 text-content-muted">{i18n.t("Ładowanie plików...")}</div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {driveFiles.map(file => (
                  <div key={file.id} onClick={() => processDriveFile(file)} className="p-3 bg-base-200/50 hover:bg-base-200 rounded-lg cursor-pointer flex justify-between items-center border border-line transition-colors">
                    <span className="font-medium text-sm text-text-hi truncate max-w-[80%]">{file.name}</span>
                    <span className="text-xs text-content-muted">{file.mimeType.includes('pdf') ? 'PDF' : 'DOC'}</span>
                  </div>
                ))}
                {driveFiles.length === 0 && <div className="text-center text-content-muted">{i18n.t("Brak odpowiednich plików.")}</div>}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <Button variant="ghost" onClick={() => setShowDriveModal(false)}>{i18n.t("Anuluj")}</Button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* AI Lesson Summary Modal */}
      {showAIModal && (
        <div ref={aiModalAnim.overlayRef} className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 md:p-6 overflow-y-auto">
          <div ref={aiModalAnim.contentRef} className="w-full max-w-4xl my-auto">
            <div className="bg-base-100 p-6 rounded-xl border border-line-strong shadow-2xl relative">
            <h3 className="text-2xl font-bold mb-1 flex items-center gap-2">
               <span className="text-primary">✨</span>  {i18n.t("AI Lesson Summary")}
            </h3>
            <p className="text-sm text-content-muted mb-4">
              {aiSourceKind === 'transcript'
                ? i18n.t("Wklej zapis rozmowy albo wczytaj plik z transkrypcją. AI wyłuska z niej słownictwo, poprawki, wymowę i ustalenia, ułoży pracę domową i wypełni wszystkie bloki lekcji — te same, które kursant widzi w swojej historii.")
                : i18n.t("Wklej treść notatek ze spotkania (plain text lub markdown), a AI wygeneruje na ich podstawie pełny wpis z lekcji, wypełniając automatycznie datę, temat i wszystkie inne pola formularza.")}
            </p>

            {/* RODZAJ MATERIAŁU — decyduje o poleceniu dla modelu.

                Gotowe notatki ze spotkania trzeba PRZEPISAĆ do pól; surową
                transkrypcję trzeba dopiero PRZECZESAĆ i ułożyć. To dwa różne
                zadania i dostają dwa różne polecenia systemowe. Dopóki
                przełącznika nie było, transkrypcja dostawała polecenie
                napisane pod gotowe notatki — model szukał w niej sekcji,
                których w rozmowie nie ma, i oddawał trzy zdania streszczenia
                przy pustej reszcie pól. */}
            <div className="mb-4">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5">
                Co wklejasz
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  {
                    id: 'notes' as const,
                    title: 'Notatki ze spotkania',
                    desc: 'Gotowe podsumowanie — AI przepisze je do pól lekcji',
                  },
                  {
                    id: 'transcript' as const,
                    title: 'Transkrypcja lekcji',
                    desc: 'Surowy zapis rozmowy — AI wyłuska i ułoży bloki',
                  },
                ]).map(option => {
                  const isActive = aiSourceKind === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setAiSourceKind(option.id)}
                      className={`text-left px-3.5 py-2.5 rounded-xl border transition-colors cursor-pointer ${
                        isActive
                          ? 'border-primary/60 bg-primary/12'
                          : 'border-line-strong bg-base-200/50 hover:border-primary/35'
                      }`}
                    >
                      <span className={`block text-sm font-bold ${isActive ? 'text-primary' : 'text-text-hi'}`}>
                        {option.title}
                      </span>
                      <span className="block text-[11px] text-content-muted mt-0.5">{option.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex-1 min-w-[9rem] relative">
                <input
                  type="file"
                  accept=".txt,.md,.vtt,.srt,text/plain,text/markdown"
                  onChange={(e) => handleTranscriptFileUpload(e, 'single')}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Button variant="secondary" className="w-full pointer-events-none">
                  {i18n.t("Wczytaj transkrypcję (.txt, .vtt, .srt)")}
                </Button>
              </div>
              <Button onClick={() => fetchDriveFiles('single')} variant="secondary" className="flex-1 min-w-[9rem] flex justify-center items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                
                                                  {i18n.t("Google Drive")}
                                                </Button>
              <div className="flex-1 relative">
                <input type="file" accept=".pdf" onChange={(e) => handlePdfUpload(e, 'single')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <Button variant="secondary" className="w-full pointer-events-none">{i18n.t("Załaduj plik PDF")}</Button>
              </div>
            </div>
            {summaryError && (
              <div className="bg-danger/10 border border-danger/20 text-danger p-4 rounded-lg mb-4 text-sm font-medium">
                {summaryError}
              </div>
            )}
            <textarea
              value={rawMeetingNotes}
              onChange={e => setRawMeetingNotes(e.target.value)}
              className="w-full bg-base-200 border border-line-strong rounded-lg p-4 text-text-hi h-[50vh] mb-4 font-mono text-sm leading-relaxed"
              placeholder={aiSourceKind === 'transcript'
                ? i18n.t("Wklej tutaj surowy zapis rozmowy z lekcji...")
                : i18n.t("Wklej tutaj gotowe notatki ze spotkania...")}
            />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowAIModal(false)}>{i18n.t("Anuluj")}</Button>
              <Button onClick={handleGenerateFromNotes} isLoading={isGenerating} disabled={!rawMeetingNotes.trim()}>
                {aiSourceKind === 'transcript'
                  ? i18n.t("Ułóż lekcję z transkrypcji")
                  : i18n.t("Generuj wpis z lekcji")}
              </Button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div ref={bulkModalAnim.overlayRef} className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 md:p-6 overflow-y-auto">
          <div ref={bulkModalAnim.contentRef} className="w-full max-w-4xl my-auto">
            <div className="bg-base-100 p-6 rounded-xl border border-line-strong shadow-2xl relative">
            <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
               <span className="text-primary">📦</span> {i18n.t("Bulk Import (Wiele lekcji)")}
            </h3>
            <p className="text-base text-content-muted mb-4">
               {i18n.t("Wklej treść historii lekcji z dokumentu lub załącz plik, aby AI (GPT-4o mini) podzieliło go na osobne wpisy i przypisało do kursantów.")}
            </p>

            {selectedUser && (
              <div className="bg-primary/10 border border-primary/20 text-primary p-3 rounded-lg mb-4 text-xs font-semibold flex items-center gap-2">
                <span>👤</span>
                <span>
                  {i18n.t("Importujesz historię lekcji bezpośrednio w zakładce kursanta:")}{" "}
                  <strong className="underline underline-offset-2">{`${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.username}</strong>
                  {i18n.t(". Lekcje zostaną automatycznie przypisane do niego.")}
                </span>
              </div>
            )}
            
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex-1 min-w-[9rem] relative">
                <input
                  type="file"
                  accept=".txt,.md,.vtt,.srt,text/plain,text/markdown"
                  onChange={(e) => handleTranscriptFileUpload(e, 'bulk')}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Button variant="secondary" className="w-full pointer-events-none">
                  {i18n.t("Wczytaj plik tekstowy")}
                </Button>
              </div>
              <Button onClick={() => fetchDriveFiles('bulk')} variant="secondary" className="flex-1 min-w-[9rem] flex justify-center items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                {i18n.t("Google Drive")}
              </Button>
              <div className="flex-1 relative">
                <input type="file" accept=".pdf" onChange={(e) => handlePdfUpload(e, 'bulk')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <Button variant="secondary" className="w-full pointer-events-none">{i18n.t("Załaduj plik PDF")}</Button>
              </div>
            </div>
            {bulkSummaryError && (
              <div className="bg-danger/10 border border-danger/20 text-danger p-4 rounded-lg mb-4 text-sm font-medium">
                {bulkSummaryError}
              </div>
            )}
            <textarea
              value={bulkNotes}
              onChange={e => setBulkNotes(e.target.value)}
              className="w-full bg-base-200 border border-line-strong rounded-lg p-4 text-text-hi h-[45vh] mb-4 font-mono text-sm leading-relaxed"
              placeholder={i18n.t("Wklej tutaj historię lekcji z Google Docs / plain text...")}
            />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowBulkModal(false)}>{i18n.t("Anuluj")}</Button>
              <Button onClick={() => {
                if (!bulkNotes.trim()) return;
                generateBulkSummary({ notes: bulkNotes });
              }} isLoading={isGenerating} disabled={!bulkNotes.trim()}>
                {i18n.t("Generuj wpisy (GPT-4o mini)")}
              </Button>
            </div>
          </div>
        </div>
          </div>
      )}

      
      {/* Bulk Preview Modal */}
      {showBulkPreviewModal && (
        <div ref={bulkPreviewModalAnim.overlayRef} className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 md:p-6 overflow-y-auto">
          <div ref={bulkPreviewModalAnim.contentRef} className="w-full max-w-4xl my-auto">
            <div className="bg-base-100 p-6 rounded-xl border border-line-strong shadow-2xl relative">
            <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
               <span className="text-primary">✨</span> {i18n.t("Podgląd zaimportowanych lekcji")}
            </h3>
            <p className="text-sm text-content-muted mb-4">
               {i18n.t("Przejrzyj lub zmodyfikuj wyodrębnione daty i tematy. Możesz kliknąć kartę, aby edytować notatki, słówka i przypisać kursantów.")}
            </p>

            {selectedUser && (
              <div className="bg-primary/10 border border-primary/20 text-primary p-2.5 rounded-lg mb-4 text-xs font-semibold flex items-center gap-2">
                <span>👤</span>
                <span>
                  {i18n.t("Lekcje zostaną domyślnie dodane do konta:")}{" "}
                  <strong>{`${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.username}</strong>
                </span>
              </div>
            )}
            
            <div className="space-y-4 max-h-[55vh] overflow-y-auto mb-6 pr-2">
              {bulkPreviewLessons.map((lesson, idx) => {
                const isExpanded = expandedBulkIndex === idx;
                return (
                  <Card key={idx} className="bg-base-200/60 border border-line-strong p-0 overflow-hidden">
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex flex-col md:flex-row items-start md:items-center gap-3 w-full">
                        <div className="flex items-center gap-2 shrink-0">
                          <label className="text-xs text-content-muted font-bold">{i18n.t("Data:")}</label>
                          <input
                            type="date"
                            value={lesson.date || ''}
                            onChange={(e) => {
                              const newLessons = [...bulkPreviewLessons];
                              newLessons[idx] = { ...newLessons[idx], date: e.target.value };
                              setBulkPreviewLessons(newLessons);
                            }}
                            className="font-mono text-xs bg-base-300 text-primary border border-primary/40 rounded px-2 py-1 font-semibold focus:outline-none focus:border-primary"
                          />
                        </div>
                        <div className="flex-1 w-full flex items-center gap-2">
                          <label className="text-xs text-content-muted font-bold shrink-0">{i18n.t("Temat:")}</label>
                          <input
                            type="text"
                            value={lesson.lessonTopic || ''}
                            onChange={(e) => {
                              const newLessons = [...bulkPreviewLessons];
                              newLessons[idx] = { ...newLessons[idx], lessonTopic: e.target.value };
                              setBulkPreviewLessons(newLessons);
                            }}
                            placeholder={i18n.t("Temat lekcji z dokumentu...")}
                            className="font-bold text-sm bg-base-300 text-text-hi border border-line-strong rounded px-2.5 py-1 flex-1 focus:outline-none focus:border-primary"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedBulkIndex(isExpanded ? null : idx)}
                          className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold shrink-0 self-end md:self-center"
                        >
                          <span>{isExpanded ? i18n.t("Zwiń szczegóły") : i18n.t("Edytuj / Rozwiń")}</span>
                          <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      <div className="text-xs text-content-muted flex items-center gap-2 flex-wrap pt-1 border-t border-line">
                        <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        <span className="font-semibold text-content-muted">{i18n.t("Przypisani kursanci")}:</span>
                        {users.map(u => {
                          const currentIds = lesson.studentIds && lesson.studentIds.length > 0
                            ? lesson.studentIds
                            : (lesson.studentId ? [lesson.studentId] : []);
                          const isAssigned = currentIds.includes(u.id);
                          const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                const updatedIds = isAssigned
                                  ? currentIds.filter((id: string) => id !== u.id)
                                  : [...currentIds, u.id];
                                const updatedLessons = [...bulkPreviewLessons];
                                updatedLessons[idx] = {
                                  ...updatedLessons[idx],
                                  studentId: updatedIds[0] || '',
                                  studentIds: updatedIds
                                };
                                setBulkPreviewLessons(updatedLessons);
                              }}
                              className={`text-xs px-2 py-0.5 rounded-full border transition-all flex items-center gap-1 ${
                                isAssigned 
                                  ? 'bg-primary/20 border-primary/50 text-primary font-semibold' 
                                  : 'bg-base-300/40 border-line-strong text-content-muted/60 hover:text-text-hi hover:bg-line-soft'
                              }`}
                            >
                              <span>{isAssigned ? '✓' : '+'}</span>
                              <span>{fullName}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 pt-2 border-t border-line-strong bg-base-200/80 text-sm space-y-3">
                        <div>
                          <div className="font-bold text-content-muted mb-1 text-xs uppercase">{i18n.t("Notatki z lekcji")}</div>
                          <textarea
                            value={lesson.revisionNotes || ''}
                            onChange={(e) => {
                              const newLessons = [...bulkPreviewLessons];
                              newLessons[idx] = { ...newLessons[idx], revisionNotes: e.target.value };
                              setBulkPreviewLessons(newLessons);
                            }}
                            className="w-full bg-base-300 border border-line-strong rounded p-2 text-text-hi text-xs min-h-[70px] leading-relaxed"
                          />
                        </div>
                        <div>
                          <div className="font-bold text-content-muted mb-1 text-xs uppercase">{i18n.t("Wyodrębnione Słówka (angielski - polski)")}</div>
                          <textarea
                            value={lesson.vocabularyText || ''}
                            onChange={(e) => {
                              const newLessons = [...bulkPreviewLessons];
                              newLessons[idx] = { ...newLessons[idx], vocabularyText: e.target.value };
                              setBulkPreviewLessons(newLessons);
                            }}
                            className="w-full bg-base-300 border border-line-strong rounded p-2 text-text-hi font-mono text-xs min-h-[70px] leading-relaxed"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <div className="font-bold text-content-muted mb-1 text-xs uppercase">{i18n.t("Wypowiedzi kursanta")}</div>
                            <textarea
                              value={lesson.studentSpeaking || ''}
                              onChange={(e) => {
                                const newLessons = [...bulkPreviewLessons];
                                newLessons[idx] = { ...newLessons[idx], studentSpeaking: e.target.value };
                                setBulkPreviewLessons(newLessons);
                              }}
                              className="w-full bg-base-300 border border-line-strong rounded p-2 text-text-hi text-xs min-h-[50px]"
                            />
                          </div>
                          <div>
                            <div className="font-bold text-content-muted mb-1 text-xs uppercase">{i18n.t("Do poprawy / Błędy")}</div>
                            <textarea
                              value={lesson.thingsToImprove || ''}
                              onChange={(e) => {
                                const newLessons = [...bulkPreviewLessons];
                                newLessons[idx] = { ...newLessons[idx], thingsToImprove: e.target.value };
                                setBulkPreviewLessons(newLessons);
                              }}
                              className="w-full bg-base-300 border border-line-strong rounded p-2 text-text-hi text-xs min-h-[50px]"
                            />
                          </div>
                        </div>
                        <div>
                          <div className="font-bold text-content-muted mb-1 text-xs uppercase">{i18n.t("Zadanie domowe / Sugestie")}</div>
                          <textarea
                            value={lesson.suggestedFollowUp || ''}
                            onChange={(e) => {
                              const newLessons = [...bulkPreviewLessons];
                              newLessons[idx] = { ...newLessons[idx], suggestedFollowUp: e.target.value };
                              setBulkPreviewLessons(newLessons);
                            }}
                            className="w-full bg-base-300 border border-line-strong rounded p-2 text-text-hi text-xs min-h-[50px]"
                          />
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowBulkPreviewModal(false)}>{i18n.t("Anuluj")}</Button>
              <Button onClick={handleSaveBulkLessons} isLoading={isGenerating}>
                {i18n.t("Zapisz wszystkie (")}{bulkPreviewLessons.length})
              </Button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Add/Edit Lesson Record Modal */}
      {showLessonRecordModal && (
        <div ref={lessonRecordModalAnim.overlayRef} className="fixed inset-0 bg-ink/72 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto">
          <div ref={lessonRecordModalAnim.contentRef} className="w-full max-w-3xl my-auto">
            {lessonRecordModalMode === 'edit' ? (
              <Card className="w-full shadow-2xl border-primary/20">
                <h3 className="text-xl font-bold mb-4">{editingRecordId ? 'Edytuj lekcję' : 'Dodaj nową lekcję'}</h3>
                
                {/* Tab Selector */}
                {!editingRecordId && (
                  <div className="flex gap-2 mb-6 p-1 bg-base-300 rounded-lg w-fit">
                    <button
                      type="button"
                      onClick={() => setActiveLessonFormTab('manual')}
                      className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                        activeLessonFormTab === 'manual'
                          ? 'bg-primary text-accent-ink shadow-md'
                          : 'text-content-muted hover:text-text-hi'
                      }`}
                    >
                      Ręczny wpis
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveLessonFormTab('database')}
                      className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                        activeLessonFormTab === 'database'
                          ? 'bg-primary text-accent-ink shadow-md'
                          : 'text-content-muted hover:text-text-hi'
                      }`}
                    >
                      Baza gotowych lekcji innych kursantów
                    </button>
                  </div>
                )}

                {activeLessonFormTab === 'manual' ? (
                  <>
                    <div className="space-y-4 mb-6">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-bold text-content-muted">
                            {i18n.t("Kursant / Kursanci (zajęcia indywidualne lub grupowe)")}
                          </label>
                          <div className="flex gap-2">
                            <button 
                              type="button" 
                              onClick={() => {
                                const allIds = users.map(u => u.id);
                                setLessonFormStudentIds(allIds);
                                if (allIds.length > 0) setLessonFormStudentId(allIds[0]);
                              }}
                              className="text-xs text-primary hover:underline font-medium"
                            >
                              {i18n.t("Zaznacz wszystkich")}
                            </button>
                            <span className="text-text-hi/20">|</span>
                            <button 
                              type="button" 
                              onClick={() => {
                                setLessonFormStudentIds([]);
                                setLessonFormStudentId('');
                              }}
                              className="text-xs text-content-muted hover:text-text-hi hover:underline font-medium"
                            >
                              {i18n.t("Wyczyść")}
                            </button>
                          </div>
                        </div>

                        <div className="bg-base-200/90 border border-primary/20 rounded-xl p-3 max-h-[160px] overflow-y-auto space-y-1.5 custom-scrollbar mb-2">
                          {users.length === 0 ? (
                            <div className="text-xs text-content-muted p-2">{i18n.t("Brak dostępnych kursantów")}</div>
                          ) : (
                            users.map(u => {
                              const isSelected = lessonFormStudentIds.includes(u.id);
                              const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
                              return (
                                <label 
                                  key={u.id}
                                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                                    isSelected 
                                      ? 'bg-primary/20 border border-primary/40 text-primary font-medium' 
                                      : 'hover:bg-line-soft border border-transparent text-content-muted'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 text-sm">
                                    <input 
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        let newIds: string[];
                                        if (isSelected) {
                                          newIds = lessonFormStudentIds.filter(id => id !== u.id);
                                        } else {
                                          newIds = [...lessonFormStudentIds, u.id];
                                        }
                                        setLessonFormStudentIds(newIds);
                                        setLessonFormStudentId(newIds[0] || '');
                                      }}
                                      className="checkbox checkbox-primary checkbox-xs rounded"
                                    />
                                    <span>{fullName}</span>
                                  </div>
                                  {u.level && (
                                    <span
                                      title={u.level}
                                      className="text-xs px-2 py-0.5 rounded-full bg-base-300 text-content-muted font-mono max-w-[7rem] truncate shrink-0"
                                    >
                                      {u.level}
                                    </span>
                                  )}
                                </label>
                              );
                            })
                          )}
                        </div>

                        {lessonFormStudentIds.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary font-bold">
                              {lessonFormStudentIds.length === 1 
                                ? i18n.t("1 kursant (lekcja indywidualna)") 
                                : `${lessonFormStudentIds.length} ${i18n.t("kursantów (zajęcia grupowe)")}`
                              }
                            </span>
                            <span className="text-xs text-content-muted truncate max-w-full">
                              {users
                                .filter(u => lessonFormStudentIds.includes(u.id))
                                .map(u => `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username)
                                .join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Data")}</label>
                          <input 
                            type="date" 
                            value={lessonFormDate} 
                            onChange={e => setLessonFormDate(e.target.value)}
                            className="w-full bg-base-200 border border-line-strong rounded-lg p-2 text-text-hi font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Temat")}</label>
                          <input 
                            type="text" 
                            value={lessonFormTopic} 
                            onChange={e => setLessonFormTopic(e.target.value)}
                            className="w-full bg-base-200 border border-line-strong rounded-lg p-2 text-text-hi"
                            placeholder={i18n.t("Np. Present Perfect vs Past Simple")}
                          />
                        </div>
                      </div>

                      {/* Opcja powiązania ze scenariuszem lekcji schowana na później zgodnie z dyspozycją */}
                      <div>
                        <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Revision Notes")}</label>
                        <textarea 
                          value={lessonFormSummary} 
                          onChange={e => setLessonFormSummary(e.target.value)}
                          className="w-full bg-base-200 border border-line-strong rounded-lg p-2 text-text-hi min-h-[120px] resize-y"
                          placeholder={i18n.t("Zapis z lekcji...")}
                          rows={5}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Kursant — o czym mówił")}</label>
                        <textarea 
                          value={lessonFormStudentSpeaking} 
                          onChange={e => setLessonFormStudentSpeaking(e.target.value)}
                          className="w-full bg-base-200 border border-line-strong rounded-lg p-2 text-text-hi min-h-[120px] resize-y"
                          rows={5}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Słownictwo & Wymowa (Vocabulary & Pronunciation)")}</label>
                        <textarea 
                          value={lessonFormWords} 
                          onChange={e => setLessonFormWords(e.target.value)}
                          className="w-full bg-base-200 border border-line-strong rounded-lg p-2 text-text-hi font-mono text-sm min-h-[120px] resize-y"
                          placeholder={i18n.t("apple - jabłko&#10;banana - banan")}
                          rows={5}
                        />
                        <VocabularyApproval
                          vocabularyText={lessonFormWords}
                          excludedItems={lessonFormExcludedItems}
                          onChange={setLessonFormExcludedItems}
                        />
                      </div>
                      <div>
                        <RecallItemsReview
                          lessonTopic={lessonFormTopic}
                          vocabularyText={lessonFormWords}
                          lessonNotes={lessonFormSummary}
                          thingsToImprove={lessonFormThingsToImprove}
                          candidates={lessonFormRecallCandidates}
                          onChange={setLessonFormRecallCandidates}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Things to Improve")}</label>
                        <textarea 
                          value={lessonFormThingsToImprove} 
                          onChange={e => setLessonFormThingsToImprove(e.target.value)}
                          className="w-full bg-base-200 border border-line-strong rounded-lg p-2 text-text-hi min-h-[120px] resize-y"
                          rows={5}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Praca domowa (Blok 3 — Homework)")}</label>
                        <textarea
                          value={lessonFormHomework}
                          onChange={e => setLessonFormHomework(e.target.value)}
                          className="w-full bg-base-200 border border-line-strong rounded-lg p-2 text-text-hi min-h-[120px] resize-y"
                          placeholder={i18n.t("Zdania do przetłumaczenia, ćwiczenia, zadanie na kolejny tydzień...")}
                          rows={5}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Klucz odpowiedzi (Answer Key)")}</label>
                        <textarea
                          value={lessonFormAnswerKey}
                          onChange={e => setLessonFormAnswerKey(e.target.value)}
                          className="w-full bg-base-200 border border-line-strong rounded-lg p-2 text-text-hi min-h-[90px] resize-y"
                          placeholder={i18n.t("Odpowiedzi do zadania wyżej — kursant widzi je dopiero po oddaniu pracy.")}
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Na kolejnej lekcji (Blok 4 — Next Lesson)")}</label>
                        <textarea 
                          value={lessonFormSuggestedFollowUp} 
                          onChange={e => setLessonFormSuggestedFollowUp(e.target.value)}
                          className="w-full bg-base-200 border border-line-strong rounded-lg p-2 text-text-hi min-h-[120px] resize-y"
                          rows={5}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setShowLessonRecordModal(false)}>{i18n.t("Anuluj")}</Button>
                      <Button onClick={handleSaveLessonRecord} isLoading={isSavingLessonRecord}>{i18n.t("Zapisz lekcję")}</Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <input
                        type="text"
                        value={lessonsDbSearch}
                        onChange={e => setLessonsDbSearch(e.target.value)}
                        className="w-full bg-base-200 border border-line-strong rounded-lg p-2.5 pl-10 text-text-hi text-sm"
                        placeholder="Szukaj lekcji po temacie, słownictwie lub kursancie..."
                      />
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-3 text-content-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>

                    {selectedDbLessonKeys.length > 0 && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl bg-primary/10 border border-primary/30 gap-3">
                        <span className="text-sm font-bold text-primary">
                          Zaznaczono: {selectedDbLessonKeys.length} {selectedDbLessonKeys.length === 1 ? 'lekcję' : selectedDbLessonKeys.length < 5 ? 'lekcje' : 'lekcji'} do scalenia
                        </span>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-content-muted hover:text-text-hi flex-1 sm:flex-none"
                            onClick={() => setSelectedDbLessonKeys([])}
                          >
                            Wyczyść
                          </Button>
                          <Button
                            size="sm"
                            className="bg-primary hover:bg-primary/80 text-accent-ink font-extrabold flex-1 sm:flex-none"
                            onClick={async () => {
                              const selectedItems = allLessonsDatabase.filter(item => {
                                const compositeKey = `${item.studentId}-${item.record.id}`;
                                return selectedDbLessonKeys.includes(compositeKey);
                              });
                              
                              if (selectedItems.length > 0) {
                                const targetStudentIds = lessonFormStudentIds.length > 0 
                                  ? lessonFormStudentIds 
                                  : (lessonFormStudentId ? [lessonFormStudentId] : (selectedUser ? [selectedUser.id] : []));

                                if (targetStudentIds.length === 0) {
                                  alert("Wybierz przynajmniej jednego kursanta w sekcji 'Kursant / Kursanci' w zakładce 'Ręczny wpis'.");
                                  return;
                                }

                                if (!(await confirmAsync(`Czy chcesz bezpośrednio zaimportować ${selectedItems.length} lekcji jako osobne wpisy dla wybranych kursantów? Każda lekcja zachowa swoją oryginalną datę.`))) {
                                  return;
                                }

                                setIsLoadingLessonsDb(true);
                                try {
                                  const sortedItems = [...selectedItems].sort((a, b) => new Date(a.record.date).getTime() - new Date(b.record.date).getTime());

                                  for (const item of sortedItems) {
                                    for (const sId of targetStudentIds) {
                                      const { lessonRecordId } = await createLessonRecordWithVocabularySet({
                                        studentId: sId,
                                        date: item.record.date,
                                        topic: item.record.topic || 'Bez tematu',
                                        vocabularyText: item.record.vocabularyText || '',
                                        lessonSummary: item.record.lessonSummary || '',
                                        studentSpeaking: item.record.studentSpeaking || '',
                                        thingsToImprove: item.record.thingsToImprove || '',
                                        suggestedFollowUp: item.record.suggestedFollowUp || ''
                                      });

                                      if (item.record.vocabularyText && item.record.vocabularyText.trim().length > 0) {
                                        await syncFlashcardSetForLesson(
                                          lessonRecordId,
                                          sId,
                                          item.record.date,
                                          item.record.topic || 'Bez tematu',
                                          item.record.vocabularyText
                                        );
                                      }
                                      
                                      await updateDoc(doc(db, 'users', sId), {
                                        hasNewLesson: true,
                                        hasNewVocabulary: true
                                      });
                                    }
                                  }

                                  showToast(`Pomyślnie zaimportowano ${selectedItems.length} osobnych lekcji dla wybranych kursantów!`);
                                  
                                  if (selectedUser?.id && targetStudentIds.includes(selectedUser.id)) {
                                    fetchUserLogsAndStats(selectedUser.id);
                                  }
                                  
                                  setShowLessonRecordModal(false);
                                  setSelectedDbLessonKeys([]);
                                } catch (err: any) {
                                  alert("Błąd podczas importowania lekcji: " + err.message);
                                } finally {
                                  setIsLoadingLessonsDb(false);
                                }
                              }
                            }}
                          >
                            Importuj zaznaczone ({selectedDbLessonKeys.length})
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    <div className="max-h-[400px] overflow-y-auto space-y-3 custom-scrollbar pr-2">
                      {isLoadingLessonsDb ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-content-muted">
                          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                          <p className="text-sm font-medium">Ładowanie bazy lekcji...</p>
                        </div>
                      ) : (
                        (() => {
                          const queryClean = lessonsDbSearch.toLowerCase().trim();
                          const filtered = allLessonsDatabase.filter(item => {
                            if (!queryClean) return true;
                            const topic = (item.record.topic || '').toLowerCase();
                            const words = (item.record.vocabularyText || '').toLowerCase();
                            const summary = (item.record.lessonSummary || '').toLowerCase();
                            const sName = item.studentName.toLowerCase();
                            return topic.includes(queryClean) || words.includes(queryClean) || summary.includes(queryClean) || sName.includes(queryClean);
                          });

                          if (filtered.length === 0) {
                            return (
                              <div className="text-center py-12 text-content-muted">
                                Brak lekcji spełniających kryteria wyszukiwania.
                              </div>
                            );
                          }

                          return filtered.map((item, idx) => {
                            const wordCount = countVocabularyItems(item.record.vocabularyText);
                            const compositeKey = `${item.studentId}-${item.record.id}`;
                            const isChecked = selectedDbLessonKeys.includes(compositeKey);
                            return (
                              <div 
                                key={`${item.record.id}-${idx}`}
                                className={`p-4 rounded-xl border transition-all flex items-start gap-4 ${
                                  isChecked 
                                    ? 'border-primary bg-primary/10 shadow-lg' 
                                    : 'border-line bg-base-200/50 hover:bg-base-200 hover:border-primary/30'
                                }`}
                              >
                                <div className="pt-1.5 flex items-center h-full">
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      if (isChecked) {
                                        setSelectedDbLessonKeys(prev => prev.filter(k => k !== compositeKey));
                                      } else {
                                        setSelectedDbLessonKeys(prev => [...prev, compositeKey]);
                                      }
                                    }}
                                    className="checkbox checkbox-primary checkbox-sm rounded cursor-pointer"
                                  />
                                </div>
                                <div 
                                  className="flex-1 min-w-0 space-y-1 cursor-pointer select-none"
                                  onClick={() => {
                                    if (isChecked) {
                                      setSelectedDbLessonKeys(prev => prev.filter(k => k !== compositeKey));
                                    } else {
                                      setSelectedDbLessonKeys(prev => [...prev, compositeKey]);
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-base-300 text-content-muted font-mono">{item.record.date}</span>
                                    <span className="text-xs text-primary font-bold">Kursant: {item.studentName}</span>
                                  </div>
                                  <h4 className="font-bold text-base text-text-hi truncate">{getDisplayLessonTopic(item.record)}</h4>
                                  {item.record.lessonSummary && (
                                    <p className="text-xs text-content-muted line-clamp-2 italic">
                                      {item.record.lessonSummary}
                                    </p>
                                  )}
                                  {item.record.vocabularyText && (
                                    <div className="flex items-center gap-1 text-xs text-primary font-medium">
                                      <span>Słówka ({wordCount}):</span>
                                      <span className="truncate max-w-[300px] text-content-muted font-mono">{item.record.vocabularyText.replace(/\n/g, ' | ')}</span>
                                    </div>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-primary font-extrabold flex-shrink-0 border border-primary/20 hover:bg-primary hover:text-accent-ink self-center"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLessonFormTopic(item.record.topic || '');
                                    setLessonFormWords(item.record.vocabularyText || '');
                                    setLessonFormSummary(item.record.lessonSummary || '');
                                    setLessonFormStudentSpeaking(item.record.studentSpeaking || '');
                                    setLessonFormThingsToImprove(item.record.thingsToImprove || '');
                                    setLessonFormSuggestedFollowUp(item.record.suggestedFollowUp || '');
                                    setActiveLessonFormTab('manual');
                                    showToast("Dane lekcji zostały zaimportowane! Możesz je teraz sprawdzić i zapisać.");
                                  }}
                                >
                                  Wybierz pojedynczą
                                </Button>
                              </div>
                            );
                          });
                        })()
                      )}
                    </div>
                    
                    <div className="flex justify-end pt-2 border-t border-line">
                      <Button variant="ghost" onClick={() => setShowLessonRecordModal(false)}>{i18n.t("Anuluj")}</Button>
                    </div>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="w-full shadow-2xl border-line-strong bg-base-100 p-0 overflow-hidden">
                <div className="p-6 border-b border-line flex justify-between items-center bg-base-200/50">
                  <div>
                    <h3 className="text-2xl font-bold font-display">{viewingRecord?.topic}</h3>
                    <div className="font-mono text-sm text-primary mt-1">{viewingRecord?.date}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => openLessonRecordModal('edit', viewingRecord!)}>
                      {i18n.t("Edytuj")}
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="text-danger hover:opacity-80 hover:bg-danger/10"
                      onClick={() => handleDeleteLessonRecord(viewingRecord!)}
                    >
                      {i18n.t("Usuń")}
                    </Button>
                    <button onClick={() => setShowLessonRecordModal(false)} className="p-2 hover:bg-line-soft rounded-lg transition-colors cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-content-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                  {/* Cascading Lesson Details view */}
                  {viewingRecord && (
                    <CascadingLessonDetails
                      record={viewingRecord}
                      studentName={selectedUser ? `${selectedUser.firstName || ''} ${selectedUser.lastName || selectedUser.username}`.trim() : undefined}
                      studentLevel={selectedUser?.level}
                      onLinkScenario={handleLinkScenarioToRecord}
                      onGenerateHomework={() => handleGenerateHomeworkFromLesson(viewingRecord)}
                      onEdit={() => openLessonRecordModal('edit', viewingRecord)}
                      onDelete={() => handleDeleteLessonRecord(viewingRecord)}
                      onClose={() => setShowLessonRecordModal(false)}
                      onUpdateRecord={handleUpdateViewingRecord}
                      onConfirmLesson={() => handleConfirmLessonDirectly(viewingRecord)}
                      onRejectLesson={() => handleRejectNotionLesson(viewingRecord)}
                    />
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}


      {/* Send Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-ink/72 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <Card className="w-full shadow-2xl border-primary/20">
              <h3 className="text-xl font-bold mb-4">Wyślij wiadomość do {selectedUser?.firstName || selectedUser?.username}</h3>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-content-muted mb-1">Tytuł wiadomości</label>
                  <input
                    type="text"
                    value={messageTitle}
                    onChange={(e) => setMessageTitle(e.target.value)}
                    className="w-full bg-base-300 border border-line-strong rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-content-muted mb-1">Treść wiadomości</label>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    rows={4}
                    className="w-full bg-base-300 border border-line-strong rounded-xl px-4 py-3 focus:outline-none focus:border-primary resize-none"
                    placeholder="Wpisz treść wiadomości..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowMessageModal(false)}>Anuluj</Button>
                <Button onClick={handleSendMessage} isLoading={isSendingMessage} disabled={!messageText.trim()}>Wyślij</Button>
              </div>
            </Card>
          </div>
        </div>
      )}
{/* Change Password Modal */}
      {showChangePasswordModal && (
        <div ref={changePasswordModalAnim.overlayRef} className="fixed inset-0 bg-ink/72 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div ref={changePasswordModalAnim.contentRef} className="w-full max-w-md">
            <Card className="w-full shadow-2xl border-primary/20">
            <h3 className="text-xl font-bold mb-4">{i18n.t("Zmień hasło dla")} {selectedUser?.firstName || selectedUser?.username}</h3>
            <div className="space-y-4 mb-6">
              {changePasswordError && (
                <div className="p-3 bg-danger/10 border border-danger/20 text-danger rounded-lg text-sm">
                  {changePasswordError}
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-content-muted">{i18n.t("Nowe hasło")}</label>
                  <button 
                    onClick={() => {
                      const toughPass = generateStrongPassword();
                      setNewPasswordForUser(toughPass);
                    }}
                    className="text-xs text-primary hover:text-primary/80 font-bold flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 hover:bg-primary/20 transition-all"
                  >
                    
                                                              {i18n.t("✨ Generuj silne hasło")}
                                                            </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={newPasswordForUser}
                    onChange={(e) => setNewPasswordForUser(e.target.value)}
                    className="w-full bg-base-200/40 backdrop-blur-md border border-line-strong rounded-lg p-2.5 outline-none focus:border-primary/50 transition-colors pr-10 font-mono text-center tracking-wider text-lg"
                    placeholder={i18n.t("Wpisz lub wygeneruj hasło")}
                  />
                  {newPasswordForUser && (
                    <button
                      onClick={async () => {
                        try {
                           await navigator.clipboard.writeText(newPasswordForUser);
                           setChangePasswordError('');
                        } catch (e) {
                           setChangePasswordError('Nie udało się skopiować hasła.');
                        }
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-primary transition-colors"
                      title={i18n.t("Skopiuj do schowka")}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button onClick={() => { setShowChangePasswordModal(false); setChangePasswordError(''); setNewPasswordForUser(''); }} variant="secondary">
                
                                                  {i18n.t("Anuluj")}
                                                </Button>
              <Button 
                onClick={handleChangePassword} 
                isLoading={isChangingPassword}
                disabled={!newPasswordForUser || newPasswordForUser.length < 6}
              >
                
                                                  {i18n.t("Zmień hasło")}
                                                </Button>
            </div>
          </Card>
          </div>
        </div>
      )}

      {/* Create Student Modal */}
      {showCreateStudentModal && (
        <div ref={createStudentModalAnim.overlayRef} className="fixed inset-0 bg-ink/72 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div ref={createStudentModalAnim.contentRef} className="w-full max-w-md">
            <Card className="w-full shadow-2xl border-primary/20">
            <h3 className="text-xl font-bold mb-4">{i18n.t("Create New Student")}</h3>
            
            {!newStudentPassword ? (
              <div className="space-y-4 mb-6">
                {createStudentError && (
                  <div className="p-3 bg-danger/10 border border-danger/20 text-danger rounded-lg text-sm">
                    {createStudentError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Student Username / Name")}</label>
                  <input
                    type="text"
                    value={newStudentUsername}
                    onChange={(e) => setNewStudentUsername(e.target.value)}
                    className="w-full bg-base-200/40 backdrop-blur-md border border-line-strong rounded-lg p-3 focus:border-primary focus:outline-none"
                    placeholder={i18n.t("e.g. John Doe")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Adres e-mail (opcjonalny)")}</label>
                  <input
                    type="email"
                    value={newStudentEmail}
                    onChange={(e) => setNewStudentEmail(e.target.value)}
                    className="w-full bg-base-200/40 backdrop-blur-md border border-line-strong rounded-lg p-3 focus:border-primary focus:outline-none text-sm font-mono"
                    placeholder={i18n.t("np. uczen@gmail.com")}
                  />
                  <p className="text-xs text-content-muted mt-1">
                    {i18n.t("Podaj adres e-mail do wysyłki powiadomień Resend. Jeśli pozostawisz puste, konto otrzyma login @student.vocabboost.com.")}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-content-muted mb-2">{i18n.t("Password Option")}</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="passwordMode" 
                        checked={isAutoGeneratePassword} 
                        onChange={() => setIsAutoGeneratePassword(true)} 
                        className="accent-primary"
                      />
                      <span>{i18n.t("Auto-generate")}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="passwordMode" 
                        checked={!isAutoGeneratePassword} 
                        onChange={() => setIsAutoGeneratePassword(false)}
                        className="accent-primary"
                      />
                      <span>{i18n.t("Set custom")}</span>
                    </label>
                  </div>
                </div>
                
                {!isAutoGeneratePassword && (
                  <div>
                    <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Custom Password")}</label>
                    <input
                      type="text"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full bg-base-200/40 backdrop-blur-md border border-line-strong rounded-lg p-3 focus:border-primary focus:outline-none"
                      placeholder={i18n.t("Minimum 6 characters")}
                      minLength={6}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg text-center space-y-2 relative">
                  <div className="text-primary font-bold mb-2">{i18n.t("Student Created Successfully!")}</div>
                  <div className="text-sm text-content-muted">{i18n.t("Email (Login):")}</div>
                  <div className="font-mono text-lg font-bold">{createdStudentEmail || normalizeUsername(newStudentUsername)}</div>
                  <div className="text-sm text-content-muted mt-2">{i18n.t("Password:")}</div>
                  <div className="font-mono text-lg font-bold tracking-widest bg-base-100 p-2 rounded inline-flex items-center gap-2 border border-base-300">
                    {newStudentPassword}
                    <button 
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(newStudentPassword);
                        } catch(e) {}
                      }}
                      className="text-xs text-primary hover:underline px-2 py-1 rounded bg-primary/10 ml-2"
                    >
                      {i18n.t("Copy")}
                    </button>
                  </div>
                  <p className="text-xs text-warn mt-2">{i18n.t("Please copy these credentials and share them securely with the student. This password will not be shown again.")}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              {!newStudentPassword ? (
                <>
                  <Button onClick={() => { setShowCreateStudentModal(false); setCreateStudentError(''); setNewStudentEmail(''); setCreatedStudentEmail(''); }} variant="secondary">{i18n.t("Cancel")}</Button>
                  <Button onClick={handleCreateStudent} isLoading={isCreatingStudent} disabled={!newStudentUsername}>{i18n.t("Create Account")}</Button>
                </>
              ) : (
                <Button onClick={() => { setShowCreateStudentModal(false); setNewStudentPassword(''); setNewStudentUsername(''); setNewStudentEmail(''); setCreatedStudentEmail(''); }}>{i18n.t("Close")}</Button>
              )}
            </div>
          </Card>
        </div>
        </div>
      )}


      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-6 left-1/2 z-[100] px-6 py-3 rounded-xl bg-base-300 border border-line-strong shadow-2xl flex items-center gap-3"
          >
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-text-hi font-bold">{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Save Status Graphical Pop-up Modal */}
      <AnimatePresence>
        {profileSaveModal && profileSaveModal.isOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-base-100 border border-line-strong rounded-2xl p-6 shadow-2xl text-center space-y-4 overflow-hidden"
            >
              {/* Background ambient glow */}
              <div
                className={`absolute -top-16 -left-16 w-36 h-36 rounded-full blur-3xl pointer-events-none ${
                  profileSaveModal.success ? 'bg-primary/30' : 'bg-danger/30'
                }`}
              />

              <div className="flex justify-center pt-2">
                {profileSaveModal.success ? (
                  <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-[0_0_25px_rgba(114, 240, 180,0.35)]">
                    <CheckCircle2 size={36} />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-danger/20 border border-danger/30 flex items-center justify-center text-danger shadow-[0_0_25px_rgba(240, 114, 111,0.35)]">
                    <AlertCircle size={36} />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-extrabold text-text-hi">
                  {profileSaveModal.title}
                </h3>
                <p className="text-sm text-content-muted leading-relaxed">
                  {profileSaveModal.message}
                </p>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => setProfileSaveModal(null)}
                  variant={profileSaveModal.success ? 'primary' : 'secondary'}
                  className="w-full"
                >
                  {profileSaveModal.success ? i18n.t('Gotowe') : i18n.t('Zamknij')}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Printable Container for PDF Export */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '800px' }}>
        <div ref={pdfExportContainerRef} style={{ backgroundColor: '#ffffff', color: '#0f172a', padding: '36px', fontFamily: 'Arial, sans-serif' }}>
          {/* Document Header */}
          <div style={{ borderBottom: '3px solid #059669', paddingBottom: '16px', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#047857', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Raport Historii Lekcji i Postępów
            </h1>
            <div style={{ marginTop: '12px', fontSize: '14px', lineHeight: '1.6', color: '#334155' }}>
              <div><strong>Imię i nazwisko kursanta:</strong> {selectedUser?.displayName || selectedUser?.name || `${selectedUser?.firstName || ''} ${selectedUser?.lastName || ''}`.trim() || selectedUser?.email || 'Kursant'}</div>
              <div><strong>Email:</strong> {selectedUser?.email || '-'}</div>
              {selectedUser?.level && <div><strong>Poziom językowy:</strong> {selectedUser.level}</div>}
              <div><strong>Data wygenerowania raportu:</strong> {new Date().toLocaleDateString('pl-PL')}</div>
            </div>
          </div>

          {/* Section 1: Wykaz Lekcji */}
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>
              Historia Lekcji ({lessonRecords.length})
            </h2>

            {lessonRecords.length === 0 ? (
              <p style={{ fontStyle: 'italic', color: '#64748b' }}>Brak wpisów lekcyjnych dla tego kursanta.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {lessonRecords.slice().sort((a, b) => new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime()).map((rec, idx) => (
                  <div key={rec.id || idx} style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', backgroundColor: '#f8fafc', pageBreakInside: 'avoid' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#047857' }}>
                        Lekcja #{idx + 1}: {rec.topic}
                      </span>
                      <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#64748b', fontWeight: 'bold' }}>
                        {rec.date ? new Date(rec.date).toLocaleDateString('pl-PL') : ''}
                      </span>
                    </div>

                    {rec.vocabularyText && (
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Słownictwo i frazy:</div>
                        <div style={{ fontSize: '13px', color: '#1e293b', whiteSpace: 'pre-wrap', backgroundColor: '#ffffff', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0', marginTop: '4px' }}>
                          {rec.vocabularyText}
                        </div>
                      </div>
                    )}

                    {rec.lessonSummary && (
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Podsumowanie lekcji:</div>
                        <div style={{ fontSize: '13px', color: '#1e293b', whiteSpace: 'pre-wrap', marginTop: '2px' }}>
                          {rec.lessonSummary}
                        </div>
                      </div>
                    )}

                    {rec.studentSpeaking && (
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase' }}>O czym mówił kursant:</div>
                        <div style={{ fontSize: '13px', color: '#1e293b', whiteSpace: 'pre-wrap', marginTop: '2px' }}>
                          {rec.studentSpeaking}
                        </div>
                      </div>
                    )}

                    {rec.thingsToImprove && (
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#dc2626', textTransform: 'uppercase' }}>Zagadnienia do poprawy (błędy):</div>
                        <div style={{ fontSize: '13px', color: '#991b1b', backgroundColor: '#fef2f2', padding: '8px', borderRadius: '4px', border: '1px solid #fecaca', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                          {rec.thingsToImprove}
                        </div>
                      </div>
                    )}

                    {rec.suggestedFollowUp && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#d97706', textTransform: 'uppercase' }}>Zadanie domowe / Sugestie:</div>
                        <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '2px', whiteSpace: 'pre-wrap' }}>
                          {rec.suggestedFollowUp}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Historia Ćwiczeń i Zdań z Aplikacji */}
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>
              Historia Ćwiczeń Aplikacyjnych i Zdań z AI ({practiceLogs.length})
            </h2>

            {practiceLogs.length === 0 ? (
              <p style={{ fontStyle: 'italic', color: '#64748b' }}>Brak zarejestrowanych sesji ćwiczeniowych w aplikacji.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {practiceLogs.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((log, idx) => (
                  <div key={log.id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', backgroundColor: '#ffffff', pageBreakInside: 'avoid' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#047857' }}>
                        Sesja #{idx + 1}: {log.exerciseType === 'ai_translation' ? 'Trening Zdań z AI (Prawdziwe Wyzwanie)' : log.exerciseType === 'flashcards' ? 'Fiszki' : log.exerciseType} {log.exerciseFormat ? `(${log.exerciseFormat})` : ''}
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>
                        {new Date(log.date).toLocaleString('pl-PL')}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#334155', marginBottom: '8px' }}>
                      {log.setDisplayName && <div><strong>Zestaw:</strong> {log.setDisplayName}</div>}
                      {log.score !== undefined && <div><strong>Wynik:</strong> {Number.isNaN(Number(log.score)) ? 0 : log.score}%</div>}
                      {log.wordsUsed && log.wordsUsed.length > 0 && <div><strong>Wykorzystane słówka:</strong> {log.wordsUsed.join(', ')}</div>}
                    </div>

                    {Array.isArray(log.sentences) && log.sentences.length > 0 ? (
                      <div style={{ marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Wygenerowane zdania i odpowiedzi ucznia:</div>
                        {log.sentences.map((s: any, sIdx: number) => (
                          <div key={sIdx} style={{ fontSize: '12px', marginBottom: '6px', backgroundColor: '#f8fafc', padding: '6px 8px', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
                            <div style={{ color: '#0f172a', fontWeight: 'bold' }}>{sIdx + 1}. PL: {s.polishTranslation || s.polish_translation}</div>
                            <div style={{ color: '#047857' }}>EN (Poprawne): {s.englishSentence || s.english_sentence}</div>
                            {s.studentAnswer && <div style={{ color: '#2563eb' }}>Odpowiedź ucznia: "{s.studentAnswer}"</div>}
                            {s.feedback && <div style={{ color: '#d97706', fontSize: '11px', marginTop: '2px' }}>Komentarz AI / Poprawki: {s.feedback}</div>}
                          </div>
                        ))}
                      </div>
                    ) : typeof log.exercisesData === 'string' && log.exercisesData ? (
                      <div style={{ fontSize: '12px', color: '#475569', backgroundColor: '#f8fafc', padding: '6px 8px', borderRadius: '4px', marginTop: '6px' }}>
                        {log.exercisesData}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ScratchpadStudentPicker
        isOpen={isNotebookPickerOpen}
        onClose={() => setIsNotebookPickerOpen(false)}
        students={users}
        title="Wybierz notatnik kursanta"
        subtitle="Otwórz dedykowany notatnik z historii lekcji lub rozpocznij pusty szkic."
        onPick={(picked) => {
          openScratchpadTab(picked.id ? `sp_${picked.id}` : undefined, picked.name);
          setIsNotebookPickerOpen(false);
        }}
        secondaryAction={{
          label: '📝 Otwórz notatnik roboczy (bez kursanta / tryb testowy)',
          onClick: () => {
            openScratchpadTab();
            setIsNotebookPickerOpen(false);
          },
        }}
      />

      {/* Pop-up Modal dla Wyboru Kursanta */}
      {isStudentPickerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-base-200 border border-line-strong rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-line-strong flex items-center justify-between bg-base-100/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-primary/20 text-primary border border-primary/30">
                  <Users size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-text-hi">Wybierz kursanta</h2>
                  <p className="text-xs text-content-muted mt-0.5">
                    Znajdź ucznia, aby wyświetlić jego kafelki (Profil, Statystyki, Historia, Testy, Słownictwo)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsStudentPickerOpen(false)}
                className="p-2 text-content-muted hover:text-text-hi rounded-xl hover:bg-line-soft transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filter Controls */}
            <div className="p-4 bg-base-100/30 border-b border-line space-y-3">
              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted" />
                <input
                  type="text"
                  placeholder="Szukaj po imieniu, nazwisku, emailu lub loginie..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-base-100 border border-line-strong rounded-xl text-sm text-text-hi placeholder-content-muted focus:border-primary focus:outline-none"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-content-muted hover:text-text-hi p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-base-100 border border-line-strong rounded-xl px-3 py-2 text-xs text-text-hi focus:border-primary outline-none cursor-pointer"
                >
                  <option value="all">🌐 Wszystkie role</option>
                  <option value="user">👤 Kursanci (Uczniowie)</option>
                  <option value="teacher">👨‍🏫 Nauczyciele</option>
                  <option value="admin">🔑 Administratorzy</option>
                </select>

                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="bg-base-100 border border-line-strong rounded-xl px-3 py-2 text-xs text-text-hi focus:border-primary outline-none cursor-pointer"
                >
                  <option value="all">🎯 Wszystkie poziomy</option>
                  <option value="A1">Poziom A1</option>
                  <option value="A2">Poziom A2</option>
                  <option value="B1">Poziom B1</option>
                  <option value="B2">Poziom B2</option>
                  <option value="C1">Poziom C1</option>
                  <option value="C2">Poziom C2</option>
                </select>
              </div>
            </div>

            {/* List of Students */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-content-muted">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="font-semibold text-sm">Nie znaleziono kursantów spełniających kryteria.</p>
                  <p className="text-xs mt-1">Zmień frazę w wyszukiwarce lub zresetuj filtry.</p>
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => {
                      handleSelectUser(u, targetTabAfterSelect || undefined);
                      setTargetTabAfterSelect(null);
                    }}
                    className="group bg-base-100/70 hover:bg-base-100 border border-line-strong hover:border-primary/50 p-3.5 px-4 rounded-2xl cursor-pointer flex items-center justify-between gap-3 transition-all duration-200 hover:shadow-[0_0_20px_rgba(114,240,180,0.15)]"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-bold text-primary text-base flex-shrink-0 border border-primary/30 overflow-hidden group-hover:scale-105 transition-transform">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          u.firstName ? u.firstName[0].toUpperCase() : u.username[0].toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-text-hi group-hover:text-primary transition-colors truncate">
                            {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username}
                          </span>
                          <span className="text-xs text-content-muted truncate">({u.username})</span>
                        </div>
                        <div className="text-xs text-content-muted truncate mt-0.5">
                          {u.email || 'Brak maila'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {u.level && (
                        <span
                          title={u.level}
                          className="px-2.5 py-1 bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-mono font-bold max-w-[7rem] truncate"
                        >
                          {u.level}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${
                        u.role === 'admin' ? 'bg-danger/12 text-danger border-danger/30' : u.role === 'teacher' ? 'bg-primary/12 text-primary border-primary/30' : 'bg-line-soft text-text-2 border-line-strong'
                      }`}>
                        {u.role === 'teacher' ? 'Nauczyciel' : u.role === 'admin' ? 'Admin' : 'Kursant'}
                      </span>
                      <ChevronRight size={18} className="text-content-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-line-strong bg-base-100/40 text-xs text-content-muted flex justify-between items-center">
              <span>Znaleziono: <strong className="text-text-hi">{filteredUsers.length}</strong> z {users.length} osób</span>
              {archivedCount > 0 && (
                <button
                  onClick={() => setShowArchived(v => !v)}
                  className="ml-3 text-xs font-bold text-content-muted hover:text-text-hi underline underline-offset-2"
                >
                  {showArchived ? 'Ukryj archiwum' : `Pokaż archiwum (${archivedCount})`}
                </button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setIsStudentPickerOpen(false)}>
                Zamknij
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Student App Invite Modal */}
      {showInviteModal && selectedUser && (
        <StudentInviteEmailModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          student={selectedUser}
          onInviteSent={(updates) => {
            if (updates) {
              const updated = { ...selectedUser, ...updates };
              setSelectedUser(updated);
              setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
            }
            showToast('Zaproszenie do aplikacji zostało wysłane!');
            fetchUsers();
          }}
        />
      )}

      {/* Notatnik z profilu kursanta otwiera się w OSOBNEJ KARCIE (przycisk
          „Otwórz Notatnik" w sekcji e-maila i dostępu). Warstwa nad panelem
          zniknęła razem z resztą wejść: jeden adres, jedna karta, jeden link
          do wysłania kursantowi. */}

      {showCleanLessonsModal && (

        <CleanLessonsModal
          isOpen={showCleanLessonsModal}
          onClose={() => setShowCleanLessonsModal(false)}
          selectedUser={selectedUser}
          lessonRecords={lessonRecords}
          onCleanComplete={(updated) => {
            setLessonRecords(updated);
            showToast('Pomyślnie zaktualizowano lekcje do formatu bloków Notion!');
          }}
        />
      )}

      <NotionImportPreviewModal
        isOpen={isNotionPreviewOpenForStudent}
        onClose={() => setIsNotionPreviewOpenForStudent(false)}
        studentName={selectedUser ? formatStudentDisplayName(selectedUser as User) : ''}
        items={notionPreviewItemsForStudent}
        isImporting={isImportingNotionForStudent}
        onConfirmImport={handleImportNotionForOpenStudent}
      />
    </div>
  );
};

export default AdminPanel;
