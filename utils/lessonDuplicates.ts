import { LessonRecord } from '../types';

/**
 * Wykrywanie zdublowanych lekcji w historii kursanta.
 *
 * ══ SKĄD SIĘ BIORĄ DUPLIKATY ══
 *
 * Import z Notion nadaje każdemu wpisowi nowy identyfikator
 * (`lesson-<czas>-<losowa>`), więc DRUGI import tej samej strony nie nadpisuje
 * pierwszego — dokłada bliźniaka. Wystarczyło raz powtórzyć synchronizację
 * i cała historia kursanta podwoiła się temat po temacie.
 *
 * ══ CO UZNAJEMY ZA DUPLIKAT ══
 *
 * Pewny: TEN SAM TEMAT i TA SAMA DATA. Dwie lekcje o identycznym tytule tego
 * samego dnia to w tej aplikacji zawsze jeden import zrobiony dwa razy —
 * lektor nie prowadzi dwóch takich samych lekcji jednego dnia.
 *
 * Podejrzany: ten sam temat, różne daty, ale NIEMAL IDENTYCZNA treść. To
 * najczęściej import po ręcznej poprawce daty w Notion. Tych NIE kasujemy
 * automatycznie — pokazujemy je lektorowi do decyzji, bo cykliczna powtórka
 * tego samego tematu jest normalną lekcją, a nie pomyłką.
 *
 * ══ KTÓRY WPIS ZOSTAJE ══
 *
 * Najbogatszy: ten, który ma wypełnionych najwięcej bloków i najwięcej treści.
 * Przy remisie — najstarszy (`createdAt`), bo to on jest oryginałem, a jego
 * identyfikator mogą już nosić zestawy słownictwa i prace domowe.
 */

/** Porównywalna postać tematu: bez wielkości liter, ogonków i numeracji. */
export const normalizeTopic = (topic: string | undefined): string =>
  (topic || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    // „12. Temat", „Lekcja 3 — Temat", „Temat (Lekcja 4)" to ten sam temat.
    .replace(/^\s*\d+\s*[.)-]\s*/, '')
    .replace(/^\s*lekcja\s*\d*\s*[:\-–—]?\s*/i, '')
    .replace(/\(\s*lekcja\s*\d+\s*\)/gi, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Data w postaci `RRRR-MM-DD` albo pusty ciąg, gdy nieczytelna. */
export const normalizeDate = (value: string | undefined): string => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).trim();
  return parsed.toISOString().slice(0, 10);
};

/** Ile treści niesie wpis — do wyboru, który z bliźniaków zostaje. */
export const recordWeight = (record: LessonRecord): number => {
  const fields = [
    record.lessonSummary,
    record.vocabularyText,
    record.studentSpeaking,
    record.thingsToImprove,
    record.suggestedFollowUp,
    record.corrections,
    record.homeworkText,
    record.nextLessonPlan,
  ];
  const filled = fields.filter(value => (value || '').trim().length > 0).length;
  const size = fields.reduce((sum, value) => sum + (value || '').trim().length, 0);
  // Liczba wypełnionych bloków waży więcej niż sama objętość: wpis z pięcioma
  // krótkimi blokami jest pełniejszy niż wpis z jednym długim wklejem.
  return filled * 10000 + Math.min(size, 9999);
};

const contentFingerprint = (record: LessonRecord): string =>
  [record.lessonSummary, record.vocabularyText, record.thingsToImprove]
    .map(value => (value || '').replace(/\s+/g, ' ').trim().toLowerCase())
    .join('|')
    .slice(0, 600);

export interface DuplicateGroup {
  /** Znormalizowany temat, po którym zgrupowano wpisy. */
  topic: string;
  /** Wpis do zachowania. */
  keep: LessonRecord;
  /** Wpisy do usunięcia (albo do decyzji, gdy `certain` jest false). */
  remove: LessonRecord[];
  /**
   * `true` — ten sam temat i ta sama data, czyli import zrobiony dwa razy.
   * `false` — ten sam temat, inne daty, niemal identyczna treść: do decyzji.
   */
  certain: boolean;
}

/** Ustawia wpisy chronologicznie: najstarszy pierwszy. */
export const sortChronologically = (records: LessonRecord[]): LessonRecord[] =>
  [...records].sort((a, b) => {
    const left = new Date(a.date || a.createdAt).getTime();
    const right = new Date(b.date || b.createdAt).getTime();
    if (left !== right) return left - right;
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });

const chooseKeeper = (records: LessonRecord[]): LessonRecord =>
  [...records].sort((a, b) => {
    const weightDiff = recordWeight(b) - recordWeight(a);
    if (weightDiff !== 0) return weightDiff;
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  })[0];

/**
 * Grupuje historię kursanta w zestawy duplikatów.
 *
 * Zwraca wyłącznie grupy, w których jest co usuwać — wpis bez bliźniaka nie
 * pojawia się w wyniku wcale.
 */
export const findDuplicateGroups = (records: LessonRecord[]): DuplicateGroup[] => {
  const byTopic = new Map<string, LessonRecord[]>();

  for (const record of records) {
    const topic = normalizeTopic(record.topic);
    // Wpis bez tematu nie daje się porównać po tytule i zostaje w spokoju —
    // kasowanie „po samej dacie" skasowałoby lekcje prowadzone tego samego dnia
    // z różnych powodów.
    if (!topic) continue;
    byTopic.set(topic, [...(byTopic.get(topic) || []), record]);
  }

  const groups: DuplicateGroup[] = [];

  byTopic.forEach((sameTopic, topic) => {
    if (sameTopic.length < 2) return;

    // 1. Pewne duplikaty: ten sam temat i ta sama data.
    const byDate = new Map<string, LessonRecord[]>();
    sameTopic.forEach(record => {
      const key = normalizeDate(record.date || record.createdAt);
      byDate.set(key, [...(byDate.get(key) || []), record]);
    });

    const handled = new Set<string>();

    byDate.forEach(sameDay => {
      if (sameDay.length < 2) return;
      const keep = chooseKeeper(sameDay);
      const remove = sameDay.filter(record => record.id !== keep.id);
      remove.forEach(record => handled.add(record.id));
      handled.add(keep.id);
      groups.push({ topic, keep, remove, certain: true });
    });

    // 2. Podejrzane: ten sam temat, inne daty, niemal ta sama treść.
    const rest = sameTopic.filter(record => !handled.has(record.id));
    if (rest.length < 2) return;

    const byContent = new Map<string, LessonRecord[]>();
    rest.forEach(record => {
      const key = contentFingerprint(record);
      // Pusta treść nie jest dowodem podobieństwa — dwie puste lekcje o tym
      // samym tytule mogą być dwoma prawdziwymi zajęciami bez notatek.
      if (!key.replace(/\|/g, '').trim()) return;
      byContent.set(key, [...(byContent.get(key) || []), record]);
    });

    byContent.forEach(sameContent => {
      if (sameContent.length < 2) return;
      const keep = chooseKeeper(sameContent);
      groups.push({
        topic,
        keep,
        remove: sameContent.filter(record => record.id !== keep.id),
        certain: false,
      });
    });
  });

  return groups.sort((a, b) => a.topic.localeCompare(b.topic, 'pl'));
};

/**
 * Czy taka lekcja już istnieje — używane PRZED zapisem nowego wpisu, żeby
 * powtórzony import nie dokładał bliźniaka.
 */
export const findExistingDuplicate = (
  existing: LessonRecord[],
  candidate: { topic?: string; date?: string }
): LessonRecord | null => {
  const topic = normalizeTopic(candidate.topic);
  if (!topic) return null;
  const date = normalizeDate(candidate.date);
  return (
    existing.find(
      record =>
        normalizeTopic(record.topic) === topic &&
        normalizeDate(record.date || record.createdAt) === date
    ) || null
  );
};
