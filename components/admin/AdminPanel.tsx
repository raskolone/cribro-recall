import { 
  createLessonRecordWithVocabularySet, 
  syncFlashcardSetForLesson, 
  getLessonRecordsForStudent, 
  deleteLessonRecord,
  rejectNotionLesson,
  restoreRejectedNotionLesson,
  getRejectedNotionLessons,
  confirmPendingLesson
} from '../../services/lessonRecord';
import PreLessonContext from './PreLessonContext';
import VocabularyApproval from './VocabularyApproval';
import RecallItemsReview, { ReviewedCandidate } from './RecallItemsReview';
import { saveRecallReview } from '../../services/recallItems';
import { countVocabularyItems, buildVocabularySetTitle, splitVocabularyLines } from '../../utils/vocabulary';
import { isLessonPendingConfirmation, extractLessonBlocks } from '../../utils/lessonBlocks';
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
import AdminTestGenerator from './AdminTestGenerator';
import AllTestsTeacherView from './AllTestsTeacherView';
import PublicTestPanel from './PublicTestPanel';

import TeacherDashboardStats from './TeacherDashboardStats';
import TeacherSpecialTaskModal from './TeacherSpecialTaskModal';
import AssignVocabularyModal from './AssignVocabularyModal';
import HomeworkScreen from '../dashboard/HomeworkScreen';
import { isTaskForStudent } from '../../utils/homework';
import TeacherOverview from './TeacherOverview';
import LessonPlanner from './LessonPlanner';
import { LessonPresentationView } from './presentation/LessonPresentationView';
import { createPresentationFromScenario, savePresentationToStorage } from '../../services/presentationService';
import NotionSyncButton from './NotionSyncButton';
import StudentNotionSyncModal from './StudentNotionSyncModal';
import StudentInviteEmailModal from './StudentInviteEmailModal';
import CleanLessonsModal from './CleanLessonsModal';
import AdminMailingScreen from './AdminMailingScreen';
import ScratchpadModal from '../scratchpad/ScratchpadModal';
import ScratchpadStudentPicker from '../scratchpad/ScratchpadStudentPicker';
import TeacherAttentionBanner from './TeacherAttentionBanner';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Trash2, Download, Printer, FileText, CheckCircle2, AlertCircle,
  User as UserIcon, Users, Search, X, ChevronRight, ChevronDown, ChevronUp, Sparkles, BarChart2, Clock, 
  BookOpen, BookMarked, UserCheck, Filter, Award, Activity, Calendar, 
  RefreshCw, Plus, Eye, Shield, Target, CalendarClock, Layers, Link as LinkIcon, Airplay, Mail, Database, Wand2,
  AlertTriangle, Edit3, Save, Bell, BellOff, Lock, Copy, Key, Send, Archive, CheckSquare, Square, Edit2, FileEdit
} from 'lucide-react';

import i18n from "i18next";
import html2pdf from 'html2pdf.js';
import { useEscapeModal } from '../../hooks/useEscapeModal';

interface UserWithId extends User {
  id: string;
}

interface AdminPanelProps { initialTab?: string | null; onViewChange?: (view: any, extra?: any) => void; initialSelectedUserId?: string | null; onUserSelect?: (userId: string | null) => void; }

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

const AdminPanel: React.FC<AdminPanelProps> = ({ initialTab, onViewChange, initialSelectedUserId, onUserSelect }) => {
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
  const [profileSaveModal, setProfileSaveModal] = useState<{ isOpen: boolean; success: boolean; title: string; message: string } | null>(null);
  

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as UserWithId)
        .filter(u => u.username !== 'Demo User' && u.username !== 'Demo User (Offline)');
      usersList.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setUsers(usersList);
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
    const validStudentTabs = ['profile', 'context', 'history', 'homework', 'vocabulary', 'tests', 'stats'];
    const nextTab = targetTab || (activeTab && validStudentTabs.includes(activeTab) ? activeTab : 'profile');
    setActiveTab(nextTab);
    if (onUserSelect) onUserSelect(user.id);
    fetchUserLogsAndStats(user.id);
    setIsStudentPickerOpen(false);
    setTimeout(() => {
      tabContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const handleTileClick = (tabId: string) => {
    if (tabId === 'mailing') {
      setIsMailingModalOpen(true);
      return;
    }
    if (tabId === 'notatnik') {
      setShowScratchpadPicker(true);
      return;
    }
    // Moduły ogólne (niezwiązane z profilem) — przełączane bezpośrednio
    if (tabId === 'lesson-planner' || tabId === 'presentation') {
      setActiveTab(tabId);
      setTimeout(() => {
        tabContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
      return;
    }
    if (!selectedUser) {
      setTargetTabAfterSelect(tabId);
      setIsStudentPickerOpen(true);
    } else {
      setActiveTab(tabId);
      setTimeout(() => {
        tabContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
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
    if (data.thingsToImprove) setLessonFormThingsToImprove(data.thingsToImprove);
    if (data.suggestedFollowUp) setLessonFormSuggestedFollowUp(data.suggestedFollowUp);
    
    setLessonFormDate(new Date().toISOString().split('T')[0]);
    setShowAIModal(false);
    setRawMeetingNotes('');
    setLessonRecordModalMode('edit');
    setShowLessonRecordModal(true);
    setEditingRecordId(null);
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
            suggestedFollowUp: lesson.suggestedFollowUp || ''
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
    } catch (e: any) {
      alert('Błąd podczas zapisywania lekcji: ' + e.message);
    } finally {
      setIsSavingLessonRecord(false);
    }
  };

  const handleDeleteLessonRecord = async (record: LessonRecord) => {
    if (!selectedUser) return;
    if (!window.confirm(`Czy na pewno chcesz usunąć lekcję "${record.topic}" z dnia ${record.date}? Operacja jest nieodwracalna.`)) {
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

  const handleRejectNotionLesson = async (record: LessonRecord) => {
    if (!selectedUser) return;
    const confirmMsg = `Czy na pewno chcesz odrzucić lekcję „${record.topic}”?\n\nZostanie ona trwale usunięta z widoku i dodana do listy odrzuconych wpisów Notion, aby kolejne synchronizacje już jej nie importowały.`;
    if (!window.confirm(confirmMsg)) return;

    setIsRejectingLessonId(record.id);
    try {
      await rejectNotionLesson(selectedUser.id, record);
      setLessonRecords(prev => prev.filter(r => r.id !== record.id));
      setRejectedLessons(prev => [
        {
          id: record.notionPageId || record.id,
          studentId: selectedUser.id,
          topic: record.topic,
          date: record.date,
          rejectedAt: new Date().toISOString(),
          reason: 'Odrzucono przez nauczyciela (manualny przegląd)',
        },
        ...prev
      ]);
      if (viewingRecord?.id === record.id) {
        setShowLessonRecordModal(false);
        setViewingRecord(null);
      }
      showToast(`Odrzucono lekcję „${record.topic}”. Dodano do listy ignorowanych z Notion.`);
    } catch (err: any) {
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

  const handleConfirmLessonDirectly = async (record: LessonRecord, customDate?: string) => {
    if (!selectedUser) return;
    setIsConfirmingLessonId(record.id);
    try {
      let targetDate = customDate || record.date;
      if (!targetDate || /brak daty/i.test(targetDate)) {
        targetDate = new Date().toISOString().split('T')[0];
      }
      const cleanTopic = record.topic.replace(/^Podsumowanie lekcji\s*—\s*brak daty\s*—\s*/i, '').trim();

      await confirmPendingLesson(selectedUser.id, record.id, {
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

      setLessonRecords(prev => prev.map(r => r.id === record.id ? updatedRecord : r));
      if (viewingRecord?.id === record.id) {
        setViewingRecord(updatedRecord);
      }
      showToast(`Lekcja „${cleanTopic}” została zatwierdzona i jest widoczna dla kursanta!`);
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
      
      const userRecord = await createUser(email, password, 'user');
      
      const newUserDoc = {
        email,
        username: newStudentUsername,
        role: 'user',
        createdAt: new Date().toISOString(),
        loginCount: 0,
        streakCount: 0,
        requirePasswordChange: true,
        tempPassword: password
      };
      
      await setDoc(doc(db, 'users', userRecord.uid), newUserDoc);
      
      setNewStudentPassword(password);
      setCreatedStudentEmail(email);
      fetchUsers();
    } catch (e: any) {
      setCreateStudentError(e.message);
    } finally {
      setIsCreatingStudent(false);
    }
  };

const [users, setUsers] = useState<UserWithId[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserWithId | null>(null);

  useEffect(() => {
    if (users.length > 0) {
      if (initialSelectedUserId) {
        if (!selectedUser || selectedUser.id !== initialSelectedUserId) {
          const user = users.find(u => u.id === initialSelectedUserId);
          if (user) {
            setSelectedUser(user);
            fetchUserLogsAndStats(user.id);
          }
        }
      }
    }
  }, [users, initialSelectedUserId]);

  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([]);
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [rejectedLessons, setRejectedLessons] = useState<RejectedNotionItem[]>([]);
  const [showRejectedLessonsSection, setShowRejectedLessonsSection] = useState(false);
  const [isRejectingLessonId, setIsRejectingLessonId] = useState<string | null>(null);
  const [isConfirmingLessonId, setIsConfirmingLessonId] = useState<string | null>(null);
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

  /** Notatnik otwierany z kafelka/listwy — najpierw wybór kursanta, potem dokument. */
  const [showScratchpadPicker, setShowScratchpadPicker] = useState(false);
  const [scratchpadStudent, setScratchpadStudent] = useState<{ id: string; name: string } | null>(null);
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
  const [showScratchpadModal, setShowScratchpadModal] = useState(false);
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
  const [lessonFormScenarioId, setLessonFormScenarioId] = useState('');
  const [lessonFormScenarioTopic, setLessonFormScenarioTopic] = useState('');
  const [lessonFormScenarioContent, setLessonFormScenarioContent] = useState('');
  const [availableScenariosForForm, setAvailableScenariosForForm] = useState<GeneratedLessonScenario[]>([]);
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
  const [showStudentNotionSyncModal, setShowStudentNotionSyncModal] = useState(false);
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
  const [isSavingLessonRecord, setIsSavingLessonRecord] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [isStudentPickerOpen, setIsStudentPickerOpen] = useState(false);
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
      setLessonFormThingsToImprove(record.thingsToImprove || '');
      setLessonFormSuggestedFollowUp(record.suggestedFollowUp || '');
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
  const [activeTab, setActiveTab] = useState<string | null>(initialTab === 'mailing' ? null : (initialTab || null));
  const [isMailingModalOpen, setIsMailingModalOpen] = useState(initialTab === 'mailing');
  useEscapeModal(isMailingModalOpen, () => setIsMailingModalOpen(false));

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

  useEffect(() => {
    if (mainMenuRef.current && mainMenuRef.current.children.length > 0 && activeTab === null) {
      gsap.fromTo(gsap.utils.toArray(mainMenuRef.current.children),
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", stagger: 0.05, clearProps: "all" }
      );
    }
  }, [activeTab]);


  useEffect(() => {
    if (initialTab === 'mailing') {
      setIsMailingModalOpen(true);
      setActiveTab(null);
    } else {
      setActiveTab(initialTab || null);
    }
  }, [initialTab]);

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
  useEscapeModal(showStudentNotionSyncModal, () => setShowStudentNotionSyncModal(false));
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full pb-28 min-w-0">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 sm:pt-0 pl-7 sm:pl-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
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
              onClick={() => setShowScratchpadPicker(true)}
              className="px-3.5 min-h-11 bg-base-200/80 text-content border border-white/15 rounded-xl text-xs sm:text-sm font-bold hover:bg-white/[0.08] transition-colors flex items-center justify-center gap-2"
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

      {/* Sygnał "wymaga uwagi" — trwały nad treścią panelu, patrz
          docs/kolejka-przebudowa-panelu.md pkt 1 i docs/plan-weekend-2026-09-12.md Etap C. */}
      <TeacherAttentionBanner
        onOpenHomework={(filterStatus) => onViewChange?.('homework', { filterStatus })}
      />

      <ScratchpadStudentPicker
        isOpen={showScratchpadPicker}
        onClose={() => setShowScratchpadPicker(false)}
        students={activeUsers}
        onPick={student => {
          setScratchpadStudent(student);
          setShowScratchpadPicker(false);
        }}
      />

      <ScratchpadModal
        isOpen={!!scratchpadStudent}
        onClose={() => setScratchpadStudent(null)}
        student={{ id: scratchpadStudent?.id || null, name: scratchpadStudent?.name || 'Kursant' }}
      />

      {SHOW_LEGACY_PANEL_TOOLS && <TeacherOverview students={activeUsers} language={language} />}

      {/* GŁÓWNE KAFELKI LEKTORA — trzy najczęściej używane narzędzia.
          Kolejność i wybór wg docs/kolejka-przebudowa-panelu.md §2 i §5:
          Notatnik jako trzeci kafelek, bo jest używany na każdej lekcji
          (Planer, używany rzadziej, zostaje w listwie poniżej). */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-content-muted flex items-center gap-2">
            <span>Główne Narzędzia Lektora</span>
            <span className="text-[10px] font-mono bg-white/5 text-content-muted px-2 py-0.5 rounded-full border border-white/10">
              Tryb ogólny
            </span>
          </h2>
          {activeTab && ['lesson-planner', 'presentation'].includes(activeTab) && (
            <button
              onClick={() => setActiveTab(selectedUser ? 'profile' : null)}
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X size={13} /> Zamknij moduł ogólny
            </button>
          )}
        </div>

        <div ref={mainMenuRef} className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
          {[
            {
              id: 'profile',
              title: 'Profil kursantów',
              badge: 'Kursanci',
              // Rozstrzygnięcie z kolejki §5: to NIE to samo, co "Baza kursantów"
              // w sidebarze (tam jest zarządzanie kontami — dodawanie/edycja/usuwanie).
              desc: 'Wybierz kursanta, żeby zobaczyć jego historię lekcji, prace domowe i statystyki',
              icon: Users
            },
            {
              id: 'presentation',
              title: 'Prezentacja',
              badge: 'Live Lekcja',
              desc: 'Interaktywne slajdy z wymową audio na żywo z kursantem',
              icon: Airplay
            },
            {
              id: 'notatnik',
              title: 'Notatnik',
              badge: 'Na każdej lekcji',
              desc: 'Wspólny notatnik na żywo — treść widzi i edytuje kursant razem z Tobą',
              icon: FileEdit
            }
          ].map((tile) => {
            const IconComp = tile.icon;
            const isActive =
              tile.id === 'notatnik' ? !!scratchpadStudent : activeTab === tile.id;
            const hasNotification = Boolean((tile as any).hasNotification);
            const notificationCount = Number((tile as any).notificationCount || 0);

            return (
              <div
                key={tile.id}
                onClick={() => handleTileClick(tile.id)}
                className={`p-4.5 sm:p-5 cursor-pointer flex flex-col justify-between liquid-glass-tile select-none transition-all rounded-2xl relative overflow-hidden ${
                  hasNotification
                    ? 'border-amber-400/80 bg-gradient-to-br from-amber-500/[0.08] via-base-200/80 to-base-200 shadow-[0_0_30px_rgba(245,158,11,0.22)] ring-1 ring-amber-400/50 hover:border-amber-300'
                    : isActive
                      ? 'border-primary/80 shadow-[0_0_24px_rgba(114,240,180,0.25)] ring-1 ring-primary/40 bg-ink-2 z-10'
                      : 'hover:border-primary/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-xl transition-colors relative ${
                      hasNotification
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                        : isActive
                          ? 'bg-primary text-accent-ink shadow-[0_0_14px_rgba(114,240,180,0.4)]'
                          : 'bg-ink/72 text-primary border border-white/10 group-hover:border-primary/40'
                    }`}>
                      <IconComp size={20} />
                      {hasNotification && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border border-black/50"></span>
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md border font-mono ${
                      hasNotification
                        ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 animate-pulse font-extrabold shadow-sm'
                        : isActive
                          ? 'bg-primary/20 text-primary border-primary/40'
                          : 'bg-base-100/70 text-content-muted border-white/5'
                    }`}>
                      {hasNotification ? `${notificationCount} NOWYCH` : (isActive ? 'Aktywny moduł' : tile.badge)}
                    </span>
                  </div>
                  <h3 className={`font-extrabold text-base sm:text-lg transition-colors truncate ${
                    hasNotification ? 'text-amber-200 group-hover:text-amber-100' : 'text-white group-hover:text-primary'
                  }`}>
                    {tile.title}
                  </h3>
                  <p className="text-xs sm:text-[13px] text-content-muted mt-1 leading-relaxed line-clamp-2 min-h-[2.5rem]">
                    {tile.desc}
                  </p>
                </div>

                <div className="mt-4 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs font-semibold">
                  <span className={hasNotification ? 'text-amber-400 font-bold' : (isActive ? 'text-primary font-bold' : 'text-content-muted')}>
                    {hasNotification ? `Otwórz skrzynkę (${notificationCount})` : (isActive ? 'Przeglądasz ten moduł' : 'Otwórz moduł')}
                  </span>
                  <ChevronRight size={14} className={`transition-transform group-hover:translate-x-0.5 ${
                    hasNotification ? 'text-amber-400' : (isActive ? 'text-primary' : 'text-content-muted')
                  }`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* LISTWA NARZĘDZI — wszystkie narzędzia lektora w jednym miejscu, ok.
          połowę niższa niż kafelek (docs/kolejka-przebudowa-panelu.md §2).
          Prezentacja i Notatnik duplikują wejście z kafelków wyżej — to
          zamierzone: tu jest pełna lista, wyżej tylko trzy najważniejsze. */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'lesson-planner', title: 'Planer lekcji', icon: Sparkles },
          { id: 'presentation', title: 'Prezentacja', icon: Airplay },
          { id: 'notatnik', title: 'Notatnik', icon: FileEdit },
          {
            id: 'mailing',
            title: unreadMailingCount > 0 ? `Mailing (${unreadMailingCount})` : 'Mailing',
            icon: Mail,
            hasNotification: unreadMailingCount > 0,
          },
        ].map((item) => {
          const IconComp = item.icon;
          const isActive =
            item.id === 'notatnik'
              ? !!scratchpadStudent
              : activeTab === item.id || (item.id === 'mailing' && isMailingModalOpen);
          return (
            <button
              key={item.id}
              onClick={() => handleTileClick(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-colors ${
                item.hasNotification
                  ? 'border-amber-400/60 bg-amber-500/10 text-amber-200'
                  : isActive
                  ? 'border-primary/60 bg-primary/15 text-primary'
                  : 'border-line-strong bg-line-soft/40 text-content-muted hover:text-text-hi hover:border-primary/40'
              }`}
            >
              <IconComp size={15} />
              {item.title}
            </button>
          );
        })}
        <NotionSyncButton onImported={fetchUsers} />
      </div>

      {/* JEŚLI AKTYWNY JEST MODUŁ OGÓLNY (Planer, Prezentacja) */}
      {activeTab && ['lesson-planner', 'presentation'].includes(activeTab) && (
        <div className="p-4 sm:p-5 rounded-2xl bg-base-200/60 border border-primary/40 shadow-[0_0_30px_rgba(114,240,180,0.1)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                {activeTab === 'lesson-planner' && 'Planer lekcji AI (Tworzenie scenariuszy)'}
                {activeTab === 'presentation' && 'Prezentacja & Notatnik Live'}
              </h2>
            </div>
            <button
              onClick={() => setActiveTab(selectedUser ? 'profile' : null)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-text-hi text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-white/10"
            >
              <X size={14} />
              {selectedUser ? 'Wróć do profilu kursanta' : 'Zamknij moduł'}
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
              />
            )}
            {activeTab === 'lesson-planner' && (
              <LessonPlanner
                selectedUser={selectedUser}
                users={users}
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
                    const sName = selectedUser ? (selectedUser.firstName ? `${selectedUser.firstName} ${selectedUser.lastName || ''}`.trim() : selectedUser.username) : null;
                    const pres = createPresentationFromScenario(scenario, selectedUser?.id, sName);
                    await savePresentationToStorage(pres);
                    setActiveTab('presentation');
                    showToast('Scenariusz załadowany do Prezentacji & Notatnika Live!');
                  } catch (e) {
                    console.error('Błąd uruchamiania w prezentacji:', e);
                    showToast('Nie udało się załadować scenariusza do prezentacji.');
                  }
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* SEKCJA KURSANTA (ZAKŁADKI NA GÓRZE I DANE PROFILOWE) */}
      {!selectedUser ? (
        <div className="p-5 sm:p-6 rounded-2xl bg-base-200/50 border-2 border-line-strong flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-primary/12 text-primary border border-primary/30 shrink-0">
              <Users size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Profil i moduły kursanta
              </h3>
              <p className="text-xs text-content-muted mt-0.5">
                Wybierz ucznia z bazy, aby otworzyć jego profil, historię lekcji, zadania domowe, słownictwo, testy i statystyki.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsStudentPickerOpen(true)}
            className="px-5 min-h-11 bg-primary text-accent-ink font-bold rounded-xl text-xs sm:text-sm shadow-btn hover:brightness-110 hover:-translate-y-px active:translate-y-0 transition-all flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto cursor-pointer"
          >
            <Search size={18} />
            Wybierz kursanta z listy
          </button>
        </div>
      ) : (
        <div ref={profileContainerRef} className="space-y-4 pt-1">
          {/* STUDENT HERO CARD */}
          <div className="p-4 sm:p-5 rounded-2xl border-2 bg-gradient-to-r from-primary/15 via-base-200/80 to-base-200/90 border-primary/60 shadow-[0_0_30px_rgba(114,240,180,0.15)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/50 flex items-center justify-center font-bold text-primary text-xl flex-shrink-0 shadow-inner overflow-hidden">
                {selectedUser.photoURL ? (
                  <img src={selectedUser.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  selectedUser.firstName ? selectedUser.firstName[0].toUpperCase() : selectedUser.username[0].toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-extrabold text-white truncate">
                    {selectedUser.firstName || selectedUser.lastName ? `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() : selectedUser.username}
                  </h2>
                  <span className="text-xs text-content-muted font-mono truncate">(@{selectedUser.username})</span>
                  {selectedUser.level && (
                    <span
                      title={selectedUser.level}
                      className="px-2.5 py-0.5 bg-primary/20 text-primary border border-primary/40 rounded-lg text-xs font-mono font-bold max-w-[12rem] truncate"
                    >
                      Poziom: {selectedUser.level}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                    selectedUser.role === 'admin' ? 'bg-danger/12 text-danger border-danger/30' : selectedUser.role === 'teacher' ? 'bg-primary/12 text-primary border-primary/30' : 'bg-white/5 text-text-2 border-line-strong'
                  }`}>
                    {selectedUser.role === 'teacher' ? 'Nauczyciel' : selectedUser.role === 'admin' ? 'Admin' : 'Kursant'}
                  </span>
                  {selectedUser.isSuspended && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-warn/20 text-warn border border-warn/40">
                      Zawieszony
                    </span>
                  )}
                  {selectedUser.isArchived && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-base-100 text-content-muted border border-white/10">
                      Archiwum
                    </span>
                  )}
                </div>
                <div className="text-xs text-content-muted mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <button
                    onClick={() => {
                      setActiveTab('profile');
                      setTimeout(() => {
                        tabContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 150);
                    }}
                    className="hover:text-primary transition-colors inline-flex items-center gap-1 group text-left cursor-pointer"
                    title="Kliknij, aby edytować profil lub adres e-mail kursanta"
                  >
                    <span>📧 {selectedUser.email || 'Brak emaila'}</span>
                    {!selectedUser.email || selectedUser.email.includes('@student.vocabboost.com') ? (
                      <span className="text-warn text-[10px] font-semibold">(Adres zastępczy)</span>
                    ) : (
                      <span className="text-primary text-[10px] font-semibold">✓ Resend</span>
                    )}
                  </button>
                  <span>🔑 Logowań: <strong className="text-white">{selectedUser.loginCount || 0}</strong></span>
                  <span>🕒 Ostatnia wizyta: <strong className="text-white">{selectedUser.lastLoginDate ? new Date(selectedUser.lastLoginDate).toLocaleDateString('pl-PL') : 'Brak'}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end flex-wrap">
              <button
                onClick={() => setShowStudentNotionSyncModal(true)}
                className="px-3.5 py-2 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                title="Pobierz lub zaktualizuj lekcje kursanta z Notion"
              >
                <RefreshCw size={15} />
                <span>Pobierz z Notion</span>
              </button>
              <button
                onClick={() => setIsStudentPickerOpen(true)}
                className="px-3.5 py-2 bg-primary text-accent-ink rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-md cursor-pointer"
              >
                <UserCheck size={16} />
                Zmień kursanta
              </button>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setActiveTab(null);
                  if (onUserSelect) onUserSelect(null);
                  if (onViewChange) onViewChange('admin');
                  setPracticeLogs([]);
                  setLessonRecords([]);
                }}
                className="px-3 py-2 bg-ink/72 hover:bg-white/10 text-content-muted hover:text-text-hi border border-white/10 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <X size={16} />
                Wyczyść
              </button>
            </div>
          </div>

          {/* PASEK ZAKŁADEK NA SAMEJ GÓRZE PROFILU KURSANTA */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-base-200/90 border border-white/10 backdrop-blur-md overflow-x-auto no-scrollbar shadow-inner select-none">
            {[
              { id: 'profile', label: 'Profil & Dane', icon: UserIcon },
              { id: 'context', label: 'Kontekst', icon: CalendarClock },
              { id: 'history', label: 'Historia lekcji', icon: Clock, count: lessonRecords.length },
              { id: 'homework', label: 'Praca domowa', icon: BookOpen, count: specialTasks.length },
              { id: 'vocabulary', label: 'Słownictwo & AI', icon: BookMarked, count: userSets.length },
              { id: 'tests', label: 'Testy AI', icon: Award },
              { id: 'stats', label: 'Statystyki & Wyniki', icon: BarChart2 },
            ].map((tab) => {
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
                      ? 'bg-primary text-black font-extrabold shadow-md shadow-primary/20 border border-primary/50'
                      : 'text-content-muted hover:text-text-hi hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-black' : 'text-primary'} />
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold ${
                        isActive ? 'bg-black/20 text-black' : 'bg-white/10 text-primary'
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

          {activeTab === 'context' && selectedUser && (
            <PreLessonContext
              studentId={selectedUser.id}
              studentName={selectedUser.firstName || selectedUser.username}
              lessonRecords={lessonRecords}
              onOpenHistory={() => handleTileClick('history')}
            />
          )}

          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-base-200/50 p-6 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center">
                  <div className="text-sm text-content-muted mb-2 font-mono uppercase">{i18n.t("Ilość Logowań")}</div>
                  <div className="text-4xl font-display font-bold text-white">{selectedUser.loginCount || (selectedUser.lastLoginDate ? 1 : 0)}</div>
                </div>
                <div className="bg-base-200/50 p-6 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center">
                  <div className="text-sm text-content-muted mb-2 font-mono uppercase">{i18n.t("Ostatnie Logowanie")}</div>
                  <div className="text-lg font-display font-bold text-primary">
                    {selectedUser.lastLoginDate ? new Date(selectedUser.lastLoginDate).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Nigdy'}
                  </div>
                </div>
                <div className="bg-base-200/50 p-6 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center">
                  <div className="text-sm text-content-muted mb-2 font-mono uppercase">{i18n.t("Wykonane Zadania")}</div>
                  <div className="text-4xl font-display font-bold text-primary">{userStats?.totalTasks || 0}</div>
                </div>
                <div className="bg-base-200/50 p-6 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center">
                  <div className="text-sm text-content-muted mb-2 font-mono uppercase">{i18n.t("Przetłumaczone Zdania")}</div>
                  <div className="text-4xl font-display font-bold text-primary">{userStats?.totalSentences || 0}</div>
                </div>
              </div>

              {userStats && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <div className="bg-base-200/50 p-6 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center">
                    <div className="text-sm text-content-muted mb-2 font-mono uppercase">{i18n.t("Średni Wynik")}</div>
                    <div className="text-4xl font-display font-bold text-primary">{Number.isNaN(Number(userStats.averageScore)) ? 0 : userStats.averageScore}%</div>
                  </div>
                  <div className="bg-base-200/50 p-6 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center">
                    <div className="text-sm text-content-muted mb-2 font-mono uppercase">{i18n.t("Słownictwo Ogółem")}</div>
                    <div className="text-4xl font-display font-bold text-white">{userStats.totalWords}</div>
                  </div>
                  <div className="bg-base-200/50 p-6 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center">
                    <div className="text-sm text-content-muted mb-2 font-mono uppercase">{i18n.t("Trudne Słowa")}</div>
                    <div className="text-4xl font-display font-bold text-warn">{userStats.difficultWords}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-8">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-bold">{i18n.t("Historia lekcji")}</h3>
                    {lessonRecords.length > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-content-muted hover:text-text-hi transition-colors">
                        <input 
                          type="checkbox" 
                          className="toggle toggle-primary toggle-sm"
                          checked={groupByMonth}
                          onChange={(e) => setGroupByMonth(e.target.checked)}
                        />
                        <span>Grupuj wg miesięcy</span>
                      </label>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      size="sm" 
                      onClick={handleExportLessonsToPDF} 
                      disabled={isExportingPDF}
                      className="bg-primary hover:brightness-110 text-accent-ink flex items-center gap-1.5 shadow-sm font-bold"
                    >
                      <Download className="w-4 h-4" />
                      {isExportingPDF ? 'Generowanie PDF...' : 'Eksportuj do PDF'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      onClick={() => setShowStudentNotionSyncModal(true)}
                      className="flex items-center gap-1.5 text-white font-medium border-white/10 hover:border-primary/50"
                      title="Sprawdź bazę Notion i zsynchronizuj lekcje kursanta"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-primary" />
                      <span>{i18n.t("Synchronizuj z Notion")}</span>
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      onClick={() => setShowCleanLessonsModal(true)}
                      className="flex items-center gap-1.5 text-white font-medium border-white/10 hover:border-amber-400/50"
                      title="Uporządkuj dotychczas zaimportowane lekcje do czystego formatu bloków Notion"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>{i18n.t("Uporządkuj lekcje (Notion)")}</span>
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowAIModal(true)}>
                      {i18n.t("✨ AI Lesson Summary")}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowBulkModal(true)}>
                      {i18n.t("📦 Bulk Import (AI)")}
                    </Button>
                    <Button size="sm" onClick={() => openLessonRecordModal('edit')}>{i18n.t("Dodaj wpis")}</Button>
                  </div>
                </div>
                {(() => {
                  const pendingLessons = lessonRecords.filter(isLessonPendingConfirmation);
                  const confirmedLessons = lessonRecords.filter(r => !isLessonPendingConfirmation(r) && r.status !== 'rejected');

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
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                            <div className="flex items-center gap-2">
                              <Sparkles size={18} className="text-primary animate-pulse shrink-0" />
                              <h4 className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
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
                              <span className="text-xs px-3 py-1.5 rounded-xl bg-base-100/90 text-white font-mono border border-white/10 flex items-center gap-1.5 shadow-sm">
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

                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/25">
                                            {record.pendingReason || (record.isDateMissing ? 'Brak daty spotkania w Notion' : 'Format do weryfikacji')}
                                          </span>
                                        </div>

                                        <h5 className="font-bold text-sm text-white truncate">{record.topic}</h5>

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
                                            className="text-xs font-bold bg-gradient-to-r from-blue-600 to-primary text-white hover:brightness-110 flex items-center gap-1.5 shadow-sm"
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
                                      className="relative group cursor-pointer p-3 rounded-xl liquid-glass-hover bg-base-200/40 border border-white/5"
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
                                             <h4 className="font-bold text-base line-clamp-1">{record.topic}</h4>
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
                            
                            confirmedLessons.forEach(record => {
                                const d = new Date(record.date);
                                const diffTime = new Date().getTime() - d.getTime();
                                const diffDays = diffTime / (1000 * 3600 * 24);

                                let groupKey = '';
                                if (diffDays >= 0 && diffDays <= 7) {
                                    groupKey = 'Ostatni tydzień';
                                } else if (Number.isNaN(d.getTime())) {
                                    groupKey = 'Inne';
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
                                                    : 'bg-base-200/40 border-white/10 hover:bg-base-200 hover:border-white/20'
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
                                                    const globalIndex = confirmedLessons.findIndex(l => l.id === record.id);
                                                    const lessonNumber = confirmedLessons.length - globalIndex;

                                                    return (
                                                        <Card 
                                                          key={record.id}
                                                          className="relative group cursor-pointer p-3 rounded-xl liquid-glass-hover bg-base-200/40 border border-white/5"
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
                                                                 <h4 className="font-bold text-base line-clamp-1">{record.topic}</h4>
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
                        <div className="mt-6 border border-white/10 rounded-2xl bg-base-200/30 overflow-hidden text-xs">
                          <div
                            onClick={() => setShowRejectedLessonsSection(prev => !prev)}
                            className="p-3.5 bg-base-300/40 flex items-center justify-between cursor-pointer hover:bg-base-300/70 transition-colors select-none"
                          >
                            <div className="flex items-center gap-2 text-content-muted font-medium">
                              <span className="text-sm">🛡️</span>
                              <span className="font-bold text-white">Odrzucone tematy z Notion ({rejectedLessons.length})</span>
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
                            <div className="p-4 space-y-2 border-t border-white/5 bg-base-200/20">
                              <p className="text-[11px] text-content-muted mb-3 leading-relaxed">
                                Poniższe pozycje zostały odrzucone z Notion. Dzięki temu przy kolejnych synchronizacjach nie pojawią się ponownie w historii ani w podsumowaniach. Jeśli chcesz przywrócić dany temat, aby móc go ponownie zaimportować, kliknij „Przywróć”.
                              </p>
                              <div className="divide-y divide-white/5">
                                {rejectedLessons.map((rej) => (
                                  <div key={rej.id} className="py-2.5 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="font-bold text-white truncate text-xs">{rej.topic}</div>
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

              <div>
                <h3 className="text-lg font-bold mb-4">{i18n.t("Historia ćwiczeń (App)")}</h3>
                {practiceLogs.length > 0 ? (
                  <div className="bg-base-200/50 rounded-xl border border-line overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-black/20 text-content-muted font-mono uppercase text-xs">
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
                  <p className="text-content-muted italic">{i18n.t("Brak ćwiczeń.")}</p>
                )}
              </div>
            </div>
          )}

          

                    {activeTab === 'homework' && (
            <div className="space-y-6">
              <HomeworkScreen 
                initialStudentId={selectedUser?.id || null}
              />
            </div>
          )}

          {/* Zakładka testów. Kafelek i nagłówek istniały, ale nic pod nimi się
              nie renderowało — generator i przegląd testów były zaimportowane i
              nieużywane, więc kliknięcie „Testy" prowadziło na pustą stronę. */}
          {activeTab === 'tests' && (
            <div className="space-y-8">
              <AdminTestGenerator user={selectedUser} users={users} />

              {/* Testy otwarte: dla kandydatów, których nie ma jeszcze w bazie.
                  Wystawia się je w generatorze wyżej, a tutaj żyją ich kody,
                  linki i podejścia. */}
              <div className="space-y-3">
                <h3 className="text-xl font-bold">Testy otwarte (bez przypisanego kursanta)</h3>
                {currentUser?.id && <PublicTestPanel teacherId={currentUser.id} />}
              </div>

              <AllTestsTeacherView />
            </div>
          )}

          {activeTab === 'vocabulary' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">{i18n.t("Zestawy słówek i zadania specjalne")}</h3>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setShowSpecialTaskModal(true)}>
                    
                                                                                  {i18n.t("✨ Zadanie specjalne (AI)")}
                                                                                </Button>
                  <Button onClick={() => setShowAssignModal(true)}>
                    
                                                                                  {i18n.t("Przypisz Zestaw")}
                                                                                </Button>
                </div>
              </div>

              
              {specialTasks.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-bold text-lg mb-3">{i18n.t("Zadania specjalne")}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                if (!window.confirm(i18n.t("Czy na pewno chcesz usunąć to zadanie specjalne? Kursant nie będzie go już widział."))) return;
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
                </div>
              )}

              {userSets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {userSets.map(set => (
                    <Card key={set.id} className="p-4 cursor-pointer rounded-xl liquid-glass-hover bg-base-200/40 border border-white/5">
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
                <div className="text-center p-8 bg-base-200/50 rounded-2xl border border-white/5 text-content-muted">
                  {i18n.t("Brak przypisanych zestawów słówek.")}
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="max-w-4xl space-y-6 animate-fade-in">
              {/* Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-white/10">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                    <UserIcon size={20} className="text-primary" />
                    {i18n.t("Profil i parametry kursanta")}
                  </h3>
                  <p className="text-xs text-content-muted mt-0.5">
                    {i18n.t("Kompleksowa edycja danych konta, powiadomień e-mail, poziomu CEFR, integracji z Notion i uprawnień systemowych.")}
                  </p>
                </div>
                <Button 
                  onClick={() => handleSaveProfile()} 
                  isLoading={isSavingProfile}
                  className="bg-primary text-accent-ink hover:brightness-110 font-bold px-5 py-2 rounded-xl shadow-btn flex items-center gap-2 text-sm shrink-0 cursor-pointer"
                >
                  <Save size={16} />
                  {i18n.t("Zapisz profil")}
                </Button>
              </div>

              {/* CARD 1: DANE PODSTAWOWE I IDENTYFIKACJA */}
              <div className="bg-base-200/50 border border-white/10 rounded-2xl p-5 md:p-6 space-y-4 shadow-sm backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <UserIcon size={16} />
                    </span>
                    <h4 className="font-bold text-white text-base">{i18n.t("Dane podstawowe i identyfikacja")}</h4>
                  </div>
                  <span className="text-xs text-content-muted font-mono">
                    ID: <span className="text-white/80 select-all" title="Kliknij, aby zaznaczyć">{selectedUser.id}</span>
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
                      className="w-full bg-base-100/60 border border-white/10 rounded-xl px-3.5 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all text-sm text-white"
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
                      className="w-full bg-base-100/60 border border-white/10 rounded-xl px-3.5 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all text-sm text-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-base-100/40 p-3.5 rounded-xl border border-white/5">
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
                    className="flex items-center gap-1.5 text-xs bg-white/5 hover:bg-white/10 border-white/10 text-white cursor-pointer"
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

              {/* CARD 2: KOMUNIKACJA I MAILING */}
              <div className="bg-base-200/50 border border-white/10 rounded-2xl p-5 md:p-6 space-y-4 shadow-sm backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <Mail size={16} />
                    </span>
                    <h4 className="font-bold text-white text-base">{i18n.t("Komunikacja i powiadomienia e-mail (Mailing)")}</h4>
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
                    className="w-full bg-base-100/60 border border-white/10 rounded-xl px-3.5 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all font-mono text-sm text-white"
                  />
                  <p className="text-xs text-content-muted mt-1.5">
                    {i18n.t("Adres wykorzystywany do wysyłki prac domowych i ogłoszeń przez Resend API oraz do logowania konta.")}
                  </p>
                </div>

                {/* Mailing subscription toggle */}
                <div className="p-4 rounded-xl bg-base-100/40 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-white flex items-center gap-2">
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
                    <span className="text-sm font-bold text-white flex items-center gap-2">
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
                    <span className="text-sm font-bold text-white flex items-center gap-2">
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
                    onClick={() => setShowScratchpadModal(true)}
                  >
                    <FileEdit size={14} />
                    {i18n.t("Otwórz Notatnik")}
                  </Button>
                </div>
              </div>


              {/* CARD 3: POZIOM CEFR & KONFIGURACJA AI */}
              <div className="bg-base-200/50 border border-white/10 rounded-2xl p-5 md:p-6 space-y-4 shadow-sm backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <Sparkles size={16} />
                    </span>
                    <h4 className="font-bold text-white text-base">{i18n.t("Poziom zaawansowania i konfiguracja AI")}</h4>
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
                    className="w-full bg-base-100/60 border border-white/10 rounded-xl px-3.5 py-2.5 outline-none focus:border-primary text-white cursor-pointer transition-colors text-sm"
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
                    className="w-full bg-base-100/60 border border-white/10 rounded-xl p-3 outline-none focus:border-primary resize-y transition-colors text-sm text-white"
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
                    className="w-full bg-base-100/60 border border-white/10 rounded-xl p-3 outline-none focus:border-primary resize-y font-mono text-sm text-white transition-colors"
                  />
                  <p className="text-xs text-content-muted mt-1.5">
                    {i18n.t("Reguły te nadpisują domyślne zachowanie asystenta AI przy generowaniu ćwiczeń dla tego ucznia.")}
                  </p>
                </div>
              </div>

              {/* CARD 4: INTEGRACJA NOTION & METRYKI AKTYWNOŚCI */}
              <div className="bg-base-200/50 border border-white/10 rounded-2xl p-5 md:p-6 space-y-4 shadow-sm backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <RefreshCw size={16} />
                    </span>
                    <h4 className="font-bold text-white text-base">{i18n.t("Integracja Notion & Aktywność")}</h4>
                  </div>
                  <span className="text-xs text-content-muted">
                    Baza Notion
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-base-100/40 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-white flex items-center gap-2">
                      <RefreshCw size={15} className="text-primary" />
                      {i18n.t("Synchronizacja lekcji i 4 bloków")}
                    </span>
                    <p className="text-xs text-content-muted max-w-md">
                      {i18n.t("Pobierz nowe lekcje lub zaktualizuj istniejące wpisy bezpośrednio z powiązanej bazy Notion kursanta.")}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-primary/15 text-primary hover:bg-primary/25 border-primary/30 flex items-center gap-2 shrink-0 cursor-pointer font-semibold"
                    onClick={() => setShowStudentNotionSyncModal(true)}
                  >
                    <RefreshCw size={14} />
                    {i18n.t("Pobierz / Zaktualizuj z Notion")}
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-base-100/40 border border-white/5 text-center">
                    <div className="text-xs text-content-muted uppercase tracking-wider mb-1 font-mono">
                      {i18n.t("Liczba wizyt")}
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {selectedUser.loginCount || 0}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-base-100/40 border border-white/5 text-center">
                    <div className="text-xs text-content-muted uppercase tracking-wider mb-1 font-mono">
                      {i18n.t("Lekcje w bazie")}
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      {lessonRecords.length}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-base-100/40 border border-white/5 text-center">
                    <div className="text-xs text-content-muted uppercase tracking-wider mb-1 font-mono">
                      {i18n.t("Ostatnia aktywność")}
                    </div>
                    <div className="text-xs font-mono text-white mt-1.5 truncate">
                      {selectedUser.lastLoginDate ? new Date(selectedUser.lastLoginDate).toLocaleDateString('pl-PL') : i18n.t('Brak danych')}
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 5: UPRAWNIENIA I ZARZĄDZANIE KONTEM */}
              <div className="bg-base-200/50 border border-white/10 rounded-2xl p-5 md:p-6 space-y-4 shadow-sm backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <Shield size={16} />
                    </span>
                    <h4 className="font-bold text-white text-base">{i18n.t("Uprawnienia i zarządzanie kontem")}</h4>
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
                          : 'bg-base-100/60 text-content-muted hover:text-text-hi border border-white/10'
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
                          ? 'bg-blue-500 text-white shadow-md scale-[1.02]' 
                          : 'bg-base-100/60 text-content-muted hover:text-text-hi border border-white/10'
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
                          ? 'bg-danger text-white shadow-md scale-[1.02]' 
                          : 'bg-base-100/60 text-content-muted hover:text-text-hi border border-white/10'
                      }`}
                    >
                      <Shield size={14} />
                      {i18n.t("Administrator (Admin)")}
                    </button>
                  </div>
                </div>

                {/* AI Live Monitor Setting */}
                <div className="p-3.5 rounded-xl bg-base-100/40 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-white block">
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

                    {selectedUser?.tempPassword && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 cursor-pointer text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedUser.tempPassword || '');
                          showToast('Hasło zostało skopiowane do schowka.');
                        }}
                      >
                        <Copy size={13} className="mr-1" />
                        {i18n.t("Skopiuj aktualne hasło")}
                      </Button>
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
                      className={`cursor-pointer text-xs ${selectedUser.isArchived ? "bg-primary/20 text-primary hover:bg-primary/30 border-transparent" : "bg-base-100/60 text-content hover:bg-base-100 border-white/10"}`}
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
                      onClick={() => {
                        if (confirm('Czy na pewno chcesz usunąć to konto? Tej operacji nie można cofnąć.')) {
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

              {/* BOTTOM SAVE BAR */}
              <div className="pt-2 flex justify-end">
                <Button 
                  onClick={() => handleSaveProfile()} 
                  isLoading={isSavingProfile}
                  className="bg-primary text-accent-ink hover:brightness-110 font-bold px-6 py-3 rounded-xl shadow-btn flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Save size={18} />
                  {i18n.t("Zapisz wszystkie zmiany w profilu")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

      {showSpecialTaskModal && selectedUser && (
        <TeacherSpecialTaskModal
          user={selectedUser}
          initialLesson={specialTaskInitialLesson || undefined}
          onClose={() => {
            setShowSpecialTaskModal(false);
            setSpecialTaskInitialLesson(null);
          }}
          onTaskCreated={() => {
            fetchUserLogsAndStats(selectedUser.id);
            setSpecialTaskInitialLesson(null);
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
            <div className="bg-base-100 p-6 rounded-xl border border-white/10 shadow-2xl relative">
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
                  <div key={file.id} onClick={() => processDriveFile(file)} className="p-3 bg-base-200/50 hover:bg-base-200 rounded-lg cursor-pointer flex justify-between items-center border border-white/5 transition-colors">
                    <span className="font-medium text-sm text-white truncate max-w-[80%]">{file.name}</span>
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
            <div className="bg-base-100 p-6 rounded-xl border border-white/10 shadow-2xl relative">
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
               <span className="text-primary">✨</span>  {i18n.t("AI Lesson Summary")}
                                          </h3>
            <p className="text-base text-content-muted mb-4">
               
                                             {i18n.t("Wklej treść notatek ze spotkania (plain text lub markdown), a AI wygeneruje na ich podstawie pełny wpis z lekcji, wypełniając automatycznie datę, temat i wszystkie inne pola formularza.")}
                                          </p>
            
            <div className="flex gap-3 mb-4">
              <Button onClick={() => fetchDriveFiles('single')} variant="secondary" className="flex-1 flex justify-center items-center gap-2">
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
              className="w-full bg-base-200 border border-white/10 rounded-lg p-4 text-white h-[50vh] mb-4 font-mono text-sm leading-relaxed"
              placeholder={i18n.t("Wklej tutaj surową transkrypcję z Google Meet lub własne notatki...")}
            />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowAIModal(false)}>{i18n.t("Anuluj")}</Button>
              <Button onClick={handleGenerateFromNotes} isLoading={isGenerating} disabled={!rawMeetingNotes.trim()}>
                {i18n.t("Generuj wpis z lekcji")}
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
            <div className="bg-base-100 p-6 rounded-xl border border-white/10 shadow-2xl relative">
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
            
            <div className="flex gap-3 mb-4">
              <Button onClick={() => fetchDriveFiles('bulk')} variant="secondary" className="flex-1 flex justify-center items-center gap-2">
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
              className="w-full bg-base-200 border border-white/10 rounded-lg p-4 text-white h-[45vh] mb-4 font-mono text-sm leading-relaxed"
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
            <div className="bg-base-100 p-6 rounded-xl border border-white/10 shadow-2xl relative">
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
                  <Card key={idx} className="bg-base-200/60 border border-white/10 p-0 overflow-hidden">
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
                            className="font-bold text-sm bg-base-300 text-white border border-white/10 rounded px-2.5 py-1 flex-1 focus:outline-none focus:border-primary"
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

                      <div className="text-xs text-content-muted flex items-center gap-2 flex-wrap pt-1 border-t border-white/5">
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
                                  : 'bg-base-300/40 border-white/10 text-content-muted/60 hover:text-text-hi hover:bg-white/10'
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
                      <div className="p-4 pt-2 border-t border-white/10 bg-base-200/80 text-sm space-y-3">
                        <div>
                          <div className="font-bold text-content-muted mb-1 text-xs uppercase">{i18n.t("Notatki z lekcji")}</div>
                          <textarea
                            value={lesson.revisionNotes || ''}
                            onChange={(e) => {
                              const newLessons = [...bulkPreviewLessons];
                              newLessons[idx] = { ...newLessons[idx], revisionNotes: e.target.value };
                              setBulkPreviewLessons(newLessons);
                            }}
                            className="w-full bg-base-300 border border-white/10 rounded p-2 text-white text-xs min-h-[70px] leading-relaxed"
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
                            className="w-full bg-base-300 border border-white/10 rounded p-2 text-white font-mono text-xs min-h-[70px] leading-relaxed"
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
                              className="w-full bg-base-300 border border-white/10 rounded p-2 text-white text-xs min-h-[50px]"
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
                              className="w-full bg-base-300 border border-white/10 rounded p-2 text-white text-xs min-h-[50px]"
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
                            className="w-full bg-base-300 border border-white/10 rounded p-2 text-white text-xs min-h-[50px]"
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
                            <span className="text-white/20">|</span>
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
                                      : 'hover:bg-white/5 border border-transparent text-content-muted'
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
                            className="w-full bg-base-200 border border-white/10 rounded-lg p-2 text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Temat")}</label>
                          <input 
                            type="text" 
                            value={lessonFormTopic} 
                            onChange={e => setLessonFormTopic(e.target.value)}
                            className="w-full bg-base-200 border border-white/10 rounded-lg p-2 text-white"
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
                          className="w-full bg-base-200 border border-white/10 rounded-lg p-2 text-white min-h-[120px] resize-y"
                          placeholder={i18n.t("Zapis z lekcji...")}
                          rows={5}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Kursant — o czym mówił")}</label>
                        <textarea 
                          value={lessonFormStudentSpeaking} 
                          onChange={e => setLessonFormStudentSpeaking(e.target.value)}
                          className="w-full bg-base-200 border border-white/10 rounded-lg p-2 text-white min-h-[120px] resize-y"
                          rows={5}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Słownictwo & Wymowa (Vocabulary & Pronunciation)")}</label>
                        <textarea 
                          value={lessonFormWords} 
                          onChange={e => setLessonFormWords(e.target.value)}
                          className="w-full bg-base-200 border border-white/10 rounded-lg p-2 text-white font-mono text-sm min-h-[120px] resize-y"
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
                          className="w-full bg-base-200 border border-white/10 rounded-lg p-2 text-white min-h-[120px] resize-y"
                          rows={5}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Suggested follow-up")}</label>
                        <textarea 
                          value={lessonFormSuggestedFollowUp} 
                          onChange={e => setLessonFormSuggestedFollowUp(e.target.value)}
                          className="w-full bg-base-200 border border-white/10 rounded-lg p-2 text-white min-h-[120px] resize-y"
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
                        className="w-full bg-base-200 border border-white/10 rounded-lg p-2.5 pl-10 text-white text-sm"
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

                                if (!window.confirm(`Czy chcesz bezpośrednio zaimportować ${selectedItems.length} lekcji jako osobne wpisy dla wybranych kursantów? Każda lekcja zachowa swoją oryginalną datę.`)) {
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
                                    : 'border-white/5 bg-base-200/50 hover:bg-base-200 hover:border-primary/30'
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
                                  <h4 className="font-bold text-base text-white truncate">{item.record.topic}</h4>
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
                    
                    <div className="flex justify-end pt-2 border-t border-white/5">
                      <Button variant="ghost" onClick={() => setShowLessonRecordModal(false)}>{i18n.t("Anuluj")}</Button>
                    </div>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="w-full shadow-2xl border-white/10 bg-base-100 p-0 overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-base-200/50">
                  <div>
                    <h3 className="text-2xl font-bold font-display">{viewingRecord?.topic}</h3>
                    <div className="font-mono text-sm text-primary mt-1">{viewingRecord?.date}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="primary" 
                      onClick={() => handleGenerateHomeworkFromLesson(viewingRecord!)}
                      className="flex items-center gap-1.5 font-bold shadow-[0_0_15px_rgba(114,240,180,0.3)] hover:scale-105 text-xs sm:text-sm"
                    >
                      <Sparkles size={16} />
                      {i18n.t("Wygeneruj pracę domową")}
                    </Button>
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
                    <button onClick={() => setShowLessonRecordModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-content-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                  {/* Quick Homework Generation Top Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 border border-primary/40 shadow-[0_0_20px_rgba(114,240,180,0.15)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-xl shrink-0">
                        ✨
                      </div>
                      <div>
                        <h4 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2">
                          {i18n.t("Wygeneruj pracę domową z tej lekcji")}
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                            AI Generator
                          </span>
                        </h4>
                        <p className="text-xs text-content-muted mt-0.5">
                          {viewingRecord?.vocabularyText
                            ? `Utwórz ćwiczenia na tłumaczenie zdań z wykorzystaniem ${viewingRecord.vocabularyText.split('\n').filter(l => l.trim().length > 0).length} słówek z tej lekcji.`
                            : `Utwórz ćwiczenia na tłumaczenie zdań powiązane z tematem lekcji: „${viewingRecord?.topic}”.`}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="primary" 
                      onClick={() => handleGenerateHomeworkFromLesson(viewingRecord!)}
                      className="shrink-0 flex items-center gap-2 font-bold shadow-[0_0_15px_rgba(114,240,180,0.25)] hover:scale-105 text-xs sm:text-sm"
                    >
                      <Sparkles size={16} /> {i18n.t("Generuj zadania")}
                    </Button>
                  </div>
                  
                  {/* Cascading Lesson Details view */}
                  {viewingRecord && (
                    <CascadingLessonDetails
                      record={viewingRecord}
                      studentName={selectedUser ? `${selectedUser.firstName || ''} ${selectedUser.lastName || selectedUser.username}`.trim() : undefined}
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
                    className="w-full bg-base-300 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-content-muted mb-1">Treść wiadomości</label>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    rows={4}
                    className="w-full bg-base-300 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary resize-none"
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
                    className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 transition-colors pr-10 font-mono text-center tracking-wider text-lg"
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
                    className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-3 focus:border-primary focus:outline-none"
                    placeholder={i18n.t("e.g. John Doe")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Adres e-mail (opcjonalny)")}</label>
                  <input
                    type="email"
                    value={newStudentEmail}
                    onChange={(e) => setNewStudentEmail(e.target.value)}
                    className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-3 focus:border-primary focus:outline-none text-sm font-mono"
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
                      className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-3 focus:border-primary focus:outline-none"
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
            className="fixed bottom-6 left-1/2 z-[100] px-6 py-3 rounded-xl bg-base-300 border border-white/10 shadow-2xl flex items-center gap-3"
          >
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-white font-bold">{toastMessage.text}</span>
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
              className="relative w-full max-w-md bg-base-100 border border-white/10 rounded-2xl p-6 shadow-2xl text-center space-y-4 overflow-hidden"
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
                <h3 className="text-xl font-extrabold text-white">
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

      {/* Pop-up Modal dla Wyboru Kursanta */}
      {isStudentPickerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-base-200 border border-white/15 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-base-100/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-primary/20 text-primary border border-primary/30">
                  <Users size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white">Wybierz kursanta</h2>
                  <p className="text-xs text-content-muted mt-0.5">
                    Znajdź ucznia, aby wyświetlić jego kafelki (Profil, Statystyki, Historia, Testy, Słownictwo)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsStudentPickerOpen(false)}
                className="p-2 text-content-muted hover:text-text-hi rounded-xl hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filter Controls */}
            <div className="p-4 bg-base-100/30 border-b border-white/5 space-y-3">
              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted" />
                <input
                  type="text"
                  placeholder="Szukaj po imieniu, nazwisku, emailu lub loginie..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-base-100 border border-white/10 rounded-xl text-sm text-white placeholder-content-muted focus:border-primary focus:outline-none"
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
                  className="bg-base-100 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-primary outline-none cursor-pointer"
                >
                  <option value="all">🌐 Wszystkie role</option>
                  <option value="user">👤 Kursanci (Uczniowie)</option>
                  <option value="teacher">👨‍🏫 Nauczyciele</option>
                  <option value="admin">🔑 Administratorzy</option>
                </select>

                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="bg-base-100 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-primary outline-none cursor-pointer"
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
                    className="group bg-base-100/70 hover:bg-base-100 border border-white/10 hover:border-primary/50 p-3.5 px-4 rounded-2xl cursor-pointer flex items-center justify-between gap-3 transition-all duration-200 hover:shadow-[0_0_20px_rgba(114,240,180,0.15)]"
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
                          <span className="font-bold text-sm text-white group-hover:text-primary transition-colors truncate">
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
                        u.role === 'admin' ? 'bg-danger/12 text-danger border-danger/30' : u.role === 'teacher' ? 'bg-primary/12 text-primary border-primary/30' : 'bg-white/5 text-text-2 border-line-strong'
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
            <div className="p-4 border-t border-white/10 bg-base-100/40 text-xs text-content-muted flex justify-between items-center">
              <span>Znaleziono: <strong className="text-white">{filteredUsers.length}</strong> z {users.length} osób</span>
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

      {showStudentNotionSyncModal && (
        <StudentNotionSyncModal
          isOpen={showStudentNotionSyncModal}
          onClose={() => setShowStudentNotionSyncModal(false)}
          selectedUser={selectedUser}
          onSyncComplete={() => {
            if (selectedUser) {
              fetchUserLogsAndStats(selectedUser.id);
            }
            fetchUsers();
          }}
        />
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

      {/* Student Scratchpad Modal */}
      {showScratchpadModal && selectedUser && (
        <ScratchpadModal
          isOpen={showScratchpadModal}
          onClose={() => setShowScratchpadModal(false)}
          student={{
            id: selectedUser.id,
            name: selectedUser.firstName
              ? `${selectedUser.firstName} ${selectedUser.lastName || ''}`.trim()
              : selectedUser.username,
          }}
          onPushToLessonRecord={(data) => {
            setLessonFormStudentId(selectedUser.id);
            setLessonFormTopic(data.topic);
            setLessonFormWords(data.words);
            setLessonFormSummary(data.summary);
            setLessonFormThingsToImprove(data.thingsToImprove);
            setLessonFormSuggestedFollowUp(data.followUp);
            setLessonRecordModalMode('edit');
            setShowLessonRecordModal(true);
            setShowScratchpadModal(false);
            setActiveTab('history');
            showToast('Przeniesiono dane z brudnopisu do formularza lekcji!');
          }}
        />
      )}


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
      {/* DEDYKOWANY POP-UP MODAL DLA MODUŁU MAILING */}
      {isMailingModalOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMailingModalOpen(false);
          }}
        >
          <div className="w-full max-w-6xl max-h-[94vh] bg-base-100 border border-primary/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
            {/* Header modalu */}
            <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 flex items-center justify-between bg-base-200/70 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                    Mailing & Powiadomienia e-mail
                    {unreadMailingCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                        {unreadMailingCount} nowe
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-content-muted">
                    Szablony wiadomości, skrzynka odbiorcza, monitoring dostarczalności oraz weryfikacja wysyłek
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMailingModalOpen(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-text-hi transition-colors border border-white/10 flex items-center gap-1 text-xs font-bold cursor-pointer"
                title="Zamknij okno mailingu (Esc)"
              >
                <X size={16} />
                <span className="hidden sm:inline">Zamknij</span>
              </button>
            </div>
            {/* Treść modalu */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <AdminMailingScreen onBack={() => setIsMailingModalOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
