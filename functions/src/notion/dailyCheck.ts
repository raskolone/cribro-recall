import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';
import { DATABASE_ID, FUNCTION_REGION } from '../config';
import { previewSync } from './sync';

const NOTION_TOKEN = defineSecret('NOTION_TOKEN');

/**
 * Zastępuje ręczne klikanie "Sprawdź Notion" codziennym automatem.
 *
 * Zlecenie 2026-09-12: lektor nie chce widzieć stałej karty "Historia lekcji
 * z Notion" w panelu — ma się pojawić WYŁĄCZNIE, gdy jest coś nowego. Ta
 * funkcja tylko PATRZY (dokładnie ten sam `previewSync`, co ręczny podgląd)
 * i zapisuje wynik — nic nie importuje samodzielnie, bo tworzenie kont i
 * decyzja, co wejść do aplikacji, zostaje po stronie lektora (patrz
 * `NotionSyncButton.tsx`).
 */
export const checkNotionDaily = onSchedule(
  {
    schedule: 'every day 06:00',
    timeZone: 'Europe/Warsaw',
    region: FUNCTION_REGION,
    secrets: [NOTION_TOKEN],
    timeoutSeconds: 180,
    memory: '512MiB',
  },
  async () => {
    const db = getFirestore(DATABASE_ID);
    try {
      const preview = await previewSync(NOTION_TOKEN.value());

      // "Nowe" = lekcje w Notion, których jeszcze nie ma w aplikacji dla
      // danego kursanta (nie cała liczba lekcji — ta rośnie od lat i nie
      // mówi nic o dzisiejszym stanie).
      const newLessonsCount = preview.students.reduce((sum, s) => {
        const imported = s.importedCount ?? 0;
        return sum + Math.max(0, (s.lessonCount || 0) - imported);
      }, 0);

      // Karta kursanta w Notion bez konta w aplikacji — też wymaga decyzji
      // lektora, nawet bez ani jednej lekcji.
      const newStudentsCount = preview.students.filter((s) => !s.uid && !s.inactive).length;

      const hasNew = newLessonsCount > 0 || newStudentsCount > 0 || preview.orphanLessons > 0;

      await db.collection('system').doc('notionAutoCheck').set({
        lastCheckedAt: new Date().toISOString(),
        newLessonsCount,
        newStudentsCount,
        orphanLessons: preview.orphanLessons,
        hasNew,
      });

      logger.info('Automatyczne sprawdzenie Notion zakończone', {
        newLessonsCount,
        newStudentsCount,
        orphanLessons: preview.orphanLessons,
        hasNew,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Bez nadpisywania dokumentu: błąd sieci/Notion nie ma prawa cichcem
      // wyczyścić ostatniego prawdziwego wyniku ani udawać "wszystko OK".
      logger.error('Automatyczne sprawdzenie Notion nie powiodło się', { error: message });
    }
  }
);
