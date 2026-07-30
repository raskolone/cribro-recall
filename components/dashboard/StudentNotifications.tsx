import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, FileText, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useFlashcards } from '../../context/FlashcardContext';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { StudentTest } from '../../types';
import { doc, updateDoc } from 'firebase/firestore';

interface StudentNotificationsProps {
  onNavigate: (view: any) => void;
}

const StudentNotifications: React.FC<StudentNotificationsProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { sets } = useFlashcards();
  const [tests, setTests] = useState<StudentTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [localDismissed, setLocalDismissed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('checked_sets') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (user?.id && user?.role === 'user') {
      const fetchTests = async () => {
        try {
          const q = query(collection(db, `users/${user.id}/tests`), orderBy('createdAt', 'desc'));
          const snap = await getDocs(q);
          setTests(snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentTest)));
        } catch (err) {
          console.error('Error fetching tests for notifications:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchTests();
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading || !user || user.role !== 'user') return null;

  const dismissed = Array.from(new Set([...(user.dismissedNotifications || []), ...localDismissed]));

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
      console.error('Failed to dismiss', err);
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

  if (items.length === 0) return null;

  return (
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
  );
};

export default StudentNotifications;
