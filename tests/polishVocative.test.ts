import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toPolishVocative,
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
