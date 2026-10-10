import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ENTER_COOLDOWN_MS, enterKeyAction, type EnterKeyInput } from '../utils/enterKeyAction';

const base: EnterKeyInput = {
  key: 'Enter', shiftKey: false, repeat: false, isComposing: false, target: 'answer', coarsePointer: false,
  evaluating: false, evaluated: false, answered: true, canForward: true, msSinceLastAction: null,
};
const act = (over: Partial<EnterKeyInput>) => enterKeyAction({ ...base, ...over });

test('niesprawdzone + niepuste pole → check; puste → none', () => {
  assert.equal(act({}), 'check');
  assert.equal(act({ answered: false }), 'none');
});
test('po feedbacku → next; gdy Dalej niedostępne → none', () => {
  assert.equal(act({ evaluated: true, target: 'body' }), 'next');
  assert.equal(act({ evaluated: true, target: 'body', canForward: false }), 'none');
});
test('Shift+Enter, inne klawisze, modyfikatory → none', () => {
  assert.equal(act({ shiftKey: true }), 'none');
  assert.equal(act({ key: 'a' }), 'none');
  assert.equal(act({ ctrlKey: true }), 'none');
  assert.equal(act({ metaKey: true }), 'none');
  assert.equal(act({ altKey: true }), 'none');
});
test('repeat i IME (isComposing) są ignorowane', () => {
  assert.equal(act({ repeat: true }), 'none');
  assert.equal(act({ isComposing: true }), 'none');
});
test('trwa sprawdzanie → none', () => {
  assert.equal(act({ evaluating: true }), 'none');
  assert.equal(act({ evaluating: true, evaluated: true }), 'none');
});
test('fokus na przycisku/linku albo w innym polu → none (robi to sam element)', () => {
  assert.equal(act({ target: 'interactive' }), 'none');
  assert.equal(act({ target: 'interactive', evaluated: true }), 'none');
  assert.equal(act({ target: 'other-field' }), 'none');
});
test('fokus przepadł (body) przed sprawdzeniem: skrót działa jak z pola', () => {
  assert.equal(act({ target: 'body' }), 'check');
});
test('dotyk / klawiatura ekranowa (pointer: coarse) → none, Enter zostaje nową linią', () => {
  assert.equal(act({ coarsePointer: true }), 'none');
  assert.equal(act({ coarsePointer: true, evaluated: true, target: 'body' }), 'none');
});
test('dwa szybkie Entery po feedbacku = JEDNO zdanie dalej', () => {
  let last: number | null = null;
  const press = (t: number, over: Partial<EnterKeyInput>) => {
    const a = act({ ...over, msSinceLastAction: last === null ? null : t - last });
    if (a !== 'none') last = t;
    return a;
  };
  assert.equal(press(1000, { evaluated: true, target: 'body' }), 'next');
  // drugi Enter 80 ms później trafia już w zdanie, które ma odpowiedź z wcześniejszego podejścia
  assert.equal(press(1080, { evaluated: true, target: 'body' }), 'none');
  assert.equal(press(1000 + ENTER_COOLDOWN_MS + 1, { evaluated: true, target: 'body' }), 'next');
});
test('po sprawdzeniu przez Enter kolejny Enter od razu nie przeskakuje dalej', () => {
  assert.equal(act({ msSinceLastAction: 100, evaluated: true, target: 'body' }), 'none');
});

test('generator: skrót podpięty przez enterKeyAction, bez własnej obsługi Enter w polu, podpowiedzi z i18n', () => {
  const src = readFileSync(new URL('../components/dashboard/AIExerciseGeneratorScreen.tsx', import.meta.url), 'utf8');
  assert.match(src, /enterKeyAction\(/);
  assert.doesNotMatch(src, /onKeyDown=\{\(e\) => \{\s*if \(e\.key === 'Enter'/);
  assert.match(src, /exerciseFormat !== 'puzzle' && Boolean\(exercises\[idx\]\)/);
  for (const lang of ['pl', 'en']) {
    const j = JSON.parse(readFileSync(new URL(`../${lang}.json`, import.meta.url), 'utf8'));
    assert.ok(j['Enter: Sprawdź'] && j['Enter: Dalej'], lang);
  }
});
