#!/usr/bin/env node
/**
 * Jednorazowa migracja prywatnych notatek lektora (Side Notes) notatnika.
 *
 * Przenosi pole `teacherNotes` z `scratchpads/{id}` (dokument czytelny dla
 * każdego, kto zna link) do `scratchpads/{id}/private/teacher` i kasuje stare
 * pole. Kod od commita „notatki lektora w private/teacher" czyta już z nowego
 * miejsca, a do starego pola sięga tylko awaryjnie.
 *
 * Kolejność wdrożenia: kod → ten skrypt z --apply → reguły (blokada pola
 * `teacherNotes` w dokumencie nadrzędnym). Reguły przed migracją odcięłyby
 * zapis do każdego notatnika, który wciąż ma stare pole.
 *
 * Użycie:
 *   node scripts/migrate-scratchpad-teacher-notes.mjs                      # suchy przebieg (domyślnie)
 *   node scripts/migrate-scratchpad-teacher-notes.mjs --apply --backup <plik.json>
 *   node scripts/migrate-scratchpad-teacher-notes.mjs --restore <plik.json> [--apply]
 *
 * --backup jest obowiązkowy przy --apply: zapisuje stare wartości (z treścią
 * notatek — trzymaj plik poza repo i skasuj po zamknięciu migracji).
 * --restore przywraca pole `teacherNotes` w dokumencie nadrzędnym z kopii
 * (wycofanie); bez --apply tylko pokazuje, co by zrobił. Dokumentu
 * `private/teacher` nie rusza.
 *
 * Wymaga uprawnień administratora (FIREBASE_SERVICE_ACCOUNT w .env lub gcloud
 * ADC). Admin SDK omija reguły. Na emulatorze: FIRESTORE_EMULATOR_HOST
 * + FIREBASE_PROJECT_ID + --database '(default)'.
 *
 * Skrypt nie wypisuje treści notatek, tylko identyfikatory i długości.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Wczytaj zmienne środowiskowe z .env bez dodatkowych zależności
const envPath = join(rootDir, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let val = match[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const { values: args } = parseArgs({
  options: {
    apply: { type: 'boolean', default: false },
    backup: { type: 'string' },
    restore: { type: 'string' },
    database: { type: 'string', default: 'ai-studio-520a4841-33d0-41ef-829a-838ebc44072d' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (args.help) {
  console.log('Patrz komentarz na górze pliku: scripts/migrate-scratchpad-teacher-notes.mjs');
  process.exit(0);
}
if (args.apply && !args.restore && !args.backup) {
  console.error('--apply wymaga --backup <plik.json> (kopia starych wartości do wycofania).');
  process.exit(1);
}
if (args.backup && existsSync(args.backup)) {
  console.error(`Plik kopii ${args.backup} już istnieje — nie nadpisuję. Podaj nową ścieżkę.`);
  process.exit(1);
}

const initAdmin = () => {
  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountStr && !process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ credential: cert(JSON.parse(serviceAccountStr)) });
  }
  let projectId = process.env.FIREBASE_PROJECT_ID || '';
  if (!projectId) {
    const configPath = join(rootDir, 'firebase-applet-config.json');
    if (existsSync(configPath)) projectId = JSON.parse(readFileSync(configPath, 'utf8'))?.projectId || '';
  }
  return projectId ? initializeApp({ projectId }) : initializeApp();
};

const db = getFirestore(initAdmin(), args.database);
const mode = args.apply ? 'ZAPIS' : 'suchy przebieg';
console.log(
  `Baza: ${args.database}${process.env.FIRESTORE_EMULATOR_HOST ? ` (emulator ${process.env.FIRESTORE_EMULATOR_HOST})` : ''} — ${mode}`
);

const privateRef = (id) => db.doc(`scratchpads/${id}/private/teacher`);
const len = (v) => (typeof v === 'string' ? v.length : `typ ${typeof v}`);

async function migrate() {
  // Projekcja: bez contentHtml (do 700 KB na dokument).
  const snap = await db.collection('scratchpads').select('teacherNotes').get();
  const withField = snap.docs.filter((d) => d.data().teacherNotes !== undefined);
  console.log(`Notatników: ${snap.size}, ze starym polem teacherNotes: ${withField.length}`);

  const backup = [];
  const counts = { moved: 0, privateWins: 0, emptyDropped: 0 };

  for (const d of withField) {
    const id = d.id;
    // Transakcja: lektor może właśnie pisać — czytamy oba dokumenty i
    // zapisujemy oba atomowo albo wcale.
    const outcome = await db.runTransaction(async (tx) => {
      const [parent, priv] = await Promise.all([tx.get(d.ref), tx.get(privateRef(id))]);
      const legacy = parent.data()?.teacherNotes;
      if (legacy === undefined) return { kind: 'gone' };
      const privNotes = priv.exists ? priv.data()?.teacherNotes : undefined;

      let kind;
      if (typeof privNotes === 'string') {
        // Nowy kod już zapisał private/teacher (startując od starego pola),
        // więc jest nowszy — stare pole tylko kasujemy.
        kind = 'privateWins';
      } else if (typeof legacy === 'string' && legacy.length > 0) {
        kind = 'moved';
      } else {
        kind = 'emptyDropped';
      }

      if (args.apply) {
        if (kind === 'moved') {
          tx.set(
            privateRef(id),
            { teacherNotes: legacy, updatedAt: new Date().toISOString(), migratedAt: new Date().toISOString() },
            { merge: true }
          );
        }
        tx.update(d.ref, { teacherNotes: FieldValue.delete() });
      }
      return { kind, legacy, privNotes };
    });

    if (outcome.kind === 'gone') continue;
    counts[outcome.kind] += 1;
    backup.push({ id, teacherNotes: outcome.legacy });
    const note =
      outcome.kind === 'moved'
        ? `przenoszę (${len(outcome.legacy)} zn.)`
        : outcome.kind === 'privateWins'
          ? `private/teacher już jest (${len(outcome.privNotes)} zn.) — kasuję tylko stare pole (${len(outcome.legacy)} zn.)`
          : `stare pole puste/nie-tekst (${len(outcome.legacy)}) — kasuję`;
    console.log(`  ${id}: ${note}`);
  }

  if (args.apply && args.backup) {
    writeFileSync(args.backup, JSON.stringify({ createdAt: new Date().toISOString(), database: args.database, items: backup }, null, 2), { mode: 0o600 });
    console.log(`Kopia ${backup.length} wartości: ${args.backup}`);
  }
  console.log(
    `Podsumowanie: przeniesione ${counts.moved}, private wygrywa ${counts.privateWins}, puste skasowane ${counts.emptyDropped}` +
      (args.apply ? '' : ' (nic nie zapisano — dodaj --apply --backup <plik>)')
  );
}

async function restore() {
  const data = JSON.parse(readFileSync(args.restore, 'utf8'));
  if (data.database && data.database !== args.database) {
    console.error(`Kopia pochodzi z bazy ${data.database}, a wskazana jest ${args.database}. Przerywam.`);
    process.exit(1);
  }
  let count = 0;
  for (const item of data.items || []) {
    const ref = db.doc(`scratchpads/${item.id}`);
    const exists = (await ref.get()).exists;
    if (!exists) {
      console.log(`  ${item.id}: dokumentu nie ma — pomijam`);
      continue;
    }
    console.log(`  ${item.id}: przywracam teacherNotes (${len(item.teacherNotes)} zn.)`);
    if (args.apply) await ref.update({ teacherNotes: item.teacherNotes });
    count += 1;
  }
  console.log(`Przywrócone: ${count}${args.apply ? '' : ' (suchy przebieg — dodaj --apply)'}`);
}

await (args.restore ? restore() : migrate());
