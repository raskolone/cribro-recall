/**
 * Test przeglądarkowy PRZEPŁYWU (VOCAB-DUP-6): prawdziwe Dashboard → TodayScreen → „Słownictwo” → „Ucz się” →
 * FlashcardStudyScreen → wyjście, z Firebase zastąpionym bazą w pamięci. Sprawdza, GDZIE ląduje kursant po
 * każdej ścieżce wyjścia z nauki (zakładka „Słownictwo” vs pulpit) i że inne wejścia w naukę wracają na pulpit.
 *
 *   npm run test:browser:flow
 *
 * Nie sprawdza: prawdziwego Firestore, logowania, zapisu sesji w bazie.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { repo, req, newWorkDir, compileCss, serve, pageHtml, bundle, memoryFirebasePlugin } from './harness.mjs';

const { chromium } = req('playwright');
const work = newWorkDir('vocab-return-');
const shots = join(homedir(), '.cribro-backups', 'vocab-dup-6');
mkdirSync(shots, { recursive: true });

const lessons = [
  ['lesson-1785854172295', '2026-08-04', 'Codzienne nawyki i jedzenie', ['apple - jabłko', 'bread - chleb', 'water - woda']],
  ['lesson-1785949714244', '2026-08-05', 'Silo and Fallout', ['shelter - schron', 'danger - niebezpieczeństwo']],
  ['lesson-1792227283563-569854', '2026-10-16', 'Present Simple', ['usually - zazwyczaj', 'rarely - rzadko', 'often - często']],
];
const seed = {};
lessons.forEach(([id, date, topic, vocab], i) => {
  seed[`users/u/lessonRecords/${id}`] = { date, topic, vocabularyText: vocab.join('\n'), createdAt: `${date}T10:00:00.000Z`, summary: 'x' };
  const setId = `set-lesson-${id}`;
  seed[`sets/${setId}`] = { userId: 'u', title: topic, isLessonVocabulary: true, cardCount: vocab.length, isPublic: false, createdAt: `2026-10-17T08:0${i}:00.000Z`, updatedAt: `2026-10-17T08:0${i}:00.000Z`, lessonDate: date, lessonTopic: topic };
  vocab.forEach((line, j) => {
    const [term, definition] = line.split(' - ');
    seed[`sets/${setId}/flashcards/c${i}${j}`] = { term, definition, termLanguage: 'en', position: j, userId: 'u' };
  });
});

seed['sets/assigned1'] = { userId: 'u', title: 'Dodatkowy zestaw od lektora', cardCount: 2, assignedByTeacher: true, isPublic: false, createdAt: '2026-10-17T09:00:00.000Z', updatedAt: '2026-10-17T09:00:00.000Z' };
seed['sets/assigned1/flashcards/a1'] = { term: 'one', definition: 'jeden', termLanguage: 'en', position: 0, userId: 'u' };
seed['sets/assigned1/flashcards/a2'] = { term: 'two', definition: 'dwa', termLanguage: 'en', position: 1, userId: 'u' };

writeFileSync(join(work, 'entry.tsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import ${JSON.stringify(join(repo, 'i18n'))};
import { ThemeProvider } from ${JSON.stringify(join(repo, 'context/ThemeContext'))};
import { LanguageProvider } from ${JSON.stringify(join(repo, 'context/LanguageContext'))};
import { AuthContext } from ${JSON.stringify(join(repo, 'context/AuthContext'))};
import { VocabularyProvider } from ${JSON.stringify(join(repo, 'context/VocabularyContext'))};
import { SettingsProvider } from ${JSON.stringify(join(repo, 'context/SettingsContext'))};
import { FlashcardProvider } from ${JSON.stringify(join(repo, 'context/FlashcardContext'))};
import Dashboard from ${JSON.stringify(join(repo, 'components/dashboard/Dashboard'))};

const user = { id: 'u', username: 'monika', email: 'u@example.com', role: 'user', name: 'Monika', dismissedNotifications: [], streakCount: 0 };
const auth = new Proxy({ user, isAuthReady: true, authError: null }, { get: (t, k) => (k in t ? t[k] : async () => ({})) });
createRoot(document.getElementById('root')).render(
  <ThemeProvider><LanguageProvider><AuthContext.Provider value={auth as any}>
    <VocabularyProvider><SettingsProvider><FlashcardProvider><Dashboard /></FlashcardProvider></SettingsProvider></VocabularyProvider>
  </AuthContext.Provider></LanguageProvider></ThemeProvider>);
`);

await bundle(work, join(work, 'entry.tsx'), [memoryFirebasePlugin(work, seed)]);
await compileCss(work);
const { server, base } = serve(work, pageHtml);
const browser = await chromium.launch();

const failures = [];
const results = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

async function newPage(w = 1100) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('app_language', 'pl'); localStorage.setItem('has_seen_onboarding', 'true'); localStorage.setItem('cribro_tour_seen', 'true'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base);
  return { page, ctx, errors };
}

/** Gdzie jest kursant: zakładka „Słownictwo” (lista zestawów), pulpit (kafelki), nauka, inne. */
async function where(page) {
  return page.evaluate(() => {
    const t = document.body.innerText;
    if (document.querySelector('[data-testid="flashcard-sets-screen"]')) return 'zakładka Słownictwo (lista zestawów)';
    if (/Opanowano \d+ z \d+|Ukończono|Wynik|Gratulacje/i.test(t) || document.querySelector('[data-testid="flashcard-counter"]')) return 'nauka fiszek';
    if (document.querySelector('[data-coach="tour-resources"], #tour-resources, [id="tour-resources"]') || /Moje zasoby/.test(t)) return 'pulpit';
    return 'inne: ' + t.slice(0, 80).replace(/\n/g, ' | ');
  });
}

async function dismissTour(page) {
  // Samouczek z dymkami przykrywa panel przy pierwszym wejściu — zamykamy go jak kursant.
  if (await page.getByText('Wszystko, co dziś ważne').isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    if (await page.getByText('Wszystko, co dziś ważne').isVisible().catch(() => false)) {
      await page.locator('button[aria-label*="amknij"], button[aria-label*="lose"]').first().click();
    }
    await page.waitForTimeout(400);
  }
}

async function openVocab(page) {
  await dismissTour(page);
  await page.getByText('Moje zasoby', { exact: false }).first().click();
  await page.getByRole('button', { name: 'Słownictwo', exact: true }).click();
  await page.waitForSelector('[data-testid="flashcard-sets-screen"]');
  await page.waitForSelector('[data-testid="vocab-set-card"]');
}

async function startStudy(page) {
  const card = page.locator('[data-testid="vocab-set-card"]', { hasText: 'Codzienne nawyki' }).first();
  await card.getByRole('button', { name: /Ucz się/ }).click();
  await page.waitForSelector('[data-testid="flashcard-counter"]', { timeout: 8000 });
}

const quitViaButton = async (page) => {
  await page.getByRole('button', { name: /Zakończ|Wyjdź|quit/i }).first().click();
  const confirm = page.locator('[role="dialog"], .fixed.inset-0').getByRole('button', { name: /Zakończ|Tak|Potwierdź|OK/i }).last();
  await confirm.click();
};

/** Przerabia talię do końca („UMIEM” na każdej karcie) i zostawia kursanta na ekranie podsumowania. */
async function finishDeck(page) {
  for (let i = 0; i < 30; i++) {
    if (await page.locator('[data-testid="flashcard-counter"]').count() === 0) break;
    await page.locator('[data-testid="flashcard-flip"]').click().catch(() => {});
    await page.getByRole('button', { name: /^Umiem/ }).click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(500);
}
const summaryButton = (testId) => async (page) => {
  await finishDeck(page);
  if (process.env.DEBUG_FLOW) console.log('PODSUMOWANIE:', JSON.stringify(await page.locator('button').allInnerTexts()));
  await page.getByTestId(testId).click();
};

const exits = {
  'Zakończ (strzałka u góry) + potwierdzenie': quitViaButton,
  'klawisz Escape': async (page) => { await page.keyboard.press('Escape'); },
  'podsumowanie talii → Wróć do menu': summaryButton('whats-next-back'),
};

/** Scenariusze „po drodze coś się dzieje”: F5 w trakcie nauki; wstecz/do przodu przeglądarki. */
const prep = {
  'F5 w trakcie nauki → Zakończ': async (page) => { await page.reload(); await page.waitForSelector('[data-testid="flashcard-counter"]', { timeout: 8000 }); await dismissTour(page); },
  'wstecz i do przodu przeglądarki → Zakończ': async (page) => {
    await page.goBack(); await page.waitForSelector('[data-testid="flashcard-sets-screen"]');
    await page.goForward(); await page.waitForSelector('[data-testid="flashcard-counter"]', { timeout: 8000 });
  },
};
for (const [name, before] of Object.entries(prep)) exits[name] = async (page) => { await before(page); await quitViaButton(page); };

const TAB = /zakładka Słownictwo/;
const DASH = /^pulpit/;
/** Scenariusze regresji: powrót ze statystyk, inne wejścia w naukę (mają wracać na pulpit), powiadomienie. */
const extra = {
  'statystyki zestawu → Wróć': { expect: TAB, run: async (page) => {
    const card = page.locator('[data-testid="vocab-set-card"]', { hasText: 'Codzienne nawyki' }).first();
    await card.getByRole('button', { name: 'Statystyki' }).click();
    await page.getByRole('button', { name: /←/ }).first().click();
  }, noStudy: true },
  'nauka z „Ostatnia lekcja” → Zakończ': { expect: DASH, run: async (page) => {
    await page.getByText('Present Simple').first().click();
    await page.getByRole('button', { name: /Fiszki$/ }).first().click({ timeout: 5000 });
    await page.waitForSelector('[data-testid="flashcard-counter"]', { timeout: 8000 }).catch(() => { throw new Error('nauka z Ostatniej lekcji nie wystartowała'); });
    await quitViaButton(page);
  }, noVocab: true },
  'powiadomienie „Nowy materiał” → zakładka': { expect: TAB, run: async (page) => {
    await page.getByText('Nowy materiał', { exact: false }).first().click();
  }, noVocab: true, noStudy: true },
};

const scenarioLines = [];
const all = [
  ...Object.entries(exits).map(([name, exit]) => [name, { expect: name === 'klawisz Escape' ? /nauka fiszek/ : TAB, run: exit }]),
  ...Object.entries(extra),
];
for (const [name, sc] of all) {
  const { page, ctx, errors } = await newPage();
  try {
    await page.waitForSelector('text=Moje zasoby', { timeout: 10000 });
    await dismissTour(page);
    if (!sc.noVocab) await openVocab(page);
    if (!sc.noStudy && !sc.noVocab) await startStudy(page);
    await sc.run(page);
    await page.waitForTimeout(700);
    const w = await where(page);
    scenarioLines.push(`${name}: ${w}`);
    await page.screenshot({ path: join(shots, `exit-${name.replace(/\W+/g, '_')}.png`) });
    if (!sc.expect.test(w)) failures.push(`${name}: oczekiwano ${sc.expect}, jest: ${w}`);
    if (errors.length) failures.push(`${name}: błędy strony: ${errors.slice(0, 2).join(' | ')}`);
  } catch (e) {
    failures.push(`${name}: wyjątek ${String(e).split('\n')[0]}; stan: ${await where(page).catch(() => '?')}`);
    await page.screenshot({ path: join(shots, `error-${name.replace(/\W+/g, '_')}.png`) }).catch(() => {});
  }
  await ctx.close();
}
await browser.close();
server.close();
console.log(scenarioLines.join('\n'));
if (failures.length) { console.error('\nNIEPOWODZENIA:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log('\nOK: ' + all.length + ' scenariuszy wyjścia/powrotu przeszło.');
