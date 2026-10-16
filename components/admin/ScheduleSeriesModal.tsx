import React, { useState } from 'react';
import i18n from 'i18next';
import { AlertTriangle, Calendar, Check, Clock, Loader2, Mail, ShieldAlert, X } from 'lucide-react';
import { HomeworkType, User } from '../../types';
import { auth } from '../../firebase';
import { formatStudentLabel } from '../../utils/buildHomeworkAssignment';
import { getWarsawDateString } from '../../utils/homeworkSeries';

interface ScheduleSeriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduled?: (seriesId: string) => void;
  studentId: string;
  student?: Partial<User> | null;
  /** Liczba kursantów objętych serią — pokazywana przy potwierdzeniu automatycznych maili. */
  recipientCount?: number;
  title: string;
  usable: Array<{ type: HomeworkType }>;
  items: any[];
  warmup?: any;
  warmupCards?: any;
}

export const ScheduleSeriesModal: React.FC<ScheduleSeriesModalProps> = ({
  isOpen,
  onClose,
  onScheduled,
  studentId,
  student,
  recipientCount = 1,
  title,
  usable,
  items,
  warmup,
  warmupCards,
}) => {
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return getWarsawDateString(d);
  })();

  const [seriesTitle, setSeriesTitle] = useState(title || i18n.t('Seria prac domowych'));
  const [slotDate, setSlotDate] = useState(tomorrow);
  const [dueInDays, setDueInDays] = useState(3);
  // Automatyczne maile: domyślnie wyłączone; włączenie dopiero po jawnym potwierdzeniu
  // (krok `isConfirmingAutoEmail`). Serwer bez `autoEmailConfirmed` odrzuci `autoEmail: true`.
  const [autoEmail, setAutoEmail] = useState(false);
  const [isConfirmingAutoEmail, setIsConfirmingAutoEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleAutoEmailToggle = (checked: boolean) => {
    if (checked) {
      setIsConfirmingAutoEmail(true);
    } else {
      setAutoEmail(false);
      setIsConfirmingAutoEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isConfirmingAutoEmail) return;
    if (!studentId) {
      setError(i18n.t('Wybierz kursanta przed zaplanowaniem serii.'));
      return;
    }
    if (!slotDate) {
      setError(i18n.t('Wybierz datę wydania zadania.'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const user = auth.currentUser;
      const token = await user?.getIdToken?.();
      if (!user || !token) {
        throw new Error(i18n.t('Sesja wygasła — zaloguj się ponownie.'));
      }

      const itemId = `item_${Date.now()}`;
      const payload = {
        title: seriesTitle.trim() || i18n.t('Seria prac domowych'),
        studentUid: studentId,
        ownerUid: user.uid,
        autoEmail,
        autoEmailConfirmed: autoEmail,
        items: [
          {
            itemId,
            slotDate,
            dueInDays: Number(dueInDays) || 3,
          },
        ],
        itemPayloads: {
          [itemId]: {
            itemId,
            title: title || seriesTitle,
            type: usable[0]?.type || 'translation',
            types: usable.map((u) => u.type),
            sentences: items,
            warmup,
            warmupCards,
          },
        },
      };

      const res = await fetch('/api/homework-series', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || i18n.t('Nie udało się zaplanować serii'));
      }

      setSuccess(true);
      setTimeout(() => {
        if (onScheduled) onScheduled(data.series?.id);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || i18n.t('Wystąpił błąd podczas zapisywania serii'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const studentName = formatStudentLabel(student);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      data-testid="schedule-series-modal"
    >
      <div className="bg-surface-flat dark:bg-base-100 w-full max-w-lg rounded-2xl border border-line-strong shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-line-weak flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Calendar size={20} />
            </div>
            <div>
              <h2 id="schedule-modal-title" className="text-base font-bold text-text-hi">
                {i18n.t('Zaplanuj na dzień w serii')}
              </h2>
              <p className="text-xs text-text-mute mt-0.5">
                {i18n.t('Dla')}: <strong className="text-text-hi">{studentName}</strong> ·{' '}
                {i18n.t('Zadań: {{count}}', { count: items.length })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="schedule-close-x-btn"
            className="p-1.5 rounded-lg text-text-mute hover:text-text-hi hover:bg-base-200/50 transition-colors"
            aria-label={i18n.t('Zamknij okno')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {success ? (
          <div className="p-8 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Check size={28} className="stroke-[3]" />
            </div>
            <h3 className="text-lg font-bold text-text-hi">{i18n.t('Zaplanowano')}</h3>
            <p className="text-sm text-text-2 leading-relaxed">
              {i18n.t('Zadanie trafi do kursanta {{date}} rano.', { date: slotDate })}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <ShieldAlert size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="series-title-input" className="block text-xs font-bold text-text-2 mb-1.5 uppercase tracking-wide">
                {i18n.t('Nazwa serii')}
              </label>
              <input
                id="series-title-input"
                type="text"
                value={seriesTitle}
                onChange={(e) => setSeriesTitle(e.target.value)}
                placeholder={i18n.t('np. Kurs B2 — powtórka czasów')}
                className="w-full min-h-[2.75rem] px-3.5 bg-base-100 dark:bg-base-200 border border-line-strong rounded-xl text-sm text-text-hi focus:border-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="slot-date-input" className="block text-xs font-bold text-text-2 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                  <Calendar size={13} /> {i18n.t('Dzień wydania (Warszawa)')}
                </label>
                <input
                  id="slot-date-input"
                  data-testid="schedule-slot-date"
                  type="date"
                  value={slotDate}
                  min={getWarsawDateString(new Date())}
                  onChange={(e) => setSlotDate(e.target.value)}
                  className="w-full min-h-[2.75rem] px-3 bg-base-100 dark:bg-base-200 border border-line-strong rounded-xl text-sm text-text-hi focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="due-in-days-input" className="block text-xs font-bold text-text-2 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                  <Clock size={13} /> {i18n.t('Czas na wykonanie (dni)')}
                </label>
                <input
                  id="due-in-days-input"
                  data-testid="schedule-due-in-days"
                  type="number"
                  min="1"
                  max="30"
                  value={dueInDays}
                  onChange={(e) => setDueInDays(parseInt(e.target.value, 10) || 3)}
                  className="w-full min-h-[2.75rem] px-3 bg-base-100 dark:bg-base-200 border border-line-strong rounded-xl text-sm text-text-hi focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-line-weak space-y-2">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-line-strong bg-base-200/40 hover:bg-base-200/60 cursor-pointer select-none transition-colors">
                <input
                  type="checkbox"
                  data-testid="schedule-auto-email-toggle"
                  checked={autoEmail || isConfirmingAutoEmail}
                  onChange={(e) => handleAutoEmailToggle(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-line-strong bg-base-100 text-primary focus:ring-primary accent-primary"
                />
                <div className="text-xs">
                  <span className="font-bold text-text-hi flex items-center gap-1.5">
                    <Mail size={13} /> {i18n.t('Automatyczny e-mail po każdym wydaniu')}
                  </span>
                  <p className="text-text-mute mt-0.5 leading-relaxed">
                    {autoEmail
                      ? i18n.t('Włączone i potwierdzone.')
                      : i18n.t('Domyślnie wyłączone — po wydaniu wyślesz e-mail ręcznie, jak przy zwykłej pracy.')}
                  </p>
                </div>
              </label>

              {isConfirmingAutoEmail && (
                <div
                  role="alertdialog"
                  aria-labelledby="auto-email-confirm-title"
                  data-testid="auto-email-confirm"
                  className="p-3.5 rounded-xl border border-warn/40 bg-warn/10 space-y-2.5 text-xs"
                >
                  <p id="auto-email-confirm-title" className="font-bold text-text-hi flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-warn" /> {i18n.t('Włączyć automatyczne e-maile?')}
                  </p>
                  <p className="text-text-2 leading-relaxed" data-testid="auto-email-confirm-count">
                    {i18n.t('Liczba kursantów: {{count}}', { count: recipientCount })}
                  </p>
                  <p className="text-text-2 leading-relaxed">
                    {i18n.t(
                      'Po każdym wydaniu z tej serii e-mail wyjdzie automatycznie, bez dodatkowego potwierdzenia z Twojej strony.'
                    )}
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      data-testid="auto-email-confirm-cancel"
                      onClick={() => setIsConfirmingAutoEmail(false)}
                      className="min-h-[2.5rem] px-3.5 rounded-lg border border-line-strong text-text-hi font-semibold hover:bg-base-200 transition-colors"
                    >
                      {i18n.t('Zostaw wyłączone')}
                    </button>
                    <button
                      type="button"
                      data-testid="auto-email-confirm-accept"
                      onClick={() => {
                        setAutoEmail(true);
                        setIsConfirmingAutoEmail(false);
                      }}
                      className="min-h-[2.5rem] px-3.5 rounded-lg bg-primary text-accent-ink font-bold hover:opacity-95 transition-opacity"
                    >
                      {i18n.t('Włącz automatyczne e-maile')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                data-testid="schedule-cancel-btn"
                className="min-h-[2.75rem] px-4 rounded-xl border border-line-strong text-text-hi font-semibold text-xs hover:bg-base-200 transition-colors"
              >
                {i18n.t('Anuluj')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isConfirmingAutoEmail}
                data-testid="schedule-confirm-btn"
                className="min-h-[2.75rem] px-5 rounded-xl bg-primary text-accent-ink font-bold text-xs flex items-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> {i18n.t('Zapisuję…')}
                  </>
                ) : (
                  <>
                    <Calendar size={14} /> {i18n.t('Zaplanuj w serii')}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ScheduleSeriesModal;
