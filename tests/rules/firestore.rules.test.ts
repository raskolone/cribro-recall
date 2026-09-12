import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

/**
 * Reguły Firestore na emulatorze.
 *
 * Reguły wdraża się natychmiast i globalnie — nie ma stopniowego wdrożenia,
 * a błąd odcina wszystkich naraz. Te testy są jedynym miejscem, w którym da
 * się je sprawdzić przed wysłaniem na produkcję.
 *
 * Nie sprawdzają całego pliku, tylko te własności, których złamanie oznacza
 * wyciek: kto widzi cudzą pracę domową, kto dostaje admina, komu wolno
 * przeczytać notatki prowadzącego i klucz odpowiedzi.
 *
 * Uruchamianie: `npm run test:rules` (emulator wstaje i gaśnie sam).
 * Projekt `demo-` nie wymaga logowania do Firebase — patrz package.json.
 */

const here = dirname(fileURLToPath(import.meta.url));
const RULES = readFileSync(join(here, '..', '..', 'firestore.rules'), 'utf8');

const TEACHER_EMAIL = 'maciej.wyrozumski@gmail.com';

/**
 * Adres, który przechodził przez usunięte dopasowanie `matches('^.*…*$')`.
 * Zawiera adres lektora jako podłańcuch, więc wzorzec z gwiazdkami po obu
 * stronach uznawał go za admina.
 */
const LOOKALIKE_EMAIL = 'maciej.wyrozumski@gmail.com.evil.pl';

let env: RulesTestEnvironment;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cribro',
    firestore: {
      rules: RULES,
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

/** Kursant — zalogowany, bez roli w tokenie. */
const student = (uid: string) => env.authenticatedContext(uid).firestore();

/** Lektor rozpoznawany po dokładnym adresie e-mail. */
const teacherByEmail = () =>
  env.authenticatedContext('teacher-uid', { email: TEACHER_EMAIL }).firestore();

/** Konto z adresem tylko podobnym do adresu lektora. */
const lookalike = () =>
  env.authenticatedContext('evil-uid', { email: LOOKALIKE_EMAIL }).firestore();

/** Zasiew danych z pominięciem reguł. */
const seed = (fn: (db: any) => Promise<unknown>) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore());
  });

// ———————————————————— Prace domowe ————————————————————

test('kursant czyta własną pracę domową', async () => {
  await seed((db) =>
    setDoc(doc(db, 'specialTasks/task-1'), { studentUid: 'ala', title: 'Zadanie' })
  );

  await assertSucceeds(getDoc(doc(student('ala'), 'specialTasks/task-1')));
});

test('kursant nie czyta cudzej pracy domowej', async () => {
  await seed((db) =>
    setDoc(doc(db, 'specialTasks/task-1'), { studentUid: 'ala', title: 'Zadanie' })
  );

  await assertFails(getDoc(doc(student('bob'), 'specialTasks/task-1')));
});

test('kursant odpytuje kolekcję wyłącznie z filtrem po własnym UID', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'specialTasks/task-1'), { studentUid: 'ala' });
    await setDoc(doc(db, 'specialTasks/task-2'), { studentUid: 'bob' });
  });

  const db = student('ala');
  const tasks = collection(db, 'specialTasks');

  // Tak pyta aplikacja (utils/homework.ts → studentTasksQuery).
  await assertSucceeds(getDocs(query(tasks, where('studentUid', '==', 'ala'))));

  // Pobranie całej kolekcji i odsianie cudzych zadań w przeglądarce —
  // dokładnie to, co robiła stara wersja panelu.
  await assertFails(getDocs(tasks));

  // Filtr wskazujący na kogoś innego też nie przechodzi.
  await assertFails(getDocs(query(tasks, where('studentUid', '==', 'bob'))));
});

test('kursant odsyła rozwiązanie, ale nie rusza oceny ani przypisania', async () => {
  await seed((db) =>
    setDoc(doc(db, 'specialTasks/task-1'), {
      studentUid: 'ala',
      status: 'pending',
      grade: null,
    })
  );

  const db = student('ala');

  await assertSucceeds(
    updateDoc(doc(db, 'specialTasks/task-1'), {
      status: 'submitted',
      studentAnswers: ['a'],
      submittedAt: '2026-09-07T10:00:00Z',
    })
  );

  // Ocena należy do lektora.
  await assertFails(updateDoc(doc(db, 'specialTasks/task-1'), { grade: 100 }));

  // Przepisanie zadania na siebie odpada.
  await assertFails(updateDoc(doc(db, 'specialTasks/task-1'), { studentUid: 'ala2' }));
});

test('kursant nie wystawia sobie pracy domowej', async () => {
  await assertFails(
    setDoc(doc(student('ala'), 'specialTasks/nowe'), { studentUid: 'ala', title: 'Sam sobie' })
  );
});

// ———————————————————— Kto jest adminem ————————————————————

test('lektor po dokładnym adresie e-mail czyta prace wszystkich', async () => {
  await seed((db) => setDoc(doc(db, 'specialTasks/task-1'), { studentUid: 'ala' }));

  await assertSucceeds(getDoc(doc(teacherByEmail(), 'specialTasks/task-1')));
  await assertSucceeds(getDocs(collection(teacherByEmail(), 'specialTasks')));
});

test('adres zawierający adres lektora jako podłańcuch nie daje admina', async () => {
  await seed((db) => setDoc(doc(db, 'specialTasks/task-1'), { studentUid: 'ala' }));

  // Ten test pilnuje usuniętego `matches('^.*maciej…*$')`. Gdyby wzorzec
  // wrócił, konto z adresem w cudzej domenie znów dostałoby pełne prawa.
  await assertFails(getDoc(doc(lookalike(), 'specialTasks/task-1')));
  await assertFails(getDocs(collection(lookalike(), 'specialTasks')));
});

test('rola teacher w dokumencie użytkownika daje prawa lektora', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'users/lektor'), { username: 'Lektor', role: 'teacher' });
    await setDoc(doc(db, 'specialTasks/task-1'), { studentUid: 'ala' });
  });

  await assertSucceeds(getDoc(doc(student('lektor'), 'specialTasks/task-1')));
});

test('kursant nie awansuje się sam na admina', async () => {
  await seed((db) =>
    setDoc(doc(db, 'users/ala'), { username: 'Ala', email: 'ala@x.pl', role: 'user' })
  );

  await assertFails(updateDoc(doc(student('ala'), 'users/ala'), { role: 'admin' }));
});

// ———————————————————— Materiały lektora ————————————————————

test('kursant nie czyta prezentacji przypisanej do własnego konta', async () => {
  // Talia niesie speakerNotes i odpowiedzi do ćwiczeń, których kursant
  // jeszcze nie widział — slajd dostaje kanałem między oknami, nie z bazy.
  await seed((db) =>
    setDoc(doc(db, 'users/ala/presentations/p1'), { speakerNotes: 'klucz odpowiedzi' })
  );

  await assertFails(getDoc(doc(student('ala'), 'users/ala/presentations/p1')));
  await assertSucceeds(getDoc(doc(teacherByEmail(), 'users/ala/presentations/p1')));
});

test('kursant nie czyta cudzego profilu', async () => {
  await seed((db) => setDoc(doc(db, 'users/bob'), { username: 'Bob', role: 'user' }));

  await assertFails(getDoc(doc(student('ala'), 'users/bob')));
  await assertSucceeds(getDoc(doc(student('bob'), 'users/bob')));
});

// ———————————————————— Testy otwarte ————————————————————

test('test otwarty otwiera się po kodzie, ale lista testów nie', async () => {
  await seed((db) =>
    setDoc(doc(db, 'publicTests/ABC123'), { title: 'Test', questions: [] })
  );

  const anon = env.unauthenticatedContext().firestore();

  // Kandydat nie ma konta, a kod jest zarazem id dokumentu.
  await assertSucceeds(getDoc(doc(anon, 'publicTests/ABC123')));

  // Bez tego rozróżnienia jedno zapytanie oddawało wszystkie testy
  // razem z kluczami odpowiedzi.
  await assertFails(getDocs(collection(anon, 'publicTests')));
});

test('podejścia kandydatów są zapisywalne, ale nieczytelne bez uprawnień lektora', async () => {
  await seed((db) => setDoc(doc(db, 'publicTests/ABC123'), { title: 'Test' }));

  const anon = env.unauthenticatedContext().firestore();

  await assertSucceeds(
    setDoc(doc(anon, 'publicTests/ABC123/submissions/s1'), {
      candidateName: 'Jan Kowalski',
      answers: { q1: 'odpowiedź' },
      submittedAt: '2026-09-07T10:00:00Z',
    })
  );

  // Kolejny kandydat nie podejrzy odpowiedzi poprzednika.
  await assertFails(getDoc(doc(anon, 'publicTests/ABC123/submissions/s1')));
  await assertSucceeds(getDoc(doc(teacherByEmail(), 'publicTests/ABC123/submissions/s1')));
});

// ———————————————————— Krzywa uczenia ————————————————————

test('profil krzywej uczenia przyjmuje tylko poziomy ze skali CEFR', async () => {
  const db = student('ala');
  const base = {
    studentId: 'ala',
    baseLevel: 'B1',
    currentLevel: 'B1',
    totalAttempts: 10,
    totalCorrect: 7,
  };

  await assertSucceeds(setDoc(doc(db, 'users/ala/profile/learningCurve'), base));

  // Dokument zapisuje przeglądarka kursanta, a czyta go lektor jako raport
  // postępów — bez kontroli typów do raportu wchodzi dowolna wartość.
  await assertFails(
    setDoc(doc(db, 'users/ala/profile/learningCurve'), { ...base, currentLevel: 'Z9' })
  );
  await assertFails(
    setDoc(doc(db, 'users/ala/profile/learningCurve'), { ...base, totalAttempts: 'dużo' })
  );
});

test('profil krzywej uczenia nie rośnie bez końca', async () => {
  const db = student('ala');

  await assertFails(
    setDoc(doc(db, 'users/ala/profile/learningCurve'), {
      studentId: 'ala',
      baseLevel: 'B1',
      currentLevel: 'B1',
      totalAttempts: 1,
      totalCorrect: 1,
      recentOutcomes: new Array(101).fill('ok'),
    })
  );
});

test('kursant nie zapisuje profilu na cudzym koncie', async () => {
  await assertFails(
    setDoc(doc(student('ala'), 'users/bob/profile/learningCurve'), {
      studentId: 'bob',
      baseLevel: 'B1',
      currentLevel: 'B1',
      totalAttempts: 1,
      totalCorrect: 1,
    })
  );
});

// ———————————————————— Notatnik (Scratchpad) po kodzie PIN ————————————————————

test('notatnik otwiera się po znanym ID, ale lista notatników nie', async () => {
  await seed((db) =>
    setDoc(doc(db, 'scratchpads/sp_ala'), {
      pin: 'ABCDEF',
      teacherUid: 'teacher-uid',
      studentId: 'ala',
      contentHtml: '<p>notatki</p>',
    })
  );

  const anon = env.unauthenticatedContext().firestore();

  // Link ze znanym ID działa bez logowania — to jest zamierzone udostępnianie.
  await assertSucceeds(getDoc(doc(anon, 'scratchpads/sp_ala')));

  // `list` był prawdziwą dziurą: jedno zapytanie wylistowałoby notatniki
  // wszystkich kursantów. Zamknięte bez wyjątku, nawet dla admina/lektora.
  await assertFails(getDocs(collection(anon, 'scratchpads')));
  await assertFails(getDocs(collection(teacherByEmail(), 'scratchpads')));
});

test('indeks PIN → ID odczytuje każdy, ale nie da się go wylistować', async () => {
  await seed((db) =>
    setDoc(doc(db, 'scratchpadPins/ABCDEF'), { scratchpadId: 'sp_ala' })
  );

  const anon = env.unauthenticatedContext().firestore();

  await assertSucceeds(getDoc(doc(anon, 'scratchpadPins/ABCDEF')));
  await assertFails(getDocs(collection(anon, 'scratchpadPins')));
});

test('lektor-właściciel i kursant, dla którego notatnik powstał, zapisują wpis w indeksie PIN', async () => {
  await seed((db) =>
    setDoc(doc(db, 'scratchpads/sp_ala'), {
      pin: 'ABCDEF',
      teacherUid: 'teacher-uid',
      studentId: 'ala',
    })
  );

  await assertSucceeds(
    setDoc(doc(teacherByEmail(), 'scratchpadPins/ABCDEF'), { scratchpadId: 'sp_ala' })
  );
  await assertSucceeds(
    setDoc(doc(student('ala'), 'scratchpadPins/ABCDEF'), { scratchpadId: 'sp_ala' })
  );
});

test('kursant nie przejmuje cudzego PIN-u, przekierowując go na inny notatnik', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'scratchpads/sp_ala'), {
      pin: 'ABCDEF',
      teacherUid: 'teacher-uid',
      studentId: 'ala',
    });
    await setDoc(doc(db, 'scratchpads/sp_bob'), {
      pin: 'GHJKMN',
      teacherUid: 'teacher-uid',
      studentId: 'bob',
    });
    // Wpis istnieje już wcześniej — atak to próba jego nadpisania.
    await setDoc(doc(db, 'scratchpadPins/ABCDEF'), { scratchpadId: 'sp_ala' });
  });

  // Bob nie ma żadnego związku z notatnikiem Ali — nie może ani stworzyć
  // nowego wpisu wskazującego na jej dokument, ani nadpisać istniejącego.
  await assertFails(
    setDoc(doc(student('bob'), 'scratchpadPins/ABCDEF'), { scratchpadId: 'sp_bob' })
  );
  await assertFails(
    updateDoc(doc(student('bob'), 'scratchpadPins/ABCDEF'), { scratchpadId: 'sp_bob' })
  );

  // Wpis wskazujący na nieistniejący dokument też odpada — nie da się go
  // zweryfikować, więc domyślnie brak zaufania.
  await assertFails(
    setDoc(doc(student('bob'), 'scratchpadPins/NOWY99'), { scratchpadId: 'nie-istnieje' })
  );
});

test('admin zarządza indeksem PIN niezależnie od właściciela notatnika', async () => {
  await seed((db) =>
    setDoc(doc(db, 'scratchpads/sp_ala'), {
      pin: 'ABCDEF',
      teacherUid: 'inny-lektor',
      studentId: 'ala',
    })
  );

  await assertSucceeds(
    setDoc(doc(teacherByEmail(), 'scratchpadPins/ABCDEF'), { scratchpadId: 'sp_ala' })
  );
});

test('usunięcie wpisu z indeksu PIN zarezerwowane dla admina', async () => {
  await seed((db) =>
    setDoc(doc(db, 'scratchpads/sp_ala'), {
      pin: 'ABCDEF',
      teacherUid: 'teacher-uid',
      studentId: 'ala',
    }).then(() => setDoc(doc(db, 'scratchpadPins/ABCDEF'), { scratchpadId: 'sp_ala' }))
  );

  await assertFails(deleteDoc(doc(student('ala'), 'scratchpadPins/ABCDEF')));
  await assertSucceeds(deleteDoc(doc(teacherByEmail(), 'scratchpadPins/ABCDEF')));
});

test('plik reguł jest wczytany — inaczej wszystkie testy przechodzą na pustych regułach', () => {
  assert.ok(RULES.includes('service cloud.firestore'), 'firestore.rules nie wygląda na plik reguł');
  assert.ok(RULES.includes('function isAdmin()'), 'brak funkcji isAdmin w regułach');
});
