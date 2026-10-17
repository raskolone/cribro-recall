// Podsumowanie lekcji kursanta (LessonDetails) w trybie jasnym: pastelowe powierzchnie z ciemnym
// tekstem, tryb ciemny bez zmian. Test strukturalny źródła i CSS (wygląd sprawdzony w przeglądarce).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tsx = readFileSync(new URL('../components/dashboard/LessonDetails.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const marker = css.indexOf('PODSUMOWANIE LEKCJI KURSANTA W TRYBIE JASNYM');
const pastelCss = css
  .slice(css.indexOf('*/', marker) + 2)
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('Blok 1, Blok 2 i Things to Improve mają znacznik odcienia: niebieski, zielony, bursztynowy', () => {
  for (const tone of ['sky', 'emerald', 'amber']) {
    assert.match(tsx, new RegExp(`data-tone="${tone}" className="lesson-pastel `), tone);
  }
  assert.equal((tsx.match(/<div data-tone="[a-z]+" className="lesson-pastel /g) || []).length, 3);
});

test('każda reguła .lesson-pastel jest pod selektorem trybu jasnego (tryb ciemny bez zmian)', () => {
  const rules = pastelCss.match(/[^{}]+\{/g)!.map((r) => r.trim()).filter((r) => r.includes('lesson-pastel'));
  assert.ok(rules.length >= 10);
  for (const r of rules) assert.ok(r.startsWith(':root:is(.light, [data-theme="light"])'), r);
});

test('ciemny tekst na pastelu: tytuł i opis z tokenów text-hi / text-2, bez bieli', () => {
  assert.match(pastelCss, /\.lesson-pastel__title \{ color: var\(--text-hi\) !important; \}/);
  assert.match(pastelCss, /\.lesson-pastel__desc \{ color: var\(--text-2\) !important; \}/);
  assert.doesNotMatch(pastelCss, /color:\s*(#fff\b|#ffffff\b|white)/i);
});
