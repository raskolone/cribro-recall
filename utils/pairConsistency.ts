/**
 * Zgodność polskiego i angielskiego zdania z jednej pary — reguły deterministyczne (bez modelu).
 * Osobny plik bez zależności, żeby mogły z niego korzystać zarówno `exerciseSentenceChecks`
 * (rozgrzewka), jak i `exerciseQuality` (wszystkie typy) bez cyklu importów.
 */

// ---------------------------------------------------------------------------
// Osoba / liczba PL ↔ EN
// ---------------------------------------------------------------------------

export const tokens = (text: string): string[] => (text.toLowerCase().match(/[\p{L}']+/gu) ?? []).map((t) => t.replace(/’/g, "'"));

const POLISH_POSSESSIVE: Array<[RegExp, string[]]> = [
  [/^(mój|moj|moja|moje|moi|moich|mojego|mojej|mojemu|moim|moją|moimi|moją)$/, ['my', 'mine']],
  [/^(twój|twoj|twoja|twoje|twoi|twoich|twojego|twojej|twojemu|twoim|twoją|twoimi)$/, ['your', 'yours']],
  [/^(nasz|nasza|nasze|nasi|naszych|naszego|naszej|naszemu|naszym|naszą|naszymi)$/, ['our', 'ours']],
  [/^(wasz|wasza|wasze|wasi|waszych|waszego|waszej|waszemu|waszym|waszą|waszymi)$/, ['your', 'yours']],
  [/^(jego)$/, ['his', 'its']],
  [/^(jej)$/, ['her', 'hers']],
  [/^(ich)$/, ['their', 'theirs']],
];

const POLISH_SUBJECT: Array<[RegExp, string[]]> = [
  [/^ja$/, ['i']],
  [/^ty$/, ['you']],
  [/^on$/, ['he']],
  [/^ona$/, ['she']],
  [/^ono$/, ['it']],
  [/^my$/, ['we']],
  [/^wy$/, ['you']],
  [/^(oni|one)$/, ['they']],
];

const EN_POSSESSIVES = new Set(['my', 'mine', 'your', 'yours', 'his', 'her', 'hers', 'its', 'our', 'ours', 'their', 'theirs']);
const EN_SUBJECTS = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they']);

const REFLEXIVE_POSSESSIVE = /^(swój|swoja|swoje|swoi|swoich|swojego|swojej|swojemu|swoim|swoją|swoimi)$/;
const STRICT_EN_POSSESSIVES = new Set(['my', 'mine', 'your', 'yours', 'his', 'our', 'ours', 'their', 'theirs']);

const expectedFrom = (plTokens: string[], table: Array<[RegExp, string[]]>): Set<string> => {
  const expected = new Set<string>();
  for (const token of plTokens) {
    for (const [pattern, english] of table) if (pattern.test(token)) english.forEach((e) => expected.add(e));
  }
  return expected;
};

const intersects = (a: Set<string>, b: Set<string>): boolean => [...a].some((x) => b.has(x));

/**
 * Niezgodność osoby między polskim a angielskim zdaniem (moje ↔ your, ona ↔ he).
 * Sprawdza tylko to, co w polskim zdaniu wypowiedziane wprost — polskie zdanie bez zaimka nic nie rozstrzyga.
 */
export const findPersonMismatch = (en: string, pl: string): boolean => {
  const enTokens = tokens(en);
  const plTokens = tokens(pl);

  const wantedPossessive = expectedFrom(plTokens, POLISH_POSSESSIVE);
  const havePossessive = new Set(enTokens.filter((t) => EN_POSSESSIVES.has(t)));
  if (wantedPossessive.size > 0 && havePossessive.size > 0 && !intersects(wantedPossessive, havePossessive)) return true;
  // Angielskie „my … your” przy polskim samym „moje”: druga osoba pojawiła się z nikąd. „her/its” pomijamy
  // (to także zaimki dopełnienia), a polskie „swój” (= his/her/my…) wyłącza tę regułę.
  if (wantedPossessive.size > 0 && !plTokens.some((t) => REFLEXIVE_POSSESSIVE.test(t))) {
    const unmatched = enTokens.some((t) => STRICT_EN_POSSESSIVES.has(t) && !wantedPossessive.has(t));
    if (unmatched) return true;
  }

  const wantedSubject = expectedFrom(plTokens, POLISH_SUBJECT);
  const haveSubject = new Set(enTokens.filter((t) => EN_SUBJECTS.has(t)));
  if (wantedSubject.size > 0 && haveSubject.size > 0 && !intersects(wantedSubject, haveSubject)) return true;

  return false;
};

// ---------------------------------------------------------------------------
// Znane kalki (siatka deterministyczna — resztę łapie sędzia)
// ---------------------------------------------------------------------------

const POLISH_CALQUES: RegExp[] = [
  /,\s*co (jest|było|będzie)\s+[\p{L}]+[.!?…]*$/iu, // „…, co jest świetne.” ← „…, which is great.”
  /\bna (moim|twoim|jego|jej|naszym|waszym|ich) progu\b/iu, // „on your doorstep” słowo w słowo
  /\b(ma|mam|masz|mamy|macie|mają|mieć|miał[\p{L}]*)\s+dobry czas\b/iu, // have a good time
  /\brob[\p{L}]*\s+sens(u|em)?\b/iu, // make sense
  /\bzrob[\p{L}]*\s+decyzj/iu, // make a decision
  /\brob[\p{L}]*\s+pieniąd/iu, // make money
  /\bw moim zdaniu myślę\b/iu,
];

const ENGLISH_ROBOTIC: RegExp[] = [/,\s*which (is|was|will be)\s+(really |very |so )?(great|nice|good|wonderful|amazing|awesome|fantastic)[.!]*$/i];

export const hasKnownCalque = (en: string, pl: string): boolean =>
  POLISH_CALQUES.some((re) => re.test(pl.trim())) || ENGLISH_ROBOTIC.some((re) => re.test(en.trim()));

