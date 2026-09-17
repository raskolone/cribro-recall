/**
 * Wyciąga wyłącznie samo pierwsze imię z ciągu tekstowego,
 * usuwając nazwisko, separatory (spacje, kropki, podkreślenia) oraz znaki specjalne.
 * Np. "Maciej Wyrozumski" -> "Maciej"
 * "Milena.Miksa-Matyjasik" -> "Milena"
 * "anna_nowak" -> "Anna"
 */
export function formatOnlyFirstName(rawName?: string | null): string {
  if (!rawName || typeof rawName !== 'string') return '';
  let trimmed = rawName.trim();
  if (!trimmed) return '';

  // Usunięcie znaków interpunkcyjnych z końców
  trimmed = trimmed.replace(/^[,.\s!:]+|[,.\s!:]+$/g, '');

  // Rozdzielenie po spacji
  if (trimmed.includes(' ')) {
    trimmed = trimmed.split(/\s+/)[0];
  }
  // Rozdzielenie po kropce (np. imie.nazwisko)
  if (trimmed.includes('.')) {
    trimmed = trimmed.split('.')[0];
  }
  // Rozdzielenie po podkreśleniu (np. imie_nazwisko)
  if (trimmed.includes('_')) {
    trimmed = trimmed.split('_')[0];
  }

  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Konwertuje polskie imię w mianowniku na naturalną formę wołacza
 * (np. Anna -> Anno, Maciej -> Macieju, Piotr -> Piotrze, Kasia -> Kasiu).
 * ZAWSZE bierze wyłącznie samo pierwsze imię, bez nazwiska.
 */
export function toPolishVocative(rawName?: string | null): string {
  const name = formatOnlyFirstName(rawName);
  if (!name) return '';

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

/**
 * Konwertuje polskie imię w mianowniku na formę narzędnika (np. do konstrukcji "z kim?"):
 * np. Anna -> Anną, Milena -> Mileną, Kasia -> Kasią, Maciej -> Maciejem, Piotr -> Piotrem,
 * Bartek -> Bartkiem, Paweł -> Pawłem, Michał -> Michałem, Tomasz -> Tomaszem.
 */
export function toPolishInstrumental(rawName?: string | null): string {
  const name = formatOnlyFirstName(rawName);
  if (!name) return '';

  const lower = name.toLowerCase();

  const irregulars: Record<string, string> = {
    'kuba': 'Kubą',
    'kosma': 'Kosmą',
    'barnaba': 'Barnabą',
    'paweł': 'Pawłem',
    'pawel': 'Pawłem',
    'michał': 'Michałem',
    'michal': 'Michałem',
    'piotr': 'Piotrem',
    'kacper': 'Kacprem',
    'aleksander': 'Aleksandrem',
    'bartek': 'Bartkiem',
    'tomek': 'Tomkiem',
    'wojtek': 'Wojtkiem',
    'przemek': 'Przemkiem',
    'jacek': 'Jackiem',
    'marek': 'Markiem',
    'leszek': 'Leszkiem',
    'franciszek': 'Franciszkiem',
    'maciej': 'Maciejem',
    'andrzej': 'Andrzejem',
    'mikołaj': 'Mikołajem',
    'mikolaj': 'Mikołajem',
    'mateusz': 'Mateuszem',
    'tomasz': 'Tomaszem',
    'łukasz': 'Łukaszem',
    'lukasz': 'Łukaszem',
    'grzegorz': 'Grzegorzem',
    'artur': 'Arturem',
    'wiktor': 'Wiktorem',
    'igor': 'Igorem',
    'karol': 'Karolem',
    'kamil': 'Kamilem',
    'adam': 'Adamem',
    'jan': 'Janem',
    'marcin': 'Marcinem',
    'damian': 'Damianem',
    'szymon': 'Szymonem',
    'krzysztof': 'Krzysztofem',
    'jakub': 'Jakubem',
    'robert': 'Robertem',
    'dawid': 'Dawidem',
    'filip': 'Filipem',
  };

  if (irregulars[lower]) {
    return irregulars[lower];
  }

  // Żeńskie na -a -> -ą (np. Milena -> Mileną, Anna -> Anną, Kasia -> Kasią)
  if (lower.endsWith('a')) {
    return name.slice(0, -1) + 'ą';
  }

  // Męskie na -ek -> -kiem (np. Janek -> Jankiem)
  if (lower.endsWith('ek')) {
    return name.slice(0, -2) + 'kiem';
  }

  // Męskie na -k, -g -> -kiem, -giem
  if (lower.endsWith('k') || lower.endsWith('g')) {
    return name + 'iem';
  }

  // Męskie na -j -> -jem (np. Mikołaj -> Mikołajem)
  if (lower.endsWith('j')) {
    return name + 'em';
  }

  // Męskie na spółgłoskę miękką lub stwardniałą: -sz, -cz, -rz, -c, -dz -> -em
  if (/(sz|cz|rz|c|dz)$/.test(lower)) {
    return name + 'em';
  }

  // Domyślna końcówka męska narzędnika: -em
  return name + 'em';
}

/**
 * Czyści powitanie w nagłówku odprawy lektora:
 * 1. Zastępuje pełne imię i nazwisko lektora samym imieniem w wołaczu (np. "Maciej Wyrozumski," -> "Macieju,").
 * 2. Zastępuje imię w mianowniku wołaczem (np. "Maciej," -> "Macieju,").
 * 3. Zastępuje pełne nazwisko kursanta samym imieniem (np. "z Mileną Miksa-Matyjasik" -> "z Mileną").
 */
export function sanitizeBriefingHeadline(
  headline: string,
  teacherName?: string,
  studentName?: string
): string {
  if (!headline || typeof headline !== 'string') return '';
  let cleaned = headline.trim();

  const teacherFirst = formatOnlyFirstName(teacherName || 'Maciej');
  const teacherVocative = toPolishVocative(teacherFirst) || 'Macieju';

  // Wzorce na początku tekstu:
  // "Maciej Wyrozumski," lub "Maciej Wyrozumski:" -> "Macieju,"
  cleaned = cleaned.replace(/^([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)\s+([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+(?:-[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)?)([,:!\s]+)/, (match, first, last, sep) => {
    const voc = toPolishVocative(first);
    return `${voc || teacherVocative}${sep.includes(':') ? ':' : ','} `;
  });

  // Jeśli zaczyna się od samego imienia w mianowniku (np. "Maciej,")
  cleaned = cleaned.replace(/^([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)([,:!\s]+)/, (match, first, sep) => {
    const voc = toPolishVocative(first);
    if (voc && voc !== first) {
      return `${voc}${sep.includes(':') ? ':' : ','} `;
    }
    return match;
  });

  // Wzorzec dla kursanta z nazwiskiem (np. "z Mileną Miksa-Matyjasik" -> "z Mileną")
  // Szukamy fraz "z [Imię z wielkiej] [Nazwisko z wielkiej]"
  cleaned = cleaned.replace(/\b(z|ze|dla|u|od)\s+([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)\s+([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+(?:-[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)?)\b/g, (match, prep, first, surname) => {
    return `${prep} ${first}`;
  });

  return cleaned;
}


