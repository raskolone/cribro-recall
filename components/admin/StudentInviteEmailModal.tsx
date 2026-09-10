import React, { useState, useEffect, useMemo } from 'react';
import {
  Mail,
  Send,
  Check,
  AlertTriangle,
  X,
  Eye,
  FileText,
  User as UserIcon,
  Key,
  Globe,
  Copy,
  RefreshCw,
  Loader2,
  Sparkles,
  ShieldCheck,
  Bell,
  BellOff
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { User } from '../../types';
import { buildWelcomeEmail } from '../../services/homeworkEmail';
import { formatPolishGreeting } from '../../utils/polishVocative';
import { useFirebaseAdminApi } from '../../hooks/useFirebaseAdminApi';
import Button from '../ui/Button';

export interface StudentInviteEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: User | null;
  onInviteSent?: (updatedStudent?: Partial<User>) => void;
}

const generateSecurePassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `Cribro2026!${rand}`;
};

export const StudentInviteEmailModal: React.FC<StudentInviteEmailModalProps> = ({
  isOpen,
  onClose,
  student,
  onInviteSent,
}) => {
  const { changeUserPassword, changeUserEmail } = useFirebaseAdminApi();

  const [senderName, setSenderName] = useState<string>('Maciej Wyrozumski');
  const [senderEmail, setSenderEmail] = useState<string>('wyrozumski@maciej.pro');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [subject, setSubject] = useState<string>('Witaj w CRIBRO ENGLISH — Twoje dane logowania');
  const [customNote, setCustomNote] = useState<string>('');
  const [appUrl, setAppUrl] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [savePasswordToProfile, setSavePasswordToProfile] = useState<boolean>(true);
  const [updateProfileEmail, setUpdateProfileEmail] = useState<boolean>(false);
  const [enableBcc, setEnableBcc] = useState<boolean>(true);
  const [bccEmail, setBccEmail] = useState<string>('wyrozumski@maciej.pro');
  const [activeTab, setActiveTab] = useState<'preview' | 'text'>('preview');

  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedData, setCopiedData] = useState<boolean>(false);
  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);

  // Pobierz domyślne ustawienia poczty przy otwarciu
  useEffect(() => {
    if (!isOpen) return;

    const defaultOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://app.maciej.pro';
    setAppUrl(defaultOrigin);

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

  // Inicjalizacja pól na podstawie kursanta
  useEffect(() => {
    if (!isOpen || !student) return;

    const initialEmail = student.email ? student.email.trim() : '';
    setRecipientEmail(initialEmail);

    // Hasło: istniejące hasło tymczasowe lub nowe wygenerowane
    if (student.tempPassword && student.tempPassword.trim()) {
      setPassword(student.tempPassword.trim());
    } else {
      setPassword(generateSecurePassword());
    }

    setSubject('Witaj w CRIBRO ENGLISH — Twoje dane logowania');
    setCustomNote('');
    setErrorMessage(null);
    setSendSuccess(false);
    setCopiedData(false);
    setCopiedEmail(false);

    const isPlaceholder = !initialEmail || initialEmail.includes('@student.vocabboost.com') || initialEmail.includes('@example.com');
    setUpdateProfileEmail(isPlaceholder);
  }, [isOpen, student]);

  // Obsługa klawisza Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSending) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isSending, onClose]);

  const studentDisplayName = useMemo(() => {
    if (!student) return 'Kursant';
    const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
    return fullName || student.username || 'Kursant';
  }, [student]);

  const polishGreeting = useMemo(() => {
    const rawName = student?.firstName || (student as any)?.name || student?.username || '';
    return formatPolishGreeting(rawName);
  }, [student]);

  const isPlaceholderEmail = useMemo(() => {
    if (!recipientEmail) return true;
    const lower = recipientEmail.toLowerCase().trim();
    return lower.includes('@student.vocabboost.com') || lower.includes('@example.com') || !lower.includes('@');
  }, [recipientEmail]);

  // Dynamiczna treść e-maila
  const emailContent = useMemo(() => {
    if (!student) return { html: '', text: '', subject: '' };
    return buildWelcomeEmail({
      studentName: student.firstName || studentDisplayName,
      username: student.username || '',
      tempPassword: password,
      appUrl: appUrl || 'https://app.maciej.pro',
      customNote: customNote.trim() || undefined,
      assignedBy: senderName,
      subject: subject.trim() || undefined,
    });
  }, [student, studentDisplayName, password, appUrl, customNote, senderName, subject]);

  if (!isOpen || !student) return null;

  const handleCopyCredentials = () => {
    const textToCopy = `Witaj ${polishGreeting}!\n\nOto Twoje dane logowania do platformy CRIBRO ENGLISH:\n\n🔗 Adres: ${appUrl}\n👤 Login: ${student.username}\n🔑 Hasło: ${password}\n\nPo pierwszym zalogowaniu możesz zmienić hasło na własne lub powiązać konto z Google jednym kliknięciem.\n\nPozdrawiam,\n${senderName}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedData(true);
    setTimeout(() => setCopiedData(false), 2500);
  };

  const handleCopyFullEmail = () => {
    navigator.clipboard.writeText(emailContent.text);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleRegeneratePassword = () => {
    const newPass = generateSecurePassword();
    setPassword(newPass);
    setSavePasswordToProfile(true);
  };

  const handleSendEmail = async () => {
    const cleanTo = recipientEmail.trim();
    if (!cleanTo || !cleanTo.includes('@') || cleanTo.startsWith('@') || cleanTo.endsWith('@')) {
      setErrorMessage('Wprowadź prawidłowy adres e-mail odbiorcy.');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Hasło nie może być puste. Wpisz hasło lub kliknij "Generuj hasło".');
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
        throw new Error(data?.error || 'Nie udało się wysłać zaproszenia e-mail.');
      }

      // Aktualizacje profilu kursanta
      const profileUpdates: Partial<User> = {
        lastInviteSentAt: new Date().toISOString(),
        inviteSentBy: fromAddressToUse,
      };

      // 1. Zapis nowego/zaktualizowanego hasła
      if (savePasswordToProfile && password && password !== student.tempPassword) {
        profileUpdates.tempPassword = password.trim();
        profileUpdates.requirePasswordChange = true;
        try {
          await changeUserPassword(student.id, password.trim());
        } catch (pwErr) {
          console.warn('Nie udało się zaktualizować hasła w Firebase Auth (może wymagać uprawnień admina):', pwErr);
        }
      }

      // 2. Jeśli lektor zaznaczył aktualizację adresu e-mail
      if (updateProfileEmail && cleanTo !== student.email) {
        profileUpdates.email = cleanTo;
        try {
          await changeUserEmail(student.id, cleanTo);
        } catch (emErr) {
          console.warn('Nie udało się zaktualizować e-maila w Firebase Auth:', emErr);
        }
      }

      // 3. Zapis w Firestore
      try {
        await updateDoc(doc(db, 'users', student.id), profileUpdates as any);
      } catch (dbErr) {
        console.warn('Nie udało się zapisać danych zaproszenia w Firestore:', dbErr);
      }

      setSendSuccess(true);
      setTimeout(() => {
        if (onInviteSent) onInviteSent(profileUpdates);
        onClose();
      }, 1300);
    } catch (err: any) {
      console.error('Błąd podczas wysyłania zaproszenia do aplikacji:', err);
      setErrorMessage(err.message || 'Wystąpił błąd podczas wysyłania zaproszenia.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] bg-base-100 border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Bar */}
        <div className="h-1.5 bg-gradient-to-r from-primary via-teal-400 to-blue-500 shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3 bg-base-200/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary border border-primary/30 flex items-center justify-center shrink-0 shadow-inner">
              <Send className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white truncate">
                  Zaproszenie do aplikacji
                </h3>
                <span className="text-xs font-mono font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                  @{student.username}
                </span>
                {student.lastInviteSentAt && (
                  <span className="text-[10px] font-mono text-content-muted bg-white/5 border border-white/10 px-2 py-0.5 rounded-md hidden sm:inline">
                    Ostatnie wysłanie: {new Date(student.lastInviteSentAt).toLocaleDateString('pl-PL')}
                  </span>
                )}
              </div>
              <p className="text-xs text-content-muted mt-0.5 truncate">
                Spersonalizowana wiadomość z loginem, hasłem oraz bezpośrednim linkiem logowania dla {studentDisplayName}.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSending}
            className="p-2 rounded-xl text-content-muted hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
            title="Zamknij okno (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Overlay if sent */}
        {sendSuccess ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center animate-bounce">
              <Check className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-bold text-white">Zaproszenie wysłane pomyślnie!</h4>
            <p className="text-sm text-content-muted max-w-md">
              Wiadomość z loginem, hasłem i linkiem logowania dotarła na adres <strong className="text-white">{recipientEmail}</strong>.
            </p>
          </div>
        ) : (
          /* Modal Body Grid */
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-white/10">
            {/* Left Column: Form Settings (lg:col-span-6) */}
            <div className="lg:col-span-6 p-4 sm:p-5 space-y-4 overflow-y-auto">
              {/* Recipient & Sender */}
              <div className="space-y-3 bg-base-200/40 p-3.5 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-content-muted flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-primary" /> Adres odbiorcy (Do)
                  </span>
                  {!isPlaceholderEmail ? (
                    <span className="text-[11px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                      <ShieldCheck size={11} /> Prawidłowy e-mail
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                      <AlertTriangle size={11} /> Wymaga wpisania
                    </span>
                  )}
                </div>

                <div>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="kursant@example.com"
                    className={`w-full bg-base-300/80 border rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none transition-colors ${
                      isPlaceholderEmail
                        ? 'border-amber-500/60 focus:border-amber-500 text-amber-200'
                        : 'border-white/10 focus:border-primary'
                    }`}
                  />
                  {isPlaceholderEmail && (
                    <div className="mt-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-300 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        Profil kursanta zawiera adres zastępczy (placeholder). Wprowadź prawdziwy adres e-mail, na który ma trafić zaproszenie.
                      </span>
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={updateProfileEmail}
                      onChange={(e) => setUpdateProfileEmail(e.target.checked)}
                      className="rounded border-white/20 text-primary focus:ring-primary h-3.5 w-3.5 bg-base-300"
                    />
                    <span className="text-[11px] text-content-muted hover:text-white transition-colors">
                      Zaktualizuj ten adres e-mail w profilu kursanta
                    </span>
                  </label>
                </div>
              </div>

              {/* Login & Password Credentials Card */}
              <div className="space-y-3 bg-base-200/40 p-3.5 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-content-muted flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-primary" /> Dane logowania w wiadomości
                  </span>
                  <button
                    type="button"
                    onClick={handleRegeneratePassword}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    title="Wygeneruj nowe losowe hasło"
                  >
                    <RefreshCw size={11} /> Wygeneruj nowe
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-content-muted block mb-1">Login (username)</label>
                    <div className="w-full bg-base-300/80 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-primary truncate">
                      @{student.username}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-content-muted block mb-1">Hasło</label>
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setSavePasswordToProfile(true);
                      }}
                      className="w-full bg-base-300/80 border border-white/10 focus:border-primary rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none"
                      placeholder="Wpisz hasło..."
                    />
                  </div>
                </div>

                <div className="pt-1 flex flex-col gap-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={savePasswordToProfile}
                      onChange={(e) => setSavePasswordToProfile(e.target.checked)}
                      className="rounded border-white/20 text-primary focus:ring-primary h-3.5 w-3.5 bg-base-300"
                    />
                    <span className="text-[11px] text-content-muted hover:text-white transition-colors">
                      Zapisz jako hasło tymczasowe w profilu kursanta (wymusza zmianę po zalogowaniu)
                    </span>
                  </label>
                </div>
              </div>

              {/* App URL and Sender Box */}
              <div className="space-y-3 bg-base-200/40 p-3.5 rounded-xl border border-white/5">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-content-muted block mb-1 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-primary" /> Adres docelowy aplikacji (przycisk CTA)
                  </label>
                  <input
                    type="url"
                    value={appUrl}
                    onChange={(e) => setAppUrl(e.target.value)}
                    className="w-full bg-base-300/80 border border-white/10 focus:border-primary rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
                    placeholder="https://app.maciej.pro"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] text-content-muted block mb-1">Nazwa nadawcy</label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      className="w-full bg-base-300/80 border border-white/10 focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-content-muted block mb-1">E-mail nadawcy (Resend)</label>
                    <input
                      type="email"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      className="w-full bg-base-300/80 border border-white/10 focus:border-primary rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* BCC Option */}
                <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t border-white/5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-white font-medium">
                    <input
                      type="checkbox"
                      checked={enableBcc}
                      onChange={(e) => setEnableBcc(e.target.checked)}
                      className="rounded border-white/20 text-primary focus:ring-primary h-3.5 w-3.5 bg-base-300"
                    />
                    <span>Kopia dla lektora (BCC)</span>
                  </label>
                  <input
                    type="email"
                    value={bccEmail}
                    onChange={(e) => setBccEmail(e.target.value)}
                    disabled={!enableBcc}
                    className={`text-xs font-mono px-2.5 py-1 rounded-lg bg-base-300 border border-white/10 focus:border-primary focus:outline-none ${
                      enableBcc ? 'text-primary' : 'text-content-muted opacity-40'
                    }`}
                  />
                </div>
              </div>

              {/* Subject & Custom Teacher Note */}
              <div className="space-y-3 bg-base-200/40 p-3.5 rounded-xl border border-white/5">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-content-muted block mb-1">
                    Temat wiadomości e-mail
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-base-300/80 border border-white/10 focus:border-primary rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-content-muted block mb-1 flex items-center justify-between">
                    <span>Osobista notatka / instrukcje od lektora (opcjonalnie)</span>
                    <span className="text-[10px] text-content-muted font-normal">Pojawi się w treści e-maila</span>
                  </label>
                  <textarea
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    rows={2}
                    placeholder="np. Cieszę się na naszą współpracę! Pierwsze zajęcia odbędą się w czwartek o 18:00. Zaloguj się wcześniej i sprawdź platformę."
                    className="w-full bg-base-300/80 border border-white/10 focus:border-primary rounded-xl p-3 text-xs text-white focus:outline-none resize-y placeholder:text-content-muted/60"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Live Email Preview (lg:col-span-6) */}
            <div className="lg:col-span-6 p-4 sm:p-5 flex flex-col space-y-3 bg-base-200/20 overflow-hidden">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 p-1 bg-base-300/80 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'preview'
                        ? 'bg-primary text-accent-ink shadow-sm'
                        : 'text-content-muted hover:text-white'
                    }`}
                  >
                    <Eye size={13} /> Podgląd wizualny
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('text')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'text'
                        ? 'bg-primary text-accent-ink shadow-sm'
                        : 'text-content-muted hover:text-white'
                    }`}
                  >
                    <FileText size={13} /> Treść tekstowa
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopyCredentials}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Kopiuj login, hasło i link do schowka"
                  >
                    {copiedData ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span className="hidden sm:inline">{copiedData ? 'Skopiowano dane!' : 'Kopiuj dane'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyFullEmail}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Kopiuj pełną treść wiadomości tekstowej"
                  >
                    {copiedEmail ? <Check size={13} className="text-emerald-400" /> : <FileText size={13} />}
                    <span className="hidden sm:inline">{copiedEmail ? 'Skopiowano e-mail!' : 'Kopiuj e-mail'}</span>
                  </button>
                </div>
              </div>

              {/* Email Client Simulation Container */}
              <div className="flex-1 min-h-[360px] rounded-xl border border-white/15 overflow-hidden flex flex-col bg-slate-900 shadow-inner">
                {/* Client Window Header */}
                <div className="bg-slate-950/90 border-b border-white/10 px-3.5 py-2 flex flex-col gap-1 text-[11px] font-mono shrink-0">
                  <div className="flex items-center justify-between text-content-muted">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-primary font-bold">Od:</span>
                      <span className="text-white/90 truncate">{senderName} &lt;{senderEmail}&gt;</span>
                    </div>
                    <span className="text-[10px] text-content-muted bg-white/5 px-2 py-0.5 rounded border border-white/10 shrink-0">
                      Podgląd CRIBRO
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-content-muted truncate">
                    <span className="text-primary font-bold">Do:</span>
                    <span className="text-white/90 truncate">{recipientEmail || 'kursant@example.com'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-content-muted truncate">
                    <span className="text-primary font-bold">Temat:</span>
                    <span className="text-white font-semibold truncate">{subject || emailContent.subject}</span>
                  </div>
                </div>

                {/* View Container */}
                <div className="flex-1 overflow-y-auto min-h-0 bg-[#0f172a]">
                  {activeTab === 'preview' ? (
                    <div
                      className="p-3 sm:p-4"
                      dangerouslySetInnerHTML={{ __html: emailContent.html }}
                    />
                  ) : (
                    <div className="p-4 font-mono text-xs text-white/90 whitespace-pre-wrap leading-relaxed select-all">
                      {emailContent.text}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-base-200/50">
          <div className="flex items-center gap-2 text-xs text-content-muted w-full sm:w-auto">
            {errorMessage && (
              <span className="text-danger flex items-center gap-1.5 font-medium">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{errorMessage}</span>
              </span>
            )}
            {!errorMessage && isPlaceholderEmail && !sendSuccess && (
              <span className="text-amber-400 flex items-center gap-1.5">
                <AlertTriangle size={14} className="shrink-0" />
                <span>Wpisz właściwy adres e-mail kursanta przed wysłaniem.</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <Button
              variant="secondary"
              size="sm"
              disabled={isSending}
              onClick={onClose}
              className="px-4 cursor-pointer"
            >
              Anuluj
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyCredentials}
              className="px-4 cursor-pointer hidden sm:flex items-center gap-1.5"
            >
              <Copy size={14} />
              <span>{copiedData ? 'Skopiowano!' : 'Kopiuj dane'}</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              disabled={isSending || sendSuccess}
              isLoading={isSending}
              onClick={handleSendEmail}
              className="bg-primary text-accent-ink hover:brightness-110 font-bold px-6 shadow-btn flex items-center gap-2 cursor-pointer"
            >
              {isSending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Wysyłanie...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Wyślij zaproszenie</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentInviteEmailModal;
