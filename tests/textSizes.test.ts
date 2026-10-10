import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// Ekrany i komponenty kursanta. Etykiety < 12 px są nieczytelne na telefonie, a pola formularzy
// < 16 px każą iOS Safari przybliżyć stronę po fokusie.
const STUDENT_FILES = [
  'components/dashboard/AIExerciseGeneratorScreen.tsx', 'components/dashboard/StudentHomeworkScreen.tsx',
  'components/dashboard/LessonDetails.tsx', 'components/dashboard/StudentAssignedHomework.tsx',
  'components/dashboard/HomeworkExercise.tsx', 'components/dashboard/DirectHomeworkScreen.tsx',
  'components/dashboard/StudentHomeworkPanelSection.tsx', 'components/dashboard/PracticeSessionsSection.tsx',
  'components/dashboard/HomeworkWarmupScrambler.tsx', 'components/dashboard/HomeworkWarmupCards.tsx',
  'components/dashboard/TodayScreen.tsx', 'components/dashboard/StudentTestsPanelSection.tsx',
  'components/dashboard/StudentLessonHistory.tsx', 'components/dashboard/StudentToolBar.tsx',
  'components/dashboard/StudentHeroAction.tsx', 'components/dashboard/StudentHomeworkGradedModal.tsx',
  'components/flashcards/FlashcardSetsScreen.tsx', 'components/flashcards/FlashcardStudyScreen.tsx',
  'components/flashcards/FlashcardEditScreen.tsx', 'components/flashcards/PronunciationButtons.tsx',
  'components/flashcards/MatchingGame.tsx', 'components/practice/FreePracticeScreen.tsx',
  'components/practice/TranslationExercise.tsx', 'components/ui/TopBar.tsx', 'components/ui/Badge.tsx',
  'components/ui/CoachMarks.tsx', 'components/ui/BugReporter.tsx', 'components/ui/UpdateBanner.tsx',
];

test('etykiety w plikach kursanta mają co najmniej 12 px (bez text-[9px]/[10px]/[11px])', () => {
  for (const f of STUDENT_FILES) assert.doesNotMatch(src(f), /text-\[(?:9|10|11)px\]/, f);
  assert.match(src('design/theme/tokens.css'), /--fs-label:\s+12px;/);
});

test('siatka bezpieczeństwa: na dotyku pola formularzy mają min. 16 px (warstwa base, utilities wygrywają)', () => {
  const css = src('index.css');
  assert.match(css, /@layer base \{\s*@media \(pointer: coarse\) \{[\s\S]*?font-size: max\(16px, 1em\);/);
});

test('żadne pole input/textarea/select z klasą rozmiaru nie ma < 16 px (xs, sm, [9–15px])', () => {
  const SMALL = /(?:^|\s)(?:[a-z-]+:)*text-(?:xs|sm|\[(?:9|1[0-5])px\])(?=\s|$|["'`])/;
  const dirs = ['components/dashboard', 'components/flashcards', 'components/practice', 'components/auth', 'components/ui'];
  const offenders: string[] = [];
  for (const d of dirs) {
    for (const name of readdirSync(new URL(`../${d}`, import.meta.url)).filter((n) => n.endsWith('.tsx'))) {
      // pola lektora (kreatory, panele) są poza zakresem — tylko to, co widzi kursant
      if (/^(Teacher|Homework(Screen|GroupRow|Bulk|TaskList)|Admin|LessonSelectionModal)/.test(name)) continue;
      const text = src(`${d}/${name}`);
      const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        const el = ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node) ? node : null;
        if (el && ['input', 'textarea', 'select'].includes(el.tagName.getText())) {
          const attrs = el.attributes.properties.filter(ts.isJsxAttribute);
          const type = attrs.find((a) => a.name.getText() === 'type')?.initializer;
          const typeVal = type && ts.isStringLiteral(type) ? type.text : '';
          const cls = attrs.find((a) => a.name.getText() === 'className')?.initializer;
          if (!['checkbox', 'radio', 'hidden', 'file', 'range', 'color'].includes(typeVal) && cls && SMALL.test(cls.getText())) {
            offenders.push(`${d}/${name}:${sf.getLineAndCharacterOfPosition(el.getStart(sf)).line + 1}`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
  }
  assert.deepEqual(offenders, []);
});

test('treść ćwiczeń ma 16 px: opcje, klocki, zdanie z luk, kafelki dopasowania, odpowiedzi quizu', () => {
  const ex = src('components/dashboard/HomeworkExercise.tsx');
  assert.doesNotMatch(ex, /text-\[1[45]px\]/);
  assert.match(ex, /rounded-xl border text-left text-base font-semibold/);
  assert.match(src('components/dashboard/HomeworkWarmupScrambler.tsx'), /rounded-xl border text-base font-bold/);
  assert.match(src('components/flashcards/MatchingGame.tsx'), /font-medium text-base md:text-lg/);
  assert.match(src('utils/quizOptionStates.ts'), /min-h-14 px-4 py-3 rounded-2xl border-2 text-base sm:text-lg/);
  assert.match(src('components/dashboard/HomeworkWarmupCards.tsx'), /mt-4 text-base text-content italic/);
  assert.match(src('components/practice/TranslationExercise.tsx'), /rounded-full border text-base font-medium/);
});
