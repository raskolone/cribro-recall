import React, { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, Download, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import NotionSyncResultModal from './NotionSyncResultModal';
import {
  ImportReport,
  MatchReason,
  PreviewResult,
  StudentPreview,
  importNotionSelection,
  previewNotionSync,
} from '../../services/notionSync';

interface NotionAutoCheckStatus {
  lastCheckedAt?: string;
  newLessonsCount?: number;
  newStudentsCount?: number;
  orphanLessons?: number;
  hasNew?: boolean;
}

/**
 * Import historii lekcji i kursantów z Notion.
 *
 * Dwa kroki, a nie jeden przycisk: najpierw aplikacja pokazuje, kogo widzi
 * w Notion i kto ma już konto, potem lektor zaznacza, co ma wejść. Pojawienie
 * się kogoś w Notion nie jest zgodą na założenie mu konta, a jednym przebiegiem
 * przez całe archiwum przekraczaliśmy czas oczekiwania przeglądarki.
 */

const MATCH_LABEL: Record<MatchReason, string> = {
  notion: 'powiązany wcześniej',
  email: 'rozpoznany po adresie',
  name: 'rozpoznany po imieniu i nazwisku',
  username: 'rozpoznany po nazwie użytkownika',
};

interface Props {
  /**
   * Wywoływane po udanym imporcie. Panel trzyma listę kursantów we własnym
   * stanie, wczytanym przy wejściu na stronę — bez tego sygnału świeżo
   * założone konto istnieje w bazie, ale pojawia się dopiero po odświeżeniu.
   */
  onImported?: () => void;
}

const NotionSyncButton: React.FC<Props> = ({ onImported }) => {
  // Zlecenie 2026-09-12: karta nie ma stać stale otwarta w panelu — pojawia
  // się w skrócie i rozwija dopiero na kliknięcie (albo od razu, gdy
  // automat znajdzie coś nowego).
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoCheck, setAutoCheck] = useState<NotionAutoCheckStatus | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'system', 'notionAutoCheck'),
      (snap) => setAutoCheck(snap.exists() ? (snap.data() as NotionAutoCheckStatus) : null),
      (err) => console.warn('NotionSyncButton auto-check snapshot error:', err)
    );
    return unsub;
  }, []);

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [createAccounts, setCreateAccounts] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null);
  const [error, setError] = useState('');
  // Błąd podglądu zostaje przy przycisku, błąd importu trafia do okna —
  // import trwa długo i lektor zdąży spojrzeć gdzie indziej.
  const [importError, setImportError] = useState('');

  const loadPreview = async () => {
    setBusy('preview');
    setError('');
    try {
      const result = await previewNotionSync();
      setPreview(result);
      // Domyślnie zaznaczeni ci, którzy mają konto i czekają na nich lekcje —
      // to jedyny przypadek bez żadnych skutków ubocznych.
      setChosen(
        new Set(
          result.students
            .filter((s) => s.uid && s.lessonCount > 0 && !s.inactive)
            .map((s) => s.notionId)
        )
      );
      setCreateAccounts(new Set());
    } catch (e: any) {
      setError(e?.message || 'Nie udało się odczytać danych z Notion.');
    } finally {
      setBusy(null);
    }
  };

  const toggle = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const runImport = async () => {
    setBusy('import');
    setError('');
    setImportError('');
    setReport(null);
    try {
      const result = await importNotionSelection(
        [...chosen].map((notionId) => ({
          notionId,
          createAccount: createAccounts.has(notionId),
        }))
      );
      setReport(result);
      onImported?.();
      // Po imporcie podgląd jest nieaktualny: konta powstały, adresy się zmieniły.
      await loadPreview();
    } catch (e: any) {
      setImportError(e?.message || 'Import nie powiódł się.');
    } finally {
      setBusy(null);
    }
  };

  const rowTone = (s: StudentPreview): string => {
    if (s.inactive) return 'opacity-55';
    if (!s.uid) return 'border-warn/25';
    return 'border-line-strong';
  };

  const openPanel = () => {
    setReport(null);
    setImportError('');
    setIsExpanded(true);
    if (!preview) loadPreview();
  };

  // Zwinięte domyślnie (zlecenie 2026-09-12): karta nie stoi stale w panelu.
  // Automat codziennie sprawdza Notion sam (`checkNotionDaily`, Cloud
  // Functions) i pisze wynik do `system/notionAutoCheck` — gdy jest coś
  // nowego, to WŁAŚNIE to sprawia, że coś się tu w ogóle pokazuje. Bez tego
  // (nic nowego, albo automat jeszcze nie odpalił) zostaje wyłącznie
  // niepozorny link, żeby ręczne sprawdzenie było wciąż możliwe.
  if (!isExpanded) {
    const hasNew = !!autoCheck?.hasNew;
    return (
      <div className="flex items-center justify-end">
        {hasNew ? (
          <button
            onClick={openPanel}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-warn/50 bg-warn/10 text-warn text-xs sm:text-sm font-bold hover:bg-warn/20 transition-colors"
          >
            <Sparkles size={15} />
            Notion:{' '}
            {[
              autoCheck?.newLessonsCount ? `${autoCheck.newLessonsCount} nowych lekcji` : null,
              autoCheck?.newStudentsCount ? `${autoCheck.newStudentsCount} nowych kursantów` : null,
            ]
              .filter(Boolean)
              .join(', ') || 'coś nowego'}
            <ChevronDown size={14} />
          </button>
        ) : (
          <button
            onClick={openPanel}
            className="text-[11px] text-content-muted hover:text-text-hi transition-colors underline decoration-dotted underline-offset-2"
          >
            Sprawdź Notion ręcznie
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-line-strong bg-base-200/40 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-text-hi">Historia lekcji z Notion</h3>
          <p className="text-xs text-content-muted mt-0.5 max-w-xl">
            Najpierw sprawdź, kogo widać w Notion i kto ma już konto. Potem zaznacz,
            co ma wejść do aplikacji. Notion pozostaje źródłem — ponowny import
            aktualizuje te same lekcje, nie tworzy kopii.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setReport(null);
              setImportError('');
              loadPreview();
            }}
            disabled={busy !== null}
            className="min-h-[2.75rem] px-4 inline-flex items-center gap-2 rounded-xl bg-primary text-accent-ink font-bold text-sm disabled:opacity-60"
          >
            {busy === 'preview' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {busy === 'preview' ? 'Sprawdzam…' : preview ? 'Odśwież listę' : 'Sprawdź Notion'}
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            disabled={busy !== null}
            title="Zwiń"
            aria-label="Zwiń"
            className="h-9 w-9 rounded-xl flex items-center justify-center text-content-muted hover:text-text-hi hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {error && (
        <p className="flex items-start gap-2 text-xs text-warn bg-warn/10 border border-warn/20 rounded-xl p-3">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span className="break-words">{error}</span>
        </p>
      )}

      {preview && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-content-muted font-mono">
              {preview.students.length} kart w Notion · {preview.lessonsTotal} lekcji z podsumowaniem
              {preview.orphanLessons > 0 && ` · ${preview.orphanLessons} bez przypisanego kursanta`}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: 'Zaznacz wszystkich', pick: () => preview.students.map((s) => s.notionId) },
                {
                  label: 'Tylko z kontem',
                  pick: () =>
                    preview.students.filter((s) => s.uid && !s.inactive).map((s) => s.notionId),
                },
                { label: 'Odznacz', pick: () => [] as string[] },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={() => setChosen(new Set(action.pick()))}
                  disabled={busy !== null}
                  className="min-h-[2rem] px-2.5 rounded-lg border border-line-strong text-[11px] font-bold text-content-muted hover:text-text-hi hover:border-primary/40 disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="space-y-1.5">
            {preview.students.map((s) => {
              const picked = chosen.has(s.notionId);
              return (
                <li
                  key={s.notionId}
                  className={`rounded-xl border bg-base-100/40 px-3 py-2.5 ${rowTone(s)}`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={picked}
                      disabled={busy !== null}
                      onChange={() => setChosen((prev) => toggle(prev, s.notionId))}
                      className="mt-1 w-4 h-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-bold text-text-hi text-sm">{s.name}</span>
                        {s.isGroup && <span className="text-[11px] text-content-muted">grupa</span>}
                        {s.inactive && (
                          <span className="text-[11px] text-content-muted">nieaktywny</span>
                        )}
                        <span className="text-[11px] text-content-muted font-mono">
                          {s.lessonCount} lekcji
                        </span>
                      </span>

                      <span className="block text-[11px] mt-0.5">
                        {s.uid ? (
                          <span className="text-primary">
                            ma konto — {MATCH_LABEL[s.matchedBy || 'notion']}
                            {typeof s.importedCount === 'number' && (
                              <span className="text-content-muted">
                                {' '}· w aplikacji {s.importedCount} z {s.lessonCount}
                              </span>
                            )}
                            {s.emailNeedsFix && ' · adres do poprawienia'}
                          </span>
                        ) : (
                          <span className="text-warn">nie ma konta w aplikacji</span>
                        )}
                        {s.emails.length > 0 && (
                          <span className="text-content-muted"> · {s.emails.join(', ')}</span>
                        )}
                      </span>
                    </span>
                  </label>

                  {/* Zakładanie konta wymaga osobnej zgody — zaznaczenie kursanta
                      do importu lekcji nie może tworzyć mu konta po cichu. */}
                  {!s.uid && picked && (
                    <label className="flex items-center gap-2 mt-2 ml-7 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createAccounts.has(s.notionId)}
                        disabled={busy !== null || !s.emails.some((e) => e.includes('@'))}
                        onChange={() => setCreateAccounts((prev) => toggle(prev, s.notionId))}
                        className="w-3.5 h-3.5 accent-warn"
                      />
                      <span className="text-[11px] text-warn font-bold">
                        Załóż konto i wyślij hasło startowe
                      </span>
                    </label>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={runImport}
              disabled={busy !== null || chosen.size === 0}
              className="min-h-[2.75rem] px-4 inline-flex items-center gap-2 rounded-xl bg-primary text-accent-ink font-bold text-sm disabled:opacity-50"
            >
              {busy === 'import' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              {busy === 'import' ? 'Importuję…' : `Importuj zaznaczonych (${chosen.size})`}
            </button>
            <span className="text-[11px] text-content-muted">
              Import czyta treść każdej lekcji osobno — przy kilkudziesięciu potrwa minutę.
            </span>
          </div>
        </>
      )}

      <NotionSyncResultModal
        report={report}
        error={importError}
        onClose={() => {
          setReport(null);
          setImportError('');
        }}
      />

    </section>
  );
};

export default NotionSyncButton;
