import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SpecialTask } from '../types';
import {
  homeworkRowKey,
  LEGACY_VIEW_MODE_KEY,
  readViewMode,
  selectHomeworkViewRows,
  viewModeStorageKey,
  viewScopeFor,
  writeViewMode,
} from '../utils/homeworkListView';

const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const task = (id: string, over: Partial<SpecialTask> = {}): SpecialTask =>
  ({
    id,
    studentId: `u_${id}`,
    studentUid: `u_${id}`,
    studentName: `Kursant ${id}`,
    title: `Praca ${id}`,
    type: 'translation',
    sentences: [],
    status: 'assigned',
    createdAt: '2026-10-01T10:00:00.000Z',
    ...over,
  }) as unknown as SpecialTask;

const g1 = (id: string, over: Partial<SpecialTask> = {}) =>
  task(id, { homeworkSetId: 'set_g1', groupId: 'g1', groupName: 'Test061026', title: 'Travel', ...over });

const tasks = [
  g1('a'),
  g1('b', { status: 'submitted' }),
  g1('c'),
  // druga praca tej samej grupy, jeden dokument → wiersz pojedynczy
  g1('solo', { homeworkSetId: 'set_g1_old', title: 'Phrasal verbs', studentName: 'Kasia Nowak' }),
  // sprawdzona praca grupy → archiwum, nie zakładka „Prace domowe"
  g1('d1', { homeworkSetId: 'set_g1_done', status: 'graded', teacherRead: true }),
  g1('d2', { homeworkSetId: 'set_g1_done', status: 'graded', teacherRead: true }),
  // inna grupa
  task('x', { homeworkSetId: 'set_g2', groupId: 'g2', groupName: 'Czwartek' }),
  task('y', { homeworkSetId: 'set_g2', groupId: 'g2', groupName: 'Czwartek' }),
  // praca indywidualna bez grupy
  task('p'),
];

const select = (over: Partial<Parameters<typeof selectHomeworkViewRows>[0]> = {}) =>
  selectHomeworkViewRows({
    tasks,
    groupId: null,
    collapseGroups: true,
    status: 'all',
    search: '',
    getName: (t) => t.studentName || '',
    ...over,
  });

const keys = (rows: ReturnType<typeof select>['visibleActive']) => rows.map(homeworkRowKey);

// Tabela: filtr → oczekiwane wiersze zakładki „Prace domowe". Lista i Kafelki
// dostają dokładnie ten wynik (patrz test strukturalny niżej).
const cases: Array<{ name: string; over: Parameters<typeof select>[0]; expected: string[] }> = [
  {
    name: 'filtr grupy: tylko wiersze grupy g1, bez sprawdzonych',
    over: { groupId: 'g1' },
    expected: ['set:set_g1', 'task:solo'],
  },
  {
    name: 'filtr grupy + wyszukiwarka po tytule',
    over: { groupId: 'g1', search: 'phrasal' },
    expected: ['task:solo'],
  },
  {
    name: 'filtr grupy + wyszukiwarka po kursancie (członek wiersza grupowego)',
    over: { groupId: 'g1', search: 'kursant b' },
    expected: ['set:set_g1'],
  },
  {
    name: 'filtr grupy + status „przesłane": wiersz grupowy, bo jeden członek czeka',
    over: { groupId: 'g1', status: 'submitted' },
    expected: ['set:set_g1'],
  },
  {
    name: 'zwinięte wiersze grupowe wyłączone (wybrany kursant): dokumenty osobno',
    over: { groupId: 'g1', collapseGroups: false },
    expected: ['task:a', 'task:b', 'task:c', 'task:solo'],
  },
  {
    name: 'filtr grupy nieistniejącej: pusto',
    over: { groupId: 'g404' },
    expected: [],
  },
  {
    name: 'bez filtra: wszystkie niesprawdzone, grupy zwinięte',
    over: {},
    expected: ['set:set_g1', 'set:set_g2', 'task:solo', 'task:p'],
  },
];

for (const c of cases) {
  test(`wiersze widoku: ${c.name}`, () => {
    // Kolejność z buildHomeworkRows (najnowsze pierwsze, remisy po wejściu) nie jest
    // przedmiotem testu — porównujemy zestaw.
    assert.deepEqual(keys(select(c.over).visibleActive).sort(), [...c.expected].sort());
  });
}

test('wiersze widoku: te same wejście i filtry dają ten sam wynik za każdym razem (bez stanu ukrytego)', () => {
  const over = { groupId: 'g1', search: 'travel' };
  assert.deepEqual(keys(select(over).visibleActive), keys(select(over).visibleActive));
});

test('wiersze widoku: archiwum respektuje filtr grupy i wyszukiwarkę', () => {
  assert.deepEqual(select({ groupId: 'g1' }).visibleArchived.map(homeworkRowKey), ['set:set_g1_done']);
  assert.deepEqual(select({ groupId: 'g2' }).visibleArchived.map(homeworkRowKey), []);
  assert.deepEqual(select({ groupId: 'g1', search: 'zzz' }).visibleArchived.map(homeworkRowKey), []);
});

test('wiersze widoku: wybrany kursant zawęża wiersze', () => {
  const rows = select({ matchesStudent: (t) => t.studentId === 'u_p', collapseGroups: false }).visibleActive;
  assert.deepEqual(keys(rows), ['task:p']);
});

test('HomeworkScreen: Lista i Kafelki rysują ten sam `homeworkRows`, a wiersze liczy jedna funkcja', () => {
  const screen = src('components/dashboard/HomeworkScreen.tsx');
  assert.match(screen, /rows=\{isTeacher \? homeworkRows : undefined\}/, 'lista bierze homeworkRows');
  assert.match(screen, /\{homeworkRows\.map\(\(row\) =>/, 'kafelki biorą homeworkRows');
  assert.doesNotMatch(screen, /rows=\{isTeacher \? visibleActiveRows/, 'lista nie ma własnego zestawu');
  assert.doesNotMatch(screen, /buildHomeworkRows\(|filterHomeworkRows\(/, 'filtrowanie tylko w utils/homeworkListView');
  assert.match(screen, /selectHomeworkViewRows\(\{/);
});

// ── widok zapamiętany per sekcja ──────────────────────────────────────────

const fakeStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
};

test('widok: sekcje mają różne klucze', () => {
  assert.notEqual(viewModeStorageKey('work-center'), viewModeStorageKey('student-profile'));
  assert.notEqual(viewModeStorageKey('work-center'), LEGACY_VIEW_MODE_KEY);
  assert.equal(viewScopeFor(true), 'work-center');
  assert.equal(viewScopeFor(false), 'student-profile');
});

test('widok: zmiana w jednej sekcji nie zmienia drugiej', () => {
  const storage = fakeStorage();
  assert.equal(readViewMode(storage, 'work-center'), 'list');
  assert.equal(readViewMode(storage, 'student-profile'), 'list');

  writeViewMode(storage, 'work-center', 'tiles');
  assert.equal(readViewMode(storage, 'work-center'), 'tiles');
  assert.equal(readViewMode(storage, 'student-profile'), 'list');

  writeViewMode(storage, 'student-profile', 'list');
  writeViewMode(storage, 'work-center', 'list');
  writeViewMode(storage, 'student-profile', 'tiles');
  assert.equal(readViewMode(storage, 'work-center'), 'list');
  assert.equal(readViewMode(storage, 'student-profile'), 'tiles');
});

test('widok: dawny wspólny klucz to tylko wartość startowa, własny wybór go wyprzedza', () => {
  const storage = fakeStorage({ [LEGACY_VIEW_MODE_KEY]: 'tiles' });
  assert.equal(readViewMode(storage, 'work-center'), 'tiles');
  assert.equal(readViewMode(storage, 'student-profile'), 'tiles');

  writeViewMode(storage, 'work-center', 'list');
  assert.equal(readViewMode(storage, 'work-center'), 'list');
  assert.equal(readViewMode(storage, 'student-profile'), 'tiles');
  assert.equal(storage.data.get(LEGACY_VIEW_MODE_KEY), 'tiles', 'dawny klucz nietknięty');
});

test('widok: brak lub błąd localStorage → Lista, zapis nie wyrzuca', () => {
  const broken = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
  };
  assert.equal(readViewMode(broken, 'work-center'), 'list');
  assert.equal(readViewMode(null, 'work-center'), 'list');
  assert.doesNotThrow(() => writeViewMode(broken, 'work-center', 'tiles'));
  assert.doesNotThrow(() => writeViewMode(undefined, 'work-center', 'tiles'));
});

test('widok: nieznana wartość w storage → Lista', () => {
  const storage = fakeStorage({ [viewModeStorageKey('work-center')]: 'grid' });
  assert.equal(readViewMode(storage, 'work-center'), 'list');
});

test('HomeworkScreen: klucz widoku z sekcji, bez wspólnego klucza w kodzie ekranu', () => {
  const screen = src('components/dashboard/HomeworkScreen.tsx');
  assert.match(screen, /viewScopeFor\(headless\)/);
  assert.match(screen, /readViewMode\(localStorage, viewScope\)/);
  assert.match(screen, /writeViewMode\(localStorage, viewScope,/);
  assert.doesNotMatch(screen, /'cribro:homework-view'/);
});
