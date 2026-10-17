// Atrapy kontekstów/usług dla testu przeglądarkowego karty fiszki (bez Firebase i logowania).
export const useAuth = () => ({ user: { id: 'stu1', role: 'user' } });
export const useLanguage = () => ({ language: 'pl' });
export const useSettings = () => ({ settings: {}, soundSettings: {} });
export const useFlashcards = () => ({ getProgress: async () => [], sets: [], getFlashcards: async () => [], saveSession: async () => {} });
export const getApprovedItemsForLesson = async () => null;
export const playSpeech = async () => {};
