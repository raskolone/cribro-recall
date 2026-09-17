import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toPolishVocative,
  formatOnlyFirstName,
  toPolishInstrumental,
  sanitizeBriefingHeadline,
  formatPolishGreeting,
  detectPolishGender,
  inflectPolishVerb,
  inflectByGender,
} from '../utils/polishVocative';

test('toPolishVocative poprawnie odmienia imiona w wołaczu', () => {
  assert.equal(toPolishVocative('Anna'), 'Anno');
  assert.equal(toPolishVocative('Anna Nowak'), 'Anno');
  assert.equal(toPolishVocative('Marta'), 'Marto');
  assert.equal(toPolishVocative('Kasia'), 'Kasiu');
  assert.equal(toPolishVocative('Zuzia'), 'Zuziu');
  assert.equal(toPolishVocative('Maciej'), 'Macieju');
  assert.equal(toPolishVocative('Piotr'), 'Piotrze');
  assert.equal(toPolishVocative('Paweł'), 'Pawle');
  assert.equal(toPolishVocative('Michał'), 'Michale');
  assert.equal(toPolishVocative('Jan'), 'Janie');
  assert.equal(toPolishVocative('Tomasz'), 'Tomaszu');
  assert.equal(toPolishVocative('Łukasz'), 'Łukaszu');
  assert.equal(toPolishVocative('Krzysztof'), 'Krzysztofie');
  assert.equal(toPolishVocative('Jakub'), 'Jakubie');
  assert.equal(toPolishVocative('Adam'), 'Adamie');
  assert.equal(toPolishVocative('Karolina'), 'Karolino');
});

test('formatPolishGreeting tworzy eleganckie powitanie z przecinkiem', () => {
  assert.equal(formatPolishGreeting('Anna'), 'Cześć, Anno!');
  assert.equal(formatPolishGreeting('Marta'), 'Cześć, Marto!');
  assert.equal(formatPolishGreeting('Maciej'), 'Cześć, Macieju!');
  assert.equal(formatPolishGreeting(''), 'Cześć!');
});

test('detectPolishGender poprawnie rozpoznaje płeć gramatyczną imienia', () => {
  // Imiona żeńskie
  assert.equal(detectPolishGender('Anna'), 'female');
  assert.equal(detectPolishGender('Anna Nowak'), 'female');
  assert.equal(detectPolishGender('Marta'), 'female');
  assert.equal(detectPolishGender('Kasia'), 'female');
  assert.equal(detectPolishGender('Karolina'), 'female');
  assert.equal(detectPolishGender('Monika'), 'female');
  assert.equal(detectPolishGender('Miriam'), 'female'); // wyjątek bez -a
  assert.equal(detectPolishGender('Ines'), 'female');   // wyjątek bez -a

  // Imiona męskie
  assert.equal(detectPolishGender('Łukasz'), 'male');
  assert.equal(detectPolishGender('Piotr'), 'male');
  assert.equal(detectPolishGender('Maciej'), 'male');
  assert.equal(detectPolishGender('Jan'), 'male');
  assert.equal(detectPolishGender('Krzysztof'), 'male');
  assert.equal(detectPolishGender('Kuba'), 'male');     // wyjątek męski na -a
  assert.equal(detectPolishGender('Kosma'), 'male');    // wyjątek męski na -a
  assert.equal(detectPolishGender('Barnaba'), 'male');  // wyjątek męski na -a
});

test('inflectPolishVerb poprawnie dobiera formę czasownika wg imienia odbiorcy', () => {
  assert.equal(inflectPolishVerb('Anna', 'znalazła', 'znalazł'), 'znalazła');
  assert.equal(inflectPolishVerb('Łukasz', 'znalazła', 'znalazł'), 'znalazł');
  assert.equal(inflectPolishVerb('Marta', 'odesłałaś', 'odesłałeś'), 'odesłałaś');
  assert.equal(inflectPolishVerb('Piotr', 'odesłałaś', 'odesłałeś'), 'odesłałeś');
  assert.equal(inflectPolishVerb('Kasia', 'zrobiłaś', 'zrobiłeś'), 'zrobiłaś');
  assert.equal(inflectPolishVerb('Maciej', 'zrobiłaś', 'zrobiłeś'), 'zrobiłeś');
});

test('inflectByGender poprawnie dobiera formę żeńską lub męską', () => {
  assert.equal(inflectByGender('female', 'Gotowa', 'Gotowy'), 'Gotowa');
  assert.equal(inflectByGender('male', 'Gotowa', 'Gotowy'), 'Gotowy');
});

test('formatOnlyFirstName wyciąga wyłącznie pierwsze imię z różnych formatów', () => {
  assert.equal(formatOnlyFirstName('Maciej Wyrozumski'), 'Maciej');
  assert.equal(formatOnlyFirstName('Milena.Miksa-Matyjasik'), 'Milena');
  assert.equal(formatOnlyFirstName('anna_nowak'), 'Anna');
  assert.equal(formatOnlyFirstName('Piotr'), 'Piotr');
  assert.equal(formatOnlyFirstName(''), '');
});

test('toPolishInstrumental poprawnie tworzy formę narzędnika (z kim?)', () => {
  assert.equal(toPolishInstrumental('Anna'), 'Anną');
  assert.equal(toPolishInstrumental('Milena'), 'Mileną');
  assert.equal(toPolishInstrumental('Milena Miksa-Matyjasik'), 'Mileną');
  assert.equal(toPolishInstrumental('Kasia'), 'Kasią');
  assert.equal(toPolishInstrumental('Maciej'), 'Maciejem');
  assert.equal(toPolishInstrumental('Maciej Wyrozumski'), 'Maciejem');
  assert.equal(toPolishInstrumental('Piotr'), 'Piotrem');
  assert.equal(toPolishInstrumental('Michał'), 'Michałem');
  assert.equal(toPolishInstrumental('Bartek'), 'Bartkiem');
  assert.equal(toPolishInstrumental('Paweł'), 'Pawłem');
});

test('sanitizeBriefingHeadline czyści nagłówek odprawy lektora do wołacza i samego imienia', () => {
  // Przypadek ze zrzutu ekranu użytkownika
  const raw1 = 'Maciej Wyrozumski, ostatnio z Mileną Miksa-Matyjasik w opisywaniu problemów, przekazywaniu statusów i reakcji na trudne.';
  const res1 = sanitizeBriefingHeadline(raw1, 'Maciej Wyrozumski', 'Milena Miksa-Matyjasik');
  assert.equal(res1, 'Macieju, ostatnio z Mileną w opisywaniu problemów, przekazywaniu statusów i reakcji na trudne.');

  // Przypadek z mianownikiem
  const raw2 = 'Maciej, ostatnio z Anną przerobiliście Present Perfect.';
  const res2 = sanitizeBriefingHeadline(raw2, 'Maciej', 'Anna Nowak');
  assert.equal(res2, 'Macieju, ostatnio z Anną przerobiliście Present Perfect.');
});

