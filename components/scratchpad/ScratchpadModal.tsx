import React, { useState, useEffect } from 'react';
import { X, FileText, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { ScratchpadDocument } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  getOrCreateStudentScratchpad,
  subscribeScratchpad,
  saveScratchpadContent,
  updateScratchpadSettings,
} from '../../services/scratchpadService';
import ScratchpadEditor from './ScratchpadEditor';

interface ScratchpadModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: {
    id?: string | null;
    name: string;
  };
  onPushToLessonRecord?: (data: {
    topic: string;
    words: string;
    summary: string;
    thingsToImprove: string;
    followUp: string;
  }) => void;
}

export const ScratchpadModal: React.FC<ScratchpadModalProps> = ({
  isOpen,
  onClose,
  student,
  onPushToLessonRecord,
}) => {
  const { user } = useAuth();
  const [scratchpadDoc, setScratchpadDoc] = useState<ScratchpadDocument | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pobierz lub utwórz stały brudnopis kursanta po otwarciu modalu
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const init = async () => {
      try {
        const teacherUid = user?.id || 'teacher_default';
        const teacherName = user?.firstName
          ? `${user.firstName} ${user.lastName || ''}`.trim()
          : user?.username || 'Lektor CRIBRO';

        const doc = await getOrCreateStudentScratchpad(
          { id: student.id || null, name: student.name || 'Kursant' },
          { uid: teacherUid, name: teacherName }
        );

        if (isMounted) {
          setScratchpadDoc(doc);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('Błąd inicjalizacji Scratchpada:', err);
        if (isMounted) {
          setError(err.message || 'Nie udało się załadować brudnopisu.');
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [isOpen, student.id, student.name, user]);

  // Subskrypcja na żywo
  useEffect(() => {
    if (!isOpen || !scratchpadDoc?.id) return;

    const unsubscribe = subscribeScratchpad(scratchpadDoc.id, (updated) => {
      if (updated) {
        setScratchpadDoc(updated);
      }
    });

    return () => unsubscribe();
  }, [isOpen, scratchpadDoc?.id]);

  if (!isOpen) return null;

  const handleSaveContent = async (html: string, text: string) => {
    if (!scratchpadDoc?.id) return;
    const teacherUid = user?.id || 'teacher_default';
    const teacherName = user?.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : user?.username || 'Lektor';

    await saveScratchpadContent(scratchpadDoc.id, html, text, {
      uid: teacherUid,
      name: teacherName,
      role: 'teacher',
    });
  };

  const handleToggleStudentEdit = async (allow: boolean) => {
    if (!scratchpadDoc?.id) return;
    await updateScratchpadSettings(scratchpadDoc.id, { allowStudentEdit: allow });
    setScratchpadDoc(prev => prev ? { ...prev, allowStudentEdit: allow } : null);
  };

  const handlePush = (data: any) => {
    if (onPushToLessonRecord) {
      onPushToLessonRecord(data);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl h-[90vh] max-h-[920px] bg-base-100 rounded-3xl border border-white/15 shadow-2xl flex flex-col overflow-hidden">
        {/* Przycisk zamknięcia */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-4 z-20 p-2 rounded-xl bg-base-300/80 text-content-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Zamknij brudnopis"
        >
          <X size={18} />
        </button>

        {/* Zawartość okna */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm font-semibold text-content-muted">Ładowanie brudnopisu lekcyjnego...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 max-w-md">
              <AlertCircle size={28} className="mx-auto mb-2" />
              <p className="font-bold text-sm">Nie udało się otworzyć brudnopisu</p>
              <p className="text-xs mt-1 opacity-80">{error}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-base-300 text-white text-xs font-bold hover:bg-base-200"
            >
              Zamknij
            </button>
          </div>
        ) : scratchpadDoc ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <ScratchpadEditor
              document={scratchpadDoc}
              onSaveContent={handleSaveContent}
              onToggleStudentEdit={handleToggleStudentEdit}
              onPushToLessonRecord={onPushToLessonRecord ? handlePush : undefined}
              currentUser={{
                uid: user?.id || 'teacher',
                name: user?.firstName || user?.username || 'Lektor',
                role: 'teacher',
              }}
              className="h-full rounded-none border-0 shadow-none"
              autoFocus
            />
          </div>
        ) : null}

      </div>
    </div>
  );
};

export default ScratchpadModal;
