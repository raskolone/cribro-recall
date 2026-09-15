import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHomeworkEmail,
  buildUnsubscribeUrl,
  generateUnsubscribeToken,
} from '../functions/src/emailTemplate';

test('generateUnsubscribeToken tworzy powtarzalny 16-znakowy token HMAC', () => {
  const uid = 'student-test-uid-123';
  const token1 = generateUnsubscribeToken(uid);
  const token2 = generateUnsubscribeToken(uid);

  assert.equal(token1.length, 16);
  assert.equal(token1, token2);
  assert.notEqual(token1, generateUnsubscribeToken('other-student-uid'));
});

test('buildUnsubscribeUrl generuje poprawny URL z parametrami uid i token', () => {
  const uid = 'student-xyz';
  const url = buildUnsubscribeUrl(uid);

  assert.ok(url.startsWith('https://app.maciej.pro/unsubscribe?'));
  assert.ok(url.includes(`uid=${uid}`));
  assert.ok(url.includes(`token=${generateUnsubscribeToken(uid)}`));
});

test('buildHomeworkEmail zawiera link wypisania w wersji HTML i tekstowej', () => {
  const uid = 'student-abc';
  const unsubUrl = buildUnsubscribeUrl(uid);

  const email = buildHomeworkEmail({
    studentName: 'Jan Kowalski',
    title: 'Czasowniki modalne',
    dueDate: '2026-09-20',
    itemCount: 5,
    assignedBy: 'Lektor Testowy',
    unsubscribeUrl: unsubUrl,
  });

  // HTML (z poprawnie zakodowanym & w href jako &amp;)
  assert.ok(email.html.includes(unsubUrl.replace('&', '&amp;')));
  assert.ok(email.html.includes('Wypisz się z powiadomień e-mail'));

  // Text
  assert.ok(email.text.includes(unsubUrl));
  assert.ok(email.text.includes('Wypisz się z powiadomień:'));
});

test('buildHomeworkEmail działa poprawnie bez podanego unsubscribeUrl', () => {
  const email = buildHomeworkEmail({
    studentName: 'Jan',
    title: 'Test bez linku',
    itemCount: 3,
  });

  assert.ok(!email.html.includes('Wypisz się z powiadomień e-mail'));
  assert.ok(email.html.includes('NOWA PRACA DOMOWA'));
  assert.ok(email.text.includes('Przygotowałem dla Ciebie nową pracę domową'));
  assert.ok(email.html.includes('Maciej Wyrozumski'));
  assert.ok(email.html.includes('wyrozumski@maciej.pro'));
  assert.ok(email.html.includes('+48 698 250 507'));
  assert.ok(email.html.includes('www.maciej.pro'));
  assert.ok(email.html.includes('linkedin.com/in/maciej-pro'));
  assert.ok(email.html.includes('github.com/raskolone'));
});

test('buildHomeworkConfirmationEmail generuje powitanie z wołaczem, prostą treść i stopkę z wizytówką', async () => {
  const { buildHomeworkConfirmationEmail } = await import('../services/homeworkEmail');

  const email = buildHomeworkConfirmationEmail({
    studentName: 'Aleksander Ziółkowski',
    title: 'Cybersecurity & Privacy in the AI Era',
    dueDate: '2026-09-16',
    instructions: 'Zwróć uwagę na czasowniki modalne.',
    assignedBy: 'Maciej Wyrozumski',
    sentences: [
      { polishSentence: 'W dzisiejszych czasach prywatność w sieci jest kluczowa.', hint: 'crucial' },
      { polishSentence: 'Musimy uważać na podejrzane wiadomości e-mail.', hint: 'phishing' }
    ],
    customNote: 'Dobra robota na dzisiejszych zajęciach!',
  });

  assert.equal(email.greeting, 'Cześć, Aleksandrze!');
  assert.ok(email.html.includes('Cześć, Aleksandrze!'));
  assert.ok(email.html.includes('Cybersecurity &amp; Privacy in the AI Era'));
  // Treść ma być prosta – bez szczegółowego listowania zdań
  assert.ok(!email.html.includes('W dzisiejszych czasach prywatność w sieci jest kluczowa.'));
  assert.ok(email.html.includes('Zwróć uwagę na czasowniki modalne.'));
  assert.ok(email.html.includes('Dobra robota na dzisiejszych zajęciach!'));
  
  // Wizytówka w stopce
  assert.ok(email.html.includes('Maciej Wyrozumski'));
  assert.ok(email.html.includes('Instructional Designer | AI EdTech Specialist | English Trainer'));
  assert.ok(email.html.includes('wyrozumski@maciej.pro'));
  assert.ok(email.html.includes('+48 698 250 507'));
  assert.ok(email.html.includes('www.maciej.pro'));
  assert.ok(email.html.includes('linkedin.com/in/maciej-pro'));
  assert.ok(email.html.includes('github.com/raskolone'));

  // Wersja tekstowa
  assert.ok(email.text.includes('Cześć, Aleksandrze!'));
  assert.ok(email.text.includes('Cybersecurity & Privacy in the AI Era'));
  assert.ok(!email.text.includes('1. W dzisiejszych czasach prywatność w sieci jest kluczowa.'));
  assert.ok(email.text.includes('Maciej Wyrozumski'));
  assert.ok(email.text.includes('wyrozumski@maciej.pro'));
});

