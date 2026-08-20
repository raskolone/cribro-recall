import { SpecialTask, User } from '../types';
import { auth } from '../firebase';

/**
 * Normalizes text for comparison: lowercase, trim, remove accents/diacritics
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

/**
 * Robustly checks if a special task or homework belongs to the given user.
 * Supports:
 * - 'all' / '*' (tasks for all students)
 * - Exact user ID / auth.currentUser.uid
 * - Email match (case-insensitive)
 * - Username match (case-insensitive & accent-insensitive)
 * - Full name / first name + last name matching (e.g. "Bartłomiej Ciura", "Bartłomiej")
 */
export const isTaskForStudent = (task: Partial<SpecialTask> | any, user: Partial<User> | null): boolean => {
  if (!task || !user) return false;

  const taskStudentId = (task.studentId || '').toString().trim();
  const taskStudentIdNorm = normalizeText(taskStudentId);
  const taskStudentNameNorm = normalizeText(task.studentName);
  const taskStudentEmailNorm = normalizeText(task.studentEmail || (taskStudentId.includes('@') ? taskStudentId : ''));

  // 1. Universal assignment to all students
  if (
    taskStudentIdNorm === 'all' || 
    taskStudentIdNorm === 'wszyscy' || 
    taskStudentIdNorm === '*' || 
    taskStudentIdNorm === 'all_students'
  ) {
    return true;
  }

  // 2. Direct ID or Auth UID match
  const authUid = auth.currentUser?.uid || '';
  const userId = (user.id || (user as any).uid || '').toString().trim();

  if (userId && (taskStudentId === userId || taskStudentIdNorm === normalizeText(userId))) {
    return true;
  }
  if (authUid && (taskStudentId === authUid || taskStudentIdNorm === normalizeText(authUid))) {
    return true;
  }

  // 3. Email matching
  const userEmailNorm = normalizeText(user.email || auth.currentUser?.email);
  if (userEmailNorm) {
    if (taskStudentIdNorm === userEmailNorm) return true;
    if (taskStudentEmailNorm && taskStudentEmailNorm === userEmailNorm) return true;
    if (taskStudentIdNorm.includes(userEmailNorm.split('@')[0])) return true;
  }

  // 4. Username matching
  const usernameNorm = normalizeText(user.username);
  if (usernameNorm && usernameNorm.length >= 2) {
    if (taskStudentIdNorm === usernameNorm) return true;
    if (taskStudentNameNorm === usernameNorm) return true;
    if (taskStudentNameNorm.includes(usernameNorm)) return true;
  }

  // 5. First Name / Last Name matching
  const firstNameNorm = normalizeText(user.firstName);
  const lastNameNorm = normalizeText(user.lastName);
  const fullNameNorm = `${firstNameNorm} ${lastNameNorm}`.trim();

  if (fullNameNorm && fullNameNorm.length >= 3) {
    if (taskStudentNameNorm === fullNameNorm) return true;
    if (taskStudentIdNorm === fullNameNorm) return true;
    if (taskStudentNameNorm.includes(fullNameNorm)) return true;
  }

  if (firstNameNorm && lastNameNorm) {
    if (taskStudentNameNorm.includes(firstNameNorm) && taskStudentNameNorm.includes(lastNameNorm)) {
      return true;
    }
  }

  if (firstNameNorm && firstNameNorm.length >= 3) {
    if (taskStudentNameNorm === firstNameNorm) return true;
    if (taskStudentNameNorm.startsWith(firstNameNorm + ' ')) return true;
  }

  return false;
};
