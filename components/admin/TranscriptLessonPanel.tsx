import React, { useEffect, useRef, useState } from 'react';
import { Mic, Loader2, CheckCircle2, AlertTriangle, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { LessonRecord } from '../../types';
import { useLiveLessonTranscript } from '../../hooks/useLiveLessonTranscript';
import { generateLessonFromTranscript } from '../../services/transcriptLesson';
import { approveTranscriptLesson, resolveLessonTopic } from '../../utils/transcriptLesson';
import Button from '../ui/Button';

/**
 * Lekcja z transkrypcji — pasek stanu, podgląd zapisu i dwa kroki lektora.
 *
 * ══ DWA KROKI, NIE JEDEN ══
 *
 * „Uruchom podsumowanie" i „Zatwierdź lekcję" są osobne celowo. Pierwsze
 * pyta model; drugie publikuje wynik kursantowi. Sklejone w jedno kliknięcie
 * oznaczałyby, że każda wygenerowana treść — razem z tym, co model wymyślił
 * z przekręconego nagrania — trafia do kursanta przed przeczytaniem przez
 * człowieka.
 *
 * ══ DLACZEGO PODGLĄD JEST ZWINIĘTY ══
 *
 * Zapis godzinnej rozmowy to kilkadziesiąt tysięcy znaków. Rozwinięty
 * zasłaniałby całą lekcję, a lektor zagląda do niego wtedy, gdy coś w
 * wygenerowanych blokach nie zgadza się z tym, co pamięta.
 */

interface TranscriptLessonPanelProps {
  record: LessonRecord;
  studentName?: string;
  studentLevel?: string;
  /** Zapis zmiany w rekordzie — ten sam, którym posługuje się widok lekcji. */
  onUpdateRecord?: (updated: Partial<LessonRecord>) => Promise<void>;
}

const PREVIEW_CHARS = 1200;

export const TranscriptLessonPanel: React.FC<TranscriptLessonPanelProps> = ({
  record,
  studentName,
  studentLevel,
  onUpdateRecord,
}) => {
  const live = useLiveLessonTranscript(record.studentId, record.id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  /*
   * Transkrypcja z nasłuchu ma pierwszeństwo nad tą z rekordu: rekord
   * przyszedł z listy lekcji i mógł zostać wczytany, zanim Sift skończył
   * wysyłkę. Nasłuch pokazuje stan z tej chwili.
   */
  const transcript = live.transcript || record.liveTranscript || '';
  const hasBlocks = Boolean(record.structuredBlocks?.summary || record.lessonSummary);
  const isCompleted = record.sessionStatus === 'completed';

  /*
   * Najświeższy rekord, czytany po zakończeniu wywołania Gemini — nie ten
   * zamknięty w domknięciu `handleGenerate` w chwili kliknięcia. Lektor może
   * w tym czasie ręcznie poprawić temat w edytorze lekcji (osobny formularz
   * w AdminPanel); odpowiedź AI, która przyjdzie później, nie może tej
   * poprawki po cichu nadpisać.
   */
  const recordRef = useRef(record);
  useEffect(() => {
    recordRef.current = record;
  }, [record]);

  const isPlaceholderTopic = (topic: string | undefined) => /^Lekcja z transkrypcji/.test(topic || '');

  const handleGenerate = async () => {
    if (!onUpdateRecord) return;
    setIsGenerating(true);
    setError(null);
    const topicBeforeGenerate = record.topic;
    try {
      const update = await generateLessonFromTranscript({
        transcript,
        studentName,
        level: studentLevel,
        date: record.date,
        // Temat nadany automatycznie przy odbiorze nie jest tematem lekcji,
        // tylko nazwą zastępczą — model ma go wymyślić z rozmowy, nie powtórzyć.
        topic: isPlaceholderTopic(record.topic) ? undefined : record.topic,
      });

      /*
       * Lektor mógł ręcznie zmienić temat, podczas gdy Gemini jeszcze
       * odpowiadał — wtedy jego edycja wygrywa (hierarchia w
       * `resolveLessonTopic`), a odpowiedź AI dostarcza tylko resztę bloków.
       */
      const latestTopic = recordRef.current.topic;
      const topicChangedDuringGenerate = latestTopic !== topicBeforeGenerate;
      const resolvedTopic = resolveLessonTopic({
        manualTopic: latestTopic,
        manualTopicDirty: topicChangedDuringGenerate && !isPlaceholderTopic(latestTopic),
        generatedTopic: update.topic,
      });

      await onUpdateRecord({
        ...update,
        ...(resolvedTopic ? { topic: resolvedTopic } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!onUpdateRecord) return;
    setIsApproving(true);
    setError(null);
    try {
      await onUpdateRecord(approveTranscriptLesson());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsApproving(false);
    }
  };

  /** Pasek stanu — jedno zdanie o tym, na czym stoi ta lekcja. */
  const status = (() => {
    if (live.error) {
      return { tone: 'bad' as const, text: `Nasłuch przerwany: ${live.error}` };
    }
    if (live.loading) return { tone: 'work' as const, text: 'Sprawdzam, co jest w bazie…' };
    if (!transcript) {
      return {
        tone: 'wait' as const,
        text: 'Czekam na transkrypcję z Cribro Sift — pojawi się tu sama, bez odświeżania.',
      };
    }
    if (isCompleted) {
      return { tone: 'ok' as const, text: 'Lekcja zatwierdzona i widoczna dla kursanta.' };
    }
    if (hasBlocks) {
      return {
        tone: 'wait' as const,
        text: 'Bloki gotowe. Przeczytaj i zatwierdź — do tego czasu kursant nic nie widzi.',
      };
    }
    return {
      tone: 'wait' as const,
      text: `Transkrypcja na miejscu (${transcript.length.toLocaleString('pl-PL')} znaków). Kursant jej nie widzi.`,
    };
  })();

  const toneClass = {
    ok: 'text-emerald-300',
    bad: 'text-rose-300',
    work: 'text-primary',
    wait: 'text-text-hi',
  }[status.tone];

  return (
    <div className="rounded-2xl border border-line-strong bg-line-soft/40 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-line-strong">
        <span className="flex items-center gap-2 text-sm font-bold text-text-hi">
          <Mic size={16} className="text-primary shrink-0" />
          Transkrypcja z Cribro Sift
        </span>

        {/* Kolor jako sygnał stanu, nie ozdoba — patrz filozofia UI w CLAUDE.md. */}
        <span className={`flex items-center gap-1.5 text-xs ${toneClass}`}>
          {status.tone === 'work' && <Loader2 size={13} className="animate-spin shrink-0" />}
          {status.tone === 'ok' && <CheckCircle2 size={13} className="shrink-0" />}
          {status.tone === 'bad' && <AlertTriangle size={13} className="shrink-0" />}
          {status.text}
        </span>

        {record.transcriptReceivedAt && (
          <span className="text-[11px] font-mono text-text-faint ml-auto">
            {new Date(record.transcriptReceivedAt).toLocaleString('pl-PL')}
          </span>
        )}
      </div>

      {error && (
        <p className="px-4 py-3 text-xs text-rose-300 border-b border-line-strong">{error}</p>
      )}

      {transcript && (
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleGenerate} disabled={isGenerating || !onUpdateRecord}>
              {isGenerating ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" /> Czytam rozmowę…
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Sparkles size={14} />
                  {hasBlocks ? 'Wygeneruj bloki jeszcze raz' : 'Uruchom podsumowanie lekcji'}
                </span>
              )}
            </Button>

            {hasBlocks && !isCompleted && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleApprove}
                disabled={isApproving || !onUpdateRecord}
              >
                {isApproving ? 'Zatwierdzam…' : 'Zatwierdź lekcję dla kursanta'}
              </Button>
            )}

            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              className="ml-auto flex items-center gap-1 text-xs text-text-faint hover:text-text-hi transition-colors"
            >
              {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {isOpen ? 'Zwiń zapis rozmowy' : 'Pokaż zapis rozmowy'}
            </button>
          </div>

          <pre className="text-[11px] leading-relaxed font-mono text-text-faint whitespace-pre-wrap break-words max-h-96 overflow-y-auto rounded-xl bg-ink/60 p-3 border border-line-strong">
            {isOpen ? transcript : `${transcript.slice(0, PREVIEW_CHARS)}${transcript.length > PREVIEW_CHARS ? '…' : ''}`}
          </pre>
        </div>
      )}
    </div>
  );
};

export default TranscriptLessonPanel;
