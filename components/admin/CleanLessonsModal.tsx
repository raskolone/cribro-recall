import React, { useState } from 'react';
import { 
  Wand2, X, CheckCircle2, AlertTriangle, ListChecks, 
  Sparkles, ArrowRight, Loader2, BookOpen 
} from 'lucide-react';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { LessonRecord, User } from '../../types';
import { 
  extractLessonBlocks, 
  isRecordNeedsCleanup, 
  migrateRecordToBlocks 
} from '../../utils/lessonBlocks';
import Button from '../ui/Button';

interface CleanLessonsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUser: User | null;
  lessonRecords: LessonRecord[];
  onCleanComplete: (updatedRecords: LessonRecord[]) => void;
}

export const CleanLessonsModal: React.FC<CleanLessonsModalProps> = ({
  isOpen,
  onClose,
  selectedUser,
  lessonRecords,
  onCleanComplete,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen || !selectedUser) return null;

  const studentName = `${selectedUser.firstName || ''} ${selectedUser.lastName || selectedUser.username}`.trim();
  const dirtyRecords = lessonRecords.filter(isRecordNeedsCleanup);

  const handleRunBatchClean = async () => {
    if (dirtyRecords.length === 0) return;
    setIsProcessing(true);

    try {
      const batch = writeBatch(db);
      const updatedMap = new Map<string, LessonRecord>();

      for (const record of dirtyRecords) {
        const updateData = migrateRecordToBlocks(record);
        const recordRef = doc(db, `users/${selectedUser.id}/lessonRecords/${record.id}`);
        batch.update(recordRef, updateData);

        updatedMap.set(record.id, {
          ...record,
          ...updateData,
        } as LessonRecord);
      }

      await batch.commit();

      const allUpdated = lessonRecords.map((r) => updatedMap.get(r.id) || r);
      onCleanComplete(allUpdated);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 2500);
    } catch (err: any) {
      console.error('Błąd podczas masowego porządkowania lekcji:', err);
      alert('Wystąpił błąd podczas porządkowania: ' + (err?.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-white/10 bg-base-300 shadow-2xl overflow-hidden">
        {/* NAGŁÓWEK */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3 bg-base-200/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Wand2 size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base sm:text-lg flex items-center gap-2">
                Uporządkowanie zaimportowanych lekcji z Notion
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Notion Blocks
                </span>
              </h3>
              <p className="text-xs text-content-muted">Kursant: {studentName}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-content-muted hover:text-text-hi hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* TREŚĆ */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {isSuccess ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 text-primary animate-fade-in">
              <CheckCircle2 size={48} className="text-primary" />
              <h4 className="text-base font-extrabold text-white">
                Pomyślnie uporządkowano {dirtyRecords.length} lekcji!
              </h4>
              <p className="text-xs text-content-muted max-w-md">
                Wszystkie zadania domowe, klucze odpowiedzi i korekty zostały rozbite na dedykowane pola w formacie bloków Notion.
              </p>
            </div>
          ) : dirtyRecords.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="text-sm font-bold text-white">Wszystkie lekcje są już uporządkowane!</h4>
              <p className="text-xs text-content-muted max-w-md mx-auto">
                Żadna z zapisanych lekcji tego kursanta nie posiada zlanego formatu. Wszystkie wpisy są w 100% zgodne ze schematem bloków Notion.
              </p>
              <Button size="sm" variant="secondary" onClick={onClose} className="text-xs font-bold mt-2">
                Zamknij
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2.5">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
                <div className="space-y-1">
                  <span className="font-bold block">
                    Wykryto {dirtyRecords.length} lekcji ze starym, zlanym formatem z Notion.
                  </span>
                  <p className="text-amber-200/80 leading-relaxed">
                    Wcześniejszy import wrzucał zadania domowe (z blokami <code>~~~markdown</code>) do pola korekt. Narzędzie wyodrębni zadania do <strong>Bloku 3</strong>, klucz odpowiedzi do <strong>Answer Key</strong>, a w uwagach zostawi tylko właściwe korekty językowe.
                  </p>
                </div>
              </div>

              {/* Lista podglądu lekcji do uporządkowania */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-content-muted uppercase tracking-wider block">
                  Lekcje przygotowane do uporządkowania ({dirtyRecords.length}):
                </span>
                <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                  {dirtyRecords.map((r) => {
                    const parsed = extractLessonBlocks(r);
                    return (
                      <div
                        key={r.id}
                        className="p-3.5 rounded-xl bg-base-200/70 border border-white/10 space-y-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-primary font-bold">{r.date}</span>
                            <span className="font-bold text-white">{r.topic}</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-warn/20 text-warn border border-warn/30">
                            Wymaga rozdzielenia
                          </span>
                        </div>

                        {/* Podgląd rozbicia na bloki */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 space-y-1">
                            <span className="font-bold text-emerald-400 block">
                              🟩 Blok 2: Korekty językowe
                            </span>
                            <p className="text-content-muted line-clamp-2">
                              {parsed.corrections || '(Brak korekt po wycięciu zadania)'}
                            </p>
                          </div>
                          <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/20 space-y-1">
                            <span className="font-bold text-amber-400 block">
                              🟧 Blok 3: Zadanie domowe + Answer Key
                            </span>
                            <p className="text-content-muted line-clamp-2">
                              {parsed.homework || '(Brak treści zadania)'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* DOLNY PASEK */}
        {!isSuccess && dirtyRecords.length > 0 && (
          <div className="p-4 border-t border-white/10 bg-base-200/80 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/10 text-xs font-semibold text-content-muted hover:text-text-hi"
            >
              Anuluj
            </button>

            <Button
              size="sm"
              variant="primary"
              onClick={handleRunBatchClean}
              isLoading={isProcessing}
              className="font-bold text-xs flex items-center gap-1.5 shadow-btn cursor-pointer"
            >
              <Wand2 size={14} />
              <span>Uporządkuj i zapisz w bazie ({dirtyRecords.length} lekcji)</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
export default CleanLessonsModal;
