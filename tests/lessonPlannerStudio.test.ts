import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildScenarioPrompt,
  buildTopicProposalPrompt,
  extractHomeworkTask,
  extractVocabularyList,
  LessonPlan,
  LessonBrief,
} from '../services/lessonPlannerMethod';
import { formatStudentDisplayName } from '../utils/studentFormat';
import { User } from '../types';

describe('Lesson Planner Studio & Methods', () => {
  const sampleUser: Partial<User> & { id: string } = {
    id: 'user-12345',
    firstName: 'Tomasz',
    lastName: 'Kowalski',
    level: 'C1',
    role: 'user',
  };

  it('formatStudentDisplayName poprawnie formatuje nazwę kursanta z profilu', () => {
    const formatted = formatStudentDisplayName(sampleUser);
    assert.equal(formatted, 'Tomasz Kowalski');
  });

  it('buildTopicProposalPrompt uwzględnia poziom i dane kursanta', () => {
    const brief: LessonBrief = {
      mode: '1:1',
      audience: 'Tomasz Kowalski',
      date: '2026-09-17',
      level: 'C1',
      grammarTopic: 'Mixed Conditionals',
    };

    const prompt = buildTopicProposalPrompt(brief, 3, 'Cross-cultural negotiations');
    assert.ok(prompt.includes('Tomasz Kowalski'));
    assert.ok(prompt.includes('Poziom CEFR: C1'));
    assert.ok(prompt.includes('Mixed Conditionals'));
    assert.ok(prompt.includes('Cross-cultural negotiations'));
  });

  it('buildScenarioPrompt wymusza 6 bloków w tym Wrap-up & Homework z sugerowaną pracą domową', () => {
    const brief: LessonBrief = {
      mode: '1:1',
      audience: 'Tomasz Kowalski',
      date: '2026-09-17',
      level: 'C1',
      grammarTopic: 'Conditionals in Negotiations',
    };

    const prompt = buildScenarioPrompt(brief, {
      title: 'Business English: Cross-cultural Negotiations',
      angle: 'Price defense',
      material: 'ESL Brains article',
    });

    assert.ok(prompt.includes('Wrap-up & Homework'));
    assert.ok(prompt.includes('Sugerowana Praca Domowa'));
    assert.ok(prompt.includes('Practice Enclosure'));
    assert.ok(prompt.includes('Language Focus'));
    assert.ok(prompt.includes('Main Topic'));
  });

  it('extractHomeworkTask poprawnie wyciąga zadanie domowe z planu lekcji', () => {
    const mockPlan: LessonPlan = {
      title: 'Negotiating Under Pressure',
      summary: 'Lekcja o technikach negocjacyjnych',
      format: '60 min',
      sections: [
        {
          id: 'warmup',
          title: '1. Warm-up',
          items: [{ id: 'q1', kind: 'question', text: 'How do you handle objections?' }],
        },
        {
          id: 'homework',
          title: '6. Wrap-up & Homework (5 min)',
          items: [
            { id: 't1', kind: 'text', text: 'Podsumowanie' },
            {
              id: 'hw-task',
              kind: 'task',
              text: 'Sugerowana praca domowa: Ułóż 5 zdań z nowo poznanym słownictwem negocjacyjnym.',
              notes: 'Obszar do przećwiczenia: Mixed Conditionals w argumentacji biznesowej.',
            },
          ],
        },
      ],
    };

    const task = extractHomeworkTask(mockPlan);
    assert.ok(task !== null);
    assert.equal(task?.taskText, 'Sugerowana praca domowa: Ułóż 5 zdań z nowo poznanym słownictwem negocjacyjnym.');
    assert.equal(task?.taskNotes, 'Obszar do przećwiczenia: Mixed Conditionals w argumentacji biznesowej.');
  });

  it('extractVocabularyList poprawnie wyciąga listę słówek do generatora zadań ze zdań', () => {
    const mockPlan: LessonPlan = {
      title: 'Business Communication',
      summary: 'Komunikacja w zespole',
      sections: [
        {
          id: 'focus',
          title: '4. Language Focus',
          items: [
            { id: 'v1', kind: 'vocab', text: 'leverage synergy - połączyć siły' },
            { id: 'v2', kind: 'vocab', text: 'double-edged sword - broń obosieczna' },
            { id: 'v3', kind: 'vocab', text: 'streamline operations - usprawnić procesy' },
          ],
        },
      ],
    };

    const list = extractVocabularyList(mockPlan);
    assert.equal(list.length, 3);
    assert.deepEqual(list, [
      'leverage synergy - połączyć siły',
      'double-edged sword - broń obosieczna',
      'streamline operations - usprawnić procesy',
    ]);
  });
});
