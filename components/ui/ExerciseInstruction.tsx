import React from 'react';
import i18n from 'i18next';
import { EXERCISE_INSTRUCTION_KEYS, type InstructionType } from '../../utils/exerciseInstruction';

/**
 * Osobna, wyraźna etykieta polecenia nad treścią zadania. Tekst z i18n (utils/exerciseInstruction.ts),
 * wyśrodkowany, półgruby, kolor z tokenu text-hi na surface-flat (kontrast AA w obu motywach).
 * Statyczny, subtelny neon w kolorze akcentu (.exercise-instruction w index.css, tokeny motywu,
 * bez animacji) to ozdoba — polecenie niesie sam tekst.
 */
const ExerciseInstruction: React.FC<{ type: InstructionType; icon?: React.ReactNode; className?: string }> = ({ type, icon, className }) => (
  <p
    data-testid="exercise-instruction"
    data-instruction-type={type}
    className={`exercise-instruction flex items-center justify-center gap-2.5 rounded-xl bg-surface-flat px-4 py-3 text-center text-lg sm:text-xl font-semibold leading-snug text-text-hi ${className ?? ''}`}
  >
    {icon && <span aria-hidden="true" className="shrink-0 text-primary">{icon}</span>}
    <span>{i18n.t(EXERCISE_INSTRUCTION_KEYS[type])}</span>
  </p>
);

export default ExerciseInstruction;
