import indexData from '../data/blueprints/index.json';
import { BlueprintTopicMeta, BlueprintChapter, CEFRLevel, IdiomItem } from '../types/blueprints';

export const getBlueprintIndex = (): BlueprintTopicMeta[] => {
  return indexData as BlueprintTopicMeta[];
};

export const getTopicsByLevel = (level: CEFRLevel): BlueprintTopicMeta[] => {
  return (indexData as BlueprintTopicMeta[]).filter((topic) => topic.level === level);
};

export const getChapterDetails = async (
  level: CEFRLevel,
  chapterId: string
): Promise<BlueprintChapter | undefined> => {
  try {
    let data: BlueprintChapter[] = [];
    switch (level) {
      case 'A1':
        data = (await import('../data/blueprints/level_1_a1.json')).default as unknown as BlueprintChapter[];
        break;
      case 'A2':
        data = (await import('../data/blueprints/level_2_a2.json')).default as unknown as BlueprintChapter[];
        break;
      case 'B1':
        data = (await import('../data/blueprints/level_3_b1.json')).default as unknown as BlueprintChapter[];
        break;
      case 'B2':
        data = (await import('../data/blueprints/level_4_b2.json')).default as unknown as BlueprintChapter[];
        break;
      case 'C1':
        data = (await import('../data/blueprints/level_5_c1.json')).default as unknown as BlueprintChapter[];
        break;
      case 'C2':
        data = (await import('../data/blueprints/level_6_c2.json')).default as unknown as BlueprintChapter[];
        break;
      default:
        return undefined;
    }
    return data.find((chapter) => chapter.id === chapterId);
  } catch (error) {
    console.error(`Błąd ładowania danych dla poziomu ${level}:`, error);
    return undefined;
  }
};

export const getIdioms = async (): Promise<IdiomItem[]> => {
  const data = await import('../data/blueprints/idioms.json');
  return data.default as unknown as IdiomItem[];
};
