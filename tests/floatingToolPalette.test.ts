import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'KeyboardEvent', 'MouseEvent', 'Event']) {
  Object.defineProperty(globalThis, k, { value: (dom.window as any)[k], configurable: true, writable: true });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { FloatingToolPalette } from '../components/scratchpad/FloatingToolPalette';

const mount = async (paperTheme: 'light' | 'dark') => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const editorRef = { current: null };
  await act(async () => {
    root.render(React.createElement(FloatingToolPalette, { isOpen: true, onClose: () => {}, isTeacher: true, editorRef, paperTheme }));
  });
  return { root, host };
};
const panel = () => document.querySelector('[data-testid="floating-tool-palette"]') as HTMLElement;

describe('FloatingToolPalette', () => {
  test('domyślnie zwinięty; przycisk przełącza zwinięty/rozwinięty', async () => {
    const { root } = await mount('dark');
    assert.equal(panel().dataset.collapsed, '1');
    assert.equal(panel().textContent?.includes('CONTENT'), false);

    const toggle = () => panel().querySelector('button[aria-expanded]') as HTMLButtonElement;
    await act(async () => { toggle().click(); });
    assert.equal(panel().dataset.collapsed, '0');
    assert.ok(panel().textContent?.includes('CONTENT') && panel().textContent?.includes('DRAW'));
    assert.ok(panel().textContent?.includes('Wstaw obraz'));

    await act(async () => { toggle().click(); });
    assert.equal(panel().dataset.collapsed, '1');
    await act(async () => { root.unmount(); });
  });

  test('motyw kartki trafia na panel (data-pad-theme) i panel idzie do <body>', async () => {
    const { root } = await mount('light');
    assert.equal(panel().dataset.padTheme, 'light');
    assert.equal(panel().parentElement, document.body);
    await act(async () => { root.unmount(); });
  });

  test('CSS: jasne zmienne dla jasnej aplikacji ORAZ jasnej kartki', () => {
    const css = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    const block = css.slice(css.indexOf('.pad-tools {'));
    assert.match(block, /:root\.light \.pad-tools,\s*:root\[data-theme="light"\] \.pad-tools,\s*\.pad-tools\[data-pad-theme="light"\]\s*\{[^}]*--pt-bg: rgba\(255, 255, 255/);
    assert.match(block, /^\.pad-tools \{[^}]*--pt-bg: rgba\(15, 23, 42/);
  });
});
