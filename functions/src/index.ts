import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

import {
  DATABASE_ID,
  FUNCTION_REGION,
  PLACEHOLDER_EMAIL_DOMAINS,
} from './config';
import { buildHomeworkEmail } from './emailTemplate';
import { sendEmail } from './resend';

/**
 * Powiadomienie e-mail o nowej pracy domowej.
 *
 * Wyzwalacz siedzi po stronie Firestore, a nie w serwerze Express z `server.ts`,
 * i to jest tutaj celowe: serwer nie jest jeszcze nigdzie wdrożony, a zadania
 * powstają także z panelu uruchomionego lokalnie. Wyzwalacz w bazie łapie każdy
 * zapis niezależnie od tego, skąd przyszedł.
 */

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

initializeApp();
const db = getFirestore(DATABASE_ID);

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

    const { subject, html, text } = buildHomeworkEmail({
      studentName,
      title: typeof task.title === 'string' && task.title ? task.title : 'Praca domowa',
      instructions: typeof task.instructions === 'string' ? task.instructions : undefined,
      dueDate: typeof task.dueDate === 'string' ? task.dueDate : undefined,
      itemCount: Array.isArray(task.sentences) ? task.sentences.length : 0,
      assignedBy: typeof task.assignedBy === 'string' ? task.assignedBy : undefined,
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
