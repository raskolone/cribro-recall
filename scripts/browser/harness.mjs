/**
 * Wspólne klocki testów przeglądarkowych: esbuild (bez Vite), Tailwind z index.css, serwer statyczny,
 * oraz zamiennik Firebase działający w pamięci (zero sieci, zero zapisów do prawdziwej bazy).
 */
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const repo = resolve(new URL('../..', import.meta.url).pathname);
export const req = createRequire(join(repo, 'package.json'));
export const newWorkDir = (prefix) => mkdtempSync(join(tmpdir(), prefix));

export async function compileCss(work) {
  const { compile } = await import(pathToFileURL(join(repo, 'node_modules/@tailwindcss/node/dist/index.mjs')).href);
  const { Scanner } = req('@tailwindcss/oxide');
  const compiler = await compile(readFileSync(join(repo, 'index.css'), 'utf8'), { base: repo, onDependency() {} });
  const scanner = new Scanner({ sources: ['components', 'utils', 'design', 'context'].map((d) => ({ base: join(repo, d), pattern: '**/*', negated: false })) });
  writeFileSync(join(work, 'style.css'), compiler.build(scanner.scan()));
}

export function serve(work, html) {
  const server = createServer((rq, rs) => {
    const path = rq.url.split('?')[0];
    if (path === '/style.css') { rs.setHeader('content-type', 'text/css'); return rs.end(readFileSync(join(work, 'style.css'))); }
    if (path === '/bundle.js') { rs.setHeader('content-type', 'text/javascript'); return rs.end(readFileSync(join(work, 'bundle.js'))); }
    if (path.startsWith('/api/')) { rs.setHeader('content-type', 'application/json'); return rs.end('{}'); }
    rs.setHeader('content-type', 'text/html'); rs.end(html);
  }).listen(0);
  return { server, base: `http://localhost:${server.address().port}/` };
}

export const pageHtml = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;

/* ---------- Firebase w pamięci ---------- */

const MEMORY_FIRESTORE = `
const store = new Map();
const listeners = new Set();
const seg = (p) => p.split('/').filter(Boolean);
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const uid = () => Math.random().toString(36).slice(2, 12);
export class Timestamp {
  constructor(s = Math.floor(Date.now() / 1000), n = 0) { this.seconds = s; this.nanoseconds = n; }
  static now() { return new Timestamp(); }
  static fromDate(d) { return new Timestamp(Math.floor(d.getTime() / 1000)); }
  static fromMillis(m) { return new Timestamp(Math.floor(m / 1000)); }
  toDate() { return new Date(this.seconds * 1000); }
  toMillis() { return this.seconds * 1000; }
}
export const __seed = (docs) => { for (const [p, d] of Object.entries(docs)) store.set(p, clone(d)); };
const refPath = (base, segs) => (base && base.path ? base.path + '/' : '') + segs.join('/');
export const collection = (base, ...segs) => ({ __t: 'collection', path: refPath(base, segs) });
export const collectionGroup = (_db, id) => ({ __t: 'collection', path: id, group: true });
export const doc = (base, ...segs) => {
  if (base && base.__t === 'collection' && segs.length === 0) segs = [uid()];
  const path = refPath(base, segs);
  return { __t: 'doc', path, id: seg(path).pop() };
};
export const query = (ref, ...cons) => ({ __t: 'query', path: ref.path, group: ref.group, cons: cons.filter(Boolean) });
export const where = (f, op, v) => ({ k: 'where', f, op, v });
export const orderBy = (f, d) => ({ k: 'orderBy', f, d });
export const limit = (n) => ({ k: 'limit', n });
const field = (o, f) => f.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const matches = (data, c) => {
  const x = field(data, c.f);
  switch (c.op) {
    case '==': return x === c.v;
    case '!=': return x !== c.v;
    case 'in': return c.v.includes(x);
    case 'array-contains': return Array.isArray(x) && x.includes(c.v);
    case '>': return x > c.v; case '>=': return x >= c.v; case '<': return x < c.v; case '<=': return x <= c.v;
    default: return true;
  }
};
const docSnap = (path) => ({ id: seg(path).pop(), ref: { __t: 'doc', path, id: seg(path).pop() }, exists: () => store.has(path), data: () => clone(store.get(path)) });
const querySnap = (q) => {
  const base = seg(q.path);
  let keys = [...store.keys()].filter((k) => {
    const s = seg(k);
    return q.group ? s.length >= 2 && s[s.length - 2] === q.path : s.length === base.length + 1 && k.startsWith(q.path + '/');
  });
  for (const c of q.cons || []) if (c.k === 'where') keys = keys.filter((k) => matches(store.get(k), c));
  for (const c of [...(q.cons || [])].reverse()) if (c.k === 'orderBy') keys.sort((a, b) => { const x = field(store.get(a), c.f), y = field(store.get(b), c.f); return (x > y ? 1 : x < y ? -1 : 0) * (c.d === 'desc' ? -1 : 1); });
  const docs = keys.map(docSnap);
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb), docChanges: () => [] };
};
const snapFor = (ref) => (ref.__t === 'doc' ? docSnap(ref.path) : querySnap(ref.__t === 'collection' ? { path: ref.path, group: ref.group } : ref));
export const getDocs = async (q) => querySnap(q.__t === 'collection' ? { path: q.path, group: q.group } : q);
export const getDoc = async (ref) => docSnap(ref.path);
const notify = () => queueMicrotask(() => listeners.forEach((l) => l()));
export const onSnapshot = (ref, cb) => {
  const fire = () => cb(snapFor(ref));
  listeners.add(fire);
  queueMicrotask(fire);
  return () => listeners.delete(fire);
};
const merge = (a, b) => ({ ...(a || {}), ...clone(b) });
export const setDoc = async (ref, data, opts) => { store.set(ref.path, opts && opts.merge ? merge(store.get(ref.path), data) : clone(data)); notify(); };
export const updateDoc = async (ref, data) => { store.set(ref.path, merge(store.get(ref.path), data)); notify(); };
export const deleteDoc = async (ref) => { store.delete(ref.path); notify(); };
export const addDoc = async (coll, data) => { const r = doc(coll); await setDoc(r, data); return r; };
export const writeBatch = () => { const ops = []; const b = { set: (r, d, o) => (ops.push(() => setDoc(r, d, o)), b), update: (r, d) => (ops.push(() => updateDoc(r, d)), b), delete: (r) => (ops.push(() => deleteDoc(r)), b), commit: async () => { for (const o of ops) await o(); } }; return b; };
export const runTransaction = async (_db, fn) => fn({ get: async (r) => docSnap(r.path), set: (r, d) => setDoc(r, d), update: (r, d) => updateDoc(r, d), delete: (r) => deleteDoc(r) });
export const serverTimestamp = () => new Date().toISOString();
export const increment = (n) => n;
export const arrayUnion = (...a) => a;
export const arrayRemove = () => [];
export const deleteField = () => undefined;
export const initializeFirestore = () => ({});
export const getFirestore = () => ({});
export const connectFirestoreEmulator = () => {};
`;

const OVERRIDES = {
  'firebase/auth': { getAuth: '() => ({ currentUser: { uid: "u", email: "u@example.com" }, onAuthStateChanged: () => () => {}, onIdTokenChanged: () => () => {} })' },
  'firebase/app': { initializeApp: '() => ({})' },
  'firebase/functions': { getFunctions: '() => ({})', httpsCallable: '() => async () => ({ data: {} })' },
  'firebase/storage': { getStorage: '() => ({})' },
};

function sourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', 'tests', 'functions', 'scripts', '.git', 'api', 'src-tauri', 'python_api'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(tsx?)$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** Plugin esbuild: każdy `firebase/*` zastąpiony modułem w pamięci z dokładnie tymi nazwami, które importuje repo. */
export function memoryFirebasePlugin(work, seed) {
  const names = new Map();
  const re = /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*['"](firebase\/[a-z-]+)['"]/g;
  for (const f of sourceFiles(repo)) {
    const text = readFileSync(f, 'utf8');
    let m;
    while ((m = re.exec(text))) {
      const set = names.get(m[2]) || new Set();
      for (const part of m[1].split(',')) { const n = part.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, ''); if (n) set.add(n); }
      names.set(m[2], set);
    }
  }
  const files = new Map();
  for (const [mod, set] of names) {
    const own = mod === 'firebase/firestore' ? MEMORY_FIRESTORE : '';
    const over = OVERRIDES[mod] || {};
    const defined = new Set([...(own.match(/export (?:const|class) (\w+)/g) || []).map((s) => s.split(' ').pop()), ...Object.keys(over)]);
    let src = own;
    for (const [n, v] of Object.entries(over)) src += `\nexport const ${n} = ${v};`;
    for (const n of set) if (!defined.has(n)) src += `\nexport const ${n} = (..._a) => undefined;`;
    if (mod === 'firebase/firestore') src += `\n__seed(${JSON.stringify(seed)});`;
    const file = join(work, `stub-${mod.replace('/', '-')}.js`);
    writeFileSync(file, src);
    files.set(mod, file);
  }
  return { name: 'memory-firebase', setup(b) { b.onResolve({ filter: /^firebase\// }, (a) => (files.has(a.path) ? { path: files.get(a.path) } : { path: join(work, 'stub-empty.js') })); writeFileSync(join(work, 'stub-empty.js'), 'export default {};'); } };
}

export async function bundle(work, entryFile, extraPlugins = []) {
  await build({
    entryPoints: [entryFile], outfile: join(work, 'bundle.js'), bundle: true, format: 'iife', jsx: 'automatic', loader: { '.json': 'json' },
    nodePaths: [join(repo, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}', 'import.meta.env.PROD': 'false', 'import.meta.env.DEV': 'false' }, logLevel: 'error', plugins: extraPlugins,
  });
}
