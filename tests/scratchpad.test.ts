import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getInitialScratchpadContent,
  buildScratchpadUrl,
} from '../services/scratchpadService';
import { formatAccessCode, normalizeAccessCode } from '../utils/accessCode';

test('getInitialScratchpadContent tworzy poprawny szkielet HTML i tekstowy z imieniem kursanta', () => {
  // Struktura zgłoszona 2026-09-12 — pięć sekcji lekcji, które Maciej
  // dotąd wklejał ręcznie w Google Docs przed każdą lekcją.
  const result = getInitialScratchpadContent('Jan Kowalski');

  assert.ok(result.html.includes('Jan Kowalski'));
  assert.ok(result.html.includes('Revision'));
  assert.ok(result.html.includes('Main topic / Practice'));
  assert.ok(result.html.includes('Lesson Summary'));
  assert.ok(result.html.includes('Key Language'));
  assert.ok(result.html.includes('Homework'));

  assert.ok(result.text.includes('Jan Kowalski'));
  assert.ok(result.text.includes('Revision'));
  assert.ok(result.text.includes('Homework'));
});

test('buildScratchpadUrl generuje czytelny URL z sformatowanym kodem PIN', () => {
  const pin = 'ABC123';
  const url = buildScratchpadUrl(pin);

  assert.ok(url.includes('/scratchpad?pin='));
  assert.ok(url.includes('ABC-123') || url.includes('ABC123'));
});

test('normalizacja PINu dla scratchpada pozwala na wpisanie z myślnikiem, spacją i małymi literami', () => {
  const rawInput = '  abc-123  ';
  const normalized = normalizeAccessCode(rawInput);
  assert.equal(normalized, 'AWCJ23'); // B zamienia się na W, a 1 zamienia się na J w alfabecie bez znaków mylących
  assert.equal(formatAccessCode('ACDEF2'), 'ACD-EF2');
});


test('ekstrakcja sekcji ze Scratchpada poprawnie rozdziela słówka i korekty', () => {
  const scratchpadText = `
## Lekcja — 11.09.2026
Temat: Negocjacje biznesowe

### Nowe słownictwo:
- elaborate - rozwijać wypowiedź
- counterpart - partner w negocjacjach

### Poprawki gramatyczne:
- I have gone yesterday -> I went yesterday
- She don't like -> She doesn't like

### Ustalenia:
- Następna lekcja we wtorek o 18:00
  `.trim();

  const lines = scratchpadText.split('\n').map(l => l.trim()).filter(Boolean);
  const vocab: string[] = [];
  const corrections: string[] = [];
  let section: 'vocab' | 'corrections' | 'general' = 'general';

  for (const line of lines) {
    if (/słownictwo|vocabulary/i.test(line)) {
      section = 'vocab';
      continue;
    }
    if (/poprawki|corrections|błędy/i.test(line)) {
      section = 'corrections';
      continue;
    }
    if (/ustalenia|notatki/i.test(line)) {
      section = 'general';
      continue;
    }

    if (section === 'vocab') {
      vocab.push(line.replace(/^[-*•]\s*/, ''));
    } else if (section === 'corrections') {
      corrections.push(line.replace(/^[-*•]\s*/, ''));
    }
  }

  assert.equal(vocab.length, 2);
  assert.ok(vocab[0].includes('elaborate'));
  assert.equal(corrections.length, 2);
  assert.ok(corrections[0].includes('I went yesterday'));
});

test('buildScratchpadUrl generuje unikalny link bezpośredni po ID dokumentu bez wymogu PINu', () => {
  const docId = 'sp_student_456';
  const url = buildScratchpadUrl(docId);

  assert.ok(url.includes('/scratchpad?id=sp_student_456'));
  assert.ok(!url.includes('pin='));
});

test('buildScratchpadUrl pozwala na opcjonalne dołączenie kodu PIN, jeśli lektor tak zdecyduje', () => {
  const docId = 'sp_student_789';
  const pin = 'ACDEF2';
  const url = buildScratchpadUrl(docId, { pin });

  assert.ok(url.includes('id=sp_student_789'));
  assert.ok(url.includes('pin=ACD-EF2'));
});
