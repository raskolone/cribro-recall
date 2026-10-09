import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Usuwanie prac domowych i testów — jedna wersja dla pojedynczego przycisku
 * kosza i dla masowego usuwania w „Zadaniach i testach".
 *
 * Wydzielone bez zmiany działania: dokładnie to samo `deleteDoc`, które
 * wcześniej stało w `HomeworkScreen.handleConfirmDelete` i
 * `AllTestsTeacherView.handleDeleteTest`.
 */

/**
 * Kasuje dokument `specialTasks/{taskId}`, a z nim wszystko, co w nim leży:
 * zdania, odpowiedzi kursanta (`studentAnswers`, w tym próby rozgrzewki),
 * wyniki oceny, komentarz lektora i token linku `/hw?token=` (`accessToken`).
 *
 * NIE kasuje (Firestore nie usuwa podkolekcji razem z dokumentem, a klient nie
 * ma dostępu do indeksu tokenów): podkolekcji silnika v2 `attempts` i `drafts`,
 * wpisu `directHomeworkTokens/{hash}` ani flagi `hasNewHomework` na profilu.
 */
export const deleteHomeworkTask = (taskId: string): Promise<void> =>
  deleteDoc(doc(db, 'specialTasks', taskId));

/** Kasuje test przypisany kursantowi (`users/{studentId}/tests/{testId}`) razem z jego odpowiedziami i wynikiem. */
export const deleteStudentTest = (studentId: string, testId: string): Promise<void> =>
  deleteDoc(doc(db, `users/${studentId}/tests`, testId));
