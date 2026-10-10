import test from 'node:test';
import assert from 'node:assert/strict';
import { AA_NON_TEXT, AA_TEXT, composite, contrastRatio, parseColor, Rgba } from '../utils/contrast';
import { QUIZ_OPTION_STATES, QuizOptionState, quizOptionState } from '../utils/quizOptionStates';
import { THEMES, themeColor, ThemeName } from './helpers/themeColors';

const themes: ThemeName[] = ['dark', 'light'];
const states = Object.keys(QUIZ_OPTION_STATES) as QuizOptionState[];

/** Tło kafelka: powierzchnia + opcjonalna nakładka stanu (krycie składane w sRGB). */
function background(theme: ThemeName, state: QuizOptionState): Rgba {
  const r = QUIZ_OPTION_STATES[state];
  const surface = themeColor(theme, r.surface);
  return r.tint ? composite(themeColor(theme, r.tint.token), surface, r.tint.alpha) : surface;
}

test('kalkulator WCAG: wartości wzorcowe', () => {
  assert.equal(Math.round(contrastRatio(parseColor('#000000'), parseColor('#ffffff'))), 21);
  assert.ok(Math.abs(contrastRatio(parseColor('#777777'), parseColor('#ffffff')) - 4.48) < 0.02);
  assert.deepEqual(parseColor('rgba(255, 255, 255, 0.12)'), { r: 255, g: 255, b: 255, a: 0.12 });
  assert.deepEqual(composite(parseColor('#ffffff'), parseColor('#000000'), 0.5), { r: 127.5, g: 127.5, b: 127.5, a: 1 });
});

test('tokeny obu motywów dają się odczytać z index.css (i różnią się między motywami)', () => {
  for (const t of ['--color-text-hi', '--color-text-3', '--color-primary', '--color-danger', '--color-surface-flat']) {
    assert.ok(THEMES.dark[t] && THEMES.light[t], t);
    assert.notEqual(THEMES.dark[t], THEMES.light[t], `${t} nie różni się między motywami`);
  }
});

for (const theme of themes) {
  for (const state of states) {
    test(`kontrast tekstu odpowiedzi ≥ 4,5:1 — stan ${state}, motyw ${theme}`, () => {
      const ratio = contrastRatio(themeColor(theme, QUIZ_OPTION_STATES[state].text), background(theme, state));
      assert.ok(ratio >= AA_TEXT, `${state}/${theme}: ${ratio.toFixed(2)}:1`);
    });
  }

  for (const state of states.filter((s) => QUIZ_OPTION_STATES[s].signal)) {
    test(`ikona i obwódka stanu ≥ 3:1 względem tła — ${state}, motyw ${theme}`, () => {
      const ratio = contrastRatio(themeColor(theme, QUIZ_OPTION_STATES[state].signal!), background(theme, state));
      assert.ok(ratio >= AA_NON_TEXT, `${state}/${theme}: ${ratio.toFixed(2)}:1`);
    });
  }
}

test('regres: tekst poprawnej/błędnej odpowiedzi NIE jest w kolorze tła-nakładki (zielone na zielonym)', () => {
  for (const s of ['correct', 'incorrect'] as const) {
    const r = QUIZ_OPTION_STATES[s];
    assert.notEqual(r.text, r.tint!.token, s);
    assert.match(r.classes, /text-text-hi/);
    assert.doesNotMatch(r.classes, /opacity/);
  }
  for (const s of states) assert.doesNotMatch(QUIZ_OPTION_STATES[s].classes, /opacity-/, `${s}: opacity blednie tekst`);
});

test('klasy każdego stanu odzwierciedlają tokeny z opisu kontrastu (opis nie rozjeżdża się z klasami)', () => {
  const cls = (s: QuizOptionState) => QUIZ_OPTION_STATES[s].classes;
  assert.match(cls('default'), /text-text-hi/);
  assert.match(cls('disabled'), /text-text-3/);
  assert.match(cls('correct'), /bg-primary\/15/);
  assert.match(cls('correct'), /border-primary/);
  assert.match(cls('incorrect'), /bg-danger\/15/);
  assert.match(cls('incorrect'), /border-danger/);
  assert.match(cls('hover'), /hover:bg-primary\/10/);
  assert.match(cls('hover'), /focus-visible:bg-primary\/10/);
  assert.match(cls('selected'), /bg-primary\/10/);
  for (const s of states.filter((x) => QUIZ_OPTION_STATES[x].tint)) {
    const { token, alpha } = QUIZ_OPTION_STATES[s].tint!;
    const name = token === '--color-primary' ? 'primary' : 'danger';
    assert.match(cls(s), new RegExp(`bg-${name}/${Math.round(alpha * 100)}`), s);
  }
});

test('kafelek na telefonie ma min. 56 px wysokości (min-h-14) i zawija tekst', () => {
  for (const s of ['default', 'correct', 'incorrect', 'disabled'] as const) {
    assert.match(QUIZ_OPTION_STATES[s].classes, /min-h-14/);
    assert.match(QUIZ_OPTION_STATES[s].classes, /break-words/);
    assert.match(QUIZ_OPTION_STATES[s].classes, /whitespace-normal/);
  }
});

test('quizOptionState: przed odpowiedzią wszystko default; po niej poprawna / błędna wybrana / reszta nieaktywna', () => {
  assert.equal(quizOptionState('answering', true, false), 'default');
  assert.equal(quizOptionState('answered', true, false), 'correct');
  assert.equal(quizOptionState('answered', true, true), 'correct');
  assert.equal(quizOptionState('answered', false, true), 'incorrect');
  assert.equal(quizOptionState('answered', false, false), 'disabled');
});
