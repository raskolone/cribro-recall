import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, FileText, X, Sparkles, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useFlashcards } from '../../context/FlashcardContext';
import { collection, query, orderBy, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { StudentTest, SpecialTask } from '../../types';
import { isTaskForStudent } from '../../utils/homework';

interface StudentNotificationsProps {
  onNavigate: (view: any, extra?: any) => void;
}

const StudentNotifications: React.FC<StudentNotificationsProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { sets } = useFlashcards();
  const [tests, setTests] = useState<StudentTest[]>([]);
  const [homeworkTasks, setHomeworkTasks] = useState<SpecialTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [localDismissed, setLocalDismissed] = useState<string[]>(() => {
    try {
      const setsDismissed = JSON.parse(localStorage.getItem('checked_sets') || '[]');
      const hwDismissed = JSON.parse(localStorage.getItem('dismissed_homework_ids') || '[]');
      return Array.from(new Set([...setsDismissed, ...hwDismissed]));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!user?.id || user?.role !== 'user') {
      setLoading(false);
      return;
    }

    // Real-time tests listener
    const testsQ = query(collection(db, `users/${user.id}/tests`), orderBy('createdAt', 'desc'));
    const unsubTests = onSnapshot(testsQ, (snap) => {
      setTests(snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentTest)));
    }, (err) => {
      console.error('Error in tests snapshot:', err);
    });

    // Real-time special tasks / homework listener
    const unsubTasks = onSnapshot(collection(db, 'specialTasks'), (snap) => {
      const tasks: SpecialTask[] = [];
      snap.forEach(d => {
        const t = { id: d.id, ...d.data() } as SpecialTask;
        if (isTaskForStudent(t, user)) {
          tasks.push(t);
        }
      });
      setHomeworkTasks(tasks);
      setLoading(false);
    }, (err) => {
      console.error('Error in homework snapshot:', err);
      setLoading(false);
    });

    return () => {
      unsubTests();
      unsubTasks();
    };
  }, [user]);

  if (loading || !user || user.role !== 'user') return null;

  const dismissed = Array.from(new Set([...(user.dismissedNotifications || []), ...localDismissed]));

  // Filter pending homework tasks not dismissed
  const assignedHomework = homeworkTasks.filter(t => {
    const taskId = t.id || '';
    const isPending = t.status === 'pending' || !t.status;
    const isDismissed = dismissed.includes(taskId) || dismissed.includes('hw_' + taskId);
    return isPending && !isDismissed;
  });

  // Fallback if hasNewHomework flag is set on user profile but specific task not listed in query
  const shouldShowGenericHomework = user.hasNewHomework && assignedHomework.length === 0 && !dismissed.includes('generic_homework_' + user.id) && !dismissed.includes('hasNewHomework');

  // Filter out sets assigned by teacher that haven't been dismissed
  const assignedSets = sets.filter(s => s.assignedByTeacher && !dismissed.includes(s.id));
  
  // Filter out pending tests that haven't been dismissed
  const assignedTests = tests.filter(t => t.status === 'pending' && !dismissed.includes(t.id));

  const items = [
    ...assignedSets.map(s => ({ type: 'set', item: s })),
    ...assignedTests.map(t => ({ type: 'test', item: t }))
  ].sort((a, b) => {
    const timeA = new Date(a.item.createdAt || 0).getTime();
    const timeB = new Date(b.item.createdAt || 0).getTime();
    return timeB - timeA;
  });

  const handleDismiss = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newLocal = Array.from(new Set([...localDismissed, id]));
    setLocalDismissed(newLocal);
    try {
      localStorage.setItem('checked_sets', JSON.stringify(newLocal));
      localStorage.setItem('dismissed_homework_ids', JSON.stringify(newLocal));
    } catch(e) {}

    if (!user?.id) return;
    
    const updatedDismissed = Array.from(new Set([...(user.dismissedNotifications || []), ...newLocal]));
    try {
      await updateDoc(doc(db, 'users', user.id), {
        dismissedNotifications: updatedDismissed
      });
    } catch (err) {
      console.error('Failed to dismiss notification', err);
    }
  };

  const handleClick = async (id: string, view: string) => {
    const newLocal = Array.from(new Set([...localDismissed, id]));
    setLocalDismissed(newLocal);
    try {
      localStorage.setItem('checked_sets', JSON.stringify(newLocal));
      localStorage.setItem('dismissed_homework_ids', JSON.stringify(newLocal));
    } catch(e) {}

    if (user?.id) {
       const updatedDismissed = Array.from(new Set([...(user.dismissedNotifications || []), ...newLocal]));
       try {
         await updateDoc(doc(db, 'users', user.id), {
            dismissedNotifications: updatedDismissed
         });
       } catch(err) {}
    }
    onNavigate(view);
  };

  const handleHomeworkAction = async (hwId: string, navigate: boolean) => {
    const idsToDismiss = Array.from(new Set([
      ...localDismissed,
      hwId,
      'hw_' + hwId,
      'generic_homework_' + user.id,
      'hasNewHomework'
    ]));

    setLocalDismissed(idsToDismiss);

    try {
      localStorage.setItem('checked_sets', JSON.stringify(idsToDismiss));
      localStorage.setItem('dismissed_homework_ids', JSON.stringify(idsToDismiss));
    } catch (e) {}

    if (user?.id) {
      const updatedDismissed = Array.from(new Set([
        ...(user.dismissedNotifications || []),
        ...idsToDismiss
      ]));
      try {
        await updateDoc(doc(db, 'users', user.id), {
          dismissedNotifications: updatedDismissed,
          hasNewHomework: false
        });
      } catch (err) {
        console.error('Failed to update user doc for homework dismissal', err);
      }
    }

    if (navigate) {
      onNavigate('homework', currentHomework?.id ? { taskId: currentHomework.id } : undefined);
    }
  };

  const currentHomework = assignedHomework[0];

  return (
    <>
      {/* Pop-up Modal dla nowej pracy domowej */}
      <AnimatePresence>
        {(assignedHomework.length > 0 || shouldShowGenericHomework) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative max-w-lg w-full bg-gradient-to-b from-base-200/95 via-base-200 to-base-300 border-2 border-primary/60 rounded-3xl p-6 md:p-8 shadow-[0_0_60px_rgba(114,240,180,0.3)] text-left overflow-hidden"
            >
              {/* Background ambient glow */}
              <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

              {/* Top Badge & Close */}
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-primary border border-primary/40 text-xs font-mono font-bold uppercase tracking-wider">
                  <Sparkles size={14} className="animate-pulse" />
                  {language === 'pl' ? 'Nowa Praca Domowa' : 'New Homework Assignment'}
                </span>
                <button 
                  onClick={() => {
                    const hwId = currentHomework?.id || ('generic_homework_' + user.id);
                    handleHomeworkAction(hwId, false);
                  }}
                  className="p-1.5 text-content-muted hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                  title={language === 'pl' ? 'Zamknij' : 'Close'}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Main Content */}
              <div className="flex items-start gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/50 flex items-center justify-center text-primary text-2xl shrink-0 shadow-inner">
                  <BookOpen size={28} />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-white leading-tight">
                    {language === 'pl' ? 'Masz nową pracę domową!' : 'You have new homework!'}
                  </h2>
                  <p className="text-sm md:text-base font-bold text-primary mt-1">
                    {currentHomework?.title || (language === 'pl' ? 'Praca domowa od nauczyciela' : 'Homework from teacher')}
                  </p>
                </div>
              </div>

              {currentHomework?.instructions && (
                <div className="p-3.5 bg-base-100/60 rounded-2xl border border-white/10 text-xs md:text-sm text-content-muted mb-6 leading-relaxed">
                  {currentHomework.instructions}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2.5">
                <button 
                  onClick={() => {
                    const hwId = currentHomework?.id || ('generic_homework_' + user.id);
                    handleHomeworkAction(hwId, true);
                  }}
                  className="w-full py-3.5 px-6 bg-primary hover:bg-primary/90 text-black font-extrabold rounded-2xl text-sm md:text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(114,240,180,0.35)] hover:scale-[1.02] cursor-pointer"
                >
                  <span>{language === 'pl' ? 'Przejdź do pracy domowej' : 'Go to Homework'}</span>
                  <ChevronRight size={20} />
                </button>

                <button 
                  onClick={() => {
                    const hwId = currentHomework?.id || ('generic_homework_' + user.id);
                    handleHomeworkAction(hwId, false);
                  }}
                  className="w-full py-2.5 px-4 bg-base-100/80 hover:bg-white/10 text-content-muted hover:text-white rounded-2xl text-xs md:text-sm font-semibold transition-all border border-white/10 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <X size={16} />
                  <span>{language === 'pl' ? 'Odhacz i zamknij powiadomienie' : 'Dismiss notification'}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* standardowe powiadomienia gzymsowe (zestawy i testy) */}
      <AnimatePresence>
        {items.map(({ type, item }) => (
          <motion.div 
            key={item.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="relative group cursor-pointer mb-4"
            onClick={() => handleClick(item.id, type === 'set' ? 'flashcard-sets' : 'tests')}
          >
            <div className="absolute inset-0 rounded-2xl bg-secondary/20 blur-xl animate-pulse" />
            <div className="relative liquid-glass-card !border-secondary/40 bg-gradient-to-r from-secondary/10 to-base-200/50 p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                    {type === 'set' ? <BookOpen className="w-5 h-5 text-secondary" /> : <FileText className="w-5 h-5 text-secondary" />}
                  </div>
                  <div className="absolute top-0 right-0 w-3 h-3 bg-secondary rounded-full border-2 border-base-100 animate-ping" />
                  <div className="absolute top-0 right-0 w-3 h-3 bg-secondary rounded-full border-2 border-base-100" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm md:text-base">
                    {language === 'pl' 
                      ? (type === 'set' ? `Nowy materiał: ${item.title}` : `Nowy test: ${item.title}`) 
                      : (type === 'set' ? `New material: ${item.title}` : `New test: ${item.title}`)}
                  </h3>
                  <p className="text-secondary/80 text-xs md:text-sm">
                    {language === 'pl' 
                      ? (type === 'set' ? 'Twój nauczyciel przypisał nowy zestaw. Kliknij, aby przejść.' : 'Twój nauczyciel przypisał nowy test. Kliknij, aby rozwiązać.') 
                      : (type === 'set' ? 'Your teacher assigned a new set. Click to proceed.' : 'Your teacher assigned a new test. Click to solve.')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleClick(item.id, type === 'set' ? 'flashcard-sets' : 'tests'); }}
                  className="px-4 py-2 bg-secondary/20 hover:bg-secondary/30 text-secondary font-semibold rounded-lg text-sm transition-colors hidden sm:block"
                >
                  {language === 'pl' ? 'Przejdź' : 'Go to'}
                </button>
                <button 
                  onClick={(e) => handleDismiss(e, item.id)}
                  className="p-2 text-content-muted hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  title={language === 'pl' ? 'Zamknij' : 'Close'}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </>
  );
};

export default StudentNotifications;
