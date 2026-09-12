import React, { useState, useEffect, useMemo } from 'react';
import { Mail, Send, Check, AlertTriangle, X, Eye, ListChecks, User as UserIcon, Calendar, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { User } from '../../types';
import { buildHomeworkConfirmationEmail } from '../../services/homeworkEmail';
import { formatPolishGreeting } from '../../utils/polishVocative';

interface HomeworkEmailConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: (Partial<User> & { id?: string; firstName?: string; lastName?: string; username?: string; email?: string }) | null;
  task: {
    id?: string;
    title: string;
    instructions?: string;
    dueDate?: string;
    sentences?: any[];
    itemCount?: number;
    assignedBy?: string;
    accessToken?: string;
    accessExpiresAt?: string;
    accessUrl?: string;
  } | null;
  onEmailSent?: () => void;
  onSkip?: () => void;
}

export const HomeworkEmailConfirmationModal: React.FC<HomeworkEmailConfirmationModalProps> = ({
  isOpen,
  onClose,
  student,
  task,
  onEmailSent,
  onSkip,
}) => {
  const [senderName, setSenderName] = useState<string>('Maciej Wyrozumski');
  const [senderEmail, setSenderEmail] = useState<string>('wyrozumski@maciej.pro');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [customNote, setCustomNote] = useState<string>('');
  const [updateProfileEmail, setUpdateProfileEmail] = useState<boolean>(false);
  const [enableBcc, setEnableBcc] = useState<boolean>(true);
  const [bccEmail, setBccEmail] = useState<string>('wyrozumski@maciej.pro');
  const [activeTab, setActiveTab] = useState<'preview' | 'exercises'>('preview');

  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pobierz domyślne ustawienia poczty przy pierwszym otwarciu
  useEffect(() => {
    if (!isOpen) return;

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
          if (typeof data?.enableBccSender === 'boolean') {
            setEnableBcc(data.enableBccSender);
          }
          if (data?.bccEmail) {
            setBccEmail(data.bccEmail);
          }
        }
      } catch (err) {
        console.warn('Nie udało się pobrać domyślnych ustawień poczty:', err);
      }
    };

    fetchMailingDefaults();
  }, [isOpen]);

  // Inicjalizacja pól na podstawie zadania i kursanta
  useEffect(() => {
    if (!isOpen || !task) return;

    const initialEmail = student?.email ? student.email.trim() : '';
    setRecipientEmail(initialEmail);

    const cleanTitle = task.title?.trim() || 'Praca domowa';
    setSubject(
      /praca domowa/i.test(cleanTitle)
        ? `Nowe zadanie: ${cleanTitle}`
        : `Nowa praca domowa: ${cleanTitle}`
    );

    setCustomNote('');
    setErrorMessage(null);
    setSendSuccess(false);

    // Jeśli e-mail kursanta jest placeholderem, domyślnie zaznacz chęć aktualizacji w profilu po wpisaniu właściwego
    const isPlaceholder = !initialEmail || initialEmail.includes('@student.vocabboost.com') || initialEmail.includes('@example.com');
    setUpdateProfileEmail(isPlaceholder);
  }, [isOpen, task, student]);

  const studentDisplayName = useMemo(() => {
    if (!student) return 'Kursant';
    const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
    return fullName || student.username || 'Kursant';
  }, [student]);

  const polishGreeting = useMemo(() => {
    const rawName = student?.firstName || student?.name || student?.username || '';
    return formatPolishGreeting(rawName);
  }, [student]);

  const isPlaceholderEmail = useMemo(() => {
    if (!recipientEmail) return true;
    const lower = recipientEmail.toLowerCase().trim();
    return lower.includes('@student.vocabboost.com') || lower.includes('@example.com') || !lower.includes('@');
  }, [recipientEmail]);

  // Bezpieczny unikalny link do bezpośredniego wykonania zadania bez logowania
  const directAccess = useMemo(() => {
    if (!task) return { token: '', url: '', expiresAt: '' };
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.maciej.pro';
    const token = task.accessToken || `hw_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
    const expiresAt = task.accessExpiresAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const url = `${origin}/hw?token=${token}`;
    return { token, url, expiresAt };
  }, [task]);

  // Generowanie dynamicznej treści e-maila
  const emailContent = useMemo(() => {
    if (!task) return { html: '', text: '', subject: '' };
    return buildHomeworkConfirmationEmail({
      studentName: student?.firstName || studentDisplayName,
      title: task.title,
      dueDate: task.dueDate,
      instructions: task.instructions,
      assignedBy: senderName,
      sentences: task.sentences || [],
      customNote: customNote.trim() || undefined,
      appUrl: directAccess.url,
      isDirectLink: true,
      expiresAt: directAccess.expiresAt,
    });
  }, [task, student, studentDisplayName, senderName, customNote, directAccess]);

  if (!isOpen || !task) return null;

  const handleSendEmail = async () => {
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

      const fromAddressToUse = `${senderName.trim()} <${senderEmail.trim()}>`;

      const res = await fetch('/api/mailing/test-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: cleanTo,
          from: fromAddressToUse,
          replyTo: senderEmail.trim(),
          subject: subject.trim() || emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          bcc: enableBcc && bccEmail ? bccEmail.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Nie udało się wysłać powiadomienia e-mail.');
      }

      // 1. Zaktualizuj znacznik oraz token w specialTasks
      if (task.id) {
        try {
          await updateDoc(doc(db, 'specialTasks', task.id), {
            emailNotificationSent: true,
            notificationSentAt: new Date().toISOString(),
            notificationSender: fromAddressToUse,
            notificationRecipient: cleanTo,
            manualEmailConfirmationRequired: false,
            skipAutoEmail: false,
            accessToken: directAccess.token,
            accessExpiresAt: directAccess.expiresAt,
            accessUrl: directAccess.url,
          });
        } catch (dbErr) {
          console.warn('Nie udało się zapisać statusu e-mail w specialTasks:', dbErr);
        }
      }

      // 2. Jeśli lektor zaznaczył aktualizację profilu kursanta
      if (updateProfileEmail && student?.id && cleanTo !== student.email) {
        try {
          await updateDoc(doc(db, 'users', student.id), {
            email: cleanTo,
          });
        } catch (profErr) {
          console.warn('Nie udało się zaktualizować e-maila w profilu kursanta:', profErr);
        }
      }

      setSendSuccess(true);
      setTimeout(() => {
        if (onEmailSent) onEmailSent();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Błąd podczas wysyłania maila z pracą domową:', err);
      setErrorMessage(err.message || 'Wystąpił błąd podczas wysyłania e-maila.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSkipSending = async () => {
    if (task.id) {
      try {
        await updateDoc(doc(db, 'specialTasks', task.id), {
          skipAutoEmail: true,
          manualEmailConfirmationRequired: false,
          emailNotificationSent: false,
        });
      } catch (err) {
        console.warn('Nie udało się zapisać pominięcia wysyłki e-mail w bazie:', err);
      }
    }
    if (onSkip) onSkip();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-base-100 border border-white/10 rounded-2xl w-full max-w-4xl flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-base-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  Powiadomienie E-mail o Pracy Domowej
                </h2>
                <span className="text-[10px] font-semibold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Potwierdzenie lektora
                </span>
              </div>
              <p className="text-xs text-content-muted mt-0.5">
                Praca została zapisana w systemie. Sprawdź i zatwierdź treść wiadomości przed wysłaniem.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-content-muted hover:text-text-hi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content - Two Columns on large screens */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {sendSuccess && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-300">
              <Check className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-sm font-semibold">
                Powiadomienie zostało pomyślnie wysłane do kursanta!
              </div>
            </div>
          )}

          {/* Factual Information & Mailbox Confirmation Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sender Mailbox Box */}
            <div className="bg-base-200/50 border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-content-muted flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-primary" /> Skrzynka Nadawcy (Od)
                </span>
                <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                  Zweryfikowany nadawca
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-content-muted block mb-1">Nazwa nadawcy</label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full bg-base-300/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:outline-none"
                    placeholder="np. Maciej Wyrozumski"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-content-muted block mb-1">Adres e-mail nadawcy</label>
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    className="w-full bg-base-300/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:outline-none"
                    placeholder="np. wyrozumski@maciej.pro"
                  />
                </div>
              </div>
            </div>

            {/* Recipient Mailbox Box */}
            <div className="bg-base-200/50 border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-content-muted flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-secondary" /> Skrzynka Odbiorcy (Do)
                </span>
                <span className="text-[11px] text-primary font-medium">
                  Kursant: {studentDisplayName}
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-content-muted block mb-1">Adres e-mail kursanta</label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className={`w-full bg-base-300/80 border rounded-lg px-3 py-2 text-xs text-white focus:outline-none ${
                      isPlaceholderEmail
                        ? 'border-amber-500/60 focus:border-amber-500 text-amber-200'
                        : 'border-white/10 focus:border-primary'
                    }`}
                    placeholder="kursant@example.com"
                  />
                </div>

                {isPlaceholderEmail && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2 text-[11px] text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong>Uwaga:</strong> Profil kursanta nie posiada prawdziwego adresu e-mail
                      (adres zastępczy). Wpisz prawidłowy adres powyżej, aby wiadomość dotarła.
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={updateProfileEmail}
                    onChange={(e) => setUpdateProfileEmail(e.target.checked)}
                    className="checkbox checkbox-xs checkbox-primary"
                  />
                  <span className="text-[11px] text-content-muted hover:text-text-hi transition-colors">
                    Zapisz ten adres w profilu kursanta w bazie danych
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Opcja ukrytej kopii do nadawcy (BCC) */}
          <div className="bg-base-200/50 border border-white/10 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-white font-semibold">
              <input
                type="checkbox"
                checked={enableBcc}
                onChange={(e) => setEnableBcc(e.target.checked)}
                className="checkbox checkbox-xs checkbox-primary"
              />
              <span>Wyślij ukrytą kopię (BCC) do nadawcy</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={bccEmail}
                onChange={(e) => setBccEmail(e.target.value)}
                disabled={!enableBcc}
                placeholder="wyrozumski@maciej.pro"
                className={`text-xs font-mono px-2.5 py-1 rounded-lg bg-base-300/90 border border-white/10 focus:border-primary focus:outline-none transition-opacity ${
                  enableBcc ? 'text-primary' : 'text-content-muted opacity-40'
                }`}
              />
              <span className="text-[10px] text-content-muted hidden md:inline font-mono">
                (weryfikacja wysyłki)
              </span>
            </div>
          </div>

          {/* Subject & Optional Teacher Note */}
          <div className="bg-base-200/50 border border-white/10 rounded-xl p-4 space-y-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-content-muted block mb-1">
                Temat wiadomości
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-base-300/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:outline-none font-medium"
                placeholder="Temat wiadomości..."
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-content-muted block mb-1">
                Osobista notatka / komentarz lektora (opcjonalnie)
              </label>
              <textarea
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                rows={2}
                className="w-full bg-base-300/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:outline-none placeholder:text-content-muted/60"
                placeholder="np. Dobra robota na dzisiejszych zajęciach! W razie pytań do zdań 3 i 4 napisz do mnie."
              />
            </div>
          </div>

          {/* Homework Factual Summary Pill */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-base-200/30 border border-white/10 rounded-xl text-xs">
            <div className="flex items-center gap-1.5 text-content-muted">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-white font-semibold">Temat:</span> {task.title}
            </div>
            <div className="h-3.5 w-px bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-1.5 text-content-muted">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-white font-semibold">Termin:</span> {task.dueDate || 'Brak terminu'}
            </div>
            <div className="h-3.5 w-px bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-1.5 text-content-muted">
              <ListChecks className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-white font-semibold">Zadań:</span> {task.sentences?.length || 0}
            </div>
            <div className="h-3.5 w-px bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-1.5 text-content-muted">
              <span className="text-white font-semibold">Powitanie:</span>{' '}
              <span className="text-emerald-400 font-medium">„{polishGreeting}”</span>
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'preview'
                    ? 'bg-primary text-primary-content shadow-sm'
                    : 'text-content-muted hover:text-text-hi hover:bg-white/5'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Wizualny podgląd e-mail (HTML)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('exercises')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'exercises'
                    ? 'bg-primary text-primary-content shadow-sm'
                    : 'text-content-muted hover:text-text-hi hover:bg-white/5'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                Treść zadań ({task.sentences?.length || 0})
              </button>
            </div>
          </div>

          {/* Tab 1: HTML Preview */}
          {activeTab === 'preview' && (
            <div className="bg-slate-900 border border-white/10 rounded-xl p-4 overflow-x-auto shadow-inner">
              <div className="max-w-[540px] mx-auto bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden text-slate-800">
                <div className="h-1.5 bg-gradient-to-r from-teal-500 to-blue-500" />
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-700">
                      CRIBRO ENGLISH
                    </span>
                    <span className="text-[9px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                      NOWA PRACA DOMOWA
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {polishGreeting}
                  </h3>

                  <p className="text-xs text-slate-650 leading-relaxed mb-4">
                    Lektor przypisał dla Ciebie nową pracę domową:{' '}
                    <strong className="text-slate-900 block mt-1 font-bold text-sm">
                      {task.title}
                    </strong>
                  </p>

                  {task.instructions && (
                    <div className="mb-4 bg-green-50 border-l-4 border-green-600 p-2.5 rounded-r text-xs">
                      <span className="font-bold text-green-800 uppercase tracking-wide text-[10px] block">
                        Wskazówki:
                      </span>
                      <span className="text-green-900">{task.instructions}</span>
                    </div>
                  )}

                  {customNote.trim() && (
                    <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-500 p-2.5 rounded-r text-xs">
                      <span className="font-bold text-yellow-800 uppercase tracking-wide text-[10px] block">
                        Wiadomość od lektora:
                      </span>
                      <span className="text-yellow-900">{customNote.trim()}</span>
                    </div>
                  )}

                  <table className="w-full text-xs border border-slate-200 rounded-lg mb-4">
                    <tbody>
                      {task.dueDate && (
                        <tr className="border-b border-slate-100">
                          <td className="p-2 text-slate-500 font-medium">Termin wykonania</td>
                          <td className="p-2 text-slate-900 font-bold text-right">
                            {task.dueDate}
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td className="p-2 text-slate-500 font-medium">Przypisane przez</td>
                        <td className="p-2 text-slate-900 font-bold text-right">{senderName}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="text-center my-6">
                    <span className="inline-block bg-teal-700 text-white font-bold text-xs py-2.5 px-6 rounded-lg shadow">
                      Wykonaj zadanie teraz (bez logowania) →
                    </span>
                    <p className="text-[10px] text-slate-500 mt-2">
                      🔒 Link unikalny, ważny 14 dni (nie wymaga logowania)
                    </p>
                  </div>

                  {/* Wizytówka stopki lektora */}
                  <div className="mt-6 border-[1.5px] border-blue-600 rounded p-4 bg-white text-slate-900 text-left">
                    <div className="text-base font-extrabold text-slate-900 leading-tight">
                      Maciej Wyrozumski
                    </div>
                    <div className="text-[11px] font-normal text-slate-600 mt-1">
                      Instructional Designer | AI EdTech Specialist | English Trainer
                    </div>
                    <div className="my-3 border-t-2 border-slate-900" />
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">✉️</span>
                        <span className="font-medium text-slate-900">wyrozumski@maciej.pro</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">📞</span>
                        <span className="font-medium text-slate-900">+48 698 250 507</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🌐</span>
                        <span className="font-medium text-slate-900">www.maciej.pro</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🔗</span>
                        <span className="font-medium text-slate-900">linkedin.com/in/maciej-pro</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🐙</span>
                        <span className="font-medium text-slate-900">github.com/raskolone</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Detailed exercises */}
          {activeTab === 'exercises' && (
            <div className="bg-base-200/40 border border-white/10 rounded-xl p-4 space-y-2.5 max-h-[350px] overflow-y-auto">
              {!task.sentences || task.sentences.length === 0 ? (
                <p className="text-xs text-content-muted text-center py-4">Brak zadań w zestawie.</p>
              ) : (
                task.sentences.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-base-300/60 border border-white/5 rounded-lg text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-content-muted font-mono text-[10px]">
                      <span>Zadanie {idx + 1}</span>
                      {item.hint && <span className="text-amber-400">Podpowiedź: {item.hint}</span>}
                    </div>
                    <div className="text-white font-medium">
                      {item.polishSentence || item.question || item.text || item.sentenceWithBlank || JSON.stringify(item)}
                    </div>
                    {item.englishTranslation && (
                      <div className="text-emerald-400 text-[11px]">
                        Wzór: {item.englishTranslation}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-base-200/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSkipSending}
            disabled={isSending}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-xs text-content-muted hover:text-text-hi transition-all font-medium"
          >
            Pomiń wysyłkę e-mail (tylko zapisz w systemie)
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={isSending || sendSuccess}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-content text-xs font-bold transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Wysyłanie...
                </>
              ) : sendSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Wysłano e-mail!
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Wyślij e-mail do kursanta
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeworkEmailConfirmationModal;
