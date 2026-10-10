import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
(globalThis as any).DOMParser = dom.window.DOMParser;

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { htmlToPlainText } from '../utils/plainText';

test('znaczniki i encje zapisane przez edytor kart wracają do zwykłego tekstu', () => {
  assert.equal(htmlToPlainText('<b>rock</b> &amp; roll'), 'rock & roll');
  assert.equal(htmlToPlainText('well&nbsp;known').replace(/ /g, ' '), 'well known');
  assert.equal(htmlToPlainText('plain text'), 'plain text');
  assert.equal(htmlToPlainText(''), '');
  assert.equal(htmlToPlainText(undefined), '');
});

test('obrazek z onerror nie wykonuje kodu i nie zostawia śladu w tekście', () => {
  (dom.window as any).__ran = false;
  const out = htmlToPlainText('a<img src=x onerror="window.__ran = true">b');
  assert.equal(out, 'ab');
  assert.equal((dom.window as any).__ran, false);
});

test('bez DOMParsera działa zapasowe usuwanie znaczników', () => {
  const saved = (globalThis as any).DOMParser;
  delete (globalThis as any).DOMParser;
  try {
    assert.equal(htmlToPlainText('<i>a</i> &lt;b&gt; &amp; c'), 'a <b> & c');
  } finally {
    (globalThis as any).DOMParser = saved;
  }
});

test('MatchingMode karmi planszę zwykłym tekstem, a wrongWords oddaje w zapisanej postaci terminu', () => {
  const src = readFileSync(new URL('../components/flashcards/FlashcardStudyScreen.tsx', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('const MatchingMode ='), src.indexOf('// --- Intro Mode Component ---'));
  assert.match(block, /htmlToPlainText\(c\.term\)/);
  assert.match(block, /cards=\{plainCards\}/);
  assert.match(block, /toStored\(r\.wrongWords\)/);
});
