import React, { useState, useEffect } from 'react';
import { Sparkles, X, AlertCircle, Calendar, User, FileText, Loader2, CheckCircle2, ExternalLink, RefreshCw, Bot } from 'lucide-react';
import { useEscapeModal } from '../../hooks/useEscapeModal';
import { generateLessonFromTranscript, persistQuestionUsageLogs, updateStudentInsightsProfile } from '../../services/transcriptLesson';
import { db, auth } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { LessonRecord, User as UserType } from '../../types';
import { getIsoDateOnly } from '../../services/teacherCockpitService';
import { formatStudentDisplayName } from '../../utils/studentFormat';
import Button from '../ui/Button';

interface NotionMeetingItem {
  id: string;
  title: string;
  studentNameRaw: string;
  lessonDate: string;
  url: string;
  createdTime?: string;
}

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

  // Notion state
  const [notionMeetings, setNotionMeetings] = useState<NotionMeetingItem[]>([]);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState<boolean>(false);
  const [loadingMeetingContentId, setLoadingMeetingContentId] = useState<string | null>(null);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [notionConfigured, setNotionConfigured] = useState<boolean>(true);

  useEscapeModal(isOpen, onClose);

  // Helper do pobrania tokenu autoryzacji Firebase
  const getAuthHeader = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const token = await currentUser.getIdToken();
        return { Authorization: `Bearer ${token}` };
      }
    } catch {}
    return {};
  };

  // Pobieranie ostatnich spotkań z Notion
  const fetchRecentMeetings = async () => {
    if (!isOpen) return;
    setIsLoadingMeetings(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch('/api/notion/recent-meetings', {
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setNotionConfigured(data.configured !== false);
        setNotionMeetings(data.meetings || []);
      }
    } catch (e) {
      console.warn('[ManualTranscriptImportModal] Nie udało się pobrać spotkań z Notion:', e);
    } finally {
      setIsLoadingMeetings(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRecentMeetings();
    }
  }, [isOpen]);

  // Synchronizacja domyślnego studenta, gdy lista się pojawi lub zmieni
  useEffect(() => {
    if (isOpen) {
      if (!selectedStudentId && students.length > 0 && students[0].id) {
        setSelectedStudentId(students[0].id);
      }
      setError(null);
    }
  }, [isOpen, students, selectedStudentId]);

  // Pobieranie treści spotkania z Notion i wstrzykiwanie do formularza
  const handleSelectMeeting = async (meeting: NotionMeetingItem) => {
    setSelectedMeetingId(meeting.id);
    if (meeting.lessonDate) {
      setLessonDate(meeting.lessonDate);
    }
    if (meeting.title && !lessonTopic) {
      setLessonTopic(meeting.title);
    }

    setLoadingMeetingContentId(meeting.id);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`/api/notion/meeting-content/${meeting.id}`, {
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.content) {
          setRawText(data.content);
        }
      }
    } catch (err) {
      console.error('[ManualTranscriptImportModal] Błąd pobierania bloków ze spotkania Notion:', err);
    } finally {
      setLoadingMeetingContentId(null);
    }
  };

  // Funkcja sprawdzająca czy spotkanie pasuje do danego kursanta
  const checkMeetingMatch = (meeting: NotionMeetingItem, studentObj?: Partial<UserType> | any) => {
    if (!studentObj) return false;
    const name = (formatStudentDisplayName(studentObj as Partial<UserType>, (studentObj as any).name || (studentObj as any).displayName) || '').toLowerCase().trim();
    const firstName = (studentObj.firstName || name.split(/\s+/)[0] || '').toLowerCase().trim();
    const rawStudent = (meeting.studentNameRaw || '').toLowerCase().trim();
    const rawTitle = (meeting.title || '').toLowerCase().trim();

    if (name && (rawStudent.includes(name) || rawTitle.includes(name))) return true;
    if (firstName && firstName.length >= 3 && (rawStudent.includes(firstName) || rawTitle.includes(firstName))) return true;
    return false;
  };

  // Auto-matching: kiedy zmienia się wybrany kursant lub lista spotkań
  useEffect(() => {
    if (!selectedStudentId || notionMeetings.length === 0) return;
    const currentStudent = students.find((s) => s.id === selectedStudentId);
    if (!currentStudent) return;

    // Szukamy pierwszego pasującego spotkania
    const matched = notionMeetings.find((m) => checkMeetingMatch(m, currentStudent));
    if (matched && selectedMeetingId !== matched.id && !rawText) {
      handleSelectMeeting(matched);
    }
  }, [selectedStudentId, notionMeetings]);

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

          {/* Ostatnie spotkania Notion (ostatnie 7 dni) */}
          <div className="p-3.5 rounded-2xl bg-base-100 border border-line-strong space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot size={15} className="text-primary" />
                <span className="text-xs font-black text-text-hi tracking-tight">
                  Ostatnie spotkania Notion (ostatnie 7 dni)
                </span>
                {isLoadingMeetings && <Loader2 size={12} className="animate-spin text-primary" />}
              </div>
              <button
                type="button"
                onClick={fetchRecentMeetings}
                disabled={isLoadingMeetings || isSubmitting}
                className="p-1 rounded-lg text-content-muted hover:text-text-hi hover:bg-base-300 transition-colors cursor-pointer"
                title="Odśwież listę spotkań z Notion"
              >
                <RefreshCw size={12} className={isLoadingMeetings ? 'animate-spin' : ''} />
              </button>
            </div>

            {!notionConfigured ? (
              <p className="text-[11px] text-content-muted">
                Baza spotkań Notion nie jest jeszcze skonfigurowana w Ustawieniach. Możesz wkleić notatki ręcznie poniżej.
              </p>
            ) : notionMeetings.length === 0 ? (
              <p className="text-[11px] text-content-muted">
                {isLoadingMeetings ? 'Pobieram ostatnie spotkania z Notion…' : 'Brak spotkań w bazie Notion z ostatnich 7 dni. Możesz wkleić notatki ręcznie.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                {notionMeetings.map((meeting) => {
                  const currentStudent = students.find((s) => s.id === selectedStudentId);
                  const isSuggested = checkMeetingMatch(meeting, currentStudent);
                  const isSelected = selectedMeetingId === meeting.id;
                  const isLoadingContent = loadingMeetingContentId === meeting.id;

                  const studentLabel = currentStudent ? (currentStudent.firstName || formatStudentDisplayName(currentStudent as Partial<UserType>, (currentStudent as any).name).split(/\s+/)[0]) : '';

                  return (
                    <div
                      key={meeting.id}
                      onClick={() => !isSubmitting && handleSelectMeeting(meeting)}
                      className={`group relative flex flex-col p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary/10 border-primary shadow-sm shadow-primary/10 ring-1 ring-primary'
                          : isSuggested
                          ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60'
                          : 'bg-base-200/80 border-line-soft hover:border-line-strong hover:bg-base-200'
                      }`}
                      style={{ minWidth: '220px', maxWidth: '100%', flex: '1 1 calc(50% - 8px)' }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        {isSuggested ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 size={10} />
                            Sugerowane {studentLabel ? `dla ${studentLabel}` : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-content-muted">
                            {meeting.lessonDate || meeting.createdTime?.slice(0, 10) || 'Notion'}
                          </span>
                        )}

                        {meeting.url && (
                          <a
                            href={meeting.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-content-muted hover:text-text-hi p-0.5"
                            title="Otwórz stronę w Notion"
                          >
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>

                      <div className="text-xs font-bold text-text-hi line-clamp-1 group-hover:text-primary transition-colors">
                        {meeting.title}
                      </div>

                      {meeting.studentNameRaw && (
                        <div className="text-[10px] text-content-muted line-clamp-1 mt-0.5">
                          Kursant: <span className="font-semibold text-text-hi/80">{meeting.studentNameRaw}</span>
                        </div>
                      )}

                      {isLoadingContent && (
                        <div className="absolute inset-0 bg-base-300/80 backdrop-blur-xs rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-primary">
                          <Loader2 size={13} className="animate-spin" />
                          <span>Ładowanie treści…</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Wklejony tekst */}
          <div className="flex-1 flex flex-col min-h-[200px]">
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
