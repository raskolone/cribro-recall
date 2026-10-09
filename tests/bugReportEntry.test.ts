import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OPEN_BUG_REPORT_EVENT, requestBugReport } from '../utils/bugReportEvents';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('requestBugReport wysyła zdarzenie otwierające panel', () => {
  const seen: string[] = [];
  requestBugReport({ dispatchEvent: (e: Event) => (seen.push(e.type), true) });
  assert.deepEqual(seen, [OPEN_BUG_REPORT_EVENT]);
});

test('pływająca ikona jest schowana na wąskim ekranie i przy dotyku, zostaje na desktopie', () => {
  const s = src('components/ui/BugReporter.tsx');
  const line = s.split('\n').find((l) => l.includes('fixed top-16 right-4'));
  assert.ok(line, 'brak pływającego przycisku');
  assert.match(line!, /max-md:hidden/);
  assert.match(line!, /pointer-coarse:hidden/);
});

test('BugReporter nasłuchuje zdarzenia z menu i sprząta nasłuch', () => {
  const s = src('components/ui/BugReporter.tsx');
  assert.match(s, /addEventListener\(OPEN_BUG_REPORT_EVENT/);
  assert.match(s, /removeEventListener\(OPEN_BUG_REPORT_EVENT/);
});

test('otwarty panel uwzględnia safe-area i nie wychodzi poza wąski ekran', () => {
  const s = src('components/ui/BugReporter.tsx');
  assert.match(s, /env\(safe-area-inset-top\)/);
  assert.match(s, /env\(safe-area-inset-right\)/);
  assert.match(s, /w-\[min\(20rem,calc\(100vw-2rem\)\)\]/);
});

test('wpis w menu ustawień jest tylko dla kursanta i tylko tam, gdzie ikony nie ma', () => {
  const s = src('components/ui/TopBar.tsx');
  const i = s.indexOf('data-testid="topbar-report-bug"');
  assert.ok(i > 0);
  const before = s.slice(Math.max(0, i - 200), i);
  assert.match(before, /user\?\.role === 'user'/);
  assert.match(s.slice(i, i + 400), /md:pointer-fine:hidden/);
  assert.match(s, /requestBugReport\(\)/);
});
