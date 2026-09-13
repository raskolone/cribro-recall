import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { GraduationCap, ChevronRight, Clock, Award, ArrowRight } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { StudentTest } from '../../types';
import PanelSection from './PanelSection';

interface StudentTestsPanelSectionProps {
  /** Bez własnego nagłówka — używane, gdy nagłówkiem jest kafelek listwy. */
  headless?: boolean;
  studentId?: string;
  onOpenTests: (testId?: string) => void;
}

export const StudentTestsPanelSection: React.FC<StudentTestsPanelSectionProps> = ({
  headless,
  studentId,
  onOpenTests,
}) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [tests, setTests] = useState<StudentTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const targetId = studentId || user?.id;

  useEffect(() => {
    if (!targetId || targetId === 'demo-id') {
      setTests([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const q = query(
      collection(db, `users/${targetId}/tests`),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setTests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentTest)));
        setIsLoading(false);
      },
      (err) => {
        console.error('Błąd wczytywania testów w panelu:', err);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [targetId]);

  if (isLoading) return null;

  const pendingTests = tests.filter((t) => t.status === 'pending' || !t.status);
  const finishedTests = tests.filter(
    (t) => t.status === 'completed' || t.status === 'graded' || Boolean(t.completedAt)
  );

  const metaText = (() => {
    if (pendingTests.length > 0) {
      return language === 'pl'
        ? `${pendingTests.length} ${pendingTests.length === 1 ? 'do rozwiązania' : 'do rozwiązania'}`
        : `${pendingTests.length} pending`;
    }
    if (finishedTests.length > 0) {
      return language === 'pl'
        ? `${finishedTests.length} ${finishedTests.length === 1 ? 'ukończony' : 'ukończonych'}`
        : `${finishedTests.length} completed`;
    }
    return language === 'pl'
      ? `${tests.length} ${tests.length === 1 ? 'test' : 'testów'}`
      : `${tests.length} tests`;
  })();

  return (
    <PanelSection
      headless={headless}
      title={language === 'pl' ? 'Moje testy' : 'My Tests'}
      meta={metaText}
      icon={<GraduationCap size={16} />}
      defaultOpen={pendingTests.length > 0}
    >
      <div className="p-4 sm:p-5 space-y-3.5">
        {tests.length === 0 ? (
          <div className="py-4 text-center">
            <GraduationCap className="w-8 h-8 text-content-muted/40 mx-auto mb-2" />
            <p className="text-sm font-semibold text-content-muted">
              {language === 'pl'
                ? 'Brak przypisanych testów'
                : 'No tests assigned yet'}
            </p>
            <p className="text-xs text-content-muted/70 mt-0.5">
              {language === 'pl'
                ? 'Gdy lektor przypisze test sprawdzający, zobaczysz go w tej sekcji.'
                : 'When your teacher assigns a test, it will appear here.'}
            </p>
          </div>
        ) : (
          <>
            {/* Oczekujące testy do rozwiązania */}
            {pendingTests.length > 0 && (
              <div className="space-y-2">
                <span className="block text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-primary">
                  {language === 'pl' ? 'Testy do rozwiązania' : 'Pending tests'}
                </span>
                <ul className="space-y-2">
                  {pendingTests.slice(0, 3).map((test) => (
                    <li key={test.id}>
                      <button
                        onClick={() => onOpenTests(test.id)}
                        className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-base-100/60 hover:bg-base-100 border border-primary/25 text-left transition-all active:scale-[0.99] cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-text-hi truncate">{test.title}</h4>
                          <div className="flex items-center gap-2 text-xs text-content-muted mt-0.5">
                            <span>{test.questions?.length || 0} {language === 'pl' ? 'pytań' : 'questions'}</span>
                            {test.dueDate && (
                              <span className="flex items-center gap-1 text-warn font-mono text-[11px]">
                                · <Clock size={11} /> do {test.dueDate}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="px-3 py-1.5 rounded-lg bg-primary text-black font-bold text-xs flex items-center gap-1 shrink-0">
                          <span>{language === 'pl' ? 'Rozpocznij' : 'Start'}</span>
                          <ChevronRight size={13} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ukończone testy i wyniki */}
            {finishedTests.length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="block text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-content-muted">
                  {language === 'pl' ? 'Wyniki z poprzednich testów' : 'Previous test results'}
                </span>
                <ul className="space-y-2">
                  {finishedTests.slice(0, 2).map((test) => (
                    <li key={test.id}>
                      <button
                        onClick={() => onOpenTests(test.id)}
                        className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-base-200/50 hover:bg-base-200 border border-line-strong text-left transition-all cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-text-hi truncate">{test.title}</h4>
                          <p className="text-xs text-content-muted mt-0.5 truncate">
                            {test.scope || (language === 'pl' ? 'Test sprawdzający' : 'Assessment test')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2.5 py-1 rounded-lg bg-primary/20 text-primary border border-primary/30 font-mono font-bold text-xs flex items-center gap-1">
                            <Award size={12} />
                            {test.score !== undefined ? `${test.score}%` : 'Zrobiony'}
                          </span>
                          <ChevronRight size={14} className="text-content-muted" />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Przycisk przejścia do wszystkich testów */}
            <div className="pt-2">
              <button
                onClick={() => onOpenTests()}
                className="w-full py-2.5 px-4 rounded-xl bg-base-100 hover:bg-line-soft text-xs font-bold text-primary border border-primary/30 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>{language === 'pl' ? 'Przejdź do moich testów' : 'Open tests view'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </PanelSection>
  );
};

export default StudentTestsPanelSection;
