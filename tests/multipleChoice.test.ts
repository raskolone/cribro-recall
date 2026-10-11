import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAMMAR_FOCUS_IDS, grammarFocusLabelKey, isGrammarFocusId } from '../utils/grammarFocus';
import { grammarFocusOf, hasValidKey, mcOptionViews, shuffleOptions } from '../utils/multipleChoice';
import { MULTIPLE_CHOICE_SCHEMA, generateMultipleChoice } from '../services/homeworkGenerator';
import { checkItemLocally } from '../utils/exerciseQuality';
import { EXERCISE_IRON_RULES } from '../utils/exerciseQualityRules';
import pl from '../pl.json';
import en from '../en.json';

test('grammarFocus: schemat structured output przyjmuje wyłącznie wartość ze stałej listy (enum)', () => {
  const props = (MULTIPLE_CHOICE_SCHEMA.properties.items.items as any).properties;
  assert.deepEqual(props.grammarFocus.enum, [...GRAMMAR_FOCUS_IDS]);
  assert.deepEqual((MULTIPLE_CHOICE_SCHEMA.properties.items.items as any).required, ['question', 'grammarFocus', 'options', 'correctIndex', 'explanation']);
  assert.equal(isGrammarFocusId('tense'), true);
  assert.equal(isGrammarFocusId('Present Simple'), false);
  assert.equal(isGrammarFocusId(undefined), false);
});

test('etykiety zagadnień: każdy identyfikator ma etykietę w i18n pl i en (model etykiety nie generuje)', () => {
  for (const id of GRAMMAR_FOCUS_IDS) {
    assert.equal(grammarFocusLabelKey(id), `grammarFocus.${id}`);
    assert.ok(typeof (pl as any).grammarFocus[id] === 'string' && (pl as any).grammarFocus[id].length > 0, `pl ${id}`);
    assert.ok(typeof (en as any).grammarFocus[id] === 'string' && (en as any).grammarFocus[id].length > 0, `en ${id}`);
  }
  // schemat nie ma pola z etykietą
  const props = Object.keys((MULTIPLE_CHOICE_SCHEMA.properties.items.items as any).properties);
  assert.ok(!props.some((p) => /label|name|title/i.test(p)));
});

test('mcOptionViews: przed odpowiedzią rest/selected, po odpowiedzi correct/wrong/locked', () => {
  assert.deepEqual(mcOptionViews(4, -1, 0, true).map((v) => v.state), ['rest', 'rest', 'rest', 'rest']);
  assert.deepEqual(mcOptionViews(4, 2, 0, false).map((v) => v.state), ['rest', 'rest', 'selected', 'rest']);
  assert.deepEqual(mcOptionViews(4, 2, 0, true).map((v) => v.state), ['correct', 'locked', 'wrong', 'locked']);
  assert.deepEqual(mcOptionViews(4, 0, 0, true).map((v) => v.state), ['correct', 'locked', 'locked', 'locked']);
  assert.deepEqual(mcOptionViews(4, 2, 0, true).map((v) => v.verdict), ['correct', undefined, 'wrong', undefined]);
});

test('stare dane bez poprawnego klucza: wybór jest tylko „selected”, bez wyniku', () => {
  assert.deepEqual(mcOptionViews(3, 1, undefined, true).map((v) => v.state), ['rest', 'selected', 'rest']);
  assert.deepEqual(mcOptionViews(3, 1, 9, true).map((v) => v.state), ['rest', 'selected', 'rest']);
  assert.equal(hasValidKey(['a', 'b'], 1), true);
  assert.equal(hasValidKey(['a', 'b'], 2), false);
});

test('grammarFocusOf: tylko wartość z listy; stare zadania i śmieci → null', () => {
  assert.deepEqual(grammarFocusOf({ grammarFocus: 'article' }), { id: 'article', labelKey: 'grammarFocus.article' });
  assert.equal(grammarFocusOf({}), null);
  assert.equal(grammarFocusOf({ grammarFocus: 'Czas gramatyczny' }), null);
  assert.equal(grammarFocusOf(null), null);
});

test('shuffleOptions zachowuje poprawną odpowiedź pod nowym indeksem', () => {
  const options = ['has worked', 'works', 'is working', 'worked'];
  for (let seed = 1; seed < 40; seed++) {
    let a = seed;
    const rng = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const out = shuffleOptions(options, 0, rng);
    assert.equal(out.options[out.correctIndex], 'has worked');
    assert.deepEqual([...out.options].sort(), [...options].sort());
  }
});

test('generator: prompt łączy słownictwo i zagadnienie, zawiera żelazne zasady; wynik ma grammarFocus z enuma i jedną poprawną opcję', async () => {
  let prompt = '';
  const ask = async (p: string, schema?: object) => {
    prompt = p;
    assert.equal(schema, MULTIPLE_CHOICE_SCHEMA);
    return {
      modelUsed: 'gemini-2.5-flash',
      parsed: {
        items: [
          { question: 'She ___ in this office since 2019.', grammarFocus: 'tense', options: ['has worked', 'works', 'is working', 'worked'], correctIndex: 0, explanation: 'Since → Present Perfect.' },
          { question: 'I need ___ advice.', grammarFocus: 'Present Simple', options: ['some', 'a', 'an', 'many'], correctIndex: 0, explanation: 'x' },
          { question: 'No key ___.', grammarFocus: 'article', options: ['a', 'b'], correctIndex: 7, explanation: 'x' },
        ],
      },
    };
  };
  const { items } = await generateMultipleChoice({ source: {}, types: ['multiple_choice'], perType: 3, level: 'B1' }, 'LEKCJA: work', undefined, ask);
  assert.equal(items.length, 1, 'odrzucone: zagadnienie spoza listy i zły klucz');
  assert.equal(items[0].grammarFocus, 'tense');
  assert.equal(items[0].options[items[0].correctIndex], 'has worked');
  assert.equal(new Set(items[0].options).size, 4);
  assert.equal(checkItemLocally({ kind: 'multiple_choice', question: items[0].question, options: items[0].options, correctIndex: items[0].correctIndex, grammarFocus: items[0].grammarFocus }), null);
  for (const id of GRAMMAR_FOCUS_IDS) assert.ok(prompt.includes(id), id);
  assert.ok(prompt.includes(EXERCISE_IRON_RULES.slice(0, 60)));
  assert.match(prompt, /typowe błędy POLSKIEGO uczącego się/);
  assert.match(prompt, /DOKŁADNIE JEDNA opcja/);
});
