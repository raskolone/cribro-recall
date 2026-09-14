import { db } from '../firebase';
import { doc, setDoc, collection, getDocs, query, orderBy, where, serverTimestamp, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { LessonRecord, RejectedNotionItem, VocabularySet } from '../types';
import { findExistingDuplicate } from '../utils/lessonDuplicates';
import { buildVocabularySetTitle, countVocabularyItems, getApprovedVocabularyText, splitVocabularyLines } from '../utils/vocabulary';

export function parseVocabularyTextToCards(vocabularyText: string) {
  if (!vocabularyText) return [];
  const lines = vocabularyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  return lines.map((line, idx) => {
    let term = line;
    let definition = '';
    if (line.includes(' - ')) {
      const parts = line.split(' - ');
      term = parts[0].trim();
      definition = parts.slice(1).join(' - ').trim();
    } else if (line.includes(' – ')) {
      const parts = line.split(' – ');
      term = parts[0].trim();
      definition = parts.slice(1).join(' – ').trim();
    } else if (line.includes(' — ')) {
      // Myślnik em: tym separatorem zapisuje słownictwo skill „Meeting Summary”
      // w Notion, więc bez tej gałęzi każda zaimportowana pozycja trafiałaby
      // do bazy jako termin bez tłumaczenia.
      const parts = line.split(' — ');
      term = parts[0].trim();
      definition = parts.slice(1).join(' — ').trim();
    } else if (line.includes(':')) {
      const parts = line.split(':');
      term = parts[0].trim();
      definition = parts.slice(1).join(':').trim();
    } else if (line.includes('=')) {
      const parts = line.split('=');
      term = parts[0].trim();
      definition = parts.slice(1).join('=').trim();
    }
    return {
      position: idx,
      term,
      definition,
      termLanguage: 'English',
      definitionLanguage: 'Polish'
    };
  });
}

export async function syncFlashcardSetForLesson(
  lessonRecordId: string,
  studentId: string,
  date: string,
  topic: string,
  vocabularyText: string
) {
  if (!vocabularyText || vocabularyText.trim().length === 0) {
    return;
  }

  try {
    const flashcardSetId = `set-lesson-${lessonRecordId}`;
    const cards = parseVocabularyTextToCards(vocabularyText);
    const title = buildVocabularySetTitle(date, topic);

    const flashcardSetRef = doc(db, `sets/${flashcardSetId}`);
    await setDoc(flashcardSetRef, {
      userId: studentId,
      title: title,
      description: `Słownictwo z lekcji: ${date}`,
      isPublic: false,
      cardCount: cards.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      assignedByTeacher: true,
      isLessonVocabulary: true,
      lessonTopic: topic,
      lessonDate: date
    }, { merge: true });

    // Re-create the subcollection cards by deleting old ones and writing new ones
    const cardsRef = collection(db, `sets/${flashcardSetId}/flashcards`);
    const existingSnapshot = await getDocs(cardsRef);
    const batch = writeBatch(db);
    
    // Delete existing cards
    existingSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    // Add new cards
    cards.forEach((card, index) => {
      const cardRef = doc(db, `sets/${flashcardSetId}/flashcards/card-${index}`);
      batch.set(cardRef, card);
    });

    await batch.commit();
    console.log(`Successfully synced flashcard set for lesson ${lessonRecordId}`);
  } catch (e) {
    console.warn("Could not sync flashcard set for lesson:", e);
  }
}

/**
 * Czy ta lekcja już u kursanta jest.
 *
 * Wołane PRZED zapisem. Import z Notion nadaje każdemu wpisowi nowy
 * identyfikator, więc powtórzona synchronizacja nie nadpisuje niczego —
 * dokłada bliźniaka. Jedno sprawdzenie tutaj kosztuje jeden odczyt kolekcji
 * i oszczędza sprzątanie całej historii.
 */
export async function findDuplicateLessonRecord(
  studentId: string,
  candidate: { topic?: string; date?: string }
): Promise<LessonRecord | null> {
  try {
    const existing = await getLessonRecordsForStudent(studentId);
    return findExistingDuplicate(existing, candidate);
  } catch (err: any) {
    // Brak odczytu nie może blokować zapisu lekcji — w najgorszym razie
    // powstanie duplikat, który lektor usunie ręcznie.
    console.warn('[Lekcje] Nie udało się sprawdzić duplikatów:', err?.message || err);
    return null;
  }
}

export async function createLessonRecordWithVocabularySet(input: {
  studentId: string;
  date: string;
  topic: string;
  vocabularyText: string;
  lessonSummary?: string;
  studentSpeaking?: string;
  thingsToImprove?: string;
  suggestedFollowUp?: string;
  /*
   * ── BLOKI 2b–4 WPROST, A NIE DO WYŁUSKANIA ──
   *
   * Do tej pory wpis mógł przyjechać tylko w siedmiu polach, więc korekty
   * i praca domowa musiały jechać DOKLEJONE do `thingsToImprove` pod
   * znacznikiem „Zadanie domowe:", a `extractLessonBlocks` rozcinał je
   * z powrotem po wyrażeniu regularnym. Działa to dla starych wpisów
   * z Notion, bo tam nie ma wyboru — ale świadome ZAPISYWANIE danych
   * w formacie, który zaraz trzeba parsować, robi nowy dług przy każdej
   * lekcji wygenerowanej z transkrypcji.
   *
   * Kto zna bloki (AI z transkrypcji, formularz lektora), podaje je wprost.
   * Kto ich nie zna (stary import), nadal podaje `thingsToImprove` i nic
   * się dla niego nie zmienia.
   */
  corrections?: string;
  homeworkText?: string;
  homeworkAnswerKey?: string;
  nextLessonPlan?: string;
  scenarioId?: string;
  scenarioTopic?: string;
  scenarioContent?: string;
  /** Pozycje zatwierdzone do powtórek. Pominięcie = cały `vocabularyText`. */
  approvedItems?: string[];
  /**
   * Pominięcie sprawdzania duplikatów. Domyślnie sprawdzamy — świadomie
   * zapisana druga lekcja o tym samym tytule tego samego dnia zdarza się
   * znacznie rzadziej niż powtórzony import.
   */
  allowDuplicate?: boolean;
}): Promise<{ lessonRecordId: string; vocabularySetId: string; duplicateOf?: string }> {
  /*
   * ══ ZAPORA NA DUPLIKATY ══
   *
   * Ten sam temat tego samego dnia u tego samego kursanta to w tej aplikacji
   * zawsze powtórzony import — lektor nie prowadzi dwóch takich samych lekcji
   * jednego dnia. Zamiast zakładać bliźniaka, zwracamy identyfikator wpisu,
   * który już jest; wołający wie wtedy, że nic nie doszło, i może o tym
   * powiedzieć zamiast udawać sukces.
   */
  if (!input.allowDuplicate) {
    const duplicate = await findDuplicateLessonRecord(input.studentId, {
      topic: input.topic,
      date: input.date,
    });
    if (duplicate) {
      console.warn(
        `[Lekcje] Pominięto duplikat „${input.topic}" (${input.date}) — istnieje już ${duplicate.id}.`
      );
      return {
        lessonRecordId: duplicate.id,
        vocabularySetId: duplicate.vocabularySetId || '',
        duplicateOf: duplicate.id,
      };
    }
  }

  // Generate IDs
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const lessonRecordId = `lesson-${Date.now()}-${randomSuffix}`;
  const vocabularySetId = `vocab-${Date.now()}-${randomSuffix}`;
  const now = new Date().toISOString();

  const title = buildVocabularySetTitle(input.date, input.topic);

  // 1. Create LessonRecord object
  const lessonRecord: LessonRecord = {
    id: lessonRecordId,
    studentId: input.studentId,
    date: input.date,
    topic: input.topic,
    vocabularyText: input.vocabularyText,
    lessonSummary: input.lessonSummary,
    studentSpeaking: input.studentSpeaking,
    thingsToImprove: input.thingsToImprove,
    suggestedFollowUp: input.suggestedFollowUp,
    corrections: input.corrections,
    homeworkText: input.homeworkText,
    homeworkAnswerKey: input.homeworkAnswerKey,
    nextLessonPlan: input.nextLessonPlan,
    vocabularySetId: vocabularySetId,
    scenarioId: input.scenarioId,
    scenarioTopic: input.scenarioTopic,
    scenarioContent: input.scenarioContent,
    createdAt: now,
    updatedAt: now,
  };

  // 2. Create VocabularySet object with used: false
  const vocabularySet: VocabularySet = {
    id: vocabularySetId,
    studentId: input.studentId,
    lessonRecordId: lessonRecordId,
    title: title,
    date: input.date,
    topic: input.topic,
    vocabularyText: input.vocabularyText,
    approvedItems: input.approvedItems ?? splitVocabularyLines(input.vocabularyText),
    itemCount: countVocabularyItems(input.vocabularyText),
    status: 'draft',
    source: 'lesson_record',
    createdAt: now,
    updatedAt: now,
    used: false,
  };

  // 3. Save both to Firestore
  const recordRef = doc(db, `users/${input.studentId}/lessonRecords/${lessonRecordId}`);
  const setRef = doc(db, `users/${input.studentId}/vocabularySets/${vocabularySetId}`);

  const { id: _rId, ...recordData } = lessonRecord;
  const { id: _sId, ...setData } = vocabularySet;

  await setDoc(recordRef, recordData);
  await setDoc(setRef, setData);

  // Mark student user record as having a new lesson & new vocabulary for notification popups & badges
  try {
    await updateDoc(doc(db, 'users', input.studentId), {
      hasNewLesson: true,
      hasNewVocabulary: true
    });
  } catch (e) {
    console.warn("Could not set hasNewLesson on user doc:", e);
  }

  // 4. Extract vocabulary as a dedicated FlashcardSet
  if (input.vocabularyText && input.vocabularyText.trim().length > 0) {
    await syncFlashcardSetForLesson(
      lessonRecordId,
      input.studentId,
      input.date,
      input.topic,
      getApprovedVocabularyText({
        vocabularyText: input.vocabularyText,
        approvedItems: input.approvedItems,
      })
    );
  }

  return { lessonRecordId, vocabularySetId };
}

export async function getLessonRecordsForStudent(studentId: string): Promise<LessonRecord[]> {
  const recordsRef = collection(db, `users/${studentId}/lessonRecords`);
  const q = query(recordsRef, orderBy('date', 'desc'));
  
  const snapshot = await getDocs(q);
  const records: LessonRecord[] = [];
  
  snapshot.forEach((doc) => {
    records.push({ id: doc.id, ...doc.data() } as LessonRecord);
  });
  
  return records;
}

export async function getVocabularySetsForStudent(studentId: string): Promise<VocabularySet[]> {
  const setsRef = collection(db, `users/${studentId}/vocabularySets`);
  const q = query(setsRef, orderBy('date', 'desc'));
  
  const snapshot = await getDocs(q);
  let sets: VocabularySet[] = [];
  
  snapshot.forEach((doc) => {
    sets.push({ id: doc.id, ...doc.data() } as VocabularySet);
  });
  
  // Backward compatibility: fetch old lessonRecords that don't have a corresponding vocabularySet
  const recordsRef = collection(db, `users/${studentId}/lessonRecords`);
  const qRecords = query(recordsRef, orderBy('date', 'desc'));
  const recordsSnapshot = await getDocs(qRecords);
  
  recordsSnapshot.forEach((docSnap) => {
    const record = { id: docSnap.id, ...docSnap.data() } as LessonRecord;
    // Check if this record has vocabulary but doesn't have a corresponding vocabulary set
    if (record.vocabularyText && record.vocabularyText.trim().length > 0) {
       const alreadyExists = sets.some(s => s.lessonRecordId === record.id || s.date === record.date && s.topic === record.topic);
       if (!alreadyExists) {
          sets.push({
            id: `generated-${record.id}`,
            studentId: record.studentId,
            lessonRecordId: record.id,
            title: buildVocabularySetTitle(record.date, record.topic),
            date: record.date,
            topic: record.topic,
            vocabularyText: record.vocabularyText,
            itemCount: countVocabularyItems(record.vocabularyText),
            status: 'ready',
            source: 'lesson_record',
            createdAt: record.createdAt || record.date,
            updatedAt: record.updatedAt || record.date
          });
       }
    }
  });
  
  // Sort by date descending again after merging
  sets.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return sets;
}

export async function markVocabularySetAsUsed(studentId: string, setId: string): Promise<void> {
  if (!setId || setId.startsWith('generated-')) {
    return;
  }
  try {
    const setRef = doc(db, `users/${studentId}/vocabularySets/${setId}`);
    await updateDoc(setRef, { used: true });
  } catch (err) {
    console.error("Failed to mark vocabulary set as used:", err);
  }
}

export async function deleteLessonRecord(studentId: string, lessonRecord: LessonRecord): Promise<void> {
  const recordId = lessonRecord.id;
  const vocabId = lessonRecord.vocabularySetId;

  // 1. Delete lesson record
  const recordRef = doc(db, `users/${studentId}/lessonRecords/${recordId}`);
  await deleteDoc(recordRef);

  // 2. Delete vocabulary set if it exists
  if (vocabId) {
    const setRef = doc(db, `users/${studentId}/vocabularySets/${vocabId}`);
    await deleteDoc(setRef);
  }

  // 3. Delete flashcard set if it exists
  const flashcardSetId = `set-lesson-${recordId}`;
  const flashcardSetRef = doc(db, `sets/${flashcardSetId}`);
  await deleteDoc(flashcardSetRef);
}

/**
 * Odrzuca błędny/niechciany wpis z Notion:
 * 1. Usuwa go z aktywnych lekcji kursanta (wraz z ewentualnymi fiszkami/zestawami)
 * 2. Zapisuje informację o odrzuceniu w subkolekcji `rejectedNotionLessons`,
 *    dzięki czemu kolejne synchronizacje Notion nie zaimportują go ponownie.
 */
export async function rejectNotionLesson(
  studentId: string,
  lessonRecord: LessonRecord,
  reason: string = 'Odrzucono przez nauczyciela (manualny przegląd)'
): Promise<void> {
  // 1. Usuwamy rekord z bazy
  await deleteLessonRecord(studentId, lessonRecord);

  // 2. Zapisujemy wpis na czarnej liście odrzuconych Notion dla tego kursanta
  const rejectedId = lessonRecord.notionPageId || lessonRecord.id;
  const rejectedRef = doc(db, `users/${studentId}/rejectedNotionLessons/${rejectedId}`);

  const rejectedItem: RejectedNotionItem = {
    id: rejectedId,
    studentId,
    topic: lessonRecord.topic,
    date: lessonRecord.date,
    rejectedAt: new Date().toISOString(),
    reason,
  };

  await setDoc(rejectedRef, rejectedItem);
}

/**
 * Przywraca odrzucony wpis z Notion — usuwa z czarnej listy,
 * umożliwiając ponowne zaimportowanie przy kolejnej synchronizacji.
 */
export async function restoreRejectedNotionLesson(
  studentId: string,
  rejectedId: string
): Promise<void> {
  const rejectedRef = doc(db, `users/${studentId}/rejectedNotionLessons/${rejectedId}`);
  await deleteDoc(rejectedRef);
}

/**
 * Pobiera listę odrzuconych wpisów Notion dla kursanta.
 */
export async function getRejectedNotionLessons(studentId: string): Promise<RejectedNotionItem[]> {
  try {
    const ref = collection(db, `users/${studentId}/rejectedNotionLessons`);
    let snap;
    try {
      snap = await getDocs(query(ref, orderBy('rejectedAt', 'desc')));
    } catch {
      snap = await getDocs(ref);
    }
    const list: RejectedNotionItem[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as RejectedNotionItem);
    });
    return list;
  } catch (e) {
    console.warn(`Nie udało się pobrać odrzuconych lekcji dla ${studentId}:`, e);
    return [];
  }
}

/**
 * Manualne zatwierdzenie lekcji przez nauczyciela:
 * Przestawia status na 'confirmed', zdejmuje flagę 'isPendingConfirmation',
 * aktualizuje podane pola (np. poprawną datę, poprawione bloki)
 * oraz generuje/aktualizuje zestaw fiszek.
 */
export async function confirmPendingLesson(
  studentId: string,
  lessonId: string,
  updates: Partial<LessonRecord>
): Promise<void> {
  const recordRef = doc(db, `users/${studentId}/lessonRecords/${lessonId}`);

  const payload: Partial<LessonRecord> & Record<string, any> = {
    ...updates,
    status: 'confirmed',
    isPendingConfirmation: false,
    isDateMissing: false,
    pendingReason: '',
    updatedAt: new Date().toISOString(),
  };

  await updateDoc(recordRef, payload);

  // Jeśli lekcja ma słownictwo, generujemy zestaw fiszek
  if (updates.vocabularyText && updates.vocabularyText.trim().length > 0) {
    const targetDate = updates.date || new Date().toISOString().split('T')[0];
    const targetTopic = updates.topic || 'Lekcja';

    await syncFlashcardSetForLesson(
      lessonId,
      studentId,
      targetDate,
      targetTopic,
      updates.vocabularyText
    );
  }

  try {
    await updateDoc(doc(db, 'users', studentId), {
      hasNewLesson: true,
      hasNewVocabulary: true,
    });
  } catch (e) {
    console.warn('Could not update user notification badge:', e);
  }
}


