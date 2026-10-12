import test from "node:test";
import assert from "node:assert/strict";
import { clampMatchingPairCount, normalizeExercise } from "../utils/normalizeExercise";
import { generateMatching, HomeworkGenerationRequest } from "../services/homeworkGenerator";
import { splitRounds, MAX_PAIRS_PER_ROUND } from "../utils/matchingBoard";

test("clampMatchingPairCount: domyślna 5 przy braku wartości lub wartości nieliczbowej", () => {
  assert.equal(clampMatchingPairCount(undefined), 5);
  assert.equal(clampMatchingPairCount(null), 5);
  assert.equal(clampMatchingPairCount(""), 5);
  assert.equal(clampMatchingPairCount("invalid"), 5);
  assert.equal(clampMatchingPairCount(NaN), 5);
});

test("clampMatchingPairCount: przycięcie 3→4 i 12→8 do dozwolonego zakresu 4–8", () => {
  assert.equal(clampMatchingPairCount(3), 4, "3 powinno zostać przycięte do 4");
  assert.equal(clampMatchingPairCount(1), 4, "1 powinno zostać przycięte do 4");
  assert.equal(clampMatchingPairCount(0), 4, "0 powinno zostać przycięte do 4");
  assert.equal(clampMatchingPairCount(-2), 4, "-2 powinno zostać przycięte do 4");
  assert.equal(clampMatchingPairCount(12), 8, "12 powinno zostać przycięte do 8");
  assert.equal(clampMatchingPairCount(9), 8, "9 powinno zostać przycięte do 8");
  assert.equal(clampMatchingPairCount(20), 8, "20 powinno zostać przycięte do 8");
});

test("clampMatchingPairCount: zachowuje wartości w dozwolonym zakresie 4–8", () => {
  for (let n = 4; n <= 8; n++) {
    assert.equal(clampMatchingPairCount(n), n);
  }
});

test("normalizeExercise: zadanie z 4 parami przechodzi i ma state ready", () => {
  const raw4 = {
    type: "matching",
    pairs: [
      { id: "p1", left: "cat", right: "kot" },
      { id: "p2", left: "dog", right: "pies" },
      { id: "p3", left: "bird", right: "ptak" },
      { id: "p4", left: "fish", right: "ryba" },
    ],
  };
  const normalized = normalizeExercise(raw4);
  assert.equal(normalized.state, "ready");
  assert.equal(normalized.type, "matching");
  assert.equal(normalized.pairs?.length, 4);
  assert.equal(normalized.matchingPairCount, 4);
});

test("normalizeExercise: zadanie z 8 parami przechodzi i ma state ready", () => {
  const raw8 = {
    type: "matching",
    pairs: Array.from({ length: 8 }, (_, i) => ({
      id: `pair-${i}`,
      left: `word-${i}`,
      right: `znaczenie-${i}`,
    })),
  };
  const normalized = normalizeExercise(raw8);
  assert.equal(normalized.state, "ready");
  assert.equal(normalized.type, "matching");
  assert.equal(normalized.pairs?.length, 8);
  assert.equal(normalized.matchingPairCount, 8);
});

test("normalizeExercise: przycina matchingPairCount w surowym zadaniu (3→4 i 12→8)", () => {
  const pairs = Array.from({ length: 5 }, (_, i) => ({
    id: `p${i}`,
    left: `en${i}`,
    right: `pl${i}`,
  }));

  const normLow = normalizeExercise({ type: "matching", matchingPairCount: 3, pairs });
  assert.equal(normLow.matchingPairCount, 4);

  const normHigh = normalizeExercise({ type: "matching", matchingPairCount: 12, pairs });
  assert.equal(normHigh.matchingPairCount, 8);
});

test("normalizeExercise: zadanie z mniej niż 2 parami dostaje invalid", () => {
  const norm0 = normalizeExercise({ type: "matching", pairs: [] });
  assert.equal(norm0.state, "invalid");

  const norm1 = normalizeExercise({ type: "matching", pairs: [{ id: "1", left: "a", right: "b" }] });
  assert.equal(norm1.state, "invalid");
});

test("generateMatching: generator prosi w prompcie o dokładnie N par", async () => {
  const promptsSeen: string[] = [];
  const fakeAsk = async (prompt: string) => {
    promptsSeen.push(prompt);
    return {
      parsed: {
        pairs: Array.from({ length: 6 }, (_, i) => ({ left: `left-${i}`, right: `right-${i}` })),
      },
      modelUsed: "gemini-2.5-flash",
    };
  };

  const req: HomeworkGenerationRequest = {
    source: { pastedText: "apple - jabłko, banana - banan, orange - pomarańcza" },
    types: ["matching"],
    perType: 3,
    level: "B1",
    matchingPairCount: 6,
  };

  const result = await generateMatching(req, "materiały", undefined, fakeAsk as any);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].pairs.length, 6);
  assert.ok(promptsSeen[0].includes("Wybierz DOKŁADNIE 6 słów"));
  assert.ok(promptsSeen[0].includes("Zwróć DOKŁADNIE 6 unikalnych par"));
});

test("generateMatching: domyślna liczba par to 5 gdy brak parametru", async () => {
  const promptsSeen: string[] = [];
  const fakeAsk = async (prompt: string) => {
    promptsSeen.push(prompt);
    return {
      parsed: {
        pairs: Array.from({ length: 5 }, (_, i) => ({ left: `left-${i}`, right: `right-${i}` })),
      },
      modelUsed: "gemini-2.5-flash",
    };
  };

  const req: HomeworkGenerationRequest = {
    source: { pastedText: "tekst" },
    types: ["matching"],
    perType: 3,
    level: "B1",
  };

  const result = await generateMatching(req, "materiały", undefined, fakeAsk as any);
  assert.equal(result.items[0].pairs.length, 5);
  assert.ok(promptsSeen[0].includes("Wybierz DOKŁADNIE 5 słów"));
});

test("generateMatching: inna liczba par niż N powoduje odrzucenie z regeneracją, a nie cichy tryb", async () => {
  const calls: string[] = [];
  let attempt = 0;

  const fakeAsk = async (prompt: string) => {
    calls.push(prompt);
    attempt++;
    if (attempt === 1) {
      // Model w 1. próbie zwraca 4 pary zamiast 6
      return {
        parsed: {
          pairs: [
            { left: "a", right: "1" },
            { left: "b", right: "2" },
            { left: "c", right: "3" },
            { left: "d", right: "4" },
          ],
        },
        modelUsed: "gemini-2.5-flash",
      };
    }
    // W 2. próbie zwraca dokładnie 6 par
    return {
      parsed: {
        pairs: [
          { left: "a", right: "1" },
          { left: "b", right: "2" },
          { left: "c", right: "3" },
          { left: "d", right: "4" },
          { left: "e", right: "5" },
          { left: "f", right: "6" },
        ],
      },
      modelUsed: "gemini-2.5-flash",
    };
  };

  const req: HomeworkGenerationRequest = {
    source: { pastedText: "tekst" },
    types: ["matching"],
    perType: 3,
    level: "B1",
    matchingPairCount: 6,
  };

  const result = await generateMatching(req, "materiały", undefined, fakeAsk as any);
  assert.equal(calls.length, 2, "Powinno nastąpić odrzucenie i ponowienie próby");
  assert.ok(calls[1].includes("Poprzednia odpowiedź zawierała 4 par zamiast wymaganych dokładnie 6"));
  assert.equal(result.items[0].pairs.length, 6);
});

test("układ dla 8 par: splitRounds z limitem 8 nie dzieli zadania na rundy", () => {
  const pairs8 = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, left: `l${i}`, right: `r${i}` }));
  const rounds = splitRounds(pairs8, Math.max(MAX_PAIRS_PER_ROUND, pairs8.length));
  assert.equal(rounds.length, 1, "8 par powinno być w jednej rundzie");
  assert.equal(rounds[0].length, 8);
});
