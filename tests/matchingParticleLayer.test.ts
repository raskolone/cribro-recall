// Dopasowanie: `span`y wybuchu dodawane do korzenia z `space-y-6` odbierały siatce rolę ostatniego dziecka
// i dokładały jej margines 24 px na czas animacji — plansza skakała w górę (6/12/18 px na wiersz) i wracała.
// Pomiar w przeglądarce: wysokość siatki 627 → 603 → 627. Cząsteczki idą teraz do osobnej warstwy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../components/flashcards/MatchingGame.tsx', import.meta.url), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('cząsteczki trafiają do dedykowanej warstwy, nie do korzenia planszy', () => {
  const burst = code.slice(code.indexOf('const spawnBurst'), code.indexOf('const animateSelect'));
  assert.match(burst, /const root = particleLayerRef\.current;/);
  assert.match(burst, /root\.appendChild\(dot\)/);
  assert.doesNotMatch(burst, /rootRef\.current/);
});

test('warstwa cząsteczek jest PIERWSZYM dzieckiem korzenia i absolutna — siatka zostaje ostatnim dzieckiem space-y', () => {
  const start = code.indexOf('<div ref={rootRef} className="relative max-w-5xl mx-auto space-y-6');
  assert.ok(start > 0);
  const afterRoot = code.slice(start, start + 700);
  const layer = afterRoot.indexOf('ref={particleLayerRef}');
  const firstContent = afterRoot.indexOf('<div className="flex items-center justify-between">');
  assert.ok(layer > 0 && layer < firstContent, 'warstwa przed nagłówkiem planszy');
  assert.match(afterRoot, /data-testid="match-particles" aria-hidden="true" className="pointer-events-none absolute inset-0 z-30"/);
  // siatka kafelków jest ostatnim elementem korzenia (po niej nie ma już rodzeństwa)
  const grid = code.indexOf('grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 flex-1 items-start');
  const tail = code.slice(grid);
  assert.ok(tail.indexOf('})}\n      </div>\n    </div>\n  );') > 0, 'po siatce zamyka się korzeń');
});

test('reduced-motion: bez cząsteczek (spawnBurst kończy się od razu)', () => {
  assert.match(code, /if \(!root \|\| reduced\) return;/);
});
