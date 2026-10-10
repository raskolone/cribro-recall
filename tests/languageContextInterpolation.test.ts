// `t` z LanguageContext przyjmuje WYŁĄCZNIE klucz — drugi argument (interpolacja) jest ignorowany, więc
// `t('Opanowano {{mastered}} z {{total}}', {...})` pokazywał kursantowi surowy szablon z klamrami.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name.startsWith('.')) return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.tsx$/.test(name) ? [full] : [];
  });

test('LanguageContext.t nie przyjmuje opcji (dlatego interpolacja wymaga i18n.t)', () => {
  const src = readFileSync(join(root, 'context/LanguageContext.tsx'), 'utf8');
  assert.match(src, /const t = \(key: string\): string =>/);
});

test('żaden komponent nie woła t(...) z LanguageContext na kluczu z {{interpolacją}}', () => {
  const offenders: string[] = [];
  for (const file of [...walk(join(root, 'components')), join(root, 'App.tsx')]) {
    const text = readFileSync(file, 'utf8');
    // `t` pochodzi z useLanguage() (a nie z useTranslation()) tylko w plikach z takim destrukturyzowaniem.
    const fromContext = /const \{[^}]*\bt\b[^}]*\} = useLanguage\(\)/.test(text) && !/const \{[^}]*\bt\b[^}]*\} = useTranslation\(\)/.test(text);
    if (!fromContext) continue;
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of code.matchAll(/(?<![.\w])t\(\s*(['"`])[^'"`]*\{\{[^'"`]*\1/g)) offenders.push(`${file.replace(root, '')}: ${m[0].slice(0, 70)}`);
  }
  assert.deepEqual(offenders, []);
});

test('licznik fiszek „Opanowano N z M" interpoluje przez i18n.t', () => {
  const src = readFileSync(join(root, 'components/flashcards/FlashcardStudyScreen.tsx'), 'utf8');
  assert.match(src, /\{i18n\.t\('Opanowano \{\{mastered\}\} z \{\{total\}\}', \{/);
  assert.doesNotMatch(src, /\{t\('Opanowano/);
});
