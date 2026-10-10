// Trasa POST /api/free-practice/generate: rejestracja, uwierzytelnienie, produkcyjny bundle (api/index.js),
// limit czasu funkcji na Vercelu, brak zmian w regułach Firestore i storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { FREE_PRACTICE_CALL_TIMEOUT_MS, FREE_PRACTICE_MAX_ATTEMPTS } from '../utils/freePracticeGeneration';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const ROUTE = '/api/free-practice/generate';

test('trasa zarejestrowana w server.ts z requireFirebaseAuth (uwierzytelnienie bez zmian w middleware)', () => {
  const src = read('server.ts');
  assert.match(src, /app\.post\("\/api\/free-practice\/generate", requireFirebaseAuth, async \(req, res\) =>/);
  assert.equal((src.match(/\/api\/free-practice\/generate/g) || []).length, 1, 'jedna rejestracja');
  // middleware autoryzacji nietknięty: nadal weryfikuje Bearer token przez adminAuth.verifyIdToken
  assert.match(src, /async function requireFirebaseAuth[\s\S]{0,900}adminAuth\.verifyIdToken\(idToken\)/);
});

test('trasa jest w PRODUKCYJNYM bundlu api/index.js (Vercel) i w dist/server.cjs, z tymi samymi składnikami', () => {
  assert.ok(existsSync(new URL('../api/index.js', import.meta.url)), 'api/index.js istnieje');
  const bundle = read('api/index.js');
  assert.ok(bundle.includes(`"${ROUTE}"`) || bundle.includes(`'${ROUTE}'`), 'api/index.js zawiera trasę — przebuduj: esbuild api/serverless.ts');
  for (const marker of ['freePracticeUsage', 'reserveSlot', 'releaseSlot', 'Europe/Warsaw', 'generateFreePracticeExercises', 'handleFreePracticeGenerate', 'sanitizeFreeText', 'daily_limit']) {
    assert.ok(bundle.includes(marker), `api/index.js: brak ${marker}`);
  }
  // bundle jest świeży względem źródeł: stałe z freePracticeGeneration.ts są w nim z tymi samymi wartościami
  assert.ok(/var FREE_PRACTICE_CALL_TIMEOUT_MS = 22e3;/.test(bundle), 'bundle ma starą wartość limitu czasu — przebuduj');
  assert.ok(/var FREE_PRACTICE_MAX_ATTEMPTS = 2;/.test(bundle), 'bundle ma starą liczbę prób — przebuduj');
  assert.ok(/var DEFAULT_FREE_PRACTICE_DAILY_LIMIT = 10;/.test(bundle), 'bundle ma stary limit dzienny — przebuduj');
  // trasa stoi za uwierzytelnieniem także w bundlu
  assert.ok(/app\d*\.post\("\/api\/free-practice\/generate", requireFirebaseAuth/.test(bundle), 'w bundlu trasa stoi za requireFirebaseAuth');
});

test('Vercel kieruje /api/* do funkcji api/index.js z maxDuration, który mieści najgorszy przypadek trasy', () => {
  const vercel = JSON.parse(read('vercel.json'));
  assert.ok(vercel.rewrites.some((r: { source: string; destination: string }) => r.source === '/api/(.*)' && r.destination.startsWith('/api?')), 'rewrite /api/* → funkcja');
  const maxDuration = vercel.functions['api/index.js'].maxDuration;
  assert.equal(maxDuration, 60);
  assert.match(read('api/serverless.ts'), /export const maxDuration = 60;/);
  // najgorszy przypadek: dwie próby po limicie czasu jednego wywołania + odczyty bazy (zapas ≥ 10 s)
  const worstMs = FREE_PRACTICE_CALL_TIMEOUT_MS * FREE_PRACTICE_MAX_ATTEMPTS;
  assert.ok(worstMs + 10_000 <= maxDuration * 1000, `${worstMs} ms + 10 s zapasu > ${maxDuration} s`);
  assert.ok(vercel.rewrites[0].destination.includes('__url=/api/$1'));
});

test('trasa jest cienka: klucz AI, stały model Gemini, limit z konfiguracji serwera, uid z zweryfikowanego tokenu', () => {
  const src = strip(read('server.ts'));
  const route = src.slice(src.indexOf('app.post("/api/free-practice/generate"'), src.indexOf('app.post("/api/openai", requireFirebaseAuth'));
  assert.ok(route.length > 600);
  assert.match(route, /handleFreePracticeGenerate\(/);
  assert.match(route, /uid: \(req as any\)\.userUid as string, body: req\.body/);
  assert.doesNotMatch(route, /req\.body\??\.(role|uid|userUid|isTeacher|unlimited|limit)/);
  assert.doesNotMatch(route, /req\.headers/);
  assert.match(route, /model: FREE_PRACTICE_MODEL/);
  assert.match(route, /thinkingBudget: 0/);
  assert.match(route, /responseMimeType: "application\/json"/);
  assert.doesNotMatch(route, /openai|anthropic|deepseek|AI_MODEL_CASCADE|GEMINI_MODEL_CASCADE/i);
  assert.match(route, /limit: resolveDailyLimit\(process\.env\.FREE_PRACTICE_DAILY_LIMIT\)/);
  assert.match(route, /setTimeout\(\(\) => reject\(new Error\("Przekroczono limit czasu generowania\."\)\), FREE_PRACTICE_CALL_TIMEOUT_MS\)/, 'limit czasu jednego wywołania modelu');
  // logi trasy przechodzą wyłącznie przez wpisy zbudowane w handlerze (buildUsageLog)
  assert.match(route, /log: \(entry\) => console\.info\("\[free-practice\]", JSON\.stringify\(entry\)\)/);
});

test('handler: walidacja → dostępność modelu → rola z bazy → rezerwacja → kontekst → model → zwrot slotu w catch', () => {
  const src = strip(read('utils/freePracticeHandler.ts'));
  const body = src.slice(src.indexOf('export async function handleFreePracticeGenerate'));
  const order = ['parseGenerateRequest(input.body)', 'deps.modelAvailable', 'readUserDoc(', 'isUnlimitedRole(userData.role)', 'reserveSlot(', 'loadStudentContext(', 'generateFreePracticeExercises(', 'releaseSlot('];
  let last = -1;
  for (const marker of order) {
    const at = body.indexOf(marker);
    assert.ok(at > last, `${marker} w złej kolejności lub brak`);
    last = at;
  }
  assert.match(body, /status: 429[\s\S]*error: 'daily_limit'[\s\S]*resetsAt: nextWarsawMidnight/);
  assert.match(body, /catch \(err\) \{[\s\S]*releaseSlot\(deps\.usageDb, input\.uid, reservation\.day/);
  // logi: tylko skrót uid i wpisy z buildUsageLog
  assert.doesNotMatch(body, /console\./);
});

test('reguły Firestore i storage BEZ ZMIAN: kolekcja freePracticeUsage jest zamknięta dla klienta (zapis tylko Admin SDK)', () => {
  assert.doesNotMatch(read('firestore.rules'), /freePracticeUsage/);
  assert.doesNotMatch(read('storage.rules'), /freePracticeUsage/);
});

test('moduły serwerowe nie ciągną SDK klienta Firebase (bundle serwera, node:test)', () => {
  for (const file of ['utils/freePracticeGeneration.ts', 'utils/freePracticeContext.ts', 'utils/freePracticeQuota.ts', 'utils/freePracticeHandler.ts', 'utils/weaknesses.ts', 'utils/learningProfileHydrate.ts', 'utils/sanitizeFreeText.ts']) {
    assert.doesNotMatch(strip(read(file)), /from ['"](\.\.\/)*firebase|from ['"]firebase\/|services\/learningProfile|geminiService/, file);
  }
});
