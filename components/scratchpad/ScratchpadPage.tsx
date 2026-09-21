import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import TeacherScratchpadScreen from './TeacherScratchpadScreen';
import PublicScratchpadScreen from './PublicScratchpadScreen';
import DesktopOnlyNotice from '../ui/DesktopOnlyNotice';
import { useIsDesktop } from '../../hooks/useMediaQuery';

/**
 * Notatnik pod adresem `/scratchpad` — JEDNA strona i JEDEN link dla obu stron.
 *
 * ══ DLACZEGO OSOBNA KARTA, A NIE EKRAN W APLIKACJI ══
 *
 * Notatnik jest otwarty przez całą lekcję, równolegle do wszystkiego innego:
 * lektor zagląda w tym czasie do profilu kursanta, do pracy domowej, do
 * prezentacji. Ekran wewnątrz aplikacji znaczył, że każde takie zajrzenie
 * wymaga wyjścia z notatnika i powrotu — a przy powrocie kartka jest znów na
 * górze, kursor gdzie indziej i trzeba się odnaleźć. Osobna karta przeglądarki
 * jest tu tym samym, czym jest w Google Docs: dokument stoi sobie obok
 * i czeka.
 *
 * ══ JEDEN LINK DLA LEKTORA I KURSANTA ══
 *
 * Adres jest ten sam: `/scratchpad?id=sp_<uid>`. Różnica jest w tym, KTO go
 * otwiera — zalogowany lektor dostaje pełny edytor z udostępnianiem
 * i przypisywaniem, każdy inny dostaje widok kursanta (z PIN-em, jeśli lektor
 * go wymaga). Dzięki temu link skopiowany z paska adresu jest dokładnie tym
 * linkiem, który idzie do kursanta — nie ma dwóch adresów do tego samego
 * dokumentu i nie da się wysłać niewłaściwego.
 *
 * ══ CZEKAMY NA AUTORYZACJĘ ══
 *
 * Bez tego czekania strona przez ułamek sekundy nie wie, że jest zalogowana,
 * i pokazałaby lektorowi ekran wpisywania PIN-u do własnego notatnika.
 */
export const ScratchpadPage: React.FC = () => {
  const { user, isAuthReady } = useAuth();
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [hasPinParam, setHasPinParam] = useState(false);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setDocumentId(params.get('id') || params.get('doc'));
    setStudentName(params.get('name'));
    setHasPinParam(Boolean(params.get('pin') || params.get('code') || params.get('p')));
  }, []);

  /**
   * Notatnik kursanta ma zawsze deterministyczne ID `sp_<studentId>`
   * (patrz `getOrCreateStudentScratchpad`) — z samego adresu da się więc
   * odzyskać, czyj to notatnik, bez dodatkowego zapytania. Dzięki temu
   * `TeacherScratchpadScreen` może sam założyć dokument, gdy kursant nie
   * miał go jeszcze nigdy (zamiast pokazywać błąd „nie znaleziono").
   */
  const studentIdFromDocumentId = documentId?.startsWith('sp_') ? documentId.slice(3) : null;

  /*
   * ══ CAŁA STRONA CHODZI ZA MOTYWEM KARTKI ══
   *
   * Notatnik jest edytorem tekstu, a edytory tekstu wyglądają jak dokument,
   * nie jak panel: jasna obudowa, szara kanwa, kartka na środku. Dotąd kartka
   * była jasna, a wszystko wokół niej ciemne — dwa różne programy na jednym
   * ekranie i jedyne takie miejsce w aplikacji.
   *
   * Ta strona ustawia więc motyw okna pod motyw kartki. Przełącznik w pasku
   * nagłówka przestawia jedno i drugie naraz, a że strona stoi w osobnej
   * karcie, nie dotyka motywu reszty aplikacji.
   *
   * Poprzednia wartość wraca przy zamknięciu karty — na wypadek, gdyby ktoś
   * trafił tu przez nawigację wewnątrz aplikacji.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = window.document.documentElement;
    const previous = root.getAttribute('data-theme');

    const apply = (theme: string) => {
      if (theme === 'dark') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', 'light');
      root.classList.toggle('light', theme !== 'dark');
    };

    let stored = 'light';
    try {
      stored = window.localStorage.getItem('scratchpad_paper_theme') === 'dark' ? 'dark' : 'light';
    } catch {
      /* tryb prywatny — zostaje jasny */
    }
    apply(stored);

    const onThemeChange = (event: Event) => apply((event as CustomEvent).detail || 'light');
    window.addEventListener('scratchpad-paper-theme', onThemeChange);
    return () => {
      window.removeEventListener('scratchpad-paper-theme', onThemeChange);
      if (previous) root.setAttribute('data-theme', previous);
      else root.removeAttribute('data-theme');
      root.classList.toggle('light', previous === 'light');
    };
  }, []);

  if (!isAuthReady) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 bg-base-100">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-content-muted">Otwieram notatnik…</p>
      </div>
    );
  }

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  /*
   * Lektor wchodzący po PIN-ie (a nie po identyfikatorze) to przypadek
   * kursanta: sprawdza, co widzi druga strona. Wtedy zostaje przy widoku
   * publicznym, bo o to właśnie mu chodzi.
   */
  if (isTeacher && !hasPinParam && !isDesktop) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-base-100">
        <DesktopOnlyNotice moduleName="Notatnik A4" onBack={() => window.close()} />
      </div>
    );
  }

  if (isTeacher && !hasPinParam) {
    return (
      <TeacherScratchpadScreen
        variant="standalone"
        documentId={documentId}
        student={{
          id: studentIdFromDocumentId,
          name: studentIdFromDocumentId ? (studentName || 'Kursant') : 'Notatnik roboczy',
        }}
        onClose={() => window.close()}
      />
    );
  }

  return <PublicScratchpadScreen />;
};

export default ScratchpadPage;
