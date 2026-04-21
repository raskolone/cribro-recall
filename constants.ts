
import { Language, Difficulty, RevisionFrequency } from './types';

export const LANGUAGES: Language[] = ['English', 'Spanish', 'French', 'Dutch'];
export const DIFFICULTIES: Difficulty[] = ['A1-A2', 'B1-B2', 'C1-C2'];
export const FREQUENCIES: RevisionFrequency[] = ['Daily', 'Weekly', 'Monthly'];

export const VOICE_CONFIG = {
  English: {
    American: 'Kore',
    British: 'Puck',
  },
  Spanish: 'Charon',
  French: 'Fenrir',
  Dutch: 'Zephyr',
};
