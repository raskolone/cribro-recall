import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPwaUpdater,
  canReloadForUpdate,
  MIN_CHECK_GAP_MS,
  RELOAD_GUARD_KEY,
  RELOAD_GUARD_WINDOW_MS,
  UPDATE_CHECK_INTERVAL_MS,
  PwaUpdaterDeps,
} from '../utils/pwaUpdate';

function harness(opts: { controller?: boolean; visible?: boolean } = {}) {
  let visibility = opts.visible === false ? 'hidden' : 'visible';
  let t = 1_000_000;
  const listeners: Record<string, Set<() => void>> = { controllerchange: new Set(), visibilitychange: new Set(), online: new Set() };
  const add = (type: string, l: () => void) => void listeners[type].add(l);
  const rem = (type: string, l: () => void) => void listeners[type].delete(l);
  const fire = (type: string) => [...listeners[type]].forEach((l) => l());
  const store = new Map<string, string>();
  let updates = 0;
  let reloads = 0;
  let failUpdate = false;
  const intervals: Array<{ fn: () => void; ms: number; cleared: boolean }> = [];
  const registered: Array<{ url: string; scope?: string }> = [];
  const deps: PwaUpdaterDeps = {
    container: {
      controller: opts.controller === false ? null : {},
      register: async (url, o) => (registered.push({ url, scope: o?.scope }), { update: async () => { updates++; if (failUpdate) throw new Error('offline'); } }),
      addEventListener: (type, l) => add(type, l),
      removeEventListener: (type, l) => rem(type, l),
    },
    doc: { get visibilityState() { return visibility; }, addEventListener: (type, l) => add(type, l), removeEventListener: (type, l) => rem(type, l) },
    win: { addEventListener: (type, l) => add(type, l), removeEventListener: (type, l) => rem(type, l) },
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) },
    now: () => t,
    reload: () => void reloads++,
    setInterval: (fn, ms) => { const h = { fn, ms, cleared: false }; intervals.push(h); return h; },
    clearInterval: (h) => void ((h as { cleared: boolean }).cleared = true),
  };
  return {
    deps, fire, store, intervals, registered,
    setVisible: (v: boolean) => void (visibility = v ? 'visible' : 'hidden'),
    advance: (ms: number) => void (t += ms),
    failUpdates: () => void (failUpdate = true),
    get updates() { return updates; },
    get reloads() { return reloads; },
  };
}

test('start rejestruje /sw.js ze scope "/" i nie robi tego drugi raz', async () => {
  const h = harness();
  const u = createPwaUpdater(h.deps);
  await u.start();
  await u.start();
  assert.deepEqual(h.registered, [{ url: '/sw.js', scope: '/' }]);
});

test('pierwsza instalacja (clientsClaim bez wcześniejszego kontrolera) nie zapala banera', async () => {
  const h = harness({ controller: false });
  const u = createPwaUpdater(h.deps);
  await u.start();
  h.fire('controllerchange');
  assert.equal(u.getState().updateReady, false);
  // ale każda KOLEJNA zmiana kontrolera w tej karcie jest już aktualizacją
  h.fire('controllerchange');
  assert.equal(u.getState().updateReady, true);
});

test('zmiana kontrolera przy istniejącej wersji zapala baner i powiadamia subskrybentów', async () => {
  const h = harness();
  const u = createPwaUpdater(h.deps);
  let notified = 0;
  u.subscribe(() => notified++);
  await u.start();
  h.fire('controllerchange');
  assert.deepEqual(u.getState(), { updateReady: true, dismissed: false });
  assert.equal(notified, 1);
});

test('powrót do aplikacji sprawdza aktualizację, ukrycie nie', async () => {
  const h = harness();
  const u = createPwaUpdater(h.deps);
  await u.start();
  h.advance(MIN_CHECK_GAP_MS + 1);
  h.fire('visibilitychange');
  assert.equal(h.updates, 1);
  h.advance(MIN_CHECK_GAP_MS + 1);
  h.setVisible(false);
  h.fire('visibilitychange');
  assert.equal(h.updates, 1);
});

test('częste przełączanie widoczności nie zalewa serwera (odstęp minimalny)', async () => {
  const h = harness();
  const u = createPwaUpdater(h.deps);
  await u.start();
  h.advance(MIN_CHECK_GAP_MS + 1);
  h.fire('visibilitychange');
  h.advance(1000);
  h.fire('visibilitychange');
  h.fire('visibilitychange');
  assert.equal(h.updates, 1);
});

test('odzyskanie sieci też sprawdza aktualizację', async () => {
  const h = harness();
  const u = createPwaUpdater(h.deps);
  await u.start();
  h.advance(MIN_CHECK_GAP_MS + 1);
  h.fire('online');
  assert.equal(h.updates, 1);
});

test('co 30 minut sprawdza aktualizację, ale tylko gdy karta jest widoczna', async () => {
  const h = harness();
  const u = createPwaUpdater(h.deps);
  await u.start();
  assert.equal(h.intervals.length, 1);
  assert.equal(h.intervals[0].ms, UPDATE_CHECK_INTERVAL_MS);
  assert.equal(UPDATE_CHECK_INTERVAL_MS, 30 * 60 * 1000);
  h.advance(UPDATE_CHECK_INTERVAL_MS);
  h.intervals[0].fn();
  assert.equal(h.updates, 1);
  h.setVisible(false);
  h.advance(UPDATE_CHECK_INTERVAL_MS);
  h.intervals[0].fn();
  assert.equal(h.updates, 1);
});

test('błąd sieci przy update() jest połykany (telefon bywa offline)', async () => {
  const h = harness();
  const u = createPwaUpdater(h.deps);
  await u.start();
  h.failUpdates();
  h.advance(MIN_CHECK_GAP_MS + 1);
  assert.doesNotThrow(() => h.fire('online'));
  await Promise.resolve();
  assert.equal(h.updates, 1);
});

test('applyUpdate przeładowuje raz i zapisuje znacznik; drugie przeładowanie w oknie jest blokowane', async () => {
  const h = harness();
  const u = createPwaUpdater(h.deps);
  await u.start();
  h.fire('controllerchange');
  assert.equal(u.applyUpdate(), true);
  assert.equal(h.reloads, 1);
  assert.ok(h.store.get(RELOAD_GUARD_KEY));
  // „po przeładowaniu" nowy SW znowu zgłasza zmianę — pętli nie będzie
  h.advance(RELOAD_GUARD_WINDOW_MS - 1000);
  h.fire('controllerchange');
  assert.equal(u.applyUpdate(), false);
  assert.equal(h.reloads, 1);
  assert.equal(u.getState().dismissed, true);
});

test('po upływie okna blokady kolejna aktualizacja przeładowuje normalnie', async () => {
  const h = harness();
  const u = createPwaUpdater(h.deps);
  await u.start();
  h.fire('controllerchange');
  u.applyUpdate();
  h.advance(RELOAD_GUARD_WINDOW_MS + 1);
  h.fire('controllerchange');
  assert.equal(u.applyUpdate(), true);
  assert.equal(h.reloads, 2);
});

test('dismiss chowa baner, a następna wersja zapala go ponownie', async () => {
  const h = harness();
  const u = createPwaUpdater(h.deps);
  await u.start();
  h.fire('controllerchange');
  u.dismiss();
  assert.equal(u.getState().dismissed, true);
  h.fire('controllerchange');
  assert.deepEqual(u.getState(), { updateReady: true, dismissed: false });
});

test('dismiss bez dostępnej aktualizacji nic nie zmienia', () => {
  const h = harness();
  const u = createPwaUpdater(h.deps);
  let n = 0;
  u.subscribe(() => n++);
  u.dismiss();
  assert.equal(n, 0);
});

test('stop zdejmuje nasłuchy i czyści interwał', async () => {
  const h = harness();
  const u = createPwaUpdater(h.deps);
  await u.start();
  u.stop();
  h.advance(MIN_CHECK_GAP_MS + 1);
  h.fire('online');
  h.fire('visibilitychange');
  h.fire('controllerchange');
  assert.equal(h.updates, 0);
  assert.equal(u.getState().updateReady, false);
  assert.equal(h.intervals[0].cleared, true);
});

test('canReloadForUpdate: brak storage lub błąd storage nie blokuje aktualizacji', () => {
  assert.equal(canReloadForUpdate(undefined, 5), true);
  assert.equal(canReloadForUpdate({ getItem: () => { throw new Error('x'); }, setItem: () => {} }, 5), true);
  assert.equal(canReloadForUpdate({ getItem: () => 'nie-liczba', setItem: () => {} }, 5), true);
});

test('nieudana rejestracja nie wywraca aplikacji', async () => {
  const h = harness();
  h.deps.container.register = async () => { throw new Error('SecurityError'); };
  const u = createPwaUpdater(h.deps);
  const warn = console.warn; console.warn = () => {};
  try { await u.start(); } finally { console.warn = warn; }
  h.fire('online');
  assert.equal(h.updates, 0);
});
