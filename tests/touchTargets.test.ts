import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// Pliki kursanta, w których dodawano warianty `pointer-coarse:`. Test pilnuje dwóch rzeczy:
// (1) klasa trafiła do `className`, a nie na zewnątrz (JSX przyjmuje `pointer-coarse:min-h-11`
//     jako atrybut z przestrzenią nazw i `tsc` tego nie zgłasza — raz to się już zdarzyło),
// (2) znane małe cele mają wariant na dotyk.
const FILES = [
  'components/ui/TopBar.tsx',
  'components/ui/BugReporter.tsx',
  'components/ui/Button.tsx',
  'components/ui/PronunciationMic.tsx',
  'components/dashboard/TodayScreen.tsx',
  'components/dashboard/StudentHomeworkScreen.tsx',
  'components/dashboard/StudentHomeworkPanelSection.tsx',
  'components/dashboard/DirectHomeworkScreen.tsx',
  'components/dashboard/HomeworkWarmupScrambler.tsx',
  'components/dashboard/HomeworkWarmupCards.tsx',
  'components/flashcards/FlashcardStudyScreen.tsx',
  'components/flashcards/FlashcardSetsScreen.tsx',
  'components/flashcards/PronunciationButtons.tsx',
  'components/practice/FreePracticeScreen.tsx',
];

test('warianty pointer-coarse: są wewnątrz className, nie jako atrybuty JSX', () => {
  for (const f of FILES) {
    const s = src(f);
    assert.doesNotMatch(s, /["`}]\s+pointer-coarse:[a-z0-9-]+/, `${f}: pointer-coarse poza className`);
    assert.doesNotMatch(s, /\s(pointer-coarse|md|sm|max-md|max-sm):[a-z0-9-]+(?==|>|\s*\n\s*>)/, `${f}: wariant Tailwinda jako atrybut`);
  }
});

test('żaden plik kursanta nie ma atrybutu JSX z przestrzenią nazw (poza svg: xlink/xmlns)', () => {
  // `tsc` akceptuje `<button pointer-coarse:min-h-11>` jako atrybut z przestrzenią nazw — parser go widzi.
  const dirs = ['components/dashboard', 'components/flashcards', 'components/practice', 'components/ui', 'components/auth'];
  for (const d of dirs) {
    for (const name of readdirSync(new URL(`../${d}`, import.meta.url)).filter((n) => n.endsWith('.tsx'))) {
      const text = src(`${d}/${name}`);
      const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const bad: string[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isJsxAttribute(node) && ts.isJsxNamespacedName(node.name)) {
          const ns = node.name.namespace.text;
          if (ns !== 'xlink' && ns !== 'xmlns') bad.push(node.name.getText());
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
      assert.deepEqual(bad, [], `${d}/${name}: atrybuty z przestrzenią nazw`);
    }
  }
});

test('znane małe cele mają wariant na dotyk (min. 44 px)', () => {
  const must: Array<[string, RegExp]> = [
    ['components/ui/TopBar.tsx', /w-10 h-10 rounded-xl border border-line-strong pointer-coarse:w-11 pointer-coarse:h-11/],
    ['components/ui/TopBar.tsx', /flex-1 min-h-9 rounded-lg pointer-coarse:min-h-11/],
    ['components/ui/Button.tsx', /sm: 'px-5 py-2 text-xs pointer-coarse:min-h-11'/],
    ['components/dashboard/TodayScreen.tsx', /h-8 px-2\.5 rounded-lg pointer-coarse:h-11/],
    ['components/dashboard/StudentHomeworkScreen.tsx', /flex-1 min-h-\[2\.5rem\] rounded-lg text-xs font-bold pointer-coarse:min-h-11/],
    ['components/dashboard/HomeworkWarmupScrambler.tsx', /px-3\.5 py-2 rounded-xl border text-base font-bold pointer-coarse:min-h-11 pointer-coarse:min-w-11/],
    ['components/flashcards/FlashcardStudyScreen.tsx', /text-xs px-2 py-1 rounded bg-white\/5 hover:bg-white\/10 text-text-2 pointer-coarse:min-h-11/],
    ['components/flashcards/FlashcardSetsScreen.tsx', /text-sm font-medium pointer-coarse:min-h-11 pointer-coarse:min-w-11/],
    ['components/ui/PronunciationMic.tsx', /pointer-coarse:min-h-11 pointer-coarse:min-w-11/],
  ];
  for (const [f, re] of must) assert.match(src(f), re, `${f}: ${re}`);
});

test('UK/US: strefa kliknięcia ≥ 44 px to niewidoczny ::before tylko na dotyku (wygląd chipa bez zmian)', () => {
  const s = src('components/flashcards/PronunciationButtons.tsx');
  assert.match(s, /pointer-coarse:before:absolute/);
  assert.match(s, /pointer-coarse:before:-inset-y-\[11px\]/);
  assert.match(s, /pointer-coarse:before:content-\[''\]/);
  // chip ma ≥ 24 px wysokości (py-1 + 12 px tekstu + ramka) + 2 × 11 px ≥ 46 px
  assert.match(s, /text-\[12px\] font-bold px-1\.5 py-1/);
});
