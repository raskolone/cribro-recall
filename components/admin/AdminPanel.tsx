import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, query, orderBy, setDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
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

  useEffect(() => {
    fetchUsers();
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
        <Card className="lg:col-span-1 h-[calc(100vh-12rem)] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">Students</h2>
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
                    <button 
                      onClick={(e) => { e.stopPropagation(); setUserToDelete(user.id); }}
                      className="text-red-500 hover:text-red-400 p-1"
                      title="Delete User"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
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
                      <Button onClick={() => setShowAssignModal(true)} isLoading={isAssigningSet}>
                        Assign Word Set
                      </Button>
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
                Delete User
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;
