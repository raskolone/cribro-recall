/**
 * Konwertuje polskie imię w mianowniku na naturalną formę wołacza
 * (np. Anna -> Anno, Maciej -> Macieju, Piotr -> Piotrze, Kasia -> Kasiu).
 */
export function toPolishVocative(rawName?: string | null): string {
  if (!rawName || typeof rawName !== 'string') return '';
  const trimmed = rawName.trim();
  if (!trimmed) return '';

  // Bierzemy tylko pierwsze imię jeśli podano imię i nazwisko
  const name = trimmed.split(/\s+/)[0];

  // Słownik wyjątków i popularnych imion
  const irregulars: Record<string, string> = {
    'anna': 'Anno',
    'marta': 'Marto',
    'kuba': 'Kubo',
    'tomek': 'Tomku',
    'bartek': 'Bartku',
    'wojtek': 'Wojtku',
    'przemek': 'Przemku',
    'kacper': 'Kacprze',
    'piotr': 'Piotrze',
    'paweł': 'Pawle',
    'pawel': 'Pawle',
    'michał': 'Michale',
    'michal': 'Michale',
    'marek': 'Marku',
    'jacek': 'Jacku',
    'leszek': 'Leszku',
    'franciszek': 'Franciszku',
    'aleksander': 'Aleksandrze',
    'artur': 'Arturze',
    'wiktor': 'Wiktorze',
    'igor': 'Igorze',
    'grzegorz': 'Grzegorzu',
    'łukasz': 'Łukaszu',
    'lukasz': 'Łukaszu',
    'mateusz': 'Mateuszu',
    'bartosz': 'Bartoszu',
    'tomasz': 'Tomaszu',
    'janusz': 'Januszu',
    'mariusz': 'Mariuszu',
    'dariusz': 'Dariuszu',
    'arkadiusz': 'Arkadiuszu',
    'tadeusz': 'Tadeuszu',
    'maciej': 'Macieju',
    'andrzej': 'Andrzeju',
    'mikołaj': 'Mikołaju',
    'mikolaj': 'Mikołaju',
    'rafał': 'Rafale',
    'rafal': 'Rafale',
    'karol': 'Karolu',
    'kamil': 'Kamilu',
    'emil': 'Emilu',
    'daniel': 'Danielu',
    'gabriel': 'Gabrielu',
    'adam': 'Adamie',
    'przemysław': 'Przemysławie',
    'przemyslaw': 'Przemysławie',
    'stanisław': 'Stanisławie',
    'stanislaw': 'Stanisławie',
    'radosław': 'Radosławie',
    'radoslaw': 'Radosławie',
    'jarosław': 'Jarosławie',
    'jaroslaw': 'Jarosławie',
    'mirosław': 'Mirosławie',
    'miroslaw': 'Mirosławie',
    'bolesław': 'Bolesławie',
    'władysław': 'Władysławie',
    'wladyslaw': 'Władysławie',
    'jan': 'Janie',
    'marcin': 'Marcinie',
    'damian': 'Damianie',
    'szymon': 'Szymonie',
    'adrian': 'Adrianie',
    'sebastian': 'Sebastianie',
    'krystian': 'Krystianie',
    'fabian': 'Fabianie',
    'julian': 'Julianie',
    'roman': 'Romanie',
    'marian': 'Marianie',
    'szczepan': 'Szczepanie',
    'stefan': 'Stefanie',
    'jakub': 'Jakubie',
    'filip': 'Filipie',
    'krzysztof': 'Krzysztofie',
    'dawid': 'Dawidzie',
    'konrad': 'Konradzie',
    'robert': 'Robercie',
    'hubert': 'Hubercie',
    'norbert': 'Norbercie',
    'albert': 'Albercie',
    'zbigniew': 'Zbigniewie',
    'bogdan': 'Bogdanie',
    'dominik': 'Dominiku',
    'eryk': 'Eryku',
    'patryk': 'Patryku',
    'oskar': 'Oskarze',
    'cezary': 'Cezary',
    'jerzy': 'Jerzy',
    'antoni': 'Antoni',
    'ignacy': 'Ignacy',
    // Żeńskie zdrobnienia
    'kasia': 'Kasiu',
    'basia': 'Basiu',
    'zuzia': 'Zuziu',
    'ania': 'Aniu',
    'marysia': 'Marysiu',
    'gosia': 'Gosiu',
    'zosia': 'Zosiu',
    'madzia': 'Madziu',
    'ola': 'Olu',
    'asia': 'Asiu',
    'aga': 'Agu',
    'ula': 'Ulu',
  };

  const lower = name.toLowerCase();
  if (irregulars[lower]) {
    const res = irregulars[lower];
    return res.charAt(0).toUpperCase() + res.slice(1);
  }

  // Reguły fleksyjne:
  // Imiona żeńskie zakończone na -a
  if (lower.endsWith('a')) {
    // zdrobnienia: -sia, -cia, -zia, -dzia, -nia -> -siu, -ciu, -ziu, -dziu, -niu
    if (/(sia|cia|zia|dzia|nia)$/.test(lower)) {
      return name.slice(0, -1) + 'u';
    }
    // ogólne żeńskie na -a -> -o (np. Karolina -> Karolino, Ewa -> Ewo, Natalia -> Natalio)
    return name.slice(0, -1) + 'o';
  }

  // Męskie na -ek -> -ku (np. Janek -> Janku)
  if (lower.endsWith('ek')) {
    return name.slice(0, -2) + 'ku';
  }

  // Męskie na -ik / -yk -> -iku / -yku
  if (lower.endsWith('ik') || lower.endsWith('yk')) {
    return name + 'u';
  }

  // Męskie na -sz / -cz / -rz -> -u
  if (lower.endsWith('sz') || lower.endsWith('cz') || lower.endsWith('rz')) {
    return name + 'u';
  }

  // Męskie na -ej / -aj -> -eju / -aju
  if (lower.endsWith('ej') || lower.endsWith('aj')) {
    return name + 'u';
  }

  // Męskie na -aw -> -awie
  if (lower.endsWith('aw')) {
    return name + 'ie';
  }

  // Męskie na -an, -on, -in, -en -> -anie, -onie, -inie, -enie
  if (lower.endsWith('an') || lower.endsWith('on') || lower.endsWith('in') || lower.endsWith('en')) {
    return name + 'ie';
  }

  // Męskie na -b, -p -> -bie, -pie
  if (lower.endsWith('b') || lower.endsWith('p')) {
    return name + 'ie';
  }

  // Męskie na -d -> -dzie, -t -> -cie
  if (lower.endsWith('d')) {
    return name.slice(0, -1) + 'dzie';
  }
  if (lower.endsWith('t')) {
    return name.slice(0, -1) + 'cie';
  }

  // Męskie na -m, -w -> -mie, -wie
  if (lower.endsWith('m') || lower.endsWith('w')) {
    return name + 'ie';
  }

  // Męskie na -r -> -rze
  if (lower.endsWith('r')) {
    return name + 'ze';
  }

  // Męskie na -l -> -lu
  if (lower.endsWith('l')) {
    return name + 'u';
  }
  if (lower.endsWith('ł')) {
    return name.slice(0, -1) + 'le';
  }

  return name;
}

/**
 * Zwraca naturalne powitanie z przecinkiem i wykrzyknikiem w wołaczu:
 * np. "Cześć, Anno!" lub "Cześć, Macieju!"
 */
export function formatPolishGreeting(rawName?: string | null): string {
  const vocative = toPolishVocative(rawName);
  if (!vocative) return 'Cześć!';
  return `Cześć, ${vocative}!`;
}

export type GrammaticalGender = 'female' | 'male';

/**
 * Rozpoznaje płeć gramatyczną odbiorcy na podstawie polskiego imienia.
 * W języku polskim niemal wszystkie imiona żeńskie kończą się na literę "a".
 * Wyjątki męskie na "a" (np. Kuba, Kosma, Barnaba) oraz żeńskie bez "a" (np. Miriam, Ines, Nicole)
 * są obsługiwane jawnie.
 */
export function detectPolishGender(rawName?: string | null): GrammaticalGender {
  if (!rawName || typeof rawName !== 'string') return 'male';
  const trimmed = rawName.trim();
  if (!trimmed) return 'male';

  const first = trimmed.split(/\s+/)[0].toLowerCase();
  if (!first) return 'male';

  // Wyjątki: imiona męskie kończące się na -a
  const maleEndingInA = ['kuba', 'kosma', 'barnaba', 'bonawentura', 'jarema', 'zawisza', 'gotfryd'];
  if (maleEndingInA.includes(first)) return 'male';

  // Wyjątki: imiona żeńskie niekończące się na -a
  const femaleNotEndingInA = [
    'miriam',
    'ines',
    'inés',
    'beatrix',
    'karmen',
    'carmen',
    'karen',
    'nicole',
    'rachel',
    'ruth',
    'ester',
    'estera',
    'nel',
    'nela',
  ];
  if (femaleNotEndingInA.includes(first)) return 'female';

  if (first.endsWith('a')) return 'female';
  return 'male';
}

/**
 * Zwraca formę żeńską lub męską w zależności od płci imienia.
 * Np. inflectPolishVerb('Anna', 'znalazłaś', 'znalazłeś') -> 'znalazłaś'
 */
export function inflectPolishVerb(
  rawName: string | undefined | null,
  femaleForm: string,
  maleForm: string
): string {
  const gender = detectPolishGender(rawName);
  return gender === 'female' ? femaleForm : maleForm;
}

/**
 * Pomocnik do doboru formy przymiotnika/zaimka (np. "Gotowa" vs "Gotowy")
 */
export function inflectByGender(
  gender: GrammaticalGender,
  femaleForm: string,
  maleForm: string
): string {
  return gender === 'female' ? femaleForm : maleForm;
}

