import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  BookOpen,
  Airplay,
  Building,
  UserCheck,
  UserPlus,
  Sparkles,
  Layers,
  Check
} from 'lucide-react';
import { StudentGroup, User } from '../../types';
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  ensureGroupScratchpad,
} from '../../services/groupService';
import { useEscapeModal } from '../../hooks/useEscapeModal';
import Button from '../ui/Button';
import { openScratchpadTab } from '../../services/scratchpadService';
import { confirmAsync } from '../../utils/appAlert';

interface GroupManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  currentTeacher: { uid: string; name: string };
  onOpenScratchpad?: (scratchpadId: string) => void;
  onAssignHomework?: (group: StudentGroup) => void;
}

export const GroupManagementModal: React.FC<GroupManagementModalProps> = ({
  isOpen,
  onClose,
  users,
  currentTeacher,
  onOpenScratchpad,
  onAssignHomework,
}) => {
  useEscapeModal(isOpen, onClose);

  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<StudentGroup['type']>('pair');
  const [formLevel, setFormLevel] = useState('B2');
  const [formCompany, setFormCompany] = useState('');
  const [formSelectedMemberIds, setFormSelectedMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  const loadGroups = async () => {
    setIsLoading(true);
    try {
      const list = await getGroups();
      setGroups(list);
    } catch (err) {
      console.warn('[GroupManagementModal] Błąd pobierania grup:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadGroups();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpenCreate = () => {
    setIsCreating(true);
    setEditingGroupId(null);
    setFormName('');
    setFormType('pair');
    setFormLevel('B2');
    setFormCompany('');
    setFormSelectedMemberIds([]);
  };

  const handleOpenEdit = (group: StudentGroup) => {
    setIsCreating(true);
    setEditingGroupId(group.id);
    setFormName(group.name);
    setFormType(group.type);
    setFormLevel(group.level);
    setFormCompany(group.company || '');
    setFormSelectedMemberIds(group.memberIds || []);
  };

  const handleToggleMember = (userId: string) => {
    setFormSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSaveGroup = async () => {
    if (!formName.trim() || formSelectedMemberIds.length === 0) return;

    const selectedMembers = users.filter((u) => formSelectedMemberIds.includes(u.id));
    const memberNames = selectedMembers.map((u) => u.name || u.username || 'Kursant');
    const memberEmails = selectedMembers.map((u) => u.email).filter(Boolean) as string[];

    try {
      if (editingGroupId) {
        await updateGroup(editingGroupId, {
          name: formName.trim(),
          type: formType,
          level: formLevel,
          company: formCompany.trim() || undefined,
          memberIds: formSelectedMemberIds,
          memberNames,
          memberEmails,
        });
      } else {
        const newGroup = await createGroup({
          name: formName.trim(),
          type: formType,
          teacherId: currentTeacher.uid,
          teacherName: currentTeacher.name,
          level: formLevel,
          company: formCompany.trim() || undefined,
          memberIds: formSelectedMemberIds,
          memberNames,
          memberEmails,
          status: 'active',
        });

        // Automatyczne założenie notatnika grupowego
        await ensureGroupScratchpad(newGroup, currentTeacher);
      }

      await loadGroups();
      setIsCreating(false);
    } catch (err) {
      console.error('[GroupManagementModal] Błąd zapisu grupy:', err);
    }
  };

  const handleDelete = async (groupId: string) => {
    if (!(await confirmAsync('Czy na pewno chcesz usunąć tę grupę? Notatnik i historia zostaną zachowane.'))) return;
    try {
      await deleteGroup(groupId);
      await loadGroups();
    } catch (err) {
      console.error('[GroupManagementModal] Błąd usuwania grupy:', err);
    }
  };

  const handleLaunchGroupScratchpad = async (group: StudentGroup) => {
    try {
      const scratchpadId = await ensureGroupScratchpad(group, currentTeacher);
      openScratchpadTab(scratchpadId);
    } catch (err) {
      console.error('[GroupManagementModal] Błąd otwierania notatnika grupy:', err);
    }
  };

  const filteredUsers = users.filter((u) =>
    ((u.name || '') + ' ' + (u.username || '') + ' ' + (u.email || '')).toLowerCase().includes(memberSearch.toLowerCase())
  );

  const filteredGroups = groups.filter((g) =>
    (g.name + ' ' + (g.company || '') + ' ' + g.memberNames.join(' ')).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-management-title"
        className="relative w-full max-w-4xl bg-base-200 border border-primary/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-line-strong bg-base-300/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
              <Users size={22} />
            </div>
            <div>
              <h3 id="group-management-title" className="text-base sm:text-lg font-bold text-text-hi">
                Zarządzanie Kursami Grupowymi & Parami
              </h3>
              <p className="text-xs text-content-muted">
                Wspólne notatniki, zadania grupowe i synchronizacja lekcji na żywo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Zamknij"
            className="p-2 rounded-xl text-content-muted hover:text-text-hi hover:bg-line-soft transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {!isCreating ? (
            <>
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Szukaj grupy, firmy lub kursanta..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-base-300 border border-line-strong text-text-hi text-xs focus:outline-none focus:border-primary"
                  />
                </div>
                <Button
                  variant="primary"
                  onClick={handleOpenCreate}
                  className="flex items-center justify-center gap-2 text-xs font-bold whitespace-nowrap"
                >
                  <Plus size={16} /> Dodaj nową grupę / parę
                </Button>
              </div>

              {/* Groups List */}
              {isLoading ? (
                <div className="p-12 text-center text-xs text-content-muted">Ładowanie grup...</div>
              ) : filteredGroups.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-line-soft bg-base-300/30">
                  <Users size={32} className="mx-auto text-content-muted/60 mb-2" />
                  <p className="text-sm font-semibold text-text-hi">Brak skonfigurowanych grup</p>
                  <p className="text-xs text-content-muted mt-1 max-w-sm mx-auto">
                    Utwórz pierwszą grupę lub parę, aby automatycznie wygenerować wspólny notatnik lekcyjny i przypisywać zadania grupowe.
                  </p>
                  <Button
                    variant="primary"
                    onClick={handleOpenCreate}
                    className="mt-4 inline-flex items-center gap-2 text-xs font-bold"
                  >
                    <Plus size={14} /> Stwórz grupę teraz
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredGroups.map((group) => (
                    <div
                      key={group.id}
                      className="p-4 sm:p-5 rounded-2xl bg-base-300/40 border border-line-soft hover:border-line-strong transition-all flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold border border-primary/30">
                              {group.type === 'pair' ? 'Para (2 os.)' : group.type === 'triplet' ? 'Trójka (3 os.)' : 'Grupa'}
                            </span>
                            <span className="text-xs font-bold text-content-muted bg-white/5 px-2 py-0.5 rounded-md">
                              {group.level}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEdit(group)}
                              className="p-1.5 rounded-lg text-content-muted hover:text-text-hi hover:bg-white/5 transition-colors"
                              title="Edytuj grupę"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(group.id)}
                              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                              title="Usuń grupę"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <h4 className="text-base font-bold text-text-hi mb-1">{group.name}</h4>
                        {group.company && (
                          <p className="text-xs text-content-muted flex items-center gap-1 mb-2">
                            <Building size={12} /> {group.company}
                          </p>
                        )}

                        {/* Członkowie */}
                        <div className="mt-3">
                          <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1.5">
                            Członkowie ({group.memberNames.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {group.memberNames.map((name, i) => (
                              <span
                                key={i}
                                className="text-xs px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-text-hi flex items-center gap-1"
                              >
                                <UserCheck size={11} className="text-primary" /> {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Akcje grupy */}
                      <div className="pt-3 border-t border-line-soft flex items-center gap-2">
                        <Button
                          variant="primary"
                          onClick={() => handleLaunchGroupScratchpad(group)}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold"
                        >
                          <BookOpen size={14} /> Notatnik
                        </Button>
                        {onAssignHomework && (
                          <Button
                            variant="ghost"
                            onClick={() => onAssignHomework(group)}
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold"
                          >
                            <UserPlus size={14} /> Zadaj pracę domową
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Formularz tworzenia / edycji grupy */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-line-soft">
                <h4 className="text-base font-bold text-text-hi">
                  {editingGroupId ? 'Edycja grupy' : 'Nowa grupa / para'}
                </h4>
                <Button variant="ghost" onClick={() => setIsCreating(false)} className="text-xs">
                  Anuluj
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-text-hi mb-1 block">
                    Nazwa grupy / pary *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="np. Para: Anna & Piotr lub B2B IT Team"
                    className="w-full p-2.5 rounded-xl bg-base-300 border border-line-strong text-text-hi text-xs focus:outline-none focus:border-primary font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-text-hi mb-1 block">
                    Typ kursu grupowego
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-base-300 border border-line-strong text-text-hi text-xs focus:outline-none focus:border-primary"
                  >
                    <option value="pair">Para (2 kursantów)</option>
                    <option value="triplet">Trójka (3 kursantów)</option>
                    <option value="group">Grupa otwarta (4+ kursantów)</option>
                    <option value="b2b_corporate">Grupa firmowa / B2B</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-hi mb-1 block">
                    Poziom zaawansowania (CEFR)
                  </label>
                  <select
                    value={formLevel}
                    onChange={(e) => setFormLevel(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-base-300 border border-line-strong text-text-hi text-xs focus:outline-none focus:border-primary"
                  >
                    <option value="A1">A1 — Początkujący</option>
                    <option value="A2">A2 — Podstawowy</option>
                    <option value="B1">B1 — Średniozaawansowany</option>
                    <option value="B2">B2 — Wyższy średniozaawansowany</option>
                    <option value="C1">C1 — Zaawansowany</option>
                    <option value="C2">C2 — Biegły</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-hi mb-1 block">
                    Firma / Klient B2B (opcjonalnie)
                  </label>
                  <input
                    type="text"
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    placeholder="np. Accenture / Google"
                    className="w-full p-2.5 rounded-xl bg-base-300 border border-line-strong text-text-hi text-xs focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Wybór członków grupy */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-text-hi">
                    Wybierz członków grupy ({formSelectedMemberIds.length} zaznaczonych) *
                  </label>
                  <span className="text-[11px] text-content-muted">
                    Zaznacz kursantów z bazy
                  </span>
                </div>

                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Filtruj kursantów..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-base-300 border border-line-strong text-text-hi text-xs focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto border border-line-strong rounded-xl p-2 bg-base-300/40 space-y-1">
                  {filteredUsers.map((u) => {
                    const isSelected = formSelectedMemberIds.includes(u.id);
                    return (
                      <div
                        key={u.id}
                        onClick={() => handleToggleMember(u.id)}
                        className={`p-2 rounded-lg flex items-center justify-between text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary/20 text-primary border border-primary/40 font-semibold'
                            : 'hover:bg-white/5 text-text-hi'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center text-[10px] border ${
                              isSelected ? 'bg-primary text-ink-base border-primary' : 'border-line-strong'
                            }`}
                          >
                            {isSelected && <Check size={12} />}
                          </div>
                          <span>{u.name || u.username}</span>
                          {u.email && <span className="text-content-muted text-[11px]">({u.email})</span>}
                        </div>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 text-content-muted">
                          {u.level || 'B2'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Zapis */}
              <div className="flex justify-end gap-2 pt-3 border-t border-line-soft">
                <Button variant="ghost" onClick={() => setIsCreating(false)} className="text-xs">
                  Anuluj
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveGroup}
                  disabled={!formName.trim() || formSelectedMemberIds.length === 0}
                  className="text-xs font-bold flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} /> Zapisz grupę i utwórz notatnik
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupManagementModal;
