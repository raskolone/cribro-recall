import './helpers/jsdomEnv';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { useState } from 'react';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useSentenceSession } from '../hooks/useSentenceSession';
import { exerciseId, stampExercises } from '../utils/sentenceSession';

afterEach(() => cleanup());

interface Ex { polishSentence: string; englishTranslation: string; erroneousSentence?: string }
interface Res { studentAnswer: string; score: number }

const round = (...names: string[]): Ex[] =>
  names.map((n) => ({ polishSentence: `PL ${n}`, englishTranslation: `EN ${n}`, erroneousSentence: `ERR ${n}` }));

/** Ekran w pigułce: lista zadań (jak `exercises`) i stan zdań (jak w generatorze). */
const mount = (initial: Ex[]) =>
  renderHook(() => {
    const [exercises, setExercises] = useState(() => stampExercises(initial));
    const sentences = useSentenceSession<Res>(exercises);
    return { exercises, setExercises, sentences };
  });

test('1) A→B: po przejściu na B pole i feedback B są puste, A zachowuje swoją ocenę', () => {
  const { result } = mount(round('A', 'B'));
  act(() => {
    result.current.sentences.setAnswer(0, 'moja odpowiedź A');
    const id = result.current.sentences.beginEvaluation(0)!;
    result.current.sentences.completeEvaluation(id, { studentAnswer: 'moja odpowiedź A', score: 75 });
  });
  const s = result.current.sentences;
  assert.equal(s.statuses[0], 'evaluated');
  assert.equal(s.answers[1], '', 'pole B puste');
  assert.equal(s.statuses[1], undefined, 'B bez statusu, więc pole edytowalne');
  assert.equal(s.results[1], undefined, 'B bez feedbacku');
  assert.equal(s.hints[1], false);
});

test('2) A sprawdzone, B bez sprawdzenia, Poprzednie → A pokazuje własną odpowiedź i ocenę, B własną nieocenioną', () => {
  const { result } = mount(round('A', 'B'));
  act(() => {
    result.current.sentences.setAnswer(0, 'odp A');
    result.current.sentences.completeEvaluation(result.current.sentences.beginEvaluation(0)!, { studentAnswer: 'odp A', score: 75 });
    result.current.sentences.setAnswer(1, 'odp B');
  });
  const s = result.current.sentences;
  assert.deepEqual(s.answers, ['odp A', 'odp B']);
  assert.equal(s.statuses[0], 'evaluated');
  assert.deepEqual(s.results[0], { studentAnswer: 'odp A', score: 75 });
  assert.equal(s.statuses[1], undefined, 'zablokowane tylko A, B nadal edytowalne');
  assert.equal(s.results[1], undefined);
});

test('3) zapis odpowiedzi trafia pod id właściwego zadania, także gdy wynik wraca asynchronicznie', () => {
  const { result } = mount(round('A', 'B', 'C'));
  let idA: string | undefined;
  act(() => { idA = result.current.sentences.beginEvaluation(0); });
  // kursant zdążył przejść na C i pisze, zanim wróci ocena A
  act(() => { result.current.sentences.setAnswer(2, 'odp C'); });
  act(() => { result.current.sentences.completeEvaluation(idA!, { studentAnswer: 'odp A', score: 90 }); });
  const s = result.current.sentences;
  const [a, b, c] = result.current.exercises;
  assert.equal(idA, exerciseId(a));
  assert.deepEqual(s.results[0], { studentAnswer: 'odp A', score: 90 });
  assert.equal(s.results[2], undefined, 'ocena A nie przykleja się do C');
  assert.equal(s.statuses[2], undefined);
  assert.equal(s.answers[2], 'odp C');
  assert.equal(s.answers[1], '');
  assert.notEqual(exerciseId(a), exerciseId(b));
  assert.notEqual(exerciseId(b), exerciseId(c));
});

test('nowa runda zdań (te same zdania, nowe id) startuje z czystym stanem — stary wynik z indeksu 3 nie przykleja się do zdania 4', () => {
  const sameTexts = round('s1', 's2', 's3', 's4', 's5');
  const { result } = mount(sameTexts);
  act(() => {
    for (let i = 0; i < 4; i++) {
      result.current.sentences.setAnswer(i, `R1 odp ${i + 1}`);
      result.current.sentences.completeEvaluation(result.current.sentences.beginEvaluation(i)!, { studentAnswer: `R1 odp ${i + 1}`, score: 75 });
    }
  });
  assert.equal(Object.keys(result.current.sentences.results).length, 4);
  // „Generuj kolejne zdania": nowe obiekty, a nawet te same teksty — bez wołania reset()
  act(() => { result.current.setExercises(stampExercises(sameTexts)); });
  const s = result.current.sentences;
  assert.deepEqual(s.answers, ['', '', '', '', '']);
  assert.deepEqual(s.statuses, {});
  assert.deepEqual(s.results, {});
});

test('późna ocena z poprzedniej rundy nie trafia do nowej', () => {
  const { result } = mount(round('A', 'B'));
  let oldId: string | undefined;
  act(() => { oldId = result.current.sentences.beginEvaluation(1); });
  act(() => { result.current.setExercises(stampExercises(round('A', 'B'))); });
  act(() => { result.current.sentences.completeEvaluation(oldId!, { studentAnswer: 'stara', score: 10 }); });
  assert.deepEqual(result.current.sentences.results, {});
  assert.deepEqual(result.current.sentences.statuses, {});
});

test('4) odświeżenie w trakcie: stan żyje tylko w pamięci, nic nie jest odtwarzane ani zapisywane w przeglądarce', () => {
  const before = window.localStorage.length;
  const first = mount(round('A', 'B'));
  act(() => { first.result.current.sentences.setAnswer(0, 'odp A'); });
  assert.equal(window.localStorage.length, before, 'hook niczego nie zapisuje w localStorage');
  first.unmount();
  const second = mount(round('A', 'B'));
  assert.deepEqual(second.result.current.sentences.answers, ['', ''], 'po odświeżeniu żadna odpowiedź nie wraca pod inne zdanie');
});

test('błąd sprawdzania zdejmuje status „w toku" tylko temu zdaniu, odpowiedź zostaje', () => {
  const { result } = mount(round('A', 'B'));
  let id: string | undefined;
  act(() => { result.current.sentences.setAnswer(0, 'odp A'); id = result.current.sentences.beginEvaluation(0); });
  assert.equal(result.current.sentences.statuses[0], 'evaluating');
  act(() => { result.current.sentences.failEvaluation(id!); });
  assert.equal(result.current.sentences.statuses[0], undefined);
  assert.equal(result.current.sentences.answers[0], 'odp A');
});

test('„Kopiuj zdanie do edycji" wstawia zdanie BIEŻĄCEGO zadania, a zbiorczy zapis wyników nie zmienia statusów pustych zdań', () => {
  const { result } = mount(round('A', 'B'));
  act(() => { result.current.sentences.setAnswer(1, result.current.exercises[1].erroneousSentence ?? ''); });
  assert.deepEqual(result.current.sentences.answers, ['', 'ERR B']);
  act(() => {
    result.current.sentences.applyResults({ 0: { studentAnswer: '', score: 0 }, 1: { studentAnswer: 'ERR B', score: 40 } }, [1]);
  });
  assert.equal(result.current.sentences.statuses[0], undefined, 'domyślny wynik „brak odpowiedzi" nie oznacza sprawdzenia');
  assert.equal(result.current.sentences.statuses[1], 'evaluated');
  assert.equal(result.current.sentences.results[0]?.score, 0);
});

test('generator trzyma stan zdań po id: brak zapisów po indeksie, każde wprowadzenie zadań dostaje nowe id', () => {
  const src = readFileSync(new URL('../components/dashboard/AIExerciseGeneratorScreen.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /setStudentAnswers|setEvaluationStatuses|setSingleEvaluationResults|setShowHints/, 'stan po indeksie wrócił');
  assert.match(src, /useSentenceSession</);
  const calls = [...src.matchAll(/setExercises\(([^;]*)\)/g)].map((m) => m[1]);
  const adding = calls.filter((arg) => arg.trim() !== '[]');
  assert.ok(adding.length >= 6, 'nie znaleziono miejsc wprowadzania zadań');
  for (const arg of adding) assert.match(arg, /stampExercises/, `zadania bez nowego id: setExercises(${arg})`);
});
