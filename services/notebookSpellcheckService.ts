import { auth } from '../firebase';

export type SpellcheckIssueType = 'spelling' | 'grammar' | 'awkward';

export interface SpellcheckIssue {
  id: string;
  matchedText: string;
  /** 3-4 słowa otaczające błąd — do jednoznacznego zlokalizowania wystąpienia w tekście. */
  contextSnippet: string;
  suggestion: string;
  type: SpellcheckIssueType;
  shortReason: string;
}

/**
 * Sprawdzenie pisowni/stylu notatnika (PL/EN) przez Gemini Flash.
 *
 * Wysyła sam tekst (nie HTML) — znaczniki tylko myliłyby model, a lokalizacja
 * wystąpienia w dokumencie i tak dzieje się po stronie klienta, przez
 * `contextSnippet` (patrz `useNotebookSpellcheck.ts`).
 */
export async function checkNotebookSpelling(text: string): Promise<SpellcheckIssue[]> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch('/api/notebook/spellcheck', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Nie udało się sprawdzić pisowni.');
  }

  return Array.isArray(data?.issues) ? data.issues : [];
}
