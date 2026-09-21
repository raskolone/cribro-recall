export type TranslationMode = 'classic_assisted' | 'fragment_pool';

export interface TranslationStep {
  stepIndex: number;
  correctChunk: string;        // np. "I have been working"
  distractors: string[];        // np. ["I am working", "I work"]
}

export interface AdvancedTranslationPayload {
  id: string;
  polishSentence: string;      // np. "Pracuję tu od pięciu lat."
  targetSentence: string;      // np. "I have been working here for five years."
  mode: TranslationMode;
  // Dla trybu 'classic_assisted':
  lexicalHints?: string[];     // np. ["work", "for", "since"]
  // Dla trybu 'fragment_pool':
  steps?: TranslationStep[];
}
