import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveTeacherNotes } from '../utils/teacherNotes';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('notatki z private/teacher wygrywają ze starym polem dokumentu nadrzędnego', () => {
  assert.equal(resolveTeacherNotes('nowe', 'stare'), 'nowe');
});

test('pusty dokument prywatny to wyczyszczone notatki, a nie powrót do starego pola', () => {
  assert.equal(resolveTeacherNotes('', 'stare'), '');
});

test('bez dokumentu prywatnego (przed migracją) czytamy stare pole', () => {
  assert.equal(resolveTeacherNotes(null, 'stare'), 'stare');
  assert.equal(resolveTeacherNotes(undefined, 'stare'), 'stare');
  assert.equal(resolveTeacherNotes(null, undefined), '');
});

test('serwis zapisuje notatki lektora wyłącznie do private/teacher', () => {
  const src = read('services/scratchpadService.ts');
  // Dokument nadrzędny czyta każdy, kto zna link — tam notatki nie mogą wracać.
  assert.doesNotMatch(src, /updateDoc\([^)]*\{\s*teacherNotes/);
  assert.match(src, /doc\(db, 'scratchpads', id, 'private', 'teacher'\)/);
  // Zapisy całego dokumentu z kopii lokalnej muszą wycinać stare pole.
  const fullWrites = src.match(/setDoc\((ref|scratchpadDocRef\(id\)), [^)]*\)/g) || [];
  assert.ok(fullWrites.length >= 3, 'oczekiwane trzy zapisy całego dokumentu');
  for (const call of fullWrites) {
    if (call.includes('newDoc')) continue; // nowy dokument nie ma teacherNotes
    assert.match(call, /withoutTeacherNotes\(/, call);
  }
});

test('serwis nie listuje kolekcji scratchpads (list zamknięty w regułach)', () => {
  const src = read('services/scratchpadService.ts');
  assert.doesNotMatch(src, /collection\(db, 'scratchpads'\)/);
  assert.doesNotMatch(src, /where\('pin'/);
});

test('edytor i szuflada czytają notatki z hooka, nie z dokumentu nadrzędnego', () => {
  const editor = read('components/scratchpad/ScratchpadEditor.tsx');
  const drawer = read('components/scratchpad/ScratchpadTeacherCompanionDrawer.tsx');
  assert.match(editor, /useScratchpadTeacherNotes\(docData\.id, isTeacher, docData\.teacherNotes\)/);
  // Jedyne odwołanie do starego pola w edytorze to argument awaryjny hooka.
  assert.equal(editor.split('docData.teacherNotes').length - 1, 1);
  assert.doesNotMatch(drawer, /docData\.teacherNotes/);
});
