import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Send, Check, AlertTriangle, X, Loader2, Sparkles, CheckCircle2, ShieldAlert, FileText, Eye } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { buildLessonSummaryEmail, LessonSummaryEmailResult } from '../../services/homeworkEmail';
import { formatPolishGreeting } from '../../utils/polishVocative';

interface LessonSummaryEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: { id?: string; firstName?: string; lastName?: string; username?: string; email?: string } | null;
  lesson: {
    lessonRecordId?: string;
    date?: string;
    topic?: string;
    summary?: string;
    vocabulary?: string;
    corrections?: string;
  } | null;
  onSent?: () => void;
}

/**
 * Pytanie "wysłać mailem?" po zapisaniu lekcji — zwięzły recap (max 3 elementy, 80–150 słów).
 * Zawiera pełny podgląd, metryki (liczba słów, limit 60 znaków tematu, liczba elementów)
 * oraz walidację PASS / WARNING / FAIL.
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
  const [previewTab, setPreviewTab] = useState<'visual' | 'text'>('visual');
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

  const emailResult: LessonSummaryEmailResult | null = useMemo(() => {
    if (!lesson) return null;
    return buildLessonSummaryEmail({
      studentName: student?.firstName || studentDisplayName,
      date: lesson.date,
      topic: lesson.topic,
      summary: lesson.summary,
      vocabulary: lesson.vocabulary,
      corrections: lesson.corrections,
      appUrl: 'https://app.maciej.pro',
      hasAppAccess: true,
      trainerName: senderName || 'Maciej Wyrozumski',
    });
  }, [lesson, student, studentDisplayName, senderName]);

  if (!isOpen || !lesson || !emailResult) return null;

  const { validation, items, wordCount, subject } = emailResult;

  const handleSend = async () => {
    const cleanTo = recipientEmail.trim();
    if (!cleanTo || !cleanTo.includes('@') || cleanTo.startsWith('@') || cleanTo.endsWith('@')) {
      setErrorMessage('Wprowadź prawidłowy adres e-mail odbiorcy.');
      return;
    }

    if (validation.status === 'FAIL') {
      setErrorMessage(`Nie można wysłać wiadomości: ${validation.errors.join(' ')}`);
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
          subject: emailResult.subject,
          html: emailResult.html,
          text: emailResult.text,
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
      <div className="bg-base-100 border border-white/10 rounded-2xl w-full max-w-2xl flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-base-200/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Podsumowanie lekcji (Recap)</h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    validation.status === 'PASS'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : validation.status === 'WARNING'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {validation.status}
                </span>
              </div>
              <p className="text-xs text-content-muted mt-0.5 truncate">
                Krótki e-mail do {studentDisplayName} z max 3 elementami i zaproszeniem do ćwiczeń
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Metadata badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-base-200/70 border border-white/10 rounded-xl p-2.5">
              <span className="text-[10px] uppercase font-bold text-content-muted block">Temat ({subject.length}/60)</span>
              <span className="font-semibold text-white truncate block mt-0.5" title={subject}>
                {subject}
              </span>
            </div>
            <div className="bg-base-200/70 border border-white/10 rounded-xl p-2.5">
              <span className="text-[10px] uppercase font-bold text-content-muted block">Elementy</span>
              <span className="font-semibold text-white block mt-0.5">
                {items.length} / max 3
              </span>
            </div>
            <div className="bg-base-200/70 border border-white/10 rounded-xl p-2.5">
              <span className="text-[10px] uppercase font-bold text-content-muted block">Liczba słów</span>
              <span className={`font-semibold block mt-0.5 ${wordCount > 180 ? 'text-rose-400' : wordCount > 150 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {wordCount} słów
              </span>
            </div>
            <div className="bg-base-200/70 border border-white/10 rounded-xl p-2.5">
              <span className="text-[10px] uppercase font-bold text-content-muted block">Format</span>
              <span className="font-semibold text-primary block mt-0.5">
                Krótki Recap
              </span>
            </div>
          </div>

          {/* Recipient input */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-content-muted mb-1">
              Adres e-mail odbiorcy
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-base-200 border border-white/10 text-sm text-white focus:outline-none focus:border-primary"
              placeholder="kursant@example.com"
            />
          </div>

          {/* Validation warnings / errors */}
          {validation.errors.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Błędy walidacji:</strong>
                <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                  {validation.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {validation.warnings.length > 0 && validation.errors.length === 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Wskazówki / ostrzeżenia:</strong>
                <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                  {validation.warnings.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Preview tabs */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-bold text-content-muted uppercase tracking-wider">Podgląd wiadomości</span>
            <div className="flex items-center gap-1 bg-base-200 p-1 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => setPreviewTab('visual')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  previewTab === 'visual' ? 'bg-primary text-accent-ink shadow' : 'text-content-muted hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Wizualny (HTML)
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('text')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  previewTab === 'text' ? 'bg-primary text-accent-ink shadow' : 'text-content-muted hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Tekst (TXT)
              </button>
            </div>
          </div>

          {/* Preview display */}
          {previewTab === 'visual' ? (
            <div className="bg-base-200/60 border border-white/10 rounded-xl p-4 overflow-x-auto">
              <div className="max-w-[480px] mx-auto bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden text-slate-800">
                <div className="h-1 bg-gradient-to-r from-teal-500 to-blue-500" />
                <div className="p-5 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-700">CRIBRO ENGLISH</span>
                    <span className="text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                      PODSUMOWANIE LEKCJI
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{formatPolishGreeting(student?.firstName || studentDisplayName)}</h3>

                  <p className="text-slate-600 leading-relaxed">
                    {emailResult.text.split('\n\n')[1] || 'Dzięki za dzisiejszą lekcję!'}
                  </p>

                  {items.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Warto zapamiętać:</p>
                      {items.map((item, idx) => (
                        <div
                          key={idx}
                          className={`p-2 rounded-lg border text-xs leading-relaxed ${
                            item.type === 'correction'
                              ? 'bg-green-50/70 border-green-200 text-green-950 border-l-4 border-l-green-600'
                              : 'bg-slate-50 border-slate-200 text-slate-900'
                          }`}
                        >
                          {item.type === 'correction' ? (
                            <div>
                              {item.incorrect && <div className="text-rose-700 font-medium mb-0.5">❌ {item.incorrect}</div>}
                              <div className="text-green-800 font-semibold">✅ {item.correct}</div>
                            </div>
                          ) : (
                            <div>
                              <strong className="text-slate-900">{item.term}</strong>
                              {item.definition && <span className="text-slate-600"> — {item.definition}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 text-center">
                    <p className="text-slate-600 text-[11px] mb-2">
                      Możesz teraz otworzyć Cribro Recall i przećwiczyć te elementy w krótkich zadaniach przygotowanych na podstawie naszej lekcji.
                    </p>
                    <div className="inline-block bg-teal-600 text-white font-bold px-4 py-2 rounded-lg shadow-sm text-xs">
                      Ćwicz w Cribro Recall
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 text-slate-600 text-[11px]">
                    <p>Do zobaczenia,</p>
                    <strong className="text-slate-900">{senderName.split(' ')[0] || 'Maciej'}</strong>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-base-200 border border-white/10 rounded-xl p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
              {emailResult.text}
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
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
            disabled={isSending || sendSuccess || validation.status === 'FAIL'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-primary text-accent-ink hover:brightness-110 transition-all disabled:opacity-60 shadow-lg shadow-primary/20"
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
