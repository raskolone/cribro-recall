import { LessonBlocks, LessonRecord } from '../types';

/**
 * Czyści surowe bloki znaczników markdown (np. ~~~markdown ... ~~~ lub ```markdown ... ```)
 * pozostawiając samą treść w czytelnym formacie.
 */
export function cleanMarkdownArtifacts(text: string): string {
  if (!text) return '';
  return text
    .replace(/^~~~[a-zA-Z]*\s*/gm, '')
    .replace(/^```[a-zA-Z]*\s*/gm, '')
    .replace(/~~~$/gm, '')
    .replace(/```$/gm, '')
    .trim();
}

/**
 * Rozbija tekst z odpowiedziami / zdaniami na czyste punkty.
 */
export function parseNumberedItems(text: string): string[] {
  if (!text) return [];
  const cleaned = cleanMarkdownArtifacts(text);
  const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: string[] = [];

  for (const line of lines) {
    // Rozpoznawanie punktorów lub numeracji: '1.', '1)', '-', '*'
    const stripped = line.replace(/^(\d+[.)]|\*|-|•)\s+/, '').trim();
    if (stripped) {
      items.push(stripped);
    }
  }

  return items.length > 0 ? items : lines;
}

/**
 * Inteligentnie rozbija blok zadania domowego na:
 * 1. Treść zadania / zdania do przetłumaczenia (Blok 1 / Treść)
 * 2. Klucz odpowiedzi (Answer Key / Blok 2)
 */
export function splitHomeworkAndAnswerKey(rawHomework: string): {
  homework: string;
  answerKey?: string;
} {
  if (!rawHomework) return { homework: '' };

  const cleaned = rawHomework.trim();
  
  // Szukamy sekcji Answer Key / Klucz odpowiedzi / Blok 2 — odpowiedzi
  const splitRegex = /(?:\n\s*|\n{2,})(?:#{1,4}\s*)?(?:answer\s*key|klucz\s*odpowiedzi|blok\s*2\s*[-—–]\s*odpowiedzi|odpowiedzi\s*:)/i;
  const match = cleaned.search(splitRegex);

  if (match !== -1) {
    const hwPart = cleaned.slice(0, match).trim();
    const akPart = cleaned.slice(match).trim();

    // Oczyszczamy nagłówek z answer key
    const akCleaned = akPart
      .replace(/^(?:#{1,4}\s*)?(?:answer\s*key|klucz\s*odpowiedzi|blok\s*2\s*[-—–]\s*odpowiedzi|odpowiedzi\s*:)\s*/i, '')
      .trim();

    return {
      homework: cleanMarkdownArtifacts(hwPart),
      answerKey: cleanMarkdownArtifacts(akCleaned),
    };
  }

  return {
    homework: cleanMarkdownArtifacts(cleaned),
  };
}

/**
 * Wykrywa czy dany tekst zawiera strukturę wielu bloków Notion
 * (np. "1. Lekcja w skrócie", "BLOK 1", "2. Key Language", "BLOK 2", "3. Homework", "BLOK 3", "4. Next Lesson", "BLOK 4")
 * i rozbija go na poszczególne bloki.
 */
export function parseNotionMultiBlockText(text: string): Partial<LessonBlocks> | null {
  if (!text || typeof text !== 'string') return null;

  // Sprawdzamy czy tekst zawiera przynajmniej 2 główne znaczniki bloków lekcji Notion
  // Uwaga: Zadanie domowe Notion ma własne pod-bloki: "Blok 1 — zdania do przetłumaczenia" oraz "Blok 2 — odpowiedzi",
  // dlatego Blok 1 i Blok 2 muszą odnosić się ściśle do Lekcji w skrócie i Key Language.
  const hasBlock1 = /(?:(?:blok\s*1\s*[-:—–]?\s*)?lekcja\s*w\s*skr[óo]cie|blok\s*1\s*[-:—–]?\s*streszczenie)/i.test(text);
  const hasBlock2 = /(?:(?:blok\s*2\s*[-:—–]?\s*)?key\s*language|blok\s*2\s*[-:—–]?\s*(?:słownictwo|korekty))/i.test(text);
  const hasBlock3 = /(?:(?:blok\s*3\s*[-:—–]?\s*)?homework|blok\s*3\s*[-:—–]?\s*cribro|zadanie\s*domowe|cribro\s*habit)/i.test(text);
  const hasBlock4 = /(?:(?:blok\s*4\s*[-:—–]?\s*)?next\s*lesson|kolejna\s*lekcja|nast[eę]pna\s*lekcja)/i.test(text);

  const blockCount = [hasBlock1, hasBlock2, hasBlock3, hasBlock4].filter(Boolean).length;
  if (blockCount < 2) {
    return null;
  }

  const lines = text.split('\n');
  const sections: {
    summary: string[];
    keyLanguage: string[];
    homework: string[];
    nextLesson: string[];
    learningCurve: string[];
  } = {
    summary: [],
    keyLanguage: [],
    homework: [],
    nextLesson: [],
    learningCurve: [],
  };

  let currentSection: keyof typeof sections | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Główny Blok 1 (nie mylić z Blok 1 - zdania do przetłumaczenia)
    if (/^(?:#{1,4}\s*)?(?:(?:\d+[.)]\s*)?(?:blok\s*1\s*[-:—–]?\s*)?lekcja\s*w\s*skr[óo]cie|blok\s*1\s*[-:—–]?\s*streszczenie)/i.test(line)) {
      currentSection = 'summary';
      continue;
    }
    // Główny Blok 2 (nie mylić z Blok 2 - odpowiedzi)
    if (/^(?:#{1,4}\s*)?(?:(?:\d+[.)]\s*)?(?:blok\s*2\s*[-:—–]?\s*)?key\s*language|blok\s*2\s*[-:—–]?\s*(?:słownictwo|korekty))/i.test(line)) {
      currentSection = 'keyLanguage';
      continue;
    }
    // Główny Blok 3
    if (/^(?:#{1,4}\s*)?(?:(?:\d+[.)]\s*)?(?:blok\s*3\s*[-:—–]?\s*)?homework|blok\s*3\s*[-:—–]?\s*cribro|zadanie\s*domowe|cribro\s*habit)/i.test(line)) {
      currentSection = 'homework';
      continue;
    }
    // Główny Blok 4
    if (/^(?:#{1,4}\s*)?(?:(?:\d+[.)]\s*)?(?:blok\s*4\s*[-:—–]?\s*)?next\s*lesson|kolejna\s*lekcja|nast[eę]pna\s*lekcja)/i.test(line)) {
      currentSection = 'nextLesson';
      continue;
    }
    // Learning curve
    if (/^(?:#{1,4}\s*)?(?:learning\s*curve|student\s*speaking|o\s*czym\s*m[óo]wi[łl]\s*kursant|wypowiedzi\s*kursanta)/i.test(line)) {
      currentSection = 'learningCurve';
      continue;
    }

    if (currentSection) {
      sections[currentSection].push(rawLine);
    }
  }

  const vocabLines: string[] = [];
  const fixLines: string[] = [];
  let subTarget: 'vocab' | 'fix' = 'vocab';

  for (const rawLine of sections.keyLanguage) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (/^(?:#{1,4}\s*)?(?:nowe|nowe\s*słownictwo|słownictwo|powtórka|powtorka|vocabulary)\b.*:?$/i.test(trimmed)) {
      subTarget = 'vocab';
      continue;
    }
    if (/^(?:#{1,4}\s*)?(?:corrections|korekty|wymowa|pronunciation|błędy|things\s*to\s*improve)\b.*:?$/i.test(trimmed)) {
      subTarget = 'fix';
      continue;
    }

    if (subTarget === 'fix') {
      fixLines.push(rawLine);
    } else {
      if (/^(?:not:|say:|korekta:|błąd:|\*?\s*['"].*['"]\s*->)/i.test(trimmed)) {
        fixLines.push(rawLine);
      } else {
        vocabLines.push(rawLine);
      }
    }
  }

  const hwRaw = sections.homework.join('\n').trim();
  const hwSplit = splitHomeworkAndAnswerKey(hwRaw);

  return {
    summary: cleanMarkdownArtifacts(sections.summary.join('\n').trim()),
    vocabulary: vocabLines.map(l => l.replace(/^\s*[-*•]\s+/, '').replace(/\s+—\s+/, ' - ')).join('\n').trim(),
    corrections: cleanMarkdownArtifacts(fixLines.join('\n').trim()),
    homework: hwSplit.homework,
    answerKey: hwSplit.answerKey,
    nextLesson: cleanMarkdownArtifacts(sections.nextLesson.join('\n').trim()),
    learningCurve: cleanMarkdownArtifacts(sections.learningCurve.join('\n').trim()),
  };
}

/**
 * Ekstrahuje i normalizuje wszystkie bloki lekcji Notion-style z rekordu lekcji.
 * Działa bezbłędnie zarówno dla nowych rekordów z dedykowanymi polami,
 * jak i dla starych wpisów z Notion ze zlanym polem `thingsToImprove` lub wieloblokowym tekstem.
 */
export function extractLessonBlocks(record: Partial<LessonRecord>): LessonBlocks {
  if (!record) {
    return {
      summary: '',
      vocabulary: '',
      corrections: '',
      homework: '',
      answerKey: undefined,
      nextLesson: '',
      learningCurve: '',
    };
  }

  // 1. Jeśli rekord ma już jawnie przypisane structuredBlocks, bierzemy je jako bazę
  if (record.structuredBlocks) {
    return {
      summary: record.structuredBlocks.summary || record.lessonSummary || '',
      vocabulary: record.structuredBlocks.vocabulary || record.vocabularyText || '',
      corrections: record.structuredBlocks.corrections || record.corrections || '',
      homework: record.structuredBlocks.homework || record.homeworkText || '',
      answerKey: record.structuredBlocks.answerKey || record.homeworkAnswerKey,
      nextLesson: record.structuredBlocks.nextLesson || record.nextLessonPlan || record.suggestedFollowUp || '',
      learningCurve: record.structuredBlocks.learningCurve || record.studentSpeaking || '',
    };
  }

  // Sprawdzamy czy w thingsToImprove lub lessonSummary nie ma pełnego wieloblokowego zapisu z Notion
  const fromThings = parseNotionMultiBlockText(record.thingsToImprove || '');
  const fromSummary = parseNotionMultiBlockText(record.lessonSummary || '');
  const multiBlocks = fromThings || fromSummary;

  let summary = record.lessonSummary?.trim() || multiBlocks?.summary || '';
  let vocabulary = record.vocabularyText?.trim() || multiBlocks?.vocabulary || '';
  let learningCurve = record.studentSpeaking?.trim() || multiBlocks?.learningCurve || '';
  let nextLesson = record.nextLessonPlan?.trim() || record.suggestedFollowUp?.trim() || multiBlocks?.nextLesson || '';

  // 2. Obsługa pracy domowej & korekt
  let homework = record.homeworkText?.trim() || multiBlocks?.homework || '';
  let answerKey = record.homeworkAnswerKey?.trim() || multiBlocks?.answerKey;
  let corrections = record.corrections?.trim() || multiBlocks?.corrections || '';

  // Sprawdzamy, czy w thingsToImprove znajduje się zlane zadanie domowe (jeśli nie wyciągnięto z multiBlocks)
  const thingsToImproveRaw = record.thingsToImprove?.trim() || '';

  if (thingsToImproveRaw && !multiBlocks) {
    const hwMarkerRegex = /(?:zadanie\s+z\s+lekcji|zadanie\s+domowe|homework|blok\s*3\s*[-—–]\s*homework)/i;
    const hwMatchIndex = thingsToImproveRaw.search(hwMarkerRegex);

    if (hwMatchIndex !== -1) {
      // Część przed znacznikiem to właściwe błędy / korekty
      const fixesPart = thingsToImproveRaw.slice(0, hwMatchIndex).trim();
      // Część od znacznika to zadanie domowe
      const hwPartRaw = thingsToImproveRaw.slice(hwMatchIndex).trim();

      if (!corrections && fixesPart) {
        corrections = fixesPart;
      }

      if (!homework && hwPartRaw) {
        // Usuwamy ewentualny wstęp "Zadanie z lekcji:"
        const cleanHw = hwPartRaw.replace(/^(?:zadanie\s+z\s+lekcji\s*:?\s*)/i, '').trim();
        const split = splitHomeworkAndAnswerKey(cleanHw);
        homework = split.homework;
        if (split.answerKey && !answerKey) {
          answerKey = split.answerKey;
        }
      }
    } else {
      // Nie znaleziono zadania domowego w thingsToImprove - całość to korekty/uwagi
      if (!corrections) {
        corrections = thingsToImproveRaw;
      }
    }
  }

  // Jeśli zadanie domowe było w suggestedFollowUp
  if (!homework && nextLesson) {
    const hwMarkerRegex = /(?:zadanie\s+domowe|homework|blok\s*3)/i;
    const hwMatchIndex = nextLesson.search(hwMarkerRegex);
    if (hwMatchIndex !== -1) {
      const planPart = nextLesson.slice(0, hwMatchIndex).trim();
      const hwPart = nextLesson.slice(hwMatchIndex).trim();
      nextLesson = planPart;
      const split = splitHomeworkAndAnswerKey(hwPart);
      homework = split.homework;
      if (split.answerKey && !answerKey) {
        answerKey = split.answerKey;
      }
    }
  }

  // Jeśli mamy homework, a nie mamy answerKey, sprawdźmy czy nie ma go w treści homework
  if (homework && !answerKey) {
    const split = splitHomeworkAndAnswerKey(homework);
    homework = split.homework;
    answerKey = split.answerKey;
  }

  return {
    summary: cleanMarkdownArtifacts(summary),
    vocabulary: vocabulary,
    corrections: cleanMarkdownArtifacts(corrections),
    homework: cleanMarkdownArtifacts(homework),
    answerKey: answerKey ? cleanMarkdownArtifacts(answerKey) : undefined,
    nextLesson: cleanMarkdownArtifacts(nextLesson),
    learningCurve: cleanMarkdownArtifacts(learningCurve),
  };
}

/**
 * Sprawdza, czy dany rekord lekcji jest w starym, zanieczyszczonym formacie
 * (np. zadanie domowe sklejone w `thingsToImprove` lub wieloblokowy tekst w jednym polu).
 */
export function isRecordNeedsCleanup(record: LessonRecord): boolean {
  if (record.structuredBlocks) return false;
  if (record.homeworkText && record.vocabularyText && record.lessonSummary) return false;

  const raw = (record.thingsToImprove || '') + ' ' + (record.lessonSummary || '');
  return (
    /(?:zadanie\s+z\s+lekcji|zadanie\s+domowe|~~~markdown|answer\s*key)/i.test(raw) ||
    /blok\s*[1-4]/i.test(raw) ||
    Boolean(parseNotionMultiBlockText(record.thingsToImprove || '')) ||
    Boolean(parseNotionMultiBlockText(record.lessonSummary || ''))
  );
}

/**
 * Przygotowuje obiekt aktualizacji rekordu lekcji do czystego formatu blokowego.
 */
export function migrateRecordToBlocks(record: LessonRecord): Partial<LessonRecord> {
  const blocks = extractLessonBlocks(record);
  return {
    lessonSummary: blocks.summary,
    vocabularyText: blocks.vocabulary,
    corrections: blocks.corrections,
    homeworkText: blocks.homework,
    homeworkAnswerKey: blocks.answerKey || '',
    nextLessonPlan: blocks.nextLesson,
    studentSpeaking: blocks.learningCurve,
    // Zostawiamy czyste thingsToImprove (tylko korekty) dla wstecznej zgodności
    thingsToImprove: blocks.corrections,
    suggestedFollowUp: blocks.nextLesson,
    structuredBlocks: blocks,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Sprawdza, czy data jest poprawna (nie pusta i parsowalna jako data YYYY-MM-DD).
 */
function isValidISODate(dateStr?: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  if (/brak daty|empty|nieznana/i.test(dateStr)) return false;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return false;
  const d = new Date(dateStr);
  return !Number.isNaN(d.getTime());
}

/**
 * Sprawdza, czy lekcja wymaga manualnego zatwierdzenia przez lektora przed publikacją dla kursanta.
 * Wyłapuje:
 * 1. Jawne flagi 'pending_confirmation', isPendingConfirmation === true, isDateMissing === true
 * 2. Lekcje odrzucone ('rejected')
 * 3. Błędne/wybrakowane zapisy z bazy (np. tytuł "brak daty", brakująca lub niepoprawna data spotkania,
 *    bądź puste podsumowanie i słownictwo z importu Notion).
 */
export function isLessonPendingConfirmation(record?: Partial<LessonRecord> | null): boolean {
  if (!record) return false;
  if (record.status === 'pending_confirmation') return true;
  if (record.status === 'rejected') return true;
  if (record.isPendingConfirmation) return true;
  if (record.isDateMissing) return true;
  if (record.pendingReason && record.pendingReason.trim().length > 0) return true;

  // Detekcja wpisów z Notion z wybrakowaną datą spotkania (np. "Podsumowanie lekcji — brak daty — ...")
  if (record.topic && /brak daty/i.test(record.topic)) return true;
  if (record.lessonSummary && /brak daty/i.test(record.lessonSummary)) return true;

  // Sprawdzamy czy data nie jest brakująca lub uszkodzona
  if (!isValidISODate(record.date)) return true;

  // Wpisy z Notion, które nie mają żadnego słownictwa ani podsumowania
  if (record.source === 'notion' && !record.vocabularyText?.trim() && !record.lessonSummary?.trim()) {
    return true;
  }

  /*
   * Lekcja z transkrypcji (Cribro Sift) czeka na lektora, dopóki nie jest
   * domknięta.
   *
   * Transkrypcja przychodzi sama, bez udziału człowieka, i zawiera surowy
   * zapis rozmowy — łącznie z tym, co lektor mówił do siebie, pomyłkami
   * modelu i fragmentami, których kursant widzieć nie powinien. Dopiero
   * wygenerowanie bloków i zatwierdzenie przez lektora (`sessionStatus:
   * 'completed'`) czyni z niej lekcję.
   *
   * Warunek jest osobny od flag `status`/`isPendingConfirmation`, choć punkt
   * odbioru ustawia i je: gdyby kiedyś ktoś zatwierdził lekcję ręcznie,
   * zapomniawszy o `sessionStatus`, ten warunek nadal zatrzyma surowy zapis
   * przed kursantem.
   */
  if (record.source === 'live_transcript' && record.sessionStatus !== 'completed') {
    return true;
  }

  return false;
}

/**
 * Zwraca true tylko wtedy, gdy lekcja jest w pełni zweryfikowana i przeznaczona do wglądu kursanta.
 * Kursant nigdy nie widzi lekcji oczekujących na potwierdzenie, odrzuconych ani wybrakowanych.
 */
export function isStudentVisibleLesson(record?: Partial<LessonRecord> | null): boolean {
  if (!record) return false;
  if (record.status === 'rejected') return false;
  if (isLessonPendingConfirmation(record)) return false;
  return true;
}

/** Data lekcji znormalizowana do `YYYY-MM-DD`, żeby porównywać tylko dzień, nie godzinę/strefę. */
function normalizedLessonDay(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Znajduje wiszące wpisy w statusie „Weryfikacja”, dla których ten sam kursant
 * ma już w tym samym dniu potwierdzoną (widoczną dla kursanta) lekcję —
 * najczęściej zdublowany wpis z importu Notion obok ręcznie uzupełnionego
 * rekordu tej samej lekcji. Zwraca listę wpisów do jednorazowego skasowania,
 * nie usuwa niczego samodzielnie.
 */
export function findDuplicatePendingLessons(lessons: Partial<LessonRecord>[]): Partial<LessonRecord>[] {
  const confirmedDaysByStudent = new Map<string, Set<string>>();

  for (const lesson of lessons) {
    if (!isStudentVisibleLesson(lesson)) continue;
    const day = normalizedLessonDay(lesson.date);
    if (!day) continue;
    const studentIds = lesson.studentId ? [lesson.studentId, ...(lesson.studentIds || [])] : (lesson.studentIds || []);
    for (const sId of studentIds) {
      if (!confirmedDaysByStudent.has(sId)) confirmedDaysByStudent.set(sId, new Set());
      confirmedDaysByStudent.get(sId)!.add(day);
    }
  }

  return lessons.filter((lesson) => {
    if (!isLessonPendingConfirmation(lesson) || lesson.status === 'rejected') return false;
    const day = normalizedLessonDay(lesson.date);
    if (!day) return false;
    const studentIds = lesson.studentId ? [lesson.studentId, ...(lesson.studentIds || [])] : (lesson.studentIds || []);
    return studentIds.some((sId) => confirmedDaysByStudent.get(sId)?.has(day));
  });
}

