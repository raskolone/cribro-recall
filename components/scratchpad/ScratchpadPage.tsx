import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import TeacherScratchpadScreen from './TeacherScratchpadScreen';
import PublicScratchpadScreen from './PublicScratchpadScreen';

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
  const [hasPinParam, setHasPinParam] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setDocumentId(params.get('id') || params.get('doc'));
    setHasPinParam(Boolean(params.get('pin') || params.get('code') || params.get('p')));
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
  if (isTeacher && !hasPinParam) {
    return (
      <TeacherScratchpadScreen
        variant="standalone"
        documentId={documentId}
        student={{ id: null, name: 'Notatnik roboczy' }}
        onClose={() => window.close()}
      />
    );
  }

  return <PublicScratchpadScreen />;
};

export default ScratchpadPage;
