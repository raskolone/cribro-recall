import React, { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { AlertCircle, Loader2, UserPlus, Check } from 'lucide-react';
import { ScratchpadDocument } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { getAllUsers } from '../../services/userService';
import {
  adoptScratchpadForStudent,
  getOrCreateStudentScratchpad,
  getScratchpadById,
  subscribeScratchpad,
  saveScratchpadContent,
  updateScratchpadSettings,
} from '../../services/scratchpadService';
import ScratchpadEditor from './ScratchpadEditor';

/**
 * Notatnik lektora jako WŁASNY EKRAN, nie okno nad panelem.
 *
 * ══ DLACZEGO NIE MODAL ══
 *
 * Notatnik jest miejscem, w którym spędza się całą lekcję — nie czynnością,
 * którą się potwierdza i zamyka. Modal mówi coś przeciwnego: przyciemnia
 * resztę aplikacji, żeby powiedzieć „załatw to i wracaj", a przez półprzezroczyste
 * tło cały czas prześwitywał panel, konstelacja i kafelki, kłócąc się z kartką
 * dokumentu o uwagę. Okno miało też stałą wysokość 90vh — czyli kartka nigdy
 * nie dostawała całego ekranu, nawet gdy nic innego nie było potrzebne.
 *
 * Jako ekran notatnik dostaje całą przestrzeń i własne wyjście („Wróć do
 * panelu"), a reszta aplikacji po prostu go nie zasłania.
 */
interface TeacherScratchpadScreenProps {
  /** Powrót do panelu lektora. */
  onClose: () => void;
  /**
   * `page` — ekran w przepływie aplikacji (wejście z panelu lektora).
   * `overlay` — NIEPRZEZROCZYSTA warstwa na całe okno, dla wejść, z których
   *   nie da się wyjść bez utraty stanu: notatnik otwierany w trakcie
   *   prezentacji na żywo. To nadal nie jest okienko nad przyciemnionym tłem —
   *   tło jest zasłonięte w całości, więc kartka nie walczy o uwagę
   *   z konstelacją i kafelkami panelu prześwitującymi zza półprzezroczystości.
   */
  variant?: 'page' | 'overlay' | 'standalone';
  /**
   * Otwórz KONKRETNY dokument po identyfikatorze, zamiast tworzyć/odnajdywać
   * notatnik kursanta. Używa tego osobna karta przeglądarki (`/scratchpad?id=`),
   * gdzie adres jest jedynym źródłem prawdy o tym, co ma być otwarte.
   */
  documentId?: string | null;
  student: {
    id?: string | null;
    name: string;
  };
  /**
   * Kursanci, których można przypisać BEZ wychodzenia z notatnika.
   *
   * Notatnik otwiera się teraz pusty i bez przypisania, bo lektor zaczyna
   * pisać, zanim pytanie „z kim dzisiaj" jest istotne. Wybór kursanta jest
   * czynnością w trakcie, nie bramką na wejściu.
   */
  students?: { id: string; name: string }[];
  onPushToLessonRecord?: (data: {
    topic: string;
    words: string;
    summary: string;
    thingsToImprove: string;
    followUp: string;
  }) => void;
}

export const TeacherScratchpadScreen: React.FC<TeacherScratchpadScreenProps> = ({
  onClose,
  variant = 'page',
  documentId = null,
  student,
  students,
  onPushToLessonRecord,
}) => {
  const { user } = useAuth();
  const [scratchpadDoc, setScratchpadDoc] = useState<ScratchpadDocument | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Otwarta lista kursantów do przypisania notatnika w trakcie pisania. */
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  /* Lista kursantów do przypisania. Ekran stoi teraz sam, poza panelem, więc
     nikt mu jej nie poda — wczytuje ją sam, raz przy wejściu. Jedno zapytanie
     o nazwy, bez żadnych danych lekcyjnych. */
  const [loadedStudents, setLoadedStudents] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (students) return;
    let isMounted = true;
    getAllUsers()
      .then(allUsers => {
        if (!isMounted) return;
        const list = allUsers
          .map(data => {
            if (data.isArchived || data.role === 'admin' || data.role === 'teacher') return null;
            const name =
              `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.username || '';
            return name ? { id: data.id, name } : null;
          })
          .filter(Boolean) as { id: string; name: string }[];
        list.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
        setLoadedStudents(list);
      })
      .catch(err => console.warn('[Notatnik] Nie udało się wczytać listy kursantów:', err?.message || err));
    return () => {
      isMounted = false;
    };
  }, [students]);

  const assignableStudents = students ?? loadedStudents;

  // Pobierz lub utwórz stały brudnopis kursanta po wejściu na ekran
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const teacherUid = user?.id || 'teacher_default';
    const teacherName = user?.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : user?.username || 'Lektor CRIBRO';

    /*
     * Notatnik roboczy o STAŁYM ID na lektora (`sp_teacher_<uid>`) — nie
     * `Date.now()`. Regenerowanie ID przy każdym renderze było dokładnie tą
     * regresją, którą naprawiliśmy wcześniej dziś: zapisy trafiały pod wciąż
     * inny, efemeryczny dokument, więc status „Zsynchronizowano" był
     * prawdziwy, ale nie dla dokumentu, którego ktokolwiek słuchał. Ten
     * fallback jest odwrotnością tamtego błędu — jedno stałe ID na sesję
     * lektora, ustawiane raz przez `setScratchpadDoc` (stan Reacta, nie
     * wyrażenie liczone w ciele komponentu), i jawnie oznaczone jako lokalny
     * tryb roboczy przez `cloudBlockedReason`, żeby lektor wiedział, że
     * kursant tego NIE zobaczy, dopóki połączenie nie wróci.
     */
    const buildDegradedFallback = (reason: string): ScratchpadDocument => {
      const now = new Date().toISOString();
      return {
        id: `sp_teacher_${user?.id || 'temp'}`,
        pin: '',
        studentId: student.id || undefined,
        studentName: student.name || 'Kursant',
        teacherUid,
        teacherName,
        title: `Notatnik — ${student.name || 'Lekcja'}`,
        contentHtml: '',
        contentText: '',
        allowStudentEdit: true,
        requirePin: false,
        createdAt: now,
        updatedAt: now,
        version: 1,
        cloudBlockedReason: reason,
      };
    };

    const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('SCRATCHPAD_INIT_TIMEOUT')), ms);
        promise.then(
          (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          (err) => {
            clearTimeout(timer);
            reject(err);
          }
        );
      });

    const init = async () => {
      try {
        const fetchDoc = documentId
          ? getScratchpadById(documentId)
          : getOrCreateStudentScratchpad(
              { id: student.id || null, name: student.name || 'Kursant' },
              { uid: teacherUid, name: teacherName }
            );

        const doc = await withTimeout(fetchDoc, 3000);

        if (!doc) throw new Error('Nie znaleziono notatnika o podanym adresie.');

        /* Adres karty jest jedynym miejscem, po którym da się tu wrócić —
           notatnik roboczy dostaje identyfikator dopiero przy utworzeniu, więc
           dopisujemy go do adresu od razu. Bez tego odświeżenie karty zakładało
           drugi, pusty notatnik, a link skopiowany z paska adresu prowadził
           donikąd. */
        if (variant === 'standalone' && typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          if (params.get('id') !== doc.id) {
            params.set('id', doc.id);
            window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
          }
        }

        if (isMounted) {
          setScratchpadDoc(doc);
        }
      } catch (err: any) {
        const isTimeout = err?.message === 'SCRATCHPAD_INIT_TIMEOUT';
        const isResourceExhausted = err?.code === 'resource-exhausted';
        console.error('Błąd inicjalizacji notatnika:', err);

        if (isMounted) {
          if (isTimeout || isResourceExhausted) {
            /* Baza nie odpowiedziała na czas — lektor dostaje edytor, który
               DZIAŁA, zamiast wiszącego spinnera. Świadomie zamienia to
               "notatnik kursanta" na "prywatny brudnopis lektora": to jedyny
               sposób, żeby nie zgadywać cudzego ID dokumentu w trybie
               awaryjnym. Baner `cloudBlockedReason` mówi to wprost. */
            setScratchpadDoc(
              buildDegradedFallback(
                isTimeout
                  ? 'Baza nie odpowiedziała w 3 sekundy — tryb roboczy, synchronizacja w toku.'
                  : 'Baza chwilowo przeciążona (resource-exhausted) — tryb roboczy, synchronizacja w toku.'
              )
            );
          } else {
            setError(err.message || 'Nie udało się załadować notatnika.');
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [documentId, student.id, student.name, user, variant]);

  // Subskrypcja na żywo
  useEffect(() => {
    if (!scratchpadDoc?.id) return;

    const unsubscribe = subscribeScratchpad(scratchpadDoc.id, (updated) => {
      if (updated) {
        setScratchpadDoc(updated);
      }
    });

    return () => unsubscribe();
  }, [scratchpadDoc?.id]);

  const handleSaveContent = async (html: string, text: string) => {
    if (!scratchpadDoc?.id) return;
    const docId = scratchpadDoc.id;
    const teacherUid = user?.id || 'teacher_default';
    const teacherName = user?.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : user?.username || 'Lektor';

    console.log('[SYNC-TEACHER-WRITE]', { docId, length: html?.length });

    return await saveScratchpadContent(docId, html, text, {
      uid: teacherUid,
      name: teacherName,
      role: 'teacher',
    });
  };

  const handleToggleStudentEdit = async (allow: boolean) => {
    if (!scratchpadDoc?.id) return;
    await updateScratchpadSettings(scratchpadDoc.id, { allowStudentEdit: allow });
    setScratchpadDoc(prev => prev ? { ...prev, allowStudentEdit: allow } : null);
  };

  const handleToggleRequirePin = async (require: boolean) => {
    if (!scratchpadDoc?.id) return;
    await updateScratchpadSettings(scratchpadDoc.id, { requirePin: require });
    setScratchpadDoc(prev => prev ? { ...prev, requirePin: require } : null);
  };

  /**
   * Przypisanie notatnika roboczego do kursanta w trakcie pisania.
   *
   * Treść wędruje do stałego notatnika kursanta (`sp_<uid>`), bo tylko tam
   * kursant ją znajdzie — szczegóły i powód w `adoptScratchpadForStudent`.
   *
   * Czeka na wynik `adoptScratchpadForStudent` PRZED przepięciem stanu w UI:
   * lokalny identyfikator dokumentu musi zawsze wskazywać na dokument, który
   * faktycznie istnieje w chmurze pod tym ID — inaczej kolejne zapisy trafiają
   * pod ID, którego notatnik kursanta nie słucha.
   */
  const handleAssignStudent = async (picked: { id: string; name: string }) => {
    if (!scratchpadDoc) return;
    setIsAssigning(true);
    setError(null);
    try {
      const teacherUid = user?.id || 'teacher_default';
      const teacherName = user?.firstName
        ? `${user.firstName} ${user.lastName || ''}`.trim()
        : user?.username || 'Lektor CRIBRO';
      const adopted = await adoptScratchpadForStudent(scratchpadDoc, picked, {
        uid: teacherUid,
        name: teacherName,
      });
      setScratchpadDoc(adopted);
      setIsPickerOpen(false);
    } catch (err: any) {
      console.error('Nie udało się przypisać notatnika:', err);
      setError(err.message || 'Nie udało się przypisać notatnika do kursanta.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handlePush = (data: any) => {
    if (onPushToLessonRecord) {
      onPushToLessonRecord(data);
      onClose();
    }
  };

  return (
    /* Bez zaokrągleń, cienia i marginesu: to jest strona, a nie karta leżąca
       na stronie. Zamknięcie renderuje sam edytor w swoim pasku nagłówka. */
    <div
      className={
        variant === 'standalone'
          ? 'h-[100dvh] min-h-screen flex flex-col bg-base-100'
          : variant === 'overlay'
          ? 'fixed inset-0 z-[100] h-full min-h-screen flex flex-col bg-base-100'
          /* `h-full`, nie `flex-1`: kontener, w którym stoi ten ekran
             (`<main>` w Dashboard), jest zwykłym blokiem z przewijaniem, a nie
             kontenerem flex — `flex-1` nic tam nie znaczy i strona kurczyła się
             do wysokości treści, przez co stopka ucinała kartkę w połowie
             ekranu, a pod nią świeciło tło aplikacji. */
          : 'h-full min-h-[600px] flex flex-col bg-base-100'
      }
    >
      <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm font-semibold text-content-muted">Ładowanie notatnika lekcyjnego...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 max-w-md">
              <AlertCircle size={28} className="mx-auto mb-2" />
              <p className="font-bold text-sm">Nie udało się otworzyć notatnika</p>
              <p className="text-xs mt-1 opacity-80">{error}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-base-300 text-text-hi text-xs font-bold hover:bg-base-200"
            >
              Zamknij
            </button>
          </div>
        ) : scratchpadDoc ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* PASEK PRZYPISANIA — tylko dopóki notatnik jest roboczy.

                Notatnik bez kursanta jest sprawny: da się w nim pisać,
                zapisuje się, ma PIN. Brakuje mu jednego — kogoś, kto go
                zobaczy. Ten pasek mówi dokładnie to i znika w chwili, gdy
                kursant jest wybrany; po przypisaniu nie ma już czego
                wybierać, a stały pasek byłby stałym przypomnieniem o
                decyzji, która zapadła. */}
            {!scratchpadDoc.studentId && assignableStudents.length > 0 && (
              <div className="px-4 py-2.5 border-b border-line-strong bg-primary/[0.06] flex flex-wrap items-center gap-2">
                <span className="text-xs text-content-muted">
                  Notatnik roboczy — nikt go jeszcze nie widzi.
                </span>

                {isPickerOpen ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {assignableStudents.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        disabled={isAssigning}
                        onClick={() => handleAssignStudent(candidate)}
                        className="px-2.5 py-1 rounded-lg bg-base-200/80 border border-line-strong text-[12px] font-semibold text-text-hi hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
                      >
                        {candidate.name}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsPickerOpen(false)}
                      className="px-2 py-1 text-[12px] text-content-muted hover:text-text-hi"
                    >
                      Anuluj
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(true)}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-accent-ink text-xs font-bold hover:brightness-110 transition-all"
                  >
                    <UserPlus size={14} />
                    Przypisz kursanta
                  </button>
                )}

                {isAssigning && (
                  <span className="flex items-center gap-1.5 text-xs text-primary">
                    <Loader2 size={13} className="animate-spin" /> Przenoszę treść…
                  </span>
                )}
              </div>
            )}

            <ScratchpadEditor
              document={scratchpadDoc}
              onSaveContent={handleSaveContent}
              onToggleStudentEdit={handleToggleStudentEdit}
              onToggleRequirePin={handleToggleRequirePin}
              onPushToLessonRecord={onPushToLessonRecord ? handlePush : undefined}
              currentUser={{
                uid: user?.id || 'teacher',
                name: user?.firstName || user?.username || 'Lektor',
                role: 'teacher',
              }}
              standalone={variant === 'standalone'}
              className="flex-1 min-h-0 rounded-none border-0 shadow-none"
              autoFocus
              onClose={onClose}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default TeacherScratchpadScreen;
