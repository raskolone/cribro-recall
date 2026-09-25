/**
 * Deterministyczne sprawdzenia zdań z generatora ćwiczeń — bez modelu, bez sieci.
 *
 * Prompt może modelu tylko PROSIĆ („nie powtarzaj", „wstaw błąd"). Ten plik
 * pilnuje, żeby prośba, której model nie posłuchał, nie dotarła do kursanta.
 */

/**
 * Postać zdania do porównań: bez wielkości liter, interpunkcji i nadmiarowych
 * spacji, z ujednoliconymi apostrofami.
 *
 * Różnica wyłącznie w interpunkcji albo wielkiej literze to dla kursanta to
 * samo zdanie — i nie jest błędem do poprawienia. Apostrof zostaje, bo
 * „dont" vs „don't" to już inne słowo.
 */
export const normalizeSentence = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Odsiewa zadania, których zdanie już padło — w tej sesji albo wcześniej
 * w tej samej partii.
 *
 * `keysOf` zwraca wszystkie zdania zadania, po których poznajemy powtórkę
 * (np. angielskie i polskie w tłumaczeniu). Wystarczy, że jedno się pokrywa.
 */
export const filterRepeatedSentences = <T>(
  items: T[],
  used: Iterable<string>,
  keysOf: (item: T) => unknown[]
): T[] => {
  const seen = new Set<string>();
  for (const sentence of used) {
    const key = normalizeSentence(sentence);
    if (key) seen.add(key);
  }

  return items.filter((item) => {
    const keys = keysOf(item).map(normalizeSentence).filter(Boolean);
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
};

/**
 * Blok promptu z listą zdań, których nie wolno powtórzyć.
 *
 * Ostatnie `limit` pozycji — najświeższe są najbardziej prawdopodobnym
 * źródłem powtórki, a cała historia sesji rozdęłaby prompt.
 */
export const buildUsedSentencesBlock = (sentences: string[] | undefined, limit = 60): string => {
  const list = (sentences || []).map((s) => String(s).trim()).filter(Boolean).slice(-limit);
  if (list.length === 0) return '';
  return `\n\n[ZDANIA JUŻ UŻYTE W TEJ SESJI — NIE WOLNO ICH POWTÓRZYĆ ANI LEKKO PRZEFORMUŁOWAĆ]:
${list.map((s) => `- ${s}`).join('\n')}
Każde nowe zdanie musi opisywać INNĄ sytuację niż powyższe.`;
};
