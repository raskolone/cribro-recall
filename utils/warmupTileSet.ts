/**
 * Zestaw kafelków układanki z rozsypki — czysta logika (bez Reacta, bez bazy, bez modelu).
 *
 * NIEZMIENNIK: kafelki ćwiczenia = DOKŁADNIE kawałki poprawnego zdania (multizbiór równy) plus
 * co najwyżej JEDEN dystraktor, a dystraktor jest zniekształceniem jednego z kawałków TEGO
 * SAMEGO zdania. `validateTileSet` sprawdza to przed pokazaniem ćwiczenia; ćwiczenie, które go
 * nie spełnia, się nie pokazuje (nigdy nie „naprawiamy” zestawu innymi kafelkami).
 *
 * Dystraktor powstaje wyłącznie regułami, których wynik jest niegramatyczny w KAŻDYM miejscu
 * zdania („to has”, „would likes”, „a hammocks”). Dzięki temu nie da się z nim ułożyć drugiego
 * poprawnego zdania. Zamiana przyimka albo czasu została świadomie pominięta: „on my balcony” →
 * „in my balcony” albo „We chose” → „We choose” często daje drugie poprawne zdanie, a zasada
 * brzmi: przy wątpliwości odrzuć kandydata (brak dystraktora jest dopuszczalny).
 */
import { MAX_DISTRACTORS, countWords, hashString, isUsableChunking } from './warmupChunks';

const normalizeText = (text: string): string => String(text ?? '').trim().replace(/\s+/g, ' ');

/** Klucz porównania kafelków: wielkość liter i interpunkcja nie odróżniają kafelków. */
export const tileKey = (text: string): string =>
  normalizeText(text).toLowerCase().replace(/[’]/g, "'").replace(/[.,!?;:"„”]/g, '');

export type TileSetFailure =
  | 'chunks_dont_form_sentence'
  | 'missing_tile'
  | 'duplicate_tile'
  | 'foreign_tile'
  | 'too_many_extra_tiles'
  | 'unsafe_distractor';

export type TileSetCheck = { ok: true; distractor: string | null } | { ok: false; reason: TileSetFailure };

/** Czasowniki, po których „to” jest znacznikiem bezokolicznika, a nie przyimkiem (i które nie są rzeczownikami w liczbie mnogiej). */
const BASE_VERBS = new Set([
  'have', 'go', 'see', 'meet', 'buy', 'make', 'take', 'get', 'do', 'find', 'learn', 'speak', 'try',
  'eat', 'drink', 'read', 'write', 'know', 'say', 'tell', 'give', 'come', 'bring', 'choose', 'spend',
  'build', 'finish', 'forget', 'remember', 'decide', 'enjoy', 'send', 'keep', 'feel', 'think', 'buy',
]);
/** Po tych czasownikach modalnych (bez rzeczownikowych odpowiedników jak „will”, „can”) idzie forma podstawowa. */
const SAFE_MODALS = new Set(['would', 'could', 'should']);
const AFTER_MODAL = new Set([...BASE_VERBS, 'like', 'love', 'prefer', 'hate']);

const thirdPerson = (verb: string): string => {
  if (verb === 'have') return 'has';
  if (verb === 'go') return 'goes';
  if (verb === 'do') return 'does';
  if (/(s|sh|ch|x|z|o)$/.test(verb)) return `${verb}es`;
  if (/[^aeiou]y$/.test(verb)) return `${verb.slice(0, -1)}ies`;
  return `${verb}s`;
};

/** Rozbija token na słowo i końcową interpunkcję, żeby po zniekształceniu przecinek/kropka została. */
const splitPunctuation = (token: string): { word: string; tail: string } => {
  const m = /^(.*?)([.,!?;:]*)$/u.exec(token) ?? [token, token, ''];
  return { word: m[1], tail: m[2] };
};

type Rule = (words: string[]) => string[][];

const replaceAt = (words: string[], index: number, replacement: string): string[] => {
  const out = [...words];
  const { tail } = splitPunctuation(words[index]);
  out[index] = `${replacement}${tail}`;
  return out;
};

/** „to have” → „to has”: forma osobowa po znaczniku bezokolicznika jest zawsze błędem. */
const infinitiveRule: Rule = (words) => {
  const out: string[][] = [];
  words.forEach((token, i) => {
    if (i === 0 || splitPunctuation(words[i - 1]).word.toLowerCase() !== 'to') return;
    if (/[.,!?;:]$/.test(words[i - 1])) return;
    const { word } = splitPunctuation(token);
    if (BASE_VERBS.has(word.toLowerCase())) out.push(replaceAt(words, i, thirdPerson(word.toLowerCase())));
  });
  return out;
};

/** „would like” → „would likes”: po would/could/should wymagana jest forma podstawowa. */
const modalRule: Rule = (words) => {
  const out: string[][] = [];
  words.forEach((token, i) => {
    if (i === 0 || !SAFE_MODALS.has(splitPunctuation(words[i - 1]).word.toLowerCase())) return;
    if (/[.,!?;:]$/.test(words[i - 1])) return;
    const { word } = splitPunctuation(token);
    if (AFTER_MODAL.has(word.toLowerCase())) out.push(replaceAt(words, i, thirdPerson(word.toLowerCase())));
  });
  return out;
};

/** „a hammock” → „a hammocks”: l. mnoga po „a/an” jest niegramatyczna; słowa na -s i bardzo krótkie pomijamy. */
const articleRule: Rule = (words) => {
  const out: string[][] = [];
  words.forEach((token, i) => {
    if (i === 0) return;
    const prev = words[i - 1];
    if (!/^(a|an)$/i.test(prev)) return;
    const { word } = splitPunctuation(token);
    // Tylko ostatnie słowo kawałka: rzeczownik, nie przymiotnik („a spacious” → „a spaciouses” byłoby dziwne).
    if (i !== words.length - 1) return;
    if (word.length < 4 || !/^[a-z]+$/i.test(word) || /(s|x|z|y)$/i.test(word)) return;
    const plural = /(sh|ch)$/i.test(word) ? `${word}es` : `${word}s`;
    out.push(replaceAt(words, i, plural));
  });
  return out;
};

const RULES: Rule[] = [infinitiveRule, modalRule, articleRule];

/** Wszystkie bezpieczne zniekształcenia danego kawałka (deterministyczna kolejność reguł). */
export function distortionsOf(chunk: string): string[] {
  const words = normalizeText(chunk).split(' ').filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rule of RULES) {
    for (const candidate of rule(words)) {
      const text = candidate.join(' ');
      if (!seen.has(text)) {
        seen.add(text);
        out.push(text);
      }
    }
  }
  return out;
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/**
 * Dystraktor dla zdania: zniekształcenie JEDNEGO z jego kawałków o podobnej długości do
 * pozostałych kafelków. Wybór deterministyczny (ziarno ze zdania). `null` = brak bezpiecznego
 * kandydata, czyli ćwiczenie idzie bez dystraktora.
 */
export function pickSafeDistractor(chunks: readonly string[], sentence: string): string | null {
  if (MAX_DISTRACTORS < 1 || chunks.length === 0) return null;
  const taken = new Set(chunks.map(tileKey));
  const lengths = chunks.map((c) => normalizeText(c).length);
  const typical = median(lengths);
  const candidates: string[] = [];
  for (const chunk of chunks) {
    for (const candidate of distortionsOf(chunk)) {
      const key = tileKey(candidate);
      if (!key || taken.has(key)) continue;
      // Podobna długość i liczba słów do reszty kafelków (zniekształcenie zmienia 1–2 znaki).
      if (countWords(candidate) !== countWords(chunk)) continue;
      if (Math.abs(candidate.length - typical) > Math.max(6, typical * 0.6)) continue;
      candidates.push(candidate);
    }
  }
  if (candidates.length === 0) return null;
  return candidates[hashString(normalizeText(sentence)) % candidates.length];
}

const countBy = (texts: readonly string[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const key = tileKey(text);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

/**
 * Sprawdza niezmiennik zestawu: `tiles` (to, co zobaczy kursant) = `chunks` (poprawne kawałki)
 * + najwyżej jeden dystraktor będący bezpiecznym zniekształceniem jednego z kawałków.
 */
export function validateTileSet(input: {
  targetSentence: string;
  chunks: readonly string[];
  tiles: readonly string[];
}): TileSetCheck {
  const { targetSentence, chunks, tiles } = input;
  if (!isUsableChunking(chunks, targetSentence)) return { ok: false, reason: 'chunks_dont_form_sentence' };

  const have = countBy(tiles);
  const need = countBy(chunks);
  for (const [key, count] of need) {
    if ((have.get(key) ?? 0) < count) return { ok: false, reason: 'missing_tile' };
  }

  // Nadwyżka kafelków ponad kawałki poprawnej odpowiedzi.
  const extras: string[] = [];
  const remaining = new Map(need);
  for (const tile of tiles) {
    const key = tileKey(tile);
    const left = remaining.get(key) ?? 0;
    if (left > 0) remaining.set(key, left - 1);
    else extras.push(tile);
  }
  if (extras.length === 0) return { ok: true, distractor: null };
  if (extras.length > MAX_DISTRACTORS) return { ok: false, reason: 'too_many_extra_tiles' };

  const extra = extras[0];
  // Kafelek zdublowany (ten sam tekst co kawałek odpowiedzi) ukryłby błąd i dawał drugie „poprawne” ułożenie.
  if (need.has(tileKey(extra))) return { ok: false, reason: 'duplicate_tile' };
  const isSafeDistortion = chunks.some((chunk) => distortionsOf(chunk).some((d) => tileKey(d) === tileKey(extra)));
  return isSafeDistortion ? { ok: true, distractor: extra } : { ok: false, reason: 'foreign_tile' };
}

export interface PromptedRound {
  itemIndex: number;
  sourceLabel?: string;
  targetSentence: string;
}

/**
 * Rundy z TYM SAMYM polskim poleceniem, ale RÓŻNYMI angielskimi zdaniami. Co najmniej jedna para
 * (polecenie, zdanie) jest wtedy rozjechana — a lokalnie nie da się rozstrzygnąć, która. Zwraca
 * `itemIndex` wszystkich rund w takich grupach; wywołujący je pomija (nie zgadujemy).
 */
export function findConflictingPrompts(rounds: readonly PromptedRound[]): Set<number> {
  const groups = new Map<string, PromptedRound[]>();
  for (const round of rounds) {
    const prompt = tileKey(round.sourceLabel ?? '');
    if (!prompt) continue;
    groups.set(prompt, [...(groups.get(prompt) ?? []), round]);
  }
  const conflicting = new Set<number>();
  for (const group of groups.values()) {
    const sentences = new Set(group.map((r) => tileKey(r.targetSentence)));
    if (sentences.size > 1) group.forEach((r) => conflicting.add(r.itemIndex));
  }
  return conflicting;
}
