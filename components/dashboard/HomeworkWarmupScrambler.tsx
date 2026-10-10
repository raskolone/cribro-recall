import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowRight,
  RotateCcw,
  Flame,
  CheckCircle2,
  Lightbulb,
  SkipForward,
  Zap,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import i18n from 'i18next';
import { buildWarmupRoundsReport, filterValidRounds, WarmupRound } from '../../utils/warmupRounds';
import { hashString, stableShuffle } from '../../utils/warmupChunks';
import { assignTileColors } from '../../utils/warmupTileColors';
import { classifyUnscrambleAttempt, UnscrambleResult } from '../../utils/unscrambleGrading';
import { HomeworkType } from '../../types';

export interface WarmupAttemptResult {
  /** Indeks elementu w oryginalnej tablicy `sentences` — identyfikator zgodny z istniejącym modelem odpowiedzi. */
  itemIndex: number;
  /** Rzeczywista odpowiedź kursanta: kawałki (frazy) w kolejności, w jakiej je ułożył. */
  answerOrder: string[];
  result: UnscrambleResult;
}

interface HomeworkWarmupScramblerProps {
  sentences: any[];
  task?: any | null;
  onComplete: () => void;
  onSkip: () => void;
  /** Wywoływany raz na każdą ukończoną (w pełni ułożoną) próbę — wywołujący decyduje, jak i czy zapisać próbę trwale. */
  onAttemptResult?: (attempt: WarmupAttemptResult) => void;
  /**
   * Podpis przycisku po ostatnim zdaniu. Domyślnie „Rozpocznij pracę domową" (rozgrzewka pracy
   * domowej); Ćwiczenia dowolne podają własny, bez odwołania do pracy domowej.
   */
  finishLabel?: string;
}

/** Kafelek puli: kawałek odpowiedzi albo dystraktor (zniekształcony kawałek TEGO SAMEGO zdania). */
interface BankTile {
  id: number;
  text: string;
  isDistractor: boolean;
  /** Dekoracyjny odcień 0…4 — zależy od tekstu kafelka i rundy, nie od roli ani pozycji (utils/warmupTileColors.ts). */
  color: number;
}

/**
 * Pełne literały klas (Tailwind skanuje źródło), jeden zestaw na odcień. Tło i obrys z tokenów
 * `tile-N` / `tile-line-N` (osobne wartości dla jasnego i ciemnego motywu), tekst zawsze `text-hi`.
 */
const TILE_COLOR_CLASSES = [
  'bg-tile-1 border-tile-line-1',
  'bg-tile-2 border-tile-line-2',
  'bg-tile-3 border-tile-line-3',
  'bg-tile-4 border-tile-line-4',
  'bg-tile-5 border-tile-line-5',
] as const;

const roundKey = (round: WarmupRound): string => `${round.itemIndex}|${round.targetSentence}`;

/**
 * Rozgrzewka klockowa: polskie zdanie jako polecenie, angielska odpowiedź składana z kafelków-
 * KAWAŁKÓW (frazy po 2–4 słowa, `utils/warmupChunks.ts`). Lekka forma: bez punktów i kar, można
 * pominąć w każdej chwili.
 *
 * Kafelki są STABILNE: kolejność puli ustalana raz na rundę (ziarno z treści rundy i sesji, nie
 * z tożsamości propsów), wybrany kafelek zostaje w puli jako puste miejsce, a strefa odpowiedzi ma
 * stałą wysokość (niewidoczny „miernik" z kompletną odpowiedzią), więc nic się nie przesuwa po
 * kliknięciu. Ruch tylko CSS, wyłączany przy prefers-reduced-motion.
 */
export const HomeworkWarmupScrambler: React.FC<HomeworkWarmupScramblerProps> = ({
  sentences,
  task,
  onComplete,
  onSkip,
  onAttemptResult,
  finishLabel = 'Rozpocznij pracę domową',
}) => {
  // Rodzic bywa przerenderowany z nową (równoważną) tożsamością `task`/`sentences` — np. migawka
  // bazy po zapisie próby albo `task={{ type: 'translation' }}` w JSX. Rundy mają więc stabilną
  // tożsamość dopóki ich TREŚĆ się nie zmieni; inaczej pula tasowałaby się przy każdym renderze,
  // a wybrane indeksy wskazywałyby inne kafelki.
  // `filterValidRounds` to obrona w głębi: runda, której kafelki nie spełniają niezmiennika
  // (kawałki poprawnego zdania + najwyżej jeden dystraktor z tego samego zdania), się nie pokazuje.
  const report = buildWarmupRoundsReport(sentences, task);
  const validated = filterValidRounds(report.rounds);
  const computedRounds = validated.rounds;
  const skippedRounds = [...report.skipped, ...validated.skipped];
  const roundsSignature = JSON.stringify(
    computedRounds.map((r) => [r.itemIndex, r.targetSentence, r.sourceLabel, r.hint, r.chunks, r.distractors])
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const warmupItems: WarmupRound[] = useMemo(() => computedRounds, [roundsSignature]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Ziarno sesji: pula wygląda inaczej przy kolejnym podejściu, ale nie zmienia się w trakcie rundy.
  const sessionSeedRef = useRef<number>(Math.floor(Math.random() * 2 ** 31));

  // Aktualnie wybrane kafelki (id kafelków puli, w kolejności wyboru)
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [result, setResult] = useState<UnscrambleResult | null>(null);
  const [showHint, setShowHint] = useState(false);

  // Zabezpiecza przed podwójnym kliknięciem "Następne zdanie" w tym samym evencie
  // (np. podwójny tap na dotyku), zanim React zdąży przerenderować z nowym currentIndex.
  const transitionLockRef = useRef(false);
  // Gwarantuje, że onComplete wywoła się dokładnie raz po ostatnim zdaniu, nawet
  // jeśli handleNext zostanie wywołane ponownie zanim rodzic zdąży odmontować komponent.
  const completeOnceRef = useRef(false);

  // Pominięte rundy: bez błędu i bez zapisu wyniku — tylko ślad w konsoli dla lektora/dewelopera.
  const skippedSignature = JSON.stringify(skippedRounds);
  useEffect(() => {
    if (skippedRounds.length > 0) console.warn('[rozgrzewka] pominięto rundy:', skippedRounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skippedSignature]);

  // Jeśli brak odpowiednich zdań na rozgrzewkę, od razu przechodzimy do zadań
  useEffect(() => {
    if (warmupItems.length === 0) {
      onSkip();
    }
  }, [warmupItems, onSkip]);

  const currentItem = warmupItems[currentIndex];
  const currentKey = currentItem ? roundKey(currentItem) : '';

  // Zwalnia blokadę przejścia dopiero, gdy runda wskazywana przez currentIndex
  // faktycznie się wyrenderowała — chroni przed drugim, szybkim dotknięciem
  // "Następne zdanie" zanim React zdąży scalić stan nowej rundy.
  useEffect(() => {
    transitionLockRef.current = false;
  }, [currentIndex]);

  // Odpowiedź wzorcowa: kawałki w poprawnej kolejności
  const targetChunks = useMemo(() => (currentItem ? currentItem.chunks : []), [currentItem]);

  // Pula: kawałki odpowiedzi + dystraktory, w stałej dla rundy kolejności
  const bank: BankTile[] = useMemo(() => {
    if (!currentItem || currentItem.chunks.length === 0) return [];
    const base = [
      ...currentItem.chunks.map((text) => ({ text, isDistractor: false })),
      ...currentItem.distractors.map((text) => ({ text, isDistractor: true })),
    ];
    // Kolor wynika z tekstu i rundy — nie z roli ani z miejsca w odpowiedzi, więc niczego nie zdradza.
    const colors = assignTileColors(base.map((tile) => tile.text), currentKey);
    const tiles: BankTile[] = base.map((tile, id) => ({ ...tile, id, color: colors[id] }));
    const seed = hashString(`${currentKey}|${sessionSeedRef.current}`);
    return stableShuffle(tiles, seed, (order) => {
      // Pula nie może zaczynać się od ułożonej odpowiedzi — także gdy między kafelkami odpowiedzi
      // leży dystraktor (wtedy wystarczyłoby kliknąć kafelki po kolei, pomijając obcy).
      const answerOrder = order.filter((t) => !t.isDistractor).map((t) => t.text);
      return answerOrder.every((text, i) => text === currentItem.chunks[i]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);

  // Miernik wysokości strefy odpowiedzi: pełna poprawna odpowiedź, najdłuższe kawałki pierwsze
  // (najgorszy przypadek zawijania), niewidoczna i poza dostępnością.
  const sizerChunks = useMemo(() => [...targetChunks].sort((a, b) => b.length - a.length), [targetChunks]);

  if (!currentItem || warmupItems.length === 0) {
    return null;
  }

  const tileById = (id: number) => bank.find((tile) => tile.id === id);
  const isDone = result === 'correct' || result === 'close';
  const answerLength = targetChunks.length;

  // Sprawdzamy czy ułożone kawałki tworzą prawidłowe (lub "bliskie") zdanie
  const handleSelectTile = (tileId: number) => {
    if (isDone || selectedIds.includes(tileId) || selectedIds.length >= answerLength) return;

    const nextSelected = [...selectedIds, tileId];
    setSelectedIds(nextSelected);

    // Gdy liczba wybranych kafelków równa się długości odpowiedzi, klasyfikujemy próbę
    if (nextSelected.length === answerLength) {
      const answerOrder = nextSelected.map((id) => tileById(id)?.text ?? '');
      const classification = classifyUnscrambleAttempt(answerOrder, targetChunks);
      setResult(classification);

      onAttemptResult?.({
        itemIndex: currentItem.itemIndex,
        answerOrder,
        result: classification,
      });
      // `incorrect` zostaje bez ekranu wyniku — kursant widzi ułożone, niepasujące kafelki
      // i może cofnąć kafelek albo użyć "Resetuj" (istniejące zachowanie retry).
    }
  };

  const handleRemoveTile = (positionInSelected: number) => {
    if (isDone) return;
    setSelectedIds((prev) => prev.filter((_, i) => i !== positionInSelected));
    // Cofnięcie kafelka zdejmuje wskazówkę o nietrafionej odpowiedzi — kursant układa dalej.
    setResult(null);
  };

  const handleReset = () => {
    setSelectedIds([]);
    setResult(null);
  };

  const handleNext = () => {
    if (transitionLockRef.current) return;
    transitionLockRef.current = true;

    if (currentIndex < warmupItems.length - 1) {
      // Reset stanu rundy w TYM SAMYM evencie co zmiana indeksu — osobny useEffect po zmianie
      // currentIndex dawał pierwszy render nowej rundy z identyfikatorami kafelków poprzedniej.
      setSelectedIds([]);
      setResult(null);
      setShowHint(false);
      setCurrentIndex((prev) => prev + 1);
    } else if (!completeOnceRef.current) {
      completeOnceRef.current = true;
      onComplete();
    }
  };

  const isLast = currentIndex === warmupItems.length - 1;
  const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;

  // Wspólny wygląd chipa (kawałka) — jedna definicja dla puli, strefy odpowiedzi i miernika.
  const chipBase =
    'px-3.5 py-2 rounded-xl border text-base font-bold leading-snug text-left pointer-coarse:min-h-11 pointer-coarse:min-w-11';

  return (
    <div className="max-w-2xl mx-auto px-4 py-3 sm:py-5 space-y-3 sm:space-y-5 animate-in fade-in duration-300 motion-reduce:animate-none">
      {/* Pasek górny rozgrzewki */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/35 text-text-hi text-xs font-bold uppercase tracking-wider">
            <Flame size={14} className="text-primary" aria-hidden="true" />
            {t('Rozgrzewka językowa')}
          </span>
          <span className="text-[12px] font-mono text-text-2" data-testid="warmup-progress">
            {t('{{current}} z {{total}}', { current: currentIndex + 1, total: warmupItems.length })}
          </span>
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line-strong pointer-coarse:min-h-11 bg-surface-flat hover:border-primary/50 text-text-hi text-xs font-semibold transition-colors motion-reduce:transition-none cursor-pointer"
          title={t('Przejdź od razu do właściwych zadań')}
        >
          <span>{t('Pomiń rozgrzewkę')}</span>
          <SkipForward size={13} aria-hidden="true" />
        </button>
      </div>

      {/* Główna karta rozgrzewki */}
      <div className="rounded-2xl border border-line-strong bg-surface-flat p-4 sm:p-7 relative overflow-hidden">
        {/* Informacja o braku oceny (zero presji) — nagłówek odpowiada zadaniu rozgrzewki */}
        <div className="flex items-center justify-between mb-2 sm:mb-4 gap-3">
          <span className="text-[12px] font-mono text-primary font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Zap size={13} aria-hidden="true" />
            {t('Niepunktowane')} • {t(currentItem.heading)}
          </span>

          {currentItem.hint && (
            <button
              type="button"
              onClick={() => setShowHint((v) => !v)}
              aria-expanded={showHint}
              className="inline-flex items-center gap-1 pointer-coarse:min-h-11 text-[12px] text-text-2 hover:text-text-hi font-bold transition-colors motion-reduce:transition-none cursor-pointer"
            >
              <Lightbulb size={12} aria-hidden="true" />
              <span>{showHint ? t('Ukryj podpowiedź') : t('Podpowiedź')}</span>
            </button>
          )}
        </div>

        {/* Zdanie źródłowe: polskie zdanie do przetłumaczenia */}
        {currentItem.sourceLabel && (
          <div className="p-3 sm:p-4 rounded-xl bg-base-100/60 border border-line-strong mb-2 sm:mb-3">
            <p className="text-base sm:text-lg font-bold text-text-hi leading-relaxed" data-testid="warmup-source">
              {currentItem.sourceLabel}
            </p>
          </div>
        )}

        {/* Polecenie */}
        <div className="sm:p-3 sm:rounded-xl sm:border sm:border-line-soft mb-3 sm:mb-5">
          <p className="text-sm text-text-2 leading-relaxed">{t(currentItem.instruction)}</p>
          {showHint && currentItem.hint && (
            <p className="text-sm text-text-hi mt-2.5 pt-2.5 border-t border-line-soft flex items-center gap-1.5">
              <span className="font-semibold">{t('Wskazówka')}:</span> {currentItem.hint}
            </p>
          )}
        </div>

        {/* Strefa odpowiedzi — o stałej wysokości (miernik z kompletną odpowiedzią) */}
        <div className="space-y-1 sm:space-y-2 mb-3 sm:mb-5">
          {/* Stała wysokość wiersza (także na dotyku), żeby pojawienie się „Resetuj" (cel 44 px) nie
              przesunęło puli kafelków o 20 px po pierwszym wyborze. */}
          <div className="flex items-center justify-between min-h-6 pointer-coarse:min-h-11">
            <span className="text-sm font-bold text-text-2">{t('Twoja odpowiedź')}</span>
            {selectedIds.length > 0 && !isDone && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 pointer-coarse:min-h-11 text-[12px] text-text-2 hover:text-text-hi font-semibold transition-colors motion-reduce:transition-none cursor-pointer"
              >
                <RotateCcw size={11} aria-hidden="true" /> {t('Resetuj')}
              </button>
            )}
          </div>

          <div
            data-testid="warmup-answer-zone"
            className={`grid min-h-[4.5rem] rounded-xl border-2 transition-colors motion-reduce:transition-none ${
              result === 'correct'
                ? 'border-primary bg-primary/10'
                : result === 'close'
                ? 'border-info bg-info/10'
                : 'border-dashed border-line-strong bg-base-100/40'
            }`}
          >
            {/* Miernik: niewidoczny, rezerwuje wysokość pełnej odpowiedzi */}
            <div aria-hidden="true" data-testid="warmup-answer-sizer" className="invisible col-start-1 row-start-1 flex flex-wrap content-start gap-1.5 sm:gap-2 p-2 sm:p-3">
              {sizerChunks.map((text, i) => (
                <span key={`sizer-${i}`} className={`${chipBase} border-transparent`}>
                  {text}
                </span>
              ))}
            </div>

            <div className="col-start-1 row-start-1 flex flex-wrap content-start items-start gap-1.5 sm:gap-2 p-2 sm:p-3">
              {selectedIds.length === 0 && (
                <span className="text-sm text-text-2 px-2 py-2 select-none flex items-center gap-2">
                  <Shuffle size={14} aria-hidden="true" /> {t('Dotykaj fraz poniżej, aby ułożyć zdanie')}
                </span>
              )}

              {selectedIds.map((tileId, pos) => {
                const tile = tileById(tileId);
                if (!tile) return null;
                return (
                  <button
                    key={`selected-${tileId}`}
                    type="button"
                    data-testid="warmup-selected-tile"
                    onClick={() => handleRemoveTile(pos)}
                    disabled={isDone}
                    title={t('Dotknij, aby cofnąć frazę')}
                    className={`${chipBase} ${TILE_COLOR_CLASSES[tile.color]} text-text-hi transition-colors motion-reduce:transition-none cursor-pointer enabled:hover:border-danger disabled:cursor-default`}
                  >
                    {tile.text}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pula kafelków: wybrany kafelek zostaje na swoim miejscu jako puste miejsce */}
        <div className="space-y-2">
          <span className="text-sm font-bold text-text-2">{t('Dostępne frazy')}</span>
          <div data-testid="warmup-bank" className="flex flex-wrap items-start gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-xl bg-base-100/40 border border-line-soft">
            {bank.map((tile) => {
              const isUsed = selectedIds.includes(tile.id);
              return (
                <div
                  key={`bank-${tile.id}`}
                  className={`rounded-xl border border-dashed ${isUsed ? 'border-line-soft' : 'border-transparent'}`}
                >
                  <button
                    type="button"
                    data-testid="warmup-bank-tile"
                    data-used={isUsed ? 'true' : undefined}
                    disabled={isUsed || isDone}
                    aria-hidden={isUsed ? true : undefined}
                    tabIndex={isUsed ? -1 : undefined}
                    onClick={() => handleSelectTile(tile.id)}
                    className={`${chipBase} ${TILE_COLOR_CLASSES[tile.color]} text-text-hi transition-colors motion-reduce:transition-none cursor-pointer enabled:hover:border-primary disabled:cursor-default ${
                      isUsed ? 'invisible' : ''
                    } ${isDone && !isUsed ? 'opacity-60' : ''} ${isDone && !isUsed && tile.isDistractor ? 'line-through' : ''}`}
                  >
                    {tile.text}
                  </button>
                </div>
              );
            })}
          </div>
          {/* Po sprawdzeniu: który kafelek był zbędny (tekstem, nie samym kolorem) */}
          {isDone && bank.some((tile) => tile.isDistractor) && (
            <p className="text-sm text-text-2" data-testid="warmup-extra-tile">
              {t('Zbędna fraza')}: <span className="font-semibold text-text-hi">{bank.find((tile) => tile.isDistractor)?.text}</span>
            </p>
          )}
        </div>

        {/* Wynik próby — aria-live, żeby czytnik ekranu ogłosił zmianę bez polegania wyłącznie na kolorze */}
        <div role="status" aria-live="polite">
          {result === 'incorrect' && (
            <p className="mt-4 text-sm text-text-2" data-testid="warmup-incorrect">
              {t('To jeszcze nie to — dotknij frazy, żeby ją cofnąć, albo użyj Resetuj')}
            </p>
          )}

          {result === 'correct' && (
            <div className="mt-5 p-4 rounded-xl bg-primary/10 border border-primary flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={22} className="text-primary shrink-0" aria-hidden="true" />
                <div>
                  <span className="font-bold text-text-hi text-sm block">{t('Świetnie ułożone!')}</span>
                  <span className="text-xs text-text-2">
                    {isLast ? t('Rozgrzewka zakończona, przejdź do zadań') : t('Gotowy na kolejne zdanie?')}
                  </span>
                </div>
              </div>

              <button
                type="button"
                data-testid="warmup-next-button"
                onClick={handleNext}
                className="w-full sm:w-auto min-h-11 px-5 py-2.5 rounded-xl bg-primary text-accent-ink font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer hover:brightness-110 transition-[filter] motion-reduce:transition-none"
              >
                <span className="whitespace-nowrap">{isLast ? t(finishLabel) : t('Następne zdanie')}</span>
                <ArrowRight size={15} className="shrink-0" aria-hidden="true" />
              </button>
            </div>
          )}

          {result === 'close' && (
            <div className="mt-5 p-4 rounded-xl bg-info/10 border border-info flex flex-col gap-3">
              <div className="flex items-start gap-2.5">
                <Sparkles size={22} className="text-info shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1.5">
                  <span className="font-bold text-text-hi text-sm block">{t('Byłeś/Byłaś blisko!')}</span>
                  <p className="text-sm text-text-2">
                    {t('Miałeś/Miałaś wszystkie właściwe frazy — tylko szyk był inny. Poprawna kolejność')}:
                  </p>
                  <p className="text-sm font-semibold text-text-hi rounded-lg border border-line-soft px-3 py-2">
                    {currentItem.targetSentence}
                  </p>
                </div>
              </div>

              <button
                type="button"
                data-testid="warmup-next-button"
                onClick={handleNext}
                className="w-full sm:w-auto self-end min-h-11 px-5 py-2.5 rounded-xl bg-info text-accent-ink font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer hover:brightness-110 transition-[filter] motion-reduce:transition-none"
              >
                <span className="whitespace-nowrap">{isLast ? t(finishLabel) : t('Następne zdanie')}</span>
                <ArrowRight size={15} className="shrink-0" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stopka z szybkim pominięciem */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm font-semibold text-text-2 hover:text-text-hi transition-colors motion-reduce:transition-none cursor-pointer underline underline-offset-4 pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center"
        >
          {t('Przejdź od razu do głównych ćwiczeń (bez rozgrzewki)')}
        </button>
      </div>
    </div>
  );
};

export default HomeworkWarmupScrambler;
