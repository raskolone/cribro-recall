import React, { useState, useEffect, useMemo, useRef } from 'react';
import { doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { User, LessonRecord } from '../../types';
import { getAllUsers, updateCachedUser, addCachedUser, removeCachedUser, UserWithId } from '../../services/userService';
import { useFirebaseAdminApi } from '../../hooks/useFirebaseAdminApi';
import { useLanguage } from '../../context/LanguageContext';
import { openScratchpadTab } from '../../services/scratchpadService';
import { createLessonRecordWithVocabularySet, getAllLessonRecordsForTeacher } from '../../services/lessonRecord';
import { parseStudentDocument, SUPPORTED_STUDENT_IMPORT_EXTENSIONS } from '../../services/studentImportService';
import { confirmAsync } from '../../utils/appAlert';
import { StudentImportAnalysis } from '../../types/studentImport';
import { GroupsManager } from './GroupsManager';
import StudentInviteEmailModal from './StudentInviteEmailModal';
import StudentImportReviewCard from './StudentImportReviewCard';
import StudentCard from './StudentCard';
import Card from '../ui/Card';
import Button from '../ui/Button';
import {
  ArrowLeft,
  Database,
  Plus,
  X,
  Copy,
  Check,
  Users,
  User as UserIcon,
  Search,
  Filter,
  Building,
  Mail,
  GraduationCap,
  Briefcase,
  Layers,
  ArrowRight,
  Sparkles,
  Edit2,
  BookOpen,
  FileText,
  Send,
  CheckCircle2,
  Clock,
  ChevronRight,
  RefreshCw,
  Trash2,
  UploadCloud,
  Shield,
  Key,
  Lock,
  ExternalLink,
  FileEdit,
  ClipboardList,
  CheckSquare,
  Square,
  MinusSquare,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Table,
  ArrowDownAZ
} from 'lucide-react';
import { useEscapeModal } from '../../hooks/useEscapeModal';

interface StandaloneStudentDatabaseScreenProps {
  onSelectUser: (userId: string, targetTab?: string) => void;
  onOpenMailing?: () => void;
  onBack: () => void;
  initialUsers?: User[];
  initialLessons?: LessonRecord[];
  onRefreshUsers?: () => Promise<void> | void;
}

type TabFilter = 'all' | 'active' | 'individual' | 'group';

export const StandaloneStudentDatabaseScreen: React.FC<StandaloneStudentDatabaseScreenProps> = ({
  onSelectUser,
  onOpenMailing,
  onBack,
  initialUsers,
  initialLessons,
  onRefreshUsers,
}) => {
  const { language } = useLanguage();
  const [users, setUsers] = useState<User[]>(initialUsers || []);
  const [lessons, setLessons] = useState<LessonRecord[]>(initialLessons || []);
  const [isLoading, setIsLoading] = useState(!initialUsers || initialUsers.length === 0);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<number | 'all'>(12);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [sortBy, setSortBy] = useState<'activity' | 'alphabetical'>('activity');

  // Modals & Dropdown state
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const addDropdownRef = useRef<HTMLDivElement>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<User | null>(null);
  const [inviteStudent, setInviteStudent] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isAutoPassword, setIsAutoPassword] = useState(true);
  const [customPassword, setCustomPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);
  const [copiedPasswordId, setCopiedPasswordId] = useState<string | null>(null);
  const [isUpdatingInviteId, setIsUpdatingInviteId] = useState<string | null>(null);

  // Smart Student Onboarding: import kursanta z pliku (.txt/.md/.pdf)
  const [importAnalysis, setImportAnalysis] = useState<StudentImportAnalysis | null>(null);
  const [isAnalyzingImport, setIsAnalyzingImport] = useState(false);
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [importDragActive, setImportDragActive] = useState(false);
  const [importError, setImportError] = useState('');

  const handleCopyPassword = (studentId: string, pass: string) => {
    navigator.clipboard.writeText(pass);
    setCopiedPasswordId(studentId);
    setTimeout(() => setCopiedPasswordId(null), 2000);
  };

  const handleToggleInvitation = async (student: User) => {
    if (!student.id) return;
    const isSent = Boolean(student.invitationSent || student.lastInviteSentAt);
    const newStatus = !isSent;
    const nowIso = new Date().toISOString();
    const updates: Partial<User> = {
      invitationSent: newStatus,
      ...(newStatus ? { invitationSentAt: nowIso } : {}),
    };
    setIsUpdatingInviteId(student.id);
    try {
      await updateDoc(doc(db, 'users', student.id), updates as any);
      updateCachedUser(student.id, updates);
      setUsers((prev) =>
        prev.map((u) => (u.id === student.id ? { ...u, ...updates } : u))
      );
    } catch (err) {
      console.error('Failed to toggle invitation:', err);
    } finally {
      setIsUpdatingInviteId(null);
    }
  };

  // Bulk actions dropdown state
  const [bulkLevel, setBulkLevel] = useState<string>('');
  const [bulkContractor, setBulkContractor] = useState<string>('');
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const { createUser, changeUserEmail, deleteUser, changeUserRole } = useFirebaseAdminApi();

  useEscapeModal(showCreateModal, () => setShowCreateModal(false), 5);

  const fetchUsersAndLessons = async (force = false) => {
    try {
      setIsLoading(true);
      const list = await getAllUsers(force);
      setUsers(list);

      // Fetch recent lessons to populate last lesson column
      try {
        const allLessons = await getAllLessonRecordsForTeacher(list, force);
        setLessons(allLessons);
      } catch (err) {
        console.warn('Could not fetch lesson records:', err);
      }
    } catch (e) {
      console.error('Błąd podczas ładowania użytkowników:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) {
        setIsAddDropdownOpen(false);
      }
    };
    if (isAddDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isAddDropdownOpen]);

  useEffect(() => {
    if (initialUsers && initialUsers.length > 0) {
      setUsers(initialUsers);
      if (initialLessons && initialLessons.length > 0) {
        setLessons(initialLessons);
      }
      setIsLoading(false);
      return;
    }
    fetchUsersAndLessons();
  }, [initialUsers, initialLessons]);

  const handleManualRefresh = async () => {
    setIsLoading(true);
    if (onRefreshUsers) {
      await onRefreshUsers();
    }
    await fetchUsersAndLessons(true);
  };

  // Helper to get recent lesson for a user/group
  const getRecentLesson = (student: User) => {
    const sId = student.id;
    if (!sId) return null;
    const userLessons = lessons.filter((l) => l.studentId === sId || (l.studentIds && l.studentIds.includes(sId)));
    if (userLessons.length === 0) return null;
    return userLessons.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  };

  // Filter & Sort users based on active tab, search query, and sortBy
  const filteredUsers = useMemo(() => {
    const list = users.filter((s) => {
      // Role filter - only students & groups (exclude pure admins/teachers unless taking lessons)
      if (s.role === 'admin' && !s.isGroup && !s.level) return false;

      // Tab filter
      if (activeTab === 'individual' && (s.isGroup || s.lessonType === 'Group')) return false;
      if (activeTab === 'group' && !(s.isGroup || s.lessonType === 'Group')) return false;
      if (activeTab === 'active' && (s.isSuspended || s.isArchived || s.statusWspolpracy === 'Nieaktywny')) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (s.displayName || s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.username).toLowerCase();
        const email = (s.email || '').toLowerCase();
        const company = (s.company || '').toLowerCase();
        const level = (s.level || '').toLowerCase();
        const contractor = (s.contractor || '').toLowerCase();
        return name.includes(q) || email.includes(q) || company.includes(q) || level.includes(q) || contractor.includes(q);
      }

      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'alphabetical') {
        const nameA = a.displayName || a.name || `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.username || '';
        const nameB = b.displayName || b.name || `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.username || '';
        return nameA.localeCompare(nameB, 'pl', { sensitivity: 'base' });
      }

      // 'activity' (default) - najświeższa data lekcji lub data utworzenia
      const recentA = getRecentLesson(a);
      const recentB = getRecentLesson(b);
      const timeA = recentA?.date ? new Date(recentA.date).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = recentB?.date ? new Date(recentB.date).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      if (timeB !== timeA) return timeB - timeA;
      const nameA = a.displayName || a.name || a.username || '';
      const nameB = b.displayName || b.name || b.username || '';
      return nameA.localeCompare(nameB, 'pl');
    });
  }, [users, lessons, activeTab, searchQuery, sortBy]);

  // Selection handlers
  const handleToggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const visibleIds = filteredUsers.map((u) => u.id).filter(Boolean) as string[];
    const allSelected = visibleIds.every((id) => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Bulk operations
  const handleBulkApplyLevel = async (level: string) => {
    if (!selectedUserIds.length || !level) return;
    setIsBulkUpdating(true);
    try {
      for (const userId of selectedUserIds) {
        await updateDoc(doc(db, 'users', userId), { level });
        updateCachedUser(userId, { level });
      }
      setUsers((prev) =>
        prev.map((u) => (selectedUserIds.includes(u.id) ? { ...u, level } : u))
      );
      setBulkLevel('');
    } catch (e) {
      console.error('Błąd masowej zmiany poziomu:', e);
      alert('Nie udało się zaktualizować poziomu dla zaznaczonych kursantów.');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkApplyContractor = async (contractor: string) => {
    if (!selectedUserIds.length || !contractor) return;
    setIsBulkUpdating(true);
    try {
      for (const userId of selectedUserIds) {
        await updateDoc(doc(db, 'users', userId), { contractor });
        updateCachedUser(userId, { contractor });
      }
      setUsers((prev) =>
        prev.map((u) => (selectedUserIds.includes(u.id) ? { ...u, contractor } : u))
      );
      setBulkContractor('');
    } catch (e) {
      console.error('Błąd masowej zmiany kontraktora:', e);
      alert('Nie udało się zaktualizować kontraktora.');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkApplyStatus = async (statusVal: string) => {
    if (!selectedUserIds.length || !statusVal) return;
    setIsBulkUpdating(true);
    try {
      const isSuspended = statusVal === 'suspended';
      const isArchived = statusVal === 'archived';
      const statusWspolpracy: 'Aktywny' | 'Nieaktywny' = statusVal === 'inactive' ? 'Nieaktywny' : 'Aktywny';

      for (const userId of selectedUserIds) {
        const updates: Partial<User> = { isSuspended, isArchived, statusWspolpracy };
        await updateDoc(doc(db, 'users', userId), updates);
        updateCachedUser(userId, updates);
      }
      setUsers((prev) =>
        prev.map((u) =>
          selectedUserIds.includes(u.id)
            ? { ...u, isSuspended, isArchived, statusWspolpracy }
            : u
        )
      );
      setBulkStatus('');
    } catch (e) {
      console.error('Błąd masowej zmiany statusu:', e);
      alert('Nie udało się zaktualizować statusu.');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedUserIds.length) return;
    if (
      !(await confirmAsync(
        `Czy na pewno chcesz bezpowrotnie usunąć ${selectedUserIds.length} zaznaczonych kont?`
      ))
    ) {
      return;
    }

    setIsBulkUpdating(true);
    try {
      for (const userId of selectedUserIds) {
        try {
          await deleteUser(userId);
        } catch (err) {
          console.warn('Auth delete error:', err);
        }
        try {
          await deleteDoc(doc(db, 'users', userId));
        } catch (err) {
          console.error('Firestore delete error:', err);
        }
      }
      setUsers((prev) => prev.filter((u) => !selectedUserIds.includes(u.id)));
      setSelectedUserIds([]);
    } catch (e) {
      console.error('Błąd masowego usuwania:', e);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Single user operations
  const handleDeleteSingleUser = async (user: User) => {
    const sName = user.displayName || user.name || user.username;
    if (!(await confirmAsync(`Czy na pewno chcesz usunąć konto ${sName}?`))) return;

    try {
      if (user.id) {
        try {
          await deleteUser(user.id);
        } catch (err) {
          console.warn('Auth delete warning:', err);
        }
        await deleteDoc(doc(db, 'users', user.id));
        removeCachedUser(user.id);
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
      }
    } catch (e) {
      console.error('Błąd usuwania użytkownika:', e);
      alert('Wystąpił błąd podczas usuwania konta.');
    }
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

      const nameParts = newUsername.trim().split(' ');
      const firstName = nameParts[0] || newUsername.trim();
      const lastName = nameParts.slice(1).join(' ') || '';

      const newUserDoc = {
        email: finalEmail,
        username: newUsername.trim(),
        displayName: newUsername.trim(),
        firstName,
        lastName,
        role: 'user' as const,
        createdAt: new Date().toISOString(),
        loginCount: 0,
        streakCount: 0,
        requirePasswordChange: true,
        tempPassword: finalPassword,
        statusWspolpracy: 'Aktywny' as const,
      };

      const userRecord = await createUser(finalEmail, finalPassword, 'user', newUserDoc);

      // Bezpieczna synchronizacja po stronie klienta (dokument jest już utworzony przez Admin API)
      try {
        await setDoc(doc(db, 'users', userRecord.uid), newUserDoc, { merge: true });
      } catch (clientErr) {
        console.warn('[CRM] Klient pominął bezpośredni setDoc (zapisany przez Admin API):', clientErr);
      }

      addCachedUser({ id: userRecord.uid, ...newUserDoc } as UserWithId);
      setCreatedCredentials({ email: finalEmail, password: finalPassword });
      fetchUsersAndLessons(true);
      onRefreshUsers?.();
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
    setCopiedCreds(false);
    setImportAnalysis(null);
    setImportError('');
    setIsAnalyzingImport(false);
  };

  const handleImportFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!SUPPORTED_STUDENT_IMPORT_EXTENSIONS.includes(ext)) {
      setImportError('Obsługiwane formaty: .txt, .md, .pdf');
      return;
    }
    setImportError('');
    setIsAnalyzingImport(true);
    try {
      const analysis = await parseStudentDocument(file);
      setImportAnalysis(analysis);
    } catch (err: any) {
      setImportError(err.message || 'Nie udało się przeanalizować pliku.');
    } finally {
      setIsAnalyzingImport(false);
    }
  };

  const handleImportLessonDateChange = (index: number, date: string) => {
    setImportAnalysis((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        extractedData: {
          ...prev.extractedData,
          historicalLessons: prev.extractedData.historicalLessons.map((lesson, i) =>
            i === index ? { ...lesson, date, dateAmbiguous: false } : lesson
          ),
        },
      };
    });
  };

  const handleConfirmImport = async () => {
    if (!importAnalysis) return;
    const { extractedData } = importAnalysis;
    const fullName = (extractedData.fullName || '').trim();
    const trimmedEmail = (extractedData.email || '').trim().toLowerCase();

    if (!fullName || !trimmedEmail) {
      setImportError('Uzupełnij imię i nazwisko oraz e-mail przed zatwierdzeniem.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setImportError('Podano niepoprawny format adresu e-mail.');
      return;
    }

    setIsSavingImport(true);
    setImportError('');
    try {
      const finalPassword = Math.random().toString(36).slice(-8);
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || fullName;
      const lastName = nameParts.slice(1).join(' ') || '';

      const noteLines = [
        extractedData.targetGoals ? `Cele nauki: ${extractedData.targetGoals}` : '',
        extractedData.industry ? `Branża: ${extractedData.industry}` : '',
        extractedData.generalNotes || '',
      ].filter(Boolean);

      const newUserDoc = {
        email: trimmedEmail,
        username: fullName,
        displayName: fullName,
        firstName,
        lastName,
        role: 'user' as const,
        createdAt: new Date().toISOString(),
        loginCount: 0,
        streakCount: 0,
        requirePasswordChange: true,
        tempPassword: finalPassword,
        statusWspolpracy: 'Aktywny' as const,
        ...(extractedData.level ? { level: extractedData.level } : {}),
        ...(noteLines.length ? { description: noteLines.join('\n') } : {}),
      };

      const userRecord = await createUser(trimmedEmail, finalPassword, 'user', newUserDoc);

      try {
        await setDoc(doc(db, 'users', userRecord.uid), newUserDoc, { merge: true });
      } catch (clientErr) {
        console.warn('[CRM] Klient pominął bezpośredni setDoc (zapisany przez Admin API):', clientErr);
      }

      addCachedUser({ id: userRecord.uid, ...newUserDoc } as UserWithId);

      for (const lesson of extractedData.historicalLessons) {
        try {
          await createLessonRecordWithVocabularySet({
            studentId: userRecord.uid,
            date: lesson.date,
            topic: lesson.summary.slice(0, 120) || 'Lekcja zaimportowana',
            vocabularyText: lesson.vocabulary.join('\n'),
            lessonSummary: lesson.summary,
            corrections: lesson.corrections.join('\n'),
          });
        } catch (lessonErr) {
          console.warn('[Smart Import] Nie udało się zapisać zaimportowanej lekcji:', lessonErr);
        }
      }

      setImportAnalysis(null);
      setCreatedCredentials({ email: trimmedEmail, password: finalPassword });
      fetchUsersAndLessons(true);
      onRefreshUsers?.();
    } catch (err: any) {
      setImportError(err.message || 'Wystąpił błąd podczas tworzenia kursanta.');
    } finally {
      setIsSavingImport(false);
    }
  };

  const handleCopyEmail = (emailStr?: string) => {
    if (!emailStr) return;
    navigator.clipboard.writeText(emailStr);
    setCopiedEmail(emailStr);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const isAllFilteredSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((u) => u.id && selectedUserIds.includes(u.id));
  const isIndeterminate =
    selectedUserIds.length > 0 && !isAllFilteredSelected;

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 animate-fadeIn pb-28">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-base-200/70 border border-line-strong shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-line-soft hover:bg-primary/20 text-content-muted hover:text-primary border border-line-strong transition-colors cursor-pointer shrink-0"
            title="Wróć do głównego panelu"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-text-hi flex items-center gap-2">
                <Users className="text-primary w-6 h-6" />
                <span>Moi kursanci & Grupy (CRM)</span>
              </h1>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                {filteredUsers.length} {filteredUsers.length === 1 ? 'rekord' : 'rekordów'}
              </span>
            </div>
            <p className="text-xs text-content-muted mt-0.5">
              Zunifikowana baza kursantów indywidualnych oraz grup zajęciowych — profile, historia lekcji i zarządzanie
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="text-xs flex items-center gap-1.5 py-2 px-3.5 bg-line-soft hover:bg-line text-text-hi font-semibold rounded-xl border border-line-strong transition-colors cursor-pointer"
            title="Odśwież dane kursantów z bazy"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin text-primary" : "text-primary"} />
            <span>Odśwież</span>
          </Button>

          {/* Rozwijane menu + Dodaj */}
          <div className="relative" ref={addDropdownRef}>
            <Button
              size="sm"
              onClick={() => setIsAddDropdownOpen((prev) => !prev)}
              className="text-xs flex items-center gap-1.5 py-2 px-3.5 bg-primary hover:bg-primary/90 text-accent-ink font-bold rounded-xl shadow-btn cursor-pointer"
              title="Dodaj nowego kursanta lub grupę"
            >
              <Plus size={15} />
              <span>+ Dodaj</span>
              <ChevronDown size={13} className={`transition-transform duration-200 ${isAddDropdownOpen ? 'rotate-180' : ''}`} />
            </Button>

            {isAddDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-ink-2/98 backdrop-blur-xl border border-line-strong shadow-ambient-lg p-1.5 z-50 animate-fadeIn">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddDropdownOpen(false);
                    setShowCreateModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-text-hi hover:bg-base-100 hover:text-primary transition-colors text-left cursor-pointer"
                >
                  <UserIcon size={14} className="text-primary" />
                  <span>Nowy kursant</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddDropdownOpen(false);
                    setEditingGroup(null);
                    setIsGroupModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-text-hi hover:bg-base-100 hover:text-purple-400 transition-colors text-left cursor-pointer"
                >
                  <Users size={14} className="text-purple-400" />
                  <span>Nowa grupa</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notion Database Tabs & Search Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pb-2 border-b border-line-strong">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs font-medium">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'all'
                ? 'bg-line-soft text-text-hi font-bold border border-line-strong shadow-sm'
                : 'text-content-muted hover:text-text-hi hover:bg-line-soft/50'
            }`}
          >
            <Layers size={13} />
            Wszyscy
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'active'
                ? 'bg-primary/20 text-primary font-bold border border-primary/30 shadow-sm'
                : 'text-content-muted hover:text-text-hi hover:bg-line-soft/50'
            }`}
          >
            <CheckCircle2 size={13} />
            Aktywni
          </button>

          <button
            onClick={() => setActiveTab('individual')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'individual'
                ? 'bg-sky-500/20 text-sky-800 dark:text-sky-300 font-bold border border-sky-500/30 shadow-sm'
                : 'text-content-muted hover:text-text-hi hover:bg-line-soft/50'
            }`}
          >
            <UserIcon size={13} />
            Indywidualni (1:1)
          </button>

          <button
            onClick={() => setActiveTab('group')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'group'
                ? 'bg-purple-500/20 text-purple-800 dark:text-purple-300 font-bold border border-purple-500/30 shadow-sm'
                : 'text-content-muted hover:text-text-hi hover:bg-line-soft/50'
            }`}
          >
            <Users size={13} />
            Grupy & Pary
          </button>
        </div>

        {/* Search, Sort & View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] sm:min-w-[240px] flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj kursanta, firmy, poziomu..."
              className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-base-200/80 border border-line-strong text-text-hi text-xs placeholder:text-content-muted/60 focus:outline-none focus:border-primary transition-all"
            />
          </div>

          {/* Przełącznik sortowania: Aktywność vs Alfabet */}
          <div className="flex items-center p-1 rounded-xl bg-base-200/80 border border-line-strong shrink-0" title="Sortuj listę">
            <button
              type="button"
              onClick={() => setSortBy('activity')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                sortBy === 'activity'
                  ? 'bg-primary text-accent-ink shadow-sm font-bold'
                  : 'text-content-muted hover:text-text-hi hover:bg-line-soft/60'
              }`}
              title="Sortuj wg ostatniej aktywności lekcyjnej"
              aria-label="Ostatnia aktywność"
            >
              <Clock size={13} />
              <span className="hidden sm:inline text-[11px]">Aktywność</span>
            </button>
            <button
              type="button"
              onClick={() => setSortBy('alphabetical')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                sortBy === 'alphabetical'
                  ? 'bg-primary text-accent-ink shadow-sm font-bold'
                  : 'text-content-muted hover:text-text-hi hover:bg-line-soft/60'
              }`}
              title="Sortuj alfabetycznie (A-Z)"
              aria-label="Alfabetycznie"
            >
              <ArrowDownAZ size={13} />
              <span className="hidden sm:inline text-[11px]">A-Z</span>
            </button>
          </div>

          {/* Dyskretny przełącznik widoku: Kafelki / Tabela administracyjna */}
          <div className="flex items-center p-1 rounded-xl bg-base-200/80 border border-line-strong shrink-0" title="Przełącz widok: Kafelki lub Tabela administracyjna">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'cards'
                  ? 'bg-primary text-accent-ink shadow-sm'
                  : 'text-content-muted hover:text-text-hi hover:bg-line-soft/60'
              }`}
              title="Widok kafelkowy (Domyślny)"
              aria-label="Widok kafelkowy"
            >
              <LayoutGrid size={15} />
              <span className="hidden lg:inline text-[11px]">Kafelki</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-primary text-accent-ink shadow-sm'
                  : 'text-content-muted hover:text-text-hi hover:bg-line-soft/60'
              }`}
              title="Widok tabeli administracyjnej"
              aria-label="Widok tabeli administracyjnej"
            >
              <Table size={15} />
              <span className="hidden lg:inline text-[11px]">Tabela</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bulk Actions Bar */}
      {selectedUserIds.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-base-300/90 border border-primary/40 shadow-2xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-bold text-text-hi">
              Zaznaczono <span className="text-primary font-mono">{selectedUserIds.length}</span> kont
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Zmień poziom */}
            <select
              value={bulkLevel}
              onChange={(e) => {
                setBulkLevel(e.target.value);
                if (e.target.value) handleBulkApplyLevel(e.target.value);
              }}
              disabled={isBulkUpdating}
              className="px-2.5 py-1.5 rounded-xl bg-base-200 border border-line-strong text-text-hi text-xs focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="">Zmień poziom...</option>
              <option value="A1">A1 (Beginner)</option>
              <option value="A2">A2 (Elementary)</option>
              <option value="A2/B1">A2/B1 (Pre-Int)</option>
              <option value="B1">B1 (Intermediate)</option>
              <option value="B1/B2">B1/B2 (Upper-Int)</option>
              <option value="B2">B2 (Upper-Int)</option>
              <option value="B2/C1">B2/C1 (Advanced)</option>
              <option value="C1">C1 (Advanced)</option>
              <option value="C2">C2 (Mastery)</option>
            </select>

            {/* Zmień kontraktora */}
            <select
              value={bulkContractor}
              onChange={(e) => {
                setBulkContractor(e.target.value);
                if (e.target.value) handleBulkApplyContractor(e.target.value);
              }}
              disabled={isBulkUpdating}
              className="px-2.5 py-1.5 rounded-xl bg-base-200 border border-line-strong text-text-hi text-xs focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="">Zmień kontraktora...</option>
              <option value="JCL">JCL</option>
              <option value="Inspiro">Inspiro</option>
              <option value="Axell">Axell</option>
              <option value="Direct">Direct</option>
            </select>

            {/* Zmień status */}
            <select
              value={bulkStatus}
              onChange={(e) => {
                setBulkStatus(e.target.value);
                if (e.target.value) handleBulkApplyStatus(e.target.value);
              }}
              disabled={isBulkUpdating}
              className="px-2.5 py-1.5 rounded-xl bg-base-200 border border-line-strong text-text-hi text-xs focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="">Zmień status...</option>
              <option value="active">Aktywny</option>
              <option value="inactive">Nieaktywny</option>
              <option value="suspended">Zawieszony</option>
              <option value="archived">Zarchiwizowany</option>
            </select>

            {/* Usuń zaznaczonych */}
            <button
              onClick={handleBulkDelete}
              disabled={isBulkUpdating}
              className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold border border-rose-500/40 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 size={13} />
              Usuń zaznaczone
            </button>

            {/* Odznacz */}
            <button
              onClick={() => setSelectedUserIds([])}
              className="px-2.5 py-1.5 rounded-xl text-content-muted hover:text-text-hi transition-colors"
            >
              Odznacz
            </button>
          </div>
        </div>
      )}

      {/* ── CRM CONTENT: CARDS VIEW LUB NOTION TABLE ── */}
      {viewMode === 'cards' ? (
        <div className="space-y-6">
          {filteredUsers.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-line-strong bg-base-200/50">
              <Users size={34} className="mx-auto mb-2 opacity-30 text-content-muted" />
              <p className="font-semibold text-text-hi text-base">Nie znaleziono kursantów ani grup</p>
              <p className="text-xs text-content-muted mt-1">
                Zmień filtr lub dodaj nowego kursanta / grupę do bazy.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {(isExpanded || pageSize === 'all'
                ? filteredUsers
                : filteredUsers.slice(0, typeof pageSize === 'number' ? pageSize : 12)
              ).map((student) => (
                <StudentCard
                  key={student.id || student.username}
                  student={student}
                  isSelected={selectedUserIds.includes(student.id || '')}
                  onSelect={onSelectUser}
                  onToggleSelect={handleToggleSelectUser}
                  onOpenScratchpad={(id, isGrp) => {
                    onSelectUser(id, 'scratchpad');
                    openScratchpadTab(isGrp ? `sp_group_${id}` : `sp_${id}`);
                  }}
                />
              ))}
            </div>
          )}

          {/* Pasek rozwijania / limit kafelków */}
          {filteredUsers.length > (typeof pageSize === 'number' ? pageSize : 12) && (
            <div className="p-3.5 border-t border-line-strong/60 bg-base-100/50 flex items-center justify-center rounded-2xl">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="px-4 py-2 rounded-xl bg-line-soft hover:bg-line-soft/80 border border-line-strong text-xs font-bold text-content-muted hover:text-text-hi transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:border-primary/40"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp size={15} className="text-primary" />
                    <span>Zwiń listę kafelków</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={15} className="text-primary" />
                    <span>Pokaż wszystkich ({filteredUsers.length} pozycji)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Notion Styled CRM Table */
        <div className="rounded-2xl border border-line-strong bg-base-200/50 backdrop-blur-md overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-content-muted border-collapse">
              <thead>
                <tr className="border-b border-line-strong bg-base-300/70 font-semibold text-content uppercase tracking-wider text-[10px]">
                  {/* Select All Checkbox */}
                  <th className="py-3 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="p-1 rounded text-content-muted hover:text-primary transition-colors cursor-pointer"
                      title={isAllFilteredSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie widoczne'}
                    >
                      {isAllFilteredSelected ? (
                        <CheckSquare size={16} className="text-primary" />
                      ) : isIndeterminate ? (
                        <MinusSquare size={16} className="text-primary" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 min-w-[200px]">Nazwa</th>
                  <th className="py-3 px-3 min-w-[90px]">Typ</th>
                  <th className="py-3 px-3 min-w-[150px]">Poziom / Profil</th>
                  <th className="py-3 px-3 min-w-[180px]">Adresy e-mail & Hasło</th>
                  <th className="py-3 px-3 min-w-[170px]">Zaproszenie & Aktywacja</th>
                  <th className="py-3 px-3 min-w-[95px]">Kontraktor</th>
                  <th className="py-3 px-3 min-w-[120px]">Gdzie pracuje</th>
                  <th className="py-3 px-3 min-w-[170px]">Ostatnia Lekcja</th>
                  <th className="py-3 px-3 min-w-[95px]">Status</th>
                  <th className="py-3 px-3 min-w-[90px]">Typ zajęć</th>
                  <th className="py-3 px-4 text-right min-w-[150px]">Akcje CRM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft/40">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-content-muted">
                      <Users size={30} className="mx-auto mb-2 opacity-30 text-content-muted" />
                      <p className="font-semibold text-text-hi text-sm">Nie znaleziono kursantów ani grup</p>
                      <p className="text-xs text-content-muted/80 mt-1">
                        Zmień filtr lub dodaj nowego kursanta / grupę do bazy.
                      </p>
                    </td>
                  </tr>
                ) : (
                  (isExpanded || pageSize === 'all' ? filteredUsers : filteredUsers.slice(0, typeof pageSize === 'number' ? pageSize : 10)).map((student) => {
                    const sId = student.id || student.username;
                    const sName =
                      student.displayName ||
                      student.name ||
                      `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
                      student.username;
                    const isGrp = Boolean(student.isGroup || student.lessonType === 'Group');
                    const recentLesson = getRecentLesson(student);
                    const isActive =
                      !student.isSuspended &&
                      !student.isArchived &&
                      student.statusWspolpracy !== 'Nieaktywny';
                    const isSelected = selectedUserIds.includes(student.id || '');

                    return (
                      <tr
                        key={sId}
                        className={`hover:bg-line-soft/40 transition-colors group ${
                          isSelected ? 'bg-primary/[0.04]' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectUser(student.id || '')}
                            className="rounded border-line-strong text-primary focus:ring-primary h-4 w-4 bg-base-100 cursor-pointer"
                          />
                        </td>

                        {/* Nazwa */}
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => onSelectUser(student.id || '', 'profile')}
                            className="flex items-center gap-2.5 text-left text-text-hi font-semibold hover:text-primary transition-colors group-hover:translate-x-0.5 transform duration-150"
                          >
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                isGrp
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : 'bg-primary/10 text-primary border border-primary/20'
                              }`}
                            >
                              {isGrp ? (
                                <Users size={14} />
                              ) : student.photoURL ? (
                                <img
                                  src={student.photoURL}
                                  alt={sName}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              ) : (
                                <span>{sName[0]?.toUpperCase() || 'U'}</span>
                              )}
                            </div>
                            <div>
                              <span className="block font-bold leading-tight">{sName}</span>
                              {isGrp && student.memberNames && student.memberNames.length > 0 && (
                                <span className="text-[10px] text-content-muted font-normal block truncate max-w-[180px]">
                                  {student.memberNames.join(', ')}
                                </span>
                              )}
                            </div>
                          </button>
                        </td>

                        {/* Typ */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              isGrp
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                            }`}
                          >
                            {isGrp ? (
                              student.groupType === 'pair'
                                ? 'Para (2)'
                                : student.groupType === 'triplet'
                                ? 'Trójka (3)'
                                : 'Grupa'
                            ) : (
                              'Kursant'
                            )}
                          </span>
                        </td>

                        {/* Poziom / Profil */}
                        <td className="py-3 px-3">
                          <span
                            className="text-text-hi font-medium block truncate max-w-[150px]"
                            title={student.level || '-'}
                          >
                            {student.level || (
                              <span className="text-content-muted/50 italic">Brak poziomu</span>
                            )}
                          </span>
                        </td>

                        {/* Adresy E-mail & Hasło */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="text-content-muted block truncate max-w-[160px] font-mono text-[11px]"
                              title={student.email}
                            >
                              {student.email || '-'}
                            </span>
                            {student.email && (
                              <button
                                type="button"
                                onClick={() => handleCopyEmail(student.email)}
                                title="Kopiuj adres e-mail"
                                className="p-1 rounded text-content-muted hover:text-primary transition-colors shrink-0 cursor-pointer"
                              >
                                {copiedEmail === student.email ? (
                                  <Check size={11} className="text-emerald-400" />
                                ) : (
                                  <Copy size={11} />
                                )}
                              </button>
                            )}
                          </div>
                          <div className="mt-1">
                            {student.tempPassword ? (
                              <button
                                type="button"
                                onClick={() => handleCopyPassword(student.id || student.username, student.tempPassword!)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-warn/15 hover:bg-warn/25 text-warn font-mono text-[10px] font-bold border border-warn/30 transition-colors cursor-pointer"
                                title="Hasło startowe — kliknij, aby skopiować"
                              >
                                <Key size={10} />
                                <span>{copiedPasswordId === (student.id || student.username) ? 'Skopiowano!' : 'Kopiuj hasło'}</span>
                              </button>
                            ) : student.isGoogleLinked || student.authProvider === 'google' ? (
                              <span className="text-[10px] text-sky-300/80 font-mono">🌐 Google</span>
                            ) : (
                              <span className="text-[10px] text-content-muted/60 font-mono">🔒 Własne</span>
                            )}
                          </div>
                        </td>

                        {/* Zaproszenie & Aktywacja */}
                        <td className="py-3 px-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                  student.invitationSent || student.lastInviteSentAt
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                }`}
                                title={
                                  student.invitationSentAt
                                    ? `Wysłano: ${new Date(student.invitationSentAt).toLocaleDateString('pl-PL')}`
                                    : student.lastInviteSentAt
                                    ? `Wysłano: ${new Date(student.lastInviteSentAt).toLocaleDateString('pl-PL')}`
                                    : 'Zaproszenie nie zostało wysłane'
                                }
                              >
                                {student.invitationSent || student.lastInviteSentAt ? (
                                  <CheckCircle2 size={10} />
                                ) : (
                                  <Clock size={10} />
                                )}
                                <span>
                                  {student.invitationSent || student.lastInviteSentAt ? 'Zaproszono' : 'Brak'}
                                </span>
                              </span>

                              <button
                                type="button"
                                onClick={() => handleToggleInvitation(student)}
                                disabled={isUpdatingInviteId === student.id}
                                className="px-1.5 py-0.5 rounded bg-line-soft hover:bg-base-100 text-[10px] text-content-muted hover:text-text-hi transition-colors cursor-pointer"
                                title={
                                  student.invitationSent || student.lastInviteSentAt
                                    ? 'Cofnij oznaczenie zaproszenia'
                                    : 'Oznacz manualnie jako wysłane'
                                }
                              >
                                {isUpdatingInviteId === student.id ? (
                                  <RefreshCw size={9} className="animate-spin" />
                                ) : student.invitationSent || student.lastInviteSentAt ? (
                                  'Cofnij'
                                ) : (
                                  'Oznacz'
                                )}
                              </button>
                            </div>

                            <div>
                              {(() => {
                                const isStudentLoggedIn = Boolean(
                                  student.isActivated ||
                                  (student.loginCount && student.loginCount > 0) ||
                                  student.lastLoginDate ||
                                  (student as any).lastLoginAt ||
                                  (student as any).lastActiveAt ||
                                  (student as any).activatedAt ||
                                  (student as any).hasLoggedIn ||
                                  student.firstLoginAt
                                );

                                const loginDateLabel = (student as any).lastLoginAt || student.lastLoginDate || student.firstLoginAt || (student as any).lastActiveAt || (student as any).activatedAt;

                                return (
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                      isStudentLoggedIn
                                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                                        : 'text-content-muted/70 bg-base-100 border border-line-strong'
                                    }`}
                                    title={
                                      loginDateLabel
                                        ? `Aktywność: ${new Date(loginDateLabel).toLocaleDateString('pl-PL')}`
                                        : 'Konto oczekuje na pierwsze logowanie'
                                    }
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        isStudentLoggedIn
                                          ? 'bg-emerald-400'
                                          : 'bg-content-muted/40'
                                      }`}
                                    />
                                    <span>
                                      {isStudentLoggedIn ? 'Aktywny' : 'Oczekuje'}
                                    </span>
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </td>

                        {/* Kontraktor */}
                        <td className="py-3 px-3">
                          {student.contractor ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                                student.contractor.toLowerCase() === 'jcl'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : student.contractor.toLowerCase() === 'inspiro'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : student.contractor.toLowerCase() === 'axell'
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                  : 'bg-line-soft text-text-hi border-line-strong'
                              }`}
                            >
                              {student.contractor}
                            </span>
                          ) : (
                            <span className="text-content-muted/40">-</span>
                          )}
                        </td>

                        {/* Gdzie pracuje */}
                        <td className="py-3 px-3">
                          <span className="text-text-hi font-medium block truncate max-w-[130px]">
                            {student.company || '-'}
                          </span>
                        </td>

                        {/* Ostatnia Lekcja */}
                        <td className="py-3 px-3">
                          {recentLesson ? (
                            <div className="truncate max-w-[170px]">
                              <span
                                className="text-text-hi font-medium block truncate text-xs"
                                title={recentLesson.topic}
                              >
                                {recentLesson.topic}
                              </span>
                              <span className="text-[10px] text-content-muted font-mono">
                                {recentLesson.date}
                              </span>
                            </div>
                          ) : (
                            <span className="text-content-muted/40 italic">Brak lekcji</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              isActive
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}
                            />
                            {isActive ? 'Aktywny' : 'Nieaktywny'}
                          </span>
                        </td>

                        {/* Typ zajęć */}
                        <td className="py-3 px-3">
                          <span className="text-[11px] font-mono text-content-muted">
                            {isGrp ? 'Group' : 'Individual'}
                          </span>
                        </td>

                        {/* Szybkie Akcje */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Wejdź do Profilu */}
                            <button
                              type="button"
                              onClick={() => onSelectUser(student.id || '', 'profile')}
                              title="Otwórz pełny profil kursanta"
                              className="p-1.5 rounded-lg bg-line-soft hover:bg-primary/20 text-content-muted hover:text-primary transition-colors"
                            >
                              <UserIcon size={13} />
                            </button>

                            {/* Notatnik / Scratchpad */}
                            {student.id && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectUser(student.id || '', 'scratchpad');
                                  openScratchpadTab(`sp_${student.id}`);
                                }}
                                title="Otwórz Notatnik / Scratchpad"
                                className="p-1.5 rounded-lg bg-line-soft hover:bg-emerald-500/20 text-content-muted hover:text-emerald-300 transition-colors"
                              >
                                <FileEdit size={13} />
                              </button>
                            )}

                            {/* Praca domowa */}
                            {student.id && (
                              <button
                                type="button"
                                onClick={() => onSelectUser(student.id || '', 'homework')}
                                title="Przejdź do prac domowych"
                                className="p-1.5 rounded-lg bg-line-soft hover:bg-purple-500/20 text-content-muted hover:text-purple-300 transition-colors"
                              >
                                <ClipboardList size={13} />
                              </button>
                            )}

                            {/* Planer lekcji */}
                            {student.id && (
                              <button
                                type="button"
                                onClick={() => onSelectUser(student.id || '', 'lesson-planner')}
                                title="Planer lekcji AI"
                                className="p-1.5 rounded-lg bg-line-soft hover:bg-sky-500/20 text-content-muted hover:text-sky-300 transition-colors"
                              >
                                <Sparkles size={13} />
                              </button>
                            )}

                            {/* Edycja grupy */}
                            {isGrp && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingGroup(student);
                                  setIsGroupModalOpen(true);
                                }}
                                title="Edytuj skład grupy / pary"
                                className="p-1.5 rounded-lg bg-line-soft hover:bg-amber-500/20 text-content-muted hover:text-amber-300 transition-colors"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}

                            {/* Zaproszenie e-mail */}
                            {!isGrp && student.email && (
                              <button
                                type="button"
                                onClick={() => setInviteStudent(student)}
                                title="Wyślij e-mail z danymi logowania"
                                className="p-1.5 rounded-lg bg-line-soft hover:bg-indigo-500/20 text-content-muted hover:text-indigo-300 transition-colors"
                              >
                                <Send size={13} />
                              </button>
                            )}

                            {/* Usuń konto */}
                            <button
                              type="button"
                              onClick={() => handleDeleteSingleUser(student)}
                              title="Usuń konto"
                              className="p-1.5 rounded-lg hover:bg-rose-500/20 text-content-muted hover:text-rose-400 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pasek rozwijania / limit kursantów */}
          {filteredUsers.length > (typeof pageSize === 'number' ? pageSize : 10) && (
            <div className="p-3.5 border-t border-line-strong/60 bg-base-100/50 flex items-center justify-center">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="px-4 py-2 rounded-xl bg-line-soft hover:bg-line-soft/80 border border-line-strong text-xs font-bold text-content-muted hover:text-text-hi transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:border-primary/40"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp size={15} className="text-primary" />
                    <span>Zwiń listę kursantów</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={15} className="text-primary" />
                    <span>Pokaż wszystkich kursantów (pokazano {typeof pageSize === 'number' ? pageSize : 10} z {filteredUsers.length})</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal: Zarządzanie Grupami Zajęciowymi (GroupsManager) */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-5xl bg-base-200 border border-line-strong rounded-3xl shadow-2xl p-4 sm:p-6 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line-strong mb-4">
              <div className="flex items-center gap-2">
                <Users className="text-primary w-5 h-5" />
                <span className="text-sm font-bold text-text-hi uppercase tracking-wider">Moduł Grup Zajęciowych</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsGroupModalOpen(false);
                  fetchUsersAndLessons();
                }}
                className="p-1.5 rounded-lg border border-line-strong text-content-muted hover:text-text-hi cursor-pointer"
                aria-label="Zamknij"
              >
                <X size={16} />
              </button>
            </div>
            <GroupsManager
              students={users}
              onOpenScratchpad={(scratchpadId) => openScratchpadTab(scratchpadId)}
            />
          </div>
        </div>
      )}

      {/* Modal: Wyślij zaproszenie email */}
      {inviteStudent && (
        <StudentInviteEmailModal
          isOpen={Boolean(inviteStudent)}
          onClose={() => setInviteStudent(null)}
          student={inviteStudent}
          onInviteSent={() => {
            setInviteStudent(null);
            fetchUsersAndLessons();
          }}
        />
      )}

      {/* Modal: Dodaj nowego kursanta */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md">
            <Card className="w-full shadow-2xl border-primary/20 bg-base-200">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-line-strong">
                <h3 className="text-lg font-bold text-text-hi flex items-center gap-2">
                  <Plus size={18} className="text-primary" />
                  <span>Dodaj nowego kursanta</span>
                </h3>
                <button
                  onClick={closeCreateModal}
                  className="p-1.5 text-content-muted hover:text-text-hi rounded-lg hover:bg-line-soft transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {!createdCredentials && importAnalysis ? (
                <StudentImportReviewCard
                  analysis={importAnalysis}
                  onChange={setImportAnalysis}
                  onLessonDateChange={handleImportLessonDateChange}
                  onConfirm={handleConfirmImport}
                  onCancel={() => setImportAnalysis(null)}
                  isSaving={isSavingImport}
                />
              ) : !createdCredentials ? (
                <form onSubmit={handleCreateStudent} className="space-y-4">
                  {createError && (
                    <div className="p-3 bg-danger/10 border border-danger/30 text-danger rounded-xl text-xs font-semibold">
                      {createError}
                    </div>
                  )}

                  <div
                    onDragOver={(e) => { e.preventDefault(); setImportDragActive(true); }}
                    onDragLeave={() => setImportDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setImportDragActive(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleImportFile(file);
                    }}
                    onClick={() => document.getElementById('smart-import-file-input')?.click()}
                    className={`p-4 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
                      importDragActive ? 'border-primary bg-primary/5' : 'border-line-strong hover:border-primary/50'
                    }`}
                  >
                    <input
                      id="smart-import-file-input"
                      type="file"
                      accept=".txt,.md,.markdown,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImportFile(file);
                        e.target.value = '';
                      }}
                    />
                    {isAnalyzingImport ? (
                      <div className="flex items-center justify-center gap-2 text-xs text-content-muted">
                        <RefreshCw size={14} className="animate-spin text-primary" />
                        <span>Analizuję dokument i historię lekcji...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-content-muted">
                        <UploadCloud size={20} className="text-primary" />
                        <span className="text-xs font-semibold">Przeciągnij plik z notatkami kursanta</span>
                        <span className="text-[11px]">.txt, .md, .pdf — profil i historia lekcji zostaną wypełnione automatycznie</span>
                      </div>
                    )}
                  </div>
                  {importError && (
                    <div className="p-3 bg-danger/10 border border-danger/30 text-danger rounded-xl text-xs font-semibold">
                      {importError}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-[11px] text-content-muted">
                    <div className="h-px bg-line-strong flex-1" />
                    <span>albo wypełnij ręcznie</span>
                    <div className="h-px bg-line-strong flex-1" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-content-muted mb-1">
                      Imię i nazwisko kursanta <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="np. Jan Kowalski"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-base-100 border border-line-strong rounded-xl text-text-hi text-sm focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-content-muted mb-1">
                      Adres e-mail (opcjonalnie)
                    </label>
                    <input
                      type="email"
                      placeholder="kursant@firma.pl (zostaw puste dla generowanego)"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-base-100 border border-line-strong rounded-xl text-text-hi text-sm focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-content-muted">Hasło początkowe</label>
                      <button
                        type="button"
                        onClick={() => setIsAutoPassword(!isAutoPassword)}
                        className="text-xs text-primary hover:underline font-semibold"
                      >
                        {isAutoPassword ? 'Wpisz własne hasło' : 'Generuj automatycznie'}
                      </button>
                    </div>

                    {isAutoPassword ? (
                      <div className="p-3 bg-base-100/60 border border-line-strong rounded-xl text-xs text-content-muted flex items-center gap-2">
                        <Lock size={14} className="text-primary shrink-0" />
                        <span>Hasło zostanie wygenerowane automatycznie.</span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder="Wpisz hasło min. 6 znaków"
                        value={customPassword}
                        onChange={(e) => setCustomPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-base-100 border border-line-strong rounded-xl text-text-hi text-sm focus:border-primary focus:outline-none"
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-line-strong">
                    <Button type="button" variant="secondary" onClick={closeCreateModal}>
                      Anuluj
                    </Button>
                    <Button type="submit" isLoading={isCreating} className="bg-primary text-accent-ink font-bold shadow-btn">
                      Utwórz konto
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                    <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
                    <h4 className="text-base font-bold text-text-hi">Konto zostało utworzone!</h4>
                    <p className="text-xs text-content-muted mt-1">
                      Skopiuj poniższe dane i przekaż je kursantowi.
                    </p>
                  </div>

                  <div className="space-y-2 bg-base-100 p-3.5 rounded-xl border border-line-strong font-mono text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-line-soft">
                      <span className="text-content-muted">Login / Email:</span>
                      <span className="text-text-hi font-bold">{createdCredentials.email}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-content-muted">Hasło:</span>
                      <span className="text-primary font-bold">{createdCredentials.password}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <Button
                      onClick={() => {
                        const text = `Cześć! Twoje konto na platformie Cribro English jest gotowe:\nLogin: ${createdCredentials.email}\nHasło: ${createdCredentials.password}\nLink: https://recall.cribro.app`;
                        navigator.clipboard.writeText(text);
                        setCopiedCreds(true);
                        setTimeout(() => setCopiedCreds(false), 3000);
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-primary text-accent-ink font-bold"
                    >
                      {copiedCreds ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copiedCreds ? 'Skopiowano do schowka!' : 'Kopiuj dane do przekazania'}</span>
                    </Button>

                    <Button variant="secondary" onClick={closeCreateModal} className="w-full">
                      Zamknij
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
