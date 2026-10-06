/**
 * Ocena odpowiedzi z linku bez logowania (`POST /api/homework/direct-submit`).
 *
 * Wydzielone z `server.ts`, żeby dało się to przetestować bez Firestore.
 * Zachowanie typów, które już działały, jest bez zmian; nowość to wyłącznie
 * to, że wynik nigdy nie zawiera `undefined` — Firestore Admin SDK odrzuca
 * taką wartość w `update()` całym błędem 500 (patrz `stripUndefinedDeep`).
 */

export interface DirectHomeworkRow {
  polishSentence: string;
  correctTranslation: string;
  studentAnswer: any;
  isCorrect: boolean;
  score: number;
  explanation?: string;
}

export interface DirectHomeworkEvaluation {
  rows: DirectHomeworkRow[];
  storedAnswers: Record<number, any>;
  averageScore: number;
}

/**
 * Kopia wartości bez kluczy z `undefined` (obiekty i tablice, rekurencyjnie).
 *
 * Elementy tablic `undefined` zamieniane są na `null`, bo usunięcie ich
 * przesunęłoby indeksy odpowiedzi. Daty i inne obiekty niebędące zwykłymi
 * obiektami zostają bez zmian.
 */
export const stripUndefinedDeep = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((v) => (v === undefined ? null : stripUndefinedDeep(v))) as unknown as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      if (v === undefined) continue;
      out[k] = stripUndefinedDeep(v);
    }
    return out as T;
  }
  return value;
};

const normalizeSimple = (str: any): string =>
  String(str || '')
    .toLowerCase()
    .replace(/[.,!?;:"„”]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

export const evaluateDirectHomework = (
  items: any[],
  answers: Record<string | number, any>,
  taskType?: string
): DirectHomeworkEvaluation => {
  const rows: DirectHomeworkRow[] = [];
  const storedAnswers: Record<number, any> = {};

  items.forEach((item: any, i: number) => {
    const itemType = item.type || taskType || 'translation';
    const rawAns = answers[i];
    storedAnswers[i] = rawAns;

    let isCorrect = false;
    let score = 0;
    let expectedStr = item.englishTranslation || item.correctSentence || '';
    let studentStr = '';

    if (itemType === 'word_order') {
      // chunks order
      if (Array.isArray(rawAns)) {
        studentStr = rawAns.map((idx: number) => item.chunks?.[idx]).filter(Boolean).join(' ');
      } else {
        studentStr = String(rawAns || '');
      }
      if (normalizeSimple(studentStr) === normalizeSimple(expectedStr)) {
        isCorrect = true;
        score = 100;
      }
    } else if (itemType === 'multiple_choice') {
      studentStr = typeof rawAns === 'number' ? item.options?.[rawAns] || '' : String(rawAns || '');
      const expectedOption = typeof item.correctOptionIndex === 'number' ? item.options?.[item.correctOptionIndex] : (item.options?.[0] || '');
      expectedStr = expectedOption;
      if (rawAns === item.correctOptionIndex || normalizeSimple(studentStr) === normalizeSimple(expectedOption)) {
        isCorrect = true;
        score = 100;
      }
    } else if (itemType === 'fill_in_the_blank') {
      const blanksObj = typeof rawAns === 'object' && rawAns !== null ? rawAns : {};
      studentStr = Object.keys(blanksObj).sort().map(k => `${k}: ${blanksObj[k]}`).join(', ');

      const totalBlanks = item.blanks?.length || 1;
      let correctBlanks = 0;
      if (item.blanks && Array.isArray(item.blanks)) {
        item.blanks.forEach((b: any) => {
          const expectedVal = normalizeSimple(b.correctAnswer || b.word || b.answer || '');
          const userVal = normalizeSimple(blanksObj[b.id] || blanksObj[`BLANK_${b.id}`] || '');
          if (expectedVal && userVal && (expectedVal === userVal || userVal.includes(expectedVal))) {
            correctBlanks++;
          }
        });
      }
      score = Math.round((correctBlanks / totalBlanks) * 100);
      isCorrect = score >= 80;
    } else if (itemType === 'find_errors') {
      studentStr = String(rawAns || '').trim();
      expectedStr = item.correctSentence || '';
      if (normalizeSimple(studentStr) === normalizeSimple(expectedStr)) {
        isCorrect = true;
        score = 100;
      } else if (normalizeSimple(studentStr).length > 5) {
        score = 70;
        isCorrect = true;
      }
    } else if (itemType === 'matching') {
      const matched: string[] = Array.isArray(rawAns) ? rawAns : [];
      const pairs: Array<{ id: string; left: string; right: string }> = Array.isArray(item.pairs) ? item.pairs : [];
      studentStr = matched
        .map((id: string) => pairs.find((p) => p.id === id))
        .filter(Boolean)
        .map((p: any) => `${p.left} = ${p.right}`)
        .join(', ');
      expectedStr = pairs.map((p) => `${p.left} = ${p.right}`).join(', ');
      score = pairs.length > 0 ? Math.round((matched.length / pairs.length) * 100) : 0;
      isCorrect = score === 100;
    } else {
      // translation
      studentStr = String(rawAns || '').trim();
      expectedStr = item.englishTranslation || '';
      if (normalizeSimple(studentStr) === normalizeSimple(expectedStr)) {
        isCorrect = true;
        score = 100;
      } else if (normalizeSimple(studentStr).length > 3) {
        score = 75; // wstępna punktacja, lektor zweryfikuje niuanse
        isCorrect = true;
      }
    }

    rows.push({
      polishSentence: item.polishSentence || item.prompt || '',
      correctTranslation: expectedStr,
      studentAnswer: studentStr || rawAns,
      isCorrect,
      score,
      ...(item.explanation ? { explanation: item.explanation } : {}),
    });
  });

  const averageScore = rows.length > 0
    ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length)
    : 0;

  return {
    rows: stripUndefinedDeep(rows),
    storedAnswers: stripUndefinedDeep(storedAnswers),
    averageScore,
  };
};
