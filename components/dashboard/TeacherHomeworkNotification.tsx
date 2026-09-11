import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { collection, collectionGroup, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { BookOpenCheck, ChevronRight, GraduationCap, X } from 'lucide-react';
import { playNotificationChime } from '../../utils/notificationChime';

interface TeacherHomeworkNotificationProps {
  onOpenHomework?: (taskId: string) => void;
}

interface NotificationItem {
  id: string;
  taskId: string;
  studentName: string;
  title: string;
  timestamp: number;
  itemType?: 'homework' | 'test';
}

export const TeacherHomeworkNotification: React.FC<TeacherHomeworkNotificationProps> = ({
  onOpenHomework,
}) => {
  const [activeNotifications, setActiveNotifications] = useState<NotificationItem[]>([]);
  const knownTaskIdsRef = useRef<Set<string>>(new Set());
  const knownTestIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadTasksRef = useRef(true);
  const isInitialLoadTestsRef = useRef(true);

  useEffect(() => {
    // 1. Nasłuchiwanie odesłanych prac domowych
    const qTasks = query(collection(db, 'specialTasks'), where('status', '==', 'submitted'));
    const unsubTasks = onSnapshot(
      qTasks,
      (snapshot) => {
        if (isInitialLoadTasksRef.current) {
          snapshot.docs.forEach((doc) => {
            knownTaskIdsRef.current.add(doc.id);
          });
          isInitialLoadTasksRef.current = false;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const taskId = change.doc.id;
            const data = change.doc.data() as any;

            if (data.status === 'submitted' && !knownTaskIdsRef.current.has(taskId)) {
              knownTaskIdsRef.current.add(taskId);

              const newItem: NotificationItem = {
                id: `task-${taskId}-${Date.now()}`,
                taskId,
                studentName: data.studentName || data.studentUsername || 'Kursant',
                title: data.title || 'Praca domowa',
                timestamp: Date.now(),
                itemType: 'homework',
              };

              setActiveNotifications((prev) => [newItem, ...prev.slice(0, 2)]);
              playNotificationChime();

              setTimeout(() => {
                setActiveNotifications((prev) => prev.filter((n) => n.id !== newItem.id));
              }, 10000);
            }
          }
        });
      },
      (error) => {
        console.error('TeacherHomeworkNotification snapshot error:', error);
      }
    );

    // 2. Nasłuchiwanie odesłanych testów
    let unsubTests: (() => void) | undefined;
    try {
      const qTests = query(collectionGroup(db, 'tests'), where('teacherRead', '==', false));
      unsubTests = onSnapshot(
        qTests,
        (snapshot) => {
          if (isInitialLoadTestsRef.current) {
            snapshot.docs.forEach((doc) => {
              knownTestIdsRef.current.add(doc.id);
            });
            isInitialLoadTestsRef.current = false;
            return;
          }

          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              const testId = change.doc.id;
              const data = change.doc.data() as any;

              if (
                data.teacherRead === false &&
                (data.status === 'graded' || data.status === 'completed' || data.completedAt) &&
                !knownTestIdsRef.current.has(testId)
              ) {
                knownTestIdsRef.current.add(testId);

                const newItem: NotificationItem = {
                  id: `test-${testId}-${Date.now()}`,
                  taskId: testId,
                  studentName: data.studentName || 'Kursant',
                  title: data.title || 'Test wiedzy',
                  timestamp: Date.now(),
                  itemType: 'test',
                };

                setActiveNotifications((prev) => [newItem, ...prev.slice(0, 2)]);
                playNotificationChime();

                setTimeout(() => {
                  setActiveNotifications((prev) => prev.filter((n) => n.id !== newItem.id));
                }, 10000);
              }
            }
          });
        },
        (error) => {
          console.warn('TeacherHomeworkNotification tests snapshot error:', error);
        }
      );
    } catch (e) {
      console.warn('TeacherHomeworkNotification setup tests error:', e);
    }

    return () => {
      unsubTasks();
      if (unsubTests) unsubTests();
    };
  }, []);

  const handleDismiss = (id: string) => {
    setActiveNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleAction = (item: NotificationItem) => {
    handleDismiss(item.id);
    if (onOpenHomework) {
      onOpenHomework(item.taskId);
    }
  };

  if (activeNotifications.length === 0) return null;

  // Portal do <body>, bo komponent wisi wewnątrz <main> panelu. Wystarczy, że
  // któryś z paneli po drodze animuje się transformem (a robi to niejeden
  // ekran na motion/react), a `position: fixed` zaczyna się liczyć względem
  // tego przodka — powiadomienie ląduje wtedy w losowym miejscu albo znika
  // pod krawędzią panelu. W portalu wychodzi w prawym dolnym rogu zawsze,
  // niezależnie od tego, w którym panelu akurat jest lektor.
  return createPortal(
    <div className="fixed bottom-5 right-5 z-[350] flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2.5rem)] pointer-events-none">
      <AnimatePresence>
        {activeNotifications.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 350 }}
            className="pointer-events-auto p-4 rounded-2xl bg-base-200/95 border border-primary/40 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] relative overflow-hidden"
          >
            {/* Ambient neon shine */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start gap-3 relative z-10">
              <div className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30 shrink-0 shadow-[0_0_15px_rgba(114,240,180,0.3)]">
                {item.itemType === 'test' ? <GraduationCap size={20} /> : <BookOpenCheck size={20} />}
              </div>

              <div className="flex-1 min-w-0 pr-5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-primary">
                    {item.itemType === 'test' ? 'Odesłano test' : 'Odesłano pracę'}
                  </span>
                </div>

                <p className="text-[14px] font-extrabold text-white leading-snug truncate">
                  {item.studentName}
                </p>
                <p className="text-[12px] text-content-muted leading-relaxed line-clamp-1 mt-0.5">
                  {item.title}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => handleAction(item)}
                    className="flex-1 min-h-[2.25rem] px-3.5 flex items-center justify-center gap-1.5 rounded-xl bg-primary text-accent-ink font-bold text-xs shadow-md shadow-primary/20 hover:shadow-primary/40 active:scale-98 transition-all"
                  >
                    <span>{item.itemType === 'test' ? 'Zobacz test' : 'Sprawdź i oceń'}</span>
                    <ChevronRight size={14} />
                  </button>
                  <button
                    onClick={() => handleDismiss(item.id)}
                    className="min-h-[2.25rem] px-2.5 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-white text-xs font-semibold transition-colors"
                  >
                    Później
                  </button>
                </div>
              </div>

              <button
                onClick={() => handleDismiss(item.id)}
                className="absolute top-1 right-1 p-1 rounded-lg text-content-muted hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Zamknij powiadomienie"
              >
                <X size={15} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
};

export default TeacherHomeworkNotification;
