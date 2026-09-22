import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Archive, Check, X, AlertCircle, Loader2, BookOpen, Search } from 'lucide-react';
import { Group, GroupWithMembers, User } from '../../types';
import { auth } from '../../firebase';
import Button from '../ui/Button';
import Card from '../ui/Card';

interface GroupsManagerProps {
  students: User[];
  onOpenScratchpad?: (scratchpadId: string) => void;
}

export const GroupsManager: React.FC<GroupsManagerProps> = ({ students, onOpenScratchpad }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal tworzenia / edycji
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    level: 'B2',
    company: '',
    selectedMemberIds: [] as string[],
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchGroups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/groups', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nie udało się pobrać grup');
      setGroups(data.groups || []);
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd podczas ładowania grup');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingGroup(null);
    setStudentSearchQuery('');
    setFormData({
      name: '',
      level: 'B2',
      company: '',
      selectedMemberIds: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (group: Group) => {
    setEditingGroup(group);
    setStudentSearchQuery('');
    setFormData({
      name: group.name,
      level: group.level || 'B2',
      company: group.company || '',
      selectedMemberIds: group.memberProfileIds || [],
    });
    setIsModalOpen(true);
  };

  const handleToggleMember = (rawStudentId: string) => {
    const studentId = String(rawStudentId || '').trim();
    if (!studentId) {
      console.warn('[GroupsManager] Ostrzeżenie: brak studentId przy próbie zaznaczenia');
      return;
    }

    setFormData(prev => {
      const exists = prev.selectedMemberIds.includes(studentId);
      const nextSelected = exists
        ? prev.selectedMemberIds.filter(id => id !== studentId)
        : [...prev.selectedMemberIds, studentId];

      console.log('[GroupsManager] Toggle:', studentId, 'Now selected:', nextSelected);

      return {
        ...prev,
        selectedMemberIds: nextSelected,
      };
    });
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      if (editingGroup) {
        // Update
        const res = await fetch(`/api/groups/${editingGroup.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            name: formData.name.trim(),
            level: formData.level,
            company: formData.company ? formData.company.trim() : undefined,
            memberProfileIds: formData.selectedMemberIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Nie udało się zaktualizować grupy');
      } else {
        // Create
        const res = await fetch('/api/groups', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: formData.name.trim(),
            level: formData.level,
            company: formData.company ? formData.company.trim() : undefined,
            memberProfileIds: formData.selectedMemberIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Nie udało się utworzyć grupy');
      }

      setIsModalOpen(false);
      await fetchGroups();
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd podczas zapisywania');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleArchive = async (group: Group) => {
    const newStatus = group.status === 'active' ? 'archived' : 'active';
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/groups/${group.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Błąd zmiany statusu');
      await fetchGroups();
    } catch (err: any) {
      alert(err.message || 'Nie udało się zmienić statusu grupy');
    }
  };

  // Filtrujemy tylko aktywnych kursantów do dodawania do grupy
  const activeStudents = students.filter(s => !s.isArchived && !s.isSuspended && s.statusWspolpracy !== 'Nieaktywny');

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Nagłówek */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-ink/40 p-6 rounded-2xl border border-line-strong backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold text-text-hi flex items-center gap-3">
            <Users className="w-7 h-7 text-primary" />
            Zarządzanie Grupami Lekcyjnymi
          </h1>
          <p className="text-sm text-text-mute mt-1">
            Twórz grupy, zarządzaj składem osobowym i przypisuj prace domowe całej grupie jednym kliknięciem (Fan-Out).
          </p>
        </div>
        <Button onClick={handleOpenCreateModal} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nowa grupa
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Lista grup */}
      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : groups.length === 0 ? (
        <Card className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-text-mute mb-3 opacity-50" />
          <h3 className="text-lg font-bold text-text-hi">Brak utworzonych grup</h3>
          <p className="text-sm text-text-mute mt-1 max-w-md mx-auto">
            Nie masz jeszcze żadnych aktywnych grup. Kliknij przycisk powyżej, aby utworzyć swoją pierwszą grupę kursantów.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map(group => {
            const memberCount = group.memberProfileIds?.length || 0;
            const isArchived = group.status === 'archived';

            return (
              <Card
                key={group.id}
                className={`flex flex-col justify-between transition-all duration-200 border ${
                  isArchived ? 'opacity-60 bg-base-200/50 border-line-weak' : 'hover:border-primary/50'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">
                      Poziom: {group.level}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-md ${
                        isArchived ? 'bg-zinc-800 text-zinc-400' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {isArchived ? 'Zarchiwizowana' : 'Aktywna'}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-text-hi mb-1">{group.name}</h3>
                  {group.company && (
                    <p className="text-xs text-text-mute mb-3 font-medium">Firma: {group.company}</p>
                  )}

                  <div className="mt-4 pt-4 border-t border-line-weak/50">
                    <div className="flex items-center justify-between text-xs text-text-2">
                      <span>Liczba kursantów:</span>
                      <span className="font-bold text-text-hi bg-ink px-2 py-0.5 rounded border border-line-weak">
                        {memberCount}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-line-weak flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenEditModal(group)}
                      className="flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edytuj
                    </Button>
                    {group.activeScratchpadId && onOpenScratchpad && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenScratchpad(group.activeScratchpadId!)}
                        className="flex items-center gap-1.5"
                        title="Otwórz wspólny notatnik A4"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-accent" />
                        Notatnik
                      </Button>
                    )}
                  </div>

                  <button
                    onClick={() => handleToggleArchive(group)}
                    className="p-2 text-text-mute hover:text-text-hi hover:bg-ink rounded-lg transition-colors"
                    title={isArchived ? 'Przywróć grupę' : 'Zarchiwizuj grupę'}
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Tworzenia / Edycji Grupy */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-base-100 dark:bg-dark-base-100 w-full max-w-xl rounded-2xl border border-line-strong shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-line-weak flex justify-between items-center">
              <h2 className="text-xl font-bold text-text-hi flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                {editingGroup ? 'Edytuj grupę' : 'Nowa grupa'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-mute hover:text-text-hi transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-text-faint uppercase tracking-wider mb-2">
                  Nazwa grupy *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="np. Business English B2 — Poniedziałki 18:00"
                  className="w-full px-4 py-2.5 bg-ink border border-line-strong rounded-xl text-text-hi placeholder-text-mute focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-faint uppercase tracking-wider mb-2">
                    Poziom
                  </label>
                  <select
                    value={formData.level}
                    onChange={e => setFormData({ ...formData, level: e.target.value })}
                    className="w-full px-4 py-2.5 bg-ink border border-line-strong rounded-xl text-text-hi focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="A1">A1 (Początkujący)</option>
                    <option value="A2">A2 (Podstawowy)</option>
                    <option value="B1">B1 (Średniozaawansowany)</option>
                    <option value="B2">B2 (Wyższy średniozaawansowany)</option>
                    <option value="C1">C1 (Zaawansowany)</option>
                    <option value="C2">C2 (Biegły)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-faint uppercase tracking-wider mb-2">
                    Firma / Klient (opcjonalnie)
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                    placeholder="np. Acme Corp"
                    className="w-full px-4 py-2.5 bg-ink border border-line-strong rounded-xl text-text-hi placeholder-text-mute focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-text-faint uppercase tracking-wider">
                    Wybierz członków ({formData.selectedMemberIds.length} wybranych)
                  </label>
                  <span className="text-xs text-text-mute">Maksymalnie 10-12 osób</span>
                </div>

                {/* Szybka wyszukiwarka kursantów */}
                <div className="relative mb-2">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-mute pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Szukaj kursanta (imię, nazwisko, email, firma)..."
                    value={studentSearchQuery}
                    onChange={e => setStudentSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-ink border border-line-strong rounded-xl text-xs text-text-hi placeholder-text-mute focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {studentSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setStudentSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-mute hover:text-text-hi text-xs p-0.5"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto border border-line-strong rounded-xl divide-y divide-line-weak/40 bg-ink/40 p-2 space-y-1">
                  {(() => {
                    const query = studentSearchQuery.trim().toLowerCase();
                    const filtered = activeStudents.filter(student => {
                      if (!query) return true;
                      const fullName = `${student.firstName || ''} ${student.lastName || ''} ${student.displayName || ''} ${student.username || ''}`.toLowerCase();
                      const email = (student.email || '').toLowerCase();
                      const company = (student.company || '').toLowerCase();
                      return fullName.includes(query) || email.includes(query) || company.includes(query);
                    });

                    if (filtered.length === 0) {
                      return (
                        <p className="text-xs text-text-mute p-3 text-center">
                          {studentSearchQuery ? 'Brak kursantów pasujących do filtra.' : 'Brak aktywnych kursantów w bazie.'}
                        </p>
                      );
                    }

                    return filtered.map(student => {
                      const studentId = String((student as any).uid || student.id || (student as any).profileId || student.username || '').trim();
                      if (!studentId) return null;
                      const isSelected = formData.selectedMemberIds.includes(studentId);
                      const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.displayName || student.username;

                      return (
                        <button
                          key={studentId}
                          type="button"
                          onClick={() => handleToggleMember(studentId)}
                          className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all cursor-pointer ${
                            isSelected ? 'bg-primary/15 border border-primary/40' : 'hover:bg-ink border border-transparent'
                          }`}
                        >
                          <div className="flex flex-col flex-1 min-w-0 pr-3">
                            <span className={`text-sm font-medium truncate ${isSelected ? 'text-primary font-bold' : 'text-text-hi'}`}>
                              {fullName}
                            </span>
                            <span className="text-xs text-text-mute truncate">
                              {student.email || 'brak e-mail'} {student.company ? `· ${student.company}` : ''}
                            </span>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                              isSelected ? 'bg-primary border-primary text-black' : 'border-line-strong bg-ink'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="pt-4 border-t border-line-weak flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                >
                  Anuluj
                </Button>
                <Button type="submit" disabled={isSaving || !formData.name.trim()} className="flex items-center gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingGroup ? 'Zapisz zmiany' : 'Utwórz grupę'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
