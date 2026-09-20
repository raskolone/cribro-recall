import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  htmlToBlocks,
  blocksToHtml,
  blocksToText,
  getScratchpadBlocksOrFallback,
} from '../utils/scratchpadBlocks';
import { ScratchpadBlock } from '../types';

test('htmlToBlocks pustego dokumentu zwraca pustą tablicę bloków', () => {
  assert.deepEqual(htmlToBlocks(''), []);
  assert.deepEqual(htmlToBlocks('   '), []);
});

test('htmlToBlocks konwertuje istniejący HTML na pojedynczy blok text 1:1 (fallback wsteczny)', () => {
  const html = '<p>Lesson 1 — hello</p>';
  const blocks = htmlToBlocks(html);

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'text');
  assert.equal(blocks[0].content, html);
  assert.equal(blocks[0].visibility, 'shared');
  assert.equal(blocks[0].order, 0);
});

test('blocksToHtml serializuje bloki w kolejności `order` i pomija teacherOnly', () => {
  const blocks: ScratchpadBlock[] = [
    { id: 'b2', type: 'text', content: '<p>drugi</p>', visibility: 'shared', editPolicy: 'teacher', order: 1, updatedAt: 0 },
    { id: 'b1', type: 'heading', content: 'Lekcja 1', visibility: 'shared', editPolicy: 'teacher', order: 0, updatedAt: 0 },
    { id: 'b3', type: 'text', content: '<p>notatka prywatna</p>', visibility: 'teacherOnly', editPolicy: 'teacher', order: 2, updatedAt: 0 },
  ];

  const html = blocksToHtml(blocks);

  assert.equal(html, '<h2>Lekcja 1</h2><p>drugi</p>');
  assert.ok(!html.includes('notatka prywatna'));
});

test('blocksToText zwraca czysty tekst bez znaczników HTML', () => {
  const blocks: ScratchpadBlock[] = [
    { id: 'b1', type: 'heading', content: 'Lekcja 1', visibility: 'shared', editPolicy: 'teacher', order: 0, updatedAt: 0 },
    { id: 'b2', type: 'bullet_list', content: 'apple\nbanana', visibility: 'shared', editPolicy: 'teacher', order: 1, updatedAt: 0 },
  ];

  const text = blocksToText(blocks);

  assert.ok(text.includes('Lekcja 1'));
  assert.ok(text.includes('apple'));
  assert.ok(text.includes('banana'));
  assert.ok(!text.includes('<'));
});

test('getScratchpadBlocksOrFallback preferuje istniejące blocks nad konwersją z contentHtml', () => {
  const existing: ScratchpadBlock[] = [
    { id: 'b1', type: 'text', content: 'już blokowe', visibility: 'shared', editPolicy: 'teacher', order: 0, updatedAt: 0 },
  ];

  const result = getScratchpadBlocksOrFallback({ blocks: existing, contentHtml: '<p>stare</p>' });

  assert.equal(result, existing);
});

test('getScratchpadBlocksOrFallback konwertuje contentHtml, gdy dokument nie ma jeszcze blocks', () => {
  const result = getScratchpadBlocksOrFallback({ contentHtml: '<p>Notatka bez modelu blokowego</p>' });

  assert.equal(result.length, 1);
  assert.equal(result[0].content, '<p>Notatka bez modelu blokowego</p>');
});
