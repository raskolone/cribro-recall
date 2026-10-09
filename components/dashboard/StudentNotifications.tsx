import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, FileText, X, Sparkles, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useFlashcards } from '../../context/FlashcardContext';
import { collection, query, orderBy, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { StudentTest, SpecialTask } from '../../types';
import { isStudentTodoStatus, studentTasksQuery } from '../../utils/homework';
import { getHomeworkTasksForPopup } from '../../utils/homeworkPopups';
import { useEscapeModal } from '../../hooks/useEscapeModal';

interface StudentNotificationsProps {
  onNavigate: (view: any, extra?: any) => void;
  currentView?: string;
}

const StudentNotifications: React.FC<StudentNotificationsProps> = ({ onNavigate, currentView }) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { sets } = useFlashcards();
  const [tests, setTests] = useState<StudentTest[]>([]);
  const [homeworkTasks, setHomeworkTasks] = useState<SpecialTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [localDismissed, setLocalDismissed] = useState<string[]>(() => {
    try {
      const setsDismissed = JSON.parse(localStorage.getItem('checked_sets') || '[]');
      return Array.from(new Set([...setsDismissed]));
    } catch {
      return [];
    }
  });
  
  const [shownHomeworkPopupIds, setShownHomeworkPopupIds] = useState<Set<string>>(() => {
    try {
      const shown = JSON.parse(localStorage.getItem('shown_homework_popup_ids') || '[]');
      return new Set<string>(shown);
    } catch {
      return new Set<string>();
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
    const unsubTasks = onSnapshot(studentTasksQuery(user.id), (snap) => {
      setHomeworkTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as SpecialTask)));
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

  const isStudentView = !loading && !!user && user.role === 'user';

  const dismissed = Array.from(new Set([...(user?.dismissedNotifications || []), ...localDismissed]));

  // Nowe zadania domowe do pop-upu
  const popupTasks = getHomeworkTasksForPopup(homeworkTasks, shownHomeworkPopupIds);
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

  const handleHomeworkPopupAction = (specificTaskId: string | null, navigate: boolean) => {
    const shownNow = popupTasks.map(t => t.id).filter(Boolean) as string[];
    const newShownIds = new Set([...Array.from(shownHomeworkPopupIds), ...shownNow]);
    setShownHomeworkPopupIds(newShownIds);
    try {
      localStorage.setItem('shown_homework_popup_ids', JSON.stringify(Array.from(newShownIds)));
    } catch (e) {}

    if (navigate) {
      if (specificTaskId) {
        onNavigate('homework', { taskId: specificTaskId });
      } else {
        onNavigate('homework');
      }
    }
  };

  const isHomeworkModalOpen = isStudentView && currentView !== 'homework' && popupTasks.length > 0;

  useEscapeModal(isHomeworkModalOpen, () => {
    handleHomeworkPopupAction(null, false);
  });

  if (!isStudentView) return null;

  return (
    <>
      {/* Pop-up Modal dla nowej pracy domowej */}
      <AnimatePresence>
        {isHomeworkModalOpen && (
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
              <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

              {/* Top Badge & Close */}
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-primary border border-primary/40 text-xs font-mono font-bold uppercase tracking-wider">
                  <Sparkles size={14} className="animate-pulse" />
                  {language === 'pl' ? 'Nowa Praca Domowa' : 'New Homework Assignment'}
                </span>
                <button 
                  onClick={() => handleHomeworkPopupAction(null, false)}
                  className="p-1.5 text-content-muted hover:text-text-hi rounded-full hover:bg-line-soft transition-colors cursor-pointer"
                  title={language === 'pl' ? 'Zamknij' : 'Close'}
                >
                  <X size={20} />
                </button>
              </div>

              {popupTasks.length === 1 ? (
                <>
                  {/* Single Task Content */}
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/50 flex items-center justify-center text-primary text-2xl shrink-0 shadow-inner">
                      <BookOpen size={28} />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-black text-text-hi leading-tight">
                        {language === 'pl' ? 'Masz nową pracę domową!' : 'You have new homework!'}
                      </h2>
                      <p className="text-sm md:text-base font-bold text-primary mt-1">
                        {popupTasks[0].title || (language === 'pl' ? 'Praca domowa od nauczyciela' : 'Homework from teacher')}
                      </p>
                    </div>
                  </div>

                  {popupTasks[0].instructions && (
                    <div className="p-3.5 bg-base-100/60 rounded-2xl border border-line-strong text-xs md:text-sm text-content-muted mb-6 leading-relaxed">
                      {popupTasks[0].instructions}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col gap-2.5">
                    <button 
                      onClick={() => handleHomeworkPopupAction(popupTasks[0].id, true)}
                      className="w-full py-3.5 px-6 bg-primary hover:bg-primary/90 text-accent-ink font-extrabold rounded-2xl text-sm md:text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(114,240,180,0.35)] hover:scale-[1.02] cursor-pointer"
                    >
                      <span>{language === 'pl' ? 'Przejdź do zadania' : 'Go to Homework'}</span>
                      <ChevronRight size={20} />
                    </button>

                    <button 
                      onClick={() => handleHomeworkPopupAction(popupTasks[0].id, false)}
                      className="w-full py-2.5 px-4 bg-ink/72 hover:bg-line-soft text-content-muted hover:text-text-hi rounded-2xl text-xs md:text-sm font-semibold transition-all border border-line-strong flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <X size={16} />
                      <span>{language === 'pl' ? 'Zamknij' : 'Close'}</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Multiple Tasks Content */}
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/50 flex items-center justify-center text-primary text-2xl shrink-0 shadow-inner">
                      <BookOpen size={28} />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-black text-text-hi leading-tight">
                        {language === 'pl' ? 'Masz nowe prace domowe!' : 'You have new homework!'}
                      </h2>
                      <p className="text-sm md:text-base font-bold text-primary mt-1">
                        {language === 'pl' ? `Liczba nowych zadań: ${popupTasks.length}` : `${popupTasks.length} new tasks assigned`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 mb-6 max-h-[40dvh] overflow-y-auto pr-2 custom-scrollbar">
                    {popupTasks.map(t => (
                      <div key={t.id} className="p-3 bg-base-100/60 rounded-xl border border-line-strong flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-text-hi truncate">{t.title || (language === 'pl' ? 'Praca domowa' : 'Homework')}</p>
                          <p className="text-xs text-content-muted">
                            {t.sentences?.length || 0} {language === 'pl' ? 'zdań' : 'sentences'}
                          </p>
                        </div>
                        <button 
                          onClick={() => handleHomeworkPopupAction(t.id, true)}
                          className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer"
                        >
                          {language === 'pl' ? 'Rozwiąż' : 'Solve'}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <button 
                      onClick={() => handleHomeworkPopupAction(null, true)}
                      className="w-full py-3 px-6 bg-primary hover:bg-primary/90 text-accent-ink font-extrabold rounded-2xl text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(114,240,180,0.25)] hover:scale-[1.02]"
                    >
                      <span>{language === 'pl' ? 'Wszystkie zadania' : 'All Tasks'}</span>
                      <ChevronRight size={20} />
                    </button>
                    <button 
                      onClick={() => handleHomeworkPopupAction(null, false)}
                      className="w-full py-2.5 px-4 bg-ink/72 hover:bg-line-soft text-content-muted hover:text-text-hi rounded-2xl text-xs md:text-sm font-semibold transition-all border border-line-strong flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <X size={16} />
                      <span>{language === 'pl' ? 'Zamknij' : 'Close'}</span>
                    </button>
                  </div>
                </>
              )}
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
                  <h3 className="font-bold text-text-hi text-sm md:text-base">
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
                  className="p-2 text-content-muted hover:text-text-hi rounded-lg hover:bg-line-soft transition-colors"
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
