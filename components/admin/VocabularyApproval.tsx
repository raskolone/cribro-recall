import React, { useMemo } from 'react';
import { CheckSquare, Square, Info } from 'lucide-react';
import { splitVocabularyLines } from '../../utils/vocabulary';

/**
 * Zatwierdzanie materiału po lekcji.
 *
 * Wklejanie zostaje bez ograniczeń — to jest warstwa nad polem tekstowym,
 * nie zamiast niego. Domyślnie zatwierdzone jest wszystko, żeby zapis lekcji
 * nie zwolnił ani o kliknięcie; nauczyciel tylko odznacza to, czego nie chce
 * w powtórkach.
 *
 * Stan trzymamy jako listę pozycji **odrzuconych**, nie zatwierdzonych. Gdyby
 * było odwrotnie, każda edycja pola tekstowego rozjeżdżałaby listę: dopisana
 * linia nie byłaby na liście zatwierdzonych i po cichu wypadłaby z powtórek.
 * Przy odrzuconych nowa linia jest zatwierdzona z automatu, czyli tak, jak
 * działo się to przed wprowadzeniem tego kroku.
 */

interface VocabularyApprovalProps {
  vocabularyText: string;
  excludedItems: string[];
  onChange: (excluded: string[]) => void;
}

/** Podpowiadany zakres z briefu — sugestia, nie limit. */
const SUGGESTED_MAX = 10;
const SUGGESTED_MIN = 3;

const VocabularyApproval: React.FC<VocabularyApprovalProps> = ({
  vocabularyText,
  excludedItems,
  onChange,
}) => {
  const lines = useMemo(() => splitVocabularyLines(vocabularyText), [vocabularyText]);
  const approvedCount = lines.filter((l) => !excludedItems.includes(l)).length;

  if (lines.length === 0) return null;

  const toggle = (line: string) => {
    onChange(
      excludedItems.includes(line)
        ? excludedItems.filter((l) => l !== line)
        : [...excludedItems, line]
    );
  };

  const hint =
    approvedCount > SUGGESTED_MAX
      ? `Zatwierdzonych ${approvedCount}. Sesja powtórek celuje w ${SUGGESTED_MIN}–${SUGGESTED_MAX} pozycji i 3–7 minut — nadmiar rozciąga ją w czasie.`
      : approvedCount === 0
      ? 'Nic nie jest zatwierdzone — z tej lekcji nie powstaną powtórki.'
      : approvedCount < SUGGESTED_MIN
      ? `Zatwierdzone ${approvedCount}. Sesja powtórek zaczyna się sensownie od ${SUGGESTED_MIN} pozycji.`
      : null;

  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-base-200/40 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-white/10">
        <span className="text-xs font-bold uppercase tracking-wider text-content-muted font-mono">
          Do powtórek: {approvedCount} z {lines.length}
        </span>
        <div className="flex items-center gap-3 text-xs font-bold">
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-primary hover:underline"
          >
            Zatwierdź wszystko
          </button>
          <button
            type="button"
            onClick={() => onChange([...lines])}
            className="text-content-muted hover:underline"
          >
            Odznacz wszystko
          </button>
        </div>
      </div>

      <ul className="max-h-56 overflow-y-auto divide-y divide-white/5">
        {lines.map((line, idx) => {
          const excluded = excludedItems.includes(line);
          return (
            <li key={`${line}-${idx}`}>
              <button
                type="button"
                onClick={() => toggle(line)}
                className={`w-full flex items-start gap-2.5 text-left px-3 py-2 transition-colors hover:bg-white/5 ${
                  excluded ? 'opacity-45' : ''
                }`}
              >
                {excluded ? (
                  <Square size={15} className="text-content-muted mt-0.5 shrink-0" />
                ) : (
                  <CheckSquare size={15} className="text-primary mt-0.5 shrink-0" />
                )}
                <span
                  className={`font-mono text-xs text-content ${excluded ? 'line-through' : ''}`}
                >
                  {line}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {hint && (
        <div className="flex items-start gap-2 px-3 py-2 border-t border-white/10 text-xs text-content-muted">
          <Info size={13} className="mt-0.5 shrink-0 text-warn" />
          <span>{hint}</span>
        </div>
      )}
    </div>
  );
};

export default VocabularyApproval;
