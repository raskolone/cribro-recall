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

  test('DRAW: klik w kolor zmienia aktywny kolor (checkmark przechodzi) i podgląd pisaka', async () => {
    const Wrapper = () => {
      const [color, setColor] = React.useState('#10b981');
      const [tool, setTool] = React.useState<any>('pen');
      return React.createElement(FloatingToolPalette, {
        isOpen: true, onClose: () => {}, isTeacher: true, editorRef: { current: null },
        activeDrawTool: tool, onSelectDrawTool: setTool, drawColor: color, onChangeDrawColor: setColor,
      });
    };
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(React.createElement(Wrapper)); });
    const click = async (sel: string) => { await act(async () => { (panel().querySelector(sel) as HTMLElement).click(); }); };
    await click('button[aria-expanded]');
    await click('button:nth-of-type(2)'); // zakładka DRAW? sprawdzana niżej po tekście
    const tabs = Array.from(panel().querySelectorAll('button')).find(b => b.textContent === 'DRAW')!;
    await act(async () => { tabs.click(); });

    const checked = () => Array.from(panel().querySelectorAll('button[title]')).filter(b => b.querySelector('svg') && ['Emerald','Rose','Sky','Amber','Purple','Dark Ink','White'].includes(b.getAttribute('title')!)).map(b => b.getAttribute('title'));
    const preview = () => (panel().querySelector('[data-testid="draw-preview"]') as HTMLElement).style.backgroundColor;
    assert.deepEqual(checked(), ['Emerald']);
    for (const [name, rgb] of [['Rose', 'rgb(244, 63, 94)'], ['Sky', 'rgb(14, 165, 233)'], ['White', 'rgb(255, 255, 255)']]) {
      await click(`button[title="${name}"]`);
      assert.deepEqual(checked(), [name]);
      assert.equal(preview(), rgb);
    }
    await act(async () => { root.unmount(); });
  });

  test('B: panel nie ma zaszytych kolorów slate/white, ikony na obrazku zawsze białe na czarnym pasku', () => {
    const src = fs.readFileSync(new URL('../components/scratchpad/FloatingToolPalette.tsx', import.meta.url), 'utf8');
    // ptaszek na kolorowej próbce (stały kontrast wobec próbki, nie wobec motywu) jest jedynym wyjątkiem
    const withoutCheck = src.split('\n').filter(l => !l.includes('<Check')).join('\n');
    assert.equal(/text-slate-|bg-slate-|text-white|bg-white\//.test(withoutCheck), false);
    const css = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    assert.match(css, /\.pad-img-toolbar \{\s*--on-fill: #ffffff;/);
  });

  test('CSS: jasne zmienne dla jasnej aplikacji ORAZ jasnej kartki', () => {
    const css = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    const block = css.slice(css.indexOf('.pad-tools {'));
    assert.match(block, /:root\.light \.pad-tools,\s*:root\[data-theme="light"\] \.pad-tools,\s*\.pad-tools\[data-pad-theme="light"\]\s*\{[^}]*--pt-bg: rgba\(255, 255, 255/);
    assert.match(block, /^\.pad-tools \{[^}]*--pt-bg: rgba\(15, 23, 42/);
  });
});
