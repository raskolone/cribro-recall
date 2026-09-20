/**
 * Klasyfikacja próby w rozgrzewce-rozsypance (`HomeworkWarmupScrambler.tsx`).
 *
 * `close` istnieje po to, żeby kursant, który zna słowa ale pomylił szyk, nie
 * utknął w pętli bez wyjścia — patrz AGENT_LOG.md, hotfix P0 rozgrzewki
 * (2026-09-20). Multiset (nie `Set`) jest konieczny, bo zdania homework
 * potrafią mieć powtórzone słowa ("the ... the ...") — `Set` zgubiłby
 * duplikaty i fałszywie uznał brakujący/dodatkowy token za `close`.
 */
export type UnscrambleResult = 'correct' | 'close' | 'incorrect';

/**
 * Ta sama polityka porównania co `normalize()`/`normalizeSimple()` używane
 * już do oceny homework (`StudentHomeworkScreen.tsx`, `server.ts`
 * `/api/homework/direct-submit`) — małe litery, bez interpunkcji, jednolity
 * apostrof. Stosowana per-token, nie na całym zdaniu.
 */
const normalizeToken = (token: string): string =>
  String(token || '')
    .toLowerCase()
    .replace(/[.,!?;:"„”]/g, '')
    .replace(/[’']/g, "'")
    .trim();

const toMultiset = (tokens: string[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return counts;
};

export function classifyUnscrambleAttempt(
  answerTokens: string[],
  targetTokens: string[]
): UnscrambleResult {
  const answer = (answerTokens || []).map(normalizeToken).filter((t) => t.length > 0);
  const target = (targetTokens || []).map(normalizeToken).filter((t) => t.length > 0);

  if (answer.length === target.length && answer.every((t, i) => t === target[i])) {
    return 'correct';
  }

  const answerCounts = toMultiset(answer);
  const targetCounts = toMultiset(target);

  if (answerCounts.size !== targetCounts.size) return 'incorrect';
  for (const [word, count] of targetCounts) {
    if (answerCounts.get(word) !== count) return 'incorrect';
  }
  return 'close';
}
