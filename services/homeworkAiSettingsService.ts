import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Ustawienia AI modułu prac domowych, jeden dokument dla całej aplikacji.
 *
 * `system/{document=**}` w `firestore.rules` pozwala na odczyt każdemu
 * zalogowanemu i zapis wyłącznie `isAdmin()` (obejmuje też rolę `teacher`)
 * — bez zmian w regułach.
 */

const SETTINGS_DOC = doc(db, 'system', 'homeworkAiSettings');

export interface HomeworkAiSettings {
  /** Domyślnie `false` — silnik oceny wywołuje wyłącznie lektor. */
  autoApproveAtFullConfidence: boolean;
}

const DEFAULT_SETTINGS: HomeworkAiSettings = { autoApproveAtFullConfidence: false };

export const getHomeworkAiSettings = async (): Promise<HomeworkAiSettings> => {
  try {
    const snap = await getDoc(SETTINGS_DOC);
    return { autoApproveAtFullConfidence: snap.data()?.autoApproveAtFullConfidence === true };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const subscribeHomeworkAiSettings = (
  onChange: (settings: HomeworkAiSettings) => void
): (() => void) =>
  onSnapshot(
    SETTINGS_DOC,
    (snap) => onChange({ autoApproveAtFullConfidence: snap.data()?.autoApproveAtFullConfidence === true }),
    () => onChange(DEFAULT_SETTINGS)
  );

export const setAutoApproveAtFullConfidence = async (enabled: boolean): Promise<void> => {
  await setDoc(SETTINGS_DOC, { autoApproveAtFullConfidence: enabled }, { merge: true });
};
