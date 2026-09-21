import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Send, Check, AlertTriangle, X, Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { buildLessonSummaryEmail } from '../../services/homeworkEmail';
import { formatPolishGreeting } from '../../utils/polishVocative';

interface LessonSummaryEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: { id?: string; firstName?: string; lastName?: string; username?: string; email?: string } | null;
  lesson: {
    lessonRecordId?: string;
    date?: string;
    summary?: string;
    vocabulary?: string;
    corrections?: string;
  } | null;
  onSent?: () => void;
}

/**
 * Pytanie "wysłać mailem?" po zapisaniu lekcji — human-in-the-loop tak samo
 * jak przy pracach domowych (HomeworkEmailConfirmationModal): lektor widzi
 * gotową treść i decyduje, nic nie wychodzi do kursanta automatycznie.
 */
export const LessonSummaryEmailModal: React.FC<LessonSummaryEmailModalProps> = ({
  isOpen,
  onClose,
  student,
  lesson,
  onSent,
}) => {
  const [senderName, setSenderName] = useState<string>('Maciej Wyrozumski');
  const [senderEmail, setSenderEmail] = useState<string>('wyrozumski@maciej.pro');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSendSuccess(false);
    setErrorMessage(null);
    setRecipientEmail(student?.email || '');

    const fetchMailingDefaults = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch('/api/mailing/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.fromAddress) {
            const match = data.fromAddress.match(/^(.*?)\s*<([^>]+)>$/);
            if (match) {
              setSenderName(match[1].trim());
              setSenderEmail(match[2].trim());
            } else if (data.fromAddress.includes('@')) {
              setSenderEmail(data.fromAddress.trim());
            }
          }
        }
      } catch (err) {
        console.warn('Nie udało się pobrać domyślnych ustawień poczty:', err);
      }
    };
    fetchMailingDefaults();
  }, [isOpen, student]);

  const studentDisplayName = useMemo(() => {
    if (!student) return 'Kursant';
    const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
    return fullName || student.username || 'Kursant';
  }, [student]);

  const emailContent = useMemo(() => {
    if (!lesson) return { html: '', text: '', subject: '', greeting: '' };
    return buildLessonSummaryEmail({
      studentName: student?.firstName || studentDisplayName,
      date: lesson.date,
      summary: lesson.summary,
      vocabulary: lesson.vocabulary,
      corrections: lesson.corrections,
    });
  }, [lesson, student, studentDisplayName]);

  if (!isOpen || !lesson) return null;

  const handleSend = async () => {
    const cleanTo = recipientEmail.trim();
    if (!cleanTo || !cleanTo.includes('@') || cleanTo.startsWith('@') || cleanTo.endsWith('@')) {
      setErrorMessage('Wprowadź prawidłowy adres e-mail odbiorcy.');
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Brak aktywnej sesji administratora/lektora.');

      const res = await fetch('/api/mailing/test-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: cleanTo,
          from: `${senderName.trim()} <${senderEmail.trim()}>`,
          replyTo: senderEmail.trim(),
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Nie udało się wysłać podsumowania lekcji.');
      }

      if (student?.id && lesson.lessonRecordId) {
        try {
          await updateDoc(doc(db, `users/${student.id}/lessonRecords`, lesson.lessonRecordId), {
            summaryEmailSentAt: new Date().toISOString(),
          });
        } catch (dbErr) {
          console.warn('Nie udało się zapisać znacznika wysyłki na lekcji:', dbErr);
        }
      }

      setSendSuccess(true);
      setTimeout(() => {
        if (onSent) onSent();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Błąd podczas wysyłania podsumowania lekcji:', err);
      setErrorMessage(err.message || 'Wystąpił błąd podczas wysyłania e-maila.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-base-100 border border-white/10 rounded-2xl w-full max-w-lg flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-base-200/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white">Lekcja została zapisana</h2>
              <p className="text-xs text-content-muted mt-0.5 truncate">
                Czy chcesz wysłać e-mail z podsumowaniem do {studentDisplayName}?
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-content-muted hover:text-white rounded-xl hover:bg-white/10 transition-colors shrink-0"
            aria-label="Zamknij"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-content-muted mb-1">
              Adres e-mail kursanta
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-base-200 border border-white/10 text-sm text-white focus:outline-none focus:border-primary"
              placeholder="kursant@example.com"
            />
          </div>

          <div className="bg-base-200/60 border border-white/10 rounded-xl p-4 overflow-x-auto">
            <div className="max-w-[480px] mx-auto bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden text-slate-800">
              <div className="h-1.5 bg-gradient-to-r from-teal-500 to-blue-500" />
              <div className="p-5 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-700">CRIBRO ENGLISH</span>
                  <span className="text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                    PODSUMOWANIE LEKCJI
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{formatPolishGreeting(student?.firstName || studentDisplayName)}</h3>
                <p className="text-slate-600">
                  Dzięki za dzisiejszą lekcję! Poniżej zebrałem dla Ciebie najważniejsze zwroty, słownictwo oraz poprawki z naszego spotkania.
                </p>
                {lesson.vocabulary?.trim() && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">Key Language</p>
                    <p className="whitespace-pre-wrap text-slate-800">{lesson.vocabulary.trim()}</p>
                  </div>
                )}
                {lesson.corrections?.trim() && (
                  <div className="bg-green-50 border-l-4 border-green-600 rounded-r-lg p-2.5">
                    <p className="text-[10px] font-bold uppercase text-green-800 mb-1">Korekty i wymowa</p>
                    <p className="whitespace-pre-wrap text-green-900">{lesson.corrections.trim()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-white/10 bg-base-200/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-content-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            Nie teraz
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || sendSuccess}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-primary text-accent-ink hover:brightness-110 transition-all disabled:opacity-60"
          >
            {sendSuccess ? (
              <>
                <Check className="w-4 h-4" /> Wysłano
              </>
            ) : isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Wysyłanie…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Wyślij podsumowanie e-mail
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LessonSummaryEmailModal;
