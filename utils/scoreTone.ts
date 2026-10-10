/**
 * Ton wyniku (sukces / ostrzeżenie / błąd) wg udziału zdobytych punktów — wspólny dla
 * podsumowania zdania, plakietek składowych i listy wyników. Tylko prezentacja: punktacja
 * (`breakdown`, `score`) liczy się gdzie indziej i nie jest tu zmieniana.
 *
 * Progi: ≥ 85% sukces, 50–84% ostrzeżenie, < 50% błąd. Kolor NIGDY nie jest jedynym nośnikiem
 * informacji — komponenty dokładają ikonę i wartość liczbową, a tekst idzie tokenem `text-hi`.
 */
export type ScoreTone = 'success' | 'warn' | 'danger';

export const SUCCESS_SHARE = 0.85;
export const WARN_SHARE = 0.5;

/** `share` w przedziale 0–1 (poza przedziałem obcinane); nie-liczba → błąd. */
export function toneForShare(share: number): ScoreTone {
  const value = Number.isFinite(share) ? Math.min(1, Math.max(0, share)) : 0;
  if (value >= SUCCESS_SHARE) return 'success';
  if (value >= WARN_SHARE) return 'warn';
  return 'danger';
}

export function toneForPoints(points: number, max: number): ScoreTone {
  return toneForShare(max > 0 ? points / max : 0);
}

export function toneForPercent(percent: number): ScoreTone {
  return toneForShare(percent / 100);
}

/** Nazwy tokenów motywu dla tonu (sukces = akcent, bo to jedyna „dobra" barwa palety). */
export const TONE_TOKENS: Record<ScoreTone, { color: string; surface: string }> = {
  success: { color: '--color-primary', surface: '--color-surface-flat' },
  warn: { color: '--color-warn', surface: '--color-surface-flat' },
  danger: { color: '--color-danger', surface: '--color-surface-flat' },
};

/** Pełne nazwy klas (Tailwind ich nie zobaczy, gdy będą sklejane): tło, obwódka i ikona tonu. */
export const TONE_CLASSES: Record<ScoreTone, { surface: string; border: string; icon: string; bar: string }> = {
  success: { surface: 'bg-primary/10', border: 'border-primary', icon: 'text-primary', bar: 'border-l-primary' },
  warn: { surface: 'bg-warn/10', border: 'border-warn', icon: 'text-warn', bar: 'border-l-warn' },
  danger: { surface: 'bg-danger/10', border: 'border-danger', icon: 'text-danger', bar: 'border-l-danger' },
};

/** Klucze i18n opisu tonu dla czytników ekranu (kolor to nie jedyny sygnał). */
export const TONE_LABEL_KEYS: Record<ScoreTone, string> = {
  success: 'Bardzo dobrze',
  warn: 'Można poprawić',
  danger: 'Do poprawy',
};
