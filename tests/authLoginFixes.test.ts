// Import poboczny — inicjalizuje singleton i18next (en.json/pl.json), inaczej
// `i18n.t(...)` w utils/authErrorMessages.ts zwraca `undefined` w tym procesie testowym.
import '../i18n';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapFirebaseAuthErrorToMessage } from '../utils/authErrorMessages';
import { changePasswordBeforeInvite } from '../utils/studentInviteFlow';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * P0 logowanie kursantów — naprawy przed testami na żywo:
 * E) AuthScreen: komunikat "auth/invalid-email" nie wspomina już o "loginie"
 *    (login przez username jest zachowany po cichu tylko dla 9 legacy kont
 *    @student.vocabboost.com, ale nie jest już reklamowany w UI).
 * D) AuthContext: brak dokumentu users dla zalogowanego uid ma dawać
 *    statyczny komunikat, nie ciche wylogowanie bez wyjaśnienia.
 * A) StudentInviteEmailModal: błąd changeUserPassword ma przerywać wysyłkę
 *    zaproszenia (mail NIGDY nie idzie), zamiast być połykany.
 */

test('mapFirebaseAuthErrorToMessage: auth/invalid-email nie wspomina już o "loginie"', () => {
  const message = mapFirebaseAuthErrorToMessage('auth/invalid-email', 'fallback');
  assert.equal(message, 'Wprowadź poprawny adres e-mail.');
  assert.ok(!message.toLowerCase().includes('login'), 'Komunikat nie powinien już sugerować logowania "loginem"');
});

test('mapFirebaseAuthErrorToMessage: user-not-found/wrong-password/invalid-credential -> ten sam komunikat co wcześniej', () => {
  assert.equal(mapFirebaseAuthErrorToMessage('auth/user-not-found', 'x'), 'Nieprawidłowy login lub hasło.');
  assert.equal(mapFirebaseAuthErrorToMessage('auth/wrong-password', 'x'), 'Nieprawidłowy login lub hasło.');
  assert.equal(mapFirebaseAuthErrorToMessage('auth/invalid-credential', 'x'), 'Nieprawidłowy login lub hasło.');
});

test('mapFirebaseAuthErrorToMessage: nieznany kod błędu -> zwraca fallback (komunikat Firebase)', () => {
  assert.equal(mapFirebaseAuthErrorToMessage('auth/network-request-failed', 'Coś poszło nie tak'), 'Coś poszło nie tak');
  assert.equal(mapFirebaseAuthErrorToMessage(undefined, 'Coś poszło nie tak'), 'Coś poszło nie tak');
});

test('i18n: nowe statyczne komunikaty istnieją w pl.json i en.json, niepuste, różne od siebie', () => {
  const pl = JSON.parse(fs.readFileSync(path.join(__dirname, '../pl.json'), 'utf8'));
  const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../en.json'), 'utf8'));

  const keys = [
    'Wprowadź poprawny adres e-mail.',
    'To konto nie ma jeszcze przypisanego profilu kursanta. Skontaktuj się z lektorem.',
    'Nie udało się zapisać nowego hasła na koncie kursanta. Zaproszenie NIE zostało wysłane — sprawdź uprawnienia i spróbuj ponownie.',
  ];

  for (const key of keys) {
    assert.ok(pl[key] && pl[key].trim().length > 0, `Brak klucza w pl.json: ${key}`);
    assert.ok(en[key] && en[key].trim().length > 0, `Brak klucza w en.json: ${key}`);
  }
  // Angielskie tłumaczenie komunikatu D powinno realnie różnić się od polskiego (nie kopia klucza)
  assert.notEqual(en['To konto nie ma jeszcze przypisanego profilu kursanta. Skontaktuj się z lektorem.'], 'To konto nie ma jeszcze przypisanego profilu kursanta. Skontaktuj się z lektorem.');
});

test('changePasswordBeforeInvite: gdy willChangePassword=false, nie woła changePassword i nie rzuca', async () => {
  let called = false;
  await assert.doesNotReject(
    changePasswordBeforeInvite(false, async () => { called = true; }, 'błąd')
  );
  assert.equal(called, false);
});

test('changePasswordBeforeInvite: sukces zmiany hasła -> nie rzuca', async () => {
  await assert.doesNotReject(
    changePasswordBeforeInvite(true, async () => {}, 'błąd')
  );
});

test('changePasswordBeforeInvite: błąd zmiany hasła -> rzuca z podaną wiadomością, PRZED wysyłką maila', async () => {
  const failureMessage = 'Nie udało się zapisać nowego hasła na koncie kursanta. Zaproszenie NIE zostało wysłane — sprawdź uprawnienia i spróbuj ponownie.';
  let mailSent = false;

  const sendInvite = async () => {
    await changePasswordBeforeInvite(true, async () => { throw new Error('permission-denied'); }, failureMessage);
    // Ta linia reprezentuje wysyłkę maila w modalu — nie powinna zostać osiągnięta.
    mailSent = true;
  };

  await assert.rejects(sendInvite(), (err: any) => err.message === failureMessage);
  assert.equal(mailSent, false, 'Mail nie powinien zostać wysłany, gdy zmiana hasła się nie powiodła');
});
