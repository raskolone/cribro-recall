import React, { useState } from 'react';
import { Sparkles, X, AlertCircle, Calendar, User, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { useEscapeModal } from '../../hooks/useEscapeModal';
import { generateLessonFromTranscript, persistQuestionUsageLogs, updateStudentInsightsProfile } from '../../services/transcriptLesson';
import { db } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { LessonRecord, User as UserType } from '../../types';
import { getIsoDateOnly } from '../../services/teacherCockpitService';
import { formatStudentDisplayName } from '../../utils/studentFormat';
import Button from '../ui/Button';

interface ManualTranscriptImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  students?: Array<UserType | { id?: string; name?: string; displayName?: string; username?: string; level?: string; firstName?: string; lastName?: string; email?: string }>;
  currentTeacherId?: string;
  onLessonCreated?: (lessonId: string, studentId: string) => void;
}

export const ManualTranscriptImportModal: React.FC<ManualTranscriptImportModalProps> = ({
  isOpen,
  onClose,
  students = [],
  currentTeacherId = 'teacher',
  onLessonCreated,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [lessonDate, setLessonDate] = useState<string>(() => getIsoDateOnly(new Date()));
  const [lessonTopic, setLessonTopic] = useState<string>('');
  const [rawText, setRawText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeModal(isOpen, onClose);

  // Synchronizacja domyślnego studenta, gdy lista się pojawi lub zmieni
  React.useEffect(() => {
    if (isOpen) {
      if (!selectedStudentId && students.length > 0 && students[0].id) {
        setSelectedStudentId(students[0].id);
      }
      setError(null);
    }
  }, [isOpen, students, selectedStudentId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedText = rawText.trim();
    if (!selectedStudentId) {
      setError('Wybierz kursanta, do którego mają zostać przypisane notatki.');
      return;
    }

    if (!trimmedText || trimmedText.length < 30) {
      setError('Wklejony tekst notatek / transkrypcji musi zawierać co najmniej 30 znaków.');
      return;
    }

    const targetStudent = students.find((s) => s.id === selectedStudentId);
    const studentName = formatStudentDisplayName(targetStudent as Partial<UserType>, null, 'Kursant');
    const studentLevel = targetStudent?.level || 'B1';

    setIsSubmitting(true);

    try {
      const randomSuffix = Math.floor(Math.random() * 1000000);
      const newLessonId = `lesson-${Date.now()}-${randomSuffix}`;
      const nowIso = new Date().toISOString();
      const dateToSave = lessonDate.trim() || getIsoDateOnly(new Date());

      // 1. Generuj ustrukturyzowane bloki lekcji przez Gemini
      const generated = await generateLessonFromTranscript({
        transcript: trimmedText,
        studentName,
        studentId: selectedStudentId,
        lessonId: newLessonId,
        date: dateToSave,
        topic: lessonTopic.trim() || undefined,
        level: studentLevel,
      });

      const finalTopic = generated.topic || lessonTopic.trim() || `Lekcja z notatek Notion (${dateToSave})`;

      // 2. Przygotuj pełny dokument LessonRecord
      const lessonDoc: LessonRecord = {
        id: newLessonId,
        studentId: selectedStudentId,
        studentName,
        date: dateToSave,
        topic: finalTopic,
        vocabularyText: generated.vocabularyText || '',
        lessonSummary: generated.lessonSummary || '',
        studentSpeaking: generated.studentSpeaking || '',
        studentInsights: generated.studentInsights || '',
        corrections: generated.corrections || '',
        homeworkText: generated.homeworkText || '',
        homeworkAnswerKey: generated.homeworkAnswerKey || '',
        nextLessonPlan: generated.nextLessonPlan || '',
        structuredBlocks: generated.structuredBlocks,
        questionUsageLogs: generated.questionUsageLogs,
        processingRunId: generated.processingRunId || `run_${Date.now()}`,
        analysisVersion: generated.analysisVersion || 'v2026-09-16',
        liveTranscript: trimmedText,
        source: 'notion',
        status: 'pending_confirmation',
        workflowStatus: 'draft',
        sessionStatus: 'draft',
        isPendingConfirmation: true,
        pendingReason: 'Zaimportowano z Notion AI — oczekuje na zatwierdzenie lektora',
        transcriptReceivedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // 3. Zapisz w Firestore pod ścieżką `users/{studentId}/lessonRecords/{lessonId}`
      const lessonRef = doc(db, `users/${selectedStudentId}/lessonRecords/${newLessonId}`);
      await setDoc(lessonRef, lessonDoc);

      // 4. Jeśli AI wyodrębniło trwałe spostrzeżenia o kursancie lub pytania, zapisz w profilu
      if (generated.studentInsights) {
        await updateStudentInsightsProfile(selectedStudentId, generated.studentInsights);
      }
      if (generated.questionUsageLogs && generated.questionUsageLogs.length > 0) {
        await persistQuestionUsageLogs(selectedStudentId, newLessonId, generated.questionUsageLogs);
      }

      // 5. Zresetuj stan formularza i powiadom rodzica
      setRawText('');
      setLessonTopic('');
      onClose();

      if (onLessonCreated) {
        onLessonCreated(newLessonId, selectedStudentId);
      }
    } catch (err: any) {
      console.error('[ManualTranscriptImport] Błąd importu z Notion AI:', err);
      setError(err?.message || 'Nie udało się przetworzyć transkrypcji i zapisać lekcji.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-transcript-modal-title"
        className="relative w-full max-w-2xl bg-base-200 border border-line-strong rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-line-strong bg-base-300/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0 shadow-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 id="manual-transcript-modal-title" className="text-base sm:text-lg font-black text-text-hi tracking-tight">
                Wklej notatki z Notion AI / Transkrypcję
              </h3>
              <p className="text-xs text-content-muted">
                AI wygeneruje 4 standardowe bloki lekcji i przygotuje szkic do zatwierdzenia
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Zamknij okno"
            className="p-2 rounded-xl text-content-muted hover:text-text-hi hover:bg-line-soft transition-colors cursor-pointer disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs font-semibold flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Wybór kursanta */}
            <div>
              <label className="block text-xs font-bold text-text-hi mb-1.5 flex items-center gap-1.5">
                <User size={13} className="text-primary" />
                <span>Kursant / Grupa <span className="text-danger">*</span></span>
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 rounded-xl bg-base-100 border border-line-strong text-xs font-bold text-text-hi focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50"
              >
                <option value="" disabled>-- Wybierz kursanta --</option>
                {[...students]
                  .sort((a, b) =>
                    formatStudentDisplayName(a as Partial<UserType>).localeCompare(
                      formatStudentDisplayName(b as Partial<UserType>),
                      'pl'
                    )
                  )
                  .map((s) => {
                    const sId = s.id;
                    if (!sId) return null;
                    const label = formatStudentDisplayName(s as Partial<UserType>, (s as any).name || (s as any).displayName);
                    return (
                      <option key={sId} value={sId}>
                        {label} {s.level ? `(${s.level})` : ''}
                      </option>
                    );
                  })}
              </select>
            </div>

            {/* Data lekcji */}
            <div>
              <label className="block text-xs font-bold text-text-hi mb-1.5 flex items-center gap-1.5">
                <Calendar size={13} className="text-primary" />
                <span>Data lekcji</span>
              </label>
              <input
                type="date"
                value={lessonDate}
                onChange={(e) => setLessonDate(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 rounded-xl bg-base-100 border border-line-strong text-xs font-bold text-text-hi focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>
          </div>

          {/* Opcjonalny temat */}
          <div>
            <label className="block text-xs font-bold text-text-hi mb-1.5 flex items-center gap-1.5">
              <FileText size={13} className="text-primary" />
              <span>Temat lekcji (opcjonalnie — AI może wykryć z tekstu)</span>
            </label>
            <input
              type="text"
              placeholder="np. Business Negotiations & Salary Review"
              value={lessonTopic}
              onChange={(e) => setLessonTopic(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 rounded-xl bg-base-100 border border-line-strong text-xs font-medium text-text-hi placeholder:text-content-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
          </div>

          {/* Wklejony tekst */}
          <div className="flex-1 flex flex-col min-h-[220px]">
            <label className="block text-xs font-bold text-text-hi mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText size={13} className="text-primary" />
                <span>Treść notatek / Zapis rozmowy z Notion AI <span className="text-danger">*</span></span>
              </span>
              <span className="text-[11px] font-mono text-content-muted">
                {rawText.length} znaków
              </span>
            </label>
            <textarea
              required
              rows={8}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              disabled={isSubmitting}
              placeholder="Wklej tutaj podsumowanie wygenerowane przez Notion AI lub surowy zapis transkrypcji ze spotkania..."
              className="w-full flex-1 p-3.5 rounded-2xl bg-base-100 border border-line-strong text-xs font-mono leading-relaxed text-text-hi placeholder:text-content-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none disabled:opacity-50"
            />
          </div>

          {/* Footer buttons */}
          <div className="pt-3 border-t border-line-soft flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-line-strong bg-base-100 hover:bg-base-300 text-xs font-bold text-content-muted hover:text-text-hi transition-colors cursor-pointer disabled:opacity-50"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={isSubmitting || rawText.trim().length < 30 || !selectedStudentId}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-focus hover:from-primary-focus hover:to-primary text-accent-ink font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Analizuję i generuję bloki lekcji…</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Generuj podsumowanie lekcji</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualTranscriptImportModal;
