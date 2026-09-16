import { readFileSync, writeFileSync } from 'node:fs';

const isRealEmail = (email) =>
  !!email && email.includes('@') && !email.endsWith('@student.vocabboost.com');

const normalize = (value) =>
  (value || '')
    .toString()
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const splitLevel = (raw) => {
  const profile = (raw || '').trim();
  const match = profile.match(
    /^\s*([ABC][12]\s*\+?(?:\s*\/\s*[ABC][12]\s*\+?)?)/i
  );
  const level = match ? match[1].replace(/\s+/g, '').toUpperCase() : '';
  return { level, profile };
};

const splitName = (full) => {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return { firstName: full.trim(), lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

const tempPassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
};

// Parser logic matching functions/src/notion/parse.ts
const SECTION_MARKERS = [
  { 
    key: 'lessonSummary', 
    needles: ['lekcja w skrócie', 'lekcja w skrocie', 'blok 1', 'podsumowanie lekcji', 'streszczenie lekcji', 'omówienie lekcji', 'omowienie lekcji', 'lesson summary'] 
  },
  { 
    key: 'vocabularyText', 
    needles: ['key language', 'corrections', 'blok 2', 'kluczowe słownictwo', 'kluczowe slownictwo', 'słownictwo', 'slownictwo', 'nowe słownictwo'] 
  },
  { 
    key: 'homework', 
    needles: ['homework', 'cribro habit', 'zadanie domowe', 'zadanie z lekcji', 'blok 3', 'zdania do przetłumaczenia', 'zdania do przetlumaczenia'] 
  },
  { 
    key: 'suggestedFollowUp', 
    needles: ['next lesson', 'kolejna lekcja', 'następna lekcja', 'nastepna lekcja', 'blok 4', 'plany na kolejną lekcję'] 
  },
  {
    key: 'learningCurve',
    needles: ['learning curve', 'student speaking', 'wypowiedzi kursanta', 'o czym mówił kursant', 'o czym mowil kursant', 'dynamika kursanta']
  }
];

const isHeading = (line) => /^#{1,4}\s/.test(line.trim());

const matchSection = (line) => {
  const lowered = line.toLowerCase();
  for (const marker of SECTION_MARKERS) {
    if (marker.needles.some((needle) => lowered.includes(needle))) return marker.key;
  }
  return null;
};

const extractDateFromText = (text) => {
  if (!text) return null;
  const explicitMatch = text.match(
    /(?:data(?:\s+i\s+godzina)?(?:\s+spotkania|\s+lekcji)?\s*[:—–-]\s*)(\d{4}[-/.]\d{2}[-/.]\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{4})/i
  );
  const candidate = explicitMatch ? explicitMatch[1] : null;
  if (candidate) {
    if (/^\d{4}[-/.]\d{2}[-/.]\d{2}$/.test(candidate)) {
      return candidate.replace(/[./]/g, '-');
    }
    const parts = candidate.split(/[./-]/);
    if (parts.length === 3 && parts[2].length === 4) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
  }
  return null;
};

const stripBullet = (line) =>
  line.replace(/^\s*[-*•]\s+/, '').replace(/^\s*\d+[.)]\s+/, '').trim();

const normalizeSeparator = (line) => line.replace(/\s+—\s+/, ' - ');

const subHeading = (line) => {
  const trimmed = line.trim().toLowerCase();
  if (/^nowe\b/.test(trimmed)) return 'vocab';
  if (/^powt[óo]rka\b/.test(trimmed)) return 'vocab';
  if (/^corrections\b/.test(trimmed)) return 'fix';
  if (/^pronunciation\b/.test(trimmed)) return 'fix';
  return null;
};

const splitKeyLanguage = (body) => {
  const vocabulary = [];
  const fixes = [];
  let target = 'vocab';

  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const heading = subHeading(line);
    if (heading) {
      target = heading === 'fix' ? 'fix' : 'vocab';
      if (/^(nowe|powtórka|powtorka|corrections|pronunciation)\b.*:?$/i.test(line)) continue;
    }

    const content = normalizeSeparator(stripBullet(line));
    if (!content) continue;
    (target === 'fix' ? fixes : vocabulary).push(content);
  }

  return {
    vocabulary: vocabulary.join('\n'),
    fixes: fixes.join('\n'),
  };
};

const parseLessonSummary = (rawText) => {
  if (!rawText || !rawText.trim()) {
    return {
      lessonSummary: '',
      vocabularyText: '',
      thingsToImprove: '',
      corrections: '',
      homeworkText: '',
      homeworkAnswerKey: '',
      suggestedFollowUp: '',
      learningCurve: '',
      needsReview: true,
    };
  }

  const sections = {
    lessonSummary: [],
    vocabularyText: [],
    homework: [],
    suggestedFollowUp: [],
    learningCurve: [],
  };

  let currentSection = null;
  const lines = rawText.split('\n');

  for (const line of lines) {
    if (isHeading(line)) {
      const matched = matchSection(line);
      if (matched) {
        currentSection = matched;
        continue;
      }
    }
    if (currentSection) {
      sections[currentSection].push(line);
    }
  }

  const rawSummary = sections.lessonSummary.join('\n').trim();
  const rawKeyLanguage = sections.vocabularyText.join('\n').trim();
  const rawHomework = sections.homework.join('\n').trim();
  const suggestedFollowUp = sections.suggestedFollowUp.join('\n').trim();
  const learningCurve = sections.learningCurve.join('\n').trim();

  const recognizedCount = [
    Boolean(rawSummary),
    Boolean(rawKeyLanguage),
    Boolean(rawHomework),
    Boolean(suggestedFollowUp),
  ].filter(Boolean).length;

  const needsReview = recognizedCount < 2;

  const keyLang = splitKeyLanguage(rawKeyLanguage);
  const homework = splitHomeworkBody(rawHomework);
  const extractedDate = extractDateFromText(rawSummary) || extractDateFromText(rawText);

  return {
    lessonSummary: rawSummary || (needsReview ? rawText.trim() : ''),
    vocabularyText: keyLang.vocabulary,
    thingsToImprove: keyLang.fixes,
    corrections: keyLang.fixes,
    homeworkText: homework.homeworkText,
    homeworkAnswerKey: homework.homeworkAnswerKey,
    suggestedFollowUp,
    learningCurve,
    extractedDate: extractedDate || undefined,
    needsReview,
  };
};

const splitHomeworkBody = (body) => {
  if (!body) return { homeworkText: '', homeworkAnswerKey: '' };
  const lines = body.split('\n');
  const taskLines = [];
  const answerLines = [];
  let isAnswerKey = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(answer key|klucz odpowiedzi|odpowiedzi)\b/i.test(trimmed)) {
      isAnswerKey = true;
      continue;
    }
    if (isAnswerKey) {
      answerLines.push(line);
    } else {
      taskLines.push(line);
    }
  }

  return {
    homeworkText: taskLines.join('\n').trim(),
    homeworkAnswerKey: answerLines.join('\n').trim(),
  };
};

export {
  normalize,
  splitLevel,
  splitName,
  tempPassword,
  parseLessonSummary,
  isRealEmail,
};
