import React from 'react';
import {
  ExerciseStudioType,
  ExerciseDefinition,
  RandomWheelPayload,
  WheelItem,
  SentenceScramblePayload,
  MatchingPairsPayload,
  RandomCardsPayload,
  MultipleChoicePayload,
} from '../types/exerciseStudio';

export interface ExerciseRegistryEntry<TPayload = any> {
  type: ExerciseStudioType;
  label: string;
  description: string;
  icon: string;
  isReady: boolean;
  createDefaultPayload: (title?: string) => TPayload;
  validatePayload: (payload: TPayload) => { valid: boolean; errors: string[] };
}

export const DEFAULT_WHEEL_ITEMS: WheelItem[] = [
  { id: 'w-1', label: 'Weekend & Free Time', prompt: 'What was the most memorable part of your weekend?', category: 'Warm-up' },
  { id: 'w-2', label: 'Work Challenges', prompt: 'What is the biggest challenge on your plate right now?', category: 'Business' },
  { id: 'w-3', label: 'Recent Wins', prompt: 'Tell me about a recent success or project milestone.', category: 'Warm-up' },
  { id: 'w-4', label: 'Travel & Commute', prompt: 'If you could work remotely from any city next month, where would you go?', category: 'General' },
  { id: 'w-5', label: 'Deep Work Habits', prompt: 'How do you structure your focus time during high-demand days?', category: 'Productivity' },
  { id: 'w-6', label: 'Vocabulary Recall', prompt: 'Use three new business idioms you learned recently in a single sentence.', category: 'Language' },
];

export const exerciseRegistry: Record<ExerciseStudioType, ExerciseRegistryEntry> = {
  random_wheel: {
    type: 'random_wheel',
    label: 'Koło Fortuny (Random Wheel)',
    description: 'Dynamiczne koło losujące pytania, zagadnienia, słówka lub kategorie rozgrzewkowe.',
    icon: 'RotateCcw',
    isReady: true,
    createDefaultPayload: (title?: string): RandomWheelPayload => ({
      title: title || 'Warm-up Random Wheel',
      items: JSON.parse(JSON.stringify(DEFAULT_WHEEL_ITEMS)),
      removeOnHit: false,
      spinDuration: 4.5,
      questionSource: 'custom',
    }),
    validatePayload: (payload: RandomWheelPayload) => {
      const errors: string[] = [];
      if (!payload || !Array.isArray(payload.items) || payload.items.length < 2) {
        errors.push('Koło fortuny musi zawierać co najmniej 2 segmenty.');
      }
      return { valid: errors.length === 0, errors };
    },
  },
  sentence_scramble: {
    type: 'sentence_scramble',
    label: 'Układanka Zdań (Sentence Scramble)',
    description: 'Rozsypanka wyrazowa z natychmiastową weryfikacją kolejności słów i gramatyki.',
    icon: 'Puzzle',
    isReady: false,
    createDefaultPayload: (): SentenceScramblePayload => ({
      sentences: [
        { id: 'sc-1', original: 'We need to renegotiate the terms of the contract.', promptPl: 'Musimy renegocjować warunki umowy.' }
      ],
    }),
    validatePayload: (payload: SentenceScramblePayload) => {
      const errors: string[] = [];
      if (!payload || !Array.isArray(payload.sentences) || payload.sentences.length === 0) {
        errors.push('Wymagane jest przynajmniej jedno zdanie wzorcowe.');
      }
      return { valid: errors.length === 0, errors };
    },
  },
  matching_pairs: {
    type: 'matching_pairs',
    label: 'Dopasowywanie Par (Matching Pairs)',
    description: 'Łączenie definicji, kolokacji lub tłumaczeń w interaktywne pary.',
    icon: 'Link2',
    isReady: false,
    createDefaultPayload: (): MatchingPairsPayload => ({
      pairs: [
        { id: 'mp-1', left: 'ballpark figure', right: 'przybliżona liczba / szacunek' },
        { id: 'mp-2', left: 'touch base', right: 'skontaktować się na chwilę' },
      ],
    }),
    validatePayload: (payload: MatchingPairsPayload) => {
      const errors: string[] = [];
      if (!payload || !Array.isArray(payload.pairs) || payload.pairs.length < 2) {
        errors.push('Wymagane są co najmniej 2 pary.');
      }
      return { valid: errors.length === 0, errors };
    },
  },
  random_cards: {
    type: 'random_cards',
    label: 'Karty Rozmów (Random Cards)',
    description: 'Talia kart z prowokującymi pytaniami i studiami przypadków biznesowych.',
    icon: 'Layers',
    isReady: false,
    createDefaultPayload: (): RandomCardsPayload => ({
      cards: [
        { id: 'rc-1', front: 'Negotiation Strategy', prompt: 'How do you handle a client demanding a 30% discount?' }
      ],
    }),
    validatePayload: (payload: RandomCardsPayload) => {
      const errors: string[] = [];
      if (!payload || !Array.isArray(payload.cards) || payload.cards.length === 0) {
        errors.push('Wymagana jest przynajmniej jedna karta.');
      }
      return { valid: errors.length === 0, errors };
    },
  },
  multiple_choice: {
    type: 'multiple_choice',
    label: 'Quiz Wyboru (Multiple Choice)',
    description: 'Pytania jednokrotnego wyboru z natychmiastowym feedbackiem i wyjaśnieniem.',
    icon: 'HelpCircle',
    isReady: false,
    createDefaultPayload: (): MultipleChoicePayload => ({
      questions: [
        {
          id: 'mc-1',
          question: 'Which preposition correctly completes: "I will look ___ the report tomorrow"?',
          options: ['into', 'after', 'for', 'about'],
          correctIndex: 0,
          explanation: '"Look into" means to investigate or examine in detail.',
        }
      ],
    }),
    validatePayload: (payload: MultipleChoicePayload) => {
      const errors: string[] = [];
      if (!payload || !Array.isArray(payload.questions) || payload.questions.length === 0) {
        errors.push('Wymagane jest przynajmniej jedno pytanie quizowe.');
      }
      return { valid: errors.length === 0, errors };
    },
  },
};

export const getAllExerciseTypes = (): ExerciseRegistryEntry[] => {
  return Object.values(exerciseRegistry);
};

export const getExerciseRegistryEntry = (type: ExerciseStudioType): ExerciseRegistryEntry => {
  return exerciseRegistry[type] || exerciseRegistry.random_wheel;
};
