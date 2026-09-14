import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_TASKS,
  AI_MODEL_CASCADE,
  cascadeForCategory,
  cascadeForTask,
  PRIMARY_MODEL,
  TERTIARY_MODEL,
} from '../services/aiModels';

describe('services/aiModels — zadania', () => {
  it('bez nadpisań zadanie dostaje swoją domyślną kaskadę', () => {
    assert.deepEqual(cascadeForTask('exercises'), AI_MODEL_CASCADE);
  });

  it('czat startuje od modelu lekkiego, a mocny zostaje jako zapas', () => {
    const chat = cascadeForTask('chat');
    assert.equal(chat[0], TERTIARY_MODEL);
    assert.ok(chat.includes(PRIMARY_MODEL));
  });

  it('wybór administratora wchodzi na początek kaskady', () => {
    const cascade = cascadeForTask('grading', { grading: 'gemini-2.5-flash' });
    assert.equal(cascade[0], 'gemini-2.5-flash');
  });

  it('wybrany model nie powtarza się w dalszej części kaskady', () => {
    const cascade = cascadeForTask('exercises', { exercises: PRIMARY_MODEL });
    assert.equal(cascade.filter(m => m === PRIMARY_MODEL).length, 1);
  });

  it('nadpisanie jednego zadania nie rusza pozostałych', () => {
    const overrides = { chat: 'openai/gpt-4o' };
    assert.equal(cascadeForTask('chat', overrides)[0], 'openai/gpt-4o');
    assert.deepEqual(cascadeForTask('grading', overrides), AI_MODEL_CASCADE);
  });

  it('kategoria zapytania trafia we właściwe zadanie', () => {
    assert.equal(cascadeForCategory('evaluation', { grading: 'openai/gpt-4o' })[0], 'openai/gpt-4o');
    assert.equal(cascadeForCategory('sentence-gen', { exercises: 'openai/gpt-4o' })[0], 'openai/gpt-4o');
    // Nieznana kategoria nie może wywrócić wywołania — ląduje w czacie.
    assert.equal(cascadeForCategory('nieznana')[0], TERTIARY_MODEL);
  });

  it('każde zadanie ma niepustą kaskadę i opis', () => {
    AI_TASKS.forEach(task => {
      assert.ok(task.cascade.length > 0, task.id);
      assert.ok(task.description.length > 0, task.id);
    });
  });
});
