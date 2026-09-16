import { readFileSync, existsSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import {
  normalize,
  splitLevel,
  splitName,
  tempPassword,
  parseLessonSummary,
  isRealEmail,
} from './notion_parser_helper.mjs';

const dumpPath = 'scripts/notion_migration_dump.json';
if (!existsSync(dumpPath)) {
  console.error(`Brak pliku ${dumpPath}. Poczekaj na zakończenie pobierania zrzutu z Notion.`);
  process.exit(1);
}

const dump = JSON.parse(readFileSync(dumpPath, 'utf8'));
const config = JSON.parse(readFileSync('firebase-applet-config.json', 'utf8'));
const DATABASE_ID = 'ai-studio-520a4841-33d0-41ef-829a-838ebc44072d';

const app = initializeApp(config);
const db = initializeFirestore(app, {}, DATABASE_ID);

console.log('=== ROZPOCZYNANIE MIGRACJI DANYCH Z ZRZUTU NOTION DO FIRESTORE ===');
console.log(`Liczba kursantów w zrzucie: ${dump.students.length}`);
console.log(`Liczba lekcji w zrzucie: ${dump.lessons.length}`);

// 1. Pobierz aktualnych użytkowników z Firestore
const usersSnap = await getDocs(collection(db, 'users'));
const existingUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
console.log(`Pobrano ${existingUsers.length} istniejących użytkowników z Firestore.`);

const uidByNotionId = new Map();
const uidByName = new Map();
const accountsCreated = [];

// Dopasowywanie istniejących i tworzenie nowych użytkowników
for (const student of dump.students) {
  const name = student.name;
  if (!name) continue;

  const emails = student.emails || [];
  const nameNorm = normalize(name);

  // Szukaj dopasowania
  let match = existingUsers.find((u) => u.notionPageId && u.notionPageId === student.id);
  if (!match && emails.length > 0) {
    const emailSet = new Set(emails.map(normalize));
    match = existingUsers.find((u) => u.email && emailSet.has(normalize(u.email)));
  }
  if (!match) {
    match = existingUsers.find((u) => {
      const uFull = normalize(`${u.firstName || ''} ${u.lastName || ''}`);
      const uName = normalize(u.username || '');
      return uFull === nameNorm || uName === nameNorm;
    });
  }

  const { level, profile } = splitLevel(student.level);
  const isInactive = student.status === 'Nieaktywny' || normalize(student.status || '').includes('nieaktywn');
  const isGroup = Boolean(student.isGroup || normalize(name).includes('grupa'));
  const company = student.company || '';

  if (match) {
    const uid = match.id;
    uidByNotionId.set(student.id, uid);
    uidByName.set(nameNorm, uid);

    const updates = {};
    if (match.notionPageId !== student.id) updates.notionPageId = student.id;
    if (isGroup && !match.isGroup) updates.isGroup = true;
    if (company && !match.company) updates.company = company;
    if (isInactive && !match.isArchived) {
      updates.isArchived = true;
      updates.statusWspolpracy = 'Nieaktywny';
    }
    if (level && (!match.level || match.level === profile)) updates.level = level;
    if (profile && !match.description) updates.description = profile;

    const realEmail = emails.find(isRealEmail);
    if (realEmail && !isRealEmail(match.email || '')) {
      updates.email = realEmail;
    }

    if (Object.keys(updates).length > 0) {
      await setDoc(doc(db, 'users', uid), updates, { merge: true });
      console.log(`  [Zaktualizowano profil] ${name} (${uid})`);
    } else {
      console.log(`  [Dopasowano istniejący] ${name} (${uid})`);
    }
  } else {
    // Utwórz nowy rekord w Firestore
    const uid = 'usr_' + student.id.replace(/-/g, '').slice(0, 20);
    const password = tempPassword();
    const { firstName, lastName } = splitName(name);
    let email = emails.find(isRealEmail);
    if (!email) {
      const cleanName = nameNorm.replace(/[^a-z0-9]/g, '');
      email = `${cleanName || 'kursant'}@student.vocabboost.com`;
    }

    const newUserData = {
      username: name,
      email,
      role: 'user',
      firstName,
      lastName,
      level,
      description: profile,
      company,
      isGroup,
      isArchived: isInactive,
      statusWspolpracy: isInactive ? 'Nieaktywny' : 'Aktywny',
      notionPageId: student.id,
      tempPassword: password,
      requirePasswordChange: true,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'users', uid), newUserData, { merge: true });
    accountsCreated.push({ name, email, tempPassword: password, uid });
    uidByNotionId.set(student.id, uid);
    uidByName.set(nameNorm, uid);
    console.log(`  [Utworzono nowe konto] ${name} (${uid}) - hasło: ${password}`);
  }
}

console.log('\n=== ZAPISYWANIE LEKCJI DO FIRESTORE (users/{uid}/lessonRecords) ===');

let lessonsImported = 0;
let lessonsSkipped = 0;
let needsReviewCount = 0;
const lessonsPerStudent = new Map();

for (let i = 0; i < dump.lessons.length; i++) {
  const lesson = dump.lessons[i];
  const studentName = lesson.studentName || '';
  const relationIds = lesson.relationIds || [];

  let uid = null;
  for (const relId of relationIds) {
    if (uidByNotionId.has(relId)) {
      uid = uidByNotionId.get(relId);
      break;
    }
  }
  if (!uid && studentName) {
    uid = uidByName.get(normalize(studentName));
  }

  if (!uid) {
    console.warn(`  [POMINIĘTO] Lekcja „${lesson.topic}" — brak przypisanego kursanta (${studentName})`);
    lessonsSkipped++;
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

  const isPending = isDateMissing || parsed.needsReview;
  const pendingReasons = [];
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

  const now = new Date().toISOString();
  const lessonPayload = {
    id: lesson.id,
    studentId: uid,
    date,
    isDateMissing,
    status: isPending ? 'pending_confirmation' : 'confirmed',
    isPendingConfirmation: isPending,
    pendingReason: pendingReasons.length > 0 ? pendingReasons.join(' • ') : '',
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
    updatedAt: now,
  };

  const lessonDocRef = doc(db, 'users', uid, 'lessonRecords', lesson.id);
  await setDoc(lessonDocRef, lessonPayload, { merge: true });

  lessonsImported++;
  if (isPending) needsReviewCount++;
  lessonsPerStudent.set(uid, (lessonsPerStudent.get(uid) || 0) + 1);

  if ((i + 1) % 10 === 0 || i === dump.lessons.length - 1) {
    console.log(`  Zapisano ${i + 1}/${dump.lessons.length} lekcji...`);
  }
}

console.log('\n================ PODSUMOWANIE MIGRACJI ================');
console.log(`Zaimportowane lekcje: ${lessonsImported}`);
console.log(`Pominięte lekcje:     ${lessonsSkipped}`);
console.log(`Wymagające przeglądu: ${needsReviewCount}`);
console.log(`Założone nowe konta:  ${accountsCreated.length}`);

if (accountsCreated.length > 0) {
  console.log('\n--- NOWO UTWORZONE KONTA I HASŁA STARTOWE ---');
  accountsCreated.forEach((acc) => {
    console.log(`  • ${acc.name} (${acc.email}) -> Hasło: ${acc.tempPassword}`);
  });
}

console.log('\n--- LEKCJE PRZYPISANE DO KURSANTÓW ---');
for (const student of dump.students) {
  const uid = uidByNotionId.get(student.id);
  const count = (uid && lessonsPerStudent.get(uid)) || 0;
  console.log(`  • ${student.name}: ${count} lekcji`);
}
console.log('=======================================================');
