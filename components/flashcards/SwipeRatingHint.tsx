import React from 'react';
import { Check, X } from 'lucide-react';
import i18n from 'i18next';

/**
 * Wskazówka kierunku w trakcie przeciągania karty (lewo = „Nie umiem", prawo = „Umiem").
 * Czysty widok: obie nakładki są zawsze w DOM z `opacity: 0`, a siłą steruje rodzic wprost
 * przez `style.opacity` (`SwipeRatingHintHandle`) — bez renderu Reacta na każdy ruch palca.
 *
 * Sygnał nie opiera się na samym kolorze: ikona + tekst + obwódka. Kolory z tokenów motywu
 * (`danger` / `primary`), tło chipa ma stałe kontrasty AA w obu motywach (patrz test).
 * Nakładka jest dekoracją (`aria-hidden`) — droga dostępna to przyciski „Nie umiem / Umiem".
 */

export interface SwipeRatingHintHandle {
  know: HTMLElement | null;
  dontKnow: HTMLElement | null;
}

export const HINT_CHIP_CLASS =
  'absolute bottom-3 flex items-center gap-1.5 rounded-full border-2 bg-surface-flat px-3 py-1.5 text-sm font-bold uppercase tracking-wide';
// Etykieta w dolnym narożniku PRZECIWNYM do ruchu: karta ucieka w stronę palca i jej krawędź
// po tej stronie wychodzi poza ekran, a przeciwna zostaje widoczna; dół, bo u góry są przyciski wymowy.
export const HINT_KNOW_CLASS = `${HINT_CHIP_CLASS} left-3 border-primary text-primary`;
export const HINT_DONT_KNOW_CLASS = `${HINT_CHIP_CLASS} right-3 border-danger text-danger`;

interface Props {
  knowRef: React.Ref<HTMLDivElement>;
  dontKnowRef: React.Ref<HTMLDivElement>;
}

const SwipeRatingHint: React.FC<Props> = ({ knowRef, dontKnowRef }) => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20" data-testid="swipe-rating-hint">
    <div
      ref={dontKnowRef}
      data-hint="dontKnow"
      style={{ opacity: 0 }}
      className="absolute inset-0 rounded-[var(--r-xl)] border-2 border-danger shadow-[0_0_32px_var(--color-danger)]"
    >
      <div className={HINT_DONT_KNOW_CLASS}>
        <X size={18} strokeWidth={3} />
        {i18n.t('Nie umiem')}
      </div>
    </div>
    <div
      ref={knowRef}
      data-hint="know"
      style={{ opacity: 0 }}
      className="absolute inset-0 rounded-[var(--r-xl)] border-2 border-primary shadow-[0_0_32px_var(--color-primary)]"
    >
      <div className={HINT_KNOW_CLASS}>
        <Check size={18} strokeWidth={3} />
        {i18n.t('Umiem')}
      </div>
    </div>
  </div>
);

export default SwipeRatingHint;
