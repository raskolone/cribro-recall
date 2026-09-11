import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, X } from 'lucide-react';
import { playNotificationChime } from '../../utils/notificationChime';

export interface ActionToastState {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

interface ActionToastProps {
  toast: ActionToastState | null;
  onDismiss: () => void;
  /** Ile milisekund zostaje na ekranie. */
  durationMs?: number;
}

/**
 * Potwierdzenie wykonanej akcji w prawym dolnym rogu.
 *
 * Zastępuje `alert()` tam, gdzie lektor coś właśnie zatwierdził: natywne okno
 * zabiera fokus, blokuje stronę i trzeba je odklikać, żeby wrócić do pracy.
 * Wygląd i dźwięk są te same co w powiadomieniu o odesłanej pracy
 * (`TeacherHomeworkNotification`), żeby wszystkie sygnały aplikacji czytały się
 * jak jeden system, a nie zbiór osobnych pomysłów.
 */
export const ActionToast: React.FC<ActionToastProps> = ({
  toast,
  onDismiss,
  durationMs = 6000,
}) => {
  useEffect(() => {
    if (!toast) return;
    playNotificationChime();
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [toast, durationMs, onDismiss]);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed bottom-5 right-5 z-[350] flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2.5rem)] pointer-events-none">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 350 }}
            role="status"
            className="pointer-events-auto p-4 rounded-2xl bg-base-200/95 border border-primary/40 backdrop-blur-xl shadow-ambient-lg relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start gap-3 relative z-10">
              <div className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30 shrink-0">
                {toast.icon || <CheckCircle2 size={20} />}
              </div>

              <div className="flex-1 min-w-0 pr-5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-primary">
                    Gotowe
                  </span>
                </div>

                <p className="text-[14px] font-extrabold text-text-hi leading-snug">{toast.title}</p>
                {toast.description && (
                  <p className="text-[12px] text-content-muted leading-relaxed mt-0.5">
                    {toast.description}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={onDismiss}
                aria-label="Zamknij powiadomienie"
                className="absolute top-1 right-1 p-1 rounded-lg text-content-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
};

export default ActionToast;
