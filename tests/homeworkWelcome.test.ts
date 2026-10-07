import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHomeworkWelcomeGreeting,
  extractStudentVocative,
} from '../utils/homeworkWelcome';

test('buildHomeworkWelcomeGreeting: normalne imię odmienia w wołaczu', () => {
  assert.equal(buildHomeworkWelcomeGreeting('Marek'), 'Świetnie, że tu jesteś, Marku!');
  assert.equal(buildHomeworkWelcomeGreeting('Anna'), 'Świetnie, że tu jesteś, Anno!');
  assert.equal(buildHomeworkWelcomeGreeting('Piotr'), 'Świetnie, że tu jesteś, Piotrze!');
  assert.equal(extractStudentVocative('Marek'), 'Marku');
  assert.equal(extractStudentVocative('Anna'), 'Anno');
});

test('buildHomeworkWelcomeGreeting: imię podane już w wołaczu zachowuje poprawną formę', () => {
  assert.equal(buildHomeworkWelcomeGreeting('Marku'), 'Świetnie, że tu jesteś, Marku!');
  assert.equal(buildHomeworkWelcomeGreeting('Anno'), 'Świetnie, że tu jesteś, Anno!');
  assert.equal(buildHomeworkWelcomeGreeting('Piotrze'), 'Świetnie, że tu jesteś, Piotrze!');
  assert.equal(extractStudentVocative('Marku'), 'Marku');
});

test('buildHomeworkWelcomeGreeting: puste wartości zwracają tekst bez imienia', () => {
  assert.equal(buildHomeworkWelcomeGreeting(''), 'Świetnie, że tu jesteś!');
  assert.equal(buildHomeworkWelcomeGreeting('   '), 'Świetnie, że tu jesteś!');
  assert.equal(buildHomeworkWelcomeGreeting(null), 'Świetnie, że tu jesteś!');
  assert.equal(buildHomeworkWelcomeGreeting(undefined), 'Świetnie, że tu jesteś!');
  assert.equal(extractStudentVocative(''), '');
  assert.equal(extractStudentVocative(null), '');
  assert.equal(extractStudentVocative(undefined), '');
});

test('buildHomeworkWelcomeGreeting: ogólne "Kursant" lub "Kursancie" zwraca tekst bez imienia, nigdy "Kursancie"', () => {
  assert.equal(buildHomeworkWelcomeGreeting('Kursant'), 'Świetnie, że tu jesteś!');
  assert.equal(buildHomeworkWelcomeGreeting('kursant'), 'Świetnie, że tu jesteś!');
  assert.equal(buildHomeworkWelcomeGreeting('Kursancie'), 'Świetnie, że tu jesteś!');
  assert.equal(buildHomeworkWelcomeGreeting('kursancie'), 'Świetnie, że tu jesteś!');
  assert.equal(buildHomeworkWelcomeGreeting('Uczeń'), 'Świetnie, że tu jesteś!');
  assert.equal(extractStudentVocative('Kursant'), '');
  assert.equal(extractStudentVocative('Kursancie'), '');
});

test('buildHomeworkWelcomeGreeting: imię z wielką/małą literą jest poprawnie normalizowane', () => {
  assert.equal(buildHomeworkWelcomeGreeting('marek'), 'Świetnie, że tu jesteś, Marku!');
  assert.equal(buildHomeworkWelcomeGreeting('MAREK'), 'Świetnie, że tu jesteś, Marku!');
  assert.equal(buildHomeworkWelcomeGreeting('anna'), 'Świetnie, że tu jesteś, Anno!');
  assert.equal(buildHomeworkWelcomeGreeting('ANNA'), 'Świetnie, że tu jesteś, Anno!');
  assert.equal(extractStudentVocative('marek'), 'Marku');
  assert.equal(extractStudentVocative('MAREK'), 'Marku');
});

test('buildHomeworkWelcomeGreeting: imię dwuczłonowe odcina nazwisko i bierze pierwsze imię', () => {
  assert.equal(buildHomeworkWelcomeGreeting('Marek Kowalski'), 'Świetnie, że tu jesteś, Marku!');
  assert.equal(buildHomeworkWelcomeGreeting('Anna Nowak'), 'Świetnie, że tu jesteś, Anno!');
  assert.equal(buildHomeworkWelcomeGreeting('Jan Paweł'), 'Świetnie, że tu jesteś, Janie!');
  assert.equal(extractStudentVocative('Marek Kowalski'), 'Marku');
});

test('buildHomeworkWelcomeGreeting: wspiera obiekt użytkownika jako wejście', () => {
  assert.equal(buildHomeworkWelcomeGreeting({ name: 'Marek Kowalski' }), 'Świetnie, że tu jesteś, Marku!');
  assert.equal(buildHomeworkWelcomeGreeting({ firstName: 'Anna' }), 'Świetnie, że tu jesteś, Anno!');
  assert.equal(buildHomeworkWelcomeGreeting({ username: 'Kursant' }), 'Świetnie, że tu jesteś!');
  assert.equal(buildHomeworkWelcomeGreeting({}), 'Świetnie, że tu jesteś!');
});
