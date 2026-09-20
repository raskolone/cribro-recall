/**
 * Ustawienia modułu prac domowych, konfigurowalne przez lektora w UI.
 *
 * Jeden dokument w `system/homeworkAiSettings` — ten sam wzorzec co
 * `system/mailing` (patrz `server.ts`). Domyślnie wyłączone: brak dokumentu
 * lub brak pola znaczy "false", nigdy "true" po cichu.
 */

import { getDb } from './db';

export interface HomeworkAiSettings {
  /** Domyślnie `false`. Patrz `shouldAutoApprove` w `contracts.ts`. */
  autoApproveAtFullConfidence: boolean;
}

const SETTINGS_DOC_PATH = ['system', 'homeworkAiSettings'] as const;

export const getHomeworkAiSettings = async (): Promise<HomeworkAiSettings> => {
  try {
    const snap = await getDb().collection(SETTINGS_DOC_PATH[0]).doc(SETTINGS_DOC_PATH[1]).get();
    return {
      autoApproveAtFullConfidence: snap.data()?.autoApproveAtFullConfidence === true,
    };
  } catch {
    return { autoApproveAtFullConfidence: false };
  }
};
