#!/usr/bin/env node
/**
 * Skrypt administracyjny do bezpiecznego łączenia tożsamości i naprawy kont kursantów.
 * 
 * ŻELAZNY INWARIANT ARCHITEKTONICZNY:
 * FirebaseAuth.uid === canonicalProfileId === users/{profileId}
 *
 * Użycie:
 *   node scripts/link-legacy-account.mjs --profileId <usr_...> --email <student@gmail.com> [--dryRun]
 *
 * Wymaga uprawnień administratora (FIREBASE_SERVICE_ACCOUNT w .env lub gcloud ADC).
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Wczytaj zmienne środowiskowe z .env bez dodatkowych zależności
const envPath = join(rootDir, '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const DATABASE_ID = 'ai-studio-520a4841-33d0-41ef-829a-838ebc44072d';

// Parsowanie argumentów CLI
const options = {
  profileId: { type: 'string', short: 'p' },
  email: { type: 'string', short: 'e' },
  dryRun: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
};

const { values: args } = parseArgs({ options, allowPositionals: true });

if (args.help || !args.profileId || !args.email) {
  console.log(`
Użycie:
  node scripts/link-legacy-account.mjs --profileId <usr_...> --email <student@gmail.com> [opcje]

Wymagane parametry:
  --profileId, -p   ID profilu kursanta w kolekcji users (np. usr_4a8b... lub UID)
  --email, -e       Docelowy, prawdziwy adres e-mail kursanta (np. Gmail)

Opcje:
  --dryRun          Tryb symulacji (wypisuje planowane akcje bez wprowadzania zmian w bazie/Auth)
  --help, -h        Wyświetla tę pomoc
`);
  process.exit(args.help ? 0 : 1);
}

const profileId = String(args.profileId).trim();
const targetEmail = String(args.email).trim().toLowerCase();
const isDryRun = Boolean(args.dryRun);

if (!targetEmail.includes('@') || targetEmail.length < 5) {
  console.error(`[BŁĄD] Podano niepoprawny format adresu e-mail: "${targetEmail}"`);
  process.exit(1);
}

function initAdminApp() {
  if (getApps().length > 0) return getApp();

  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountStr) {
    try {
      const parsed = JSON.parse(serviceAccountStr);
      return initializeApp({ credential: cert(parsed) });
    } catch {
      console.warn('[Firebase Admin] Nie udało się sparsować FIREBASE_SERVICE_ACCOUNT z .env.');
    }
  }

  let projectId = process.env.FIREBASE_PROJECT_ID || '';
  if (!projectId) {
    try {
      const config = JSON.parse(readFileSync(join(rootDir, 'firebase-applet-config.json'), 'utf8'));
      projectId = config?.projectId || '';
    } catch {}
  }

  return projectId ? initializeApp({ projectId }) : initializeApp();
}

async function main() {
  console.log('===============================================================');
  console.log(' CRIBRO RECALL — NAPRAWA I ŁĄCZENIE KONT (ADMIN CLI)');
  console.log('===============================================================');
  console.log(`Inwariant:   FirebaseAuth.uid === users/${profileId}`);
  console.log(`Profil ID:   ${profileId}`);
  console.log(`Docelowy email: ${targetEmail}`);
  console.log(`Tryb:        ${isDryRun ? '🔍 DRY RUN (symulacja, brak zmian)' : '🚀 LIVE EXECUTION'}`);
  console.log('---------------------------------------------------------------');

  const app = initAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app, DATABASE_ID);

  // 1. Sprawdź czy dokument w users/{profileId} istnieje
  const profileRef = db.collection('users').doc(profileId);
  const profileSnap = await profileRef.get();

  if (!profileSnap.exists) {
    console.error(`[BŁĄD KRYTYCZNY] Dokument profilu users/${profileId} NIE istnieje w Firestore!`);
    console.error('Upewnij się, że podajesz właściwy identyfikator rekordu kursanta.');
    process.exit(1);
  }

  const profileData = profileSnap.data() || {};
  console.log(`[1/4] Znaleziono profil Firestore:`);
  console.log(`      - Nazwa: ${profileData.username || profileData.displayName || '(brak)'}`);
  console.log(`      - Dotychczasowy email w Firestore: ${profileData.email || '(brak)'}`);
  console.log(`      - Notatki/Notion ID: ${profileData.notionPageId || '(brak)'}`);

  // 2. Sprawdź stan użytkownika w Firebase Auth
  let authUserByProfileId = null;
  try {
    authUserByProfileId = await auth.getUser(profileId);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') {
      throw err;
    }
  }

  let authUserByTargetEmail = null;
  try {
    authUserByTargetEmail = await auth.getUserByEmail(targetEmail);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') {
      throw err;
    }
  }

  // SCENARIUSZ A: Brak użytkownika w Auth z uid === profileId
  if (!authUserByProfileId) {
    console.log(`[2/4] W Firebase Auth BRAK użytkownika o uid="${profileId}".`);

    // Sprawdź czy targetEmail nie jest zajęty przez inne (osierocone/przypadkowe) konto Auth
    if (authUserByTargetEmail) {
      const orphanUid = authUserByTargetEmail.uid;
      console.log(`[UWAGA] Adres ${targetEmail} jest już zajęty przez konto Auth o innym uid="${orphanUid}".`);

      // Sprawdź czy to konto ma jakiekolwiek podkolekcje/treści w Firestore
      const orphanUserRef = db.collection('users').doc(orphanUid);
      const orphanDoc = await orphanUserRef.get();
      const lessonsSnap = await orphanUserRef.collection('lessonRecords').limit(1).get();
      const tasksSnap = await orphanUserRef.collection('homeworkTasks').limit(1).get();

      const hasData = !lessonsSnap.empty || !tasksSnap.empty;

      if (hasData) {
        console.error(`[BŁĄD BLOKUJĄCY] Osierocone konto ${orphanUid} posiada powiązane lekcje lub zadania!`);
        console.error('Wymagana ręczna interwencja lektora przed usunięciem danych.');
        process.exit(1);
      }

      console.log(`      Konto ${orphanUid} to pusta wydmuszka (brak lekcji/zadań w podkolekcjach).`);
      if (!isDryRun) {
        if (orphanDoc.exists) {
          await orphanUserRef.delete();
          console.log(`      [USUNIĘTO] Pusty dokument Firestore users/${orphanUid}`);
        }
        await auth.deleteUser(orphanUid);
        console.log(`      [USUNIĘTO] Osierocone konto Firebase Auth uid="${orphanUid}"`);
      } else {
        console.log(`      [DRY RUN] Planowane usunięcie users/${orphanUid} i konta Auth ${orphanUid}`);
      }
    }

    // Tworzenie użytkownika w Firebase Auth z jawnym UID === profileId
    console.log(`[3/4] Tworzenie konta Firebase Auth z UID === "${profileId}"...`);
    if (!isDryRun) {
      await auth.createUser({
        uid: profileId,
        email: targetEmail,
        emailVerified: true,
        displayName: profileData.displayName || profileData.username || undefined,
      });
      console.log(`      [UTWORZONO] Firebase Auth UID: ${profileId}, Email: ${targetEmail}`);
    } else {
      console.log(`      [DRY RUN] Planowane auth.createUser({ uid: "${profileId}", email: "${targetEmail}" })`);
    }
  } else {
    // SCENARIUSZ B: Użytkownik w Auth o uid === profileId już istnieje
    console.log(`[2/4] Znaleziono pasujące konto Firebase Auth o uid="${profileId}".`);
    console.log(`      - Aktualny email w Auth: ${authUserByProfileId.email}`);

    if (authUserByProfileId.email !== targetEmail) {
      console.log(`[3/4] Aktualizacja adresu e-mail w Firebase Auth do: ${targetEmail}`);
      if (!isDryRun) {
        await auth.updateUser(profileId, {
          email: targetEmail,
          emailVerified: true,
        });
        console.log(`      [ZAKTUALIZOWANO] Firebase Auth email -> ${targetEmail}`);
      } else {
        console.log(`      [DRY RUN] Planowane auth.updateUser("${profileId}", { email: "${targetEmail}" })`);
      }
    } else {
      console.log(`[3/4] Adres e-mail w Firebase Auth jest już zgodny z docelowym.`);
    }
  }

  // 3. Aktualizacja dokumentu Firestore users/{profileId}
  console.log(`[4/4] Synchronizacja dokumentu profilu users/${profileId}...`);
  const profileUpdates = {
    email: targetEmail,
    isActivated: true,
  };

  // Jeśli w dokumencie było hasło tymczasowe, nie zapisujemy nowych haseł w czystym tekście
  if (!isDryRun) {
    await profileRef.set(profileUpdates, { merge: true });
    console.log(`      [ZAKTUALIZOWANO] Firestore users/${profileId} (email: ${targetEmail})`);

    // Generowanie bezpiecznego linku resetowania / aktywacji hasła
    try {
      const resetLink = await auth.generatePasswordResetLink(targetEmail);
      console.log('---------------------------------------------------------------');
      console.log('🎉 [SUKCES] Konto powiązane pomyślnie!');
      console.log(`🔗 Link aktywacyjny / resetu hasła dla kursanta:\n${resetLink}`);
      console.log('---------------------------------------------------------------');
    } catch (linkErr) {
      console.warn('Nie udało się wygenerować linku resetowania hasła:', linkErr.message);
    }
  } else {
    console.log(`      [DRY RUN] Planowane profileRef.set(${JSON.stringify(profileUpdates)}, { merge: true })`);
    console.log('---------------------------------------------------------------');
    console.log('🔍 [DRY RUN ZAKOŃCZONY] Brak modyfikacji danych.');
    console.log('Uruchom skrypt bez flagi --dryRun, aby zastosować zmiany.');
    console.log('---------------------------------------------------------------');
  }
}

main().catch((err) => {
  console.error('\n[BŁĄD WYKONANIA SKRYPTU]:', err);
  process.exit(1);
});
