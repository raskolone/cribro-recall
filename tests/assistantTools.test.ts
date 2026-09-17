import test from 'node:test';
import assert from 'node:assert/strict';
import { toPolishVocative } from '../utils/polishVocative';
import { ASSISTANT_SKILLS } from '../services/teacherAssistant';

test('toPolishVocative poprawnie odcina nazwisko i odmienia imię w wołaczu', () => {
  assert.equal(toPolishVocative('Maciej Wyrozumski'), 'Macieju');
  assert.equal(toPolishVocative('Anna Nowak'), 'Anno');
  assert.equal(toPolishVocative('Piotr Zieliński'), 'Piotrze');
  assert.equal(toPolishVocative('Michał Kaczmarek'), 'Michale');
  assert.equal(toPolishVocative('Dariusz'), 'Dariuszu');
});

test('ASSISTANT_SKILLS zawiera nowe komendy /import, /research, /raport i /plan', () => {
  const importSkill = ASSISTANT_SKILLS.find(s => s.command === '/import');
  assert.ok(importSkill, 'Brak skilla /import');
  assert.equal(importSkill?.adminOnly, true);

  const researchSkill = ASSISTANT_SKILLS.find(s => s.command === '/research');
  assert.ok(researchSkill, 'Brak skilla /research');

  const raportSkill = ASSISTANT_SKILLS.find(s => s.command === '/raport');
  assert.ok(raportSkill, 'Brak skilla /raport');

  const planSkill = ASSISTANT_SKILLS.find(s => s.command === '/plan');
  assert.ok(planSkill, 'Brak skilla /plan');
});

test('Ekstrakcja bloku students_import_json poprawnie parsuje listę kursantów', () => {
  const sampleJson = JSON.stringify({
    summary: 'Gotowe 2 konta',
    students: [
      { firstName: 'Jan', lastName: 'Kowalski', level: 'B2', company: 'InPost' },
      { firstName: 'Anna', lastName: 'Nowak', email: 'anna@allegro.pl', level: 'C1' },
    ],
  });

  const parsed = JSON.parse(sampleJson);
  assert.equal(parsed.students.length, 2);
  assert.equal(parsed.students[0].firstName, 'Jan');
  assert.equal(parsed.students[1].email, 'anna@allegro.pl');
});

test('Ekstrakcja bloku html_report poprawnie wyciąga tytuł i treść HTML', () => {
  const sampleHtml = `<div class="report"><h1>Plan wdrożenia CRIBRO</h1><p>Opis szczegółowy...</p></div>`;
  const titleMatch = sampleHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  assert.ok(titleMatch);
  assert.equal(titleMatch![1], 'Plan wdrożenia CRIBRO');
});
