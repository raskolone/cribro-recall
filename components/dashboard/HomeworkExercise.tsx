import React, { useState } from 'react';
import { AlertCircle, Check, Copy, HelpCircle, Languages, Lightbulb, RotateCcw, Sparkles } from 'lucide-react';
import { HomeworkType } from '../../types';

/**
 * Jedno ćwiczenie pracy domowej, w czterech odmianach.
 *
 * Trzy z czterech rozwiązuje się samym dotykiem — klawiatura wchodzi tylko przy
 * tłumaczeniu, gdzie nie da się inaczej. To nie jest ozdoba: kursant robi zadanie
 * w tramwaju albo w kolejce, a każde pole tekstowe na telefonie to podniesiona
 * klawiatura, przewijanie i połowa ekranu mniej.
 *
 * Komponent nie ocenia i nie zapisuje — trzyma tylko odpowiedź i oddaje ją wyżej.
 */

export interface HomeworkExerciseProps {
  type: HomeworkType;
  item: any;
  answer: any;
  onChange: (answer: any) => void;
}

const chipBase =
  'min-h-[2.75rem] px-3.5 rounded-xl border text-[15px] font-semibold transition-colors active:scale-[0.97]';

const HomeworkExercise: React.FC<HomeworkExerciseProps> = ({ type, item, answer, onChange }) => {
  const [showHint, setShowHint] = useState(false);

  if (type === 'translation') {
    const polishSentence = item.polishSentence || item.content || item.instruction || '';
    const explicitHint = item.hint || item.hintSmall || item.hintLarge || (Array.isArray(item.requiredMaterial) ? item.requiredMaterial.join(', ') : item.requiredMaterial);
    const targetRef = item.correctTranslation || item.modelAnswer || '';
    const hintText = explicitHint || (item.learningObjective ? `Cel: ${item.learningObjective}` : null) || (targetRef ? `Zacznij od: "${String(targetRef).trim().split(/\s+/).slice(0, 2).join(' ')}…"` : null);

    return (
      <div className="space-y-4">
        {/* Nagłówek zadania tłumaczenia */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold uppercase tracking-wider">
            <Languages size={13} />
            Przetłumacz na angielski
          </span>

          {hintText && (
            <button
              type="button"
              onClick={() => setShowHint((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                showHint
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              <Lightbulb size={13} className={showHint ? 'text-amber-300 fill-amber-300/40' : 'text-amber-400'} />
              <span>{showHint ? 'Ukryj wskazówkę' : 'Wskazówka'}</span>
            </button>
          )}
        </div>

        {/* Zdanie do przetłumaczenia */}
        <div className="p-4 sm:p-5 rounded-2xl bg-base-100/70 border border-white/10 shadow-inner">
          <p className="prose-justified text-lg sm:text-xl font-bold text-white leading-relaxed">
            {polishSentence}
          </p>
        </div>

        {/* Rozwijana wskazówka */}
        {showHint && hintText && (
          <div className="p-3.5 rounded-xl bg-amber-950/25 border border-amber-500/35 text-amber-200 text-xs sm:text-sm leading-relaxed flex items-start gap-2.5 animate-in fade-in duration-200 shadow-sm">
            <Lightbulb size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-300 block text-[11px] uppercase tracking-wider mb-0.5">
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
            <span className="text-[11px] text-content-muted/70">Wpisz całe zdanie po angielsku</span>
          </div>
          <textarea
            value={answer || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder="Wpisz tłumaczenie po angielsku…"
            className="w-full p-4 bg-base-100/90 text-white text-[15px] sm:text-base border border-white/15 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-none transition-all resize-y placeholder:text-content-muted/50"
          />
        </div>
      </div>
    );
  }

  if (type === 'word_order') {
    const chosen: number[] = Array.isArray(answer) ? answer : [];
    const chunks: string[] = item.chunks || [];
    const remaining = chunks.map((_, i) => i).filter((i) => !chosen.includes(i));
    const sourceSentence = item.polishHint || item.sourceSentence || item.prompt || '';

    return (
      <div className="space-y-4">
        {/* Nagłówek: rozróżnia rozsypankę bez tekstu polskiego od tłumaczenia z klocków */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold uppercase tracking-wider">
          <Languages size={13} />
          {sourceSentence ? 'Przetłumacz zdanie:' : 'Ułóż słowa w poprawnej kolejności:'}
        </span>

        {sourceSentence && (
          <div className="p-4 sm:p-5 rounded-2xl bg-base-100/70 border border-white/10 shadow-inner">
            <p className="prose-justified text-lg sm:text-xl font-bold text-white leading-relaxed">
              {sourceSentence}
            </p>
          </div>
        )}

        {/* Ułożone zdanie: dotknięcie fragmentu zdejmuje go z powrotem. */}
        <div className="min-h-[5rem] rounded-xl border border-dashed border-white/20 bg-base-100/40 p-2.5 flex flex-wrap gap-2 items-start">
          {chosen.length === 0 && (
            <span className="text-[13px] text-content-muted px-1 py-2">
              Dotykaj fragmentów poniżej, żeby ułożyć zdanie.
            </span>
          )}
          {chosen.map((chunkIndex, position) => (
            <button
              key={`${chunkIndex}-${position}`}
              onClick={() => onChange(chosen.filter((_, i) => i !== position))}
              className={`${chipBase} bg-primary/15 border-primary/40 text-primary`}
            >
              {chunks[chunkIndex]}
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
              {chunks[chunkIndex]}
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

  if (type === 'multiple_choice') {
    const options: string[] = item.options || [];
    const selected = typeof answer === 'number' ? answer : -1;

    return (
      <div className="space-y-4">
        <p className="prose-justified text-lg font-bold text-white leading-snug">{item.question}</p>
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

  if (type === 'fill_in_the_blank') {
    // Trzy warianty jednego typu, bo generator v2 (`gap_from_context`) nie
    // wysyła `textWithBlanks`/`availableWords` — tylko `content` ze zdaniem
    // i luką oznaczoną jako `___`, uzupełnianą wpisanym słowem, bez banku.
    const hasBlankTokens = /\[BLANK_\d+\]/.test(String(item.textWithBlanks || ''));
    const contentGapMatch = String(item.content || item.text || item.sentence || '').match(/_{3,}/);

    if (!hasBlankTokens && contentGapMatch) {
      const parts = String(item.content || item.text || item.sentence || '').split(/_{3,}/);
      const currentValue = typeof answer === 'string' ? answer : '';
      return (
        <div className="space-y-4">
          <p lang="en" className="prose-justified text-lg sm:text-xl font-bold text-white leading-relaxed">
            {parts[0]}
            <input
              type="text"
              value={currentValue}
              onChange={(e) => onChange(e.target.value)}
              placeholder="…"
              className="inline-block min-w-[6rem] mx-1 px-2 py-1 align-middle bg-base-100/90 text-primary text-lg sm:text-xl font-bold border-b-2 border-primary/50 focus:border-primary focus:outline-none"
            />
            {parts.slice(1).join('___')}
          </p>
        </div>
      );
    }

    if (!hasBlankTokens) {
      // Zabezpieczenie: bez rozpoznanych luk kursant nie może zobaczyć pustego ekranu.
      const fallbackText = String(item.content || item.text || item.sentence || item.instruction || '').trim();
      const currentValue = typeof answer === 'string' ? answer : '';
      return (
        <div className="space-y-4">
          {fallbackText && (
            <div className="p-4 sm:p-5 rounded-2xl bg-base-100/70 border border-white/10 shadow-inner">
              <p lang="en" className="prose-justified text-lg sm:text-xl font-bold text-white leading-relaxed">
                {fallbackText}
              </p>
            </div>
          )}
          <textarea
            value={currentValue}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder="Wpisz pełne, uzupełnione zdanie po angielsku…"
            className="w-full p-4 bg-base-100/90 text-white text-[15px] sm:text-base border border-white/15 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-none transition-all resize-y placeholder:text-content-muted/50"
          />
        </div>
      );
    }

    const blanks: Record<string, string> = answer && typeof answer === 'object' ? answer : {};
    const available: string[] = item.availableWords || [];
    const parts = String(item.textWithBlanks || '').split(/(\[BLANK_\d+\])/g);
    const usedWords = Object.values(blanks);

    const fillFirstEmpty = (word: string) => {
      const blankIds = parts
        .filter((p) => /^\[BLANK_\d+\]$/.test(p))
        .map((p) => p.replace(/[[\]]/g, ''));
      const target = blankIds.find((id) => !blanks[id]);
      if (target) onChange({ ...blanks, [target]: word });
    };

    return (
      <div className="space-y-4">
        {/* Treść ćwiczenia jest angielska, a strona deklaruje polski. Bez tego
            przeglądarka dzieliłaby angielskie słowa według polskich wzorców. */}
        <p lang="en" className="prose-justified text-[15px] text-content leading-loose">
          {parts.map((part, index) => {
            const match = part.match(/^\[BLANK_(\d+)\]$/);
            if (!match) return <span key={index}>{part}</span>;
            const blankId = `BLANK_${match[1]}`;
            const filled = blanks[blankId];
            return (
              <button
                key={index}
                onClick={() => {
                  if (!filled) return;
                  const next = { ...blanks };
                  delete next[blankId];
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
          {available.map((word, index) => {
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

  if (type === 'find_errors') {
    const incorrect = String(item.incorrectSentence || item.content || '').trim();
    const currentValue = typeof answer === 'string' ? answer : '';
    const explicitHint = item.hint || item.hintSmall || item.hintLarge || (Array.isArray(item.requiredMaterial) ? item.requiredMaterial.join(', ') : item.requiredMaterial);
    const hintText = explicitHint || (item.learningObjective ? `Cel ćwiczenia: ${item.learningObjective}` : null);
    // Pokazujemy "Znaczenie" tylko dla realnego tłumaczenia/kontekstu — nie dla instrukcji
    // zadania, bo ta i tak już jest w odznace wyżej ("Znajdź i popraw błąd w zdaniu").
    const genericInstructionLabels = ['znajdź i popraw błąd w zdaniu', 'znajdź błąd w zdaniu i go popraw', 'znajdź błąd', 'popraw błąd w zdaniu'];
    const rawMeaning = item.polishHint || item.meaning || null;
    const meaningText =
      rawMeaning && !genericInstructionLabels.includes(String(rawMeaning).trim().toLowerCase()) ? rawMeaning : null;

    return (
      <div className="space-y-4">
        {/* Nagłówek typu z odznaką i wskazówką */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
            <AlertCircle size={13} className="shrink-0 text-amber-400" />
            Znajdź i popraw błąd w zdaniu
          </span>

          {hintText && (
            <button
              type="button"
              onClick={() => setShowHint((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                showHint
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              <Lightbulb size={13} className={showHint ? 'text-amber-300 fill-amber-300/40' : 'text-amber-400'} />
              <span>{showHint ? 'Ukryj wskazówkę' : 'Wskazówka'}</span>
            </button>
          )}
        </div>

        {/* Zdanie z błędem w wyeksponowanej karcie */}
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-2.5 shadow-sm">
          <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400/90 font-bold block">
            Zdanie z błędem do poprawy:
          </span>
          <p className="text-lg sm:text-xl font-bold text-white leading-relaxed">
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
          <div className="p-3.5 rounded-xl bg-amber-950/25 border border-amber-500/35 text-amber-200 text-xs sm:text-sm leading-relaxed flex items-start gap-2.5 animate-in fade-in duration-200 shadow-sm">
            <Lightbulb size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-300 block text-[11px] uppercase tracking-wider mb-0.5">
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
            className="w-full p-4 bg-base-100/90 text-white text-[15px] sm:text-base border border-white/15 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-none transition-all resize-y placeholder:text-content-muted/50"
          />
        </div>
      </div>
    );
  }

  return <p className="text-sm text-content-muted">Nieobsługiwany typ zadania.</p>;
};

export default HomeworkExercise;
