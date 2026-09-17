import { collection, getDocs, query, where, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  LessonRecord,
  User,
  TeacherCockpitData,
  StudentOperationalHubData,
  ScheduledLessonCard,
  CloseoutLessonCard,
  ReviewHomeworkCard,
  StudentWithoutPlanCard,
  LessonWorkflowStatus,
} from '../types';
import { formatStudentDisplayName } from '../utils/studentFormat';
import { extractLessonBlocks } from '../utils/lessonBlocks';
import { getLessonRecordsForStudent, getAllLessonRecordsForTeacher } from './lessonRecord';
import { getStudentWeaknessItems } from './studentContext';

/** Pomocniczy format daty YYYY-MM-DD */
export function getIsoDateOnly(input?: Date | string | number | null): string {
  if (!input) return '';
  if (typeof input === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    const parsed = new Date(input);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return input.substring(0, 10);
  }
  const d = typeof input === 'number' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Określa status operacyjny workflow dla danego rekordu lekcji */
export function deriveLessonWorkflowStatus(lesson: LessonRecord): LessonWorkflowStatus {
  if (lesson.workflowStatus) return lesson.workflowStatus;
  
  // Jeśli lekcja oczekuje na potwierdzenie lektora
  if (lesson.isPendingConfirmation) {
    return 'draft';
  }

  // Jeśli lekcja pochodzi z transkrypcji Sift
  if (lesson.source === 'live_transcript') {
    if (lesson.sessionStatus === 'completed') return 'completed';
    if (lesson.sessionStatus === 'live') return 'in_progress';
    return 'draft';
  }

  const lessonDate = lesson.date;
  const today = getIsoDateOnly(new Date());

  if (lessonDate > today) {
    return 'scheduled';
  }

  // Jeśli lekcja została zatwierdzona lub ma treść słownictwa/bloków
  const blocks = extractLessonBlocks(lesson);
  if (lesson.status === 'confirmed' || blocks.vocabulary || blocks.corrections || lesson.vocabularyText) {
    return 'closed';
  }

  return 'completed';
}

/**
 * Główna funkcja agregująca dane dla ekranu „Dzisiaj” (Teacher Daily Cockpit).
 */
export async function fetchTeacherCockpitData(options?: {
  students?: User[];
  lessons?: LessonRecord[];
}): Promise<TeacherCockpitData> {
  const todayStr = getIsoDateOnly(new Date());
  const next7Days = new Date();
  next7Days.setDate(next7Days.getDate() + 7);
  const next7DaysStr = getIsoDateOnly(next7Days);

  // 1. Kursanci
  let students = options?.students;
  if (!students) {
    try {
      const usersQuery = query(collection(db, 'users'));
      const snapshot = await getDocs(usersQuery);
      students = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
    } catch (err) {
      console.warn('[Cockpit] Błąd pobierania kursantów:', err);
      students = [];
    }
  }

  const studentMap = new Map<string, User>();
  const activeStudents = (students || []).filter(s => {
    if (s.id) studentMap.set(s.id, s);
    return s.role === 'user' && !s.isSuspended && !s.isArchived && s.statusWspolpracy !== 'Nieaktywny';
  });

  // 2. Lekcje
  let lessons = options?.lessons;
  if (!lessons) {
    try {
      lessons = await getAllLessonRecordsForTeacher(activeStudents);
    } catch (err) {
      console.warn('[Cockpit] Błąd pobierania lekcji:', err);
      lessons = [];
    }
  }

  // 3. Zadania domowe oczekujące na sprawdzenie (status: 'submitted')
  const pendingReviews: ReviewHomeworkCard[] = [];
  try {
    const tasksQuery = query(
      collection(db, 'specialTasks'),
      where('status', '==', 'submitted'),
      limit(25)
    );
    const taskSnap = await getDocs(tasksQuery);
    taskSnap.forEach(d => {
      const data = d.data();
      const sId = data.studentUid || data.studentId || '';
      const sObj = studentMap.get(sId);
      const studentName = formatStudentDisplayName(sObj, data.studentName || 'Kursant');
      pendingReviews.push({
        id: d.id,
        studentId: sId,
        studentName,
        title: data.title || data.topic || 'Zadanie domowe',
        submittedAt: data.submittedAt || data.updatedAt,
        score: data.evaluationResults?.score ?? data.score,
        maxScore: data.evaluationResults?.maxScore ?? data.maxScore,
        type: data.type || 'homework',
      });
    });
  } catch (err) {
    console.warn('[Cockpit] Błąd pobierania zadań domowych do sprawdzenia:', err);
  }

  // 4. Kategoryzacja lekcji
  const todayLessons: ScheduledLessonCard[] = [];
  const upcomingLessons: ScheduledLessonCard[] = [];
  const requiringCloseout: CloseoutLessonCard[] = [];
  const studentsWithUpcomingLesson = new Set<string>();

  (lessons || []).forEach(lesson => {
    const studentObj = studentMap.get(lesson.studentId);
    const studentName = formatStudentDisplayName(studentObj, lesson.studentName || 'Kursant');
    const workflowStatus = deriveLessonWorkflowStatus(lesson);
    const lDate = lesson.date;

    // Lekcja na dzisiaj
    if (lDate === todayStr) {
      studentsWithUpcomingLesson.add(lesson.studentId);
      todayLessons.push({
        id: lesson.id,
        studentId: lesson.studentId,
        studentName,
        date: lesson.date,
        topic: lesson.topic,
        level: studentObj?.level,
        workflowStatus,
        hasScenario: Boolean(lesson.scenarioId || lesson.scenarioContent),
        scenarioId: lesson.scenarioId,
        hasActiveScratchpad: true,
        activeScratchpadId: `sp_${lesson.studentId}`,
      });
    } else if (lDate > todayStr && lDate <= next7DaysStr) {
      // Nadchodząca w ciągu 7 dni
      studentsWithUpcomingLesson.add(lesson.studentId);
      upcomingLessons.push({
        id: lesson.id,
        studentId: lesson.studentId,
        studentName,
        date: lesson.date,
        topic: lesson.topic,
        level: studentObj?.level,
        workflowStatus,
        hasScenario: Boolean(lesson.scenarioId || lesson.scenarioContent),
        scenarioId: lesson.scenarioId,
        hasActiveScratchpad: true,
        activeScratchpadId: `sp_${lesson.studentId}`,
      });
    }

    // Lekcje wymagające zamknięcia (odbyte, transkrypcje, oczekujące na zatwierdzenie)
    const isClosed = workflowStatus === 'closed' || (lesson.status === 'confirmed' && !lesson.isPendingConfirmation && lesson.source !== 'live_transcript');
    const needsCloseout = !isClosed && (
      lesson.isPendingConfirmation ||
      lesson.source === 'live_transcript' ||
      workflowStatus === 'completed' ||
      (lDate && lDate <= todayStr && (lesson.sessionStatus === 'completed' || lesson.sessionStatus === 'draft'))
    );

    if (needsCloseout) {
      requiringCloseout.push({
        id: lesson.id,
        studentId: lesson.studentId,
        studentName,
        date: lesson.date,
        topic: lesson.topic,
        source: lesson.source,
        hasSummary: Boolean(lesson.lessonSummary || lesson.structuredBlocks?.summary),
        hasHomework: Boolean(lesson.homeworkText || lesson.structuredBlocks?.homework),
        hasVocabulary: Boolean(lesson.vocabularyText || lesson.structuredBlocks?.vocabulary),
        createdAt: lesson.createdAt,
      });
    }
  });

  // Sortuj chronologicznie
  todayLessons.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  upcomingLessons.sort((a, b) => a.date.localeCompare(b.date));
  requiringCloseout.sort((a, b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt));

  // 5. Kursanci bez zaplanowanej lekcji
  const studentsWithoutPlan: StudentWithoutPlanCard[] = [];
  activeStudents.forEach(st => {
    if (!st.id) return;
    if (!studentsWithUpcomingLesson.has(st.id)) {
      // Odszukaj ostatnią lekcję tego kursanta
      const studentLessons = (lessons || [])
        .filter(l => l.studentId === st.id)
        .sort((a, b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt));
      const lastL = studentLessons[0];

      studentsWithoutPlan.push({
        studentId: st.id,
        studentName: formatStudentDisplayName(st),
        level: st.level,
        company: st.company,
        lastLessonDate: lastL?.date,
        lastLessonTopic: lastL?.topic,
      });
    }
  });

  return {
    todayLessons,
    upcomingLessons,
    requiringCloseout,
    pendingHomeworkReviews: pendingReviews,
    studentsWithoutPlan,
    stats: {
      todayCount: todayLessons.length,
      closeoutCount: requiringCloseout.length,
      reviewCount: pendingReviews.length,
      unplannedCount: studentsWithoutPlan.length,
    },
  };
}

/**
 * Pobiera zintegrowany, pełny kontekst operacyjny kursanta do Karty Kursanta.
 */
export async function fetchStudentHubContext(
  studentId: string,
  cachedStudent?: User
): Promise<StudentOperationalHubData | null> {
  if (!studentId) return null;

  try {
    // 1. Profil kursanta
    let student: (User & { id: string }) | null = null;
    if (cachedStudent && (cachedStudent as any).id === studentId) {
      student = cachedStudent as (User & { id: string });
    } else {
      const snap = await getDoc(doc(db, 'users', studentId));
      if (snap.exists()) {
        student = { id: snap.id, ...(snap.data() as User) };
      }
    }

    if (!student) return null;

    // 2. Lekcje kursanta (posortowane od najnowszej)
    const lessons = await getLessonRecordsForStudent(studentId);
    const sortedLessons = [...lessons].sort((a, b) =>
      (b.date || b.createdAt).localeCompare(a.date || a.createdAt)
    );

    // 3. Ostatnie tematy lekcji (do ochrony przed powtórkami)
    const recentTopics = sortedLessons.slice(0, 10).map(l => ({
      date: l.date,
      topic: l.topic,
      lessonId: l.id,
    }));

    // 4. Słabe punkty i błędy powtarzalne
    const weaknesses = await getStudentWeaknessItems(studentId, 15);

    // 5. Zadania domowe
    const currentTasks: Array<{ id: string; title: string; status: string; dueDate?: string; score?: number }> = [];
    try {
      const taskSnap = await getDocs(
        query(
          collection(db, 'specialTasks'),
          where('studentUid', '==', studentId),
          limit(10)
        )
      );
      taskSnap.forEach(d => {
        const data = d.data();
        currentTasks.push({
          id: d.id,
          title: data.title || data.topic || 'Zadanie domowe',
          status: data.status || 'pending',
          dueDate: data.dueDate,
          score: data.evaluationResults?.score ?? data.score,
        });
      });
    } catch (taskErr) {
      console.warn('[StudentHub] Błąd pobierania zadań kursanta:', taskErr);
    }

    // 6. Statystyki Recall / słownictwa
    let totalWords = 0;
    let masteredWords = 0;
    let learningWords = 0;

    try {
      const wordsSnap = await getDocs(
        query(collection(db, `users/${studentId}/words`), limit(200))
      );
      totalWords = wordsSnap.size;
      wordsSnap.forEach(d => {
        const w = d.data();
        if (w.isDifficult) {
          learningWords++;
        } else {
          masteredWords++;
        }
      });
    } catch {
      // Ignoruj opcjonalny brak kolekcji słów
    }

    return {
      student,
      lastLessons: sortedLessons.slice(0, 10),
      recentTopics,
      activeWeaknesses: weaknesses,
      currentTasks,
      recallStats: {
        totalWords,
        masteredWords,
        learningWords,
      },
    };
  } catch (err) {
    console.error('[StudentHub] Błąd pobierania kontekstu kursanta:', err);
    return null;
  }
}
