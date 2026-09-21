// Lokalizacja błędu spellchecka w DOM (buildTextIndex/findIssueRange) —
// jedyna prawdziwie ryzykowna logika w tej funkcji: dopasowanie tekstu z
// odpowiedzi modelu do węzłów tekstowych rozbitych przez elementy inline
// (<b>, <i>...), bez pisania niczego do treści notatnika. jsdom ustawiany
// ręcznie jak w tests/homeworkWarmupScrambler.test.tsx — te dwa pliki są
// jedynymi testami DOM w projekcie.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).Node = dom.window.Node;
(globalThis as any).NodeFilter = dom.window.NodeFilter;
(globalThis as any).Range = dom.window.Range;

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildTextIndex, findIssueRange } from '../components/scratchpad/useNotebookSpellcheck';
import { SpellcheckIssue } from '../services/notebookSpellcheckService';

const makeIssue = (overrides: Partial<SpellcheckIssue>): SpellcheckIssue => ({
  id: 'iss-1',
  matchedText: 'teacher',
  contextSnippet: 'the teacher said',
  suggestion: 'Teacher',
  type: 'spelling',
  shortReason: 'Wielka litera',
  ...overrides,
});

describe('buildTextIndex', () => {
  test('spłaszcza tekst rozbity przez elementy inline do jednego ciągu', () => {
    const root = document.createElement('div');
    root.innerHTML = 'Wczoraj <b>zjadłem</b> jabłko.';
    const { text, nodes } = buildTextIndex(root);

    assert.equal(text, 'Wczoraj zjadłem jabłko.');
    // Trzy węzły tekstowe: "Wczoraj ", "zjadłem" (w <b>), " jabłko."
    assert.equal(nodes.length, 3);
  });
});

describe('findIssueRange', () => {
  test('lokalizuje dopasowanie rozbite na dwa węzły tekstowe przez element inline', () => {
    const root = document.createElement('div');
    root.innerHTML = 'Wczoraj the <i>teacher</i> said hello.';

    const range = findIssueRange(root, makeIssue({}));
    assert.ok(range, 'oczekiwano znalezionego zakresu');
    assert.equal(range!.toString(), 'teacher');
  });

  test('kontextSnippet wybiera WŁAŚCIWE wystąpienie, gdy słowo powtarza się w tekście', () => {
    const root = document.createElement('div');
    root.innerHTML = 'The dog ran. Then the dog barked loudly at the cat.';

    // "dog" występuje dwukrotnie — kontext wskazuje na DRUGIE wystąpienie.
    const range = findIssueRange(
      root,
      makeIssue({ matchedText: 'dog', contextSnippet: 'the dog barked' })
    );
    assert.ok(range);

    const before = root.ownerDocument!.createRange();
    before.setStart(root, 0);
    before.setEnd(range!.startContainer, range!.startOffset);
    // Drugie "dog" zaczyna się dalej w tekście niż pierwsze (indeks > długości "The dog ran. Then the ").
    assert.ok(before.toString().length > 'The dog ran. Then the '.length - 3);
  });

  test('zwraca null, gdy dopasowanie nie istnieje w aktualnej treści (np. już poprawione)', () => {
    const root = document.createElement('div');
    root.innerHTML = 'Wszystko już poprawione.';

    const range = findIssueRange(root, makeIssue({ matchedText: 'literowka', contextSnippet: 'literowka tutaj' }));
    assert.equal(range, null);
  });

  test('bez pasującego kontekstu wraca do samego matchedText (fallback)', () => {
    const root = document.createElement('div');
    root.innerHTML = 'One unique word: gud.';

    const range = findIssueRange(
      root,
      makeIssue({ matchedText: 'gud', suggestion: 'good', contextSnippet: 'to nie pasuje do niczego' })
    );
    assert.ok(range);
    assert.equal(range!.toString(), 'gud');
  });
});
