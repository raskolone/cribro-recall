import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExercise } from "../utils/normalizeExercise";
import { seededShuffleOptions } from "../utils/multipleChoice";
import { evaluateDirectHomework } from "../utils/directHomeworkEvaluation";

test("ZMIANA 1: rozkład pozycji poprawnej odpowiedzi na 400 zadaniach jest zbliżony do równego (~25% na pozycję)", () => {
  const counts = [0, 0, 0, 0];
  const total = 400;

  for (let i = 0; i < total; i++) {
    const raw = {
      id: `mc-item-${i}`,
      question: `This is question number ${i} testing grammar ___.`,
      options: ["Correct form", "Distractor 1", "Distractor 2", "Distractor 3"],
      correctIndex: 0,
      grammarFocus: "tense",
    };

    const exercise = normalizeExercise(raw);
    assert.equal(exercise.state, "ready");
    assert.equal(exercise.type, "multiple_choice");
    assert.ok(typeof exercise.correctIndex === "number");
    assert.ok(exercise.correctIndex >= 0 && exercise.correctIndex < 4);
    assert.equal(exercise.options?.[exercise.correctIndex], "Correct form");
    counts[exercise.correctIndex]++;
  }

  // Wypisz dokładne liczby w raporcie testowym
  console.log("Rozkład pozycji poprawnej odpowiedzi na 400 zadaniach:", counts);
  const percentages = counts.map((c) => ((c / total) * 100).toFixed(1) + "%");
  console.log("Udziały procentowe:", percentages);

  // Każda pozycja powinna mieć około 25% (ze standardowym odchyleniem statystycznym dla 400 prób, min. 18%, max. 32%)
  for (let pos = 0; pos < 4; pos++) {
    const share = counts[pos] / total;
    assert.ok(share >= 0.18 && share <= 0.32, `Pozycja ${pos} ma nieoczekiwany udział: ${share}`);
  }
  assert.equal(counts.reduce((a, b) => a + b, 0), total);
});

test("ZMIANA 1: kolejność i correctIndex są identyczne przy powtórnym normalizowaniu (idempotencja i determinizm)", () => {
  const raw = {
    id: "task-abc-123",
    question: "She ___ to school every day.",
    options: ["goes", "go", "gone", "is go"],
    correctIndex: 0,
  };

  const first = normalizeExercise(raw);
  const second = normalizeExercise(raw);
  const third = normalizeExercise(first);

  assert.deepEqual(first.options, second.options);
  assert.equal(first.correctIndex, second.correctIndex);
  assert.deepEqual(first.options, third.options);
  assert.equal(first.correctIndex, third.correctIndex);
  assert.equal(first.options?.[first.correctIndex!], "goes");
});

test("ZMIANA 1: ocena działa poprawnie po tasowaniu", () => {
  const raw = {
    id: "eval-task-1",
    question: "They have ___ friends in London.",
    options: ["many", "much", "lot", "any"],
    correctIndex: 0,
  };

  const norm = normalizeExercise(raw);
  const correctIdx = norm.correctIndex!;
  const wrongIdx = (correctIdx + 1) % norm.options!.length;

  // Poprawny wybór (nowy indeks po tasowaniu)
  const evalCorrect = evaluateDirectHomework([raw], { 0: correctIdx }, "multiple_choice");
  assert.equal(evalCorrect.rows[0].isCorrect, true);
  assert.equal(evalCorrect.rows[0].score, 100);
  assert.equal(evalCorrect.rows[0].studentAnswer, "many");

  // Błędny wybór
  const evalWrong = evaluateDirectHomework([raw], { 0: wrongIdx }, "multiple_choice");
  assert.equal(evalWrong.rows[0].isCorrect, false);
  assert.equal(evalWrong.rows[0].score, 0);
  assert.notEqual(evalWrong.rows[0].studentAnswer, "many");
});

test("ZMIANA 1: stary zapis oceny nadal działa (zarówno zapis tekstowy, jak i indeksowy sprzed tasowania)", () => {
  const raw = {
    id: "legacy-task-99",
    question: "We usually ___ breakfast at 8.",
    options: ["have", "has", "are having", "had"],
    correctIndex: 0,
  };

  const norm = normalizeExercise(raw);
  // Stary zapis odpowiedzi indeksowej = 0 nadal musi działać
  const legacyIndexAnswer = 0;
  const evalLegacyIndex = evaluateDirectHomework([raw], { 0: legacyIndexAnswer }, "multiple_choice");
  assert.equal(evalLegacyIndex.rows[0].isCorrect, true);
  assert.equal(evalLegacyIndex.rows[0].score, 100);

  // Zapis tekstowy ("have") również działa
  const textAnswer = "have";
  const evalText = evaluateDirectHomework([raw], { 0: textAnswer }, "multiple_choice");
  assert.equal(evalText.rows[0].isCorrect, true);
  assert.equal(evalText.rows[0].score, 100);
  assert.equal(evalText.rows[0].correctTranslation, "have");

  // Zapis błędnego tekstu ("has") daje 0
  const wrongText = "has";
  const evalWrongText = evaluateDirectHomework([raw], { 0: wrongText }, "multiple_choice");
  assert.equal(evalWrongText.rows[0].isCorrect, false);
  assert.equal(evalWrongText.rows[0].score, 0);
});
