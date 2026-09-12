import { collection, query, where } from 'firebase/firestore';
import { HomeworkType, SpecialTask, User } from '../types';
import { auth, db } from '../firebase';
import { isV2Task } from '../services/homeworkV2/contracts';

/**
 * Pole rozstrzygające, czyja jest praca domowa.
 *
 * Kolekcja `specialTasks` jest płaska i wspólna, więc reguły Firestore nie mają
 * czego użyć poza polem w dokumencie. `studentUid` trzyma dokładny UID konta —
 * bez normalizacji, bez dopasowania po nazwisku, bez wariantów. Dopiero taka
 * dosłowność pozwala regule zapisać `resource.data.studentUid == request.auth.uid`,
 * a kursantowi odpytać kolekcję z where() na tym samym polu.
 */
export const TASK_OWNER_FIELD = 'studentUid';

/**
 * Pola przypisania do zapisania przy tworzeniu i edycji zadania.
 *
 * Starsze wersje aplikacji rozsiały tę informację po czterech nazwach
 * (studentId, userId, studentUid, studentIds) i kod czytający musiał sprawdzać
 * wszystkie. Nadal je zapisujemy, żeby nie popsuć widoków, które po nich
 * sięgają, ale wiążące jest wyłącznie `studentUid`.
 */
export const taskOwnerFields = (studentUid: string) => ({
  studentUid,
  studentId: studentUid,
  userId: studentUid,
  studentIds: [studentUid],
});

/**
 * Jedyne dozwolone zapytanie kursanta o własne prace domowe.
 *
 * Nie da się tego zastąpić pobraniem całej kolekcji i odsianiem cudzych zadań
 * w przeglądarce: reguły odrzucą takie zapytanie w całości, bo Firestore nie
 * potrafi z góry udowodnić, że wynik zawiera wyłącznie dokumenty kursanta.
 */
export const studentTasksQuery = (uid: string) =>
  query(collection(db, 'specialTasks'), where(TASK_OWNER_FIELD, '==', uid));

/**
 * Czy zadanie należy do silnika v1, czyli czy wolno je pokazać ekranom v1.
 *
 * Bez tego filtra `homeworkItemType()` poniżej uzna nieznany element v2
 * (`micro_translation`, `fix_sentence`, `gap_from_context`) za `translation`,
 * bo taka jest jego wartość zapasowa — i ekran kursanta spróbuje wyrenderować
 * zadanie, którego nie rozumie. Zestawy v2 mają własny ekran, wybierany flagą
 * `HOMEWORK_ENGINE_V2`.
 *
 * Filtrujemy po stronie przeglądarki, a nie w zapytaniu: dokumenty v1 w ogóle
 * nie mają pola `engineVersion`, a Firestore nie zwraca dokumentów bez pola
 * przy warunku nierówności — zapytanie `where('engineVersion','!=',2)`
 * odcięłoby całą historię v1.
 */
export const isV1Task = (task: unknown): boolean => !isV2Task(task);

/**
 * Typ pojedynczego ćwiczenia w pracy domowej.
 *
 * Jedna praca domowa mieści kilka rodzajów zadań naraz, więc rodzaj trzyma
 * element, a nie dokument. `task.type` zostaje wartością zapasową dla zadań
 * przypisanych zanim kreator zaczął scalać sekcje w jeden dokument — tam
 * wszystkie elementy były jednego rodzaju i pole dokumentu mówiło prawdę.
 */
export const homeworkItemType = (
  item: any,
  task?: { type?: HomeworkType } | null
): HomeworkType => {
  if (item?.type) return item.type as HomeworkType;
  if (item?.incorrectSentence) return 'find_errors';
  if (item?.chunks) return 'word_order';
  if (item?.options && typeof item?.correctIndex === 'number') return 'multiple_choice';
  if (item?.textWithBlanks || item?.blanks) return 'fill_in_the_blank';
  return (task?.type as HomeworkType) || 'translation';
};

/**
 * Praca domowa w podziale na bloki jednego rodzaju.
 *
 * Kreator scala rodzaje w jeden dokument, żeby kursant dostał jedną pracę
 * domową zamiast trzech pozycji na liście. Bloki są tylko widokiem tego samego
 * ciągu ćwiczeń: pilnują, żeby „jedno" nie zamieniło się w nieczytelną sieczkę,
 * i dają pozycje, po których widać, ile jeszcze zostało w bieżącym rodzaju.
 *
 * Kolejność ćwiczeń zostaje nietknięta — bloki powstają z następujących po
 * sobie elementów tego samego rodzaju, a `from` wskazuje pozycję w całości.
 */
export interface HomeworkBlock {
  type: HomeworkType;
  /** Indeks pierwszego ćwiczenia bloku w `task.sentences`. */
  from: number;
  count: number;
}

export const homeworkBlocks = (
  task?: { type?: HomeworkType; sentences?: any[] } | null
): HomeworkBlock[] => {
  const items = task?.sentences || [];
  const blocks: HomeworkBlock[] = [];

  items.forEach((item, index) => {
    const type = homeworkItemType(item, task);
    const last = blocks[blocks.length - 1];
    if (last && last.type === type) {
      last.count += 1;
    } else {
      blocks.push({ type, from: index, count: 1 });
    }
  });

  return blocks;
};

/**
 * Normalizes text for comparison: lowercase, trim, remove accents/diacritics, normalize separators
 */
export const normalizeText = (text: string | null | undefined): string => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    // Ł to osobna litera alfabetu, a nie L z ozdobnikiem — rozkład NFD jej nie
    // rusza. Bez jawnej podmiany „Kołłątaj” nie równa się zapisowi „Kollataj”,
    // który trafia do bazy przy koncie zakładanym z klawiatury bez polskich
    // znaków, i praca domowa nie zostaje rozpoznana jako własna.
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const cleanSeparators = (text: string): string => {
  return normalizeText(text).replace(/[\._\-+]/g, ' ').replace(/\s+/g, ' ').trim();
};

/**
 * Robustly checks if a special task or homework belongs to the given user.
 * Supports:
 * - 'all' / '*' / 'wszyscy' (tasks for all students)
 * - Array of studentIds in task.studentIds
 * - Exact user ID / auth.currentUser.uid / task.studentId / task.userId
 * - Email match (case-insensitive & dot-flexible)
 * - Username match (case-insensitive & accent-insensitive)
 * - Full name / first name + last name matching (e.g. "Bartłomiej Ciura", "Bartłomiej")
 */
export const isTaskForStudent = (task: Partial<SpecialTask> | any, user: Partial<User> | null): boolean => {
  if (!task || !user) return false;

  // Check array of studentIds if present
  if (Array.isArray(task.studentIds) && task.studentIds.length > 0) {
    for (const sId of task.studentIds) {
      if (isTaskForStudent({ ...task, studentIds: undefined, studentId: sId }, user)) {
        return true;
      }
    }
  }

  const rawStudentId = (task.studentId || task.userId || task.studentUid || task.assignedTo || '').toString().trim();
  const taskStudentIdNorm = normalizeText(rawStudentId);
  const taskStudentNameNorm = normalizeText(task.studentName || task.studentUsername || '');
  const taskStudentEmailNorm = normalizeText(task.studentEmail || (rawStudentId.includes('@') ? rawStudentId : ''));

  // 1. Universal assignment to all students
  if (
    taskStudentIdNorm === 'all' || 
    taskStudentIdNorm === 'wszyscy' || 
    taskStudentIdNorm === '*' || 
    taskStudentIdNorm === 'all_students' ||
    taskStudentIdNorm === 'allstudents'
  ) {
    return true;
  }

  // 2. Direct ID or Auth UID match
  const authUid = auth.currentUser?.uid || '';
  const userId = (user.id || (user as any).uid || '').toString().trim();

  if (userId) {
    const userIdNorm = normalizeText(userId);
    if (taskStudentIdNorm === userIdNorm || rawStudentId === userId) return true;
  }
  if (authUid) {
    const authUidNorm = normalizeText(authUid);
    if (taskStudentIdNorm === authUidNorm || rawStudentId === authUid) return true;
  }

  // 3. Email matching
  const userEmail = (user.email || auth.currentUser?.email || '').trim();
  const userEmailNorm = normalizeText(userEmail);
  if (userEmailNorm) {
    if (taskStudentIdNorm === userEmailNorm) return true;
    if (taskStudentEmailNorm && taskStudentEmailNorm === userEmailNorm) return true;
    
    const emailPrefix = userEmailNorm.split('@')[0];
    if (emailPrefix && (taskStudentIdNorm === emailPrefix || taskStudentIdNorm.includes(emailPrefix))) {
      return true;
    }
  }

  // 4. Username matching
  const username = (user.username || (user as any).name || (user as any).displayName || '').trim();
  const usernameNorm = normalizeText(username);
  const usernameClean = cleanSeparators(username);

  if (usernameNorm && usernameNorm.length >= 2) {
    if (taskStudentIdNorm === usernameNorm) return true;
    if (taskStudentNameNorm === usernameNorm) return true;
    if (taskStudentNameNorm.includes(usernameNorm)) return true;
    if (taskStudentIdNorm.includes(usernameNorm)) return true;
    if (usernameNorm.includes(taskStudentIdNorm) && taskStudentIdNorm.length >= 3) return true;

    if (usernameClean && usernameClean.length >= 2) {
      const taskNameClean = cleanSeparators(task.studentName || '');
      const taskIdClean = cleanSeparators(rawStudentId);
      if (taskNameClean === usernameClean || taskIdClean === usernameClean) return true;
      if (taskNameClean.includes(usernameClean) || usernameClean.includes(taskNameClean)) return true;
    }
  }

  // 5. First Name / Last Name matching
  const firstNameNorm = normalizeText(user.firstName);
  const lastNameNorm = normalizeText(user.lastName);
  const fullNameNorm = `${firstNameNorm} ${lastNameNorm}`.trim();

  if (fullNameNorm && fullNameNorm.length >= 3) {
    if (taskStudentNameNorm === fullNameNorm) return true;
    if (taskStudentIdNorm === fullNameNorm) return true;
    if (taskStudentNameNorm.includes(fullNameNorm)) return true;
    if (taskStudentIdNorm.includes(fullNameNorm)) return true;
  }

  if (firstNameNorm && lastNameNorm) {
    if (taskStudentNameNorm.includes(firstNameNorm) && taskStudentNameNorm.includes(lastNameNorm)) {
      return true;
    }
    if (taskStudentIdNorm.includes(firstNameNorm) && taskStudentIdNorm.includes(lastNameNorm)) {
      return true;
    }
  }

  if (firstNameNorm && firstNameNorm.length >= 3) {
    if (taskStudentNameNorm === firstNameNorm) return true;
    if (taskStudentNameNorm.startsWith(firstNameNorm + ' ')) return true;
    if (taskStudentIdNorm === firstNameNorm) return true;
  }

  if (lastNameNorm && lastNameNorm.length >= 3) {
    if (taskStudentNameNorm.endsWith(' ' + lastNameNorm)) return true;
    if (taskStudentIdNorm.includes(lastNameNorm)) return true;
  }

  return false;
};

/**
 * Formats any student answer into a clean human-readable text string.
 * Safely handles string, object (such as { BLANK_1: "...", BLANK_2: "..." }),
 * array (such as word order indices/words), numbers, and null/undefined.
 */
export const formatHomeworkAnswerText = (ans: any, fallback = '(Brak odpowiedzi)'): string => {
  if (ans === null || ans === undefined || ans === '') return fallback;
  if (typeof ans === 'string') return ans.trim() || fallback;
  if (typeof ans === 'number') return String(ans);
  if (Array.isArray(ans)) {
    const res = ans.join(' ').trim();
    return res || fallback;
  }
  if (typeof ans === 'object') {
    const entries = Object.entries(ans).filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '');
    if (entries.length === 0) return fallback;
    return entries
      .map(([k, v]) => `${k.replace('BLANK_', '#')}: ${String(v).trim()}`)
      .join(', ');
  }
  return String(ans).trim() || fallback;
};
