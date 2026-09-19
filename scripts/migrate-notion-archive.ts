/**
 * Jednorazowa migracja archiwalnej bazy kursantów i lekcji z Notion do Firestore.
 *
 * ŹRÓDŁO DANYCH — ŻYWE, NIE ZAMROŻONY ZRZUT:
 * Jeśli ustawiona jest zmienna `NOTION_API_KEY`, skrypt odpytuje Notion API
 * na żywo (przez `fetchNotionArchive` z `scripts/fetch_notion_dump.mjs` —
 * logika pobierania/parsowania stron Notion żyje wyłącznie tam, żeby nie
 * duplikować jej w dwóch miejscach) i pracuje na stanie bazy z chwili
 * uruchomienia. Tylko gdy `NOTION_API_KEY` nie jest ustawiony, skrypt spada
 * do ostatniego zapisanego `scripts/notion_migration_dump.json` — głośno
 * ostrzegając, że dane mogą być nieaktualne.
 *
 * ŻELAZNA ZASADA DEDUPLIKACJI: jeśli kursant o danym adresie e-mail LUB
 * imieniu i nazwisku już istnieje w Firestore, skrypt BEZWZGLĘDNIE pomija
 * tworzenie nowego rekordu (loguje `[SKIP] Kursant <Imię Nazwisko> już
 * istnieje w bazie – pomijam.`) i dopisuje tylko te lekcje z Notion, których
 * data nie występuje jeszcze w jego historii (`users/{uid}/lessonRecords`).
 * Dla nowo tworzonych kursantów mapowane są wszystkie ich lekcje.
 *
 * UWIERZYTELNIANIE — Firebase Admin SDK, nie logowanie jako lektor:
 * Skrypt pisze do Firestore przez `firebase-admin` (ten sam wzorzec
 * poświadczeń co `server.ts` → `FIREBASE_SERVICE_ACCOUNT` w .env, inaczej
 * Application Default Credentials środowiska), więc nie potrzebuje hasła
 * żadnego konta i nie przestaje działać bez `FB_USER`/`FB_PASS`. Zmienna
 * `FB_USER` (albo `VITE_FIREBASE_ADMIN_UID`) jest teraz wyłącznie opcjonalnym
 * wskazaniem UID lektora do oznaczenia w logu/metadanych migracji — gdy w
 * Firestore jest dokładnie jedno konto o roli `admin`/`teacher`, skrypt
 * znajduje je sam i tej zmiennej w ogóle nie potrzebuje.
 *
 * Schemat docelowy: kursanci żyją w kolekcji `users` (role: 'user'), a ich
 * lekcje w podkolekcji `users/{uid}/lessonRecords` — to jest rzeczywisty
 * schemat używany przez całą aplikację (patrz StudentLessonHistory.tsx,
 * AdminPanel.tsx). Osobna kolekcja `students` nie istnieje w tym projekcie
 * i tworzenie jej osierociłoby dane względem reszty aplikacji.
 *
 * Użycie:
 *   1) Suchy przebieg, świeże dane z Notion (domyślnie — nic nie zapisuje):
 *        NOTION_API_KEY=... npm run migrate:notion
 *   2) Faktyczny zapis do Firestore:
 *        NOTION_API_KEY=... npm run migrate:notion -- --apply
 *   3) Bez NOTION_API_KEY skrypt spada do ostatniego zrzutu z dysku (z
 *      ostrzeżeniem) — przydatne tylko do szybkiego testu/dry-run bez klucza.
 *
 * Poświadczenia zapisu wymagają `FIREBASE_SERVICE_ACCOUNT` w .env (JSON
 * konta usługi) albo Application Default Credentials środowiska
 * (`gcloud auth application-default login`) — bez nich Admin SDK odczyta
 * dane, ale zapis (--apply) zakończy się błędem uprawnień.
 */
import { existsSync, readFileSync } from 'node:fs';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { fetchNotionArchive } from './fetch_notion_dump.mjs';
import {
  isRealEmail,
  normalize,
  parseLessonSummary,
  splitLevel,
  splitName,
  tempPassword,
} from './notion_parser_helper.mjs';

interface NotionStudentDump {
  id: string;
  name: string;
  emails: string[];
  level: string;
  company: string;
  isGroup: boolean;
  status: string;
}

interface NotionLessonDump {
  id: string;
  url?: string;
  lastEditedTime?: string;
  topic: string;
  rawDate: string;
  studentName: string;
  relationIds: string[];
  rawText: string;
}

interface NotionDump {
  timestamp: string;
  students: NotionStudentDump[];
  lessons: NotionLessonDump[];
}

interface TeacherIdentity {
  uid: string;
  email: string;
}

const DUMP_PATH = 'scripts/notion_migration_dump.json';
const DATABASE_ID = 'ai-studio-520a4841-33d0-41ef-829a-838ebc44072d';
const DELAY_MS = 300;
const isApply = process.argv.includes('--apply');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getAdminApp() {
  if (getApps().length > 0) return getApp();

  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountStr) {
    try {
      const parsed = JSON.parse(serviceAccountStr);
      return initializeApp({ credential: cert(parsed) });
    } catch {
      console.warn('[Firebase Admin] Nie udało się sparsować FIREBASE_SERVICE_ACCOUNT — sprawdź format JSON w .env.');
    }
  }

  let projectId = process.env.FIREBASE_PROJECT_ID || '';
  if (!projectId) {
    try {
      const config = JSON.parse(readFileSync('firebase-applet-config.json', 'utf8'));
      projectId = config?.projectId || '';
    } catch {
      // brak configu — projectId zostaje pusty, initializeApp() spadnie na ADC
    }
  }

  console.warn(
    `[Firebase Admin] Brak FIREBASE_SERVICE_ACCOUNT w .env — inicjalizuję Admin SDK${
      projectId ? ` dla projektu ${projectId}` : ''
    } przez domyślne poświadczenia środowiska (Application Default Credentials). ` +
      'Zarówno odczyt, jak i zapis (--apply) wymagają poprawnych ADC (`gcloud auth application-default login`) albo FIREBASE_SERVICE_ACCOUNT w .env — bez nich kolejne wywołania Firestore zawiodą.'
  );
  return projectId ? initializeApp({ projectId }) : initializeApp();
}

/**
 * Ustala UID lektora do oznaczenia migracji w logu/metadanych.
 *
 * Kolejność: (1) dokładnie jedno konto o roli admin/teacher w Firestore,
 * (2) FB_USER lub VITE_FIREBASE_ADMIN_UID z .env jako literalny UID,
 * (3) brak — migracja kontynuuje bez znacznika (to tylko metadana, nie
 * warunek działania skryptu).
 */
async function resolveTeacherIdentity(db: Firestore): Promise<TeacherIdentity | null> {
  try {
    const snap = await db.collection('users').where('role', 'in', ['admin', 'teacher']).get();
    if (snap.size === 1) {
      const teacherDoc = snap.docs[0];
      const data = teacherDoc.data() as Record<string, any>;
      return { uid: teacherDoc.id, email: data.email || '(brak adresu e-mail w profilu)' };
    }
    if (snap.size > 1) {
      console.warn(
        `Znaleziono ${snap.size} kont lektora/admina w Firestore — nie mogę wybrać jednoznacznie. Sprawdzam FB_USER / VITE_FIREBASE_ADMIN_UID w .env...`
      );
    } else {
      console.warn('Nie znaleziono żadnego konta lektora/admina w Firestore. Sprawdzam FB_USER / VITE_FIREBASE_ADMIN_UID w .env...');
    }
  } catch (err) {
    console.warn(`Nie udało się odpytać kolekcji users o lektora/admina: ${(err as Error).message}`);
  }

  const envUid = process.env.FB_USER || process.env.VITE_FIREBASE_ADMIN_UID;
  if (!envUid) return null;

  try {
    const teacherDoc = await db.collection('users').doc(envUid).get();
    if (teacherDoc.exists) {
      const data = teacherDoc.data() as Record<string, any>;
      return { uid: envUid, email: data?.email || '(brak adresu e-mail w profilu)' };
    }
    console.warn(`UID ${envUid} z .env nie ma dopasowania w kolekcji users — używam go mimo to.`);
    return { uid: envUid, email: '(nieznany — brak dopasowania w Firestore)' };
  } catch (err) {
    console.warn(`Nie udało się sprawdzić UID ${envUid} z .env: ${(err as Error).message}`);
    return { uid: envUid, email: '(nieznany)' };
  }
}

async function loadDump(): Promise<NotionDump> {
  const notionToken = process.env.NOTION_API_KEY;

  if (notionToken) {
    console.log('NOTION_API_KEY znaleziony — pobieram świeży stan bazy Notion na żywo (nie zrzut z dysku)...\n');
    const studentsDbId = process.env.NOTION_STUDENTS_DB_ID || undefined;
    const lessonsDbId = process.env.NOTION_LESSONS_DB_ID || undefined;
    const live = await fetchNotionArchive({
      token: notionToken,
      ...(studentsDbId ? { studentsDbId } : {}),
      ...(lessonsDbId ? { lessonsDbId } : {}),
    });
    return live as NotionDump;
  }

  console.warn(
    'Brak NOTION_API_KEY w środowisku — nie mogę pobrać świeżego stanu z Notion. ' +
      'Spadam do ostatniego zapisanego zrzutu na dysku (MOŻE BYĆ NIEAKTUALNY). ' +
      'Ustaw NOTION_API_KEY, aby migrować na podstawie danych z dnia dzisiejszego.'
  );

  if (!existsSync(DUMP_PATH)) {
    console.error(`Brak pliku ${DUMP_PATH} i brak NOTION_API_KEY do pobrania na żywo. Ustaw NOTION_API_KEY i uruchom ponownie.`);
    process.exit(1);
  }

  const dump: NotionDump = JSON.parse(readFileSync(DUMP_PATH, 'utf8'));
  console.warn(`UWAGA: używam zrzutu z ${dump.timestamp} — wszystko nowsze w Notion od tej daty NIE zostanie uwzględnione.\n`);
  return dump;
}

async function main() {
  console.log(
    `=== Migracja archiwum Notion -> Firestore ${isApply ? '(ZAPIS)' : '(SUCHY PRZEBIEG — dopisz --apply, aby zapisać)'} ===\n`
  );

  const dump = await loadDump();
  console.log(`Dane wejściowe (${dump.timestamp}): ${dump.students.length} kursantów, ${dump.lessons.length} lekcji.\n`);

  const app = getAdminApp();
  const db = getFirestore(app, DATABASE_ID);

  const teacher = await resolveTeacherIdentity(db);
  if (teacher) {
    console.log(`Migracja dla lektora UID: ${teacher.uid} (${teacher.email})\n`);
  } else {
    console.warn('Nie udało się ustalić UID lektora (ani jednoznacznie w Firestore, ani przez FB_USER/VITE_FIREBASE_ADMIN_UID) — kontynuuję bez znacznika migratedBy.\n');
  }

  const usersSnap = await db.collection('users').get();
  const existingUsers: Array<Record<string, any> & { id: string }> = usersSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, any>),
  }));
  console.log(`Pobrano ${existingUsers.length} istniejących kursantów z Firestore.\n`);

  const uidByNotionStudentId = new Map<string, string>();
  const uidByStudentName = new Map<string, string>();
  let createdCount = 0;
  let skippedCount = 0;

  console.log('--- Krok 1: Kursanci (żelazna zasada deduplikacji: e-mail LUB imię i nazwisko) ---');
  for (const student of dump.students) {
    if (!student.name) continue;
    const nameNorm = normalize(student.name);
    const emailSet = new Set((student.emails || []).map(normalize));

    const match = existingUsers.find((u) => {
      const uEmail = normalize(u.email || '');
      const uFullName = normalize(`${u.firstName || ''} ${u.lastName || ''}`);
      const uUsername = normalize(u.username || '');
      return (uEmail && emailSet.has(uEmail)) || uFullName === nameNorm || uUsername === nameNorm;
    });

    if (match) {
      console.log(`[SKIP] Kursant ${student.name} już istnieje w bazie – pomijam.`);
      uidByNotionStudentId.set(student.id, match.id);
      uidByStudentName.set(nameNorm, match.id);
      skippedCount++;
      continue;
    }

    const { level, profile } = splitLevel(student.level);
    const { firstName, lastName } = splitName(student.name);
    const isInactive = normalize(student.status || '').includes('nieaktywn');
    let email = (student.emails || []).find(isRealEmail);
    if (!email) {
      const cleanName = nameNorm.replace(/[^a-z0-9]/g, '');
      email = `${cleanName || 'kursant'}@student.vocabboost.com`;
    }
    const uid = `usr_${student.id.replace(/-/g, '').slice(0, 20)}`;
    const password = tempPassword();

    console.log(`[NEW]  Kursant ${student.name} (${email}) — tworzę nowy rekord (${uid}).`);

    if (isApply) {
      await db.collection('users').doc(uid).set(
        {
          username: student.name,
          email,
          role: 'user',
          firstName,
          lastName,
          level,
          description: profile,
          company: student.company || '',
          isGroup: Boolean(student.isGroup),
          isArchived: isInactive,
          statusWspolpracy: isInactive ? 'Nieaktywny' : 'Aktywny',
          notionPageId: student.id,
          tempPassword: password,
          requirePasswordChange: true,
          createdAt: new Date().toISOString(),
          ...(teacher ? { migratedBy: teacher.uid } : {}),
        },
        { merge: true }
      );
      await sleep(DELAY_MS);
    }

    uidByNotionStudentId.set(student.id, uid);
    uidByStudentName.set(nameNorm, uid);
    createdCount++;
  }

  console.log(`\nKursanci — pominięci (już istnieli): ${skippedCount}, utworzeni: ${createdCount}\n`);

  console.log('--- Krok 2: Lekcje (dopisywane tylko te, których data nie jest jeszcze w historii kursanta) ---');
  const existingLessonDatesByUid = new Map<string, Set<string>>();

  async function getExistingLessonDates(uid: string): Promise<Set<string>> {
    if (existingLessonDatesByUid.has(uid)) return existingLessonDatesByUid.get(uid)!;
    const snap = await db.collection('users').doc(uid).collection('lessonRecords').get();
    const dates = new Set(snap.docs.map((d) => String((d.data() as any).date || '')));
    existingLessonDatesByUid.set(uid, dates);
    return dates;
  }

  let lessonsAdded = 0;
  let lessonsAlreadyPresent = 0;
  let lessonsUnmatched = 0;

  for (let i = 0; i < dump.lessons.length; i++) {
    const lesson = dump.lessons[i];
    let uid: string | undefined;
    for (const relId of lesson.relationIds || []) {
      if (uidByNotionStudentId.has(relId)) {
        uid = uidByNotionStudentId.get(relId);
        break;
      }
    }
    if (!uid && lesson.studentName) {
      uid = uidByStudentName.get(normalize(lesson.studentName));
    }

    if (!uid) {
      console.warn(`  [POMINIĘTO] Lekcja „${lesson.topic}" — brak przypisanego kursanta (${lesson.studentName}).`);
      lessonsUnmatched++;
      continue;
    }

    const parsed = parseLessonSummary(lesson.rawText);
    let date = '';
    let isDateMissing = false;
    if (lesson.rawDate && !lesson.rawDate.toLowerCase().includes('brak')) {
      date = lesson.rawDate.slice(0, 10);
    } else if (parsed.extractedDate) {
      date = parsed.extractedDate;
    } else {
      date = (lesson.lastEditedTime || new Date().toISOString()).slice(0, 10);
      isDateMissing = true;
    }

    const existingDates = await getExistingLessonDates(uid);
    if (existingDates.has(date)) {
      lessonsAlreadyPresent++;
      continue;
    }

    const isPending = isDateMissing || parsed.needsReview;
    const pendingReasons: string[] = [];
    if (isDateMissing) pendingReasons.push('Brak daty spotkania w Notion');
    if (parsed.needsReview) pendingReasons.push('Wybrakowane podsumowanie lub format do weryfikacji');

    const structuredBlocks = {
      summary: parsed.lessonSummary,
      vocabulary: parsed.vocabularyText,
      corrections: parsed.corrections,
      homework: parsed.homeworkText,
      answerKey: parsed.homeworkAnswerKey || '',
      nextLesson: parsed.suggestedFollowUp,
      learningCurve: parsed.learningCurve || '',
    };

    console.log(`  [DODANO] ${date} — „${lesson.topic}" -> ${uid}`);

    if (isApply) {
      await db
        .collection('users')
        .doc(uid)
        .collection('lessonRecords')
        .doc(lesson.id)
        .set(
          {
            id: lesson.id,
            studentId: uid,
            date,
            isDateMissing,
            status: isPending ? 'pending_confirmation' : 'confirmed',
            isPendingConfirmation: isPending,
            pendingReason: pendingReasons.join(' • '),
            topic: lesson.topic,
            vocabularyText: parsed.vocabularyText,
            lessonSummary: parsed.lessonSummary,
            thingsToImprove: parsed.thingsToImprove,
            corrections: parsed.corrections,
            homeworkText: parsed.homeworkText,
            homeworkAnswerKey: parsed.homeworkAnswerKey || '',
            suggestedFollowUp: parsed.suggestedFollowUp,
            nextLessonPlan: parsed.suggestedFollowUp,
            studentSpeaking: parsed.learningCurve,
            structuredBlocks,
            source: 'notion',
            notionPageId: lesson.id,
            notionUrl: lesson.url || '',
            needsReview: parsed.needsReview,
            updatedAt: new Date().toISOString(),
            ...(teacher ? { migratedBy: teacher.uid } : {}),
          },
          { merge: true }
        );
      await sleep(DELAY_MS);
    }

    existingDates.add(date);
    lessonsAdded++;

    if ((i + 1) % 10 === 0 || i === dump.lessons.length - 1) {
      console.log(`  ...przetworzono ${i + 1}/${dump.lessons.length} lekcji.`);
    }
  }

  console.log('\n================ PODSUMOWANIE MIGRACJI ================');
  console.log(`Tryb:                          ${isApply ? 'ZAPIS DO FIRESTORE' : 'SUCHY PRZEBIEG (bez zapisu)'}`);
  console.log(`Źródło danych:                  ${process.env.NOTION_API_KEY ? 'Notion API (na żywo)' : `zrzut z dysku (${dump.timestamp})`}`);
  console.log(`Lektor:                         ${teacher ? `${teacher.uid} (${teacher.email})` : 'nieustalony'}`);
  console.log(`Kursanci pominięci (istnieli):  ${skippedCount}`);
  console.log(`Kursanci nowo utworzeni:        ${createdCount}`);
  console.log(`Lekcje dopisane:                ${lessonsAdded}`);
  console.log(`Lekcje już w historii:          ${lessonsAlreadyPresent}`);
  console.log(`Lekcje bez przypisania:         ${lessonsUnmatched}`);
  if (!isApply) {
    console.log('\nTo był suchy przebieg — żaden dokument nie został zapisany. Uruchom z --apply, aby zapisać.');
  }
  console.log('=========================================================');
}

main().catch((err) => {
  console.error('Migracja przerwana błędem:', err);
  process.exit(1);
});
