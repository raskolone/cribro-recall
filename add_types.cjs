const fs = require('fs');
let file = fs.readFileSync('types.ts', 'utf8');

if (!file.includes('interface FlashcardProgress')) {
  const newType = `

export interface FlashcardProgress {
  id?: string;
  flashcardId: string;
  userId: string;
  setId: string;
  nextReviewDate: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
  lastReviewedAt: string;
}
`;
  file = file.replace(/export interface SessionResult \{[^}]+\}/, match => match + newType);
  fs.writeFileSync('types.ts', file);
}
