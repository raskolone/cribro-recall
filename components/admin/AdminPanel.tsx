import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, query, orderBy, setDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { User, PracticeLog, FlashcardSet, LessonRecord } from '../../types';
import { useFlashcards } from '../../context/FlashcardContext';
import { importVocabularyFromLessons } from '../../services/vocabularyService';
import Card from '../ui/Card';
import Button from '../ui/Button';
import AdminTestGenerator from './AdminTestGenerator';

interface UserWithId extends User {
  id: string;
}

interface AdminPanelProps { initialTab?: string | null; onViewChange?: (view: any) => void; initialSelectedUserId?: string | null; }

const AdminPanel: React.FC<AdminPanelProps> = ({ initialTab, onViewChange, initialSelectedUserId }) => {
  const { sets: adminSets, getFlashcards } = useFlashcards();
  const [users, setUsers] = useState<UserWithId[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserWithId | null>(null);

  useEffect(() => {
    if (users.length > 0 && initialSelectedUserId && !selectedUser) {
      const user = users.find(u => u.id === initialSelectedUserId);
      if (user) {
        setSelectedUser(user);
        fetchUserLogsAndStats(user.id);
      }
    }
  }, [users, initialSelectedUserId]);

  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([]);
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [userStats, setUserStats] = useState<{ totalWords: number; difficultWords: number; masteryCount: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigningSet, setIsAssigningSet] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedSetIdToAssign, setSelectedSetIdToAssign] = useState('');
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
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
  
  // Meeting Notes AI State
  const [rawMeetingNotes, setRawMeetingNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<LessonRecord | null>(null);
  const [isSavingLessonRecord, setIsSavingLessonRecord] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [isImportingVocabulary, setIsImportingVocabulary] = useState(false);
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

  useEffect(() => {
    setActiveTab(initialTab || null);
  }, [initialTab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (onViewChange) onViewChange(`admin-${tab}`);
  };
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

  return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersList = usersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as UserWithId))
        .filter(user => user.username !== 'Demo User' && user.username !== 'Demo User (Offline)');
        
      setUsers(usersList);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserLogsAndStats = async (userId: string) => {
    setUserStats(null);
    setLessonRecords([]);
    
    try {
      const logsRef = collection(db, `users/${userId}/practiceLogs`);
      const q = query(logsRef, orderBy('date', 'desc'));
      const logsSnapshot = await getDocs(q);
      const logsList = logsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PracticeLog));
      setPracticeLogs(logsList);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `users/${userId}/practiceLogs`);
    }

    try {
      const lessonRecordsRef = collection(db, `users/${userId}/lessonRecords`);
      const qLR = query(lessonRecordsRef, orderBy('date', 'desc'));
      const lrSnapshot = await getDocs(qLR);
      const lrList = lrSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LessonRecord));
      setLessonRecords(lrList);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `users/${userId}/lessonRecords`);
    }

    try {
      const wordsRef = collection(db, `users/${userId}/words`);
      const wordsSnap = await getDocs(wordsRef);
      const diffWords = wordsSnap.docs.filter(d => d.data().isDifficult === true).length;
      
      setUserStats({
        totalWords: wordsSnap.size,
        difficultWords: diffWords,
        masteryCount: wordsSnap.size > 0 ? Math.round(((wordsSnap.size - diffWords) / wordsSnap.size) * 100) : 0
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `users/${userId}/words stats`);
    }
  };

  const handleSelectUser = (user: UserWithId) => {
    setSelectedUser(user);
    setProfileForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      level: user.level || '',
      description: user.description || '',
      aiPrompt: user.aiPrompt || ''
    });
    fetchUserLogsAndStats(user.id);
  };

  const handleSaveProfile = async () => {
    if (!selectedUser) return;
    setIsSavingProfile(true);
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      await setDoc(userRef, {
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        level: profileForm.level,
        description: profileForm.description,
        aiPrompt: profileForm.aiPrompt
      }, { merge: true });
      
      const updatedUser = { ...selectedUser, ...profileForm };
      setSelectedUser(updatedUser);
      setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
      alert('Profile saved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${selectedUser.id}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(`/api/firebase-admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete auth user');
      }

      await deleteDoc(doc(db, 'users', userId));
      setUsers(users.filter(u => u.id !== userId));
      if (selectedUser?.id === userId) {
        setSelectedUser(null);
        setPracticeLogs([]);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
  };

  const normalizeUsername = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const handleCreateStudent = async () => {
    if (!newStudentUsername) return;
    if (!isAutoGeneratePassword && passwordInput.length < 6) {
      setCreateStudentError("Password must be at least 6 characters.");
      return;
    }
    
    setCreateStudentError('');
    setIsCreatingStudent(true);
    try {
      const email = `${normalizeUsername(newStudentUsername)}@student.vocabboost.com`;
      const generatedPassword = isAutoGeneratePassword 
        ? Math.random().toString(36).slice(-8)
        : passwordInput;
      
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch('/api/firebase-admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email, password: generatedPassword, role: 'user' })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create user');
      }

      const newUserData = await res.json();

      // Create user document in Firestore
      await setDoc(doc(db, 'users', newUserData.uid), {
        username: newStudentUsername,
        email: email,
        role: 'user',
        streakCount: 0,
        lastStreakDate: new Date().toISOString()
      });

      setNewStudentPassword(generatedPassword);
      fetchUsers(); // Refresh the list
    } catch (error: any) {
      setCreateStudentError(`Error creating student: ${error.message}`);
    } finally {
      setIsCreatingStudent(false);
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser || !newPasswordForUser) return;
    if (newPasswordForUser.length < 6) {
      setChangePasswordError("Password must be at least 6 characters.");
      return;
    }
    
    setChangePasswordError('');
    setIsChangingPassword(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(`/api/firebase-admin/users/${selectedUser.id}/password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPasswordForUser })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update password');
      }

      alert('Password changed successfully!');
      setShowChangePasswordModal(false);
      setNewPasswordForUser('');
    } catch (error: any) {
      setChangePasswordError(`Error changing password: ${error.message}`);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleGenerateFromNotes = async () => {
    if (!rawMeetingNotes.trim()) return;
    setIsGenerating(true);
    try {
      // Pobieranie tokenu od usera zalogowanego
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : '';

      const allStudents = users.map(u => ({
        id: u.id,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username,
        level: u.level || '',
        description: u.description || '',
        aiPrompt: u.aiPrompt || ''
      }));

      const res = await fetch('/api/gemini/lesson-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          notes: rawMeetingNotes,
          students: allStudents
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Wystąpił błąd podczas generowania podsumowania');
      }

      const generatedData = await res.json();

      setLessonFormDate(new Date().toISOString().split('T')[0]);
      setLessonFormTopic(generatedData.lessonTopic || 'Lekcja angielskiego');
      
      setLessonFormStudentId(generatedData.studentId || selectedUser?.id || '');
      setLessonFormSummary(generatedData.revisionNotes || '');
      setLessonFormWords(generatedData.vocabularyText || '');
      setLessonFormStudentSpeaking(generatedData.studentSpeaking || '');
      setLessonFormThingsToImprove(generatedData.thingsToImprove || '');
      setLessonFormSuggestedFollowUp(generatedData.suggestedFollowUp || '');

      setShowAIModal(false);
      openLessonRecordModal('edit', undefined, true);

    } catch (err: any) {
      console.error(err);
      alert('Błąd API: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveLessonRecord = async () => {
    const studentToSaveTo = lessonFormStudentId || selectedUser?.id;
    if (!studentToSaveTo || !lessonFormDate || !lessonFormTopic) return;
    setIsSavingLessonRecord(true);

    try {
      if (editingRecordId) {
        const recordId = editingRecordId;
        const recordRef = doc(db, `users/${studentToSaveTo}/lessonRecords/${recordId}`);
        const existingRecord = lessonRecords.find(r => r.id === editingRecordId);
        
        const updatedRecord: Omit<LessonRecord, 'id'> = {
          studentId: studentToSaveTo,
          date: lessonFormDate,
          topic: lessonFormTopic,
          vocabularyText: lessonFormWords,
          lessonSummary: lessonFormSummary,
          studentSpeaking: lessonFormStudentSpeaking,
          thingsToImprove: lessonFormThingsToImprove,
          suggestedFollowUp: lessonFormSuggestedFollowUp,
          createdAt: existingRecord?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        if (existingRecord?.vocabularySetId) {
          updatedRecord.vocabularySetId = existingRecord.vocabularySetId;
        }

        await setDoc(recordRef, updatedRecord);
        if (studentToSaveTo === selectedUser?.id) {
          setLessonRecords(lessonRecords.map(r => r.id === recordId ? { id: recordId, ...updatedRecord } : r));
        }
      } else {
        const { createLessonRecordWithVocabularySet } = await import('../../services/lessonRecord');
        const { lessonRecordId, vocabularySetId } = await createLessonRecordWithVocabularySet({
          studentId: studentToSaveTo,
          date: lessonFormDate,
          topic: lessonFormTopic,
          vocabularyText: lessonFormWords,
          lessonSummary: lessonFormSummary,
          studentSpeaking: lessonFormStudentSpeaking,
          thingsToImprove: lessonFormThingsToImprove,
          suggestedFollowUp: lessonFormSuggestedFollowUp,
        });
        
        // We need to fetch it again or construct it to push to state
        const newRecord: LessonRecord = {
          id: lessonRecordId,
          studentId: studentToSaveTo,
          date: lessonFormDate,
          topic: lessonFormTopic,
          vocabularyText: lessonFormWords,
          lessonSummary: lessonFormSummary,
          studentSpeaking: lessonFormStudentSpeaking,
          thingsToImprove: lessonFormThingsToImprove,
          suggestedFollowUp: lessonFormSuggestedFollowUp,
          vocabularySetId: vocabularySetId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setLessonRecords([newRecord, ...lessonRecords]);
      }

      closeLessonRecordModal();
      alert('Lesson record saved successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to save lesson record.');
    } finally {
      setIsSavingLessonRecord(false);
    }
  };

  const handleImportVocabulary = async () => {
    if (!selectedUser) return;
    setIsImportingVocabulary(true);
    try {
      const result = await importVocabularyFromLessons(selectedUser.id);
      alert(`Vocabulary imported successfully!\nAdded: ${result.added}\nSkipped (duplicates): ${result.skipped}`);
    } catch (error) {
      console.error('Error importing vocabulary:', error);
      alert('Failed to import vocabulary. See console for details.');
    } finally {
      setIsImportingVocabulary(false);
    }
  };

  const executeAssignWordSet = async () => {
    if (!selectedUser || !selectedSetIdToAssign) return;
    setIsAssigningSet(true);
    
    try {
      const originalSet = adminSets.find(s => s.id === selectedSetIdToAssign);
      if (!originalSet) throw new Error("Set not found");

      // Get flashcards of original set
      const flashcards = await getFlashcards(originalSet.id);

      const newSetId = `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const batch = writeBatch(db);

      // Create new set
      const newSetRef = doc(db, `sets/${newSetId}`);
      batch.set(newSetRef, {
        userId: selectedUser.id,
        title: originalSet.title,
        description: originalSet.description || '',
        isPublic: false,
        cardCount: originalSet.cardCount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assignedByTeacher: true,
        isLessonVocabulary: isLessonVocabulary,
        lessonDate: isLessonVocabulary ? lessonDate : null,
        lessonTopic: isLessonVocabulary ? lessonTopic : null,
      });

      // Copy flashcards
      flashcards.forEach(card => {
        const newCardId = `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const cardRef = doc(db, `sets/${newSetId}/flashcards/${newCardId}`);
        const { id: _, ...cardData } = card;
        
        batch.set(cardRef, {
          ...cardData,
          createdAt: new Date().toISOString()
        });
      });

      await batch.commit();

      alert('Word list assigned successfully!');
      setShowAssignModal(false);
      setSelectedSetIdToAssign('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sets`);
    } finally {
      setIsAssigningSet(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }


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
      
      {!selectedUser ? (
        <div className="space-y-6">
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
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <div className="text-sm font-mono text-content-muted">Total: {users.filter(u => {
                const searchStr = `${u.firstName || ''} ${u.lastName || ''} ${u.email} ${u.username}`.toLowerCase();
                const matchesSearch = searchStr.includes(searchQuery.toLowerCase());
                const matchesRole = roleFilter === 'all' || u.role === roleFilter;
                return matchesSearch && matchesRole;
              }).length}</div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setShowAIModal(true)} variant="secondary" className="border-primary/50 text-primary hover:bg-primary/10">
                  ✨ AI Lesson Generator
                </Button>
                <Button size="sm" onClick={() => setShowCreateStudentModal(true)}>+ Add Student</Button>
              </div>
            </div>
          </Card>
          
          <div className="grid grid-cols-1 gap-3">
            {users.filter(u => {
                const searchStr = `${u.firstName || ''} ${u.lastName || ''} ${u.email} ${u.username}`.toLowerCase();
                const matchesSearch = searchStr.includes(searchQuery.toLowerCase());
                const matchesRole = roleFilter === 'all' || u.role === roleFilter;
                return matchesSearch && matchesRole;
              }).map(u => (
              <div 
                key={u.id}
                onClick={() => handleSelectUser(u)}
                className="bg-base-200 border border-white/5 p-4 rounded-xl cursor-pointer hover:border-primary/30 hover:bg-base-200/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div>
                  <div className="font-bold text-lg group-hover:text-primary transition-colors">
                    {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username}
                  </div>
                  <div className="text-sm text-content-muted">{u.email}</div>
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
        <>
          <div className="mb-4">
            <button 
              onClick={() => {
                setSelectedUser(null);
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
          </div>
          <Card className="space-y-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold">
                {selectedUser.firstName || selectedUser.lastName ? `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() : selectedUser.username}
              </h2>
              <p className="text-content-muted">
                {selectedUser.email} 
                {selectedUser.level && <span className="ml-3 px-2 py-0.5 bg-primary/20 text-primary rounded text-xs uppercase font-bold">{selectedUser.level}</span>}
              </p>
              <div className="mt-4">
                <span className="text-sm font-bold text-white block mb-2">Uprawnienia:</span>
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
              <div className="mt-2 text-sm text-content-muted flex flex-wrap gap-x-4 gap-y-2">
                <div><span className="font-bold text-white">Logins:</span> {selectedUser.loginCount || 0}</div>
                <div><span className="font-bold text-white">Last Login:</span> {selectedUser.lastLoginDate ? new Date(selectedUser.lastLoginDate).toLocaleString() : 'Never'}</div>
                <div><span className="font-bold text-white">Exercises:</span> {practiceLogs.length}</div>
              </div>
            </div>
            <div className="relative">
              {showAssignModal ? (
                <div className="absolute right-0 top-0 bg-base-100 border border-base-300 rounded-lg p-4 shadow-xl z-10 w-80">
                  <h4 className="font-bold mb-3">Select Set to Assign</h4>
                  <select 
                    className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded p-2 mb-4 text-sm"
                    value={selectedSetIdToAssign}
                    onChange={(e) => {
                      setSelectedSetIdToAssign(e.target.value);
                      if (isLessonVocabulary) {
                        const set = adminSets.find(s => s.id === e.target.value);
                        if (set) setLessonTopic(set.title);
                      }
                    }}
                  >
                    <option value="" disabled>-- Select a word list --</option>
                    {adminSets.map(set => (
                      <option key={set.id} value={set.id}>
                        {set.title} ({set.cardCount} cards)
                      </option>
                    ))}
                  </select>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <input 
                      type="checkbox" 
                      id="isLesson" 
                      checked={isLessonVocabulary}
                      onChange={(e) => {
                        setIsLessonVocabulary(e.target.checked);
                        if (e.target.checked && selectedSetIdToAssign) {
                          const set = adminSets.find(s => s.id === selectedSetIdToAssign);
                          if (set) setLessonTopic(set.title);
                        }
                      }}
                      className="rounded border-base-300 text-primary focus:ring-primary/50 bg-base-200"
                    />
                    <label htmlFor="isLesson" className="text-sm cursor-pointer select-none">Assign as Lesson Vocabulary</label>
                  </div>

                  {isLessonVocabulary && (
                    <div className="space-y-3 bg-base-200/50 p-3 rounded-lg border border-white/5 mb-4">
                      <div>
                        <label className="block text-xs font-bold text-content-muted mb-1">Lesson Date</label>
                        <input 
                          type="date" 
                          value={lessonDate}
                          onChange={(e) => setLessonDate(e.target.value)}
                          className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded p-1.5 outline-none focus:border-primary/50 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-content-muted mb-1">Topic</label>
                        <input 
                          type="text" 
                          value={lessonTopic}
                          onChange={(e) => setLessonTopic(e.target.value)}
                          placeholder="e.g. Travel vocabulary"
                          className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded p-1.5 outline-none focus:border-primary/50 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setShowAssignModal(false)} size="sm">
                      Cancel
                    </Button>
                    <Button 
                      onClick={executeAssignWordSet} 
                      isLoading={isAssigningSet} 
                      size="sm"
                      disabled={!selectedSetIdToAssign || (isLessonVocabulary && (!lessonDate || !lessonTopic))}
                    >
                      Assign
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button onClick={() => setShowAssignModal(true)} isLoading={isAssigningSet}>
                    Assign Word Set
                  </Button>
                  <Button variant="secondary" onClick={() => setShowChangePasswordModal(true)}>
                    Change Password
                  </Button>
                  <Button variant="secondary" className="text-red-500 hover:bg-red-500/10" onClick={() => setUserToDelete(selectedUser.id)}>
                    Delete Account
                  </Button>
                </div>
              )}
            </div>
          </div>

          
          {activeTab ? (
            <div className="mb-6 flex items-center gap-4">
              <button 
                onClick={() => { setActiveTab(null); if (onViewChange) onViewChange('admin'); }}
                className="flex items-center gap-2 text-content-muted hover:text-white transition-colors bg-base-200/50 px-4 py-2 rounded-xl border border-white/5 hover:border-primary/50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Wróć do panelu
              </button>
              <h2 className="text-xl font-bold">
                {activeTab === 'stats' && 'Statystyki'}
                {activeTab === 'history' && 'Historia'}
                {activeTab === 'profile' && 'Profil kursanta'}
                {activeTab === 'tests' && 'Testy'}
              </h2>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
              <button onClick={() => handleTabChange('profile')} className="flex flex-col items-center justify-center p-8 bg-base-200/50 rounded-2xl border border-white/5 hover:border-primary/50 hover:bg-base-200 transition-all duration-300 group">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <h3 className="font-bold text-lg">Profil kursanta</h3>
              </button>
              <button onClick={() => handleTabChange('tests')} className="flex flex-col items-center justify-center p-8 bg-base-200/50 rounded-2xl border border-white/5 hover:border-primary/50 hover:bg-base-200 transition-all duration-300 group">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                </div>
                <h3 className="font-bold text-lg">Testy</h3>
              </button>
            </div>
          )}


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
                    <Button size="sm" variant="secondary" onClick={handleImportVocabulary} isLoading={isImportingVocabulary}>Import Słownictwa</Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowAIModal(true)}>
                      ✨ AI Lesson Summary
                    </Button>
                    <Button size="sm" onClick={() => openLessonRecordModal('edit')}>Dodaj wpis</Button>
                  </div>
                </div>
                {lessonRecords.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {lessonRecords.map((record, index) => (
                      <Card 
                        key={record.id} 
                        className="relative group cursor-pointer hover:border-primary/50 transition-colors bg-base-200/50"
                        onClick={() => openLessonRecordModal('view', record)}
                      >
                        <button 
                          onClick={(e) => { e.stopPropagation(); openLessonRecordModal('edit', record); }}
                          className="absolute top-3 right-3 p-2 bg-base-100 rounded-lg text-content-muted hover:text-primary hover:bg-base-200 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <div className="flex justify-between items-start mb-3 pr-8">
                          <div className="font-mono text-xs uppercase tracking-wider text-primary mb-1">
                            Lekcja {lessonRecords.length - index}
                          </div>
                          <span className="text-xs font-mono text-content-muted">{record.date}</span>
                        </div>
                        <h4 className="font-bold mb-2 line-clamp-1 pr-8">{record.topic}</h4>
                        <div className="text-sm text-content-muted line-clamp-2">{record.lessonSummary || (record as any).summary}</div>
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

          {activeTab === 'profile' && (
            <div className="max-w-2xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-content-muted mb-1">Imię</label>
                  <input
                    type="text"
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-content-muted mb-1">Nazwisko</label>
                  <input
                    type="text"
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
                    className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-content-muted mb-1">Poziom zaawansowania</label>
                <select
                  value={profileForm.level}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, level: e.target.value }))}
                  className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 text-white appearance-none cursor-pointer"
                >
                  <option value="">Wybierz poziom...</option>
                  <option value="A1">A1</option>
                  <option value="A2">A2</option>
                  <option value="B1">B1</option>
                  <option value="B2">B2</option>
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
                  className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 resize-y"
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
                  className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 resize-y font-mono text-sm"
                />
                <p className="text-xs text-content-muted mt-2">
                  To pole służy do ustawienia żelaznych zasad dla AI. Będzie one absolutnie priorytetowe dla sztucznej inteligencji podczas generowania zdań lub testów.
                </p>
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end">
                <Button onClick={handleSaveProfile} isLoading={isSavingProfile}>
                  Zapisz profil
                </Button>
              </div>
            </div>
          )}
        </Card>
        </>
      )}

      {/* Delete User Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-base-100/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-primary/20">
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
      )}

      {/* AI Lesson Summary Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 md:p-6 overflow-y-auto">
          <div className="bg-base-100 p-6 rounded-xl w-full max-w-4xl border border-white/10 shadow-2xl relative my-auto">
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
               <span className="text-primary">✨</span> AI Lesson Summary
            </h3>
            <p className="text-base text-content-muted mb-4">
               Wklej treść notatek ze spotkania (plain text lub markdown), a AI wygeneruje na ich podstawie pełny wpis z lekcji, wypełniając automatycznie datę, temat i wszystkie inne pola formularza.
            </p>
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
      )}

      {/* Add/Edit Lesson Record Modal */}
      {showLessonRecordModal && (
        <div className="fixed inset-0 bg-base-100/90 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto">
          <div className="w-full max-w-3xl my-auto">
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
        <div className="fixed inset-0 bg-base-100/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-primary/20">
            <h3 className="text-xl font-bold mb-4">Change Password</h3>
            <div className="space-y-4 mb-6">
              {changePasswordError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm">
                  {changePasswordError}
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-bold text-content-muted">New Password</label>
                  <button 
                    onClick={() => setNewPasswordForUser(Math.random().toString(36).slice(-8))}
                    className="text-xs text-primary hover:text-primary/80"
                  >
                    Auto-generate
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={newPasswordForUser}
                    onChange={(e) => setNewPasswordForUser(e.target.value)}
                    className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 transition-colors pr-10"
                    placeholder="Enter new password"
                  />
                  {newPasswordForUser && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(newPasswordForUser);
                        alert('Password copied to clipboard!');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-content-muted hover:text-primary"
                      title="Copy to clipboard"
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
                Cancel
              </Button>
              <Button 
                onClick={handleChangePassword} 
                isLoading={isChangingPassword}
                disabled={!newPasswordForUser}
              >
                Change Password
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Create Student Modal */}
      {showCreateStudentModal && (
        <div className="fixed inset-0 bg-base-100/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-primary/20">
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
                  <div className="font-mono text-lg">{`${normalizeUsername(newStudentUsername)}@student.vocabboost.com`}</div>
                  <div className="text-sm text-content-muted mt-2">Password:</div>
                  <div className="font-mono text-lg font-bold tracking-widest bg-base-100 p-2 rounded inline-flex items-center gap-2 border border-base-300">
                    {newStudentPassword}
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(newStudentPassword);
                        alert('Password copied to clipboard!');
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
      )}

    </div>
  );
};

export default AdminPanel;
