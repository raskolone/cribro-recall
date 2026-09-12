import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

import {
  DATABASE_ID,
  FUNCTION_REGION,
  PLACEHOLDER_EMAIL_DOMAINS,
} from './config';
import { buildHomeworkEmail, buildHomeworkGradedEmail, buildUnsubscribeUrl } from './emailTemplate';
import { sendEmail } from './resend';
import { importSelection, previewSync } from './notion/sync';
export { checkNotionDaily } from './notion/dailyCheck';

/**
 * Silnik prac domowych v2 — wyłącznie re-eksport.
 *
 * Endpointy żyją w `homeworkV2/endpoints.ts`, żeby ten plik pozostał tym,
 * czym był: mailingiem i importem z Notion. Cała ścieżka v2 jest za flagą
 * `HOMEWORK_ENGINE_V2` i nie dotyka niczego powyżej.
 */
export {
  generateHomeworkV2,
  assignHomeworkV2,
  submitHomeworkV2Attempt,
  proposeHomeworkV2Review,
} from './homeworkV2/endpoints';

/**
 * Powiadomienie e-mail o nowej pracy domowej.
 *
 * Wyzwalacz siedzi po stronie Firestore, a nie w serwerze Express z `server.ts`,
 * i to jest tutaj celowe: serwer nie jest jeszcze nigdzie wdrożony, a zadania
 * powstają także z panelu uruchomionego lokalnie. Wyzwalacz w bazie łapie każdy
 * zapis niezależnie od tego, skąd przyszedł.
 */

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const NOTION_TOKEN = defineSecret('NOTION_TOKEN');

initializeApp();
const db = getFirestore(DATABASE_ID);

/**
 * Globalny przełącznik z panelu Mailingu (`system/mailing`, ustawiany w
 * `AdminMailingScreen.tsx`). Domyślnie `true`, kiedy dokument albo pole
 * jeszcze nie istnieje — tak samo, jak domyślny stan checkboxa w panelu,
 * żeby świeża instalacja bez otwartego ekranu Mailingu nie wyciszała
 * powiadomień po cichu.
 */
const isMailingEventEnabled = async (
  field: 'enableHomeworkAssigned' | 'enableHomeworkReviewed'
): Promise<boolean> => {
  try {
    const snap = await db.collection('system').doc('mailing').get();
    const value = snap.data()?.[field];
    return value !== false;
  } catch (err) {
    logger.warn('Nie udało się odczytać ustawień mailingu — wysyłam mimo to', { field, err });
    return true;
  }
};

/** Czy pod ten adres w ogóle da się coś wysłać. */
const isDeliverable = (email: string): boolean => {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@') || trimmed.startsWith('@') || trimmed.endsWith('@')) return false;
  const domain = trimmed.split('@')[1];
  return !!domain && domain.includes('.') && !PLACEHOLDER_EMAIL_DOMAINS.includes(domain);
};

export const notifyStudentOnHomework = onDocumentCreated(
  {
    // Prace domowe leżą w `specialTasks`. Kolekcji `homework` w tym projekcie
    // nie ma — nazwa `specialTasks` pochodzi jeszcze z pierwszej wersji panelu.
    document: 'specialTasks/{taskId}',
    database: DATABASE_ID,
    region: FUNCTION_REGION,
    secrets: [RESEND_API_KEY],
    // Powiadomienie nie jest operacją krytyczną: jedna nieudana próba nie ma
    // wracać w pętli ponowień i zasypywać kursanta duplikatami.
    retry: false,
  },
  async (event) => {
    const taskId = event.params.taskId;
    const task = event.data?.data();

    if (!task) {
      logger.warn('Brak danych dokumentu', { taskId });
      return;
    }

    if (task.manualEmailConfirmationRequired || task.skipAutoEmail || task.emailNotificationSent) {
      logger.info('Wysyłka e-mail wymaga ręcznego zatwierdzenia przez nauczyciela lub została wstrzymana', {
        taskId,
        manualEmailConfirmationRequired: task.manualEmailConfirmationRequired ?? false,
        skipAutoEmail: task.skipAutoEmail ?? false,
        emailNotificationSent: task.emailNotificationSent ?? false,
      });
      return;
    }

    if (!(await isMailingEventEnabled('enableHomeworkAssigned'))) {
      logger.info('Powiadomienia o nowej pracy domowej wyłączone globalnie w ustawieniach Mailingu', { taskId });
      return;
    }

    // `studentUid` to jedyne pole, które na pewno trzyma UID konta — reszta
    // (studentId, userId) bywa w starszych dokumentach nazwiskiem albo e-mailem.
    // Patrz utils/homework.ts w głównym projekcie.
    const studentUid: string | undefined =
      typeof task.studentUid === 'string' && task.studentUid ? task.studentUid : undefined;

    if (!studentUid) {
      logger.error('Zadanie bez studentUid — nie wiadomo, do kogo wysłać', {
        taskId,
        studentId: task.studentId ?? null,
      });
      return;
    }

    const userSnap = await db.collection('users').doc(studentUid).get();
    if (!userSnap.exists) {
      logger.error('Profil kursanta nie istnieje', { taskId, studentUid });
      return;
    }

    const user = userSnap.data() || {};

    if (user.emailNotificationsDisabled === true) {
      logger.info('Kursant wyłączył powiadomienia e-mail — pomijam wysyłkę', {
        taskId,
        studentUid,
        username: user.username ?? null,
      });
      return;
    }

    const email = typeof user.email === 'string' ? user.email.trim() : '';

    if (!email) {
      logger.warn('Kursant nie ma adresu e-mail w profilu — pomijam', {
        taskId,
        studentUid,
        username: user.username ?? null,
      });
      return;
    }

    if (!isDeliverable(email)) {
      // Ten przypadek jest dziś regułą, nie wyjątkiem: konta zakładane przez
      // logowanie nazwą użytkownika dostają adres @student.vocabboost.com,
      // który nie istnieje. Log ma powiedzieć wprost, co poprawić.
      logger.warn(
        'Adres kursanta jest zastępczy — uzupełnij prawdziwy e-mail w profilu, żeby powiadomienia dochodziły',
        { taskId, studentUid, username: user.username ?? null, email }
      );
      return;
    }

    const studentName =
      `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
      user.username ||
      'Kursancie';

    const unsubscribeUrl = buildUnsubscribeUrl(studentUid);

    const { subject, html, text } = buildHomeworkEmail({
      studentName,
      title: typeof task.title === 'string' && task.title ? task.title : 'Praca domowa',
      instructions: typeof task.instructions === 'string' ? task.instructions : undefined,
      dueDate: typeof task.dueDate === 'string' ? task.dueDate : undefined,
      itemCount: Array.isArray(task.sentences) ? task.sentences.length : 0,
      assignedBy: typeof task.assignedBy === 'string' ? task.assignedBy : undefined,
      unsubscribeUrl,
    });

    const result = await sendEmail(RESEND_API_KEY.value(), email, subject, html, text);

    if (!result.ok) {
      logger.error('Nie udało się wysłać powiadomienia', {
        taskId,
        studentUid,
        error: result.error,
      });
      // Bez rzucania wyjątku: zadanie w bazie jest ważniejsze niż e-mail o nim,
      // a rzucenie tutaj oznaczałoby tylko czerwony wpis w logach.
      return;
    }

    logger.info('Powiadomienie wysłane', { taskId, studentUid, messageId: result.id });

    // Ślad w dokumencie: po nim widać w panelu, czy kursant został powiadomiony,
    // bez zaglądania w logi Cloud Functions.
    try {
      await event.data!.ref.update({
        notificationSentAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.warn('Nie udało się zapisać znacznika wysyłki', { taskId, err });
    }
  }
);

/**
 * Powiadomienie e-mail o sprawdzonej pracy domowej (v1).
 *
 * Odpala się na przejściu `status` → `graded`, czyli dokładnie w momencie
 * `HomeworkScreen.tsx:handleSaveReview` (jedyne miejsce w kodzie, które
 * robi taką zmianę statusu). Silnik v2 nie ma tu odpowiednika: kursant
 * dostaje ocenę i feedback od razu przy każdej próbie
 * (`submitHomeworkV2Attempt`), nie przez późniejszą akcję lektora — patrz
 * `docs/plan-weekend-2026-09-12.md`, Etap A/B.
 *
 * Przełącznik `MailingSettings.enableHomeworkReviewed` istniał w panelu
 * Mailingu od dawna, ale żadna funkcja go nie czytała — to naprawia.
 */
export const notifyStudentOnHomeworkGraded = onDocumentUpdated(
  {
    document: 'specialTasks/{taskId}',
    database: DATABASE_ID,
    region: FUNCTION_REGION,
    secrets: [RESEND_API_KEY],
    retry: false,
  },
  async (event) => {
    const taskId = event.params.taskId;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Tylko przejście w stan `graded` — nie każda kolejna edycja zadania,
    // która akurat też ma `status === 'graded'` (np. poprawka komentarza).
    if (before.status === 'graded' || after.status !== 'graded') return;

    if (!(await isMailingEventEnabled('enableHomeworkReviewed'))) {
      logger.info('Powiadomienia o sprawdzonej pracy domowej wyłączone globalnie w ustawieniach Mailingu', { taskId });
      return;
    }

    const studentUid: string | undefined =
      typeof after.studentUid === 'string' && after.studentUid ? after.studentUid : undefined;
    if (!studentUid) {
      logger.error('Ocenione zadanie bez studentUid — nie wiadomo, do kogo wysłać', { taskId });
      return;
    }

    const userSnap = await db.collection('users').doc(studentUid).get();
    if (!userSnap.exists) {
      logger.error('Profil kursanta nie istnieje', { taskId, studentUid });
      return;
    }
    const user = userSnap.data() || {};

    if (user.emailNotificationsDisabled === true) {
      logger.info('Kursant wyłączył powiadomienia e-mail — pomijam wysyłkę oceny', { taskId, studentUid });
      return;
    }

    const email = typeof user.email === 'string' ? user.email.trim() : '';
    if (!email || !isDeliverable(email)) {
      logger.warn('Brak dostarczalnego adresu kursanta — pomijam powiadomienie o ocenie', { taskId, studentUid, email });
      return;
    }

    const studentName =
      `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Kursancie';

    const { subject, html, text } = buildHomeworkGradedEmail({
      studentName,
      title: typeof after.title === 'string' && after.title ? after.title : 'Praca domowa',
      teacherFeedback: typeof after.teacherFeedback === 'string' ? after.teacherFeedback : undefined,
      grade: typeof after.grade === 'number' ? after.grade : undefined,
      unsubscribeUrl: buildUnsubscribeUrl(studentUid),
    });

    const result = await sendEmail(RESEND_API_KEY.value(), email, subject, html, text);
    if (!result.ok) {
      logger.error('Nie udało się wysłać powiadomienia o ocenie', { taskId, studentUid, error: result.error });
      return;
    }

    logger.info('Powiadomienie o ocenie wysłane', { taskId, studentUid, messageId: result.id });
  }
);

/**
 * Kto jest w Notion i co aplikacja już o nim wie.
 *
 * Czyta wyłącznie właściwości stron, bez treści lekcji, więc kończy się
 * w kilka sekund. Nic nie zapisuje — to podgląd, na podstawie którego lektor
 * decyduje, kogo i co zaimportować.
 */
export const previewNotionSync = onCall(
  {
    region: FUNCTION_REGION,
    secrets: [NOTION_TOKEN],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    await requireTeacher(request.auth?.uid);
    try {
      return await previewSync(NOTION_TOKEN.value());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Podgląd Notion nie powiódł się', { error: message });
      throw new HttpsError('internal', message);
    }
  }
);

/**
 * Import kursantów i lekcji zaznaczonych przez lektora.
 *
 * Zakres pochodzi z wyboru w panelu, a nie z rozmiaru archiwum — dzięki temu
 * czas pracy zależy od decyzji lektora i nie przekracza cierpliwości
 * przeglądarki. Konta zakładamy wyłącznie tam, gdzie lektor to zaznaczył.
 */
export const importNotionSelection = onCall(
  {
    region: FUNCTION_REGION,
    secrets: [NOTION_TOKEN],
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (request) => {
    await requireTeacher(request.auth?.uid);

    const selections = Array.isArray(request.data?.selections) ? request.data.selections : [];
    if (selections.length === 0) {
      throw new HttpsError('invalid-argument', 'Nie wskazano nikogo do zaimportowania.');
    }

    try {
      const report = await importSelection(NOTION_TOKEN.value(), selections);
      logger.info('Import z Notion zakończony', {
        wybranych: selections.length,
        lekcji: report.lessonsImported,
        kont: report.accountsCreated.length,
      });
      return report;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Import z Notion nie powiódł się', { error: message });
      throw new HttpsError('internal', message);
    }
  }
);

/**
 * Wspólna bramka obu funkcji.
 *
 * Dane dotyczą wszystkich kursantów, więc sięgnąć po nie może wyłącznie
 * nauczyciel. Rola czytana jest z bazy, nigdy z żądania.
 */
async function requireTeacher(uid?: string): Promise<void> {
  if (!uid) throw new HttpsError('unauthenticated', 'Wymagane zalogowanie.');
  const profile = await db.collection('users').doc(uid).get();
  const role = profile.data()?.role;
  if (role !== 'admin' && role !== 'teacher') {
    throw new HttpsError('permission-denied', 'Tylko lektor może synchronizować dane z Notion.');
  }
}
