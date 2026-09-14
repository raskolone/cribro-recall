import React, { useEffect, useRef, useState } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { ClipboardList, BookOpen, ChevronDown, Globe2, ListChecks, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import HomeworkScreen from './HomeworkScreen';
import AdminTestGenerator from '../admin/AdminTestGenerator';
import AllTestsTeacherView from '../admin/AllTestsTeacherView';
import PublicTestPanel from '../admin/PublicTestPanel';

/**
 * Zadania i testy — jeden ekran zamiast dwóch wejść do tej samej pracy.
 *
 * ══ SKĄD SIĘ WZIĄŁ ══
 *
 * Kafelek „Testy" prowadził donikąd: generator i przegląd testów renderowały
 * się wyłącznie w zakładce profilu KONKRETNEGO kursanta, więc wejście z pulpitu
 * otwierało pustą stronę. Można było dopisać trzecią ścieżkę, ale pytanie
 * brzmiało inaczej: dlaczego praca domowa i test to dwa osobne miejsca, skoro
 * to ta sama czynność — zadać, sprawdzić, przejrzeć, co było wcześniej.
 *
 * ══ DLACZEGO SEKCJE, A NIE ZAKŁADKI ══
 *
 * Zakładki pokazują jedną rzecz naraz i każą pamiętać, co jest w pozostałych.
 * Tutaj jest odwrotny problem: lektor przychodzi z pytaniem „co jest do
 * sprawdzenia", które dotyczy OBU rodzajów naraz. Sekcje pozwalają mieć
 * otwarte obie albo żadnej — i zwinąć to, czego się akurat nie rusza, zamiast
 * przełączać się w tę i z powrotem.
 *
 * Otwarta startuje dokładnie jedna, ta, z którą się tu weszło.
 */

interface TeacherWorkScreenProps {
  /** Z którą sekcją otworzyć ekran — zależnie od tego, który kafelek kliknięto. */
  initialSection?: 'homework' | 'tests';
  initialTaskId?: string | null;
  initialFilterStatus?: string | null;
  onBack?: () => void;
}

/** Sekcja zwijana — jeden kształt dla obu połów ekranu i dla podsekcji. */
const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, isOpen, onToggle, action, children }) => (
  <section className="glass-tile rounded-2xl overflow-hidden">
    <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
      >
        <ChevronDown
          size={16}
          className={`shrink-0 text-content-muted transition-transform ${isOpen ? '' : '-rotate-90'}`}
        />
        <span className="shrink-0 text-primary">{icon}</span>
        <span className="min-w-0">
          <span className="block text-sm sm:text-base font-bold text-text-hi truncate">{title}</span>
          {subtitle && (
            <span className="block text-[11px] sm:text-xs text-content-muted truncate">
              {subtitle}
            </span>
          )}
        </span>
      </button>
      {action && <div className="shrink-0">{action}</div>}
    </div>
    {isOpen && (
      <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-line-soft">{children}</div>
    )}
  </section>
);

/** Podsekcja w środku „Testów" — ta sama mechanika, drobniejszy kształt. */
const SubSection: React.FC<{
  icon: React.ReactNode;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ icon, title, isOpen, onToggle, children }) => (
  <div className="rounded-xl border border-line-strong bg-base-200/40 overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-left cursor-pointer hover:bg-white/[0.03] transition-colors"
    >
      <ChevronDown
        size={14}
        className={`shrink-0 text-content-muted transition-transform ${isOpen ? '' : '-rotate-90'}`}
      />
      <span className="shrink-0 text-primary">{icon}</span>
      <span className="min-w-0 flex-1 text-sm font-semibold text-text-hi truncate">{title}</span>
    </button>
    {isOpen && <div className="px-3.5 pb-4 pt-2 border-t border-line-soft">{children}</div>}
  </div>
);

const TeacherWorkScreen: React.FC<TeacherWorkScreenProps> = ({
  initialSection = 'homework',
  initialTaskId = null,
  initialFilterStatus = null,
  onBack,
}) => {
  const { user } = useAuth();
  const [openSection, setOpenSection] = useState<'homework' | 'tests' | null>(initialSection);
  const [openTestPart, setOpenTestPart] = useState<'create' | 'all' | 'public' | null>('all');
  const [users, setUsers] = useState<any[]>([]);
  const testsRef = useRef<HTMLDivElement>(null);

  /* Lista kursantów tylko pod generator testów (wybór, dla kogo test).
     Jedno zapytanie o nazwy, wczytywane dopiero przy otwarciu sekcji testów —
     ekran otwierany na pracach domowych nie płaci za coś, czego nie pokaże. */
  useEffect(() => {
    if (openSection !== 'tests' || users.length > 0) return;
    let active = true;
    getDocs(query(collection(db, 'users')))
      .then(snapshot => {
        if (!active) return;
        setUsers(
          snapshot.docs
            .map(d => ({ id: d.id, ...(d.data() as any) }))
            .filter(u => u.username !== 'Demo User' && u.username !== 'Demo User (Offline)')
        );
      })
      .catch(err => console.warn('[Zadania i testy] Lista kursantów:', err?.message || err));
    return () => {
      active = false;
    };
  }, [openSection, users.length]);

  const openTestsAndCreate = () => {
    setOpenSection('tests');
    setOpenTestPart('create');
    setTimeout(() => {
      testsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-5 sm:py-8 space-y-4 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-text-hi flex items-center gap-2.5">
            <ClipboardList className="text-primary shrink-0" size={24} />
            Zadania i testy
          </h1>
          <p className="text-xs sm:text-sm text-content-muted mt-1">
            Przypisywanie, ocenianie i przegląd wszystkiego, co kursant dostaje do zrobienia
            między lekcjami.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tworzenie testu jest tu, na wierzchu, bo to jedyna czynność
              z tego ekranu, którą zaczyna się „od zera" — reszta zaczyna się
              od czegoś, co już istnieje na liście. */}
          <button
            type="button"
            onClick={openTestsAndCreate}
            className="h-10 px-3.5 rounded-xl bg-primary text-accent-ink text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-btn hover:brightness-110 transition-all cursor-pointer"
          >
            <Plus size={16} />
            Utwórz test
          </button>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="h-10 px-3.5 rounded-xl border border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08] text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              ← Panel
            </button>
          )}
        </div>
      </div>

      <Section
        icon={<BookOpen size={18} />}
        title="Prace domowe"
        subtitle="Lista przypisanych prac, kreator nowej, sprawdzanie nadesłanych"
        isOpen={openSection === 'homework'}
        onToggle={() => setOpenSection(prev => (prev === 'homework' ? null : 'homework'))}
      >
        <HomeworkScreen
          headless
          initialTaskId={initialTaskId}
          initialFilterStatus={initialFilterStatus}
        />
      </Section>

      <div ref={testsRef}>
        <Section
          icon={<ClipboardList size={18} />}
          title="Testy"
          subtitle="Generator testów z historii lekcji, testy otwarte i wyniki podejść"
          isOpen={openSection === 'tests'}
          onToggle={() => setOpenSection(prev => (prev === 'tests' ? null : 'tests'))}
        >
          <div className="space-y-3 pt-3">
            <SubSection
              icon={<Plus size={14} />}
              title="Nowy test"
              isOpen={openTestPart === 'create'}
              onToggle={() => setOpenTestPart(prev => (prev === 'create' ? null : 'create'))}
            >
              <AdminTestGenerator users={users} />
            </SubSection>

            <SubSection
              icon={<ListChecks size={14} />}
              title="Wszystkie testy kursantów"
              isOpen={openTestPart === 'all'}
              onToggle={() => setOpenTestPart(prev => (prev === 'all' ? null : 'all'))}
            >
              <AllTestsTeacherView />
            </SubSection>

            {/* Testy otwarte: dla kandydatów, których nie ma jeszcze w bazie.
                Wystawia się je w generatorze wyżej, a tu żyją ich kody, linki
                i podejścia. */}
            <SubSection
              icon={<Globe2 size={14} />}
              title="Testy otwarte (bez przypisanego kursanta)"
              isOpen={openTestPart === 'public'}
              onToggle={() => setOpenTestPart(prev => (prev === 'public' ? null : 'public'))}
            >
              {user?.id ? (
                <PublicTestPanel teacherId={user.id} />
              ) : (
                <p className="text-sm text-content-muted">Zaloguj się, żeby zobaczyć testy otwarte.</p>
              )}
            </SubSection>
          </div>
        </Section>
      </div>
    </div>
  );
};

export default TeacherWorkScreen;
