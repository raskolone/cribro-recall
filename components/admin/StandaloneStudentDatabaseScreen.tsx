import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { User } from '../../types';
import { StudentDatabaseScreen } from './StudentDatabaseScreen';
import { useFirebaseAdminApi } from '../../hooks/useFirebaseAdminApi';
import { useLanguage } from '../../context/LanguageContext';
import { ArrowLeft, Database, Plus, X, Copy, Check } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';

interface StandaloneStudentDatabaseScreenProps {
  onSelectUser: (userId: string, targetTab?: string) => void;
  onOpenMailing: () => void;
  onBack: () => void;
}

export const StandaloneStudentDatabaseScreen: React.FC<StandaloneStudentDatabaseScreenProps> = ({
  onSelectUser,
  onOpenMailing,
  onBack,
}) => {
  const { language } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { createUser, changeUserEmail, deleteUser, changeUserRole } = useFirebaseAdminApi();

  // Create Student Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isAutoPassword, setIsAutoPassword] = useState(true);
  const [customPassword, setCustomPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const list: User[] = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as User))
        .filter((u) => u.username !== 'Demo User' && u.username !== 'Demo User (Offline)');

      list.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setUsers(list);
    } catch (e) {
      console.error('Błąd podczas ładowania użytkowników:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateUserRole = async (targetUser: User, newRole: 'admin' | 'user' | 'teacher') => {
    if (!targetUser.id) return;
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u)));
    } catch (e: any) {
      console.error('Błąd zmiany roli:', e);
      alert('Błąd podczas zmiany roli: ' + (e.message || String(e)));
    }
  };

  const handleUpdateUserEmail = async (userId: string, newEmailToSet: string) => {
    if (!userId) return;
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { email: newEmailToSet });
      changeUserEmail(userId, newEmailToSet).catch((err) => {
        console.warn('[Admin Auth Email Sync Warning]:', err);
      });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, email: newEmailToSet } : u)));
    } catch (e: any) {
      console.error('Błąd zmiany emaila:', e);
      alert('Błąd podczas zmiany adresu e-mail: ' + (e.message || String(e)));
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!userId) return;
    try {
      try {
        await deleteUser(userId);
      } catch (authErr) {
        console.warn(`Auth delete warning for ${userId}:`, authErr);
      }
      await deleteDoc(doc(db, 'users', userId));
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (e: any) {
      console.error('Błąd usuwania użytkownika:', e);
      throw e;
    }
  };

  const handleBulkDeleteUsers = async (userIds: string[]) => {
    if (!userIds.length) return;
    for (const userId of userIds) {
      try {
        await deleteUser(userId);
      } catch (authErr) {
        console.warn(`Auth delete warning for ${userId}:`, authErr);
      }
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (dbErr) {
        console.error(`Firestore delete error for ${userId}:`, dbErr);
      }
    }
    setUsers((prev) => prev.filter((u) => !userIds.includes(u.id)));
  };

  const handleBulkUpdateUsers = async (userIds: string[], updates: Partial<User>) => {
    if (!userIds.length || Object.keys(updates).length === 0) return;
    for (const userId of userIds) {
      try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, updates);
        if (updates.role) {
          try {
            await changeUserRole(userId, updates.role);
          } catch (authErr) {
            console.warn(`Auth role update warning for ${userId}:`, authErr);
          }
        }
      } catch (err) {
        console.error(`Błąd masowej aktualizacji użytkownika ${userId}:`, err);
      }
    }
    setUsers((prev) =>
      prev.map((u) => (userIds.includes(u.id) ? { ...u, ...updates } : u))
    );
  };

  const normalizeUsername = (u: string) =>
    u.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '.').toLowerCase();

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      setCreateError('Podaj imię i nazwisko lub login kursanta.');
      return;
    }

    setIsCreating(true);
    setCreateError('');
    try {
      const trimmedEmail = newEmail.trim().toLowerCase();
      if (trimmedEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
          throw new Error('Podano niepoprawny format adresu e-mail.');
        }
      }

      const finalEmail = trimmedEmail || `${normalizeUsername(newUsername)}@student.vocabboost.com`;
      const finalPassword = isAutoPassword ? Math.random().toString(36).slice(-8) : customPassword;

      if (!isAutoPassword && finalPassword.length < 6) {
        throw new Error('Hasło musi mieć co najmniej 6 znaków.');
      }

      const userRecord = await createUser(finalEmail, finalPassword, 'user');

      const newUserDoc = {
        email: finalEmail,
        username: newUsername.trim(),
        role: 'user',
        createdAt: new Date().toISOString(),
        loginCount: 0,
        streakCount: 0,
        requirePasswordChange: true,
        tempPassword: finalPassword,
      };

      await setDoc(doc(db, 'users', userRecord.uid), newUserDoc);
      setCreatedCredentials({ email: finalEmail, password: finalPassword });
      fetchUsers();
    } catch (err: any) {
      setCreateError(err.message || 'Wystąpił błąd podczas tworzenia kursanta.');
    } finally {
      setIsCreating(false);
    }
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setNewUsername('');
    setNewEmail('');
    setCustomPassword('');
    setIsAutoPassword(true);
    setCreateError('');
    setCreatedCredentials(null);
    setCopied(false);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6 animate-fadeIn pb-24">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-base-200/60 border border-white/10 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-base-100/80 hover:bg-primary/20 text-content-muted hover:text-primary border border-white/10 transition-colors cursor-pointer"
            title="Powrót do Panelu Nauczyciela"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
                <Database className="text-primary w-6 h-6" />
                <span>Baza kursantów</span>
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-mono">
                Baza danych
              </span>
            </div>
            <p className="text-xs text-content-muted mt-1">
              Pełny przegląd kont, uprawnień, adresów e-mail oraz synchronizacja danych
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="bg-primary text-black font-bold flex items-center gap-1.5 shadow-btn hover:brightness-110"
          >
            <Plus size={16} />
            Dodaj kursanta
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onBack}
            className="border-white/15 hover:border-primary/40 text-xs sm:text-sm"
          >
            Wróć do Teacher Panel
          </Button>
        </div>
      </div>

      {/* Main Database Screen */}
      <div className="bg-base-200/40 border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl">
        <StudentDatabaseScreen
          users={users}
          onSelectUser={(user, targetTab) => {
            onSelectUser(user.id, targetTab || 'profile');
          }}
          onUpdateUserRole={handleUpdateUserRole}
          onUpdateUserEmail={handleUpdateUserEmail}
          onDeleteUser={handleDeleteUser}
          onBulkDeleteUsers={handleBulkDeleteUsers}
          onBulkUpdateUsers={handleBulkUpdateUsers}
          onRefreshUsers={fetchUsers}
          onAddNewStudent={() => setShowCreateModal(true)}
          onOpenMailing={onOpenMailing}
          onBack={onBack}
        />
      </div>

      {/* Modal: Dodaj Kursanta */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md">
            <Card className="w-full shadow-2xl border-primary/20 bg-base-200">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus size={18} className="text-primary" />
                  <span>Dodaj nowego kursanta</span>
                </h3>
                <button
                  onClick={closeCreateModal}
                  className="p-1.5 text-content-muted hover:text-text-hi rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {!createdCredentials ? (
                <form onSubmit={handleCreateStudent} className="space-y-4">
                  {createError && (
                    <div className="p-3 bg-danger/10 border border-danger/30 text-danger rounded-xl text-xs font-semibold">
                      {createError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-content-muted mb-1">
                      Imię i nazwisko lub login kursanta *
                    </label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="np. Anna Nowak"
                      required
                      className="w-full bg-base-100 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-content-muted mb-1">
                      Adres e-mail (opcjonalny)
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="np. anna.nowak@gmail.com"
                      className="w-full bg-base-100 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:border-primary focus:outline-none font-mono"
                    />
                    <p className="text-[11px] text-content-muted mt-1">
                      Wprowadź adres, na który kursant ma otrzymywać powiadomienia i lekcje. Jeśli puste, konto otrzyma login @student.vocabboost.com.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-content-muted mb-2">Hasło dostępu</label>
                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="pwdMode"
                          checked={isAutoPassword}
                          onChange={() => setIsAutoPassword(true)}
                          className="accent-primary"
                        />
                        <span>Wygeneruj losowe</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="pwdMode"
                          checked={!isAutoPassword}
                          onChange={() => setIsAutoPassword(false)}
                          className="accent-primary"
                        />
                        <span>Wpisz własne</span>
                      </label>
                    </div>
                  </div>

                  {!isAutoPassword && (
                    <div>
                      <input
                        type="text"
                        value={customPassword}
                        onChange={(e) => setCustomPassword(e.target.value)}
                        placeholder="Minimum 6 znaków"
                        minLength={6}
                        required
                        className="w-full bg-base-100 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:border-primary focus:outline-none font-mono"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                    <Button type="button" variant="secondary" onClick={closeCreateModal}>
                      Anuluj
                    </Button>
                    <Button type="submit" disabled={isCreating} className="bg-primary text-black font-bold">
                      {isCreating ? 'Tworzenie...' : 'Utwórz konto kursanta'}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="p-4 bg-primary/10 border border-primary/30 rounded-2xl text-center space-y-2">
                    <div className="text-primary font-bold text-base">Konto zostało utworzone!</div>
                    <div className="text-xs text-content-muted">Adres e-mail / Login:</div>
                    <div className="font-mono text-sm font-bold text-white break-all">{createdCredentials.email}</div>
                    <div className="text-xs text-content-muted mt-2">Hasło:</div>
                    <div className="font-mono text-base font-bold text-primary bg-base-100 p-2 rounded-xl border border-white/10 inline-flex items-center gap-2">
                      <span>{createdCredentials.password}</span>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              `Login: ${createdCredentials.email}\nHasło: ${createdCredentials.password}`
                            );
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          } catch (e) {}
                        }}
                        className="p-1 rounded bg-primary/20 text-primary hover:bg-primary/30 text-xs flex items-center gap-1 cursor-pointer"
                        title="Skopiuj dane logowania"
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copied ? 'Skopiowano' : 'Kopiuj'}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-warn mt-2">
                      Skopiuj powyższe dane logowania i przekaż je kursantowi.
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={closeCreateModal} className="bg-primary text-black font-bold">
                      Gotowe
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default StandaloneStudentDatabaseScreen;
