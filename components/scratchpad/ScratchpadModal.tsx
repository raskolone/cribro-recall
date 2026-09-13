import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2, UserPlus, Check } from 'lucide-react';
import { ScratchpadDocument } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  adoptScratchpadForStudent,
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
  /**
   * Kursanci, których można przypisać BEZ wychodzenia z notatnika.
   *
   * Notatnik otwiera się teraz pusty i bez przypisania, bo lektor zaczyna
   * pisać, zanim pytanie „z kim dzisiaj" jest istotne. Wybór kursanta jest
   * czynnością w trakcie, nie bramką na wejściu.
   */
  students?: { id: string; name: string }[];
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
  students = [],
  onPushToLessonRecord,
}) => {
  const { user } = useAuth();
  const [scratchpadDoc, setScratchpadDoc] = useState<ScratchpadDocument | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Otwarta lista kursantów do przypisania notatnika w trakcie pisania. */
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

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
          setError(err.message || 'Nie udało się załadować notatnika.');
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

    return await saveScratchpadContent(scratchpadDoc.id, html, text, {
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

  const handleToggleRequirePin = async (require: boolean) => {
    if (!scratchpadDoc?.id) return;
    await updateScratchpadSettings(scratchpadDoc.id, { requirePin: require });
    setScratchpadDoc(prev => prev ? { ...prev, requirePin: require } : null);
  };

  /**
   * Przypisanie notatnika roboczego do kursanta w trakcie pisania.
   *
   * Treść wędruje do stałego notatnika kursanta (`sp_<uid>`), bo tylko tam
   * kursant ją znajdzie — szczegóły i powód w `adoptScratchpadForStudent`.
   */
  const handleAssignStudent = async (picked: { id: string; name: string }) => {
    if (!scratchpadDoc) return;
    setIsAssigning(true);
    setError(null);
    try {
      const teacherUid = user?.id || 'teacher_default';
      const teacherName = user?.firstName
        ? `${user.firstName} ${user.lastName || ''}`.trim()
        : user?.username || 'Lektor CRIBRO';
      const adopted = await adoptScratchpadForStudent(scratchpadDoc, picked, {
        uid: teacherUid,
        name: teacherName,
      });
      setScratchpadDoc(adopted);
      setIsPickerOpen(false);
    } catch (err: any) {
      console.error('Nie udało się przypisać notatnika:', err);
      setError(err.message || 'Nie udało się przypisać notatnika do kursanta.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handlePush = (data: any) => {
    if (onPushToLessonRecord) {
      onPushToLessonRecord(data);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl h-[90vh] max-h-[920px] bg-base-100 rounded-3xl border border-line-strong shadow-[var(--shadow-lg)] flex flex-col overflow-hidden">
        {/* Zawartość okna. Zamknięcie renderuje sam edytor w swoim pasku
            nagłówka — pływający krzyżyk nachodził na przyciski udostępniania. */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm font-semibold text-content-muted">Ładowanie notatnika lekcyjnego...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 max-w-md">
              <AlertCircle size={28} className="mx-auto mb-2" />
              <p className="font-bold text-sm">Nie udało się otworzyć notatnika</p>
              <p className="text-xs mt-1 opacity-80">{error}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-base-300 text-text-hi text-xs font-bold hover:bg-base-200"
            >
              Zamknij
            </button>
          </div>
        ) : scratchpadDoc ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* PASEK PRZYPISANIA — tylko dopóki notatnik jest roboczy.

                Notatnik bez kursanta jest sprawny: da się w nim pisać,
                zapisuje się, ma PIN. Brakuje mu jednego — kogoś, kto go
                zobaczy. Ten pasek mówi dokładnie to i znika w chwili, gdy
                kursant jest wybrany; po przypisaniu nie ma już czego
                wybierać, a stały pasek byłby stałym przypomnieniem o
                decyzji, która zapadła. */}
            {!scratchpadDoc.studentId && students.length > 0 && (
              <div className="px-4 py-2.5 border-b border-line-strong bg-primary/[0.06] flex flex-wrap items-center gap-2">
                <span className="text-xs text-content-muted">
                  Notatnik roboczy — nikt go jeszcze nie widzi.
                </span>

                {isPickerOpen ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {students.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        disabled={isAssigning}
                        onClick={() => handleAssignStudent(candidate)}
                        className="px-2.5 py-1 rounded-lg bg-base-200/80 border border-line-strong text-[12px] font-semibold text-text-hi hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
                      >
                        {candidate.name}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsPickerOpen(false)}
                      className="px-2 py-1 text-[12px] text-content-muted hover:text-text-hi"
                    >
                      Anuluj
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(true)}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-accent-ink text-xs font-bold hover:brightness-110 transition-all"
                  >
                    <UserPlus size={14} />
                    Przypisz kursanta
                  </button>
                )}

                {isAssigning && (
                  <span className="flex items-center gap-1.5 text-xs text-primary">
                    <Loader2 size={13} className="animate-spin" /> Przenoszę treść…
                  </span>
                )}
              </div>
            )}

            {/* Po przypisaniu: jedno zdanie potwierdzenia, bez przycisków. */}
            {scratchpadDoc.studentId && (
              <div className="px-4 py-2 border-b border-line-strong bg-base-200/40 flex items-center gap-2 text-xs text-content-muted">
                <Check size={13} className="text-primary shrink-0" />
                Notatnik kursanta <strong className="text-text-hi">{scratchpadDoc.studentName}</strong>
                {' '}— widzi go po linku albo PIN-em.
              </div>
            )}

            <ScratchpadEditor
              document={scratchpadDoc}
              onSaveContent={handleSaveContent}
              onToggleStudentEdit={handleToggleStudentEdit}
              onToggleRequirePin={handleToggleRequirePin}
              onPushToLessonRecord={onPushToLessonRecord ? handlePush : undefined}
              currentUser={{
                uid: user?.id || 'teacher',
                name: user?.firstName || user?.username || 'Lektor',
                role: 'teacher',
              }}
              className="h-full rounded-none border-0 shadow-none"
              autoFocus
              onClose={onClose}
            />
          </div>
        ) : null}

      </div>
    </div>
  );
};

export default ScratchpadModal;
