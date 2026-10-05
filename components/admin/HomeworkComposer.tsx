import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { AlertTriangle, Check, ChevronDown, ChevronUp, Loader2, Send, Sparkles, Trash2 } from 'lucide-react';
import { db } from '../../firebase';
import { HomeworkType, LessonRecord, User, Group, GroupHomeworkFanOutResult } from '../../types';
import { getLessonRecordsForStudent } from '../../services/lessonRecord';
import { buildGroupSourceLessons } from '../../utils/groupLessonHistory';
import { getAllUsers } from '../../services/userService';
import { auth } from '../../firebase';
import {
  GeneratedSection,
  HOMEWORK_TYPE_LABELS,
  OFFERED_HOMEWORK_TYPES,
  generateHomeworkSet,
} from '../../services/homeworkGenerator';
import { taskOwnerFields } from '../../utils/homework';
import { cleanVocabularyTopic, splitVocabularyLines } from '../../utils/vocabulary';
import HomeworkEmailConfirmationModal from './HomeworkEmailConfirmationModal';
import { generateSecureHomeworkToken, generateSecureToken } from '../../utils/token';
import {
  NO_RECIPIENTS_MESSAGE,
  buildAdHocHomeworkPayloads,
  filterByName,
  newAdHocHomeworkSetId,
  selectAllIds,
  toggleId,
  validateMultipleRecipients,
} from '../../utils/homeworkRecipients';

interface HomeworkComposerProps {
  /** Kursant wskazany z zewnątrz (np. z profilu w panelu lektora). */
  initialStudentId?: string;
  /** Grupa wskazana z zewnątrz (karta grupy) — kreator otwiera się w trybie „Grupa". */
  initialGroupId?: string;
  /** Wywoływane po przypisaniu — np. żeby wrócić do listy zadań. */
  onAssigned?: () => void;
}

type RecipientMode = 'student' | 'group' | 'multiple';
type SourceMode = 'lessons' | 'text';

const PER_TYPE_OPTIONS = [3, 5, 8];

const studentLabel = (student: User): string => {
  const name = `${student.firstName || ''} ${student.lastName || ''}`.trim();
  return name || student.username || student.email || student.id;
};

const todayPlusDays = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

/** Polska odmiana po liczebniku: 1 ćwiczenie, 2–4 ćwiczenia, 5+ ćwiczeń. */
const exerciseNoun = (n: number): string => {
  if (n === 1) return 'ćwiczenie';
  const rest10 = n % 10;
  const rest100 = n % 100;
  if (rest10 >= 2 && rest10 <= 4 && !(rest100 >= 12 && rest100 <= 14)) return 'ćwiczenia';
  return 'ćwiczeń';
};

const HomeworkComposer: React.FC<HomeworkComposerProps> = ({ initialStudentId, initialGroupId, onAssigned }) => {
  const [recipientMode, setRecipientMode] = useState<RecipientMode>(initialGroupId ? 'group' : 'student');
  const [students, setStudents] = useState<User[]>([]);
  const [studentId, setStudentId] = useState(initialStudentId || '');
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState(initialGroupId || '');
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  // Lekcje wybranej grupy (tryb „Grupa"): jedna pozycja na lekcję grupową.
  const [groupLessons, setGroupLessons] = useState<LessonRecord[]>([]);
  const [isLoadingGroupLessons, setIsLoadingGroupLessons] = useState(false);
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [sourceMode, setSourceMode] = useState<SourceMode>('lessons');
  const [pastedText, setPastedText] = useState('');
  const [types, setTypes] = useState<HomeworkType[]>(['translation', 'word_order']);
  const [perType, setPerType] = useState(5);
  const [instruction, setInstruction] = useState('');
  const [dueDate, setDueDate] = useState(() => todayPlusDays(7));

  const [isGenerating, setIsGenerating] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState('');
  const [sections, setSections] = useState<GeneratedSection[]>([]);
  const [modelUsed, setModelUsed] = useState<string>('');
  const [assignedCount, setAssignedCount] = useState(0);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [pendingEmailTask, setPendingEmailTask] = useState<any>(null);
  // Tryb „multiple": ad-hoc wybór kursantów bez grupy. Kolejka służy do
  // potwierdzania maili po kolei, osobno dla każdego odbiorcy.
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [emailQueue, setEmailQueue] = useState<Array<{ student: User | null; task: any }>>([]);
  const [pendingEmailStudent, setPendingEmailStudent] = useState<User | null>(null);
  const [groupFanOutResult, setGroupFanOutResult] = useState<GroupHomeworkFanOutResult | null>(null);

  const student = students.find((s) => s.id === studentId);
  const group = groups.find((g) => g.id === groupId);
  const visibleStudents = useMemo(
    () => filterByName(students, studentQuery, studentLabel),
    [students, studentQuery]
  );

  useEffect(() => {
    getAllUsers()
      .then((allUsers) => {
        const list = allUsers.filter((u) => u.role !== 'admin' && u.role !== 'teacher');
        list.sort((a, b) => studentLabel(a).localeCompare(studentLabel(b)));
        setStudents(list);
      })
      .catch((e) => console.error('Nie udało się wczytać kursantów:', e));

    // Pobranie aktywnych grup
    auth.currentUser?.getIdToken().then((token) => {
      fetch('/api/groups', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && Array.isArray(data.groups)) {
            setGroups(data.groups.filter((g: Group) => g.status === 'active'));
          }
        })
        .catch((e) => console.error('Nie udało się wczytać grup:', e));
    });
  }, []);

  // Zmiana kursanta zeruje wynik: zadania ułożone z lekcji jednej osoby nie
  // mogą po cichu trafić do drugiej.
  useEffect(() => {
    setSections([]);
    setAssignedCount(0);
    setSelectedLessonIds([]);
    // W trybie „Grupa" lekcje ładuje osobny efekt niżej — nie ma tu `studentId`.
    if (!studentId || recipientMode === 'group') {
      setLessons([]);
      return;
    }
    let active = true;
    getLessonRecordsForStudent(studentId)
      .then((records) => {
        if (!active) return;
        setLessons(records);
        // Domyślnie ostatnia lekcja — najczęstszy przypadek to zadanie po zajęciach.
        setSelectedLessonIds(records[0] ? [records[0].id] : []);
      })
      .catch((e) => console.error('Nie udało się wczytać lekcji kursanta:', e));
    return () => {
      active = false;
    };
  }, [studentId, recipientMode === 'group']);

  // Tryb „Grupa": historia lekcji grupy z kopii członków (cache
  // `getLessonRecordsForStudent`, filtr po `groupId`, sklejenie po
  // `groupLessonId`) — ta sama logika co karta grupy, bez nowych zapytań.
  useEffect(() => {
    if (recipientMode !== 'group') return;
    setSections([]);
    setAssignedCount(0);
    setSelectedLessonIds([]);
    setGroupLessons([]);
    const memberIds = group?.memberProfileIds || [];
    if (!groupId || memberIds.length === 0) {
      setIsLoadingGroupLessons(false);
      return;
    }
    let active = true;
    setIsLoadingGroupLessons(true);
    Promise.all(
      memberIds.map((id) =>
        getLessonRecordsForStudent(id)
          // Starsze kopie mogą nie mieć `studentId` — kursanta znamy z miejsca odczytu.
          .then((records) => records.map((r) => ({ ...r, studentId: r.studentId || id })))
          .catch((e) => {
            console.warn(`Nie udało się wczytać lekcji członka grupy ${id}:`, e);
            return [] as LessonRecord[];
          })
      )
    ).then((perMember) => {
      if (!active) return;
      const merged = buildGroupSourceLessons(perMember.flat(), groupId);
      setGroupLessons(merged);
      setSelectedLessonIds(merged[0] ? [merged[0].id] : []);
      setIsLoadingGroupLessons(false);
    });
    return () => {
      active = false;
    };
    // Skład grupy jako klucz tekstowy — ta sama lista nie czyta od nowa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientMode, groupId, (group?.memberProfileIds || []).join('|')]);

  // Źródło „Z historii lekcji": lekcje kursanta albo lekcje wybranej grupy.
  const sourceLessons = recipientMode === 'group' ? groupLessons : lessons;

  const selectedLessons = useMemo(
    () => sourceLessons.filter((l) => selectedLessonIds.includes(l.id)),
    [sourceLessons, selectedLessonIds]
  );

  // Odbiorca w trybie „Grupa" to grupa, nie kursant — bez `studentId`.
  const hasRecipientSource = recipientMode === 'group' ? Boolean(groupId) : Boolean(studentId);

  const canGenerate =
    hasRecipientSource &&
    types.length > 0 &&
    (sourceMode === 'lessons' ? selectedLessons.length > 0 : pastedText.trim().length > 20);

  const totalItems = sections.reduce((sum, section) => sum + section.items.length, 0);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setError('');
    setSections([]);
    setAssignedCount(0);
    try {
      const result = await generateHomeworkSet({
        source:
          sourceMode === 'lessons'
            ? { lessons: selectedLessons }
            : { pastedText },
        types,
        perType,
        level: (recipientMode === 'group' ? group?.level : student?.level) || 'B1',
        instruction: instruction.trim() || undefined,
        // Z `studentId` generator sięga po krzywą uczenia kursanta: poziom
        // wyliczony z jego wyników i ostatnie błędy trafiają do promptu.
        // Dla grupy nie ma jednego kursanta — zostaje poziom grupy.
        studentId: recipientMode === 'group' ? undefined : studentId,
      });
      setSections(result.sections);
      setModelUsed(result.modelUsed || '');
      if (result.sections.every((s) => s.items.length === 0)) {
        setError('Model nie zwrócił żadnych zadań. Spróbuj ponownie albo zmień materiał.');
      }
    } catch (e: any) {
      setError(e?.message || 'Nie udało się ułożyć zadań.');
    } finally {
      setIsGenerating(false);
    }
  };

  const removeItem = (type: HomeworkType, index: number) => {
    setSections((prev) =>
      prev.map((section) =>
        section.type === type
          ? { ...section, items: section.items.filter((_, i) => i !== index) }
          : section
      )
    );
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    setSections((prev) => {
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const moveItem = (type: HomeworkType, index: number, direction: 'up' | 'down') => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.type !== type) return section;
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= section.items.length) return section;
        const nextItems = [...section.items];
        const temp = nextItems[index];
        nextItems[index] = nextItems[target];
        nextItems[target] = temp;
        return { ...section, items: nextItems };
      })
    );
  };

  const handleAssign = async () => {
    if ((recipientMode === 'student' && !studentId) || (recipientMode === 'group' && !groupId) || totalItems === 0) return;
    if (recipientMode === 'multiple') {
      const msg = validateMultipleRecipients(selectedStudentIds);
      if (msg) {
        setError(msg);
        return;
      }
    }
    setIsAssigning(true);
    setError('');
    try {
      const nowIso = new Date().toISOString();
      const selectedLessons = sourceLessons.filter((l) => selectedLessonIds.includes(l.id));
      const sourceLabel =
        sourceMode === 'lessons' && selectedLessons[0]
          ? cleanVocabularyTopic(selectedLessons[0].topic) || selectedLessons[0].topic
          : '';

      const usable = sections.filter((section) => section.items.length > 0);

      // Jedno przypisanie, nie jedno na rodzaj zadania. Rodzaj niesie teraz
      // element, dzięki czemu kursant dostaje jedną pracę domową do zrobienia
      // od początku do końca, a nie trzy osobne pozycje na liście. Ma to też
      // drugi skutek: powiadomienie e-mail wychodzi raz, bo wyzwala je
      // utworzenie dokumentu (functions/src/index.ts).
      const items = usable.flatMap((section) =>
        section.items.map((item: any) => ({ ...item, type: section.type }))
      );
      const labels = usable.map((section) => HOMEWORK_TYPE_LABELS[section.type].pl);
      const singleType = usable.length === 1 ? usable[0].type : undefined;
      const title = singleType
        ? sourceLabel
          ? `${labels[0]}: ${sourceLabel}`
          : labels[0]
        : sourceLabel
        ? `Praca domowa: ${sourceLabel}`
        : 'Praca domowa';

      if (recipientMode === 'group' && groupId) {
        // Obsługa Fan-outu dla całej grupy
        const token = await auth.currentUser?.getIdToken();
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.maciej.pro';
        const res = await fetch(`/api/groups/${groupId}/assign-homework`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            title,
            type: usable[0].type,
            types: usable.map((section) => section.type),
            instructions: usable.map((section) => HOMEWORK_TYPE_LABELS[section.type].hint.pl).join(' '),
            sentences: items,
            dueDate,
            origin,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Nie udało się przypisać pracy domowej grupie.');

        setAssignedCount(items.length * (data.result?.assignedCount || 1));
        setSections([]);
        setGroupFanOutResult(data.result);
        return;
      }

      if (recipientMode === 'multiple') {
        // Ad-hoc bez grupy: endpoint grupowy wymaga dokumentu w `groups`, więc
        // zapisujemy po stronie klienta N dokumentów jak w ścieżce
        // indywidualnej, połączonych wspólnym `homeworkSetId` (bez `groupId`).
        const recipients = selectedStudentIds.map((id) => {
          const s = students.find((x) => x.id === id);
          return {
            id,
            name: s ? studentLabel(s) : 'Kursant',
            email: s?.email,
            username: s?.username,
          };
        });
        const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.maciej.pro';
        const payloads = buildAdHocHomeworkPayloads(
          recipients,
          {
            title,
            type: usable[0].type,
            types: usable.map((section) => section.type),
            instructions: usable.map((section) => HOMEWORK_TYPE_LABELS[section.type].hint.pl).join(' '),
            sentences: items,
            dueDate,
            createdAt: nowIso,
            origin: originUrl,
          },
          newAdHocHomeworkSetId(() => generateSecureToken(4)),
          generateSecureHomeworkToken
        );

        const lessonTopics = selectedLessons
          .map((l) => cleanVocabularyTopic(l.topic) || l.topic)
          .filter(Boolean);
        const vocabLines: string[] = [];
        selectedLessons.forEach((l) => {
          if (l.vocabularyText) vocabLines.push(...splitVocabularyLines(l.vocabularyText));
        });

        const queue: Array<{ student: User | null; task: any }> = [];
        for (let i = 0; i < payloads.length; i++) {
          const docRef = await addDoc(collection(db, 'specialTasks'), payloads[i]);
          try {
            await updateDoc(doc(db, 'users', recipients[i].id), { hasNewHomework: true });
          } catch (e) {
            console.warn('Nie udało się ustawić flagi hasNewHomework:', e);
          }
          queue.push({
            student: students.find((x) => x.id === recipients[i].id) || null,
            task: {
              id: docRef.id,
              ...payloads[i],
              itemCount: items.length,
              lessonTopics,
              vocabularySample: vocabLines.slice(0, 10),
            },
          });
        }

        setAssignedCount(items.length * payloads.length);
        setSections([]);
        setPendingEmailStudent(queue[0].student);
        setPendingEmailTask(queue[0].task);
        setEmailQueue(queue.slice(1));
        setIsEmailModalOpen(true);
        return;
      }

      const accessToken = generateSecureHomeworkToken();
      const accessExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.maciej.pro';
      const accessUrl = `${origin}/hw?token=${accessToken}`;

      const taskPayload = {
        ...taskOwnerFields(studentId),
        studentName: student ? studentLabel(student) : 'Kursant',
        studentEmail: student?.email || '',
        studentUsername: student?.username || '',
        title,
        // `type` zostaje dla widoków sprzed scalenia, które czytają jedno pole.
        // Przy pracy mieszanej jest tylko etykietą — rozstrzyga `type` elementu.
        type: usable[0].type,
        types: usable.map((section) => section.type),
        instructions: usable
          .map((section) => HOMEWORK_TYPE_LABELS[section.type].hint.pl)
          .join(' '),
        createdAt: nowIso,
        dueDate,
        status: 'pending' as const,
        sentences: items,
        manualEmailConfirmationRequired: true,
        skipAutoEmail: true,
        emailNotificationSent: false,
        accessToken,
        accessExpiresAt,
        accessUrl,
      };

      const docRef = await addDoc(collection(db, 'specialTasks'), taskPayload);

      try {
        await updateDoc(doc(db, 'users', studentId), { hasNewHomework: true });
      } catch (e) {
        // Flaga to tylko powiadomienie — jej brak nie może cofnąć przypisania.
        console.warn('Nie udało się ustawić flagi hasNewHomework:', e);
      }

      const lessonTopics = selectedLessons
        .map((l) => cleanVocabularyTopic(l.topic) || l.topic)
        .filter(Boolean);
      const vocabLines: string[] = [];
      selectedLessons.forEach((l) => {
        if (l.vocabularyText) {
          vocabLines.push(...splitVocabularyLines(l.vocabularyText));
        }
      });

      setAssignedCount(items.length);
      setSections([]);
      setPendingEmailTask({
        id: docRef.id,
        ...taskPayload,
        itemCount: items.length,
        lessonTopics,
        vocabularySample: vocabLines.slice(0, 10),
      });
      setIsEmailModalOpen(true);
    } catch (e: any) {
      setError(e?.message || 'Nie udało się przypisać pracy domowej.');
    } finally {
      setIsAssigning(false);
    }
  };

  const stepLabel = (n: number, text: string) => (
    <h3 className="flex items-center gap-2 text-sm font-bold text-white mb-3">
      <span className="w-6 h-6 rounded-lg bg-primary/15 border border-primary/30 text-primary font-mono text-xs flex items-center justify-center">
        {n}
      </span>
      {text}
    </h3>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-24">
      {/* 1. Odbiorca (Kursant lub Grupa) */}
      <section className="rounded-2xl border border-white/10 bg-base-200/40 p-4 sm:p-5">
        {stepLabel(1, 'Odbiorca zadania')}

        {/* Przełącznik typu odbiorcy */}
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => {
              setRecipientMode('student');
              setSections([]);
            }}
            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
              recipientMode === 'student'
                ? 'bg-primary/15 border-primary text-primary'
                : 'border-white/10 text-content-muted hover:text-white'
            }`}
          >
            Indywidualny kursant
          </button>
          <button
            type="button"
            onClick={() => {
              setRecipientMode('group');
              setSections([]);
              setSourceMode('lessons'); // lekcje grupy są dostępne; brak lekcji → komunikat i „Własny tekst"
            }}
            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
              recipientMode === 'group'
                ? 'bg-primary/15 border-primary text-primary'
                : 'border-white/10 text-content-muted hover:text-white'
            }`}
          >
            Grupa ({groups.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setRecipientMode('multiple');
              setSections([]);
            }}
            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
              recipientMode === 'multiple'
                ? 'bg-primary/15 border-primary text-primary'
                : 'border-white/10 text-content-muted hover:text-white'
            }`}
          >
            Kilku kursantów
          </button>
        </div>

        {recipientMode === 'student' ? (
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full min-h-[3rem] px-3 bg-base-100 text-white border border-white/15 rounded-xl text-sm font-semibold focus:border-primary focus:outline-none"
          >
            <option value="">— wybierz kursanta —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {studentLabel(s)}
                {s.level ? ` · ${s.level}` : ''}
              </option>
            ))}
          </select>
        ) : recipientMode === 'multiple' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-content-muted">Odbiorcy</span>
              <div className="flex gap-2 text-xs font-medium">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedStudentIds((cur) => selectAllIds(cur, visibleStudents.map((s) => s.id)))
                  }
                  className="text-primary hover:underline"
                >
                  Zaznacz wszystkich
                </button>
                <span className="text-white/20">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds([])}
                  className="text-content-muted hover:text-white hover:underline"
                >
                  Wyczyść
                </button>
              </div>
            </div>
            <input
              type="text"
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="Szukaj kursanta…"
              className="w-full min-h-[2.75rem] px-3 bg-base-100 text-white border border-white/15 rounded-xl text-sm focus:border-primary focus:outline-none"
            />
            <div className="max-h-40 overflow-y-auto space-y-1">
              {visibleStudents.length === 0 ? (
                <p className="text-xs text-content-muted p-2">Brak kursantów pasujących do wyszukiwania.</p>
              ) : (
                visibleStudents.map((s) => {
                  const checked = selectedStudentIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs cursor-pointer transition ${
                        checked
                          ? 'bg-primary/10 border-primary/35 text-white'
                          : 'border-white/10 text-content-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedStudentIds((cur) => toggleId(cur, s.id))}
                        className="accent-primary"
                      />
                      {studentLabel(s)}
                      {s.level ? ` · ${s.level}` : ''}
                    </label>
                  );
                })
              )}
            </div>
            {selectedStudentIds.length > 0 ? (
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-primary">
                  {selectedStudentIds.length}{' '}
                  {selectedStudentIds.length === 1 ? 'kursant wybrany' : 'kursantów wybranych'}
                </p>
                <p className="text-xs text-content-muted">
                  {students
                    .filter((s) => selectedStudentIds.includes(s.id))
                    .map(studentLabel)
                    .join(', ')}
                </p>
              </div>
            ) : (
              <p className="text-xs text-warn">{NO_RECIPIENTS_MESSAGE}</p>
            )}
            <label className="block space-y-1 pt-1">
              <span className="text-xs text-content-muted">
                Kursant bazowy (źródło lekcji i poziom) — niezależny od odbiorców
              </span>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full min-h-[3rem] px-3 bg-base-100 text-white border border-white/15 rounded-xl text-sm font-semibold focus:border-primary focus:outline-none"
              >
                <option value="">— wybierz kursanta —</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {studentLabel(s)}
                    {s.level ? ` · ${s.level}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-full min-h-[3rem] px-3 bg-base-100 text-white border border-white/15 rounded-xl text-sm font-semibold focus:border-primary focus:outline-none"
          >
            <option value="">— wybierz grupę —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.memberProfileIds?.length || 0} osób) · {g.level}
              </option>
            ))}
          </select>
        )}
      </section>

      {/* 2. Materiał */}
      <section className="rounded-2xl border border-white/10 bg-base-200/40 p-4 sm:p-5">
        {stepLabel(2, 'Z czego układamy')}
        <div className="flex gap-2 mb-4">
          {(['lessons', 'text'] as SourceMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setSourceMode(mode)}
              className={`flex-1 min-h-[2.75rem] rounded-xl border text-sm font-bold transition-colors ${
                sourceMode === mode
                  ? 'bg-primary/12 border-primary/40 text-primary'
                  : 'border-white/10 text-content-muted hover:text-text-hi'
              }`}
            >
              {mode === 'lessons' ? 'Z historii lekcji' : 'Własny tekst'}
            </button>
          ))}
        </div>

        {sourceMode === 'lessons' ? (
          recipientMode === 'group' && !groupId ? (
            <p className="text-sm text-content-muted">Najpierw wybierz grupę.</p>
          ) : recipientMode !== 'group' && !studentId ? (
            <p className="text-sm text-content-muted">Najpierw wybierz kursanta.</p>
          ) : recipientMode === 'group' && isLoadingGroupLessons ? (
            <p className="text-sm text-content-muted">Wczytuję lekcje grupy…</p>
          ) : sourceLessons.length === 0 ? (
            <p className="text-sm text-content-muted">
              {recipientMode === 'group'
                ? 'Ta grupa nie ma jeszcze lekcji grupowych (zapisanych z wybraną grupą). Starsze lekcje bez oznaczenia grupy nie są tu widoczne — użyj „Własny tekst”.'
                : 'Ten kursant nie ma jeszcze zapisanych lekcji.'}
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-64 overflow-y-auto">
              {sourceLessons.slice(0, 12).map((lesson) => {
                const checked = selectedLessonIds.includes(lesson.id);
                return (
                  <li key={lesson.id}>
                    <button
                      onClick={() =>
                        setSelectedLessonIds((prev) =>
                          checked ? prev.filter((id) => id !== lesson.id) : [...prev, lesson.id]
                        )
                      }
                      className={`w-full flex items-center gap-3 min-h-[3rem] px-3 rounded-xl border text-left transition-colors ${
                        checked
                          ? 'bg-primary/10 border-primary/35'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                          checked ? 'bg-primary border-primary text-accent-ink' : 'border-white/25'
                        }`}
                      >
                        {checked && <Check size={13} />}
                      </span>
                      <span className="font-mono text-[11px] text-content-muted shrink-0 w-16">
                        {lesson.date}
                      </span>
                      <span className="flex-1 min-w-0 text-sm text-content truncate">
                        {cleanVocabularyTopic(lesson.topic) || lesson.topic}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={7}
            placeholder={
              'Wklej słownictwo, notatki z zajęć albo fragment tekstu.\n\nnp.\nbe responsible for - odpowiadać za\nmeet a deadline - dotrzymać terminu'
            }
            className="w-full px-3 py-2.5 bg-base-100 text-white border border-white/15 rounded-xl text-sm focus:border-primary focus:outline-none resize-y"
          />
        )}
      </section>

      {/* 3. Ćwiczenia */}
      <section className="rounded-2xl border border-white/10 bg-base-200/40 p-4 sm:p-5">
        {stepLabel(3, 'Rodzaje ćwiczeń')}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OFFERED_HOMEWORK_TYPES.map((type) => {
            const active = types.includes(type);
            const label = HOMEWORK_TYPE_LABELS[type];
            return (
              <button
                key={type}
                onClick={() =>
                  setTypes((prev) =>
                    active ? prev.filter((t) => t !== type) : [...prev, type]
                  )
                }
                className={`p-3 rounded-xl border text-left transition-colors ${
                  active
                    ? 'bg-primary/10 border-primary/40'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <span
                  className={`block text-sm font-bold ${active ? 'text-primary' : 'text-content'}`}
                >
                  {label.pl}
                </span>
                <span className="block text-[12px] text-content-muted mt-0.5 leading-snug">
                  {label.hint.pl}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <span className="text-xs font-bold text-content-muted">Zadań na typ:</span>
          <div className="flex gap-1.5">
            {PER_TYPE_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setPerType(n)}
                className={`w-11 h-11 rounded-xl border font-mono text-sm font-bold transition-colors ${
                  perType === n
                    ? 'bg-primary/12 border-primary/40 text-primary'
                    : 'border-white/10 text-content-muted'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Wskazówka dla modelu (opcjonalnie), np. skup się na czasach przeszłych"
          className="w-full min-h-[3rem] mt-4 px-3 bg-base-100 text-white border border-white/15 rounded-xl text-sm focus:border-primary focus:outline-none"
        />

        <button
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating}
          className="w-full min-h-[3.25rem] mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary text-accent-ink font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Układam zadania…
            </>
          ) : (
            <>
              <Sparkles size={16} /> Ułóż pracę domową
            </>
          )}
        </button>
      </section>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 flex items-start gap-2 text-sm text-danger">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {assignedCount > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 flex items-center gap-2 text-sm text-primary">
          <Check size={16} />
          Przypisano jedną pracę domową — {assignedCount} {exerciseNoun(assignedCount)}.
        </div>
      )}

      {/* 4. Podgląd i przypisanie */}
      {sections.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-base-200/40 p-4 sm:p-5 space-y-4">
          {stepLabel(4, 'Sprawdź i przypisz')}

          {sections.map((section, sIdx) => (
            <div key={section.type} className="space-y-2 p-3.5 rounded-xl bg-base-100/30 border border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-primary/20 text-primary text-[11px] font-mono font-bold flex items-center justify-center">
                    {sIdx + 1}
                  </span>
                  <h4 className="text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-white">
                    {HOMEWORK_TYPE_LABELS[section.type].pl} · {section.items.length} {exerciseNoun(section.items.length)}
                  </h4>
                </div>
                {sections.length > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveSection(sIdx, 'up')}
                      disabled={sIdx === 0}
                      title="Przesuń blok zadań wyżej"
                      className="p-1.5 rounded-lg text-content-muted hover:text-text-hi hover:bg-white/10 disabled:opacity-20 transition-colors"
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(sIdx, 'down')}
                      disabled={sIdx === sections.length - 1}
                      title="Przesuń blok zadań niżej"
                      className="p-1.5 rounded-lg text-content-muted hover:text-text-hi hover:bg-white/10 disabled:opacity-20 transition-colors"
                    >
                      <ChevronDown size={15} />
                    </button>
                  </div>
                )}
              </div>

              {section.error && (
                <p className="text-[13px] text-warn">{section.error}</p>
              )}

              <ul className="space-y-1.5">
                {section.items.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-base-100/60 border border-white/[0.07] hover:border-white/15 transition-all"
                  >
                    <span className="w-6 h-6 rounded-md bg-base-300/80 text-content-muted text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <span className="flex-1 min-w-0 text-sm text-content leading-snug">
                      <ItemPreview type={section.type} item={item} />
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveItem(section.type, index, 'up')}
                        disabled={index === 0}
                        title="Przesuń zadanie wyżej"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-content-muted hover:text-text-hi hover:bg-white/10 disabled:opacity-20 transition-colors"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(section.type, index, 'down')}
                        disabled={index === section.items.length - 1}
                        title="Przesuń zadanie niżej"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-content-muted hover:text-text-hi hover:bg-white/10 disabled:opacity-20 transition-colors"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(section.type, index)}
                        title="Usuń zadanie"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-content-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/[0.07]">
            <label className="text-xs font-bold text-content-muted">Termin:</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="min-h-[2.75rem] px-3 bg-base-100 text-white border border-white/15 rounded-xl text-sm focus:border-primary focus:outline-none"
            />
            {modelUsed && (
              <span className="text-[11px] font-mono text-content-muted ml-auto">{modelUsed}</span>
            )}
          </div>

          <button
            onClick={handleAssign}
            disabled={totalItems === 0 || isAssigning}
            className="w-full min-h-[3.25rem] flex items-center justify-center gap-2 rounded-xl bg-primary text-accent-ink font-bold disabled:opacity-40"
          >
            {isAssigning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Przypisuję…
              </>
            ) : (
              <>
                <Send size={16} /> {recipientMode === 'group'
                  ? `Przypisz całej grupie (${totalItems})`
                  : recipientMode === 'multiple'
                  ? `Przypisz wybranym (${selectedStudentIds.length} os.) (${totalItems})`
                  : `Przypisz kursantowi (${totalItems})`}
              </>
            )}
          </button>
        </section>
      )}

      {/* Modal Fan-Out Grupowego (Raport Przypisania) */}
      {groupFanOutResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-base-100 dark:bg-dark-base-100 w-full max-w-2xl rounded-2xl border border-line-strong shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-line-weak flex justify-between items-center bg-emerald-500/10">
              <div>
                <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                  <Check className="w-6 h-6 stroke-[3]" />
                  Praca domowa przypisana grupie!
                </h2>
                <p className="text-xs text-text-mute mt-1">
                  Grupa: <strong className="text-text-hi">{groupFanOutResult.groupName}</strong> · Przypisano: {groupFanOutResult.assignedCount} kursantom
                </p>
              </div>
              <button
                onClick={() => {
                  setGroupFanOutResult(null);
                  if (onAssigned) onAssigned();
                }}
                className="text-text-mute hover:text-text-hi"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              {groupFanOutResult.skippedInactive.length > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs">
                  Pominięto {groupFanOutResult.skippedInactive.length} kursantów o statusie nieaktywnym / zawieszonym.
                </div>
              )}

              <p className="text-xs text-text-faint font-bold uppercase tracking-wider">
                Indywidualne linki direct URL dla kursantów:
              </p>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {groupFanOutResult.assignments.map((item) => (
                  <div
                    key={item.taskId}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-ink border border-line-strong text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-text-hi block truncate">{item.studentName}</span>
                      <span className="text-text-mute font-mono text-[11px] block truncate">{item.directUrl}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.directUrl);
                        alert(`Skopiowano link dla: ${item.studentName}`);
                      }}
                      className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg font-semibold shrink-0 transition-colors"
                    >
                      Kopiuj link
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-line-weak flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setGroupFanOutResult(null);
                  if (onAssigned) onAssigned();
                }}
                className="px-6 py-2.5 bg-primary text-accent-ink rounded-xl font-bold"
              >
                Zamknij i przejdź do zadań
              </button>
            </div>
          </div>
        </div>
      )}

      {isEmailModalOpen && pendingEmailTask && (() => {
        // Przy trybie „multiple" modal przechodzi po kolei przez odbiorców.
        const advance = () => {
          if (emailQueue.length > 0) {
            setPendingEmailStudent(emailQueue[0].student);
            setPendingEmailTask(emailQueue[0].task);
            setEmailQueue(emailQueue.slice(1));
            return;
          }
          setIsEmailModalOpen(false);
          setPendingEmailTask(null);
          setPendingEmailStudent(null);
          if (onAssigned) onAssigned();
        };
        return (
          <HomeworkEmailConfirmationModal
            key={pendingEmailTask.id}
            isOpen={isEmailModalOpen}
            student={pendingEmailStudent || student || null}
            task={pendingEmailTask}
            onEmailSent={advance}
            onSkip={advance}
            onClose={advance}
          />
        );
      })()}
    </div>
  );
};

/** Jednolinijkowy podgląd zadania w kreatorze — lektor sprawdza treść, nie układ. */
const ItemPreview: React.FC<{ type: HomeworkType; item: any }> = ({ type, item }) => {
  if (type === 'translation') {
    return (
      <>
        <span className="block text-white font-semibold">{item.polishSentence}</span>
        <span className="block text-primary/90 font-mono text-[13px]">
          {item.englishTranslation}
        </span>
      </>
    );
  }
  if (type === 'find_errors') {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-warn font-semibold text-[13px]">
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-warn/15 border border-warn/30 uppercase font-bold">
            Błąd
          </span>
          <span className="line-through opacity-85">{item.incorrectSentence}</span>
        </div>
        <span className="block text-primary/90 font-mono text-[13px] pl-1">
          ➜ {item.correctSentence}
        </span>
        {item.hint && (
          <span className="block text-amber-300 text-[12px] font-medium pl-1">
            💡 Wskazówka: {item.hint}
          </span>
        )}
        {item.explanation && (
          <span className="block text-content-muted text-[12px] italic pl-1">
            ℹ️ {item.explanation}
          </span>
        )}
      </div>
    );
  }
  if (type === 'word_order') {
    return (
      <>
        <span className="block text-white font-semibold">{item.correctSentence}</span>
        {item.polishHint && (
          <span className="block text-content-muted text-[13px]">{item.polishHint}</span>
        )}
      </>
    );
  }
  if (type === 'multiple_choice') {
    return (
      <>
        <span className="block text-white font-semibold">{item.question}</span>
        <span className="block text-primary/90 text-[13px]">
          {item.options?.[item.correctIndex]}
        </span>
      </>
    );
  }
  if (type === 'fill_in_the_blank') {
    return (
      <span className="block text-white whitespace-pre-wrap text-[13px]">
        {item.textWithBlanks}
      </span>
    );
  }
  return <span>{JSON.stringify(item).slice(0, 120)}</span>;
};

export default HomeworkComposer;
