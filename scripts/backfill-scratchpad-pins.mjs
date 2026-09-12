/**
 * Jednorazowa migracja indeksu PIN-ów notatnika (Scratchpad).
 *
 * Dopisuje wpisy do `scratchpadPins/{pin}` dla dokumentów `scratchpads/*`
 * założonych PRZED wprowadzeniem indeksu. Aplikacja dorabia taki wpis też sama
 * przy pierwszym otwarciu notatnika (services/scratchpadService.ts →
 * ensureScratchpadPinIndex), ale tylko wtedy, gdy dokument ma deterministyczne
 * ID (`sp_{studentId}`) i ktoś faktycznie go otworzy. Notatniki bez studentId
 * (stare `sp_{timestamp}`), które nikt od tamtej pory nie otworzył, nie mają
 * szansy się same naprawić — stąd ten skrypt.
 *
 * Bez wpisu w indeksie wejście po PIN-ie nie działa, bo `list` na `scratchpads`
 * jest w regułach zamknięty (patrz firestore.rules) — kod PIN musiał wcześniej
 * odpytywać całą kolekcję, co pozwalało wylistować notatniki wszystkich
 * kursantów bez logowania.
 *
 * Użycie — najpierw ZAWSZE suchy przebieg:
 *   FB_USER=admin@example.com FB_PASS='...' node scripts/backfill-scratchpad-pins.mjs
 *   FB_USER=... FB_PASS='...' node scripts/backfill-scratchpad-pins.mjs --apply
 *
 * Logowanie musi być na jednym z dwóch kont rozpoznawanych w regułach jako
 * admin po e-mailu (isAdmin() w firestore.rules) — notatniki należą do różnych
 * lektorów, a zapis w scratchpadPins wymaga właściciela notatnika albo admina.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'firebase-applet-config.json'), 'utf8'));
const DATABASE_ID = 'ai-studio-520a4841-33d0-41ef-829a-838ebc44072d';

/** Musi się zgadzać z utils/accessCode.ts — skrypt nie importuje TS-a projektu. */
const CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXYZ234679';
const normalizePin = (raw) =>
  String(raw || '')
    .toUpperCase()
    .replace(/[\s-_.]/g, '')
    .replace(/0/g, 'D')
    .replace(/O/g, 'D')
    .replace(/[1IL]/g, 'J')
    .replace(/[5S]/g, 'X')
    .replace(/[8B]/g, 'W')
    .split('')
    .filter((char) => CODE_ALPHABET.includes(char))
    .join('');

const apply = process.argv.includes('--apply');
const { FB_USER, FB_PASS } = process.env;
if (!FB_USER || !FB_PASS) {
  console.error('Ustaw FB_USER i FB_PASS (konto admina — patrz komentarz na górze pliku).');
  process.exit(1);
}

const app = initializeApp(config);
const cred = await signInWithEmailAndPassword(getAuth(app), FB_USER, FB_PASS);
const db = initializeFirestore(app, {}, DATABASE_ID);
console.log(`Zalogowano jako ${cred.user.uid}${apply ? '' : ' (suchy przebieg)'}`);

const [scratchpadsSnap, pinsSnap] = await Promise.all([
  getDocs(collection(db, 'scratchpads')),
  getDocs(collection(db, 'scratchpadPins')),
]);

const existingPins = new Map(pinsSnap.docs.map((d) => [d.id, d.data().scratchpadId]));

/** pin znormalizowany -> [{ id, pin surowy }] — do wykrycia kolizji. */
const byPin = new Map();
for (const d of scratchpadsSnap.docs) {
  const rawPin = d.data().pin;
  const pin = normalizePin(rawPin);
  if (!pin) continue;
  if (!byPin.has(pin)) byPin.set(pin, []);
  byPin.get(pin).push({ id: d.id, rawPin });
}

const collisions = [...byPin.entries()].filter(([, docs]) => docs.length > 1);
if (collisions.length > 0) {
  console.warn(`\n⚠️  Kolizje PIN-ów — ${collisions.length} kodów wskazuje na więcej niż jeden notatnik:`);
  for (const [pin, docs] of collisions) {
    console.warn(`  ${pin}: ${docs.map((d) => d.id).join(', ')} — POMIJAM, wymaga ręcznej decyzji`);
  }
}

const toWrite = [];
for (const [pin, docs] of byPin.entries()) {
  if (docs.length > 1) continue; // kolizja, obsłużona wyżej — nie zgadujemy, który dokument jest właściwy
  const [{ id }] = docs;
  const current = existingPins.get(pin);
  if (current === id) continue; // już aktualne
  toWrite.push({ pin, scratchpadId: id, overwrites: current });
}

console.log(`\nNotatników z PIN-em: ${byPin.size}, wpisów do uzupełnienia/naprawienia: ${toWrite.length}`);
for (const w of toWrite) {
  if (w.overwrites) {
    console.log(`  ${w.pin} -> ${w.scratchpadId} (było: ${w.overwrites} — NADPISUJĘ, niezgodne z aktualnym dokumentem)`);
  } else {
    console.log(`  ${w.pin} -> ${w.scratchpadId} (nowy wpis)`);
  }
}

if (!apply) {
  console.log('\nNic nie zapisano. Uruchom ponownie z --apply, żeby wprowadzić zmiany.');
  process.exit(0);
}

const CHUNK = 400;
for (let i = 0; i < toWrite.length; i += CHUNK) {
  const batch = writeBatch(db);
  for (const w of toWrite.slice(i, i + CHUNK)) {
    batch.set(
      doc(db, 'scratchpadPins', w.pin),
      { scratchpadId: w.scratchpadId, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  }
  await batch.commit();
}
console.log(`Zapisano: ${toWrite.length}.`);
process.exit(0);
