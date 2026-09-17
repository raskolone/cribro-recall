import React, { useState } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { User } from '../../types';
import { addCachedUser, updateCachedUser, UserWithId } from '../../services/userService';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { X, Users, UserPlus, Check, Building, ShieldCheck, Award } from 'lucide-react';
import { useEscapeModal } from '../../hooks/useEscapeModal';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableStudents: User[];
  groupToEdit?: User | null;
  onGroupSaved?: (group: User) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  availableStudents,
  groupToEdit,
  onGroupSaved,
}) => {
  useEscapeModal(isOpen, onClose);

  const [groupName, setGroupName] = useState(groupToEdit?.displayName || groupToEdit?.name || '');
  const [groupType, setGroupType] = useState<'pair' | 'triplet' | 'group'>(
    groupToEdit?.groupType || 'pair'
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    groupToEdit?.memberIds || []
  );
  const [level, setLevel] = useState(groupToEdit?.level || 'A2+/B1 (Grupa mieszana)');
  const [company, setCompany] = useState(groupToEdit?.company || '');
  const [contractor, setContractor] = useState(groupToEdit?.contractor || 'JCL');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleStudent = (studentId: string) => {
    if (selectedMemberIds.includes(studentId)) {
      setSelectedMemberIds(selectedMemberIds.filter((id) => id !== studentId));
    } else {
      setSelectedMemberIds([...selectedMemberIds, studentId]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = groupName.trim();
    if (!cleanName) {
      setError('Podaj nazwę grupy lub pary.');
      return;
    }
    if (selectedMemberIds.length === 0) {
      setError('Wybierz przynajmniej jednego kursanta do grupy.');
      return;
    }

    setIsSaving(true);
    setError(null);

    const selectedMembers = availableStudents.filter((s) => s.id && selectedMemberIds.includes(s.id));
    const memberNames = selectedMembers.map(
      (s) => s.displayName || s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.username
    );
    const memberEmails = selectedMembers.map((s) => s.email).filter(Boolean).join(', ');

    const payload: Partial<User> = {
      username: `group_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      displayName: cleanName,
      name: cleanName,
      email: memberEmails || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_')}@group.cribro`,
      role: 'user', // for auth/app compatibility
      isGroup: true,
      groupType,
      memberIds: selectedMemberIds,
      memberNames,
      level,
      company: company.trim() || undefined,
      contractor: contractor.trim() || undefined,
      lessonType: 'Group',
      recordType: 'Grupa',
      statusWspolpracy: 'Aktywny',
      createdAt: groupToEdit?.createdAt || new Date().toISOString(),
    };

    try {
      if (groupToEdit?.id) {
        await updateDoc(doc(db, 'users', groupToEdit.id), payload);
        const updated = { ...groupToEdit, ...payload } as User;
        updateCachedUser(groupToEdit.id, payload);
        onGroupSaved?.(updated);
      } else {
        const docRef = await addDoc(collection(db, 'users'), payload);
        const created = { id: docRef.id, ...payload } as UserWithId;
        addCachedUser(created);
        onGroupSaved?.(created);
      }
      onClose();
    } catch (err: any) {
      console.error('Błąd zapisu grupy:', err);
      setError(err?.message || 'Nie udało się zapisać grupy.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/75 backdrop-blur-sm animate-fade-in">
      <Card className="w-full max-w-xl max-h-[90vh] flex flex-col border border-primary/30 shadow-2xl p-0 overflow-hidden bg-base-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-base-300/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {groupToEdit ? 'Edytuj Grupę Kursantów' : 'Nowy Kurs Grupowy (Para / Trójka / Grupa)'}
              </h2>
              <p className="text-xs text-content-muted">
                Połącz kursantów w grupę, aby prowadzić wspólne zajęcia i zadawać wspólne prace domowe
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-content-muted hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger font-semibold">
              {error}
            </div>
          )}

          {/* Typ grupy */}
          <div>
            <label className="block font-semibold text-content uppercase tracking-wider mb-1.5">
              Format zajęć
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setGroupType('pair')}
                className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition-all ${
                  groupType === 'pair'
                    ? 'bg-primary/20 text-primary border-primary/50'
                    : 'bg-black/30 text-content-muted border-white/10 hover:bg-white/5'
                }`}
              >
                <span>👥 Para (2 os.)</span>
              </button>
              <button
                type="button"
                onClick={() => setGroupType('triplet')}
                className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition-all ${
                  groupType === 'triplet'
                    ? 'bg-primary/20 text-primary border-primary/50'
                    : 'bg-black/30 text-content-muted border-white/10 hover:bg-white/5'
                }`}
              >
                <span>👥 Trójka (3 os.)</span>
              </button>
              <button
                type="button"
                onClick={() => setGroupType('group')}
                className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition-all ${
                  groupType === 'group'
                    ? 'bg-primary/20 text-primary border-primary/50'
                    : 'bg-black/30 text-content-muted border-white/10 hover:bg-white/5'
                }`}
              >
                <span>🏢 Grupa (4+ os.)</span>
              </button>
            </div>
          </div>

          {/* Nazwa grupy */}
          <div>
            <label className="block font-semibold text-content uppercase tracking-wider mb-1.5">
              Nazwa grupy / pary *
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="np. Grupa Gulermax, Para Kasia & Tomek, IT Developers..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white focus:outline-none focus:border-primary text-sm font-medium"
              required
            />
          </div>

          {/* Poziom & Kontraktor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-content uppercase tracking-wider mb-1.5">
                Poziom / profil CEFR
              </label>
              <input
                type="text"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="np. B1/B1+ Business English, Grupa mieszana A2-B1"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white focus:outline-none focus:border-primary text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-content uppercase tracking-wider mb-1.5">
                Kontraktor (Szkoła / Agencja)
              </label>
              <select
                value={contractor}
                onChange={(e) => setContractor(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white focus:outline-none focus:border-primary text-xs"
              >
                <option value="JCL">JCL (Kontraktor)</option>
                <option value="Inspiro">Inspiro</option>
                <option value="Axell">Axell</option>
                <option value="Direct">Direct (Klient bezpośredni)</option>
                <option value="Inne">Inne</option>
              </select>
            </div>
          </div>

          {/* Firma / Gdzie pracuje */}
          <div>
            <label className="block font-semibold text-content uppercase tracking-wider mb-1.5">
              Firma / Organizacja (Gdzie pracują)
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="np. Gulermax, DSV, Media Saturn, Kramp, Axell Logistics..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white focus:outline-none focus:border-primary text-xs"
            />
          </div>

          {/* Członkowie grupy (Multiselect) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-content uppercase tracking-wider">
                Wybierz członków ({selectedMemberIds.length} wybranych)
              </label>
              <span className="text-[11px] text-primary font-mono">
                {groupType === 'pair'
                  ? 'Zalecane: 2 kursantów'
                  : groupType === 'triplet'
                  ? 'Zalecane: 3 kursantów'
                  : '4 lub więcej kursantów'}
              </span>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-black/40 border border-white/10">
              {availableStudents
                .filter((s) => !s.isGroup && s.role === 'user')
                .map((student) => {
                  const sId = student.id || '';
                  const isChecked = selectedMemberIds.includes(sId);
                  const sName =
                    student.displayName ||
                    student.name ||
                    `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
                    student.username;

                  return (
                    <label
                      key={sId}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border ${
                        isChecked
                          ? 'bg-primary/15 border-primary/40 text-white'
                          : 'bg-white/5 border-transparent text-content-muted hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                            isChecked
                              ? 'bg-primary border-primary text-black'
                              : 'border-white/30 bg-black/40'
                          }`}
                        >
                          {isChecked && <Check size={11} className="stroke-[3]" />}
                        </div>
                        <div>
                          <span className="font-semibold text-xs block text-white">{sName}</span>
                          <span className="text-[10px] text-content-muted">{student.email || 'Brak emaila'}</span>
                        </div>
                      </div>
                      {student.level && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-primary border border-primary/20">
                          {student.level}
                        </span>
                      )}
                    </label>
                  );
                })}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit" isLoading={isSaving} className="flex items-center gap-1.5">
              <UserPlus size={14} />
              {groupToEdit ? 'Zapisz zmiany' : 'Utwórz grupę'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CreateGroupModal;
