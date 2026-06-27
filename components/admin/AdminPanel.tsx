import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, query, orderBy, setDoc, writeBatch } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { User, PracticeLog, FlashcardSet } from '../../types';
import { useFlashcards } from '../../context/FlashcardContext';
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
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
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
    try {
      setUserStats(null);
      
      const logsRef = collection(db, `users/${userId}/practiceLogs`);
      const q = query(logsRef, orderBy('date', 'desc'));
      const logsSnapshot = await getDocs(q);
      const logsList = logsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PracticeLog));
      setPracticeLogs(logsList);

      const wordsRef = collection(db, `users/${userId}/words`);
      const wordsSnap = await getDocs(wordsRef);
      const diffWords = wordsSnap.docs.filter(d => d.data().isDifficult === true).length;
      
      setUserStats({
        totalWords: wordsSnap.size,
        difficultWords: diffWords,
        masteryCount: wordsSnap.size > 0 ? Math.round(((wordsSnap.size - diffWords) / wordsSnap.size) * 100) : 0
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `users/${userId} stats`);
    }
  };

  const handleSelectUser = (user: UserWithId) => {
    setSelectedUser(user);
    fetchUserLogsAndStats(user.id);
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
        assignedByTeacher: true
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight mb-6">Teacher Panel</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users List */}
        <Card className="lg:col-span-1 h-[calc(100vh-12rem)] overflow-y-auto relative">
          <div className="flex justify-between items-center mb-4 sticky top-0 bg-base-200 z-10 py-2">
            <h2 className="text-xl font-bold">Students</h2>
            <Button size="sm" onClick={() => setShowCreateStudentModal(true)}>+ Add Student</Button>
          </div>
          <div className="space-y-2">
            {users.map(user => (
              <div 
                key={user.id} 
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedUser?.id === user.id ? 'border-primary bg-primary/10' : 'border-base-300 hover:border-primary/50'}`}
                onClick={() => handleSelectUser(user)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold">{user.username}</div>
                    <div className="text-xs text-content-muted">{user.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${user.role === 'admin' ? 'bg-secondary/20 text-secondary' : 'bg-base-300 text-content-muted'}`}>
                      {user.role === 'admin' ? 'teacher' : 'student'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* User Details */}
        <div className="lg:col-span-2 space-y-6">
          {selectedUser ? (
            <>
              <Card>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedUser.username}</h2>
                    <p className="text-content-muted">{selectedUser.email}</p>
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
                          className="w-full bg-base-200 border border-base-300 rounded p-2 mb-4 text-sm"
                          value={selectedSetIdToAssign}
                          onChange={(e) => setSelectedSetIdToAssign(e.target.value)}
                        >
                          <option value="" disabled>-- Select a word list --</option>
                          {adminSets.map(set => (
                            <option key={set.id} value={set.id}>
                              {set.title} ({set.cardCount} cards)
                            </option>
                          ))}
                        </select>
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" onClick={() => setShowAssignModal(false)} size="sm">
                            Cancel
                          </Button>
                          <Button 
                            onClick={executeAssignWordSet} 
                            isLoading={isAssigningSet} 
                            size="sm"
                            disabled={!selectedSetIdToAssign}
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
              </Card>
            </>
          ) : (
            <Card className="h-full flex items-center justify-center text-content-muted">
              Select a user to view details
            </Card>
          )}
        </div>
      </div>

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
                <label className="block text-sm font-bold text-content-muted mb-1">New Password</label>
                <input
                  type="text"
                  value={newPasswordForUser}
                  onChange={(e) => setNewPasswordForUser(e.target.value)}
                  className="w-full bg-base-200 border border-base-300 rounded-lg p-2.5 outline-none focus:border-primary/50 transition-colors"
                  placeholder="Enter new password"
                />
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
                    className="w-full bg-base-200 border border-base-300 rounded-lg p-3 focus:border-primary focus:outline-none"
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
                      className="w-full bg-base-200 border border-base-300 rounded-lg p-3 focus:border-primary focus:outline-none"
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
