/**
 * Jednorazowa migracja archiwalnej bazy kursantów i lekcji z Notion do Firestore.
 *
 * ŻELAZNA ZASADA DEDUPLIKACJI: jeśli kursant o danym adresie e-mail LUB
 * imieniu i nazwisku już istnieje w Firestore, skrypt BEZWZGLĘDNIE pomija
 * tworzenie nowego rekordu (loguje `[SKIP] Kursant <Imię Nazwisko> już
 * istnieje w bazie – pomijam.`) i dopisuje tylko te lekcje z Notion, których
 * data nie występuje jeszcze w jego historii (`users/{uid}/lessonRecords`).
 * Dla nowo tworzonych kursantów mapowane są wszystkie ich lekcje z dumpu.
 *
 * Ten skrypt NIE odpytuje API Notion samodzielnie — to zadanie
 * `scripts/fetch_notion_dump.mjs` (już istniejący, przetestowany pipeline
 * pobierania i parsowania stron Notion). Duplikowanie tej logiki tutaj
 * naruszyłoby CLAUDE.md §4 (nie wprowadzaj kolejnego mechanizmu bez
 * potrzeby). Ten skrypt odpowiada wyłącznie za bezpieczny, idempotentny
 * import zrzutu do Firestore zgodnie z żelazną zasadą powyżej.
 *
 * Schemat docelowy: kursanci żyją w kolekcji `users` (role: 'user'), a ich
 * lekcje w podkolekcji `users/{uid}/lessonRecords` — to jest rzeczywisty
 * schemat używany przez całą aplikację (patrz StudentLessonHistory.tsx,
 * AdminPanel.tsx). Osobna kolekcja `students` nie istnieje w tym projekcie
 * i tworzenie jej osierociłoby dane względem reszty aplikacji.
 *
 * Użycie:
 *   1) Zrzut z Notion (jeśli nieaktualny lub brak):
 *        NOTION_API_KEY=... node scripts/fetch_notion_dump.mjs
 *   2) Suchy przebieg (domyślnie — nic nie zapisuje, tylko loguje plan):
 *        FB_USER=admin@... FB_PASS='...' npm run migrate:notion
 *   3) Faktyczny zapis do Firestore:
 *        FB_USER=admin@... FB_PASS='...' npm run migrate:notion -- --apply
 */
import { existsSync, readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  initializeFirestore,
  setDoc,
} from 'firebase/firestore';
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

const DUMP_PATH = 'scripts/notion_migration_dump.json';
const DATABASE_ID = 'ai-studio-520a4841-33d0-41ef-829a-838ebc44072d';
const DELAY_MS = 300;
const isApply = process.argv.includes('--apply');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Brak zmiennej środowiskowej ${name}. Ustaw ją przed uruchomieniem skryptu.`);
    process.exit(1);
  }
  return value;
}

async function main() {
  if (!existsSync(DUMP_PATH)) {
    console.error(
      `Brak pliku ${DUMP_PATH}. Najpierw uruchom: NOTION_API_KEY=... node scripts/fetch_notion_dump.mjs`
    );
    process.exit(1);
  }

  const dump: NotionDump = JSON.parse(readFileSync(DUMP_PATH, 'utf8'));

  console.log(
    `=== Migracja archiwum Notion -> Firestore ${isApply ? '(ZAPIS)' : '(SUCHY PRZEBIEG — dopisz --apply, aby zapisać)'} ===`
  );
  console.log(`Zrzut z ${dump.timestamp}: ${dump.students.length} kursantów, ${dump.lessons.length} lekcji.\n`);

  const config = JSON.parse(readFileSync('firebase-applet-config.json', 'utf8'));
  const app = initializeApp(config);
  const db = initializeFirestore(app, {}, DATABASE_ID);
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, requireEnv('FB_USER'), requireEnv('FB_PASS'));

  const usersSnap = await getDocs(collection(db, 'users'));
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
      await setDoc(
        doc(db, 'users', uid),
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
    const snap = await getDocs(collection(db, 'users', uid, 'lessonRecords'));
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
      await setDoc(
        doc(db, 'users', uid, 'lessonRecords', lesson.id),
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
        },
        { merge: true }
      );
      await sleep(DELAY_MS);
    }

    existingDates.add(date);
    lessonsAdded++;

    if ((i + 1) % 10 === 0 || i === dump.lessons.length - 1) {
      console.log(`  ...przetworzono ${i + 1}/${dump.lessons.length} lekcji z dumpu.`);
    }
  }

  console.log('\n================ PODSUMOWANIE MIGRACJI ================');
  console.log(`Tryb:                         ${isApply ? 'ZAPIS DO FIRESTORE' : 'SUCHY PRZEBIEG (bez zapisu)'}`);
  console.log(`Kursanci pominięci (istnieli): ${skippedCount}`);
  console.log(`Kursanci nowo utworzeni:       ${createdCount}`);
  console.log(`Lekcje dopisane:               ${lessonsAdded}`);
  console.log(`Lekcje już w historii:         ${lessonsAlreadyPresent}`);
  console.log(`Lekcje bez przypisania:        ${lessonsUnmatched}`);
  if (!isApply) {
    console.log('\nTo był suchy przebieg — żaden dokument nie został zapisany. Uruchom z --apply, aby zapisać.');
  }
  console.log('=========================================================');
}

main().catch((err) => {
  console.error('Migracja przerwana błędem:', err);
  process.exit(1);
});
