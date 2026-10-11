import './helpers/jsdomEnv';
import test, { afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import i18n from '../i18n';
import GeneratingAnimation from '../components/ui/GeneratingAnimation';
import { GEN_CYCLE_SECONDS, GEN_TIMELINE, genKeyframePercents } from '../utils/generatingAnimation';
import { AA_NON_TEXT, contrastRatio } from '../utils/contrast';
import { THEMES, themeColor, type ThemeName } from './helpers/themeColors';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const css = read('index.css');

before(async () => {
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
});
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('pl');
});

test('tekst z i18n (pl i en), statyczny; role=status, aria-live=polite, SVG aria-hidden', async () => {
  const { getByTestId, container } = render(<GeneratingAnimation />);
  const root = getByTestId('generating-animation');
  assert.equal(root.getAttribute('role'), 'status');
  assert.equal(root.getAttribute('aria-live'), 'polite');
  assert.equal(root.querySelector('p')!.textContent, 'Przygotowuję ćwiczenie…');
  assert.equal(container.querySelector('svg')!.getAttribute('aria-hidden'), 'true');
  cleanup();
  await i18n.changeLanguage('en');
  const en = render(<GeneratingAnimation />);
  assert.equal(en.getByTestId('generating-animation').querySelector('p')!.textContent, 'Preparing your exercise…');
});

test('bez paska postępu, bez liczb i bez sugerowania czasu', () => {
  const { container } = render(<GeneratingAnimation />);
  assert.equal(container.querySelector('[role="progressbar"]'), null);
  assert.ok(!/\d|%|sekund|minut/i.test(container.textContent!));
  assert.equal(container.querySelectorAll('p').length, 1, 'jeden krótki tekst');
});

test('trzy elementy rysunku: kłębek, strzałka, koło; ścieżki znormalizowane (pathLength=1), kolor z akcentu', () => {
  const { container } = render(<GeneratingAnimation />);
  const svg = container.querySelector('svg')!;
  assert.ok(svg.querySelector('.gen-anim__ball'));
  assert.equal(svg.querySelector('.gen-anim__arrow')!.getAttribute('pathLength'), '1');
  assert.equal(svg.querySelector('.gen-anim__circle')!.getAttribute('pathLength'), '1');
  assert.equal(svg.getAttribute('stroke'), 'currentColor');
  assert.match(svg.getAttribute('class')!, /max-w-\[280px\]/);
  assert.match(css, /\.gen-anim \{ color: var\(--color-primary\); \}/);
});

test('oś czasu: strzałka 0,5 s, koło 1,8 s (w zakresie 1,6–2 s), pauza 0,8 s, wygaszenie 0,4 s, kłębek oddycha 3 s', () => {
  assert.equal(GEN_TIMELINE.arrowDraw, 0.5);
  assert.ok(GEN_TIMELINE.circleDraw >= 1.6 && GEN_TIMELINE.circleDraw <= 2);
  assert.equal(GEN_TIMELINE.pause, 0.8);
  assert.equal(GEN_TIMELINE.fade, 0.4);
  assert.equal(GEN_TIMELINE.breath, 3);
  assert.ok(Math.abs(GEN_CYCLE_SECONDS - 3.5) < 1e-9);
  assert.match(css, /\.gen-anim__ball \{[^}]*animation: gen-breathe 3s ease-in-out infinite/);
  assert.match(css, /\.gen-anim__arrow \{ animation: gen-arrow 3\.5s linear infinite; \}/);
  assert.match(css, /\.gen-anim__circle \{ animation: gen-circle 3\.5s linear infinite; \}/);
});

test('klatki kluczowe w CSS zgodne z osią czasu (procenty z genKeyframePercents)', () => {
  const { arrowEnd, circleEnd, holdEnd } = genKeyframePercents();
  const near = (pct: number) => new RegExp(`${pct.toFixed(4).replace(/0+$/, '').replace('.', '\\.')}\\d*%`);
  const arrow = css.slice(css.indexOf('@keyframes gen-arrow'), css.indexOf('@keyframes gen-circle'));
  const circle = css.slice(css.indexOf('@keyframes gen-circle'), css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .gen-anim__ball'));
  assert.match(arrow, near(arrowEnd));
  assert.match(arrow, near(holdEnd));
  assert.match(circle, near(arrowEnd));
  assert.match(circle, near(circleEnd));
  assert.match(circle, near(holdEnd));
  assert.match(circle, /ease-in-out/);
});

test('animowane są tylko transform, opacity i stroke-dashoffset; bez JS na klatkę', () => {
  const block = css.slice(css.indexOf('.gen-anim {'), css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .gen-anim__ball'));
  const props = new Set<string>();
  for (const frames of block.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n\}/g)) {
    for (const m of frames[1].matchAll(/([a-z-]+):/g)) props.add(m[1]);
  }
  props.delete('animation-timing-function');
  assert.deepEqual([...props].sort(), ['opacity', 'stroke-dashoffset', 'transform']);
  const src = read('components/ui/GeneratingAnimation.tsx');
  assert.ok(!/setInterval|setTimeout|requestAnimationFrame|useEffect|gsap|motion\/react/.test(src));
});

test('prefers-reduced-motion: obraz statyczny — kłębek, strzałka i gotowe koło, ten sam tekst', () => {
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .gen-anim__ball'));
  assert.match(reduced, /\.gen-anim__ball,\s*\.gen-anim__arrow,\s*\.gen-anim__circle \{ animation: none; opacity: 1; stroke-dashoffset: 0; transform: none; \}/);
});

test('kontrast graficzny linii (akcent) względem tła strony ≥ 3:1 w obu motywach', () => {
  const rows = ['motyw | linia | tło strony | kontrast'];
  for (const theme of ['dark', 'light'] as ThemeName[]) {
    const ratio = contrastRatio(themeColor(theme, '--color-primary'), themeColor(theme, '--color-bg'));
    rows.push(`${theme} | ${THEMES[theme]['--color-primary']} | ${THEMES[theme]['--color-bg']} | ${ratio.toFixed(2)}`);
    assert.ok(ratio >= AA_NON_TEXT, `${theme}: ${ratio.toFixed(2)}`);
  }
  console.log(rows.join('\n'));
});
test('stara animacja zniknęła: brak AIGenerationLoader, ścieżek „tangled/spiral” i nieużywanego InlineAILoading', () => {
  const gen = read('components/dashboard/AIExerciseGeneratorScreen.tsx');
  assert.ok(!gen.includes('AIGenerationLoader') && !gen.includes('tangledPath') && !gen.includes('Upraszczanie i porządkowanie'));
  assert.ok(gen.includes('<GeneratingAnimation />'));
  assert.equal(existsSync(new URL('../components/ui/InlineAILoading.tsx', import.meta.url)), false);
});
