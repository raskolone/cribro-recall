import React, { useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  KeyRound,
  Mail,
  MoreHorizontal,
  UserCheck,
  Copy,
  Check,
  Lock,
  Globe,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { User } from '../../types';
import MenuDropdown from '../ui/MenuDropdown';

/**
 * NAGŁÓWEK PROFILU KURSANTA — jedno okno, cztery równe kafelki.
 *
 * ══ CO BYŁO NIE TAK ══
 *
 * Poprzedni nagłówek był jednym pasem, w którym wszystko stało obok siebie
 * w jednej linii: awatar, imię, login, poziom, rola, zawieszenie, archiwum,
 * e-mail z dwoma możliwymi dopiskami, liczba logowań, data ostatniej wizyty
 * — a po prawej trzy przyciski. Czternaście rzeczy w jednym rzędzie, każda
 * innej wysokości, innego koloru i innej wagi. Nic nie było w tej samej
 * kolumnie co cokolwiek innego, więc oko nie miało się o co zaczepić.
 *
 * ══ CO JEST TERAZ ══
 *
 * DWA PIĘTRA O JASNYM PODZIALE PRACY:
 *   1. Kto to jest — awatar, imię, login, znaczniki stanu. Po prawej
 *      wyjście (powrót do panelu) i menu z rzadziej używanym.
 *   2. Pasek stanu konta & zaproszeń — hasło początkowe (z opcją kopiowania
 *      dopóki nie zostało zmienione na własne lub połączone z Google),
 *      status zaproszenia (z możliwością manualnego oznaczenia/cofnięcia)
 *      oraz status aktywacji konta przez pierwsze logowanie.
 *   3. Co o nim wiadomo — CZTERY RÓWNE KAFELKI w siatce: e-mail, poziom,
 *      logowania, ostatnia wizyta. Równe, bo są tej samej rangi: to metryka
 *      konta, nie czynności.
 */

interface StudentProfileHeaderProps {
  student: User & { id: string };
  /** Powrót do panelu lektora — jedyne wyjście z widoku kursanta. */
  onBack: () => void;
  onChangeStudent: () => void;
  /** Kliknięcie w kafelek e-maila prowadzi do edycji danych kontaktowych. */
  onEditContact: () => void;
  onEditLevel: () => void;
  onToggleInvitationSent?: (sent: boolean) => void;
}

/** Kafelek metryki — wszystkie cztery mają tę samą budowę i tę samą wysokość. */
const MetricTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  onClick?: () => void;
  title?: string;
}> = ({ icon, label, value, note, onClick, title }) => {
  const Tag: any = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={`text-left rounded-xl border border-line-strong bg-base-100/45 px-3.5 py-3 min-w-0 flex flex-col gap-1 transition-colors ${
        onClick ? 'cursor-pointer hover:border-primary/45 hover:bg-base-100/70' : ''
      }`}
    >
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-content-muted">
        <span className="text-primary shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <span className="text-sm font-bold text-text-hi truncate">{value}</span>
      {note && <span className="text-[10px] font-semibold truncate">{note}</span>}
    </Tag>
  );
};

const StudentProfileHeader: React.FC<StudentProfileHeaderProps> = ({
  student,
  onBack,
  onChangeStudent,
  onEditContact,
  onEditLevel,
  onToggleInvitationSent,
}) => {
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [isUpdatingInvite, setIsUpdatingInvite] = useState(false);

  const fullName =
    `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.username;
  const initial = (student.firstName || student.username || '?')[0].toUpperCase();

  const hasPlaceholderEmail =
    !student.email || student.email.includes('@student.vocabboost.com');

  const roleLabel =
    student.role === 'teacher' ? 'Nauczyciel' : student.role === 'admin' ? 'Admin' : 'Kursant';
  const roleClass =
    student.role === 'admin'
      ? 'bg-danger/12 text-danger border-danger/30'
      : student.role === 'teacher'
      ? 'bg-primary/12 text-primary border-primary/30'
      : 'bg-line-soft text-text-2 border-line-strong';

  const handleCopyPassword = () => {
    if (!student.tempPassword) return;
    navigator.clipboard.writeText(student.tempPassword);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const isInviteSent = Boolean(student.invitationSent || student.lastInviteSentAt);
  const inviteDate = student.invitationSentAt
    ? new Date(student.invitationSentAt).toLocaleDateString('pl-PL')
    : student.lastInviteSentAt
    ? new Date(student.lastInviteSentAt).toLocaleDateString('pl-PL')
    : null;

  const isAccountActivated = Boolean(
    student.isActivated || (student.loginCount && student.loginCount > 0)
  );
  const activationDate = student.firstLoginAt
    ? new Date(student.firstLoginAt).toLocaleDateString('pl-PL')
    : student.lastLoginDate
    ? new Date(student.lastLoginDate).toLocaleDateString('pl-PL')
    : null;

  const isGoogleUser = Boolean(
    student.isGoogleLinked ||
      student.authProvider === 'google' ||
      (student.email && !student.tempPassword && !student.requirePasswordChange && !student.hasCustomPassword && student.email.includes('@gmail.com'))
  );

  const handleToggleInvitation = async () => {
    setIsUpdatingInvite(true);
    const newStatus = !isInviteSent;
    const nowIso = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'users', student.id), {
        invitationSent: newStatus,
        ...(newStatus ? { invitationSentAt: nowIso } : {}),
      });
      student.invitationSent = newStatus;
      if (newStatus) student.invitationSentAt = nowIso;
      onToggleInvitationSent?.(newStatus);
    } catch (err) {
      console.error('Failed to toggle invitation sent status:', err);
    } finally {
      setIsUpdatingInvite(false);
    }
  };

  return (
    <section className="rounded-2xl border border-line-strong bg-base-200/60 shadow-ambient-sm overflow-hidden">
      {/* ── Piętro 1: kto to jest ── */}
      <div className="px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-line-strong bg-base-100/30">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/40 flex items-center justify-center font-bold text-primary text-lg shrink-0 overflow-hidden">
            {student.photoURL ? (
              <img src={student.photoURL} alt="" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>

          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-extrabold text-text-hi truncate">{fullName}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-[11px] text-content-muted font-mono truncate">
                @{student.username}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${roleClass}`}
              >
                {roleLabel}
              </span>
              {student.isSuspended && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-warn/20 text-warn border border-warn/40">
                  Zawieszony
                </span>
              )}
              {student.isArchived && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-base-100 text-content-muted border border-line-strong">
                  Archiwum
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Wyjście i menu */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="px-3.5 py-2 rounded-xl border border-line-strong bg-base-100/60 text-content-muted hover:text-text-hi hover:border-primary/40 text-xs sm:text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Wróć do panelu lektora"
          >
            <ArrowLeft size={15} />
            <span className="hidden sm:inline">Panel lektora</span>
          </button>

          <MenuDropdown
            align="end"
            width={248}
            aria-label="Więcej czynności dla kursanta"
            triggerTitle="Więcej czynności"
            triggerClassName="p-2 rounded-xl border border-line-strong bg-base-100/60 text-content-muted hover:text-text-hi hover:border-primary/40 transition-colors cursor-pointer flex items-center justify-center"
            trigger={<MoreHorizontal size={16} />}
            sections={[
              {
                id: 'student',
                items: [
                  {
                    id: 'switch',
                    label: 'Zmień kursanta',
                    description: 'Otwórz profil kogoś innego',
                    icon: <UserCheck size={14} />,
                    onSelect: onChangeStudent,
                  },
                ],
              },
            ]}
          />
        </div>
      </div>

      {/* ── Pasek stanu konta & zaproszeń ── */}
      <div className="px-4 sm:px-5 py-2.5 bg-base-100/50 border-b border-line-strong flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Hasło startowe / status hasła */}
          {student.tempPassword ? (
            <button
              type="button"
              onClick={handleCopyPassword}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-warn/15 text-warn border border-warn/30 hover:bg-warn/25 font-mono text-[11px] font-bold transition-colors cursor-pointer shadow-sm"
              title="Hasło początkowe kursanta — możesz je skopiować dopóki nie zmieni go na własne lub nie połączy z kontem Google"
            >
              {copiedPassword ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-400">Skopiowano hasło: {student.tempPassword}</span>
                </>
              ) : (
                <>
                  <KeyRound size={13} />
                  <span>Kopiuj hasło startowe</span>
                  <Copy size={11} className="opacity-70 ml-0.5" />
                </>
              )}
            </button>
          ) : isGoogleUser ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/25 font-semibold text-[11px]"
              title="Kursant loguje się za pomocą konta Google"
            >
              <Globe size={13} />
              <span>Połączono z Google</span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 font-semibold text-[11px]"
              title="Kursant zmienił hasło na własne — hasło początkowe zostało trwale usunięte w celach bezpieczeństwa"
            >
              <Lock size={13} />
              <span>Hasło własne kursanta (chronione)</span>
            </span>
          )}

          {/* Status Zaproszenia */}
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                isInviteSent
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/25'
              }`}
              title={inviteDate ? `Data wysłania: ${inviteDate}` : undefined}
            >
              {isInviteSent ? <CheckCircle2 size={13} /> : <Clock size={13} />}
              <span>{isInviteSent ? 'Zaproszenie: Wysłano' : 'Zaproszenie: Nie wysłano'}</span>
              {inviteDate && <span className="text-[10px] opacity-75 font-mono">({inviteDate})</span>}
            </span>

            <button
              type="button"
              onClick={handleToggleInvitation}
              disabled={isUpdatingInvite}
              className="px-2 py-1 rounded-lg bg-base-200 hover:bg-base-300 border border-line-strong text-[10px] font-bold text-content-muted hover:text-text-hi transition-colors cursor-pointer"
              title={
                isInviteSent
                  ? 'Cofnij oznaczenie wysłania zaproszenia'
                  : 'Oznacz manualnie jako wysłane (jeśli wysłano poza aplikacją)'
              }
            >
              {isUpdatingInvite ? (
                <RefreshCw size={10} className="animate-spin" />
              ) : isInviteSent ? (
                'Cofnij'
              ) : (
                'Oznacz jako wysłane'
              )}
            </button>
          </div>

          {/* Status Aktywacji */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
              isAccountActivated
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-base-200 text-content-muted border-line-strong'
            }`}
            title={
              activationDate
                ? `Aktywowano: ${activationDate}`
                : 'Konto oczekuje na pierwsze logowanie kursanta'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isAccountActivated ? 'bg-emerald-400 animate-pulse' : 'bg-content-muted/40'
              }`}
            />
            <span>{isAccountActivated ? 'Konto aktywowane' : 'Oczekuje na 1. logowanie'}</span>
            {activationDate && (
              <span className="text-[10px] opacity-75 font-mono">({activationDate})</span>
            )}
          </span>
        </div>
      </div>

      {/* ── Piętro 2: cztery równe kafelki ── */}
      <div className="p-3 sm:p-4 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <MetricTile
          icon={<Mail size={12} />}
          label="E-mail"
          value={student.email || 'Brak adresu'}
          note={
            hasPlaceholderEmail ? (
              <span className="text-warn">Adres zastępczy</span>
            ) : (
              <span className="text-primary">Wysyłka przez Resend</span>
            )
          }
          onClick={onEditContact}
          title="Otwórz dane kontaktowe kursanta"
        />
        <MetricTile
          icon={<UserCheck size={12} />}
          label="Poziom"
          value={student.level || 'Nie ustalony'}
          note={<span className="text-content-muted">Wpływa na prompty AI</span>}
          onClick={onEditLevel}
          title="Otwórz poziom i ustawienia AI"
        />
        <MetricTile
          icon={<KeyRound size={12} />}
          label="Logowania"
          value={student.loginCount || 0}
          note={<span className="text-content-muted">Od założenia konta</span>}
        />
        <MetricTile
          icon={<CalendarClock size={12} />}
          label="Ostatnia wizyta"
          value={
            student.lastLoginDate
              ? new Date(student.lastLoginDate).toLocaleDateString('pl-PL')
              : 'Nigdy'
          }
          note={
            <span className="text-content-muted">
              {student.lastLoginDate
                ? new Date(student.lastLoginDate).toLocaleTimeString('pl-PL', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Brak logowania'}
            </span>
          }
        />
      </div>
    </section>
  );
};

export default StudentProfileHeader;
