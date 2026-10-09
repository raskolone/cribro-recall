import React, { useEffect, useRef } from 'react';
import type { BulkSelectionState } from '../../utils/homeworkBulkDelete';

interface BulkSelectCheckboxProps {
  /** `some` = część dokumentów zestawu/widoku zaznaczona (stan pośredni). */
  state: BulkSelectionState;
  onToggle: () => void;
  /** Nazwa dla czytnika ekranu — co dokładnie zaznacza to pole. */
  label: string;
  className?: string;
  disabled?: boolean;
  /** Widoczny dopisek obok pola, np. liczba dokumentów zestawu. */
  children?: React.ReactNode;
}

/**
 * Pole wyboru trybu „Zaznacz do usunięcia" — jedno dla wierszy, kafelków,
 * całych zestawów grupowych i „Zaznacz wszystko w widoku".
 */
const BulkSelectCheckbox: React.FC<BulkSelectCheckboxProps> = ({
  state,
  onToggle,
  label,
  className = '',
  disabled = false,
  children,
}) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some';
  }, [state]);

  return (
    <label
      className={`inline-flex items-center gap-1.5 select-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={state === 'all'}
        onChange={onToggle}
        disabled={disabled}
        aria-label={label}
        data-testid="bulk-select-checkbox"
        className="w-4 h-4 shrink-0 cursor-pointer accent-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      {children}
    </label>
  );
};

export default BulkSelectCheckbox;
