import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Search,
  Download,
  FileText,
  Edit2,
  Plus,
  Users,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  X,
  ShieldCheck,
  Sparkles,
  BookOpen,
  ArrowUpDown,
  Filter,
  Mail,
  Lock,
  RefreshCw,
  SlidersHorizontal,
  ExternalLink,
  User as UserIcon,
  CheckSquare,
  Square,
  MinusSquare,
  MoreVertical,
  Trash2,
  Layers,
  Check,
  Send,
  FileEdit
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { User } from '../../types';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { useLanguage } from '../../context/LanguageContext';
import StudentNotionSyncModal from './StudentNotionSyncModal';
import StudentInviteEmailModal from './StudentInviteEmailModal';
import ScratchpadModal from '../scratchpad/ScratchpadModal';

import {
  buildBulkUpdatePayload,
  calculateIsAllSelected,
  calculateIsIndeterminate,
  toggleSelectAllFilteredIds,
} from '../../utils/studentDatabaseUtils';

export interface StudentDatabaseScreenProps {
  users: User[];
  onSelectUser: (user: User, targetTab?: string) => void;
  onUpdateUserRole: (user: User, newRole: 'admin' | 'user' | 'teacher') => Promise<void>;
  onUpdateUserEmail: (userId: string, newEmail: string) => Promise<void>;
  onDeleteUser?: (userId: string) => Promise<void>;
  onBulkDeleteUsers?: (userIds: string[]) => Promise<void>;
  onBulkUpdateUsers?: (userIds: string[], updates: Partial<User>) => Promise<void>;
  onRefreshUsers?: () => Promise<void>;
  onAddNewStudent?: () => void;
  onOpenMailing?: () => void;
  onBack?: () => void;
}

type ViewTab = 'all' | 'students' | 'staff' | 'placeholder';
type SortField = 'name' | 'email' | 'level' | 'logins' | 'lastActive';
type SortOrder = 'asc' | 'desc';

export const StudentDatabaseScreen: React.FC<StudentDatabaseScreenProps> = ({
  users,
  onSelectUser,
  onUpdateUserRole,
  onUpdateUserEmail,
  onDeleteUser,
  onBulkDeleteUsers,
  onBulkUpdateUsers,
  onRefreshUsers,
  onAddNewStudent,
  onOpenMailing,
  onBack,
}) => {
  const { language } = useLanguage();

  // Navigation / View Tabs (Notion Views)
  const [currentViewTab, setCurrentViewTab] = useState<ViewTab>('all');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Multi-Selection State (Tick boxes)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Per-record expanded options menu
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);

  // Notion Fetch / Sync Modal State
  const [notionSyncUser, setNotionSyncUser] = useState<User | null>(null);
  const [showNotionSyncModal, setShowNotionSyncModal] = useState<boolean>(false);

  // App Invite Modal State
  const [inviteStudent, setInviteStudent] = useState<User | null>(null);
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [scratchpadStudent, setScratchpadStudent] = useState<User | null>(null);

  // Single user deletion state
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState<boolean>(false);

  // Bulk Edit Modal State
  const [isBulkEditOpen, setIsBulkEditOpen] = useState<boolean>(false);
  const [bulkLevel, setBulkLevel] = useState<string>('no_change');
  const [bulkRole, setBulkRole] = useState<string>('no_change');
  const [bulkEmailNotifications, setBulkEmailNotifications] = useState<string>('no_change');
  const [isApplyingBulkEdit, setIsApplyingBulkEdit] = useState<boolean>(false);
  const [bulkEditSuccess, setBulkEditSuccess] = useState<boolean>(false);

  // Bulk Delete Modal State
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState<boolean>(false);
  const [isApplyingBulkDelete, setIsApplyingBulkDelete] = useState<boolean>(false);

  // Quick edit email modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editEmailInput, setEditEmailInput] = useState('');
  const [editEmailError, setEditEmailError] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Role updating state
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  // Export states
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  // Close menus on outside click
  useEffect(() => {
    const handleGlobalClick = () => {
      setOpenMenuUserId(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const isSyntheticEmail = (email?: string) => {
    if (!email) return true;
    return email.includes('@student.vocabboost.com') || !email.includes('.');
  };

  // Filter & Sort Logic
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Exclude special demo profiles if needed
      if (u.username === 'Demo User' || u.username === 'Demo User (Offline)') return false;

      // View Tab filter
      if (currentViewTab === 'students' && (u.role === 'teacher' || u.role === 'admin')) return false;
      if (currentViewTab === 'staff' && u.role !== 'teacher' && u.role !== 'admin') return false;
      if (currentViewTab === 'placeholder' && !isSyntheticEmail(u.email)) return false;

      // Level filter
      if (levelFilter !== 'all') {
        const uLevel = (u.level || '').toUpperCase();
        if (!uLevel.startsWith(levelFilter.toUpperCase())) return false;
      }

      // Role filter
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
        const username = (u.username || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const level = (u.level || '').toLowerCase();

        return (
          fullName.includes(query) ||
          username.includes(query) ||
          email.includes(query) ||
          level.includes(query)
        );
      }

      return true;
    }).sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sortField === 'name') {
        valA = (a.firstName || a.username || '').toLowerCase();
        valB = (b.firstName || b.username || '').toLowerCase();
      } else if (sortField === 'email') {
        valA = (a.email || '').toLowerCase();
        valB = (b.email || '').toLowerCase();
      } else if (sortField === 'level') {
        valA = a.level || '';
        valB = b.level || '';
      } else if (sortField === 'logins') {
        valA = a.loginCount || 0;
        valB = b.loginCount || 0;
      } else if (sortField === 'lastActive') {
        valA = a.lastLoginDate ? new Date(a.lastLoginDate).getTime() : 0;
        valB = b.lastLoginDate ? new Date(b.lastLoginDate).getTime() : 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [users, currentViewTab, levelFilter, roleFilter, searchQuery, sortField, sortOrder]);

  const filteredUserIds = useMemo(() => filteredUsers.map((u) => u.id), [filteredUsers]);

  const isAllFilteredSelected = useMemo(() => {
    return calculateIsAllSelected(filteredUserIds, selectedUserIds);
  }, [filteredUserIds, selectedUserIds]);

  const isSomeFilteredSelected = useMemo(() => {
    return calculateIsIndeterminate(filteredUserIds, selectedUserIds);
  }, [filteredUserIds, selectedUserIds]);

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedUserIds((prev) => toggleSelectAllFilteredIds(filteredUserIds, prev));
  };

  const clearSelection = () => {
    setSelectedUserIds(new Set());
  };

  const handleBulkEditSubmit = async () => {
    if (selectedUserIds.size === 0) return;
    const payload = buildBulkUpdatePayload({
      level: bulkLevel,
      role: bulkRole,
      emailNotifications: bulkEmailNotifications,
    });

    if (Object.keys(payload).length === 0) {
      alert('Nie wybrano żadnych zmian do zastosowania.');
      return;
    }

    try {
      setIsApplyingBulkEdit(true);
      if (onBulkUpdateUsers) {
        await onBulkUpdateUsers(Array.from(selectedUserIds), payload);
      }
      setBulkEditSuccess(true);
      setTimeout(() => {
        setBulkEditSuccess(false);
        setIsBulkEditOpen(false);
        clearSelection();
        setBulkLevel('no_change');
        setBulkRole('no_change');
        setBulkEmailNotifications('no_change');
      }, 1000);
    } catch (err: any) {
      console.error('Błąd masowej edycji:', err);
      alert('Nie udało się zaktualizować wybranych użytkowników: ' + (err.message || String(err)));
    } finally {
      setIsApplyingBulkEdit(false);
    }
  };

  const handleBulkDeleteSubmit = async () => {
    if (selectedUserIds.size === 0) return;
    try {
      setIsApplyingBulkDelete(true);
      if (onBulkDeleteUsers) {
        await onBulkDeleteUsers(Array.from(selectedUserIds));
      }
      setIsBulkDeleteOpen(false);
      clearSelection();
      if (onRefreshUsers) {
        await onRefreshUsers();
      }
    } catch (err: any) {
      console.error('Błąd masowego usuwania:', err);
      alert('Błąd podczas usuwania: ' + (err.message || String(err)));
    } finally {
      setIsApplyingBulkDelete(false);
    }
  };

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Fast Role Change
  const handleQuickRoleChange = async (user: User, newRole: 'admin' | 'user' | 'teacher') => {
    if (user.role === newRole) return;
    setUpdatingRoleId(user.id || '');
    try {
      await onUpdateUserRole(user, newRole);
    } catch (err) {
      console.error('Błąd zmiany roli:', err);
    } finally {
      setUpdatingRoleId(null);
    }
  };

  // Open Edit Email Modal
  const handleOpenEditEmail = (user: User) => {
    setEditingUser(user);
    setEditEmailInput(user.email || '');
    setEditEmailError('');
  };

  // Save Email
  const handleSaveEmail = async () => {
    if (!editingUser?.id) return;
    const trimmed = editEmailInput.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmed || !emailRegex.test(trimmed)) {
      setEditEmailError('Podaj prawidłowy format adresu e-mail (np. imie.nazwisko@gmail.com).');
      return;
    }

    setIsSavingEmail(true);
    setEditEmailError('');
    try {
      await onUpdateUserEmail(editingUser.id, trimmed);
      setEditingUser(null);
    } catch (err: any) {
      setEditEmailError(err?.message || 'Nie udało się zaktualizować adresu e-mail.');
    } finally {
      setIsSavingEmail(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    setIsExportingCSV(true);
    try {
      const headers = [
        'ID',
        'Imię',
        'Nazwisko',
        'Login (Username)',
        'Adres E-mail',
        'Typ e-maila',
        'Rola / Uprawnienia',
        'Poziom zaawansowania',
        'Liczba logowań',
        'Ostatnia aktywność',
        'Status powiadomień e-mail'
      ];

      const rows = filteredUsers.map((u) => {
        const isSynth = isSyntheticEmail(u.email);
        const lastActive = u.lastLoginDate ? new Date(u.lastLoginDate).toLocaleString('pl-PL') : 'Brak danych';
        const roleName = u.role === 'admin' ? 'Administrator' : u.role === 'teacher' ? 'Nauczyciel' : 'Kursant';
        const mailingStatus = u.emailNotificationsDisabled ? 'Wypisany (brak powiadomień)' : 'Aktywne powiadomienia';

        return [
          `"${u.id || ''}"`,
          `"${(u.firstName || '').replace(/"/g, '""')}"`,
          `"${(u.lastName || '').replace(/"/g, '""')}"`,
          `"${(u.username || '').replace(/"/g, '""')}"`,
          `"${(u.email || '').replace(/"/g, '""')}"`,
          `"${isSynth ? 'Zastępczy (@student)' : 'Dostarczalny (Resend)'}"`,
          `"${roleName}"`,
          `"${(u.level || 'Brak poziomu').replace(/"/g, '""')}"`,
          u.loginCount || 0,
          `"${lastActive}"`,
          `"${mailingStatus}"`
        ].join(',');
      });

      // UTF-8 BOM for Excel polish character support
      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10);
      link.setAttribute('href', url);
      link.setAttribute('download', `kursanci_cribro_${today}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Błąd eksportu CSV:', err);
      alert('Nie udało się wyeksportować bazy do pliku CSV.');
    } finally {
      setIsExportingCSV(false);
    }
  };

  // Export to PDF
  const handleExportPDF = () => {
    setIsExportingPDF(true);
    try {
      const container = document.createElement('div');
      container.style.padding = '25px';
      container.style.fontFamily = 'Arial, sans-serif';
      container.style.color = '#111';
      container.style.backgroundColor = '#fff';

      const today = new Date().toLocaleDateString('pl-PL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const totalUsers = filteredUsers.length;
      const countStudents = filteredUsers.filter((u) => u.role === 'user' || !u.role).length;
      const countTeachers = filteredUsers.filter((u) => u.role === 'teacher').length;
      const countAdmins = filteredUsers.filter((u) => u.role === 'admin').length;

      let html = `
        <div style="border-bottom: 2px solid #22c55e; padding-bottom: 15px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h1 style="font-size: 22px; margin: 0; color: #0f172a; font-weight: 800;">CRIBRO ENGLISH — Baza Kursantów</h1>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Raport profili, uprawnień i adresów e-mail</p>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 11px; color: #475569; font-weight: bold;">Data wygenerowania:</span>
              <div style="font-size: 12px; color: #0f172a; font-family: monospace;">${today}</div>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 15px; margin-bottom: 20px; background-color: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div style="flex: 1;">
            <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">Rekordy</div>
            <div style="font-size: 18px; font-weight: bold; color: #0f172a;">${totalUsers}</div>
          </div>
          <div style="flex: 1;">
            <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">Uczniowie</div>
            <div style="font-size: 18px; font-weight: bold; color: #16a34a;">${countStudents}</div>
          </div>
          <div style="flex: 1;">
            <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">Nauczyciele</div>
            <div style="font-size: 18px; font-weight: bold; color: #2563eb;">${countTeachers}</div>
          </div>
          <div style="flex: 1;">
            <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">Administratorzy</div>
            <div style="font-size: 18px; font-weight: bold; color: #dc2626;">${countAdmins}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 8px 10px; font-weight: bold; color: #334155;">#</th>
              <th style="padding: 8px 10px; font-weight: bold; color: #334155;">Kursant</th>
              <th style="padding: 8px 10px; font-weight: bold; color: #334155;">Login</th>
              <th style="padding: 8px 10px; font-weight: bold; color: #334155;">Adres E-mail</th>
              <th style="padding: 8px 10px; font-weight: bold; color: #334155;">Poziom</th>
              <th style="padding: 8px 10px; font-weight: bold; color: #334155;">Rola</th>
              <th style="padding: 8px 10px; font-weight: bold; color: #334155;">Logowania</th>
            </tr>
          </thead>
          <tbody>
      `;

      filteredUsers.forEach((u, idx) => {
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
        const roleLabel = u.role === 'admin' ? 'Admin' : u.role === 'teacher' ? 'Nauczyciel' : 'Kursant';
        const roleBg = u.role === 'admin' ? '#fee2e2' : u.role === 'teacher' ? '#dbeafe' : '#f0fdf4';
        const roleColor = u.role === 'admin' ? '#b91c1c' : u.role === 'teacher' ? '#1d4ed8' : '#15803d';
        const isSynth = isSyntheticEmail(u.email);

        html += `
          <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #fafafa;' : ''}">
            <td style="padding: 8px 10px; color: #94a3b8; font-mono;">${idx + 1}</td>
            <td style="padding: 8px 10px; font-weight: bold; color: #0f172a;">${fullName}</td>
            <td style="padding: 8px 10px; font-family: monospace; color: #475569;">${u.username}</td>
            <td style="padding: 8px 10px;">
              <span style="font-family: monospace; color: ${isSynth ? '#b45309' : '#0f172a'};">${u.email || 'Brak e-maila'}</span>
            </td>
            <td style="padding: 8px 10px; font-family: monospace; font-weight: bold; color: #0f172a;">${u.level || '—'}</td>
            <td style="padding: 8px 10px;">
              <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background-color: ${roleBg}; color: ${roleColor};">
                ${roleLabel}
              </span>
            </td>
            <td style="padding: 8px 10px; color: #475569;">${u.loginCount || 0}</td>
          </tr>
        `;
      });

      html += `
          </tbody>
        </table>
        <div style="margin-top: 25px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center;">
          Wygenerowano z systemu CRIBRO RECALL • ${totalUsers} użytkowników w zestawieniu
        </div>
      `;

      container.innerHTML = html;

      const opt = {
        margin: 12,
        filename: `baza_kursantow_cribro_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const }
      };

      html2pdf().from(container).set(opt).save().then(() => {
        setIsExportingPDF(false);
      }).catch((err: any) => {
        console.error('Błąd generowania PDF:', err);
        alert('Nie udało się wygenerować pliku PDF.');
        setIsExportingPDF(false);
      });
    } catch (err) {
      console.error('Błąd PDF:', err);
      setIsExportingPDF(false);
    }
  };

  const countStudents = users.filter((u) => u.role === 'user' || !u.role).length;
  const countStaff = users.filter((u) => u.role === 'teacher' || u.role === 'admin').length;
  const countPlaceholder = users.filter((u) => isSyntheticEmail(u.email)).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Notion-Style Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
            <Database className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
                Baza kursantów
              </h1>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 uppercase font-bold">
                {users.length} rekordów
              </span>
            </div>
            <p className="text-xs text-content-muted mt-1">
              Baza danych profili, uprawnień, adresów e-mail oraz bezpośrednich skrótów do narzędzi dydaktycznych.
            </p>
          </div>
        </div>

        {/* Action Bar (Export CSV, Export PDF, Add Student) */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          <button
            onClick={handleExportCSV}
            disabled={isExportingCSV}
            className="px-3.5 py-2 rounded-xl bg-ink/70 hover:bg-white/10 text-white border border-white/10 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Eksportuj całą bazę do arkusza kalkulacyjnego CSV"
          >
            <Download size={14} className="text-primary" />
            <span>{isExportingCSV ? 'Eksportowanie...' : 'Eksportuj CSV'}</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="px-3.5 py-2 rounded-xl bg-ink/70 hover:bg-white/10 text-white border border-white/10 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Generuj sformatowany plik PDF z tabelą kursantów"
          >
            <FileText size={14} className="text-primary" />
            <span>{isExportingPDF ? 'Generowanie PDF...' : 'Eksportuj PDF'}</span>
          </button>

          {onOpenMailing && (
            <button
              onClick={onOpenMailing}
              className="px-3.5 py-2 rounded-xl bg-ink/70 hover:bg-white/10 text-white border border-white/10 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Przejdź do panelu zarządzania pocztą i mailingiem"
            >
              <Mail size={14} className="text-primary" />
              <span>Mailing & Poczta</span>
            </button>
          )}

          {onAddNewStudent && (
            <button
              onClick={onAddNewStudent}
              className="px-4 py-2 rounded-xl bg-primary text-accent-ink text-xs font-bold transition-all flex items-center gap-1.5 shadow-btn hover:bg-primary/90 cursor-pointer"
            >
              <Plus size={15} />
              <span>Dodaj kursanta</span>
            </button>
          )}
        </div>
      </div>

      {/* Notion Database Views (Tabs) */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        <button
          onClick={() => setCurrentViewTab('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            currentViewTab === 'all'
              ? 'bg-primary text-accent-ink shadow-btn'
              : 'text-content-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Database size={14} />
          Wszyscy ({users.length})
        </button>

        <button
          onClick={() => setCurrentViewTab('students')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            currentViewTab === 'students'
              ? 'bg-primary text-accent-ink shadow-btn'
              : 'text-content-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Users size={14} />
          Uczniowie ({countStudents})
        </button>

        <button
          onClick={() => setCurrentViewTab('staff')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            currentViewTab === 'staff'
              ? 'bg-primary text-accent-ink shadow-btn'
              : 'text-content-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <ShieldCheck size={14} />
          Nauczyciele & Admini ({countStaff})
        </button>

        <button
          onClick={() => setCurrentViewTab('placeholder')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            currentViewTab === 'placeholder'
              ? 'bg-primary text-accent-ink shadow-btn'
              : 'text-content-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <AlertTriangle size={14} />
          Wymaga e-maila ({countPlaceholder})
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        {/* Search */}
        <div className="sm:col-span-6 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj po imieniu, nazwisku, loginie, e-mailu..."
            className="w-full pl-9 pr-9 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs placeholder-content-muted focus:outline-none focus:border-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Level Filter */}
        <div className="sm:col-span-3">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">🎯 Wszystkie poziomy</option>
            <option value="A1">Poziom A1 (Beginner)</option>
            <option value="A2">Poziom A2 (Elementary)</option>
            <option value="B1">Poziom B1 (Intermediate)</option>
            <option value="B2">Poziom B2 (Upper-Intermediate)</option>
            <option value="C1">Poziom C1 (Advanced)</option>
            <option value="C2">Poziom C2 (Proficiency)</option>
          </select>
        </div>

        {/* Role Filter */}
        <div className="sm:col-span-3">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">🔑 Wszystkie uprawnienia</option>
            <option value="user">👤 Kursanci (Uczniowie)</option>
            <option value="teacher">👨‍🏫 Nauczyciele</option>
            <option value="admin">🛡️ Administratorzy</option>
          </select>
        </div>
      </div>

      {/* Notion-Style Table */}
      <div className="rounded-2xl border border-white/10 bg-base-100/60 overflow-hidden shadow-2xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-white/10 bg-black/40 text-content-muted font-bold uppercase tracking-wider select-none text-[11px]">
                {/* Select All Column */}
                <th className="py-3 px-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAllFiltered}
                    className="p-1 rounded text-content-muted hover:text-white transition-colors focus:outline-none cursor-pointer"
                    title={isAllFilteredSelected ? 'Odznacz wszystkich' : 'Zaznacz wszystkich'}
                  >
                    {isAllFilteredSelected ? (
                      <CheckSquare size={16} className="text-primary" />
                    ) : isSomeFilteredSelected ? (
                      <MinusSquare size={16} className="text-primary" />
                    ) : (
                      <Square size={16} className="opacity-40 hover:opacity-100" />
                    )}
                  </button>
                </th>
                <th
                  onClick={() => handleSortToggle('name')}
                  className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Aa Kursant</span>
                    <ArrowUpDown size={12} className={sortField === 'name' ? 'text-primary' : 'opacity-40'} />
                  </div>
                </th>
                <th
                  onClick={() => handleSortToggle('email')}
                  className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>✉️ Adres E-mail</span>
                    <ArrowUpDown size={12} className={sortField === 'email' ? 'text-primary' : 'opacity-40'} />
                  </div>
                </th>
                <th className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <span>🛡️ Uprawnienia (Rola)</span>
                  </div>
                </th>
                <th
                  onClick={() => handleSortToggle('level')}
                  className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>🎯 Poziom</span>
                    <ArrowUpDown size={12} className={sortField === 'level' ? 'text-primary' : 'opacity-40'} />
                  </div>
                </th>
                <th
                  onClick={() => handleSortToggle('logins')}
                  className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>📈 Logowania</span>
                    <ArrowUpDown size={12} className={sortField === 'logins' ? 'text-primary' : 'opacity-40'} />
                  </div>
                </th>
                <th className="py-3 px-4 text-right">
                  <span>⚡ Szybkie akcje & Narzędzia</span>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-white/5">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-content-muted">
                    <Database className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p className="font-semibold text-sm text-white">Brak rekordów spełniających kryteria</p>
                    <p className="text-xs text-content-muted mt-0.5">Zmień frazę w wyszukiwarce lub zresetuj filtry.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isSynth = isSyntheticEmail(user.email);
                  const isUpdatingRole = updatingRoleId === user.id;
                  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
                  const isSelected = selectedUserIds.has(user.id);
                  const isMenuOpen = openMenuUserId === user.id;

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-white/5 transition-colors group ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      {/* Tick Box / Checkbox Column */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectUser(user.id);
                          }}
                          className="p-1 rounded text-content-muted hover:text-white transition-colors focus:outline-none cursor-pointer"
                          title={isSelected ? 'Odznacz' : 'Zaznacz'}
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-primary" />
                          ) : (
                            <Square size={16} className="opacity-30 hover:opacity-80" />
                          )}
                        </button>
                      </td>

                      {/* Name & Avatar Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-bold text-primary text-sm flex-shrink-0 border border-primary/30 overflow-hidden shadow-inner">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              user.firstName ? user.firstName[0].toUpperCase() : user.username[0].toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white group-hover:text-primary transition-colors truncate flex items-center gap-1.5">
                              <span>{fullName}</span>
                            </div>
                            <div className="text-[11px] text-content-muted font-mono truncate">
                              @{user.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0">
                            <div className="font-mono text-xs text-white/90 truncate flex items-center gap-1.5">
                              <span>{user.email || 'Brak e-maila'}</span>
                              {!isSynth ? (
                                <span title="Adres zweryfikowany / dostarczalny (Resend)" className="text-primary">
                                  <CheckCircle2 size={13} />
                                </span>
                              ) : (
                                <span title="Adres syntetyczny @student - wymaga edycji" className="text-warn">
                                  <AlertTriangle size={13} />
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-content-muted mt-0.5">
                              {isSynth ? (
                                <span className="text-warn/80 font-semibold">Zastępczy (brak wysyłki)</span>
                              ) : user.emailNotificationsDisabled ? (
                                <span className="text-danger/80 font-semibold">Wypisany z mailingu</span>
                              ) : (
                                <span className="text-primary/80 font-semibold">Powiadomienia aktywne</span>
                              )}
                              {user.lastInviteSentAt && (
                                <span className="text-emerald-400 font-mono ml-1.5" title={`Ostatnie zaproszenie: ${new Date(user.lastInviteSentAt).toLocaleString('pl-PL')}`}>
                                  • Zaproszono
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => handleOpenEditEmail(user)}
                            className="p-1 rounded-md hover:bg-white/10 text-content-muted hover:text-white transition-colors cursor-pointer"
                            title="Edytuj adres e-mail kursanta"
                          >
                            <Edit2 size={13} />
                          </button>
                        </div>
                      </td>

                      {/* Role / Permissions Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={user.role || 'user'}
                            disabled={isUpdatingRole}
                            onChange={(e) =>
                              handleQuickRoleChange(user, e.target.value as 'admin' | 'user' | 'teacher')
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border cursor-pointer focus:outline-none transition-colors ${
                              user.role === 'admin'
                                ? 'bg-danger/15 text-danger border-danger/30'
                                : user.role === 'teacher'
                                ? 'bg-primary/15 text-primary border-primary/30'
                                : 'bg-white/5 text-white/90 border-white/10'
                            }`}
                          >
                            <option value="user" className="bg-base-200 text-white">👤 Kursant</option>
                            <option value="teacher" className="bg-base-200 text-primary">👨‍🏫 Nauczyciel</option>
                            <option value="admin" className="bg-base-200 text-danger">🛡️ Administrator</option>
                          </select>
                          {isUpdatingRole && <RefreshCw size={12} className="animate-spin text-primary" />}
                        </div>
                      </td>

                      {/* Level Column */}
                      <td className="py-3.5 px-4">
                        {user.level ? (
                          <span className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-mono font-bold">
                            {user.level}
                          </span>
                        ) : (
                          <span className="text-content-muted font-mono">—</span>
                        )}
                      </td>

                      {/* Logins & Activity Column */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-white">
                            {user.loginCount || 0} <span className="text-[10px] text-content-muted font-normal">wizyt</span>
                          </div>
                          <div className="text-[10px] text-content-muted">
                            {user.lastLoginDate
                              ? new Date(user.lastLoginDate).toLocaleDateString('pl-PL')
                              : 'Brak'}
                          </div>
                        </div>
                      </td>

                      {/* Direct Action Shortcuts & More Options Menu */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 relative">
                          {/* Fast Notion Sync Button */}
                          <button
                            onClick={() => {
                              setNotionSyncUser(user);
                              setShowNotionSyncModal(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-semibold transition-colors flex items-center gap-1 border border-primary/25 hover:border-primary/50 cursor-pointer shadow-sm"
                            title="Pobierz lub zaktualizuj lekcje kursanta z Notion"
                          >
                            <RefreshCw size={12} />
                            <span>Notion</span>
                          </button>

                          <button
                            onClick={() => onSelectUser(user, 'profile')}
                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white font-semibold transition-colors flex items-center gap-1 hover:border-primary/40 border border-transparent cursor-pointer"
                            title="Otwórz profil i parametry tego kursanta"
                          >
                            <UserIcon size={12} className="text-primary" />
                            <span className="hidden sm:inline">Profil</span>
                          </button>

                          <button
                            onClick={() => onSelectUser(user, 'lesson-planner')}
                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white font-semibold transition-colors flex items-center gap-1 hover:border-primary/40 border border-transparent cursor-pointer"
                            title="Otwórz planer lekcji dla tego kursanta"
                          >
                            <Sparkles size={12} className="text-primary" />
                            <span className="hidden sm:inline">Planer</span>
                          </button>

                          <button
                            onClick={() => onSelectUser(user, 'homework')}
                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white font-semibold transition-colors flex items-center gap-1 hover:border-primary/40 border border-transparent cursor-pointer"
                            title="Otwórz prace domowe tego kursanta"
                          >
                            <BookOpen size={12} className="text-primary" />
                            <span className="hidden sm:inline">Prace</span>
                          </button>

                          {/* Quick Invite Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setInviteStudent(user);
                              setShowInviteModal(true);
                            }}
                            className="px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-semibold transition-colors flex items-center gap-1 border border-primary/20 hover:border-primary/40 cursor-pointer"
                            title="Wyślij zaproszenie do aplikacji z loginem i hasłem"
                          >
                            <Send size={12} />
                            <span className="hidden md:inline">Zaproszenie</span>
                          </button>

                          {/* Quick Scratchpad Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setScratchpadStudent(user);
                            }}
                            className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-semibold transition-colors flex items-center gap-1 border border-emerald-500/20 hover:border-emerald-500/40 cursor-pointer"
                            title="Otwórz współdzielony brudnopis kursanta (kod PIN / Google Docs)"
                          >
                            <FileEdit size={12} />
                            <span className="hidden lg:inline">Brudnopis</span>
                          </button>


                          {/* "Więcej opcji" Dropdown Button */}
                          <div className="relative inline-block text-left">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuUserId(isMenuOpen ? null : user.id);
                              }}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isMenuOpen
                                  ? 'bg-primary/20 text-primary border-primary/40'
                                  : 'bg-white/5 hover:bg-white/10 text-content-muted hover:text-white border-transparent'
                              }`}
                              title="Wyświetl więcej opcji dla tego rekordu"
                            >
                              <MoreVertical size={14} />
                            </button>

                            {isMenuOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1.5 w-60 bg-base-200 border border-white/15 rounded-xl shadow-2xl p-1.5 z-40 space-y-0.5 text-left text-xs animate-fade-in backdrop-blur-xl"
                              >
                                <div className="px-2.5 py-1 text-[10px] font-bold text-content-muted uppercase tracking-wider border-b border-white/5 mb-1">
                                  Opcje: {fullName}
                                </div>
                                <button
                                  onClick={() => {
                                    setOpenMenuUserId(null);
                                    setInviteStudent(user);
                                    setShowInviteModal(true);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-primary/15 text-primary flex items-center gap-2 transition-colors cursor-pointer text-left font-semibold"
                                >
                                  <Send size={13} className="shrink-0" />
                                  <span>Wyślij zaproszenie do aplikacji</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenMenuUserId(null);
                                    setScratchpadStudent(user);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/15 text-emerald-300 flex items-center gap-2 transition-colors cursor-pointer text-left font-semibold"
                                >
                                  <FileEdit size={13} className="shrink-0" />
                                  <span>Otwórz współdzielony Brudnopis (PIN)</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setOpenMenuUserId(null);
                                    setNotionSyncUser(user);
                                    setShowNotionSyncModal(true);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-white flex items-center gap-2 transition-colors cursor-pointer text-left"
                                >
                                  <RefreshCw size={13} className="text-primary shrink-0" />
                                  <span>Pobierz / Zaktualizuj z Notion</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenMenuUserId(null);
                                    onSelectUser(user, 'profile');
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-white flex items-center gap-2 transition-colors cursor-pointer text-left"
                                >
                                  <UserIcon size={13} className="text-primary shrink-0" />
                                  <span>Przejdź do profilu</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenMenuUserId(null);
                                    onSelectUser(user, 'lesson-planner');
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-white flex items-center gap-2 transition-colors cursor-pointer text-left"
                                >
                                  <Sparkles size={13} className="text-primary shrink-0" />
                                  <span>Planer lekcji</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenMenuUserId(null);
                                    onSelectUser(user, 'homework');
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-white flex items-center gap-2 transition-colors cursor-pointer text-left"
                                >
                                  <BookOpen size={13} className="text-primary shrink-0" />
                                  <span>Prace domowe</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenMenuUserId(null);
                                    handleOpenEditEmail(user);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-white flex items-center gap-2 transition-colors cursor-pointer text-left"
                                >
                                  <Mail size={13} className="text-primary shrink-0" />
                                  <span>Edytuj adres e-mail</span>
                                </button>
                                <div className="border-t border-white/5 my-1" />
                                <button
                                  onClick={() => {
                                    setOpenMenuUserId(null);
                                    setUserToDelete(user);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-danger/20 text-danger flex items-center gap-2 transition-colors cursor-pointer text-left font-semibold"
                                >
                                  <Trash2 size={13} className="shrink-0" />
                                  <span>Usuń kursanta</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Summary */}
        <div className="p-3.5 bg-black/40 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-content-muted gap-2">
          <div className="flex items-center gap-2">
            <span>
              Wyświetlono <strong className="text-white">{filteredUsers.length}</strong> z{' '}
              <strong className="text-white">{users.length}</strong> kursantów
            </span>
            {selectedUserIds.size > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-bold text-[11px]">
                Zaznaczono: {selectedUserIds.size}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>Uczniowie: <strong className="text-primary">{countStudents}</strong></span>
            <span>Nauczyciele & Admini: <strong className="text-white">{countStaff}</strong></span>
            <span>Wymagają uzupełnienia e-mail: <strong className="text-warn">{countPlaceholder}</strong></span>
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedUserIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[calc(100%-2rem)] bg-base-100/95 border border-primary/40 shadow-2xl backdrop-blur-xl px-4 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs">
              {selectedUserIds.size}
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Zaznaczono {selectedUserIds.size} {selectedUserIds.size === 1 ? 'kursanta' : 'kursantów'}</span>
              </div>
              <p className="text-[11px] text-content-muted">
                Wybierz operację masową dla zaznaczonych rekordów
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBulkEditOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-primary text-accent-ink hover:opacity-90 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <SlidersHorizontal size={14} />
              <span>Modyfikuj wspólne</span>
            </button>

            <button
              onClick={() => setIsBulkDeleteOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Trash2 size={14} />
              <span>Usuń</span>
            </button>

            <button
              onClick={clearSelection}
              className="p-2 rounded-xl hover:bg-white/10 text-content-muted hover:text-white transition-colors cursor-pointer"
              title="Odznacz wszystkich"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Notion Fetch / Sync Modal */}
      {showNotionSyncModal && notionSyncUser && (
        <StudentNotionSyncModal
          isOpen={showNotionSyncModal}
          onClose={() => {
            setShowNotionSyncModal(false);
            setNotionSyncUser(null);
          }}
          selectedUser={notionSyncUser}
          onSyncComplete={() => {
            if (onRefreshUsers) {
              onRefreshUsers();
            }
          }}
        />
      )}

      {/* Student App Invite Modal */}
      {showInviteModal && inviteStudent && (
        <StudentInviteEmailModal
          isOpen={showInviteModal}
          onClose={() => {
            setShowInviteModal(false);
            setInviteStudent(null);
          }}
          student={inviteStudent}
          onInviteSent={async () => {
            if (onRefreshUsers) {
              await onRefreshUsers();
            }
          }}
        />
      )}

      {/* Single User Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-base-100 border border-danger/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-danger/15 text-danger border border-danger/30">
                  <Trash2 size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Usuń kursanta</h3>
                  <p className="text-xs text-content-muted">
                    {userToDelete.firstName || userToDelete.lastName
                      ? `${userToDelete.firstName || ''} ${userToDelete.lastName || ''}`.trim()
                      : userToDelete.username}{' '}
                    <span className="font-mono">(@{userToDelete.username})</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setUserToDelete(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-content-muted hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-xs text-danger leading-relaxed space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle size={14} /> Ta operacja jest nieodwracalna!
              </p>
              <p>
                Profil zostanie skasowany z bazy danych Firestore oraz z systemu uwierzytelniania Firebase Auth.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <Button
                variant="secondary"
                onClick={() => setUserToDelete(null)}
                disabled={isDeletingUser}
              >
                Anuluj
              </Button>
              <Button
                onClick={async () => {
                  if (!userToDelete) return;
                  try {
                    setIsDeletingUser(true);
                    if (onDeleteUser) {
                      await onDeleteUser(userToDelete.id);
                    }
                    setUserToDelete(null);
                    setSelectedUserIds((prev) => {
                      const next = new Set(prev);
                      next.delete(userToDelete.id);
                      return next;
                    });
                  } catch (err: any) {
                    alert('Błąd podczas usuwania: ' + (err.message || String(err)));
                  } finally {
                    setIsDeletingUser(false);
                  }
                }}
                isLoading={isDeletingUser}
                className="bg-danger hover:bg-danger/90 text-white font-bold"
              >
                Usuń trwale
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {isBulkEditOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-base-100 border border-primary/30 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-primary/15 text-primary border border-primary/25">
                  <SlidersHorizontal size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Modyfikacja wspólnych elementów</h3>
                  <p className="text-xs text-content-muted">
                    Zaznaczono <strong className="text-primary">{selectedUserIds.size}</strong> {selectedUserIds.size === 1 ? 'kursanta' : 'kursantów'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkEditOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-content-muted hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-content-muted leading-relaxed">
              Wybierz wartości, które chcesz przypisać wszystkim zaznaczonym użytkownikom. Pola oznaczone jako <em>„(Bez zmian)”</em> nie zmodyfikują obecnych danych kursantów.
            </p>

            <div className="space-y-4">
              {/* CEFR Level */}
              <div>
                <label className="block text-xs font-bold text-content-muted mb-1.5 uppercase tracking-wider">
                  Poziom zaawansowania (CEFR)
                </label>
                <select
                  value={bulkLevel}
                  onChange={(e) => setBulkLevel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="no_change">— (Bez zmian) —</option>
                  <option value="A1">A1 (Beginner)</option>
                  <option value="A2">A2 (Elementary)</option>
                  <option value="B1">B1 (Intermediate)</option>
                  <option value="B2">B2 (Upper-Intermediate)</option>
                  <option value="C1">C1 (Advanced)</option>
                  <option value="C2">C2 (Proficiency)</option>
                </select>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-bold text-content-muted mb-1.5 uppercase tracking-wider">
                  Uprawnienia i rola w systemie
                </label>
                <select
                  value={bulkRole}
                  onChange={(e) => setBulkRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="no_change">— (Bez zmian) —</option>
                  <option value="user">👤 Kursant (Uczeń)</option>
                  <option value="teacher">👨‍🏫 Nauczyciel (Lektor)</option>
                  <option value="admin">🛡️ Administrator</option>
                </select>
              </div>

              {/* Email Notifications */}
              <div>
                <label className="block text-xs font-bold text-content-muted mb-1.5 uppercase tracking-wider">
                  Powiadomienia e-mail (Mailing)
                </label>
                <select
                  value={bulkEmailNotifications}
                  onChange={(e) => setBulkEmailNotifications(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="no_change">— (Bez zmian) —</option>
                  <option value="enabled">Włącz powiadomienia e-mail (aktywne)</option>
                  <option value="disabled">Wyłącz powiadomienia e-mail (wypisany)</option>
                </select>
              </div>
            </div>

            {bulkEditSuccess && (
              <div className="p-3 bg-primary/10 border border-primary/30 text-primary rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
                <CheckCircle2 size={16} />
                <span>Pomyślnie zaktualizowano dane zaznaczonych kursantów!</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <Button
                variant="secondary"
                onClick={() => setIsBulkEditOpen(false)}
                disabled={isApplyingBulkEdit}
              >
                Anuluj
              </Button>
              <Button
                onClick={handleBulkEditSubmit}
                isLoading={isApplyingBulkEdit}
                disabled={
                  bulkLevel === 'no_change' &&
                  bulkRole === 'no_change' &&
                  bulkEmailNotifications === 'no_change'
                }
                className="bg-primary text-accent-ink font-bold"
              >
                Zapisz zmiany ({selectedUserIds.size})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-base-100 border border-danger/40 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-danger/15 text-danger border border-danger/30">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Masowe usuwanie kursantów</h3>
                  <p className="text-xs text-content-muted">
                    Zaznaczono <strong className="text-danger">{selectedUserIds.size}</strong> {selectedUserIds.size === 1 ? 'konto' : 'kont'} do usunięcia
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkDeleteOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-content-muted hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-xs text-danger leading-relaxed space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle size={15} /> Ta operacja jest całkowicie NIEODWRACALNA!
              </p>
              <p>
                Wszystkie zaznaczone profile zostaną trwale skasowane z bazy danych Firestore oraz z systemu Firebase Authentication. Kursanci stracą dostęp do platformy, a ich historia lekcji i prac domowych zostanie usunięta.
              </p>
            </div>

            {/* List of users to be deleted */}
            <div>
              <label className="block text-xs font-bold text-content-muted mb-1.5 uppercase tracking-wider">
                Lista kont do usunięcia:
              </label>
              <div className="max-h-40 overflow-y-auto rounded-xl bg-black/40 border border-white/10 p-2 space-y-1.5 divide-y divide-white/5">
                {users
                  .filter((u) => selectedUserIds.has(u.id))
                  .map((u) => (
                    <div key={u.id} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-white truncate">
                          {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username}
                        </div>
                        <div className="text-[11px] text-content-muted font-mono truncate">
                          {u.email || `@${u.username}`}
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-content-muted uppercase">
                        {u.role || 'user'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <Button
                variant="secondary"
                onClick={() => setIsBulkDeleteOpen(false)}
                disabled={isApplyingBulkDelete}
              >
                Anuluj
              </Button>
              <Button
                onClick={handleBulkDeleteSubmit}
                isLoading={isApplyingBulkDelete}
                className="bg-danger hover:bg-danger/90 text-white font-bold flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Potwierdź i usuń trwale ({selectedUserIds.size})</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Email Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-base-100 border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Edytuj adres e-mail kursanta</h3>
                  <p className="text-xs text-content-muted">
                    {editingUser.firstName || editingUser.lastName
                      ? `${editingUser.firstName || ''} ${editingUser.lastName || ''}`.trim()
                      : editingUser.username}{' '}
                    <span className="font-mono">(@{editingUser.username})</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-content-muted hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {editEmailError && (
              <div className="p-3 bg-danger/10 border border-danger/20 text-danger rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{editEmailError}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-content-muted uppercase tracking-wider">
                Adres e-mail kursanta
              </label>
              <input
                type="email"
                value={editEmailInput}
                onChange={(e) => setEditEmailInput(e.target.value)}
                placeholder="np. jan.kowalski@gmail.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-primary"
                autoFocus
              />
              <div className="text-[11px] text-content-muted space-y-1 pt-1">
                <p>
                  • Zmiana adresu zaktualizuje profil w bazie Firestore oraz konto uwierzytelniania Firebase Auth.
                </p>
                <p>
                  • Umożliwi poprawną wysyłkę powiadomień przez Resend bez korzystania z adresów zastępczych.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <Button
                variant="secondary"
                onClick={() => setEditingUser(null)}
                disabled={isSavingEmail}
              >
                Anuluj
              </Button>
              <Button
                onClick={handleSaveEmail}
                isLoading={isSavingEmail}
                disabled={!editEmailInput.trim()}
              >
                Zapisz e-mail
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Brudnopisu Lekcyjnego */}
      {scratchpadStudent && (
        <ScratchpadModal
          isOpen={!!scratchpadStudent}
          onClose={() => setScratchpadStudent(null)}
          student={{
            id: scratchpadStudent.id,
            name: scratchpadStudent.firstName
              ? `${scratchpadStudent.firstName} ${scratchpadStudent.lastName || ''}`.trim()
              : scratchpadStudent.username,
          }}
        />
      )}
    </div>
  );
};


export default StudentDatabaseScreen;

