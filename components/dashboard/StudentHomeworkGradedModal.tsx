import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Award, BookOpen, MessageSquareQuote, X, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import Button from '../ui/Button';
import { useEscapeModal } from '../../hooks/useEscapeModal';

interface StudentHomeworkGradedModalProps {
  onOpenHomework?: (taskId: string) => void;
}

const StudentHomeworkGradedModal: React.FC<StudentHomeworkGradedModalProps> = ({ onOpenHomework }) => {
  const { user } = useAuth();
  const [isClosing, setIsClosing] = useState(false);
  const [isLocallyDismissed, setIsLocallyDismissed] = useState(false);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  const currentHwId = user?.lastGradedHomeworkId || '';
  const notificationKey = currentHwId ? `graded_hw_${currentHwId}` : `graded_hw_user_${user?.id || 'unknown'}`;

  // Sprawdzamy czy powiadomienie o tej ocenie zostało już kiedykolwiek odrzucone w localStorage
  const isStoredAsDismissed = useMemo(() => {
    if (!user?.id) return false;
    try {
      if (currentHwId && localStorage.getItem(`dismissed_graded_hw_${user.id}_${currentHwId}`) === 'true') {
        return true;
      }
      const rawList = localStorage.getItem(`dismissed_graded_hw_ids_${user.id}`);
      if (rawList && currentHwId) {
        const list = JSON.parse(rawList);
        if (Array.isArray(list) && list.includes(currentHwId)) {
          return true;
        }
      }
      const generalTime = localStorage.getItem(`dismissed_graded_hw_general_${user.id}`);
      if (generalTime) {
        const diffHours = (Date.now() - Number(generalTime)) / (1000 * 60 * 60);
        if (diffHours < 24 && !currentHwId) {
          return true;
        }
      }
    } catch (e) {
      console.warn('Error reading localStorage for graded homework dismissal:', e);
    }
    return false;
  }, [user?.id, currentHwId]);

  // Sprawdzamy czy w profilu użytkownika w Firestore ta notyfikacja została już oznaczona jako dismissed
  const isDismissedInProfile = useMemo(() => {
    if (!user) return false;
    return Boolean(
      (currentHwId && user.dismissedNotifications?.includes(`graded_hw_${currentHwId}`)) ||
      (user.id && user.dismissedNotifications?.includes(`graded_hw_all_${user.id}`))
    );
  }, [user, currentHwId]);

  const isDismissed = isLocallyDismissed || dismissedKeys.has(notificationKey) || isStoredAsDismissed || isDismissedInProfile;
  const isVisible = Boolean(user?.hasGradedHomework && user?.id && !isDismissed);

  const clearNotification = async () => {
    if (!user?.id) return;
    try {
      const newDismissed = Array.from(new Set([
        ...(user.dismissedNotifications || []),
        notificationKey,
        ...(currentHwId ? [`graded_hw_${currentHwId}`] : []),
        `graded_hw_all_${user.id}`,
      ]));

      await updateDoc(doc(db, 'users', user.id), {
        hasGradedHomework: false,
        dismissedNotifications: newDismissed,
      });
    } catch (e) {
      console.warn('Failed to clear hasGradedHomework with dismissedNotifications, trying minimal update:', e);
      try {
        await updateDoc(doc(db, 'users', user.id), {
          hasGradedHomework: false,
        });
      } catch (e2) {
        console.error('Failed fallback update for hasGradedHomework:', e2);
      }
    }

    if (currentHwId) {
      try {
        await updateDoc(doc(db, 'specialTasks', currentHwId), {
          feedbackReadByStudent: true,
        });
      } catch {
        // Ignorujemy jeśli reguły ograniczają aktualizację zadania
      }
    }
  };

  // Jeśli w bazie wciąż wisi flaga hasGradedHomework, ale użytkownik już ją odrzucił — cicho czyścimy bazę w tle
  useEffect(() => {
    if (user?.id && user.hasGradedHomework && (isStoredAsDismissed || isDismissedInProfile || isLocallyDismissed)) {
      updateDoc(doc(db, 'users', user.id), {
        hasGradedHomework: false,
      }).catch(() => {});
    }
  }, [user?.id, user?.hasGradedHomework, isStoredAsDismissed, isDismissedInProfile, isLocallyDismissed]);

  const persistDismissalLocally = () => {
    setIsLocallyDismissed(true);
    setDismissedKeys((prev) => new Set([...prev, notificationKey]));
    if (user?.id) {
      try {
        if (currentHwId) {
          localStorage.setItem(`dismissed_graded_hw_${user.id}_${currentHwId}`, 'true');
          const rawList = localStorage.getItem(`dismissed_graded_hw_ids_${user.id}`);
          const list = rawList ? JSON.parse(rawList) : [];
          if (!list.includes(currentHwId)) {
            list.push(currentHwId);
            localStorage.setItem(`dismissed_graded_hw_ids_${user.id}`, JSON.stringify(list));
          }
        }
        localStorage.setItem(`dismissed_graded_hw_general_${user.id}`, String(Date.now()));
      } catch (e) {
        console.warn('Failed to persist dismissal to localStorage:', e);
      }
    }
  };

  const handleDismiss = async () => {
    // 1. Natychmiast zamykamy okno w UI i zapisujemy w pamięci podręcznej przeglądarki
    persistDismissalLocally();
    setIsClosing(true);

    // 2. Czyścimy w bazie Firestore
    await clearNotification();
    setIsClosing(false);
  };

  const handleOpenTask = async () => {
    const taskId = user?.lastGradedHomeworkId;
    // 1. Natychmiast ukrywamy modal
    persistDismissalLocally();
    setIsClosing(true);

    // 2. Przechodzimy do pracy domowej
    if (taskId && onOpenHomework) {
      onOpenHomework(taskId);
    }

    // 3. Asynchronicznie czyścimy flagi powiadomienia
    clearNotification().finally(() => {
      setIsClosing(false);
    });
  };

  useEscapeModal(isVisible, () => {
    handleDismiss();
  });

  const score = typeof user?.lastGradedScore === 'number' ? user.lastGradedScore : null;
  const feedback = user?.lastGradedFeedback?.trim();
  const taskTitle = user?.lastGradedHomeworkTitle || 'Praca domowa';

  return (
    <AnimatePresence>
      {isVisible && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="bg-base-200 border border-primary/35 w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-[0_20px_70px_rgba(0,0,0,0.7)] relative overflow-hidden"
          >
            {/* Subtle glowing decorative gradient */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

            <button
              onClick={handleDismiss}
              disabled={isClosing}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-text-hi transition-colors disabled:opacity-50 cursor-pointer"
              aria-label="Zamknij"
            >
              <X size={18} />
            </button>

            <div className="relative z-10 space-y-5">
              {/* Header with icon & badge */}
              <div className="flex items-start gap-4">
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/10 text-primary border border-primary/30 shrink-0 shadow-[0_0_20px_rgba(114,240,180,0.25)]">
                  <Award size={30} />
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 text-[11px] font-bold uppercase tracking-wider mb-1.5">
                    Nowa ocena
                  </span>
                  <h3 className="text-xl font-extrabold text-white leading-tight">
                    Lektor sprawdził Twoją pracę domową!
                  </h3>
                  <p className="text-sm font-semibold text-primary/90 mt-1 flex items-center gap-1.5 truncate">
                    <BookOpen size={14} className="shrink-0" />
                    <span>{taskTitle}</span>
                  </p>
                </div>
              </div>

              {/* Score pill if available */}
              {score !== null && (
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-base-100/70 border border-white/10">
                  <span className="text-xs font-bold uppercase tracking-wider text-content-muted">
                    Twój wynik
                  </span>
                  <span className="font-mono text-lg font-black text-primary">
                    {score}%
                  </span>
                </div>
              )}

              {/* Teacher comment quote box */}
              {feedback ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <MessageSquareQuote size={15} />
                    <span>Komentarz i wskazówki od lektora:</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/[0.08] to-base-100/80 border border-primary/20 text-content text-sm leading-relaxed whitespace-pre-wrap font-sans">
                    {feedback}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-content-muted leading-relaxed">
                  Lektor przejrzał Twoje odpowiedzi i zweryfikował zadania. Kliknij poniżej, aby zobaczyć szczegółowe podsumowanie.
                </p>
              )}

              {/* Action buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-center gap-2.5 pt-2">
                <Button
                  variant="secondary"
                  onClick={handleDismiss}
                  disabled={isClosing}
                  className="w-full sm:w-auto px-5 text-sm cursor-pointer"
                >
                  Zamknij
                </Button>
                <Button
                  onClick={handleOpenTask}
                  disabled={isClosing}
                  className="w-full sm:flex-1 flex items-center justify-center gap-2 bg-primary text-accent-ink font-bold px-6 shadow-lg shadow-primary/25 hover:shadow-primary/45 cursor-pointer"
                >
                  <span>Zobacz ocenioną pracę</span>
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default StudentHomeworkGradedModal;
