import { createLessonRecordWithVocabularySet, syncFlashcardSetForLesson, getLessonRecordsForStudent, deleteLessonRecord } from '../../services/lessonRecord';
import PreLessonContext from './PreLessonContext';
import VocabularyApproval from './VocabularyApproval';
import RecallItemsReview, { ReviewedCandidate } from './RecallItemsReview';
import { saveRecallReview } from '../../services/recallItems';
import { countVocabularyItems, buildVocabularySetTitle, splitVocabularyLines } from '../../utils/vocabulary';
import { CascadingLessonDetails } from './CascadingLessonDetails';
import { getGeneratedScenarios } from '../../services/scenarioService';
import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { motion, AnimatePresence } from 'motion/react';
import { collection, getDocs, getDoc, doc, deleteDoc, query, orderBy, setDoc, writeBatch, updateDoc, addDoc, where } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { User, PracticeLog, FlashcardSet, LessonRecord, GeneratedLessonScenario } from '../../types';
import { useFlashcards } from '../../context/FlashcardContext';
import { useAuth } from '../../context/AuthContext';
import { generateLessonSummary, generateBulkLessonSummary } from '../../services/geminiService';
import { useFirebaseAdminApi } from '../../hooks/useFirebaseAdminApi';
import { importVocabularyFromLessons } from '../../services/vocabularyService';
import Card from '../ui/Card';
import Button from '../ui/Button';
import AdminTestGenerator from './AdminTestGenerator';
import AllTestsTeacherView from './AllTestsTeacherView';

import TeacherDashboardStats from './TeacherDashboardStats';
import TeacherSpecialTaskModal from './TeacherSpecialTaskModal';
import AssignVocabularyModal from './AssignVocabularyModal';
import HomeworkScreen from '../dashboard/HomeworkScreen';
import { isTaskForStudent } from '../../utils/homework';
import TeacherOverview from './TeacherOverview';
import LessonPlanner from './LessonPlanner';
import { LessonPresentationView } from './presentation/LessonPresentationView';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Trash2, Download, Printer, FileText, CheckCircle2, AlertCircle,
  User as UserIcon, Users, Search, X, ChevronRight, ChevronDown, ChevronUp, Sparkles, BarChart2, Clock, 
  BookOpen, BookMarked, UserCheck, Filter, Award, Activity, Calendar, 
  RefreshCw, Plus, Eye, Shield, Target, CalendarClock, Layers, Link as LinkIcon, Airplay
} from 'lucide-react';
import i18n from "i18next";
import html2pdf from 'html2pdf.js';
import { useEscapeModal } from '../../hooks/useEscapeModal';

interface UserWithId extends User {
  id: string;
}

interface AdminPanelProps { initialTab?: string | null; onViewChange?: (view: any) => void; initialSelectedUserId?: string | null; onUserSelect?: (userId: string | null) => void; }

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
  const { createUser, deleteUser, changeUserRole: updateRoleApi, changeUserPassword } = useFirebaseAdminApi();
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
    const nextTab = targetTab || activeTab || 'profile';
    setActiveTab(nextTab);
    if (onUserSelect) onUserSelect(user.id);
    if (onViewChange) onViewChange(`admin-${nextTab}`);
    fetchUserLogsAndStats(user.id);
    setIsStudentPickerOpen(false);
  };

  const handleTileClick = (tabId: string) => {
    if (tabId === 'lesson-planner' || tabId === 'presentation') {
      setActiveTab(tabId);
      if (onViewChange) onViewChange(`admin-${tabId}`);
      return;
    }
    if (!selectedUser) {
      setTargetTabAfterSelect(tabId);
      setIsStudentPickerOpen(true);
    } else {
      setActiveTab(tabId);
      if (onViewChange) onViewChange(`admin-${tabId}`);
    }
  };

  const handleSaveProfile = async (silent = false, formState = profileForm) => {
    if (!selectedUser) return;
    setIsSavingProfile(true);
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, {
        firstName: formState.firstName,
        lastName: formState.lastName,
        level: formState.level,
        description: formState.description,
        aiPrompt: formState.aiPrompt
      });
      const updatedUser = { ...selectedUser, ...formState };
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
      const email = normalizeUsername(newStudentUsername) + '@student.vocabboost.com';
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
  const [newStudentUsername, setNewStudentUsername] = useState('');
  const [newStudentPassword, setNewStudentPassword] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isAutoGeneratePassword, setIsAutoGeneratePassword] = useState(true);
  const [isCreatingStudent, setIsCreatingStudent] = useState(false);
  const [createStudentError, setCreateStudentError] = useState('');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
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

  const filteredUsers = users.filter(u => {
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
      setLessonFormDate(record.date);
      setLessonFormTopic(record.topic);
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
    setActiveTab(initialTab || null);
  }, [initialTab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (onViewChange) onViewChange(tab ? `admin-${tab}` : 'admin');
  };
  useEffect(() => {
    if (selectedUser) {
      setProfileForm({
        firstName: selectedUser.firstName || '',
        lastName: selectedUser.lastName || '',
        level: selectedUser.level || '',
        description: selectedUser.description || '',
        aiPrompt: selectedUser.aiPrompt || ''
      });
    }
  }, [selectedUser]);

  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    level: '',
    description: '',
    aiPrompt: ''
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
  useEscapeModal(showLessonRecordModal, () => closeLessonRecordModal());
  useEscapeModal(!!userToDelete, () => setUserToDelete(null), 5);
  useEscapeModal(!!(profileSaveModal && profileSaveModal.isOpen), () => setProfileSaveModal(null), 5);
  
  const handleRoleChange = async (newRole: 'admin' | 'user' | 'teacher') => {
    if (!selectedUser) return;
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, { role: newRole });
      
      // Update local state
      const updatedUser = { ...selectedUser, role: newRole };
      setSelectedUser(updatedUser);
      setUsers(users.map(u => u.id === selectedUser.id ? updatedUser : u));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${selectedUser.id}`);
    }
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

        <div className="flex flex-wrap items-center gap-2">
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
      </div>

      <TeacherOverview students={users} language={language} />

      {/* Dynamic Student Selector Banner */}
      <div className={`p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 ${
        selectedUser 
          ? 'bg-gradient-to-r from-primary/15 via-base-200/80 to-base-200/90 border-primary/60 shadow-[0_0_30px_rgba(114,240,180,0.15)]' 
          : 'bg-base-200/50 border-line-strong'
      }`}>
        {selectedUser ? (
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
                  <span className="text-xs text-content-muted font-mono truncate">({selectedUser.username})</span>
                  {selectedUser.level && (
                    <span className="px-2.5 py-0.5 bg-primary/20 text-primary border border-primary/40 rounded-lg text-xs font-mono font-bold">
                      Poziom: {selectedUser.level}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                    selectedUser.role === 'admin' ? 'bg-danger/12 text-danger border-danger/30' : selectedUser.role === 'teacher' ? 'bg-primary/12 text-primary border-primary/30' : 'bg-white/5 text-text-2 border-line-strong'
                  }`}>
                    {selectedUser.role === 'teacher' ? 'Nauczyciel' : selectedUser.role === 'admin' ? 'Admin' : 'Kursant'}
                  </span>
                </div>
                <div className="text-xs text-content-muted mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>📧 {selectedUser.email || 'Brak emaila'}</span>
                  <span>🔑 Logowań: <strong className="text-white">{selectedUser.loginCount || 0}</strong></span>
                  <span>🕒 Ostatnia wizyta: <strong className="text-white">{selectedUser.lastLoginDate ? new Date(selectedUser.lastLoginDate).toLocaleDateString() : 'Brak'}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
              <button
                onClick={() => setIsStudentPickerOpen(true)}
                className="px-4 py-2 bg-primary text-accent-ink rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-md"
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
                className="px-3 py-2 bg-ink/72 hover:bg-white/10 text-content-muted hover:text-white border border-white/10 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5"
              >
                <X size={16} />
                Wyczyść
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/12 text-primary border border-primary/30 shrink-0">
                <Users size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Wybierz kursanta, dla którego chcesz przeglądać dane
                </h3>
                <p className="text-xs text-content-muted mt-0.5">
                  Wybierz ucznia z eleganckiej listy, aby odblokować kafelki profilu, statystyk, historii lekcji i sesji, testów oraz słownictwa.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsStudentPickerOpen(true)}
              className="px-5 min-h-11 bg-primary text-accent-ink font-bold rounded-xl text-xs sm:text-sm shadow-btn hover:brightness-110 hover:-translate-y-px active:translate-y-0 transition-all flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto"
            >
              <Search size={18} />
              Wybierz kursanta z listy
            </button>
          </div>
        )}
      </div>

      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-content-muted flex items-center gap-2">
            <span>Kafelki modułów kursanta</span>
            {selectedUser && (
              <span className="text-xs text-primary font-mono font-normal">
                (Dla: {selectedUser.firstName || selectedUser.username})
              </span>
            )}
          </h2>
          {!selectedUser && (
            <span className="text-xs text-text-mute font-medium flex items-center gap-1">
              <AlertCircle size={14} /> Kliknij dowolny kafelek, aby wybrać kursanta
            </span>
          )}
        </div>

        {/* KAFELKI GŁÓWNE (4 DUŻE KAFELKI) */}
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {[
              {
                id: 'lesson-planner',
                title: 'Planer lekcji',
                badge: 'AI Planer',
                desc: 'Inteligentny asystent AI do planowania i tworzenia scenariuszy lekcji',
                icon: Sparkles
              },
              {
                id: 'presentation',
                title: 'Prezentacja & Notatnik',
                badge: 'Live Lekcja',
                desc: 'Interaktywne slajdy z wymową audio i wspólny notatnik z kursantem',
                icon: Airplay
              },
              {
                id: 'context',
                title: 'Kontekst przed lekcją',
                badge: 'Przed zajęciami',
                desc: 'Ostatnia lekcja, kluczowe słownictwo i błędy w jednym miejscu',
                icon: CalendarClock
              },
              {
                id: 'history',
                title: 'Historia lekcji i sesji',
                badge: 'Lekcje + App',
                desc: 'Dziennik przeprowadzonych lekcji oraz ćwiczenia w aplikacji',
                icon: Clock
              }
            ].map((tile) => {
              const IconComp = tile.icon;
              const isActive = activeTab === tile.id;

              return (
                <div
                  key={tile.id}
                  onClick={() => handleTileClick(tile.id)}
                  className={`p-4.5 sm:p-5 cursor-pointer flex flex-col justify-between liquid-glass-tile select-none transition-all rounded-2xl ${
                    isActive
                      ? 'border-primary/80 shadow-[0_0_24px_rgba(114,240,180,0.25)] ring-1 ring-primary/40 bg-ink-2 z-10'
                      : selectedUser || tile.id === 'lesson-planner' || tile.id === 'presentation'
                      ? 'hover:border-primary/50'
                      : 'opacity-85 hover:border-warn/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2.5 rounded-xl transition-colors ${
                        isActive
                          ? 'bg-primary text-accent-ink shadow-[0_0_14px_rgba(114,240,180,0.4)]'
                          : 'bg-ink/72 text-primary border border-white/10 group-hover:border-primary/40'
                      }`}>
                        <IconComp size={20} />
                      </div>
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md border font-mono ${
                        isActive
                          ? 'bg-primary/20 text-primary border-primary/40'
                          : 'bg-base-100/70 text-content-muted border-white/5'
                      }`}>
                        {isActive ? 'Aktywny' : tile.badge}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-base sm:text-lg text-white group-hover:text-primary transition-colors truncate">
                      {tile.title}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-content-muted mt-1 leading-relaxed line-clamp-2 min-h-[2.5rem]">
                      {tile.desc}
                    </p>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs font-semibold">
                    <span className={isActive ? 'text-primary font-bold' : 'text-content-muted'}>
                      {isActive ? 'Przeglądasz ten widok' : tile.id === 'lesson-planner' || tile.id === 'presentation' ? 'Otwórz moduł' : selectedUser ? 'Otwórz widok' : 'Wybierz kursanta'}
                    </span>
                    <ChevronRight size={14} className={`transition-transform group-hover:translate-x-0.5 ${isActive ? 'text-primary' : 'text-content-muted'}`} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* POZOSTAŁE KAFELKI (KOMPAKTOWY RZĄD 5 KAFELKÓW) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
            {[
              {
                id: 'profile',
                title: 'Profil kursanta',
                badge: 'Dane i AI',
                desc: 'Poziom i wytyczne AI',
                icon: UserIcon
              },
              {
                id: 'stats',
                title: 'Statystyki',
                badge: 'Analityka',
                desc: 'Aktywność i wyniki',
                icon: BarChart2
              },
              {
                id: 'tests',
                title: 'Testy',
                badge: 'Sprawdziany',
                desc: 'Generowanie testów AI',
                icon: Award
              },
              {
                id: 'homework',
                title: 'Praca domowa',
                badge: 'Zadania',
                desc: 'Zadania i oceny',
                icon: BookOpen
              },
              {
                id: 'vocabulary',
                title: 'Słownictwo',
                badge: 'Słówka + AI',
                desc: 'Zestawy i Zadania AI',
                icon: BookMarked
              }
            ].map((tile) => {
              const IconComp = tile.icon;
              const isActive = activeTab === tile.id;

              return (
                <div
                  key={tile.id}
                  onClick={() => handleTileClick(tile.id)}
                  className={`p-3 sm:p-3.5 cursor-pointer flex flex-col justify-between liquid-glass-tile select-none transition-all rounded-xl ${
                    isActive
                      ? 'border-primary/80 shadow-[0_0_18px_rgba(114,240,180,0.2)] ring-1 ring-primary/40 bg-ink-2 z-10'
                      : selectedUser
                      ? 'hover:border-primary/50'
                      : 'opacity-80 hover:border-warn/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-primary text-accent-ink shadow-[0_0_10px_rgba(114,240,180,0.3)]'
                          : 'bg-ink/72 text-primary border border-white/10 group-hover:border-primary/40'
                      }`}>
                        <IconComp size={15} />
                      </div>
                      <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border font-mono ${
                        isActive
                          ? 'bg-primary/20 text-primary border-primary/40'
                          : 'bg-base-100/70 text-content-muted border-white/5'
                      }`}>
                        {isActive ? 'Aktywny' : tile.badge}
                      </span>
                    </div>
                    <h3 className="font-bold text-xs sm:text-sm text-white group-hover:text-primary transition-colors truncate">
                      {tile.title}
                    </h3>
                    <p className="text-[11px] text-content-muted mt-0.5 leading-snug line-clamp-1">
                      {tile.desc}
                    </p>
                  </div>

                  <div className="mt-2.5 pt-1.5 border-t border-white/5 flex items-center justify-between text-[11px] font-semibold">
                    <span className={isActive ? 'text-primary font-bold' : 'text-content-muted'}>
                      {isActive ? 'Aktywny' : selectedUser ? 'Otwórz' : 'Wybierz'}
                    </span>
                    <ChevronRight size={12} className={`transition-transform group-hover:translate-x-0.5 ${isActive ? 'text-primary' : 'text-content-muted'}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Tab Content Header Banner */}
      {((selectedUser && activeTab) || activeTab === 'lesson-planner' || activeTab === 'presentation') && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-base-200/50 border border-white/10">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-primary animate-pulse" />
            <h2 className="text-xl font-extrabold text-white">
              {activeTab === 'lesson-planner' && 'Planer lekcji AI (Wersja robocza)'}
              {activeTab === 'presentation' && 'Interaktywna Prezentacja i Wspólny Notatnik Live'}
              {activeTab === 'context' && 'Kontekst kursanta przed lekcją'}
              {activeTab === 'profile' && 'Profil i parametry kursanta'}
              {activeTab === 'stats' && 'Statystyki i aktywność kursanta'}
              {activeTab === 'history' && 'Historia lekcji oraz sesji nauki w aplikacji'}
              {activeTab === 'tests' && 'Generowanie i przegląd testów AI'}
              {activeTab === 'vocabulary' && 'Zestawy słówek i Zadania Specjalne AI'}
              {activeTab === 'homework' && 'Praca domowa kursanta'}
            </h2>
          </div>
          {selectedUser ? (
            <span className="text-xs font-mono text-content-muted hidden sm:inline">
              Otwarty profil: <strong className="text-white">{selectedUser.firstName || selectedUser.username}</strong>
            </span>
          ) : (
            <span className="text-xs font-mono text-content-muted hidden sm:inline">
              Tryb ogólny / Wybierz kursanta
            </span>
          )}
        </div>
      )}

      {/* Active Tab Container */}
      <div ref={tabContentRef}>
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
            />
          )}

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
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-content-muted hover:text-white transition-colors">
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
                    <Button size="sm" variant="secondary" onClick={() => setShowAIModal(true)}>
                      {i18n.t("✨ AI Lesson Summary")}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowBulkModal(true)}>
                      {i18n.t("📦 Bulk Import (AI)")}
                    </Button>
                    <Button size="sm" onClick={() => openLessonRecordModal('edit')}>{i18n.t("Dodaj wpis")}</Button>
                  </div>
                </div>
                {lessonRecords.length > 0 ? (
                  <div className="space-y-4">
                    {(() => {
                      if (!groupByMonth) {
                        return (
                          <div className="grid grid-cols-1 gap-2.5">
                            {lessonRecords.map((record, index) => (
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
                                    #{lessonRecords.length - index}
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

                      const groups: { key: string, items: typeof lessonRecords }[] = [];
                      let currentGroupKey = '';
                      let currentGroup: { key: string, items: typeof lessonRecords } | null = null;
                      
                      lessonRecords.forEach(record => {
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
                                  {/* Left-aligned aesthetic header */}
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

                                  {/* Group Items */}
                                  {isExpanded && (
                                      <div className="grid grid-cols-1 gap-2.5 pl-2 sm:pl-4 border-l-2 border-primary/10 ml-2 sm:ml-4 mt-1 mb-2 animate-fadeIn">
                                          {group.items.map(record => {
                                              const globalIndex = lessonRecords.findIndex(l => l.id === record.id);
                                              const lessonNumber = lessonRecords.length - globalIndex;

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
                  <p className="text-content-muted italic">{i18n.t("Brak historii lekcji.")}</p>
                )}
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
            <div className="max-w-2xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Imię")}</label>
                  <input
                    type="text"
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
                    
                    className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Nazwisko")}</label>
                  <input
                    type="text"
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
                    
                    className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Poziom zaawansowania")}</label>
                <select
                  value={profileForm.level}
                  onChange={(e) => {
                    setProfileForm(prev => ({ ...prev, level: e.target.value }));
                  }}
                  className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 text-white appearance-none cursor-pointer transition-colors"
                >
                  <option value="">{i18n.t("Wybierz poziom...")}</option>
                  <option value="A1">{i18n.t("A1")}</option>
                  <option value="A2">{i18n.t("A2")}</option>
                  <option value="A2/B1">{i18n.t("A2/B1")}</option>
                  <option value="B1">{i18n.t("B1")}</option>
                  <option value="B1/B2">{i18n.t("B1/B2")}</option>
                  <option value="B2">{i18n.t("B2")}</option>
                  <option value="B2/C1">{i18n.t("B2/C1")}</option>
                  <option value="C1">{i18n.t("C1")}</option>
                  <option value="C2">{i18n.t("C2")}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Opis kursanta (wykorzystywany przez AI)")}</label>
                
            <textarea
                  value={profileForm.description}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, description: e.target.value }))}
                  
                  placeholder={i18n.t("Zainteresowania, słabe strony, cele nauki...")}
                  rows={6}
                  className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 resize-y transition-colors"
                />
                <p className="text-xs text-content-muted mt-2">
                  
                                                                            {i18n.t("Ten opis będzie wysyłany do sztucznej inteligencji jako dodatkowy kontekst podczas generowania zadań domowych, aby lepiej dopasować je do kursanta.")}
                                                                          </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-content-muted mb-1">{i18n.t("Spersonalizowany Prompt dla AI")}</label>
                <textarea
                  value={profileForm.aiPrompt}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, aiPrompt: e.target.value }))}
                  
                  placeholder={i18n.t("Tutaj wpisz przykładowe zdania, wzornictwo, specyficzne polecenia i żelazne zasady dla tego kursanta...")}
                  rows={4}
                  className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 resize-y font-mono text-sm transition-colors"
                />
                <p className="text-xs text-content-muted mt-2">
                  
                                                                            {i18n.t("To pole służy do ustawienia żelaznych zasad dla AI. Będzie one absolutnie priorytetowe dla sztucznej inteligencji podczas generowania zdań lub testów.")}
                                                                          </p>
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end">
                <Button onClick={() => handleSaveProfile()} isLoading={isSavingProfile}>
                  
                                                                            {i18n.t("Zapisz profil")}
                                                                          </Button>
              </div>
              
              {currentUser?.role === 'admin' && (
<div className="mt-8 pt-6 border-t border-white/10">
                  <h3 className="text-lg font-bold mb-4">{i18n.t("Ustawienia konta")}</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <span className="text-sm font-bold text-content-muted block mb-2">{i18n.t("Uprawnienia:")}</span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleRoleChange('user')}
                          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${selectedUser.role === 'user' ? 'bg-primary text-accent-ink border-transparent' : 'bg-base-200 text-content-muted hover:bg-primary/80 hover:text-white border border-white/10'}`}
                        >
                          {i18n.t("Kursant (User)")}
                        </button>
                        <button
                          onClick={() => handleRoleChange('admin')}
                          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${selectedUser.role === 'admin' ? 'bg-danger text-white border-transparent' : 'bg-base-200 text-content-muted hover:bg-base-200/80 hover:text-white border border-white/10'}`}
                        >
                          {i18n.t("Admin")}
                        </button>
                        <button
                          onClick={() => handleRoleChange('teacher')}
                          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${selectedUser.role === 'teacher' ? 'bg-primary text-accent-ink border-transparent' : 'bg-base-200 text-content-muted hover:bg-primary/80 hover:text-white border border-white/10'}`}
                        >
                          {i18n.t("Nauczyciel")}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-content-muted">{i18n.t("Podgląd modeli AI i AI Live Monitor:")}</span>
                        <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${selectedUser.showAiMonitor || selectedUser.canViewAiMonitor ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-base-300 text-content-muted'}`}>
                          {selectedUser.showAiMonitor || selectedUser.canViewAiMonitor ? 'Włączony dla tego profilu' : 'Domyślnie ukryty'}
                        </span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-base-200/60 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="text-sm font-semibold text-white block">
                            {selectedUser.showAiMonitor || selectedUser.canViewAiMonitor 
                              ? 'Widoczność modeli AI (OpenAI/Gemini) & Live Monitor' 
                              : 'Ukryj modele AI przed kursantem (Domyślne)'}
                          </span>
                          <p className="text-xs text-content-muted">
                            {selectedUser.showAiMonitor || selectedUser.canViewAiMonitor
                              ? 'Ten kursant ma uprawnienie do podglądu nazw modeli AI w zapytaniach oraz włączania Live Monitora.'
                              : 'Domyślnie kursant nie widzi do jakich modeli wysyłane są zapytania (OpenAI/Gemini) w żadnym panelu.'}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className={selectedUser.showAiMonitor || selectedUser.canViewAiMonitor ? "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/40 shrink-0" : "bg-base-300 text-content-muted hover:text-white shrink-0"}
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
                          {selectedUser.showAiMonitor || selectedUser.canViewAiMonitor ? '✅ Podgląd AI: WŁĄCZONY' : '🔒 Podgląd AI: WYŁĄCZONY'}
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-sm font-bold text-content-muted block mb-2">{i18n.t("Zarządzanie kontem:")}</span>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => {
                            const newName = prompt('Podaj nową nazwę (username):', selectedUser.username);
                            if (newName && newName !== selectedUser.username) {
                              const userRef = doc(db, 'users', selectedUser.id);
                              updateDoc(userRef, { username: newName }).then(() => {
                                const updated = { ...selectedUser, username: newName };
                                setSelectedUser(updated);
                                setUsers(users.map(u => u.id === updated.id ? updated : u));
                                showToast('Zmiana nazwy konta została zapisana.');
                              }).catch(err => alert('Błąd: ' + err.message));
                            }
                          }}
                        >
                          
                                                                                                    {i18n.t("Zmień nazwę konta")}
                                                                                                  </Button>
                        
                        <Button 
                          variant="secondary" 
                          size="sm"
                          onClick={() => {
                            setNewPasswordForUser('');
                            setChangePasswordError('');
                            setShowChangePasswordModal(true);
                          }}
                        >
                          
                                                                                                    {i18n.t("Zmień hasło")}
                                                                                                  </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setMessageTitle('Wiadomość od nauczyciela');
                            setMessageText('');
                            setShowMessageModal(true);
                          }}
                        >
                          Wyślij wiadomość
                        </Button>
                        {selectedUser?.tempPassword && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-primary/10 text-primary border-transparent hover:bg-primary/20"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedUser.tempPassword || '');
                              showToast('Hasło zostało skopiowane.');
                            }}
                          >
                            
                                                                                                          {i18n.t("📋 Skopiuj aktualne hasło")}
                                                                                                        </Button>
                        )}

                        
                        <Button
                          variant="secondary"
                          size="sm"
                          className={selectedUser.onboardingCompleted ? "bg-primary/20 text-primary border-transparent" : "bg-base-300 text-content-muted"}
                          onClick={() => {
                            const newStatus = !selectedUser.onboardingCompleted;
                            const userRef = doc(db, 'users', selectedUser.id);
                            updateDoc(userRef, { onboardingCompleted: newStatus }).then(() => {
                              const updated = { ...selectedUser, onboardingCompleted: newStatus };
                              setSelectedUser(updated);
                              setUsers(users.map(u => u.id === updated.id ? updated : u));
                              showToast(newStatus ? 'Onboarding oznaczony jako ukończony.' : 'Onboarding zresetowany (pojawi się ponownie).');
                            }).catch(err => alert('Błąd: ' + err.message));
                          }}
                        >
                          {selectedUser.onboardingCompleted ? '✅ Onboarding: Zrobiony' : '⬛ Onboarding: Brak'}
                        </Button>

                        <Button 
                          variant="secondary" 
                          size="sm"
                          className={selectedUser.isSuspended ? "bg-primary/20 text-primary hover:bg-primary/30 border-transparent" : "bg-warn/20 text-warn hover:bg-warn/30 border-transparent"}
                          onClick={() => {
                            const newSuspended = !selectedUser.isSuspended;
                            const userRef = doc(db, 'users', selectedUser.id);
                            updateDoc(userRef, { isSuspended: newSuspended }).then(() => {
                              const updated = { ...selectedUser, isSuspended: newSuspended };
                              setSelectedUser(updated);
                              setUsers(users.map(u => u.id === updated.id ? updated : u));
                            }).catch(err => alert('Błąd: ' + err.message));
                          }}
                        >
                          {selectedUser.isSuspended ? 'Odwieś konto' : 'Zawieś konto'}
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="bg-danger/20 text-danger hover:bg-danger/30 border-transparent"
                          onClick={() => {
                            if (confirm('Czy na pewno chcesz usunąć to konto? Tej operacji nie można cofnąć.')) {
                              handleDeleteUser(selectedUser.id);
                            }
                          }}
                        >
                          
                                                                                                    {i18n.t("Skasuj konto")}
                                                                                                  </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

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
                                  : 'bg-base-300/40 border-white/10 text-content-muted/60 hover:text-white hover:bg-white/10'
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
                          : 'text-content-muted hover:text-white'
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
                          : 'text-content-muted hover:text-white'
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
                              className="text-xs text-content-muted hover:text-white hover:underline font-medium"
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
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-base-300 text-content-muted font-mono">
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

                      {/* Powiązanie z Podstawą Lekcji (Scenariuszem bazowym) */}
                      <div className="p-3.5 rounded-xl bg-base-200/90 border border-primary/20 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-bold text-primary flex items-center gap-1.5">
                            <Layers size={14} /> Podstawa lekcji (Powiązany scenariusz bazowy)
                          </label>
                          {lessonFormScenarioTopic && (
                            <button
                              type="button"
                              onClick={() => {
                                setLessonFormScenarioId('');
                                setLessonFormScenarioTopic('');
                                setLessonFormScenarioContent('');
                              }}
                              className="text-[11px] text-content-muted hover:text-danger cursor-pointer transition-colors"
                            >
                              Odłącz scenariusz
                            </button>
                          )}
                        </div>
                        <select
                          value={lessonFormScenarioId}
                          onChange={(e) => {
                            const sId = e.target.value;
                            setLessonFormScenarioId(sId);
                            const sc = availableScenariosForForm.find(s => s.id === sId);
                            if (sc) {
                              setLessonFormScenarioTopic(sc.topic || sc.title);
                              setLessonFormScenarioContent(sc.content);
                              if (!lessonFormTopic.trim()) {
                                setLessonFormTopic(sc.topic || sc.title);
                              }
                              if (!lessonFormWords.trim() && sc.vocabularyText) {
                                setLessonFormWords(sc.vocabularyText);
                              }
                            } else {
                              setLessonFormScenarioTopic('');
                              setLessonFormScenarioContent('');
                            }
                          }}
                          className="w-full bg-base-300 border border-white/10 rounded-lg p-2 text-white text-xs"
                        >
                          <option value="">-- Wybierz wygenerowany scenariusz (opcjonalnie) --</option>
                          {availableScenariosForForm.map(sc => (
                            <option key={sc.id} value={sc.id}>
                              {sc.topic || sc.title} {sc.studentName ? `(${sc.studentName})` : ''}
                            </option>
                          ))}
                        </select>
                        {lessonFormScenarioTopic && (
                          <div className="text-[11px] text-primary/80 font-medium">
                            🔗 Powiązano z konspektem: <span className="text-white font-bold">{lessonFormScenarioTopic}</span>
                          </div>
                        )}
                      </div>
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
                            className="text-xs text-content-muted hover:text-white flex-1 sm:flex-none"
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
                  <div className="font-mono text-lg">{normalizeUsername(newStudentUsername)}</div>
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
                  <Button onClick={() => { setShowCreateStudentModal(false); setCreateStudentError(''); }} variant="secondary">{i18n.t("Cancel")}</Button>
                  <Button onClick={handleCreateStudent} isLoading={isCreatingStudent} disabled={!newStudentUsername}>{i18n.t("Create Account")}</Button>
                </>
              ) : (
                <Button onClick={() => { setShowCreateStudentModal(false); setNewStudentPassword(''); setNewStudentUsername(''); }}>{i18n.t("Close")}</Button>
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
                className="p-2 text-content-muted hover:text-white rounded-xl hover:bg-white/10 transition-colors"
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-content-muted hover:text-white p-1"
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
                        <span className="px-2.5 py-1 bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-mono font-bold">
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
              <Button size="sm" variant="secondary" onClick={() => setIsStudentPickerOpen(false)}>
                Zamknij
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
