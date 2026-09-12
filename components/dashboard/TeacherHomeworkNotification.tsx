import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { collection, collectionGroup, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { AlertTriangle, BookOpenCheck, ChevronRight, GraduationCap, X } from 'lucide-react';
import { playNotificationChime } from '../../utils/notificationChime';

interface TeacherHomeworkNotificationProps {
  onOpenHomework?: (taskId: string) => void;
  /** Zgłoszenia v2 nie mają jednego `taskId` do otwarcia — prowadzą do kolejki. */
  onOpenV2Review?: () => void;
}

interface NotificationItem {
  id: string;
  taskId: string;
  studentName: string;
  title: string;
  itemType: 'homework' | 'test' | 'v2review';
}

/**
 * Widget "wymaga uwagi", nie toast.
 *
 * Zgłoszenie 2026-09-12: "odesłane prace domowe nie mają być w sidebarze —
 * jeżeli jest coś odesłane i potrzebne, niech się pojawi w prawym dolnym
 * rogu, będzie można otworzyć podgląd i wybrać, czy chce się przejść".
 *
 * Różnica względem poprzedniej wersji (auto-znikający toast po 10s): ten
 * widget pokazuje KOMPLET aktualnie nieprzejrzanych spraw, nie tylko te,
 * które akurat napłynęły w tej sesji — inaczej odświeżenie strony albo
 * zamknięcie toastu gubiłoby informację o czymś, co wciąż czeka. Dźwięk
 * gra tylko przy faktycznie nowym zdarzeniu (docChanges 'added'), nie przy
 * każdym renderze listy.
 */
export const TeacherHomeworkNotification: React.FC<TeacherHomeworkNotificationProps> = ({
  onOpenHomework,
  onOpenV2Review,
}) => {
  const [tasks, setTasks] = useState<Record<string, NotificationItem>>({});
  const [tests, setTests] = useState<Record<string, NotificationItem>>({});
  const [flagged, setFlagged] = useState<Record<string, NotificationItem>>({});
  // sessionStorage, nie useState(new Set()): "Później" ma przeżyć F5 w tej
  // samej karcie (spójne z resztą podstrony — patrz Dashboard.tsx), ale nie
  // ma być trwałe na zawsze — nowa karta/dzień znowu pokaże to, co czeka.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem('cribro_dismissed_attention_items');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [isExpanded, setIsExpanded] = useState(false);

  const isInitialLoadTasksRef = useRef(true);
  const isInitialLoadTestsRef = useRef(true);
  const isInitialLoadFlaggedRef = useRef(true);

  useEffect(() => {
    // 1. Prace domowe odesłane, jeszcze nieprzejrzane przez lektora
    const qTasks = query(collection(db, 'specialTasks'), where('status', '==', 'submitted'));
    const unsubTasks = onSnapshot(
      qTasks,
      (snapshot) => {
        const next: Record<string, NotificationItem> = {};
        snapshot.docs.forEach((d) => {
          const data = d.data() as any;
          if (data.teacherRead === true) return;
          next[`homework-${d.id}`] = {
            id: `homework-${d.id}`,
            taskId: d.id,
            studentName: data.studentName || data.studentUsername || 'Kursant',
            title: data.title || 'Praca domowa',
            itemType: 'homework',
          };
        });
        setTasks(next);

        if (isInitialLoadTasksRef.current) {
          isInitialLoadTasksRef.current = false;
          return;
        }
        const hasNew = snapshot.docChanges().some((c) => c.type === 'added' && !c.doc.data().teacherRead);
        if (hasNew) playNotificationChime();
      },
      (error) => console.error('TeacherHomeworkNotification snapshot error:', error)
    );

    // 2. Testy odesłane/ukończone, jeszcze nieprzejrzane
    let unsubTests: (() => void) | undefined;
    try {
      const qTests = query(collectionGroup(db, 'tests'), where('teacherRead', '==', false));
      unsubTests = onSnapshot(
        qTests,
        (snapshot) => {
          const next: Record<string, NotificationItem> = {};
          snapshot.docs.forEach((d) => {
            const data = d.data() as any;
            if (!(data.status === 'graded' || data.status === 'completed' || data.completedAt)) return;
            next[`test-${d.id}`] = {
              id: `test-${d.id}`,
              taskId: d.id,
              studentName: data.studentName || 'Kursant',
              title: data.title || 'Test wiedzy',
              itemType: 'test',
            };
          });
          setTests(next);

          if (isInitialLoadTestsRef.current) {
            isInitialLoadTestsRef.current = false;
            return;
          }
          const hasNew = snapshot.docChanges().some((c) => c.type === 'added');
          if (hasNew) playNotificationChime();
        },
        (error) => console.warn('TeacherHomeworkNotification tests snapshot error:', error)
      );
    } catch (e) {
      console.warn('TeacherHomeworkNotification setup tests error:', e);
    }

    // 3. Próby v2 oznaczone do przeglądu przez lektora
    let unsubFlagged: (() => void) | undefined;
    try {
      const qFlagged = query(collectionGroup(db, 'attempts'), where('requiresTeacherReview', '==', true));
      unsubFlagged = onSnapshot(
        qFlagged,
        (snapshot) => {
          const next: Record<string, NotificationItem> = {};
          snapshot.docs.forEach((d) => {
            const data = d.data() as any;
            next[`v2review-${d.id}`] = {
              id: `v2review-${d.id}`,
              taskId: d.ref.parent.parent?.id || '',
              studentName: 'Praca domowa v2',
              title: `Próba ${data.attemptNumber ?? ''} wymaga uwagi`.trim(),
              itemType: 'v2review',
            };
          });
          setFlagged(next);

          if (isInitialLoadFlaggedRef.current) {
            isInitialLoadFlaggedRef.current = false;
            return;
          }
          const hasNew = snapshot.docChanges().some((c) => c.type === 'added');
          if (hasNew) playNotificationChime();
        },
        (error) => console.warn('TeacherHomeworkNotification flagged attempts snapshot error:', error)
      );
    } catch (e) {
      console.warn('TeacherHomeworkNotification setup flagged attempts error:', e);
    }

    return () => {
      unsubTasks();
      if (unsubTests) unsubTests();
      if (unsubFlagged) unsubFlagged();
    };
  }, []);

  const items = useMemo(
    () =>
      [...Object.values(tasks), ...Object.values(tests), ...Object.values(flagged)].filter(
        (item) => !dismissedIds.has(item.id)
      ),
    [tasks, tests, flagged, dismissedIds]
  );

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev).add(id);
      try {
        sessionStorage.setItem('cribro_dismissed_attention_items', JSON.stringify([...next]));
      } catch {
        // Prywatna karta / zablokowany storage — "Później" po prostu nie przeżyje F5.
      }
      return next;
    });
  };

  const handleAction = (item: NotificationItem) => {
    handleDismiss(item.id);
    setIsExpanded(false);
    if (item.itemType === 'v2review') {
      onOpenV2Review?.();
      return;
    }
    onOpenHomework?.(item.taskId);
  };

  if (items.length === 0) return null;

  const iconFor = (type: NotificationItem['itemType']) =>
    type === 'test' ? (
      <GraduationCap size={16} />
    ) : type === 'v2review' ? (
      <AlertTriangle size={16} />
    ) : (
      <BookOpenCheck size={16} />
    );

  const labelFor = (type: NotificationItem['itemType']) =>
    type === 'test' ? 'Odesłano test' : type === 'v2review' ? 'Wymaga uwagi (v2)' : 'Odesłano pracę';

  const actionLabelFor = (type: NotificationItem['itemType']) =>
    type === 'test' ? 'Zobacz test' : type === 'v2review' ? 'Zobacz kolejkę' : 'Sprawdź i oceń';

  // Portal do <body>, bo komponent wisi wewnątrz <main> panelu. Wystarczy, że
  // któryś z paneli po drodze animuje się transformem (a robi to niejeden
  // ekran na motion/react), a `position: fixed` zaczyna się liczyć względem
  // tego przodka — widget ląduje wtedy w losowym miejscu albo znika pod
  // krawędzią panelu. W portalu wychodzi w prawym dolnym rogu zawsze.
  return createPortal(
    <div className="fixed bottom-5 right-5 z-[350] flex flex-col items-end gap-2.5">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', damping: 24, stiffness: 360 }}
            className="w-[calc(100vw-2.5rem)] max-w-sm max-h-[70vh] overflow-y-auto rounded-2xl bg-base-200/95 border border-primary/40 backdrop-blur-xl shadow-[var(--shadow-lg)] p-2"
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-primary">
                Wymaga uwagi ({items.length})
              </span>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-lg text-content-muted hover:text-text-hi hover:bg-white/10 transition-colors"
                aria-label="Zwiń"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-1.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-base-100/60 border border-line-strong flex items-start gap-2.5"
                >
                  <div className="p-2 rounded-lg bg-primary/20 text-primary border border-primary/30 shrink-0">
                    {iconFor(item.itemType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      {labelFor(item.itemType)}
                    </p>
                    <p className="text-[13px] font-bold text-text-hi leading-snug truncate">{item.studentName}</p>
                    <p className="text-[11px] text-content-muted leading-relaxed line-clamp-1">{item.title}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        onClick={() => handleAction(item)}
                        className="flex-1 min-h-[1.9rem] px-2.5 flex items-center justify-center gap-1 rounded-lg bg-primary text-accent-ink font-bold text-[11px] active:scale-98 transition-all"
                      >
                        <span>{actionLabelFor(item.itemType)}</span>
                        <ChevronRight size={12} />
                      </button>
                      <button
                        onClick={() => handleDismiss(item.id)}
                        className="min-h-[1.9rem] px-2 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-content-muted hover:text-text-hi text-[11px] font-semibold transition-colors"
                      >
                        Później
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setIsExpanded((v) => !v)}
        className="relative flex items-center gap-2 px-4 py-3 rounded-2xl bg-base-200/95 border border-primary/40 backdrop-blur-xl shadow-[var(--shadow-lg)] hover:border-primary/70 transition-colors"
      >
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        <span className="text-xs font-bold text-text-hi">Wymaga uwagi</span>
        <span className="h-5 min-w-[1.25rem] px-1 rounded-full bg-primary text-accent-ink text-[11px] font-bold flex items-center justify-center">
          {items.length}
        </span>
      </motion.button>
    </div>,
    document.body
  );
};

export default TeacherHomeworkNotification;
