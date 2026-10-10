import React from 'react';
import i18n from 'i18next';

export interface SentenceCountSliderProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export const SentenceCountSlider: React.FC<SentenceCountSliderProps> = ({
  value,
  onChange,
  min = 1,
  max = 20,
  disabled = false,
  id = 'sentence-count-slider',
  className = '',
}) => {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));

  const handleDecrement = () => {
    if (disabled || value <= min) return;
    onChange(clamp(value - 1));
  };

  const handleIncrement = () => {
    if (disabled || value >= max) return;
    onChange(clamp(value + 1));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
    const next = Number((e.target as HTMLInputElement).value);
    if (Number.isFinite(next)) {
      onChange(clamp(next));
    }
  };

  const valueLabel = i18n.t('{{count}} zdań', { count: value });

  return (
    <div className={`flex flex-col gap-2 w-full ${className}`}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-semibold text-text-hi">
          {i18n.t('Liczba zdań')}
        </label>
        <span
          className="font-mono text-base font-bold text-primary"
          data-testid="sentence-count-value"
        >
          {valueLabel}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          aria-label={i18n.t('Zmniejsz liczbę zdań')}
          data-testid="sentence-count-decrement"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line-soft bg-surface-elevated text-text-hi font-bold text-xl hover:border-line-strong hover:bg-surface-elevated/80 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary select-none touch-manipulation"
        >
          −
        </button>

        <input
          type="range"
          id={id}
          min={min}
          max={max}
          step={1}
          value={value}
          disabled={disabled}
          aria-label={i18n.t('Liczba zdań')}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={valueLabel}
          onChange={handleChange}
          onInput={handleChange}
          data-testid="sentence-count-slider"
          className="h-11 w-full accent-primary cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 touch-manipulation"
        />

        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          aria-label={i18n.t('Zwiększ liczbę zdań')}
          data-testid="sentence-count-increment"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line-soft bg-surface-elevated text-text-hi font-bold text-xl hover:border-line-strong hover:bg-surface-elevated/80 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary select-none touch-manipulation"
        >
          +
        </button>
      </div>

      <div className="flex justify-between text-xs text-content-muted font-mono px-1">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};

export default SentenceCountSlider;
