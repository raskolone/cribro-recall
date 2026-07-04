import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, query, orderBy, setDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { User, PracticeLog, FlashcardSet, LessonRecord } from '../../types';
import { useFlashcards } from '../../context/FlashcardContext';
import { importVocabularyFromLessons } from '../../services/vocabularyService';
import Card from '../ui/Card';
import Button from '../ui/Button';

interface UserWithId extends User {
  id: string;
}

const AdminPanel: React.FC = () => {
  const { sets: adminSets, getFlashcards } = useFlashcards();
  const [users, setUsers] = useState<UserWithId[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserWithId | null>(null);
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
  const [lessonFormDate, setLessonFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [lessonFormTopic, setLessonFormTopic] = useState('');
  const [lessonFormWords, setLessonFormWords] = useState('');
  const [lessonFormSummary, setLessonFormSummary] = useState('');
  const [isSavingLessonRecord, setIsSavingLessonRecord] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [isImportingVocabulary, setIsImportingVocabulary] = useState(false);

  const openLessonRecordModal = (record?: LessonRecord) => {
    if (record) {
      setEditingRecordId(record.id);
      setLessonFormDate(record.date);
      setLessonFormTopic(record.topic);
      setLessonFormWords(record.vocabularyText || (record as any).words || '');
      setLessonFormSummary(record.lessonSummary || (record as any).summary || '');
    } else {
      setEditingRecordId(null);
      setLessonFormDate(new Date().toISOString().split('T')[0]);
      setLessonFormTopic('');
      setLessonFormWords('');
      setLessonFormSummary('');
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
  const [activeTab, setActiveTab] = useState<'stats' | 'profile'>('stats');
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    level: '',
    description: ''
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
      description: user.description || ''
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
        description: profileForm.description
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

  const handleSaveLessonRecord = async () => {
    if (!selectedUser || !lessonFormDate || !lessonFormTopic) return;
    setIsSavingLessonRecord(true);

    try {
      if (editingRecordId) {
        const recordId = editingRecordId;
        const recordRef = doc(db, `users/${selectedUser.id}/lessonRecords/${recordId}`);
        const existingRecord = lessonRecords.find(r => r.id === editingRecordId);
        
        const updatedRecord: Omit<LessonRecord, 'id'> = {
          studentId: selectedUser.id,
          date: lessonFormDate,
          topic: lessonFormTopic,
          vocabularyText: lessonFormWords,
          lessonSummary: lessonFormSummary,
          createdAt: existingRecord?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        if (existingRecord?.vocabularySetId) {
          updatedRecord.vocabularySetId = existingRecord.vocabularySetId;
        }

        await setDoc(recordRef, updatedRecord);
        setLessonRecords(lessonRecords.map(r => r.id === recordId ? { id: recordId, ...updatedRecord } : r));
      } else {
        const { createLessonRecordWithVocabularySet } = await import('../../services/lessonRecord');
        const { lessonRecordId, vocabularySetId } = await createLessonRecordWithVocabularySet({
          studentId: selectedUser.id,
          date: lessonFormDate,
          topic: lessonFormTopic,
          vocabularyText: lessonFormWords,
          lessonSummary: lessonFormSummary,
        });
        
        // We need to fetch it again or construct it to push to state
        const newRecord: LessonRecord = {
          id: lessonRecordId,
          studentId: selectedUser.id,
          date: lessonFormDate,
          topic: lessonFormTopic,
          vocabularyText: lessonFormWords,
          lessonSummary: lessonFormSummary,
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
      
      <Card className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-base-200/50">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full sm:w-auto">
          <label className="font-bold whitespace-nowrap">Select Student:</label>
          <select 
            value={selectedUser?.id || ''} 
            onChange={(e) => {
              const u = users.find(u => u.id === e.target.value);
              if (u) handleSelectUser(u);
            }}
            className="w-full sm:w-64 bg-base-100 border border-base-300 rounded-lg p-2.5 outline-none focus:border-primary/50 text-sm"
          >
            <option value="" disabled>-- Choose a student --</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.username} ({u.email}) - {u.role === 'admin_student' ? 'Admin+Kursant' : u.role === 'admin' ? 'Admin' : 'Kursant'}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-sm font-mono text-content-muted">Total: {users.length}</div>
          <Button size="sm" onClick={() => setShowCreateStudentModal(true)}>+ Add Student</Button>
        </div>
      </Card>

      {selectedUser ? (
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
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm font-bold text-white">Uprawnienia:</span>
                <select
                  value={selectedUser.role}
                  onChange={(e) => handleRoleChange(e.target.value as 'admin' | 'user' | 'admin_student')}
                  className="bg-base-200/40 backdrop-blur-md border border-white/10 text-sm text-white rounded p-1"
                >
                  <option value="user">Kursant (User)</option>
                  <option value="admin">Admin</option>
                  <option value="admin_student">Admin + Kursant</option>
                </select>
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

          <div className="flex border-b border-white/10 mb-6">
            <button 
              className={`px-4 py-2 font-bold text-sm transition-colors ${activeTab === 'stats' ? 'text-primary border-b-2 border-primary' : 'text-content-muted hover:text-white'}`}
              onClick={() => setActiveTab('stats')}
            >
              Statystyki & Historia
            </button>
            <button 
              className={`px-4 py-2 font-bold text-sm transition-colors ${activeTab === 'profile' ? 'text-primary border-b-2 border-primary' : 'text-content-muted hover:text-white'}`}
              onClick={() => setActiveTab('profile')}
            >
              Profil kursanta
            </button>
          </div>

          {activeTab === 'stats' && (
            <>
              {userStats && (
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-base-200/50 p-4 rounded-xl border border-white/5 text-center">
                    <div className="text-sm text-content-muted mb-1 font-mono uppercase">Total Words</div>
                    <div className="text-3xl font-display font-bold text-white">{userStats.totalWords}</div>
                  </div>
                  <div className="bg-base-200/50 p-4 rounded-xl border border-white/5 text-center">
                    <div className="text-sm text-content-muted mb-1 font-mono uppercase">Mastery</div>
                    <div className="text-3xl font-display font-bold text-primary">{userStats.masteryCount}%</div>
                  </div>
                  <div className="bg-base-200/50 p-4 rounded-xl border border-white/5 text-center">
                    <div className="text-sm text-content-muted mb-1 font-mono uppercase">Difficult</div>
                    <div className="text-3xl font-display font-bold text-amber-500">{userStats.difficultWords}</div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Lesson Records</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={handleImportVocabulary} isLoading={isImportingVocabulary}>Import Vocabulary</Button>
                  <Button size="sm" onClick={() => openLessonRecordModal()}>Add Record</Button>
                </div>
              </div>
              {lessonRecords.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  {lessonRecords.map((record, index) => (
                    <Card 
                      key={record.id} 
                      className="cursor-pointer hover:border-primary/50 transition-colors bg-base-200/50"
                      onClick={() => openLessonRecordModal(record)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="font-mono text-xs uppercase tracking-wider text-primary mb-1">
                          Lekcja {lessonRecords.length - index}
                        </div>
                        <span className="text-xs font-mono text-content-muted">{record.date}</span>
                      </div>
                      <h4 className="font-bold mb-2 line-clamp-1">{record.topic}</h4>
                      <div className="text-sm text-content-muted line-clamp-2">{record.lessonSummary || (record as any).summary}</div>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-content-muted italic mb-8">No lesson records found.</p>
              )}

              <h3 className="text-lg font-bold mb-4">Practice History</h3>
              {practiceLogs.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {practiceLogs.map(log => (
                    <div key={log.id} className="flex justify-between items-center p-3 bg-base-200/50 rounded-lg border border-white/5">
                      <div>
                        <div className="font-bold capitalize">{log.exerciseType.replace('-', ' ')}</div>
                        <div className="text-xs text-content-muted">
                          {new Date(log.date).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        {log.isRevisionMode && (
                          <span className="text-xs bg-secondary/20 text-secondary px-2 py-1 rounded-full mr-2">Revision</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-content-muted italic">No practice history found for this user.</p>
              )}
            </>
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

              <div className="pt-4 border-t border-white/10 flex justify-end">
                <Button onClick={handleSaveProfile} isLoading={isSavingProfile}>
                  Zapisz profil
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="h-[400px] flex items-center justify-center text-content-muted border-dashed border-2">
          Select a student from the dropdown menu to view their details
        </Card>
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

      {/* Add/Edit Lesson Record Modal */}
      {showLessonRecordModal && (
        <div className="fixed inset-0 bg-base-100/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl border-primary/20 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{editingRecordId ? 'Edit Lesson Record' : 'Add Lesson Record'}</h3>
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-content-muted mb-1">Date</label>
                  <input
                    type="date"
                    value={lessonFormDate}
                    onChange={(e) => setLessonFormDate(e.target.value)}
                    className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-content-muted mb-1">Topic</label>
                  <input
                    type="text"
                    value={lessonFormTopic}
                    onChange={(e) => setLessonFormTopic(e.target.value)}
                    placeholder="e.g. Present Simple"
                    className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-content-muted mb-1">Vocabulary / Words</label>
                <textarea
                  value={lessonFormWords}
                  onChange={(e) => setLessonFormWords(e.target.value)}
                  placeholder="Paste words covered in this lesson..."
                  rows={3}
                  className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 text-sm resize-y"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-content-muted mb-1">Lesson Summary</label>
                <textarea
                  value={lessonFormSummary}
                  onChange={(e) => setLessonFormSummary(e.target.value)}
                  placeholder="Summary of the lesson..."
                  rows={4}
                  className="w-full bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5 outline-none focus:border-primary/50 text-sm resize-y"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button onClick={closeLessonRecordModal} variant="secondary">
                Cancel
              </Button>
              <Button 
                onClick={handleSaveLessonRecord} 
                isLoading={isSavingLessonRecord}
                disabled={!lessonFormDate || !lessonFormTopic}
              >
                Save Record
              </Button>
            </div>
          </Card>
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
