import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 
  extractQuestionsFromScenario, 
  extractQuestionsFromPastLessons, 
  FALLBACK_WARMUP_QUESTIONS 
} from '../services/wheelQuestionService';
import { LessonRecord, PresentationSlide } from '../types';

test('FALLBACK_WARMUP_QUESTIONS zawiera co najmniej 8 pytań rozgrzewkowych', () => {
  assert.ok(FALLBACK_WARMUP_QUESTIONS.length >= 8);
  for (const q of FALLBACK_WARMUP_QUESTIONS) {
    assert.ok(q.id);
    assert.ok(q.question);
    assert.equal(q.category, 'scenario');
  }
});

test('extractQuestionsFromScenario wyciąga pytania ze slajdu wheelQuestions', () => {
  const slide: PresentationSlide = {
    id: 's-1',
    type: 'wheel_of_fortune',
    title: 'Warm-up',
    wheelQuestions: [
      { id: 'wq-1', question: 'What is your dream project?', source: 'scenario' },
      { id: 'wq-2', question: 'How do you structure deep work?', source: 'scenario' }
    ]
  };

  const extracted = extractQuestionsFromScenario(slide, null);
  assert.ok(extracted.length >= 2);
  assert.equal(extracted[0].question, 'What is your dream project?');
  assert.equal(extracted[1].question, 'How do you structure deep work?');
});

test('extractQuestionsFromScenario wyciąga pytania z items slajdu', () => {
  const slide: PresentationSlide = {
    id: 's-2',
    type: 'warmup',
    title: 'Lead-in questions',
    items: [
      { id: 'item-1', question: 'What was your biggest win this week?' },
      { id: 'item-2', question: 'How do you resolve conflicts with clients?' }
    ]
  };

  const extracted = extractQuestionsFromScenario(slide, null);
  assert.ok(extracted.length >= 2);
  assert.equal(extracted[0].question, 'What was your biggest win this week?');
  assert.equal(extracted[1].question, 'How do you resolve conflicts with clients?');
});

test('extractQuestionsFromPastLessons tworzy pytania z followUp, topic i vocabularyText', () => {
  const mockLessons: LessonRecord[] = [
    {
      id: 'rec-1',
      studentId: 'stu-1',
      date: '2026-09-10',
      topic: 'Negotiation Strategies',
      suggestedFollowUp: 'Check how the contract renegotiation went with the German client.',
      vocabularyText: 'leverage, ballpark figure, trade-off',
      thingsToImprove: 'Use softening phrases instead of blunt statements',
      createdAt: '2026-09-10T10:00:00Z',
      updatedAt: '2026-09-10T10:00:00Z',
    },
    {
      id: 'rec-2',
      studentId: 'stu-1',
      date: '2026-09-03',
      topic: 'Presenting Data & Metrics',
      suggestedFollowUp: '',
      vocabularyText: 'spike, plummet, plateau',
      thingsToImprove: 'Past simple vs Present perfect when describing trends',
      createdAt: '2026-09-03T10:00:00Z',
      updatedAt: '2026-09-03T10:00:00Z',
    }
  ];

  const questions = extractQuestionsFromPastLessons(mockLessons, 'Jan');
  assert.ok(questions.length > 0);
  assert.ok(questions.some(q => q.sourceTag?.includes('Follow-up')));
  assert.ok(questions.some(q => q.sourceTag?.includes('Słówko') || q.sourceTag?.includes('Temat')));
  assert.ok(questions.every(q => q.category === 'past_lessons'));
});

test('extractQuestionsFromPastLessons zwraca fallback gdy brak historii', () => {
  const questions = extractQuestionsFromPastLessons([], 'Nowy Kursant');
  assert.ok(questions.length >= 8);
  assert.ok(questions.every(q => q.category === 'past_lessons'));
});
