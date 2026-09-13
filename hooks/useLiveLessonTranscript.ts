import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { LessonRecord } from '../types';

/**
 * Transkrypcja lekcji, śledzona na bieżąco.
 *
 * ══ PO CO NASŁUCH, A NIE ZWYKŁY ODCZYT ══
 *
 * Transkrypcja przychodzi z zewnątrz — z Cribro Sift, przez funkcję
 * `ingestTranscript`. Nie ma żadnego zdarzenia w przeglądarce, po którym
 * lektor mógłby poznać, że już dotarła; przy zwykłym `getDoc` odświeżałby
 * stronę i sprawdzał. `onSnapshot` zdejmuje to pytanie: panel dowiaduje się
 * o zapisie w chwili, w której ten zapis się dzieje.
 *
 * To jest też miejsce, w którym późniejsza transkrypcja NA ŻYWO (Sift
 * dopisujący tekst w trakcie lekcji) nie będzie wymagać żadnej zmiany po tej
 * stronie — panel już umie zobaczyć każdą kolejną wersję dokumentu.
 *
 * ══ STANY, KTÓRE TRZEBA ROZRÓŻNIAĆ ══
 *
 * „Jeszcze nie wiem" (`loading`), „nie ma takiego dokumentu" (`record: null`)
 * i „jest, ale bez transkrypcji" to trzy różne rzeczy i każda z nich znaczy
 * co innego dla lektora. Sprowadzenie ich do jednego `null` daje ekran, który
 * kłamie w dwóch z trzech przypadków.
 */

export interface LiveLessonTranscript {
  /** Cały rekord lekcji, tak jak leży w bazie. `null`, gdy dokumentu nie ma. */
  record: LessonRecord | null;
  /** Surowy zapis rozmowy albo pusty łańcuch. */
  transcript: string;
  /** Przed pierwszą odpowiedzią z bazy. */
  loading: boolean;
  /** Nasłuch przerwany — najczęściej brak uprawnień albo utrata sieci. */
  error: string | null;
  /** Czy nasłuch faktycznie działa: dla paska stanu w panelu. */
  connected: boolean;
}

const EMPTY: LiveLessonTranscript = {
  record: null,
  transcript: '',
  loading: false,
  error: null,
  connected: false,
};

export function useLiveLessonTranscript(
  studentUid?: string | null,
  lessonId?: string | null
): LiveLessonTranscript {
  const [state, setState] = useState<LiveLessonTranscript>({ ...EMPTY, loading: true });

  useEffect(() => {
    // Bez obu identyfikatorów nie ma czego słuchać — i nie ma to znaczyć
    // „wczytuję", bo nic się nie wczytuje i nic się nie zmieni.
    if (!studentUid || !lessonId) {
      setState(EMPTY);
      return;
    }

    setState({ ...EMPTY, loading: true });

    const unsubscribe = onSnapshot(
      doc(db, `users/${studentUid}/lessonRecords/${lessonId}`),
      (snapshot) => {
        if (!snapshot.exists()) {
          setState({ ...EMPTY, loading: false, connected: true });
          return;
        }
        const record = { id: snapshot.id, ...snapshot.data() } as LessonRecord;
        setState({
          record,
          transcript: typeof record.liveTranscript === 'string' ? record.liveTranscript : '',
          loading: false,
          error: null,
          connected: true,
        });
      },
      (err) => {
        // Zerwany nasłuch ma być widoczny, a nie udawać pustej transkrypcji:
        // „nic nie przyszło" i „nie wiem, czy coś przyszło" to nie to samo.
        console.error('Nasłuch transkrypcji lekcji przerwany:', err);
        setState({ ...EMPTY, loading: false, error: err.message, connected: false });
      }
    );

    return () => unsubscribe();
  }, [studentUid, lessonId]);

  return state;
}

export default useLiveLessonTranscript;
