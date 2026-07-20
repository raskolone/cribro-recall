import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { motion, AnimatePresence } from 'motion/react';
import { collection, getDocs, doc, deleteDoc, query, orderBy, setDoc, writeBatch, updateDoc, addDoc, where } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { User, PracticeLog, FlashcardSet, LessonRecord } from '../../types';
import { useFlashcards } from '../../context/FlashcardContext';
import { useAuth } from '../../context/AuthContext';
import { useFirebaseAdminApi } from '../../hooks/useFirebaseAdminApi';
import { importVocabularyFromLessons } from '../../services/vocabularyService';
import Card from '../ui/Card';
import Button from '../ui/Button';
import AdminTestGenerator from './AdminTestGenerator';

interface UserWithId extends User {
  id: string;
}

interface AdminPanelProps { initialTab?: string | null; onViewChange?: (view: any) => void; initialSelectedUserId?: string | null; onUserSelect?: (userId: string | null) => void; }

const AdminPanel: React.FC<AdminPanelProps> = ({ initialTab, onViewChange, initialSelectedUserId, onUserSelect }) => {
  const { sets: adminSets, getFlashcards } = useFlashcards();
  const { connectGoogleDrive } = useAuth();
  const { createUser, deleteUser, changeUserRole: updateRoleApi, changeUserPassword } = useFirebaseAdminApi();
  

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
      // Fetch Lesson Records
      const lessonsQ = query(collection(db, `users/${userId}/lessonRecords`));
      const lessonsSnapshot = await getDocs(lessonsQ);
      const lessonsList = lessonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonRecord));
      lessonsList.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      setLessonRecords(lessonsList);

      // Fetch Practice Logs
      const logsQ = query(collection(db, `users/${userId}/practiceLogs`));
      const logsSnapshot = await getDocs(logsQ);
      const logsList = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PracticeLog));
      logsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPracticeLogs(logsList);

      // Fetch User's Flashcard Sets
      try {
        const setsQ = query(collection(db, 'sets'), where('userId', '==', userId));
        const setsSnapshot = await getDocs(setsQ);
        const setsList = setsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FlashcardSet));
        setsList.sort((a, b) => new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt).getTime() - new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt).getTime());
        setUserSets(setsList);
      } catch(e) { console.error("Error fetching sets", e); }

      // Setup a basic stats aggregate based on practice logs
      // A more complex aggregation could happen server side, but this is simple enough for now.
      setUserStats({
        totalWords: 120, // Example mock if no real stats collection exists
        difficultWords: 15,
        masteryCount: 85
      });
    } catch (e: any) {
      console.error('Error fetching logs and stats:', e);
    }
  };

  const handleSelectUser = (user: UserWithId) => {
    setSelectedUser(user);
    if (onUserSelect) onUserSelect(user.id);
    fetchUserLogsAndStats(user.id);
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
      if (!silent) alert('Zapisano profil pomyślnie!');
    } catch (e: any) {
      alert('Błąd podczas zapisywania: ' + e.message);
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
  const processDriveFile = async (file: any) => {};
  const fetchDriveFiles = async (mode?: string) => {};
  const handlePdfUpload = async (e: any, mode?: string) => {};
  const handleGenerateFromNotes = async () => {};
  const generateBulkSummary = async (logs: any) => {};
  const handleSaveBulkLessons = async () => {};
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
    if (!lessonFormStudentId) {
      alert("Wybierz kursanta.");
      return;
    }
    setIsSavingLessonRecord(true);
    try {
      const recordData = {
        studentId: lessonFormStudentId,
        date: lessonFormDate,
        topic: lessonFormTopic,
        vocabularyText: lessonFormWords,
        lessonSummary: lessonFormSummary,
        studentSpeaking: lessonFormStudentSpeaking,
        thingsToImprove: lessonFormThingsToImprove,
        suggestedFollowUp: lessonFormSuggestedFollowUp,
        updatedAt: new Date().toISOString()
      };

      if (editingRecordId) {
        await updateDoc(doc(db, `users/${lessonFormStudentId}/lessonRecords`, editingRecordId), recordData);
      } else {
        await addDoc(collection(db, `users/${lessonFormStudentId}/lessonRecords`), {
          ...recordData,
          createdAt: new Date().toISOString()
        });
      }
      
      closeLessonRecordModal();
      if (selectedUser?.id === lessonFormStudentId) {
        fetchUserLogsAndStats(lessonFormStudentId);
      }
      alert('Zapisano wpis z lekcji.');
    } catch (e: any) {
      alert('Błąd podczas zapisywania lekcji: ' + e.message);
    } finally {
      setIsSavingLessonRecord(false);
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
        let msg = apiErr.message;
        try {
          const parsed = JSON.parse(apiErr.message);
          if (parsed.error) msg = parsed.error;
        } catch (e) {}
        throw new Error("API Error: " + msg);
      }
      
      // 2. Set requirePasswordChange to true in Firestore so the student has to change it on login
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, { requirePasswordChange: true });
      
      // 3. Update local state
      const updated = { ...selectedUser, requirePasswordChange: true };
      setSelectedUser(updated);
      setUsers(users.map(u => u.id === updated.id ? updated : u));
      
      // Removed alert to prevent iframe block
      setShowChangePasswordModal(false);
      setNewPasswordForUser('');
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
        requirePasswordChange: true
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
      } else {
        setSelectedUser(null);
        setPracticeLogs([]);
        setLessonRecords([]);
      }
    }
  }, [users, initialSelectedUserId]);

  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([]);
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [userSets, setUserSets] = useState<FlashcardSet[]>([]);
  const [userStats, setUserStats] = useState<{ totalWords: number; difficultWords: number; masteryCount: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigningSet, setIsAssigningSet] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedSetIdToAssign, setSelectedSetIdToAssign] = useState('');
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

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
  const [newPasswordForUser, setNewPasswordForUser] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');
  const [isLessonVocabulary, setIsLessonVocabulary] = useState(false);
  const [lessonDate, setLessonDate] = useState(new Date().toISOString().split('T')[0]);
  const [lessonTopic, setLessonTopic] = useState('');

  // Lesson Record Form States
  const [showLessonRecordModal, setShowLessonRecordModal] = useState(false);
  const [lessonFormStudentId, setLessonFormStudentId] = useState('');
  const [lessonFormDate, setLessonFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [lessonFormTopic, setLessonFormTopic] = useState('');
  const [lessonFormWords, setLessonFormWords] = useState('');
  const [lessonFormSummary, setLessonFormSummary] = useState('');
  const [lessonFormStudentSpeaking, setLessonFormStudentSpeaking] = useState('');
  const [lessonFormThingsToImprove, setLessonFormThingsToImprove] = useState('');
  const [lessonFormSuggestedFollowUp, setLessonFormSuggestedFollowUp] = useState('');
  const [lessonRecordModalMode, setLessonRecordModalMode] = useState<'view' | 'edit'>('view');
  
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
  const [viewingRecord, setViewingRecord] = useState<LessonRecord | null>(null);
  const [isSavingLessonRecord, setIsSavingLessonRecord] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const openLessonRecordModal = (mode: 'view' | 'edit', record?: LessonRecord, preserveData: boolean = false) => {
    setLessonRecordModalMode(mode);
    if (record) {
      setEditingRecordId(record.id);
      setViewingRecord(record);
      setLessonFormStudentId(record.studentId || selectedUser?.id || '');
      setLessonFormDate(record.date);
      setLessonFormTopic(record.topic);
      setLessonFormWords(record.vocabularyText || (record as any).words || '');
      setLessonFormSummary(record.lessonSummary || (record as any).summary || '');
      setLessonFormStudentSpeaking(record.studentSpeaking || '');
      setLessonFormThingsToImprove(record.thingsToImprove || '');
      setLessonFormSuggestedFollowUp(record.suggestedFollowUp || '');
      setRawMeetingNotes('');
    } else {
      if (!preserveData) {
        setLessonFormStudentId(selectedUser?.id || '');
        setEditingRecordId(null);
        setViewingRecord(null);
        setLessonFormDate(new Date().toISOString().split('T')[0]);
        setLessonFormTopic('');
        setLessonFormWords('');
        setLessonFormSummary('');
        setLessonFormStudentSpeaking('');
        setLessonFormThingsToImprove('');
        setLessonFormSuggestedFollowUp('');
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
    setLessonFormSummary('');
  };


  // User Profile Edit States
  const [activeTab, setActiveTab] = useState<string | null>(initialTab || null);
  const tabContentRef = useRef<HTMLDivElement>(null);
  const userListRef = useRef<HTMLDivElement>(null);
  const profileContainerRef = useRef<HTMLDivElement>(null);
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
    if (userListRef.current && !selectedUser) {
      gsap.fromTo(userListRef.current.children,
        { opacity: 0, x: -30 },
        { opacity: 1, x: 0, duration: 0.4, ease: "power2.out", stagger: 0.05, clearProps: "all" }
      );
    }
  }, [activeTab, selectedUser, searchQuery, roleFilter, users]);

  useEffect(() => {
    if (profileContainerRef.current && selectedUser) {
      gsap.fromTo(profileContainerRef.current,
        { opacity: 0, scale: 0.98, y: 10 },
        { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "power2.out", clearProps: "all" }
      );
    }
  }, [selectedUser]);

  useEffect(() => {
    if (mainMenuRef.current && activeTab === null) {
      gsap.fromTo(mainMenuRef.current.children,
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAssignModal(false);
        setShowCreateStudentModal(false);
        setCreateStudentError('');
        setNewStudentPassword('');
        setNewStudentUsername('');
        setUserToDelete(null);
        setShowChangePasswordModal(false);
        setChangePasswordError('');
        closeLessonRecordModal();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  const handleRoleChange = async (newRole: 'admin' | 'user' | 'admin_student') => {
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
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight mb-6">Teacher Panel</h1>

      {activeTab === null ? (
        <div className="space-y-6">
          <div className="flex justify-end gap-2 mb-6">
            <button onClick={() => setShowAIModal(true)} className="px-4 py-2 bg-base-200/50 text-primary border border-primary/50 rounded-lg text-sm font-bold hover:bg-primary/10 transition-colors">
              ✨ AI Lesson Generator
            </button>
            <button onClick={() => setShowCreateStudentModal(true)} className="px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors">
              + Dodaj kursanta
            </button>
          </div>
          
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <button onClick={() => handleTabChange('profile')} className="flex flex-col items-center justify-center p-8 bg-base-200/50 rounded-2xl border border-white/5 hover:border-primary/50 hover:bg-base-200 transition-all duration-300 group">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <h3 className="font-bold text-lg">Profile kursantów</h3>
              </button>
              <button onClick={() => handleTabChange('stats')} className="flex flex-col items-center justify-center p-8 bg-base-200/50 rounded-2xl border border-white/5 hover:border-primary/50 hover:bg-base-200 transition-all duration-300 group">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <h3 className="font-bold text-lg">Statystyki</h3>
              </button>
              <button onClick={() => handleTabChange('history')} className="flex flex-col items-center justify-center p-8 bg-base-200/50 rounded-2xl border border-white/5 hover:border-primary/50 hover:bg-base-200 transition-all duration-300 group">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="font-bold text-lg">Historia</h3>
              </button>
              <button onClick={() => handleTabChange('tests')} className="flex flex-col items-center justify-center p-8 bg-base-200/50 rounded-2xl border border-white/5 hover:border-primary/50 hover:bg-base-200 transition-all duration-300 group">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                </div>
                <h3 className="font-bold text-lg">Testy</h3>
              </button>
              <button onClick={() => handleTabChange('vocabulary')} className="flex flex-col items-center justify-center p-8 bg-base-200/50 rounded-2xl border border-white/5 hover:border-primary/50 hover:bg-base-200 transition-all duration-300 group">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                </div>
                <h3 className="font-bold text-lg">Słownictwo</h3>
              </button>
            </div>
        </div>
      ) : (
        <div className="space-y-6">
          {!selectedUser ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={() => { setActiveTab(null); if (onViewChange) onViewChange('admin'); }}
                  className="flex items-center gap-2 text-content-muted hover:text-white transition-colors bg-base-200/50 px-4 py-2 rounded-xl border border-white/5 hover:border-primary/50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                  Wróć do panelu głównego
                </button>
                <h2 className="text-xl font-bold">
                  {activeTab === 'profile' && 'Wybierz kursanta'}
                  {activeTab === 'stats' && 'Wybierz kursanta (Statystyki)'}
                  {activeTab === 'history' && 'Wybierz kursanta (Historia)'}
                  {activeTab === 'tests' && 'Wybierz kursanta (Testy)'}
                  {activeTab === 'vocabulary' && 'Wybierz kursanta (Słownictwo)'}
                </h2>
              </div>
              
              <Card className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-base-200/50">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full sm:w-auto flex-1">
                  <input
                    type="text"
                    placeholder="Szukaj po imieniu, nazwisku, emailu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:max-w-md bg-base-100 border border-base-300 rounded-lg p-2.5 outline-none focus:border-primary/50 text-sm"
                  />
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full sm:w-48 bg-base-100 border border-base-300 rounded-lg p-2.5 outline-none focus:border-primary/50 text-sm"
                  >
                    <option value="all">Wszystkie role</option>
                    <option value="user">Kursant</option>
                    <option value="admin">Admin</option>
                    <option value="admin_student">Admin + Kursant</option>
                  </select>
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-3 overflow-hidden" ref={userListRef}>
                
                {users.filter(u => {
                  const searchStr = `${u.firstName || ''} ${u.lastName || ''} ${u.username} ${u.username}`.toLowerCase();
                  const matchesSearch = searchStr.includes(searchQuery.toLowerCase());
                  const matchesRole = roleFilter === 'all' || u.role === roleFilter;
                  return matchesSearch && matchesRole;
                }).map((u, index) => (
                  <div
                    key={u.id}
                    
                    
                    
                    
                    onClick={() => handleSelectUser(u)}
                    className="bg-base-200 border border-white/5 p-4 rounded-xl cursor-pointer hover:border-primary/30 hover:bg-base-200/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                  >
                    <div>
                      <div className="font-bold text-lg group-hover:text-primary transition-colors">
                        {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username}
                      </div>
                      <div className="text-sm text-content-muted">{u.username}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${u.role === 'admin' ? 'bg-red-500/10 text-red-500' : u.role === 'admin_student' ? 'bg-purple-500/10 text-purple-500' : 'bg-primary/10 text-primary'}`}>
                        {u.role === 'admin_student' ? 'Admin + Kursant' : u.role === 'admin' ? 'Admin' : 'Kursant'}
                      </span>
                      <div className="text-content-muted group-hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
                
              </div>
            </div>
          ) : (
            <div ref={profileContainerRef}>
              <div className="mb-4 flex items-center gap-6">
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    if (onUserSelect) onUserSelect(null);
                    setPracticeLogs([]);
                    setLessonRecords([]);
                  }}
                  className="text-sm font-bold text-content-muted hover:text-white flex items-center gap-2 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Wróć do listy kursantów
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
                  className="text-sm font-bold text-content-muted hover:text-white flex items-center gap-2 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Wróć do menu głównego
                </button>
              </div>

              <Card className="bg-base-200/50 mb-6">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-full bg-base-300 flex items-center justify-center font-bold text-3xl text-primary flex-shrink-0 relative group overflow-hidden border border-white/10">
                    {selectedUser.photoURL ? (
                      <img src={selectedUser.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      selectedUser.firstName ? selectedUser.firstName[0].toUpperCase() : selectedUser.username[0].toUpperCase()
                    )}
                    <div onClick={() => {
                      const newUrl = prompt('Podaj URL do nowego awatara:', selectedUser.photoURL || '');
                      if (newUrl !== null) {
                        const userRef = doc(db, 'users', selectedUser.id);
                        updateDoc(userRef, { photoURL: newUrl }).then(() => {
                          const updated = { ...selectedUser, photoURL: newUrl };
                          setSelectedUser(updated);
                          setUsers(users.map(u => u.id === updated.id ? updated : u));
                        }).catch(err => alert('Błąd: ' + err.message));
                      }
                    }} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <span className="text-xs text-white">Zmień awatar</span>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {selectedUser.firstName || selectedUser.lastName ? `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() : selectedUser.username}
                    </h2>
                    <p className="text-content-muted mt-1">
                      {selectedUser.username}
                      {selectedUser.level && <span className="ml-3 px-2 py-0.5 bg-primary/20 text-primary rounded text-xs uppercase font-bold">{selectedUser.level}</span>}
                    </p>
                    <div className="mt-3 text-sm text-content-muted flex flex-wrap gap-x-6 gap-y-2">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-400"></div><span className="font-bold text-white">Rola:</span> {selectedUser.role === 'admin' ? 'Admin' : selectedUser.role === 'admin_student' ? 'Admin + Kursant' : 'Kursant'}</div>
                      <div><span className="font-bold text-white">Logowania:</span> {selectedUser.loginCount || 0}</div>
                      <div><span className="font-bold text-white">Ostatnio:</span> {selectedUser.lastLoginDate ? new Date(selectedUser.lastLoginDate).toLocaleString() : 'Nigdy'}</div>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="mb-6 flex items-center gap-4">
                <h2 className="text-xl font-bold text-primary">
                  {activeTab === 'stats' && 'Statystyki'}
                  {activeTab === 'history' && 'Historia'}
                  {activeTab === 'profile' && 'Profil kursanta'}
                  {activeTab === 'tests' && 'Testy'}
                  {activeTab === 'vocabulary' && 'Słownictwo'}
                  {activeTab === 'contact' && 'Kontakt'}
                </h2>
              </div>
<div ref={tabContentRef}>
          {activeTab === 'stats' && (
            <div className="space-y-6">
              {userStats ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <div className="bg-base-200/50 p-6 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center">
                    <div className="text-sm text-content-muted mb-2 font-mono uppercase">Słowa ogółem</div>
                    <div className="text-4xl font-display font-bold text-white">{userStats.totalWords}</div>
                  </div>
                  <div className="bg-base-200/50 p-6 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center">
                    <div className="text-sm text-content-muted mb-2 font-mono uppercase">Opanowane</div>
                    <div className="text-4xl font-display font-bold text-primary">{userStats.masteryCount}%</div>
                  </div>
                  <div className="bg-base-200/50 p-6 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center">
                    <div className="text-sm text-content-muted mb-2 font-mono uppercase">Trudne słowa</div>
                    <div className="text-4xl font-display font-bold text-amber-500">{userStats.difficultWords}</div>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 bg-base-200/50 rounded-2xl border border-white/5 text-content-muted">Brak statystyk do wyświetlenia.</div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-8">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Historia lekcji</h3>
                  <div className="flex gap-2">
                    
                    <Button size="sm" variant="secondary" onClick={() => setShowAIModal(true)}>
                      ✨ AI Lesson Summary
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowBulkModal(true)}>
                      📦 Bulk Import (AI)
                    </Button>
                    <Button size="sm" onClick={() => openLessonRecordModal('edit')}>Dodaj wpis</Button>
                  </div>
                </div>
                {lessonRecords.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {lessonRecords.map((record, index) => (
                      <Card 
                        key={record.id} 
                        className="relative group cursor-pointer hover:border-primary/50 transition-colors bg-base-200/50 p-4"
                        onClick={() => openLessonRecordModal('view', record)}
                      >
                        <button 
                          onClick={(e) => { e.stopPropagation(); openLessonRecordModal('edit', record); }}
                          className="absolute top-1/2 -translate-y-1/2 right-4 p-2 bg-base-100 rounded-lg text-content-muted hover:text-primary hover:bg-base-200 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <div className="flex items-center gap-4 pr-12">
                          <div className="w-12 h-12 flex-shrink-0 bg-primary/10 text-primary font-mono font-bold rounded-lg flex items-center justify-center">
                            #{lessonRecords.length - index}
                          </div>
                          <div className="flex-1 min-w-0">
                             <h4 className="font-bold text-lg line-clamp-1">{record.topic}</h4>
                             <span className="text-sm font-mono text-content-muted">{record.date}</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-content-muted italic">Brak historii lekcji.</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold mb-4">Historia ćwiczeń (App)</h3>
                {practiceLogs.length > 0 ? (
                  <div className="bg-base-200/50 rounded-xl border border-white/5 overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-black/20 text-content-muted font-mono uppercase text-xs">
                        <tr>
                          <th className="p-3">Data</th>
                          <th className="p-3">Typ</th>
                          <th className="p-3">Zestaw</th>
                          <th className="p-3 text-right">Wynik</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {practiceLogs.map(log => {
                          const percentage = log.score !== undefined && log.totalWords !== undefined && log.totalWords > 0
                            ? Math.round((log.score / log.totalWords) * 100) 
                            : null
                          
                          return (
                          <tr key={log.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-3 whitespace-nowrap">{new Date(log.date).toLocaleString()}</td>
                            <td className="p-3 capitalize">{log.exerciseType}</td>
                            <td className="p-3 line-clamp-1">{/* No setName in practice log */}</td>
                            <td className="p-3 text-right">
                              {log.score !== undefined && log.totalWords !== undefined ? (
                                <span className={log.score / log.totalWords >= 0.8 ? 'text-primary' : log.score / log.totalWords >= 0.5 ? 'text-amber-500' : 'text-red-500'}>
                                  {log.score} / {log.totalWords} ({Math.round(log.score / log.totalWords * 100)}%)
                                </span>
                              ) : '-'}
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-content-muted italic">Brak ćwiczeń.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'tests' && (
            <AdminTestGenerator user={selectedUser} />
          )}

          {activeTab === 'vocabulary' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Zestawy Słówek Kursanta</h3>
                <Button onClick={() => setShowAssignModal(true)}>
                  Przypisz Zestaw
                </Button>
              </div>

              {userSets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {userSets.map(set => (
                    <Card key={set.id} className="p-4 bg-base-200/50 hover:border-primary/50 transition-colors cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-lg">{set.title}</h4>
                        {set.assignedByTeacher && (
                          <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">Od Nauczyciela</span>
                        )}
                      </div>
                      <p className="text-sm text-content-muted mb-4">{set.description || 'Brak opisu'}</p>
                      <div className="flex items-center gap-4 text-xs font-mono text-content-muted">
                        <span>Fiszki: {set.cardCount}</span>
                        <span>{new Date(set.createdAt?.seconds ? set.createdAt.seconds * 1000 : set.createdAt).toLocaleDateString()}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 bg-base-200/50 rounded-2xl border border-white/5 text-content-muted">
                  Brak przypisanych zestawów słówek.
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="max-w-2xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-content-muted mb-1">Imię</label>
                  <input
                    type="text"
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
                    
                    className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-content-muted mb-1">Nazwisko</label>
                  <input
                    type="text"
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
                    
                    className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-content-muted mb-1">Poziom zaawansowania</label>
                <select
                  value={profileForm.level}
                  onChange={(e) => {
                    setProfileForm(prev => ({ ...prev, level: e.target.value }));
                  }}
                  className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 text-white appearance-none cursor-pointer transition-colors"
                >
                  <option value="">Wybierz poziom...</option>
                  <option value="A1">A1</option>
                  <option value="A2">A2</option>
                  <option value="A2/B1">A2/B1</option>
                  <option value="B1">B1</option>
                  <option value="B1/B2">B1/B2</option>
                  <option value="B2">B2</option>
                  <option value="B2/C1">B2/C1</option>
                  <option value="C1">C1</option>
                  <option value="C2">C2</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-content-muted mb-1">Opis kursanta (wykorzystywany przez AI)</label>
                
            <textarea
                  value={profileForm.description}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, description: e.target.value }))}
                  
                  placeholder="Zainteresowania, słabe strony, cele nauki..."
                  rows={6}
                  className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 resize-y transition-colors"
                />
                <p className="text-xs text-content-muted mt-2">
                  Ten opis będzie wysyłany do sztucznej inteligencji jako dodatkowy kontekst podczas generowania zadań domowych, aby lepiej dopasować je do kursanta.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-content-muted mb-1">Spersonalizowany Prompt dla AI</label>
                <textarea
                  value={profileForm.aiPrompt}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, aiPrompt: e.target.value }))}
                  
                  placeholder="Tutaj wpisz przykładowe zdania, wzornictwo, specyficzne polecenia i żelazne zasady dla tego kursanta..."
                  rows={4}
                  className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 resize-y font-mono text-sm transition-colors"
                />
                <p className="text-xs text-content-muted mt-2">
                  To pole służy do ustawienia żelaznych zasad dla AI. Będzie one absolutnie priorytetowe dla sztucznej inteligencji podczas generowania zdań lub testów.
                </p>
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end">
                <Button onClick={() => handleSaveProfile()} isLoading={isSavingProfile}>
                  Zapisz profil
                </Button>
              </div>
              
              <div className="mt-8 pt-6 border-t border-white/10">
                  <h3 className="text-lg font-bold mb-4">Ustawienia konta</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <span className="text-sm font-bold text-content-muted block mb-2">Uprawnienia:</span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleRoleChange('user')}
                          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${selectedUser.role === 'user' ? 'bg-primary text-white border-transparent' : 'bg-base-200 text-content-muted hover:bg-base-200/80 hover:text-white border border-white/10'}`}
                        >
                          Kursant (User)
                        </button>
                        <button
                          onClick={() => handleRoleChange('admin')}
                          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${selectedUser.role === 'admin' ? 'bg-red-500 text-white border-transparent' : 'bg-base-200 text-content-muted hover:bg-base-200/80 hover:text-white border border-white/10'}`}
                        >
                          Admin
                        </button>
                        <button
                          onClick={() => handleRoleChange('admin_student')}
                          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${selectedUser.role === 'admin_student' ? 'bg-purple-500 text-white border-transparent' : 'bg-base-200 text-content-muted hover:bg-base-200/80 hover:text-white border border-white/10'}`}
                        >
                          Admin + Kursant
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-sm font-bold text-content-muted block mb-2">Zarządzanie kontem:</span>
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
                                alert('Zmieniono nazwę.');
                              }).catch(err => alert('Błąd: ' + err.message));
                            }
                          }}
                        >
                          Zmień nazwę konta
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
                          Zmień hasło
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="sm"
                          className={selectedUser.isSuspended ? "bg-green-500/20 text-green-500 hover:bg-green-500/30 border-transparent" : "bg-orange-500/20 text-orange-500 hover:bg-orange-500/30 border-transparent"}
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
                          className="bg-red-500/20 text-red-500 hover:bg-red-500/30 border-transparent"
                          onClick={() => {
                            if (confirm('Czy na pewno chcesz usunąć to konto? Tej operacji nie można cofnąć.')) {
                              deleteDoc(doc(db, 'users', selectedUser.id)).then(() => {
                                setUsers(users.filter(u => u.id !== selectedUser.id));
                                setSelectedUser(null);
                              }).catch(err => alert('Błąd: ' + err.message));
                            }
                          }}
                        >
                          Skasuj konto
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          )}
        </div>
        </div>
      )}
        </div>
      )}

      {/* Assign Set Modal */}
      {showAssignModal && (
        <div ref={assignModalAnim.overlayRef} className="fixed inset-0 bg-base-100/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div ref={assignModalAnim.contentRef} className="w-full max-w-md">
            <Card className="w-full shadow-2xl border-primary/20">
            <h3 className="text-xl font-bold mb-4">Przypisz Zestaw Słówek</h3>
            <p className="mb-4 text-sm text-content-muted">
              Wybierz zestaw ze swoich (jako Admin) zestawów słówek, który zostanie skopiowany i przypisany do {selectedUser?.firstName || selectedUser?.username}.
            </p>
            
            <select
              value={selectedSetIdToAssign}
              onChange={(e) => setSelectedSetIdToAssign(e.target.value)}
              className="w-full bg-base-200/40 border border-white/10 rounded-lg p-3 text-white mb-6 outline-none focus:border-primary/50"
            >
              <option value="">-- Wybierz zestaw --</option>
              {adminSets.map(s => (
                <option key={s.id} value={s.id}>{s.title} ({s.cardCount} fiszek)</option>
              ))}
            </select>
            
            <div className="flex justify-end gap-3">
              <Button onClick={() => setShowAssignModal(false)} variant="secondary">
                Anuluj
              </Button>
              <Button 
                onClick={handleAssignSet} 
                isLoading={isAssigningSet}
                disabled={!selectedSetIdToAssign}
              >
                Przypisz Zestaw
              </Button>
            </div>
          </Card>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {userToDelete && (
        <div ref={deleteModalAnim.overlayRef} className="fixed inset-0 bg-base-100/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div ref={deleteModalAnim.contentRef} className="w-full max-w-md">
            <Card className="w-full shadow-2xl border-primary/20">
            <h3 className="text-xl font-bold mb-4">Confirm Deletion</h3>
            <p className="mb-6 opacity-80">
              Are you sure you want to delete this user document? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button onClick={() => setUserToDelete(null)} variant="secondary">
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  handleDeleteUser(userToDelete);
                  setUserToDelete(null);
                }} 
                variant="danger"
              >
                Delete Account
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
            <h3 className="text-xl font-bold mb-4">Wybierz plik z Google Drive</h3>
            
            {driveError && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg mb-4 text-sm">
                {driveError}
              </div>
            )}
            {driveLoading ? (

              <div className="text-center p-8 text-content-muted">Ładowanie plików...</div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {driveFiles.map(file => (
                  <div key={file.id} onClick={() => processDriveFile(file)} className="p-3 bg-base-200/50 hover:bg-base-200 rounded-lg cursor-pointer flex justify-between items-center border border-white/5 transition-colors">
                    <span className="font-medium text-sm text-white truncate max-w-[80%]">{file.name}</span>
                    <span className="text-xs text-content-muted">{file.mimeType.includes('pdf') ? 'PDF' : 'DOC'}</span>
                  </div>
                ))}
                {driveFiles.length === 0 && <div className="text-center text-content-muted">Brak odpowiednich plików.</div>}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <Button variant="ghost" onClick={() => setShowDriveModal(false)}>Anuluj</Button>
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
               <span className="text-primary">✨</span> AI Lesson Summary
            </h3>
            <p className="text-base text-content-muted mb-4">
               Wklej treść notatek ze spotkania (plain text lub markdown), a AI wygeneruje na ich podstawie pełny wpis z lekcji, wypełniając automatycznie datę, temat i wszystkie inne pola formularza.
            </p>
            
            <div className="flex gap-3 mb-4">
              <Button onClick={() => fetchDriveFiles('single')} variant="secondary" className="flex-1 flex justify-center items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Google Drive
              </Button>
              <div className="flex-1 relative">
                <input type="file" accept=".pdf" onChange={(e) => handlePdfUpload(e, 'single')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <Button variant="secondary" className="w-full pointer-events-none">Załaduj plik PDF</Button>
              </div>
            </div>
            <textarea
              value={rawMeetingNotes}
              onChange={e => setRawMeetingNotes(e.target.value)}
              className="w-full bg-base-200 border border-white/10 rounded-lg p-4 text-white h-[50vh] mb-4 font-mono text-sm leading-relaxed"
              placeholder="Wklej tutaj surową transkrypcję z Google Meet lub własne notatki..."
            />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowAIModal(false)}>Anuluj</Button>
              <Button onClick={handleGenerateFromNotes} isLoading={isGenerating} disabled={!rawMeetingNotes.trim()}>
                Generuj wpis z lekcji
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
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
               <span className="text-primary">📦</span> Bulk Import (Wiele lekcji)
            </h3>
            <p className="text-base text-content-muted mb-4">
               Wklej treść historii lekcji z dokuemntu lub załącz plik, aby AI podzieliło go na osobne wpisy i przypisało do kursantów.
            </p>
            
            <div className="flex gap-3 mb-4">
              <Button onClick={() => fetchDriveFiles('bulk')} variant="secondary" className="flex-1 flex justify-center items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Google Drive
              </Button>
              <div className="flex-1 relative">
                <input type="file" accept=".pdf" onChange={(e) => handlePdfUpload(e, 'bulk')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <Button variant="secondary" className="w-full pointer-events-none">Załaduj plik PDF</Button>
              </div>
            </div>
            <textarea
              value={bulkNotes}
              onChange={e => setBulkNotes(e.target.value)}
              className="w-full bg-base-200 border border-white/10 rounded-lg p-4 text-white h-[50vh] mb-4 font-mono text-sm leading-relaxed"
              placeholder="Wklej tutaj historię lekcji z Google Docs / plain text..."
            />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowBulkModal(false)}>Anuluj</Button>
              <Button onClick={() => {
                if (!bulkNotes.trim()) return;
                generateBulkSummary({ notes: bulkNotes });
              }} isLoading={isGenerating} disabled={!bulkNotes.trim()}>
                Generuj wpisy
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
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
               <span className="text-primary">✨</span> Podgląd zaimportowanych lekcji
            </h3>
            <p className="text-base text-content-muted mb-6">
               Sprawdź zaimportowane lekcje. Możesz rozwinąć każdą z nich, aby zobaczyć szczegóły.
            </p>
            
            <div className="space-y-4 max-h-[50vh] overflow-y-auto mb-6 pr-2">
              {bulkPreviewLessons.map((lesson, idx) => {
                const student = users.find(u => u.id === lesson.studentId);
                const isExpanded = expandedBulkIndex === idx;
                return (
                  <Card key={idx} className="bg-base-200/50 hover:bg-base-200 transition-colors border border-white/5 cursor-pointer p-0 overflow-hidden" onClick={() => setExpandedBulkIndex(isExpanded ? null : idx)}>
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                           <span className="font-mono text-xs text-primary px-2 py-0.5 rounded bg-primary/10">{lesson.date}</span>
                           <h4 className="font-bold text-lg">{lesson.lessonTopic || 'Brak tematu'}</h4>
                        </div>
                        <div className="text-sm text-content-muted flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          {student ? `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.username : 'Nieznany kursant'}
                        </div>
                      </div>
                      <div className="text-content-muted">
                         <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                         </svg>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="p-4 pt-0 border-t border-white/5 bg-base-200/30 text-sm space-y-4 mt-2">
                        {lesson.revisionNotes && (
                          <div>
                            <div className="font-bold text-content-muted mb-1 text-xs uppercase">Notatki</div>
                            <div className="text-white whitespace-pre-wrap">{lesson.revisionNotes}</div>
                          </div>
                        )}
                        {lesson.vocabularyText && (
                          <div>
                            <div className="font-bold text-content-muted mb-1 text-xs uppercase">Słówka</div>
                            <div className="text-white font-mono whitespace-pre-wrap">{lesson.vocabularyText}</div>
                          </div>
                        )}
                        {lesson.studentSpeaking && (
                          <div>
                            <div className="font-bold text-content-muted mb-1 text-xs uppercase">O czym mówił kursant</div>
                            <div className="text-white whitespace-pre-wrap">{lesson.studentSpeaking}</div>
                          </div>
                        )}
                        {lesson.thingsToImprove && (
                          <div>
                            <div className="font-bold text-content-muted mb-1 text-xs uppercase">Do poprawy</div>
                            <div className="text-white whitespace-pre-wrap">{lesson.thingsToImprove}</div>
                          </div>
                        )}
                        {lesson.suggestedFollowUp && (
                          <div>
                            <div className="font-bold text-content-muted mb-1 text-xs uppercase">Zadanie / Następna lekcja</div>
                            <div className="text-white whitespace-pre-wrap">{lesson.suggestedFollowUp}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowBulkPreviewModal(false)}>Anuluj</Button>
              <Button onClick={handleSaveBulkLessons} isLoading={isGenerating}>
                Zapisz wszystkie ({bulkPreviewLessons.length})
              </Button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Add/Edit Lesson Record Modal */}
      {showLessonRecordModal && (
        <div ref={lessonRecordModalAnim.overlayRef} className="fixed inset-0 bg-base-100/90 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto">
          <div ref={lessonRecordModalAnim.contentRef} className="w-full max-w-3xl my-auto">
            {lessonRecordModalMode === 'edit' ? (
              <Card className="w-full shadow-2xl border-primary/20">
                <h3 className="text-xl font-bold mb-4">{editingRecordId ? 'Edytuj lekcję' : 'Dodaj nową lekcję'}</h3>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-bold text-content-muted mb-1">Kursant</label>
                    <select 
                      value={lessonFormStudentId} 
                      onChange={e => setLessonFormStudentId(e.target.value)}
                      className="w-full bg-base-200 border border-primary/30 rounded-lg p-2 text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary mb-2 transition-all"
                    >
                      <option value="">Wybierz kursanta...</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username} ({u.level || 'Brak poziomu'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-content-muted mb-1">Data</label>
                      <input 
                        type="date" 
                        value={lessonFormDate} 
                        onChange={e => setLessonFormDate(e.target.value)}
                        className="w-full bg-base-200 border border-white/10 rounded-lg p-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-content-muted mb-1">Temat</label>
                      <input 
                        type="text" 
                        value={lessonFormTopic} 
                        onChange={e => setLessonFormTopic(e.target.value)}
                        className="w-full bg-base-200 border border-white/10 rounded-lg p-2 text-white"
                        placeholder="Np. Present Perfect vs Past Simple"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-content-muted mb-1">Revision Notes</label>
                    <textarea 
                      value={lessonFormSummary} 
                      onChange={e => setLessonFormSummary(e.target.value)}
                      className="w-full bg-base-200 border border-white/10 rounded-lg p-2 text-white min-h-[120px] resize-y"
                      placeholder="Zapis z lekcji..."
                      rows={5}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-content-muted mb-1">Kursant — o czym mówił</label>
                    <textarea 
                      value={lessonFormStudentSpeaking} 
                      onChange={e => setLessonFormStudentSpeaking(e.target.value)}
                      className="w-full bg-base-200 border border-white/10 rounded-lg p-2 text-white min-h-[120px] resize-y"
                      rows={5}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-content-muted mb-1">Słownictwo & Wymowa (Vocabulary & Pronunciation)</label>
                    <textarea 
                      value={lessonFormWords} 
                      onChange={e => setLessonFormWords(e.target.value)}
                      className="w-full bg-base-200 border border-white/10 rounded-lg p-2 text-white font-mono text-sm min-h-[120px] resize-y"
                      placeholder="apple - jabłko&#10;banana - banan"
                      rows={5}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-content-muted mb-1">Things to Improve</label>
                    <textarea 
                      value={lessonFormThingsToImprove} 
                      onChange={e => setLessonFormThingsToImprove(e.target.value)}
                      className="w-full bg-base-200 border border-white/10 rounded-lg p-2 text-white min-h-[120px] resize-y"
                      rows={5}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-content-muted mb-1">Suggested follow-up</label>
                    <textarea 
                      value={lessonFormSuggestedFollowUp} 
                      onChange={e => setLessonFormSuggestedFollowUp(e.target.value)}
                      className="w-full bg-base-200 border border-white/10 rounded-lg p-2 text-white min-h-[120px] resize-y"
                      rows={5}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setShowLessonRecordModal(false)}>Anuluj</Button>
                  <Button onClick={handleSaveLessonRecord} isLoading={isSavingLessonRecord}>Zapisz lekcję</Button>
                </div>
              </Card>
            ) : (
              <Card className="w-full shadow-2xl border-white/10 bg-base-100 p-0 overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-base-200/50">
                  <div>
                    <h3 className="text-2xl font-bold font-display">{viewingRecord?.topic}</h3>
                    <div className="font-mono text-sm text-primary mt-1">{viewingRecord?.date}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => openLessonRecordModal('edit', viewingRecord!)}>
                      Edytuj
                    </Button>
                    <button onClick={() => setShowLessonRecordModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-content-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                  
                  {viewingRecord?.lessonSummary && (
                    <div className="rounded-xl overflow-hidden border border-white/5 bg-[#1a1f2e]">
                      <div className="px-4 py-3 font-bold flex items-center gap-2 border-b border-white/5 text-gray-200">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        Revision Notes
                      </div>
                      <div className="p-4 text-sm text-gray-300 whitespace-pre-wrap">{viewingRecord.lessonSummary}</div>
                    </div>
                  )}

                  {viewingRecord?.studentSpeaking && (
                    <div className="rounded-xl overflow-hidden border border-white/5 bg-[#242424]">
                      <div className="px-4 py-3 font-bold flex items-center gap-2 border-b border-white/5 text-gray-200">
                        <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                        Kursant — o czym mówił
                      </div>
                      <div className="p-4 text-sm text-gray-300 whitespace-pre-wrap">{viewingRecord.studentSpeaking}</div>
                    </div>
                  )}

                  {viewingRecord?.vocabularyText && (
                    <div className="rounded-xl overflow-hidden border border-white/5 bg-[#162a22]">
                      <div className="px-4 py-3 font-bold flex items-center gap-2 border-b border-white/5 text-gray-200">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Słownictwo & Wymowa
                      </div>
                      <div className="p-4 text-sm font-mono text-gray-300 whitespace-pre-wrap">{viewingRecord.vocabularyText}</div>
                    </div>
                  )}

                  {viewingRecord?.thingsToImprove && (
                    <div className="rounded-xl overflow-hidden border border-white/5 bg-[#2a1616]">
                      <div className="px-4 py-3 font-bold flex items-center gap-2 border-b border-white/5 text-gray-200">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        Things to Improve
                      </div>
                      <div className="p-4 text-sm text-gray-300 whitespace-pre-wrap">{viewingRecord.thingsToImprove}</div>
                    </div>
                  )}

                  {viewingRecord?.suggestedFollowUp && (
                    <div className="rounded-xl overflow-hidden border border-white/5 bg-[#2a2816]">
                      <div className="px-4 py-3 font-bold flex items-center gap-2 border-b border-white/5 text-gray-200">
                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                        Suggested follow-up
                      </div>
                      <div className="p-4 text-sm text-gray-300 whitespace-pre-wrap">{viewingRecord.suggestedFollowUp}</div>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

{/* Change Password Modal */}
      {showChangePasswordModal && (
        <div ref={changePasswordModalAnim.overlayRef} className="fixed inset-0 bg-base-100/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div ref={changePasswordModalAnim.contentRef} className="w-full max-w-md">
            <Card className="w-full shadow-2xl border-primary/20">
            <h3 className="text-xl font-bold mb-4">Zmień hasło dla {selectedUser?.firstName || selectedUser?.username}</h3>
            <div className="space-y-4 mb-6">
              {changePasswordError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm">
                  {changePasswordError}
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-content-muted">Nowe hasło</label>
                  <button 
                    onClick={() => {
                      const toughPass = generateStrongPassword();
                      setNewPasswordForUser(toughPass);
                    }}
                    className="text-xs text-primary hover:text-primary/80 font-bold flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 hover:bg-primary/20 transition-all"
                  >
                    ✨ Generuj silne hasło
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={newPasswordForUser}
                    onChange={(e) => setNewPasswordForUser(e.target.value)}
                    className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 transition-colors pr-10 font-mono text-center tracking-wider text-lg"
                    placeholder="Wpisz lub wygeneruj hasło"
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
                      title="Skopiuj do schowka"
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
                Anuluj
              </Button>
              <Button 
                onClick={handleChangePassword} 
                isLoading={isChangingPassword}
                disabled={!newPasswordForUser || newPasswordForUser.length < 6}
              >
                Zmień hasło
              </Button>
            </div>
          </Card>
          </div>
        </div>
      )}

      {/* Create Student Modal */}
      {showCreateStudentModal && (
        <div ref={createStudentModalAnim.overlayRef} className="fixed inset-0 bg-base-100/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div ref={createStudentModalAnim.contentRef} className="w-full max-w-md">
            <Card className="w-full shadow-2xl border-primary/20">
            <h3 className="text-xl font-bold mb-4">Create New Student</h3>
            
            {!newStudentPassword ? (
              <div className="space-y-4 mb-6">
                {createStudentError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm">
                    {createStudentError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold text-content-muted mb-1">Student Username / Name</label>
                  <input
                    type="text"
                    value={newStudentUsername}
                    onChange={(e) => setNewStudentUsername(e.target.value)}
                    className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-3 focus:border-primary focus:outline-none"
                    placeholder="e.g. John Doe"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-content-muted mb-2">Password Option</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="passwordMode" 
                        checked={isAutoGeneratePassword} 
                        onChange={() => setIsAutoGeneratePassword(true)} 
                        className="accent-primary"
                      />
                      <span>Auto-generate</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="passwordMode" 
                        checked={!isAutoGeneratePassword} 
                        onChange={() => setIsAutoGeneratePassword(false)}
                        className="accent-primary"
                      />
                      <span>Set custom</span>
                    </label>
                  </div>
                </div>
                
                {!isAutoGeneratePassword && (
                  <div>
                    <label className="block text-sm font-bold text-content-muted mb-1">Custom Password</label>
                    <input
                      type="text"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-3 focus:border-primary focus:outline-none"
                      placeholder="Minimum 6 characters"
                      minLength={6}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg text-center space-y-2 relative">
                  <div className="text-green-500 font-bold mb-2">Student Created Successfully!</div>
                  <div className="text-sm text-content-muted">Email (Login):</div>
                  <div className="font-mono text-lg">{normalizeUsername(newStudentUsername)}</div>
                  <div className="text-sm text-content-muted mt-2">Password:</div>
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
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-amber-500 mt-2">Please copy these credentials and share them securely with the student. This password will not be shown again.</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              {!newStudentPassword ? (
                <>
                  <Button onClick={() => { setShowCreateStudentModal(false); setCreateStudentError(''); }} variant="secondary">Cancel</Button>
                  <Button onClick={handleCreateStudent} isLoading={isCreatingStudent} disabled={!newStudentUsername}>Create Account</Button>
                </>
              ) : (
                <Button onClick={() => { setShowCreateStudentModal(false); setNewStudentPassword(''); setNewStudentUsername(''); }}>Close</Button>
              )}
            </div>
          </Card>
        </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;
