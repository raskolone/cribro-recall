import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  Edit3,
  ExternalLink,
  KeyRound,
  Layers,
  ListChecks,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Target,
  Wand2,
  X,
} from 'lucide-react';
import { collection, doc, getDocs, orderBy, query, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { LessonRecord, RejectedNotionItem, User } from '../../types';
import {
  ImportReport,
  MatchReason,
  NotionLessonItem,
  PreviewResult,
  StudentPreview,
  importNotionSelection,
  previewNotionSync,
} from '../../services/notionSync';
import { getRejectedNotionLessons, syncFlashcardSetForLesson } from '../../services/lessonRecord';
import {
  buildVocabularySetTitle,
  countVocabularyItems,
  splitVocabularyLines,
} from '../../utils/vocabulary';
import { extractLessonBlocks } from '../../utils/lessonBlocks';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedUser: User | null;
  onSyncComplete?: () => void;
}

export interface StagedLesson {
  id: string;
  date: string;
  isDateMissing?: boolean;
  pendingReason?: string;
  topic: string;
  approved: boolean;
  summary: string;
  vocabulary: string;
  corrections: string;
  homework: string;
  answerKey: string;
  nextLesson: string;
  learningCurve: string;
  originalRecord: LessonRecord;
}

const normalize = (v: string): string =>
  (v || '')
    .toString()
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const MATCH_LABELS: Record<MatchReason, string> = {
  notion: 'powiązany wcześniej ID strony Notion',
  email: 'rozpoznany po adresie e-mail',
  name: 'rozpoznany po imieniu i nazwisku',
  username: 'rozpoznany po nazwie użytkownika',
};

const StudentNotionSyncModal: React.FC<Props> = ({
  isOpen,
  onClose,
  selectedUser,
  onSyncComplete,
}) => {
  const [step, setStep] = useState<
    'checking' | 'verification' | 'importing' | 'staging' | 'saving_staged' | 'success' | 'error'
  >('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [matchedStudent, setMatchedStudent] = useState<StudentPreview | null>(null);
  const [allStudents, setAllStudents] = useState<StudentPreview[]>([]);
  const [selectedNotionId, setSelectedNotionId] = useState<string>('');
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [recentLessons, setRecentLessons] = useState<LessonRecord[]>([]);
  const [localLessonCount, setLocalLessonCount] = useState<number>(0);
  const [rejectedNotionLessons, setRejectedNotionLessons] = useState<RejectedNotionItem[]>([]);

  // Stan dla etapu weryfikacji i stagingu AI (kontrola lektora przed utrwaleniem)
  const [stagedLessons, setStagedLessons] = useState<StagedLesson[]>([]);
  const [activeStagedIndex, setActiveStagedIndex] = useState<number>(0);

  // Stan wyboru konkretnych lekcji z Notion do zaimportowania
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(new Set());
  const [existingDocIds, setExistingDocIds] = useState<Set<string>>(new Set());
  const [existingNotionPageIds, setExistingNotionPageIds] = useState<Set<string>>(new Set());
  const [existingTopicKeys, setExistingTopicKeys] = useState<Set<string>>(new Set());
  // Domyślnie tylko nowe wpisy: przy kilkudziesięciu lekcjach w Notion lista
  // „wszystkie" to głównie rzeczy dawno zaimportowane, a lektor przychodzi tu
  // po to, żeby dobrać to, czego jeszcze nie ma.
  const [lessonFilter, setLessonFilter] = useState<'all' | 'new' | 'already_imported'>('new');
  const [lessonSearchTerm, setLessonSearchTerm] = useState<string>('');

  // Uruchomienie sprawdzania bazy Notion przy otwarciu okna
  useEffect(() => {
    if (isOpen && selectedUser) {
      checkNotionDatabase();
    } else {
      resetState();
    }
  }, [isOpen, selectedUser?.id]);

  const resetState = () => {
    setStep('checking');
    setErrorMsg('');
    setPreviewResult(null);
    setMatchedStudent(null);
    setAllStudents([]);
    setSelectedNotionId('');
    setImportReport(null);
    setRecentLessons([]);
    setLocalLessonCount(0);
    setRejectedNotionLessons([]);
    setStagedLessons([]);
    setActiveStagedIndex(0);
    setSelectedLessonIds(new Set());
    setExistingDocIds(new Set());
    setExistingNotionPageIds(new Set());
    setExistingTopicKeys(new Set());
    setLessonFilter('all');
    setLessonSearchTerm('');
  };

  const isLessonAlreadyImported = (lesson: NotionLessonItem): boolean => {
    if (existingDocIds.has(lesson.id)) return true;
    if (existingNotionPageIds.has(lesson.id)) return true;
    if (lesson.topic && existingTopicKeys.has(normalize(lesson.topic))) return true;
    return false;
  };

  const isLessonRejected = (lesson: NotionLessonItem): boolean => {
    return rejectedNotionLessons.some(
      (rej) => rej.id === lesson.id || (lesson.topic && normalize(rej.topic) === normalize(lesson.topic))
    );
  };

  const initializeSelectedLessons = (
    lessons: NotionLessonItem[],
    docIds: Set<string>,
    pageIds: Set<string>,
    topicKeys: Set<string>,
    rejList: RejectedNotionItem[]
  ) => {
    const newItems = lessons.filter((l) => {
      const alreadyIn =
        docIds.has(l.id) || pageIds.has(l.id) || (l.topic && topicKeys.has(normalize(l.topic)));
      const isRej = rejList.some(
        (r) => r.id === l.id || (l.topic && normalize(r.topic) === normalize(l.topic))
      );
      return !alreadyIn && !isRej;
    });

    if (newItems.length > 0) {
      setSelectedLessonIds(new Set(newItems.map((l) => l.id)));
    } else {
      setSelectedLessonIds(new Set());
    }
  };

  const toggleLessonSelection = (id: string) => {
    setSelectedLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectOnlyNewLessons = () => {
    if (!matchedStudent?.lessons) return;
    const newItems = matchedStudent.lessons.filter(
      (l) => !isLessonAlreadyImported(l) && !isLessonRejected(l)
    );
    setSelectedLessonIds(new Set(newItems.map((l) => l.id)));
  };

  const selectAllLessons = () => {
    if (!matchedStudent?.lessons) return;
    setSelectedLessonIds(new Set(matchedStudent.lessons.map((l) => l.id)));
  };

  const deselectAllLessons = () => {
    setSelectedLessonIds(new Set());
  };

  const findBestMatch = (students: StudentPreview[], user: User): StudentPreview | null => {
    if (!user) return null;

    // 1. Dopasowanie po zapisanym UID w Notion
    const byUid = students.find((s) => s.uid === user.id);
    if (byUid) return byUid;

    // 2. Dopasowanie po notionPageId w profilu kursanta
    if (user.notionPageId) {
      const byNotionId = students.find((s) => s.notionId === user.notionPageId);
      if (byNotionId) return byNotionId;
    }

    // 3. Dopasowanie po adresie e-mail
    const userEmailNorm = normalize(user.email || '');
    if (userEmailNorm) {
      const byEmail = students.find((s) =>
        s.emails.some((e) => normalize(e) === userEmailNorm)
      );
      if (byEmail) return byEmail;
    }

    // 4. Dopasowanie po imieniu i nazwisku
    const userFullNameNorm = normalize(`${user.firstName || ''} ${user.lastName || ''}`.trim());
    if (userFullNameNorm && userFullNameNorm.length >= 3) {
      const byFullName = students.find((s) => normalize(s.name) === userFullNameNorm);
      if (byFullName) return byFullName;
    }

    // 5. Dopasowanie po nazwie użytkownika
    const usernameNorm = normalize(user.username || '');
    if (usernameNorm && usernameNorm.length >= 3) {
      const byUsername = students.find((s) => normalize(s.name) === usernameNorm);
      if (byUsername) return byUsername;
    }

    return null;
  };

  const checkNotionDatabase = async () => {
    if (!selectedUser) return;
    setStep('checking');
    setErrorMsg('');

    try {
      // 1. Pobierz liczbę lokalnych lekcji kursanta w Firestore
      const recordsRef = collection(db, `users/${selectedUser.id}/lessonRecords`);
      const qRecords = query(recordsRef, orderBy('date', 'desc'));
      const recordsSnap = await getDocs(qRecords);
      setLocalLessonCount(recordsSnap.size);

      const docIds = new Set<string>();
      const pageIds = new Set<string>();
      const topicKeys = new Set<string>();

      recordsSnap.docs.forEach((docSnap) => {
        docIds.add(docSnap.id);
        const data = docSnap.data();
        if (data.notionPageId) pageIds.add(data.notionPageId);
        if (data.topic) topicKeys.add(normalize(data.topic));
      });

      setExistingDocIds(docIds);
      setExistingNotionPageIds(pageIds);
      setExistingTopicKeys(topicKeys);

      // Pobierz listę odrzuconych tematów
      let rejList: RejectedNotionItem[] = [];
      try {
        rejList = await getRejectedNotionLessons(selectedUser.id);
        setRejectedNotionLessons(rejList);
      } catch (e) {
        console.warn('Nie udało się pobrać odrzuconych tematów:', e);
      }

      // 2. Pobierz podgląd Notion z Cloud Functions
      const result = await previewNotionSync();
      setPreviewResult(result);
      setAllStudents(result.students || []);

      // 3. Znajdź kursanta w wynikach Notion
      const matched = findBestMatch(result.students, selectedUser);
      if (matched) {
        setMatchedStudent(matched);
        setSelectedNotionId(matched.notionId);
        initializeSelectedLessons(matched.lessons || [], docIds, pageIds, topicKeys, rejList);
      } else {
        setMatchedStudent(null);
        setSelectedNotionId(result.students[0]?.notionId || '');
        setSelectedLessonIds(new Set());
      }

      setStep('verification');
    } catch (err: any) {
      console.error('Błąd podczas sprawdzania Notion:', err);
      setErrorMsg(err?.message || 'Nie udało się połączyć z bazą Notion lub Cloud Functions.');
      setStep('error');
    }
  };

  const handleSelectNotionCard = (notionId: string) => {
    setSelectedNotionId(notionId);
    const chosen = allStudents.find((s) => s.notionId === notionId) || null;
    setMatchedStudent(chosen);
    if (chosen) {
      initializeSelectedLessons(
        chosen.lessons || [],
        existingDocIds,
        existingNotionPageIds,
        existingTopicKeys,
        rejectedNotionLessons
      );
    }
  };

  const handleRunImport = async () => {
    if (!selectedNotionId || !selectedUser) return;

    setStep('importing');
    setErrorMsg('');

    try {
      // Zawsze jawna lista, nigdy `undefined`. Brak listy oznacza po stronie
      // funkcji „importuj wszystko", więc pusty wybór zaciągał ponownie całe
      // archiwum kursanta zamiast nie robić nic.
      const chosenLessonIdsArray = Array.from(selectedLessonIds);

      // Krok 1: Wywołanie importu zaznaczonej karty z Notion z przekazaniem wybranych lekcji
      const report = await importNotionSelection([
        {
          notionId: selectedNotionId,
          createAccount: false,
          lessonIds: chosenLessonIdsArray,
        },
      ]);
      setImportReport(report);

      // Krok 2: Odczyt zaktualizowanych lekcji z Firestore
      const recordsRef = collection(db, `users/${selectedUser.id}/lessonRecords`);
      const qRecords = query(recordsRef, orderBy('date', 'desc'));
      const snap = await getDocs(qRecords);

      const allRecords: LessonRecord[] = [];
      snap.forEach((docSnap) => {
        allRecords.push({ id: docSnap.id, ...docSnap.data() } as LessonRecord);
      });

      // Krok 3: Przygotowanie lekcji do etapu Stagingu i Weryfikacji AI
      // Bierzemy DOKŁADNIE lekcje, które lektor wybrał do zaimportowania!
      let recordsForStaging: LessonRecord[] = [];
      if (chosenLessonIdsArray.length > 0) {
        const chosenSet = new Set(chosenLessonIdsArray);
        const filtered = allRecords.filter(
          (r) => chosenSet.has(r.id) || (r.notionPageId && chosenSet.has(r.notionPageId))
        );
        // Zapas na wypadek, gdyby import zapisał lekcję pod innym
        // identyfikatorem niż ID strony Notion — bierzemy tyle najnowszych,
        // ile lektor zaznaczył, zamiast pokazywać pusty staging.
        recordsForStaging =
          filtered.length > 0 ? filtered : allRecords.slice(0, chosenLessonIdsArray.length);
      }

      const stageItems: StagedLesson[] = recordsForStaging.map((rec) => {
        const blocks = extractLessonBlocks(rec);
        const isDateMissing = Boolean(rec.isDateMissing || !rec.date || /brak daty/i.test(rec.date));
        let cleanTopic = rec.topic || 'Lekcja bez tematu';
        if (/^Podsumowanie lekcji\s*—\s*brak daty\s*—\s*/i.test(cleanTopic)) {
          cleanTopic = cleanTopic.replace(/^Podsumowanie lekcji\s*—\s*brak daty\s*—\s*/i, '');
        }
        return {
          id: rec.id,
          date: rec.date || new Date().toISOString().split('T')[0],
          isDateMissing,
          pendingReason: rec.pendingReason || (isDateMissing ? 'Brak daty spotkania w Notion' : ''),
          topic: cleanTopic,
          approved: true,
          summary: blocks.summary || '',
          vocabulary: blocks.vocabulary || '',
          corrections: blocks.corrections || '',
          homework: blocks.homework || '',
          answerKey: blocks.answerKey || '',
          nextLesson: blocks.nextLesson || '',
          learningCurve: blocks.learningCurve || '',
          originalRecord: rec,
        };
      });

      setStagedLessons(stageItems);
      setActiveStagedIndex(0);

      // Przechodzimy do kroku weryfikacji i stagingu z kontrolą lektora
      setStep('staging');
    } catch (err: any) {
      console.error('Błąd podczas importu z Notion:', err);
      setErrorMsg(err?.message || 'Wystąpił błąd podczas importowania danych z Notion.');
      setStep('error');
    }
  };

  const updateActiveStaged = (fields: Partial<StagedLesson>) => {
    setStagedLessons((prev) =>
      prev.map((item, idx) => (idx === activeStagedIndex ? { ...item, ...fields } : item))
    );
  };

  const handleSaveStagedLessons = async () => {
    if (!selectedUser) return;
    setStep('saving_staged');
    setErrorMsg('');

    try {
      const batch = writeBatch(db);
      const approvedLessons = stagedLessons.filter((s) => s.approved);

      for (const staged of approvedLessons) {
        const recordRef = doc(db, `users/${selectedUser.id}/lessonRecords/${staged.id}`);
        const structuredBlocks = {
          summary: staged.summary,
          vocabulary: staged.vocabulary,
          corrections: staged.corrections,
          homework: staged.homework,
          answerKey: staged.answerKey,
          nextLesson: staged.nextLesson,
          learningCurve: staged.learningCurve,
        };

        const isDateMissing = Boolean(staged.isDateMissing && (!staged.date || /brak daty/i.test(staged.date)));
        const status = isDateMissing ? 'pending_confirmation' : 'confirmed';

        batch.update(recordRef, {
          date: staged.date,
          topic: staged.topic,
          isDateMissing,
          status,
          isPendingConfirmation: isDateMissing,
          pendingReason: isDateMissing ? 'Brak daty spotkania w Notion' : '',
          lessonSummary: staged.summary,
          vocabularyText: staged.vocabulary,
          corrections: staged.corrections,
          thingsToImprove: staged.corrections,
          homeworkText: staged.homework,
          homeworkAnswerKey: staged.answerKey || '',
          suggestedFollowUp: staged.nextLesson,
          nextLessonPlan: staged.nextLesson,
          studentSpeaking: staged.learningCurve,
          structuredBlocks: structuredBlocks,
          updatedAt: new Date().toISOString(),
        });
      }

      await batch.commit();

      // Generowanie zestawów słówek i fiszek dla zatwierdzonych lekcji
      for (const staged of approvedLessons) {
        if (staged.vocabulary && staged.vocabulary.trim().length > 0) {
          const vocabSetId = `vocab-${staged.id}`;
          const setRef = doc(db, `users/${selectedUser.id}/vocabularySets/${vocabSetId}`);

          await setDoc(
            setRef,
            {
              id: vocabSetId,
              studentId: selectedUser.id,
              lessonRecordId: staged.id,
              title: buildVocabularySetTitle(staged.date, staged.topic),
              date: staged.date,
              topic: staged.topic,
              vocabularyText: staged.vocabulary,
              approvedItems: splitVocabularyLines(staged.vocabulary),
              itemCount: countVocabularyItems(staged.vocabulary),
              status: 'ready',
              source: 'lesson_record',
              createdAt: staged.originalRecord.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              used: false,
            },
            { merge: true }
          );

          await syncFlashcardSetForLesson(
            staged.id,
            selectedUser.id,
            staged.date,
            staged.topic,
            staged.vocabulary
          );
        }
      }

      // Oznaczenie kursanta o nowej lekcji
      try {
        await updateDoc(doc(db, 'users', selectedUser.id), {
          hasNewLesson: true,
          hasNewVocabulary: true,
        });
      } catch (e) {
        console.warn('Nie udało się ustawić hasNewLesson:', e);
      }

      // Odświeżenie listy zaktualizowanych lekcji
      const finalRecords: LessonRecord[] = approvedLessons.map((s) => ({
        ...s.originalRecord,
        date: s.date,
        topic: s.topic,
        vocabularyText: s.vocabulary,
        lessonSummary: s.summary,
        corrections: s.corrections,
        homeworkText: s.homework,
        homeworkAnswerKey: s.answerKey,
        suggestedFollowUp: s.nextLesson,
        studentSpeaking: s.learningCurve,
      }));

      setRecentLessons(finalRecords);
      setStep('success');
      onSyncComplete?.();
    } catch (err: any) {
      console.error('Błąd zapisu zatwierdzonych lekcji:', err);
      setErrorMsg(err?.message || 'Nie udało się zapisać zatwierdzonych lekcji do bazy.');
      setStep('error');
    }
  };

  if (!isOpen || !selectedUser) return null;

  const studentName = `${selectedUser.firstName || ''} ${selectedUser.lastName || selectedUser.username}`.trim();
  const notionLessons = matchedStudent?.lessons || [];
  const notionLessonCount = matchedStudent ? matchedStudent.lessonCount : 0;

  const newLessonItems = notionLessons.filter(
    (l) => !isLessonAlreadyImported(l) && !isLessonRejected(l)
  );
  const newLessonsCount =
    notionLessons.length > 0
      ? newLessonItems.length
      : Math.max(0, notionLessonCount - localLessonCount);
  const importedLessonItemsCount = notionLessons.filter((l) => isLessonAlreadyImported(l)).length;

  const filteredNotionLessons = notionLessons.filter((l) => {
    if (lessonFilter === 'new') {
      if (isLessonAlreadyImported(l) || isLessonRejected(l)) return false;
    } else if (lessonFilter === 'already_imported') {
      if (!isLessonAlreadyImported(l)) return false;
    }
    if (lessonSearchTerm.trim()) {
      const q = normalize(lessonSearchTerm);
      const matchTopic = normalize(l.topic).includes(q);
      const matchDate = (l.date || '').toLowerCase().includes(q);
      if (!matchTopic && !matchDate) return false;
    }
    return true;
  });

  const activeStaged = stagedLessons[activeStagedIndex] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-white/10 bg-base-300 shadow-2xl overflow-hidden">
        {/* NAGŁÓWEK */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3 bg-base-200/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center shrink-0">
              <RefreshCw size={20} className={step === 'importing' || step === 'saving_staged' ? 'animate-spin' : ''} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base sm:text-lg flex items-center gap-2">
                {step === 'staging'
                  ? 'Weryfikacja podziału lekcji przez AI (Notion Staging)'
                  : 'Synchronizacja lekcji z Notion'}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                  AI Enhanced
                </span>
              </h3>
              <p className="text-xs text-content-muted">
                {step === 'staging'
                  ? 'Przejrzyj podział lekcji na bloki Notion i zatwierdź wpisy przed zapisaniem do historii.'
                  : `Kursant: ${studentName}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-content-muted hover:text-text-hi hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* ZAWARTOŚĆ OKNA */}
        <div className="p-5 overflow-y-auto flex-1">
          {/* 1. KROK SPRAWDZANIA */}
          {step === 'checking' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">Sprawdzam bazę danych Notion…</h4>
                <p className="text-xs text-content-muted max-w-sm">
                  Wyszukuję powiązane karty ucznia oraz sprawdzam, czy pojawiły się nowe lekcje do zaimportowania.
                </p>
              </div>
            </div>
          )}

          {/* 2. KROK BŁĘDU */}
          {step === 'error' && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Wystąpił problem podczas synchronizacji</h4>
                  <p className="text-xs text-danger/90 leading-relaxed">{errorMsg}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-white/10 text-xs font-semibold text-content-muted hover:text-text-hi"
                >
                  Zamknij
                </button>
                <button
                  type="button"
                  onClick={checkNotionDatabase}
                  className="px-4 py-2 rounded-xl bg-primary text-accent-ink font-bold text-xs hover:brightness-110 flex items-center gap-1.5"
                >
                  <RefreshCw size={14} />
                  Spróbuj ponownie
                </button>
              </div>
            </div>
          )}

          {/* 3. KROK WERYFIKACJI POWIĄZANIA */}
          {step === 'verification' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-base-200/90 border border-white/10 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-content-muted uppercase tracking-wider">
                    Dopasowana karta kursanta w Notion:
                  </span>
                  {matchedStudent?.matchedBy && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">
                      {MATCH_LABELS[matchedStudent.matchedBy]}
                    </span>
                  )}
                </div>

                {matchedStudent ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-base-100/60 border border-white/5">
                    <div>
                      <h4 className="font-extrabold text-white text-sm">{matchedStudent.name}</h4>
                      <p className="text-xs text-content-muted mt-0.5">
                        {matchedStudent.emails?.join(', ') || 'Brak zapisanego e-maila'}
                        {matchedStudent.level && ` • Poziom: ${matchedStudent.level}`}
                        {matchedStudent.company && ` • Firma: ${matchedStudent.company}`}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-base-300 text-xs font-mono font-bold text-primary border border-white/10 shrink-0">
                      {matchedStudent.lessonCount} lekcji w Notion
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-warn">
                      Nie dopasowano automatycznie karty. Wybierz ręcznie odpowiednią kartę z Notion:
                    </p>
                    <select
                      value={selectedNotionId}
                      onChange={(e) => handleSelectNotionCard(e.target.value)}
                      className="w-full text-xs font-semibold bg-base-200 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-primary"
                    >
                      {allStudents.map((s) => (
                        <option key={s.notionId} value={s.notionId}>
                          {s.name} ({s.lessonCount} lekcji) {s.emails?.[0] ? `· ${s.emails[0]}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Statystyki: Liczba lekcji w bazie Notion vs w Aplikacji */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-base-100/50 border border-white/8">
                  <span className="text-[11px] text-content-muted block font-medium">Baza Notion</span>
                  <span className="text-xl font-bold font-mono text-white mt-1 block">
                    {notionLessonCount}
                  </span>
                  <span className="text-[10px] text-content-muted">gotowych lekcji</span>
                </div>
                <div className="p-3 rounded-xl bg-base-100/50 border border-white/8">
                  <span className="text-[11px] text-content-muted block font-medium">W aplikacji</span>
                  <span className="text-xl font-bold font-mono text-content mt-1 block">
                    {localLessonCount}
                  </span>
                  <span className="text-[10px] text-content-muted">zapisanych wpisów</span>
                </div>
                <div className={`p-3 rounded-xl border ${newLessonsCount > 0 ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-base-100/50 border-white/8 text-content-muted'}`}>
                  <span className="text-[11px] block font-medium">Nowe lekcje</span>
                  <span className="text-xl font-bold font-mono mt-1 block">
                    {newLessonsCount > 0 ? `+${newLessonsCount}` : '0'}
                  </span>
                  <span className="text-[10px]">
                    {newLessonsCount > 0 ? 'czeka na import' : 'baza aktualna'}
                  </span>
                </div>
              </div>

              {/* Informacja o odrzuconych tematach z Notion */}
              {rejectedNotionLessons.length > 0 && (
                <div className="p-3 rounded-xl bg-base-100/60 border border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-content-muted">
                    <span>🛡️</span>
                    <span>
                      Odrzucone tematy z Notion: <strong className="text-white">{rejectedNotionLessons.length}</strong> (np. {rejectedNotionLessons.slice(0, 2).map(r => `„${r.topic}”`).join(', ')})
                    </span>
                  </div>
                  <span className="text-[10px] text-content-muted font-mono">Pominięte w synchronizacji</span>
                </div>
              )}

              {/* SEKCJA WYBORU LEKCJI DO IMPORTU */}
              {notionLessons.length > 0 && (
                <div className="p-4 rounded-2xl bg-base-200/90 border border-white/10 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <Layers size={16} className="text-primary" />
                        <h5 className="font-bold text-white text-sm">Wybór lekcji do zaimportowania</h5>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-primary/20 text-primary border border-primary/30">
                          Zaznaczono {selectedLessonIds.size} z {notionLessons.length}
                        </span>
                      </div>
                      <p className="text-xs text-content-muted mt-0.5 leading-relaxed">
                        Zaznacz tematy, które chcesz zsynchronizować. Wpisy oznaczone jako <strong className="text-white">Już w aplikacji</strong> możesz pominąć, aby nie powielać pracy.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={selectOnlyNewLessons}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Zaznacz tylko nowe lekcje"
                      >
                        <Sparkles size={13} />
                        Tylko nowe ({newLessonItems.length})
                      </button>
                      <button
                        type="button"
                        onClick={selectAllLessons}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-base-300 text-content-muted border border-white/10 hover:text-text-hi hover:bg-base-200 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <CheckSquare size={13} />
                        Wszystkie
                      </button>
                      <button
                        type="button"
                        onClick={deselectAllLessons}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-base-300 text-content-muted border border-white/10 hover:text-text-hi hover:bg-base-200 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Square size={13} />
                        Odznacz
                      </button>
                    </div>
                  </div>

                  {/* Wyszukiwarka i filtr zakładek */}
                  <div className="flex items-center gap-2 pt-1 flex-wrap sm:flex-nowrap">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                      <input
                        type="text"
                        value={lessonSearchTerm}
                        onChange={(e) => setLessonSearchTerm(e.target.value)}
                        placeholder="Szukaj po temacie lub dacie (np. Cybersecurity, 2026-09)..."
                        className="w-full bg-base-300 border border-white/10 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder:text-content-muted focus:outline-none focus:border-primary"
                      />
                      {lessonSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setLessonSearchTerm('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-text-hi cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 bg-base-300 p-1 rounded-xl border border-white/10 text-[11px] shrink-0">
                      <button
                        type="button"
                        onClick={() => setLessonFilter('all')}
                        className={`px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          lessonFilter === 'all' ? 'bg-base-100 text-white font-bold' : 'text-content-muted hover:text-text-hi'
                        }`}
                      >
                        Wszystkie ({notionLessons.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setLessonFilter('new')}
                        className={`px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          lessonFilter === 'new' ? 'bg-primary/20 text-primary font-bold' : 'text-content-muted hover:text-text-hi'
                        }`}
                      >
                        Nowe ({newLessonItems.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setLessonFilter('already_imported')}
                        className={`px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          lessonFilter === 'already_imported' ? 'bg-base-100 text-white font-bold' : 'text-content-muted hover:text-text-hi'
                        }`}
                      >
                        W aplikacji ({importedLessonItemsCount})
                      </button>
                    </div>
                  </div>

                  {/* Lista tematów lekcji z Notion */}
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-base-300/60 divide-y divide-white/5 custom-scrollbar">
                    {filteredNotionLessons.length === 0 ? (
                      lessonFilter === 'new' && newLessonsCount === 0 ? (
                        <div className="p-6 text-center space-y-1.5">
                          <CheckCircle2 size={22} className="mx-auto text-primary" />
                          <p className="text-xs font-bold text-white">
                            Baza jest aktualna — nie ma nic nowego do pobrania
                          </p>
                          <p className="text-[11px] text-content-muted">
                            Wszystkie {notionLessons.length} lekcji z Notion są już w historii kursanta.
                            Przełącz na „Wszystkie”, jeśli chcesz obejrzeć zaimportowane wpisy.
                          </p>
                        </div>
                      ) : (
                        <div className="p-6 text-center text-xs text-content-muted">
                          Brak tematów spełniających wybrane kryteria.
                        </div>
                      )
                    ) : (
                      filteredNotionLessons.map((lesson) => {
                        const isSelected = selectedLessonIds.has(lesson.id);
                        const isAlreadyIn = isLessonAlreadyImported(lesson);
                        const isRej = isLessonRejected(lesson);

                        return (
                          <div
                            key={lesson.id}
                            onClick={() => toggleLessonSelection(lesson.id)}
                            className={`p-2.5 sm:p-3 flex items-center justify-between gap-3 hover:bg-white/[0.04] transition-colors cursor-pointer select-none ${
                              isSelected ? 'bg-primary/[0.07]' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="shrink-0 mt-0.5">
                                {isSelected ? (
                                  <CheckSquare size={17} className="text-primary" />
                                ) : (
                                  <Square size={17} className="text-content-muted hover:text-text-hi" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {lesson.isDateMissing ? (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      ⚠️ Brak daty w Notion
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-base-200 text-content-muted border border-white/5">
                                      📅 {lesson.date}
                                    </span>
                                  )}
                                  <span className="text-xs font-bold text-white truncate max-w-sm sm:max-w-md">
                                    {lesson.topic}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isRej ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-danger/20 text-danger border border-danger/30">
                                  🛡️ Odrzucona w Recall
                                </span>
                              ) : isAlreadyIn ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-content-muted border border-white/10">
                                  💾 Już w aplikacji
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">
                                  ✨ Nowa w Notion
                                </span>
                              )}
                              {lesson.url && (
                                <a
                                  href={lesson.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 text-content-muted hover:text-text-hi transition-colors"
                                  title="Otwórz stronę w Notion"
                                >
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Weryfikacja zgodności z Wytycznymi AI */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2.5 text-xs">
                <h5 className="font-bold text-primary flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                  <Sparkles size={14} />
                  Wytyczne AI dotyczące podziału na Bloki Notion
                </h5>
                <ul className="space-y-1.5 text-content-muted leading-relaxed">
                  <li className="flex items-start gap-2">
                    <Check size={14} className="text-primary shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Podział na 4 Bloki:</strong> Lekcja w skrócie (1), Słownictwo & Korekty (2), Zadania domowe (3) oraz Następna lekcja (4).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={14} className="text-primary shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Elastyczność i kontrola lektora:</strong> Po pobraniu lekcji zobaczysz podsumowanie, w którym możesz dowolnie modyfikować treść każdego bloku przed zatwierdzeniem.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Przyciski akcji */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-content-muted hover:text-text-hi transition-colors"
                >
                  Anuluj
                </button>

                <button
                  type="button"
                  onClick={handleRunImport}
                  disabled={
                    !selectedNotionId ||
                    (notionLessons.length > 0 && selectedLessonIds.size === 0)
                  }
                  className="px-5 py-2.5 rounded-xl bg-primary text-accent-ink font-bold text-xs hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_0_20px_rgba(114,240,180,0.3)] transition-all cursor-pointer"
                >
                  <Sparkles size={14} />
                  {notionLessons.length > 0
                    ? selectedLessonIds.size > 0
                      ? `Importuj nowe lekcje (${selectedLessonIds.size})`
                      : newLessonsCount === 0
                      ? 'Brak nowych lekcji do importu'
                      : 'Zaznacz lekcje do importu'
                    : 'Pobierz i przejdź do weryfikacji bloków'}
                </button>
              </div>
            </div>
          )}

          {/* 4. KROK IMPORTOWANIA / POBIERANIA Z NOTION */}
          {step === 'importing' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">Pobieram i analizuję lekcje z Notion…</h4>
                <p className="text-xs text-content-muted max-w-md">
                  Odczytuję zawartość stron, dopasowuję bloki według wytycznych AI i przygotowuję zestawienie do zatwierdzenia przez lektora.
                </p>
              </div>
            </div>
          )}

          {/* 5. KROK STAGINGU I WERYFIKACJI AI (KONTROLA LEKTORA) */}
          {step === 'staging' && activeStaged && (
            <div className="space-y-5">
              {/* Pasek zakładek poszczególnych lekcji pobranych z Notion */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {stagedLessons.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveStagedIndex(idx)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-2 transition-all cursor-pointer border ${
                      idx === activeStagedIndex
                        ? 'bg-primary/20 border-primary text-primary shadow-sm'
                        : 'bg-base-200/60 border-white/5 text-content-muted hover:text-text-hi hover:bg-base-200'
                    }`}
                  >
                    <span className="font-mono text-[10px]">#{idx + 1}</span>
                    <span className="max-w-[120px] truncate">{item.topic}</span>
                    {item.isDateMissing && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Brak daty w Notion" />
                    )}
                    {item.approved ? (
                      <CheckCircle2 size={12} className="text-primary shrink-0" />
                    ) : (
                      <X size={12} className="text-danger shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              {/* Formularz edycji i zatwierdzania aktywnej lekcji */}
              <div className="p-4 rounded-2xl bg-base-200/80 border border-white/10 space-y-4">
                {/* Górny pasek lekcji: Data, Temat, Checkbox zatwierdzenia */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className={`text-[10px] font-mono font-bold uppercase block mb-1 flex items-center gap-1.5 ${
                        activeStaged.isDateMissing ? 'text-amber-300' : 'text-content-muted'
                      }`}>
                        📅 Data lekcji
                        {activeStaged.isDateMissing && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            ⚠️ brak w Notion
                          </span>
                        )}
                      </label>
                      <input
                        type="date"
                        value={activeStaged.date}
                        onChange={(e) => updateActiveStaged({ date: e.target.value, isDateMissing: false })}
                        className={`w-full bg-base-300 border rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none ${
                          activeStaged.isDateMissing ? 'border-amber-500/60 bg-amber-950/25' : 'border-white/10 focus:border-primary'
                        }`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-mono font-bold uppercase text-content-muted block mb-1">
                        🏷️ Temat lekcji
                      </label>
                      <input
                        type="text"
                        value={activeStaged.topic}
                        onChange={(e) => updateActiveStaged({ topic: e.target.value })}
                        className="w-full bg-base-300 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => updateActiveStaged({ approved: !activeStaged.approved })}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                        activeStaged.approved
                          ? 'bg-primary/15 text-primary border-primary/30'
                          : 'bg-base-300 text-content-muted border-white/10'
                      }`}
                    >
                      {activeStaged.approved ? <CheckSquare size={14} /> : <Square size={14} />}
                      {activeStaged.approved ? 'Zatwierdzona do importu' : 'Pomiń tę lekcję'}
                    </button>
                  </div>
                </div>

                {/* Edycja 4 Bloków Notion */}
                <div className="space-y-3.5">
                  {/* BLOK 1 */}
                  <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        BLOK 1
                      </span>
                      <label className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                        <BookOpen size={13} /> Lekcja w skrócie (Streszczenie i przebieg)
                      </label>
                    </div>
                    <textarea
                      rows={3}
                      value={activeStaged.summary}
                      onChange={(e) => updateActiveStaged({ summary: e.target.value })}
                      placeholder="Główne zagadnienia poruszone na lekcji..."
                      className="w-full bg-base-300/80 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-400 leading-relaxed resize-y"
                    />
                  </div>

                  {/* BLOK 2 */}
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        BLOK 2
                      </span>
                      <label className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <Sparkles size={13} /> Key Language & Corrections
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <span className="text-[11px] font-bold text-emerald-400 block mb-1">
                          📚 Słownictwo (angielski - polski):
                        </span>
                        <textarea
                          rows={4}
                          value={activeStaged.vocabulary}
                          onChange={(e) => updateActiveStaged({ vocabulary: e.target.value })}
                          placeholder="word - słowo..."
                          className="w-full bg-base-300/80 border border-white/10 rounded-lg p-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-400 leading-relaxed resize-y"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-emerald-400 block mb-1">
                          ⚠️ Korekty językowe & wymowa:
                        </span>
                        <textarea
                          rows={4}
                          value={activeStaged.corrections}
                          onChange={(e) => updateActiveStaged({ corrections: e.target.value })}
                          placeholder="Błędy, wymowa, reguły..."
                          className="w-full bg-base-300/80 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-400 leading-relaxed resize-y"
                        />
                      </div>
                    </div>
                  </div>

                  {/* BLOK 3 */}
                  <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        BLOK 3
                      </span>
                      <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <ListChecks size={13} /> Homework — Cribro Habit (Zadania domowe)
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <span className="text-[11px] font-bold text-amber-400 block mb-1">
                          📝 Zdania do tłumaczenia / Treść zadania:
                        </span>
                        <textarea
                          rows={4}
                          value={activeStaged.homework}
                          onChange={(e) => updateActiveStaged({ homework: e.target.value })}
                          placeholder="1. Zdanie do przetłumaczenia..."
                          className="w-full bg-base-300/80 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-400 leading-relaxed resize-y"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-amber-400 block mb-1">
                          🔑 Klucz odpowiedzi (Answer Key):
                        </span>
                        <textarea
                          rows={4}
                          value={activeStaged.answerKey}
                          onChange={(e) => updateActiveStaged({ answerKey: e.target.value })}
                          placeholder="1. Prawidłowa wersja..."
                          className="w-full bg-base-300/80 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-400 leading-relaxed resize-y"
                        />
                      </div>
                    </div>
                  </div>

                  {/* BLOK 4 & LEARNING CURVE */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/20 p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                          BLOK 4
                        </span>
                        <label className="text-xs font-bold text-yellow-300 flex items-center gap-1.5">
                          <Target size={13} /> Next Lesson (Plany)
                        </label>
                      </div>
                      <textarea
                        rows={2}
                        value={activeStaged.nextLesson}
                        onChange={(e) => updateActiveStaged({ nextLesson: e.target.value })}
                        placeholder="Cele i materiał na kolejne spotkanie..."
                        className="w-full bg-base-300/80 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-yellow-400 leading-relaxed resize-y"
                      />
                    </div>

                    <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          CURVE
                        </span>
                        <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                          <Activity size={13} /> O czym mówił kursant
                        </label>
                      </div>
                      <textarea
                        rows={2}
                        value={activeStaged.learningCurve}
                        onChange={(e) => updateActiveStaged({ learningCurve: e.target.value })}
                        placeholder="Kontekst, wypowiedzi, dynamika kursanta..."
                        className="w-full bg-base-300/80 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-400 leading-relaxed resize-y"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dolny pasek zatwierdzania */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setStep('verification')}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-content-muted hover:text-text-hi"
                >
                  Wróć do wyboru
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-content-muted mr-2">
                    Zatwierdzono {stagedLessons.filter((s) => s.approved).length} z {stagedLessons.length} lekcji
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveStagedLessons}
                    disabled={stagedLessons.filter((s) => s.approved).length === 0}
                    className="px-6 py-2.5 rounded-xl bg-primary text-accent-ink font-bold text-xs hover:brightness-110 transition-all flex items-center gap-2 shadow-btn disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 size={15} />
                    <span>Zatwierdź i zapisz lekcje do historii</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 6. KROK ZAPISU ZATWIERDZONYCH LEKCJI */}
          {step === 'saving_staged' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">Zapisuję zatwierdzone lekcje do historii…</h4>
                <p className="text-xs text-content-muted max-w-sm">
                  Aktualizuję rekordy w bazie, tworzę zestawy słownictwa oraz generuję fiszki dla kursanta.
                </p>
              </div>
            </div>
          )}

          {/* 7. KROK SUKCESU */}
          {step === 'success' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 text-primary flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-white">
                    Lekcje zostały pomyślnie zsynchronizowane i zapisane!
                  </h4>
                  <p className="text-xs text-content-muted leading-relaxed">
                    Zatwierdzone lekcje dla kursanta{' '}
                    <strong className="text-white">{studentName}</strong> zostały podzielone na czyste bloki Notion i są natychmiast gotowe do generowania zadań domowych oraz ćwiczeń.
                  </p>
                </div>
              </div>

              {/* Podsumowanie raportu */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-base-100/50 border border-white/8 text-center">
                  <span className="text-[11px] text-content-muted block">Zatwierdzone lekcje</span>
                  <span className="text-xl font-bold font-mono text-primary mt-0.5 block">
                    {recentLessons.length}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-base-100/50 border border-white/8 text-center">
                  <span className="text-[11px] text-content-muted block">Format bloków Notion</span>
                  <span className="text-sm font-bold text-primary mt-1 block">
                    100% Czysty
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-base-100/50 border border-white/8 text-center col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-content-muted block">Zestawy do ćwiczeń</span>
                  <span className="text-sm font-bold text-primary mt-1 block">Aktywne ✨</span>
                </div>
              </div>

              {/* Podgląd ostatnich lekcji */}
              {recentLessons.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-bold text-content-muted uppercase tracking-wider block">
                    Zapisane lekcje w historii:
                  </span>
                  <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                    {recentLessons.map((l) => (
                      <div
                        key={l.id}
                        className="p-3 rounded-xl bg-base-100/60 border border-white/8 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-primary font-bold">{l.date}</span>
                            <span className="font-bold text-white truncate">{l.topic}</span>
                          </div>
                          {l.vocabularyText && (
                            <p className="text-[11px] text-content-muted truncate mt-0.5 font-mono">
                              {l.vocabularyText.split('\n')[0]}
                            </p>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                          Zatwierdzona ✓
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-primary text-accent-ink font-bold text-xs hover:brightness-110 transition-all shadow-btn cursor-pointer"
                >
                  Zamknij okno
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentNotionSyncModal;
