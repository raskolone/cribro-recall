import React from 'react';
import i18n from 'i18next';
import { EXERCISE_INSTRUCTION_KEYS, type InstructionType } from '../../utils/exerciseInstruction';

/**
 * Osobna, wyraźna etykieta polecenia nad treścią zadania. Tekst z i18n (utils/exerciseInstruction.ts),
 * kolory z tokenów (text-hi na surface-flat, obwódka line-strong — kontrast AA w obu motywach),
 * czcionka ≥ 16 px, pogrubiona; akcent po lewej to ozdoba, polecenie niesie sam tekst.
 */
const ExerciseInstruction: React.FC<{ type: InstructionType; icon?: React.ReactNode; className?: string }> = ({ type, icon, className }) => (
  <p
    data-testid="exercise-instruction"
    data-instruction-type={type}
    className={`flex items-center gap-2.5 rounded-xl border-2 border-line-strong border-l-[6px] border-l-primary bg-surface-flat px-3.5 py-2.5 text-base sm:text-lg font-extrabold leading-snug text-text-hi ${className ?? ''}`}
  >
    {icon && <span aria-hidden="true" className="shrink-0 text-primary">{icon}</span>}
    <span>{i18n.t(EXERCISE_INSTRUCTION_KEYS[type])}</span>
  </p>
);

export default ExerciseInstruction;
