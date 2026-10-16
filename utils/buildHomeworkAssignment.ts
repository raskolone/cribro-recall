import { HomeworkType, User } from '../types';
import { HOMEWORK_TYPE_LABELS } from '../services/homeworkGenerator';
import { taskOwnerFields } from './homework';
import { warmupFieldEntry } from './warmupField';
import { warmupCardsFieldEntry } from './warmupCards';
import { generateSecureHomeworkToken } from './token';

export const formatStudentLabel = (student?: Partial<User> | null): string => {
  if (!student) return 'Kursant';
  const name = `${student.firstName || ''} ${student.lastName || ''}`.trim();
  return name || student.username || student.email || student.id || 'Kursant';
};

export interface BuildHomeworkAssignmentInput {
  student?: Partial<User> | null;
  studentId: string;
  title: string;
  usable: Array<{ type: HomeworkType }>;
  items: any[];
  dueDate: string;
  createdAt?: string;
  finalWarmup?: any;
  finalCards?: any;
  origin?: string;
  includeToken?: boolean;
  token?: string;
  accessExpiresAt?: string;
  skipAutoEmail?: boolean;
  manualEmailConfirmationRequired?: boolean;
  emailNotificationSent?: boolean;
  status?: 'pending';
}

/**
 * Buduje dokument pracy domowej (`specialTasks`).
 *
 * Wydzielone z `HomeworkComposer.tsx` w ramach S1, aby zachować 100% zgodności
 * między bezpośrednim przypisaniem przez kreator a wydawaniem pozycji z serii prac domowych.
 */
export function buildHomeworkAssignment(input: BuildHomeworkAssignmentInput): Record<string, any> {
  const {
    student,
    studentId,
    title,
    usable,
    items,
    dueDate,
    createdAt = new Date().toISOString(),
    finalWarmup,
    finalCards,
    origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.maciej.pro',
    includeToken = true,
    token,
    accessExpiresAt,
    skipAutoEmail = true,
    manualEmailConfirmationRequired = true,
    emailNotificationSent = false,
    status = 'pending',
  } = input;

  const ownerFields = taskOwnerFields(studentId);
  const studentName = student ? formatStudentLabel(student) : 'Kursant';
  const studentEmail = student?.email || '';
  const studentUsername = student?.username || '';
  const firstType = usable[0]?.type;
  const types = usable.map((section) => section.type);
  const instructions = usable
    .map((section) => HOMEWORK_TYPE_LABELS[section.type]?.hint.pl || '')
    .join(' ');

  const payload: Record<string, any> = {
    ...ownerFields,
    studentName,
    studentEmail,
    studentUsername,
    title,
    type: firstType,
    types,
    instructions,
    createdAt,
    dueDate,
    status,
    sentences: items,
    ...warmupFieldEntry(finalWarmup),
    ...warmupCardsFieldEntry(finalCards),
    manualEmailConfirmationRequired,
    skipAutoEmail,
    emailNotificationSent,
  };

  if (includeToken) {
    const accessToken = token || generateSecureHomeworkToken();
    const expiresAt =
      accessExpiresAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const accessUrl = `${origin}/hw?token=${accessToken}`;

    payload.accessToken = accessToken;
    payload.accessExpiresAt = expiresAt;
    payload.accessUrl = accessUrl;
  }

  return payload;
}
