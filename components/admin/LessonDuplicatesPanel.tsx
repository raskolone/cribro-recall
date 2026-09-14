import React, { useMemo, useState } from 'react';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { AlertTriangle, CheckCircle2, Copy, Loader2, Trash2 } from 'lucide-react';
import { LessonRecord } from '../../types';
import { findDuplicateGroups } from '../../utils/lessonDuplicates';
import Button from '../ui/Button';

/**
 * Sprzątanie zdublowanych lekcji w historii jednego kursanta.
 *
 * ══ DLACZEGO TO NIE DZIEJE SIĘ SAMO ══
 *
 * Kasowanie wpisu z historii jest nieodwracalne i pociąga za sobą zestaw
 * słownictwa oraz wszystko, co się do lekcji odwołuje. Automat, który robi to
 * po cichu przy wejściu na ekran, przy jednym błędzie w regule kasuje komuś
 * pół roku zajęć i nikt się nie dowiaduje, co zniknęło. Dlatego panel POKAZUJE,
 * co znalazł, mówi, który wpis zostaje i dlaczego, a kasuje dopiero na
 * kliknięcie.
 *
 * ══ DWA RODZAJE ZNALEZISK ══
 *
 * Pewne (ten sam temat, ta sama data) da się usunąć hurtem — to zawsze jest
 * powtórzony import. Podejrzane (ten sam temat, inne daty, ta sama treść)
 * mają osobny przycisk przy każdej grupie, bo cykliczna powtórka tematu jest
 * normalną lekcją i tego automat nie odróżni.
 */

interface LessonDuplicatesPanelProps {
  studentId: string;
  lessonRecords: LessonRecord[];
  /** Wywoływane po usunięciu — panel nie trzyma własnej kopii historii. */
  onRemoved: (removedIds: string[]) => void;
}

const shortDate = (record: LessonRecord) => record.date || record.createdAt?.slice(0, 10) || '—';

const LessonDuplicatesPanel: React.FC<LessonDuplicatesPanelProps> = ({
  studentId,
  lessonRecords,
  onRemoved,
}) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const groups = useMemo(() => findDuplicateGroups(lessonRecords), [lessonRecords]);
  const certain = groups.filter(group => group.certain);
  const suspected = groups.filter(group => !group.certain);

  const removeRecords = async (ids: string[], busyKey: string) => {
    if (ids.length === 0) return;
    setBusy(busyKey);
    setError('');
    try {
      /* Jeden `writeBatch` zamiast pętli kasowań: albo znikają wszystkie wpisy
         z tej operacji, albo żaden. Połowicznie posprzątana historia byłaby
         gorsza od nieposprzątanej, bo nie wiadomo, co jeszcze zostało. */
      const batch = writeBatch(db);
      ids.forEach(id => batch.delete(doc(db, `users/${studentId}/lessonRecords/${id}`)));
      await batch.commit();
      onRemoved(ids);
    } catch (err: any) {
      console.error('[Duplikaty] Usuwanie nie powiodło się:', err);
      setError(err?.message || 'Nie udało się usunąć wpisów.');
    } finally {
      setBusy(null);
    }
  };

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-base-200/40 px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-content-muted">
        <CheckCircle2 size={14} className="text-primary shrink-0" />
        Historia nie ma zdublowanych tematów.
      </div>
    );
  }

  const certainCount = certain.reduce((sum, group) => sum + group.remove.length, 0);

  return (
    <div className="rounded-xl border border-warn/30 bg-warn/[0.06] p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-bold text-text-hi">
          <Copy size={15} className="text-warn shrink-0" />
          Zdublowane lekcje: {groups.length}
        </span>
        {certainCount > 0 && (
          <Button
            size="sm"
            onClick={() =>
              removeRecords(
                certain.flatMap(group => group.remove.map(record => record.id)),
                'certain'
              )
            }
            disabled={busy !== null}
            className="bg-danger text-white hover:brightness-110 flex items-center gap-1.5 text-xs"
          >
            {busy === 'certain' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Usuń {certainCount} {certainCount === 1 ? 'kopię' : 'kopii'}
          </Button>
        )}
      </div>

      {certain.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-content-muted">
            Ten sam temat, ta sama data — powtórzony import
          </p>
          {certain.map(group => (
            <div
              key={`${group.topic}-${group.keep.id}`}
              className="rounded-lg border border-line bg-base-200/50 px-3 py-2 text-xs"
            >
              <div className="font-semibold text-text-hi truncate">{group.keep.topic}</div>
              <div className="text-content-muted mt-0.5">
                zostaje wpis z {shortDate(group.keep)} · do usunięcia:{' '}
                {group.remove.length}
              </div>
            </div>
          ))}
        </div>
      )}

      {suspected.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-content-muted flex items-center gap-1.5">
            <AlertTriangle size={11} className="text-warn" />
            Ten sam temat i ta sama treść, inne daty — sprawdź, zanim usuniesz
          </p>
          {suspected.map(group => (
            <div
              key={`${group.topic}-${group.keep.id}`}
              className="rounded-lg border border-line bg-base-200/50 px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="font-semibold text-text-hi truncate">{group.keep.topic}</div>
                <div className="text-content-muted mt-0.5">
                  zostaje {shortDate(group.keep)} · usunąć{' '}
                  {group.remove.map(shortDate).join(', ')}
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy !== null}
                onClick={() =>
                  removeRecords(group.remove.map(record => record.id), group.keep.id)
                }
                className="shrink-0 border-danger/30 text-danger text-[11px]"
              >
                {busy === group.keep.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  'Usuń kopie'
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
};

export default LessonDuplicatesPanel;
