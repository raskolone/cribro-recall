import { SpecialTask, User } from '../types';
import { auth } from '../firebase';

/**
 * Normalizes text for comparison: lowercase, trim, remove accents/diacritics, normalize separators
 */
export const normalizeText = (text: string | null | undefined): string => {
  if (!text) return '';
  return text
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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
