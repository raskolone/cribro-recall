import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { BlueprintChapter, BlueprintTopicMeta, CEFRLevel, IdiomItem } from '../types/blueprints';

interface BookConfig {
  bookNumber: number;
  level: CEFRLevel;
  pdfMatch: string;
  outputFile: string;
}

const BOOKS: BookConfig[] = [
  { bookNumber: 1, level: 'A1', pdfMatch: 'Gramatyka 1', outputFile: 'level_1_a1.json' },
  { bookNumber: 2, level: 'A2', pdfMatch: 'Gramatyka 2', outputFile: 'level_2_a2.json' },
  { bookNumber: 3, level: 'B1', pdfMatch: 'Gramatyka 3', outputFile: 'level_3_b1.json' },
  { bookNumber: 4, level: 'B2', pdfMatch: 'Gramatyka 4', outputFile: 'level_4_b2.json' },
  { bookNumber: 5, level: 'C1', pdfMatch: 'Gramatyka 5', outputFile: 'level_5_c1.json' },
  { bookNumber: 6, level: 'C2', pdfMatch: 'Gramatyka 6', outputFile: 'level_6_c2.json' },
];

function cleanPdfText(raw: string): string {
  let text = raw;
  // Remove recurring headers / footers and page numbering
  text = text.replace(/Angielski w tłumaczeniach\s*[-—–]?\s*Gramatyka\s+\d+\s*\|\s*Zdania i odpowiedzi[\s\t]*\d*/gi, '');
  text = text.replace(/<!--\s*Page \d+ of \d+\s*-->/gi, '');
  text = text.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '');
  text = text.replace(/Lista tematów\s*[—–-]?\s*do skopiowania/gi, '');
  text = text.replace(/Lista tematów do tłumaczenia zdań[\s\t]*\d*/gi, '');
  text = text.replace(/\0/g, ' — ');
  // Normalize consecutive blank lines
  text = text.replace(/[\r\n]{2,}/g, '\n');
  return text;
}

function parseTitle(rawTitle: string): { titleEn: string; titlePl: string } {
  const t = rawTitle.replace(/\s+/g, ' ').trim();
  const parts = t.split(/\s+(?:—|–|-)\s+/);
  if (parts.length >= 2) {
    const en = parts.slice(0, parts.length - 1).join(' — ').trim();
    const pl = parts[parts.length - 1].trim();
    return { titleEn: en, titlePl: pl };
  }
  return { titleEn: t, titlePl: t };
}

function extractSentences(sectionText: string): Map<number, string> {
  const map = new Map<number, string>();
  const lines = sectionText.split(/\r?\n/);
  let currentId: number | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentId !== null && currentLines.length > 0) {
      let full = currentLines[0];
      for (let i = 1; i < currentLines.length; i++) {
        const next = currentLines[i];
        if (!next) continue;
        if (/[a-ząćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻ]$/.test(full) && /^[a-ząćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻ]/.test(next)) {
          // Check for line-break word splitting
          if (
            next.length <= 3 ||
            /[a-ząćęłńóśźż]{1,2}$/.test(full) ||
            /^(t|d|re|ve|ll|m|s|y|c|ć|ę|ą|ie|em|ach|ami|om|owi|ego|emu|nych|nej|nym|owa|owe|owy|ing|ed|ly|tion|ness|ment|ful|less|able|ible)\b/i.test(next)
          ) {
            full += next;
          } else {
            full += ' ' + next;
          }
        } else {
          full += (full.endsWith('-') ? '' : ' ') + next;
        }
      }
      full = full.replace(/\s+/g, ' ').trim();
      if (full.length > 0) {
        map.set(currentId, full);
      }
    }
    currentId = null;
    currentLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(\d+)\.\s*(.*)/);
    if (match) {
      flush();
      currentId = parseInt(match[1], 10);
      if (match[2]) currentLines.push(match[2]);
    } else if (currentId !== null) {
      currentLines.push(line);
    }
  }
  flush();
  return map;
}

function parseIdioms(text: string): IdiomItem[] {
  let cleaned = text.replace(/Idiomy\s+\d+/g, '');
  cleaned = cleaned.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '');
  cleaned = cleaned.replace(/\0/g, ' — ');

  function joinLines(raw: string): string {
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return '';
    let full = lines[0];
    for (let i = 1; i < lines.length; i++) {
      const next = lines[i];
      if (/[a-ząćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻ]$/.test(full) && /^[a-ząćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻ]/.test(next)) {
        if (
          next.length <= 3 ||
          /[a-ząćęłńóśźż]{1,2}$/.test(full) ||
          /^(t|d|re|ve|ll|m|s|y|c|ć|ę|ą|ie|em|ach|ami|om|owi|ego|emu|nych|nej|nym|owa|owe|owy|ing|ed|ly|tion|ness|ment|ful|less|able|ible)\b/i.test(next)
        ) {
          full += next;
        } else {
          full += ' ' + next;
        }
      } else {
        full += (full.endsWith('-') ? '' : ' ') + next;
      }
    }
    return full.replace(/\s+/g, ' ').trim();
  }

  const regex = /(\d+)\.\s*\*\*([^*]+)\*\*\s*(?:—|–|-)\s*([^\n*]+(?:\n[^\n*]+)?)\s*\*([^*]+(?:\n[^*]+)?)\*/g;
  const idioms: IdiomItem[] = [];
  let m;
  while ((m = regex.exec(cleaned)) !== null) {
    const id = parseInt(m[1], 10);
    const idiom = m[2].replace(/\s+/g, ' ').trim();
    const meaningPl = joinLines(m[3]);
    const exampleSentence = joinLines(m[4]);

    idioms.push({
      id,
      idiom,
      meaningPl,
      exampleSentence,
      level: 'A2-B1',
    });
  }

  return idioms;
}

async function main() {
  const sourceDir = path.resolve(process.cwd(), 'scripts/source_pdfs');
  const targetDir1 = path.resolve(process.cwd(), 'data/blueprints');
  const targetDir2 = path.resolve(process.cwd(), 'src/data/blueprints');

  for (const dir of [targetDir1, targetDir2]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  if (!fs.existsSync(sourceDir)) {
    console.error(`Błąd: Folder ${sourceDir} nie istnieje!`);
    process.exit(1);
  }

  const files = fs.readdirSync(sourceDir);
  const allTopicMeta: BlueprintTopicMeta[] = [];

  console.log('='.repeat(70));
  console.log('🚀 ROZPOCZĘCIE PARSOWANIA PODRĘCZNIKÓW GRAMMAR BLUEPRINTS');
  console.log('='.repeat(70));

  for (const book of BOOKS) {
    const pdfFile = files.find(f => f.includes(book.pdfMatch) && f.endsWith('.pdf'));
    if (!pdfFile) {
      console.error(`❌ Nie znaleziono pliku PDF dla tomu ${book.bookNumber} (${book.pdfMatch})`);
      continue;
    }

    const buf = fs.readFileSync(path.join(sourceDir, pdfFile));
    const parser = new PDFParse({ data: buf });
    const parsedPdf = await parser.getText();
    const rawText = parsedPdf.text || '';
    const text = cleanPdfText(rawText);

    // Strip trailing index / table of contents if present at end of book
    const trailingIndexMatch = text.search(/-\s*01\.\s+Useful expressions|Lista tematów/i);
    const mainText = (trailingIndexMatch > 50000) ? text.slice(0, trailingIndexMatch) : text;

    const chapters: BlueprintChapter[] = [];
    let currentPos = 0;
    let totalSentencesInBook = 0;
    let mismatchesInBook = 0;
    const mismatchDetails: string[] = [];

    for (let c = 1; c <= 36; c++) {
      const numStr = String(c).padStart(2, '0');
      // Chapter header regex
      const chPattern = new RegExp(
        `(?:^|\\n)(?:#\\s*|▼\\s*)?${numStr}\\.\\s+([^\\n]+(?:\\n(?![0-9]+\\.)[^\\n]+)?)\\n\\s*(?:#\\s*)?(?:PL|Pytania(?:[\\s-—–]+)polski)`,
        'i'
      );
      const sub = mainText.slice(currentPos);
      const m = sub.match(chPattern);
      if (!m || m.index === undefined) {
        console.error(`  ⚠️ Tom ${book.bookNumber}, Rozdział ${c} (${numStr}) nie został odnaleziony!`);
        break;
      }

      const chStart = currentPos + m.index;
      const plSectionStart = chStart + m[0].length;
      const rawTitle = m[1].replace(/\s+/g, ' ').trim();

      // Find EN section header
      const afterPl = mainText.slice(plSectionStart);
      const enMatch = afterPl.match(/(?:^|\n)\s*(?:#\s*|-?\s*)?(?:EN|Odpowiedzi(?:(?:\s*[-—–]\s*|\s+)angielski)?)\s*(?:\n|$)/i);
      if (!enMatch || enMatch.index === undefined) {
        console.error(`  ⚠️ Tom ${book.bookNumber}, Rozdział ${c}: Brak nagłówka sekcji EN!`);
        break;
      }

      const enSectionHeaderIdx = plSectionStart + enMatch.index;
      const enSectionStart = enSectionHeaderIdx + enMatch[0].length;
      const plText = mainText.slice(plSectionStart, enSectionHeaderIdx);

      // Find start of next chapter (c + 1)
      let nextChStart = mainText.length;
      if (c < 36) {
        const nextNumStr = String(c + 1).padStart(2, '0');
        const nextPattern = new RegExp(
          `(?:^|\\n)(?:#\\s*|▼\\s*)?${nextNumStr}\\.\\s+([^\\n]+(?:\\n(?![0-9]+\\.)[^\\n]+)?)\\n\\s*(?:#\\s*)?(?:PL|Pytania(?:[\\s-—–]+)polski)`,
          'i'
        );
        const afterEn = mainText.slice(enSectionStart);
        const nextM = afterEn.match(nextPattern);
        if (nextM && nextM.index !== undefined) {
          nextChStart = enSectionStart + nextM.index;
        }
      }

      const enText = mainText.slice(enSectionStart, nextChStart);
      const plSentences = extractSentences(plText);
      const enSentences = extractSentences(enText);

      const paired = [];
      const allIds = Array.from(new Set([...plSentences.keys(), ...enSentences.keys()])).sort((x, y) => x - y);

      for (const id of allIds) {
        const polish = plSentences.get(id);
        const english = enSentences.get(id);
        if (polish && english) {
          paired.push({ id, polish, english });
        } else {
          mismatchesInBook++;
          mismatchDetails.push(`Rozdział ${c}, zdanie ${id}: PL=${!!polish}, EN=${!!english}`);
        }
      }

      const { titleEn, titlePl } = parseTitle(rawTitle);
      const chId = `g${book.bookNumber}_ch${String(c).padStart(2, '0')}_${titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;

      chapters.push({
        id: chId,
        bookNumber: book.bookNumber,
        chapterNumber: c,
        level: book.level,
        titlePl,
        titleEn,
        sentences: paired,
      });

      allTopicMeta.push({
        id: chId,
        bookNumber: book.bookNumber,
        chapterNumber: c,
        level: book.level,
        titlePl,
        titleEn,
        totalSentences: paired.length,
      });

      totalSentencesInBook += paired.length;
      currentPos = nextChStart;
    }

    // Save level JSON to both target dirs
    const jsonContent = JSON.stringify(chapters, null, 2);
    fs.writeFileSync(path.join(targetDir1, book.outputFile), jsonContent, 'utf-8');
    fs.writeFileSync(path.join(targetDir2, book.outputFile), jsonContent, 'utf-8');

    console.log(`\n📘 Tom ${book.bookNumber} (${book.level}):`);
    console.log(`   - Rozdziałów: ${chapters.length}/36`);
    console.log(`   - Sparowanych zdań: ${totalSentencesInBook}`);
    console.log(`   - Braków w parowaniu: ${mismatchesInBook}`);
    if (mismatchDetails.length > 0) {
      console.log(`   - Szczegóły braków:`);
      mismatchDetails.forEach(d => console.log(`     * ${d}`));
    }
  }

  // Parse Idiomy.pdf
  const idiomsFile = files.find(f => f.includes('Idiomy') && f.endsWith('.pdf'));
  let idiomsList: IdiomItem[] = [];
  if (idiomsFile) {
    const buf = fs.readFileSync(path.join(sourceDir, idiomsFile));
    const parser = new PDFParse({ data: buf });
    const parsedPdf = await parser.getText();
    idiomsList = parseIdioms(parsedPdf.text || '');

    const idiomsJson = JSON.stringify(idiomsList, null, 2);
    fs.writeFileSync(path.join(targetDir1, 'idioms.json'), idiomsJson, 'utf-8');
    fs.writeFileSync(path.join(targetDir2, 'idioms.json'), idiomsJson, 'utf-8');

    console.log(`\n📙 Idiomy (Idiomy.pdf):`);
    console.log(`   - Sparowanych idiomów: ${idiomsList.length}`);
  }

  // Save index.json
  const indexJson = JSON.stringify(allTopicMeta, null, 2);
  fs.writeFileSync(path.join(targetDir1, 'index.json'), indexJson, 'utf-8');
  fs.writeFileSync(path.join(targetDir2, 'index.json'), indexJson, 'utf-8');

  console.log(`\n📋 Indeks tematów (index.json):`);
  console.log(`   - Łączna liczba tematów w indeksie: ${allTopicMeta.length}`);
  console.log('='.repeat(70));
  console.log('✅ PROCES EKSTRAKCJI I ZAPISU ZAKOŃCZONY POMYŚLNIE');
  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('Błąd krytyczny:', err);
  process.exit(1);
});
