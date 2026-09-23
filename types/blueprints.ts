export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface BlueprintSentence {
  id: number;
  polish: string;
  english: string;
}

export interface BlueprintChapter {
  id: string; // np. "g1_ch01_useful_expressions"
  bookNumber: number; // 1 - 6
  chapterNumber: number; // 1 - 36
  level: CEFRLevel;
  titlePl: string;
  titleEn: string;
  sentences: BlueprintSentence[];
}

export interface BlueprintTopicMeta {
  id: string;
  bookNumber: number;
  chapterNumber: number;
  level: CEFRLevel;
  titlePl: string;
  titleEn: string;
  totalSentences: number;
}

export interface IdiomItem {
  id: number;
  idiom: string;
  meaningPl: string;
  exampleSentence: string;
  level: 'A2-B1';
}
