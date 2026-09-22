import React, { useMemo, useState } from 'react';
import i18n from 'i18next';
import { AlertCircle, Check, Copy, HelpCircle, Languages, Lightbulb, RotateCcw, Sparkles } from 'lucide-react';
import { HomeworkType } from '../../types';
import { CanonicalExercise, ExerciseSegment, normalizeExercise } from '../../utils/normalizeExercise';
import { shuffleArray } from '../../utils/exerciseShuffle';

/**
 * Jedno ćwiczenie pracy domowej, w czterech odmianach.
 *
 * Trzy z czterech rozwiązuje się samym dotykiem — klawiatura wchodzi tylko przy
 * tłumaczeniu, gdzie nie da się inaczej. To nie jest ozdoba: kursant robi zadanie
 * w tramwaju albo w kolejce, a każde pole tekstowe na telefonie to podniesiona
 * klawiatura, przewijanie i połowa ekranu mniej.
 *
 * Komponent nie ocenia i nie zapisuje — trzyma tylko odpowiedź i oddaje ją wyżej.
 *
 * Surowy element z bazy (`item`) jest zawsze najpierw przepuszczony przez
 * `normalizeExercise` (`utils/normalizeExercise.ts`) — różne kształty danych
 * z generatora AI i starszych zadań (BLANK_n, potrójne podkreślenie, luka
 * wstrzyknięta jako instrukcja zamiast zdania…) trafiają tutaj już jako
 * jeden, jednolity kontrakt. `type` (prop) decyduje wyłącznie o TYPIE
 * ćwiczenia — kształt pól czyta się już z `exercise`, nigdy z `item`
 * bezpośrednio.
 */

export interface HomeworkExerciseProps {
  type: HomeworkType;
  item: any;
  answer: any;
  onChange: (answer: any) => void;
}

const chipBase =
  'min-h-[2.75rem] px-3.5 rounded-xl border text-[15px] font-semibold transition-colors active:scale-[0.97]';

const InvalidExerciseCard: React.FC<{ message?: string }> = ({ message }) => (
  <div className="p-4 sm:p-5 rounded-2xl bg-warn/10 border border-warn/30 flex items-start gap-2.5">
    <AlertCircle size={18} className="text-warn shrink-0 mt-0.5" />
    <p className="text-sm text-content leading-relaxed">
      {i18n.t(message || 'Nie udało się wczytać treści tego zadania. Możesz przejść do kolejnego ćwiczenia.')}
    </p>
  </div>
);

interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

/**
 * Dopasuj pary: klik w lewą kolumnę, potem w prawą. Trafiona para blokuje się
 * na zielono, chybiona miga na czerwono i wraca do stanu wyjściowego —
 * dotykowo, bez przeciągania, tak jak reszta zadań w tym komponencie.
 */
const MatchingExerciseView: React.FC<{
  pairs: MatchingPair[];
  answer: any;
  onChange: (answer: string[]) => void;
}> = ({ pairs, answer, onChange }) => {
  const matched: string[] = Array.isArray(answer) ? answer : [];
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [wrongPair, setWrongPair] = useState<{ left: string; right: string } | null>(null);

  const leftOrder = useMemo(() => shuffleArray(pairs), [pairs]);
  const rightOrder = useMemo(() => shuffleArray(pairs), [pairs]);

  const pick = (side: 'left' | 'right', id: string) => {
    if (matched.includes(id) || wrongPair) return;
    if (side === 'left') {
      if (!selectedRight) {
        setSelectedLeft(id);
        return;
      }
      resolve(id, selectedRight);
    } else {
      if (!selectedLeft) {
        setSelectedRight(id);
        return;
      }
      resolve(selectedLeft, id);
    }
  };

  const resolve = (leftId: string, rightId: string) => {
    if (leftId === rightId) {
      onChange([...matched, leftId]);
      setSelectedLeft(null);
      setSelectedRight(null);
    } else {
      setWrongPair({ left: leftId, right: rightId });
      window.setTimeout(() => {
        setWrongPair(null);
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 500);
    }
  };

  const tileClass = (side: 'left' | 'right', id: string) => {
    if (matched.includes(id)) return `${chipBase} bg-success/15 border-success/40 text-success cursor-default`;
    if (wrongPair && wrongPair[side] === id) return `${chipBase} bg-danger/15 border-danger/40 text-danger`;
    if ((side === 'left' && selectedLeft === id) || (side === 'right' && selectedRight === id)) {
      return `${chipBase} bg-primary/15 border-primary/45 text-primary`;
    }
    return `${chipBase} bg-base-100/60 border-white/15 text-content`;
  };

  return (
    <div className="space-y-4">
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold uppercase tracking-wider">
        <Languages size={13} />
        {i18n.t('Dopasuj pary')}
      </span>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-2">
          {leftOrder.map((pair) => (
            <button
              key={pair.id}
              disabled={matched.includes(pair.id)}
              onClick={() => pick('left', pair.id)}
              className={`${tileClass('left', pair.id)} w-full text-left`}
            >
              {pair.left}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {rightOrder.map((pair) => (
            <button
              key={pair.id}
              disabled={matched.includes(pair.id)}
              onClick={() => pick('right', pair.id)}
              className={`${tileClass('right', pair.id)} w-full text-left`}
            >
              {pair.right}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const HomeworkExercise: React.FC<HomeworkExerciseProps> = ({ type, item, answer, onChange }) => {
  const [showHint, setShowHint] = useState(false);

  // `multiple_choice` i `matching` czytają `item` bezpośrednio, bez
  // przechodzenia przez `normalizeExercise` — kontrakt tego adaptera zna tylko
  // cztery starsze typy (patrz `CanonicalExerciseType`), więc dla tych dwóch
  // zawsze zwróciłby `state: 'invalid'`. Sprawdzamy je więc PRZED odczytaniem
  // stanu `exercise`, inaczej ważne zadanie nigdy by się nie wyrenderowało.
  if (type === 'multiple_choice') {
    const options: string[] = item.options || [];
    const selected = typeof answer === 'number' ? answer : -1;

    return (
      <div className="space-y-4">
        <p className="prose-justified text-lg font-bold text-text-hi leading-snug">{item.question}</p>
        <div className="space-y-2">
          {options.map((option, index) => (
            <button
              key={index}
              onClick={() => onChange(index)}
              className={`w-full min-h-[3.25rem] px-4 rounded-xl border text-left text-[15px] font-semibold transition-colors ${
                selected === index
                  ? 'bg-primary/15 border-primary/45 text-primary'
                  : 'bg-base-100/50 border-white/12 text-content'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'matching') {
    const pairs: MatchingPair[] = Array.isArray(item?.pairs)
      ? item.pairs.filter((p: any) => p?.id && p?.left && p?.right)
      : [];

    if (pairs.length < 2) {
      return <InvalidExerciseCard />;
    }

    return <MatchingExerciseView pairs={pairs} answer={answer} onChange={onChange} />;
  }

  const exercise: CanonicalExercise = normalizeExercise(item, { type });

  if (exercise.state === 'invalid') {
    return <InvalidExerciseCard message={exercise.message} />;
  }

  if (exercise.type === 'translation') {
    const polishSentence = exercise.sourceSentence || '';
    const hintText = exercise.hint || null;

    return (
      <div className="space-y-4">
        {/* Nagłówek zadania tłumaczenia */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold uppercase tracking-wider">
            <Languages size={13} />
            {i18n.t('Przetłumacz zdanie')}
          </span>

          {hintText && (
            <button
              type="button"
              onClick={() => setShowHint((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                showHint
                  ? 'bg-primary/15 border-primary/40 text-primary shadow-sm'
                  : 'bg-base-200 border-line-strong text-content-muted hover:text-content'
              }`}
            >
              <Lightbulb size={13} className={showHint ? 'text-primary fill-primary/30' : 'text-content-muted'} />
              <span>{showHint ? 'Ukryj wskazówkę' : 'Wskazówka'}</span>
            </button>
          )}
        </div>

        {/* Zdanie do przetłumaczenia */}
        <div className="p-4 sm:p-5 rounded-2xl bg-base-100/70 border border-white/10 shadow-inner">
          <p className="prose-justified text-lg sm:text-xl font-bold text-text-hi leading-relaxed">
            {polishSentence}
          </p>
        </div>

        {/* Rozwijana wskazówka */}
        {showHint && hintText && (
          <div className="p-3.5 rounded-xl bg-base-200 border border-line-strong text-content text-xs sm:text-sm leading-relaxed flex items-start gap-2.5 animate-in fade-in duration-200 shadow-sm">
            <Lightbulb size={16} className="text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-text-hi block text-[11px] uppercase tracking-wider mb-0.5">
                Wskazówka lektora:
              </span>
              <span>{hintText}</span>
            </div>
          </div>
        )}

        {/* Pole odpowiedzi */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-content-muted">Twoja odpowiedź:</label>
            <span className="text-[11px] text-content-muted/70">{i18n.t('Zapisz tłumaczenie w języku angielskim.')}</span>
          </div>
          <textarea
            value={answer || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder="Wpisz tłumaczenie po angielsku…"
            className="w-full p-4 bg-base-100/90 text-text-hi text-[15px] sm:text-base border border-white/15 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-none transition-all resize-y placeholder:text-content-muted/50"
          />
        </div>
      </div>
    );
  }

  if (exercise.type === 'word_order') {
    const chosen: number[] = Array.isArray(answer) ? answer : [];
    const tokens = exercise.tokens || [];
    const remaining = tokens.map((_, i) => i).filter((i) => !chosen.includes(i));

    return (
      <div className="space-y-4">
        {/* Nagłówek deterministyczny — to układanka gramatyczna, nie tłumaczenie,
            więc nie pokazujemy polskiego zdania ani żadnej podpowiedzi treściowej. */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold uppercase tracking-wider">
          <Languages size={13} />
          {i18n.t('Uporządkuj słowa w poprawne zdanie:')}
        </span>

        {/* Ułożone zdanie: dotknięcie fragmentu zdejmuje go z powrotem. */}
        <div className="min-h-[5rem] rounded-xl border border-dashed border-white/20 bg-base-100/40 p-2.5 flex flex-wrap gap-2 items-start">
          {chosen.length === 0 && (
            <span className="text-[13px] text-content-muted px-1 py-2">
              {i18n.t('Ułóż wyrazy w poprawnej kolejności.')}
            </span>
          )}
          {chosen.map((chunkIndex, position) => (
            <button
              key={`${chunkIndex}-${position}`}
              onClick={() => onChange(chosen.filter((_, i) => i !== position))}
              className={`${chipBase} bg-primary/15 border-primary/40 text-primary`}
            >
              {tokens[chunkIndex]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {remaining.map((chunkIndex) => (
            <button
              key={chunkIndex}
              onClick={() => onChange([...chosen, chunkIndex])}
              className={`${chipBase} bg-base-100/60 border-white/15 text-content`}
            >
              {tokens[chunkIndex]}
            </button>
          ))}
        </div>

        {chosen.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="inline-flex items-center gap-1.5 min-h-[2.5rem] text-xs font-bold text-content-muted"
          >
            <RotateCcw size={13} /> Zacznij od nowa
          </button>
        )}
      </div>
    );
  }


  if (exercise.type === 'fill_in_the_blank') {
    const segments = exercise.segments || [];
    const availableWords = exercise.availableWords || [];
    const hasBank = availableWords.length > 0;

    // Zdegradowany stan: żadna z czterech znanych postaci luki nie rozpoznana —
    // pełne, swobodne pole tekstowe zamiast pustego, szarego boksu.
    if (exercise.state === 'degraded') {
      const currentValue = typeof answer === 'string' ? answer : '';
      const fallbackText = segments.map((s) => (s.kind === 'text' ? s.text : '')).join('');
      return (
        <div className="space-y-4">
          {fallbackText && (
            <div className="p-4 sm:p-5 rounded-2xl bg-base-100/70 border border-white/10 shadow-inner">
              <p lang="en" className="prose-justified text-lg sm:text-xl font-bold text-text-hi leading-relaxed">
                {fallbackText}
              </p>
            </div>
          )}
          <textarea
            value={currentValue}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder="Wpisz pełne, uzupełnione zdanie po angielsku…"
            className="w-full p-4 bg-base-100/90 text-text-hi text-[15px] sm:text-base border border-white/15 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-none transition-all resize-y placeholder:text-content-muted/50"
          />
        </div>
      );
    }

    // Bez banku słów: dokładnie jedna luka, wpisywana bezpośrednio w zdaniu.
    if (!hasBank) {
      const currentValue = typeof answer === 'string' ? answer : '';
      return (
        <div className="space-y-4">
          <p lang="en" className="prose-justified text-lg sm:text-xl font-bold text-text-hi leading-relaxed">
            {segments.map((segment, index) =>
              segment.kind === 'text' ? (
                <span key={index}>{segment.text}</span>
              ) : (
                <input
                  key={index}
                  type="text"
                  value={currentValue}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="…"
                  className="inline-block min-w-[6rem] mx-1 px-2 py-1 align-middle bg-base-100/90 text-primary text-lg sm:text-xl font-bold border-b-2 border-primary/50 focus:border-primary focus:outline-none"
                />
              )
            )}
          </p>
        </div>
      );
    }

    // Z bankiem słów: luki jako kafelki, wypełniane dotknięciem słowa z banku.
    const blanks: Record<string, string> = answer && typeof answer === 'object' ? answer : {};
    const usedWords = Object.values(blanks);
    const gapIds = segments.filter((s): s is Extract<ExerciseSegment, { kind: 'gap' }> => s.kind === 'gap').map((s) => s.gapId);

    const fillFirstEmpty = (word: string) => {
      const target = gapIds.find((id) => !blanks[id]);
      if (target) onChange({ ...blanks, [target]: word });
    };

    return (
      <div className="space-y-4">
        {/* Treść ćwiczenia jest angielska, a strona deklaruje polski. Bez tego
            przeglądarka dzieliłaby angielskie słowa według polskich wzorców. */}
        <p lang="en" className="prose-justified text-[15px] text-content leading-loose">
          {segments.map((segment, index) => {
            if (segment.kind === 'text') return <span key={index}>{segment.text}</span>;
            const filled = blanks[segment.gapId];
            return (
              <button
                key={index}
                onClick={() => {
                  if (!filled) return;
                  const next = { ...blanks };
                  delete next[segment.gapId];
                  onChange(next);
                }}
                className={`inline-flex items-center justify-center min-h-[2.25rem] min-w-[5rem] px-2.5 mx-0.5 align-middle rounded-lg border text-[14px] font-semibold ${
                  filled
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'border-dashed border-white/30 text-content-muted'
                }`}
              >
                {filled || '???'}
              </button>
            );
          })}
        </p>

        <div className="flex flex-wrap gap-2">
          {availableWords.map((word, index) => {
            const used = usedWords.includes(word);
            return (
              <button
                key={`${word}-${index}`}
                disabled={used}
                onClick={() => fillFirstEmpty(word)}
                className={`${chipBase} ${
                  used
                    ? 'bg-base-100/30 border-white/5 text-content-muted/40'
                    : 'bg-base-100/60 border-white/15 text-content'
                }`}
              >
                {word}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (exercise.type === 'find_errors') {
    const incorrect = exercise.incorrectSentence || '';
    const currentValue = typeof answer === 'string' ? answer : '';
    const hintText = exercise.hint || null;
    const meaningText = exercise.meaning || null;

    return (
      <div className="space-y-4">
        {/* Nagłówek typu z odznaką i wskazówką */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-base-200 border border-line-strong text-content-muted text-xs font-bold uppercase tracking-wider">
            <AlertCircle size={13} className="shrink-0 text-content-muted" />
            {i18n.t('Popraw zdanie')}
          </span>

          {hintText && (
            <button
              type="button"
              onClick={() => setShowHint((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                showHint
                  ? 'bg-primary/15 border-primary/40 text-primary shadow-sm'
                  : 'bg-base-200 border-line-strong text-content-muted hover:text-content'
              }`}
            >
              <Lightbulb size={13} className={showHint ? 'text-primary fill-primary/30' : 'text-content-muted'} />
              <span>{showHint ? 'Ukryj wskazówkę' : 'Wskazówka'}</span>
            </button>
          )}
        </div>

        {/* Zdanie z błędem w wyeksponowanej karcie */}
        <div className="p-4 sm:p-5 rounded-2xl bg-base-100/70 border border-white/10 space-y-2.5 shadow-inner">
          <span className="text-[11px] font-mono uppercase tracking-wider text-content-muted font-bold block">
            Zdanie z błędem do poprawy:
          </span>
          <p className="text-lg sm:text-xl font-bold text-text-hi leading-relaxed">
            {incorrect}
          </p>
          {meaningText && (
            <p className="text-xs text-content-muted pt-2 border-t border-white/10 flex items-center gap-1.5">
              <span className="font-semibold text-content">Znaczenie:</span>
              <span className="italic">{meaningText}</span>
            </p>
          )}
        </div>

        {/* Rozwijana wskazówka */}
        {showHint && hintText && (
          <div className="p-3.5 rounded-xl bg-base-200 border border-line-strong text-content text-xs sm:text-sm leading-relaxed flex items-start gap-2.5 animate-in fade-in duration-200 shadow-sm">
            <Lightbulb size={16} className="text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-text-hi block text-[11px] uppercase tracking-wider mb-0.5">
                Wskazówka lektora:
              </span>
              <span>{hintText}</span>
            </div>
          </div>
        )}

        {/* Pole odpowiedzi z szybką opcją wstawienia zdania do edycji */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-content-muted">Twoja poprawiona wersja:</label>
            {incorrect && currentValue !== incorrect && (
              <button
                type="button"
                onClick={() => onChange(incorrect)}
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-bold transition-colors cursor-pointer"
                title="Wstaw zdanie z błędem, aby szybko zmienić tylko niepoprawne słowo"
              >
                <Copy size={11} /> Kopiuj zdanie do edycji
              </button>
            )}
          </div>

          <textarea
            value={currentValue}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder="Wpisz w pełni poprawione zdanie po angielsku…"
            className="w-full p-4 bg-base-100/90 text-text-hi text-[15px] sm:text-base border border-white/15 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-none transition-all resize-y placeholder:text-content-muted/50"
          />
        </div>
      </div>
    );
  }

  return <p className="text-sm text-content-muted">Nieobsługiwany typ zadania.</p>;
};

export default HomeworkExercise;
