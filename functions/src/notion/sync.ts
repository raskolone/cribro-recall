import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as logger from 'firebase-functions/logger';

import { DATABASE_ID, NOTION_LESSONS_DB, NOTION_STUDENTS_DB } from '../config';
import { NotionPage, pageToText, queryDatabase } from './client';
import { parseLessonSummary } from './parse';

/**
 * Synchronizacja Notion → aplikacja, w dwóch krokach.
 *
 * Pierwszy krok tylko patrzy: czyta właściwości stron i mówi, kto jest w Notion,
 * kto ma już konto i ile lekcji na niego czeka. Drugi importuje to, co lektor
 * zaznaczy. Podział nie jest kosmetyczny — jednym przebiegiem przez wszystkie
 * lekcje naraz przekraczaliśmy czas oczekiwania przeglądarki, bo treść każdej
 * lekcji to osobne zapytanie do Notion.
 *
 * Ruch idzie wyłącznie w jedną stronę: Notion jest źródłem prawdy i kopią
 * zapasową lektora, aplikacja tylko czyta. Ponowny import jest bezpieczny, bo
 * dokument lekcji ma identyfikator strony Notion jako własny klucz.
 */

/** Adresy, pod które nic nie dojdzie — te same, co w powiadomieniach. */
const isRealEmail = (email: string): boolean =>
  !!email && email.includes('@') && !email.endsWith('@student.vocabboost.com');

/**
 * Sprowadza tekst do postaci porównywalnej.
 *
 * `normalize('NFD')` rozkłada litery z kreskami i ogonkami na znak bazowy plus
 * znak łączący, ale nie dotyczy przekreślonego Ł — to osobna litera alfabetu,
 * a nie L z ozdobnikiem. Bez jawnej podmiany „Bartłomiej” nie równałby się
 * zapisowi „Bartlomiej”, który trafia do bazy przy kontach zakładanych ręcznie
 * albo z klawiatury bez polskich znaków.
 *
 * Białe znaki zwijamy z tego samego powodu: podwójna spacja w nazwie karty nie
 * może decydować o tym, czy kursant zostanie rozpoznany.
 */
const normalize = (value: string): string =>
  (value || '')
    .toString()
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Rozdziela „Poziom / profil" na krótki poziom i pełną notatkę.
 *
 * W Notion to jedno pole tekstowe i lektor trzyma w nim wszystko naraz:
 * „B1 Final — wtorki i czwartki 7:30–8:30; start 08.09.2026". W aplikacji
 * poziom jest plakietką obok nazwiska, więc całe zdanie rozpychało wiersz
 * listy i wypychało z niego imię. Do plakietki bierzemy wyłącznie oznaczenie
 * CEFR z początku tekstu, resztę zostawiamy w opisie kursanta, gdzie i tak
 * trafia do kontekstu dla modelu.
 *
 * Gdy tekst nie zaczyna się od poziomu — „Grupa mieszana…", „Nowa kursantka…" —
 * plakietka zostaje pusta. Lepiej jej nie mieć niż wpisać w nią zdanie.
 */
export const splitLevel = (raw: string): { level: string; profile: string } => {
  const profile = (raw || '').trim();
  const match = profile.match(
    /^\s*([ABC][12]\s*\+?(?:\s*\/\s*[ABC][12]\s*\+?)?)/i
  );
  const level = match ? match[1].replace(/\s+/g, '').toUpperCase() : '';
  return { level, profile };
};

/** Wartość właściwości Notion jako tekst, niezależnie od jej typu. */
const propText = (page: NotionPage, name: string): string => {
  const prop = page.properties?.[name];
  if (!prop) return '';
  switch (prop.type) {
    case 'title':
    case 'rich_text':
      return (prop[prop.type] || []).map((p: any) => p.plain_text || '').join('').trim();
    case 'select':
      return prop.select?.name || '';
    case 'multi_select':
      return (prop.multi_select || []).map((o: any) => o.name).join(', ');
    case 'date':
      return prop.date?.start || '';
    case 'email':
      return prop.email || '';
    default:
      return '';
  }
};

const propRelationIds = (page: NotionPage, name: string): string[] => {
  const prop = page.properties?.[name];
  if (prop?.type !== 'relation') return [];
  return (prop.relation || []).map((r: any) => r.id).filter(Boolean);
};

const propEmails = (page: NotionPage, name: string): string[] => {
  const prop = page.properties?.[name];
  if (prop?.type === 'multi_select') {
    return (prop.multi_select || []).map((o: any) => (o.name || '').trim()).filter(Boolean);
  }
  const single = propText(page, name).trim();
  return single ? [single] : [];
};

/** Jak konto zostało rozpoznane — lektor widzi to przy każdej pozycji. */
export type MatchReason = 'notion' | 'email' | 'name' | 'username';

export interface NotionLessonItem {
  id: string;
  topic: string;
  date: string;
  isDateMissing?: boolean;
  url?: string;
  lastEditedTime?: string;
}

export interface StudentPreview {
  notionId: string;
  name: string;
  emails: string[];
  level: string;
  company: string;
  isGroup: boolean;
  inactive: boolean;
  lessonCount: number;
  /** UID konta w aplikacji, jeśli już istnieje. */
  uid?: string;
  matchedBy?: MatchReason;
  /** Konto istnieje, ale ma adres zastępczy — import może go poprawić. */
  emailNeedsFix?: boolean;
  /**
   * Ile lekcji z Notion leży już w aplikacji.
   *
   * Bez tej liczby lektor nie ma jak sprawdzić, czy import się wykonał —
   * a to pierwsze pytanie, które zadaje po kliknięciu.
   */
  importedCount?: number;
  /** Lista kart lekcji przypisanych do tego kursanta w Notion. */
  lessons?: NotionLessonItem[];
}

export interface PreviewResult {
  students: StudentPreview[];
  lessonsTotal: number;
  /** Lekcje, których nie da się przypisać do żadnej karty kursanta. */
  orphanLessons: number;
}

interface LessonRef {
  page: NotionPage;
  notionStudentId?: string;
  studentName: string;
}

/** Lekcje ze statusem, który oznacza materiał gotowy do przeniesienia. */
const fetchLessons = async (token: string): Promise<NotionPage[]> =>
  queryDatabase(token, NOTION_LESSONS_DB, {
    or: [
      { property: 'Status', select: { equals: 'Odbyta' } },
      { property: 'Status', select: { equals: 'Podsumowanie' } },
    ],
  });

/**
 * Ile treści lekcji pobieramy z Notion równolegle.
 *
 * Sekwencyjnie import kilkudziesięciu lekcji trwał tyle, że wyglądał na
 * zawieszenie. Powyżej mniej więcej tej wartości Notion zaczyna odrzucać
 * zapytania limitem tempa, więc nie ma sensu podnosić jej wyżej.
 */
const LESSON_FETCH_CONCURRENCY = 5;

/**
 * Wiąże lekcję z kartą kursanta.
 *
 * Pierwszeństwo ma relacja, bo jest jednoznaczna. Pole wyboru zostaje jako
 * zapas dla lekcji sprzed jej wprowadzenia oraz dla tych, w których lektor
 * zapomni ją uzupełnić.
 */
const lessonRefs = (lessons: NotionPage[]): LessonRef[] =>
  lessons.map((page) => ({
    page,
    notionStudentId: propRelationIds(page, 'Kursant (relacja)')[0],
    studentName: propText(page, 'Kursant'),
  }));

/**
 * Krok pierwszy: kto jest w Notion i co aplikacja już o nim wie.
 *
 * Czyta wyłącznie właściwości stron — bez treści lekcji, więc kończy się
 * w kilka sekund niezależnie od tego, ile lekcji nazbierało się przez lata.
 */
export const previewSync = async (token: string): Promise<PreviewResult> => {
  const db = getFirestore(DATABASE_ID);
  const [pages, lessons, usersSnap] = await Promise.all([
    queryDatabase(token, NOTION_STUDENTS_DB),
    fetchLessons(token),
    db.collection('users').get(),
  ]);

  const refs = lessonRefs(lessons);
  const byNotionId = new Map<string, number>();
  const byName = new Map<string, number>();
  const lessonsByNotionStudentId = new Map<string, NotionLessonItem[]>();
  const lessonsByStudentName = new Map<string, NotionLessonItem[]>();

  for (const ref of refs) {
    const rawDate = propText(ref.page, 'Data lekcji');
    const isDateMissing = !rawDate || /brak/i.test(rawDate);
    const date = isDateMissing ? '' : rawDate.slice(0, 10);
    const rawTopic = propText(ref.page, 'Temat lekcji') || 'Lekcja bez tematu';
    let topic = rawTopic;
    if (/^Podsumowanie lekcji\s*—\s*brak daty\s*—\s*/i.test(topic)) {
      topic = topic.replace(/^Podsumowanie lekcji\s*—\s*brak daty\s*—\s*/i, '');
    }

    const item: NotionLessonItem = {
      id: ref.page.id,
      topic,
      date,
      isDateMissing,
      url: ref.page.url || '',
      lastEditedTime: ref.page.last_edited_time,
    };

    if (ref.notionStudentId) {
      byNotionId.set(ref.notionStudentId, (byNotionId.get(ref.notionStudentId) || 0) + 1);
      const list = lessonsByNotionStudentId.get(ref.notionStudentId) || [];
      list.push(item);
      lessonsByNotionStudentId.set(ref.notionStudentId, list);
    }
    const key = normalize(ref.studentName);
    if (key) {
      byName.set(key, (byName.get(key) || 0) + 1);
      const list = lessonsByStudentName.get(key) || [];
      list.push(item);
      lessonsByStudentName.set(key, list);
    }
  }

  const students: StudentPreview[] = [];
  let assigned = 0;

  for (const page of pages) {
    const name = propText(page, 'Nazwa');
    if (!name) continue;

    const emails = propEmails(page, 'Adresy e-mail');
    const lessonCount = byNotionId.get(page.id) ?? byName.get(normalize(name)) ?? 0;
    assigned += lessonCount;

    const studentLessons =
      lessonsByNotionStudentId.get(page.id) ??
      lessonsByStudentName.get(normalize(name)) ??
      [];
    // Sortuj od najnowszej do najstarszej:
    studentLessons.sort((a, b) =>
      (b.date || b.lastEditedTime || '').localeCompare(a.date || a.lastEditedTime || '')
    );

    const preview: StudentPreview = {
      notionId: page.id,
      name,
      emails,
      level: propText(page, 'Poziom / profil'),
      company: propText(page, 'Firma'),
      isGroup: propText(page, 'Typ') === 'Grupa',
      inactive: propText(page, 'Status współpracy') === 'Nieaktywny',
      lessonCount,
      lessons: studentLessons,
    };

    const match = findAccount(usersSnap.docs, page.id, emails, name);
    if (match) {
      preview.uid = match.doc.id;
      preview.matchedBy = match.reason;
      const current = match.doc.data()?.email || '';
      preview.emailNeedsFix = !isRealEmail(current) && emails.some(isRealEmail);
    }

    students.push(preview);
  }

  // Ile z tego już wylądowało w aplikacji. Zliczamy po stronie bazy
  // (agregacja zamiast pobierania dokumentów), bo interesuje nas sama liczba.
  await Promise.all(
    students
      .filter((s) => s.uid)
      .map(async (s) => {
        try {
          const snap = await db
            .collection('users')
            .doc(s.uid!)
            .collection('lessonRecords')
            .where('source', '==', 'notion')
            .count()
            .get();
          s.importedCount = snap.data().count;
        } catch {
          // Brak licznika jest do zniesienia; brak podglądu nie byłby.
          s.importedCount = undefined;
        }
      })
  );

  students.sort((a, b) => b.lessonCount - a.lessonCount || a.name.localeCompare(b.name, 'pl'));

  return {
    students,
    lessonsTotal: refs.length,
    orphanLessons: refs.length - assigned,
  };
};

/** Profil sprowadzony do pól, po których wolno rozpoznawać kursanta. */
export interface AccountFingerprint {
  id: string;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  notionPageId?: string;
}

/**
 * Szuka konta odpowiadającego karcie z Notion.
 *
 * Kolejność kryteriów jest kolejnością pewności: zapisane powiązanie, potem
 * adres e-mail, dopiero na końcu imię i nazwisko oraz nazwa użytkownika.
 * Nazwisko nigdy nie jest pierwszym kryterium, bo bywa zapisane na kilka
 * sposobów — ale bez niego pierwszy import nie miałby po czym rozpoznać kont
 * założonych ręcznie, zanim jakiekolwiek powiązanie powstało.
 *
 * Pomyłka tutaj jest droga: lekcje jednego kursanta trafiłyby do drugiego,
 * a zobaczyłby to dopiero człowiek. Dlatego funkcja jest czysta i pokryta
 * testami (tests/notionMatch.test.ts), a wynik niesie powód dopasowania,
 * który panel pokazuje lektorowi przed importem.
 */
export const matchAccount = (
  accounts: AccountFingerprint[],
  notionId: string,
  emails: string[],
  name: string
): { id: string; reason: MatchReason } | null => {
  const emailSet = new Set(emails.map(normalize).filter(Boolean));
  const nameNorm = normalize(name);

  const byNotion = accounts.find((a) => a.notionPageId && a.notionPageId === notionId);
  if (byNotion) return { id: byNotion.id, reason: 'notion' };

  const byEmail = emailSet.size
    ? accounts.find((a) => a.email && emailSet.has(normalize(a.email)))
    : undefined;
  if (byEmail) return { id: byEmail.id, reason: 'email' };

  // Puste imię i nazwisko dałyby pusty ciąg pasujący do wszystkiego naraz.
  if (!nameNorm) return null;

  const byName = accounts.find(
    (a) => normalize(`${a.firstName || ''} ${a.lastName || ''}`) === nameNorm
  );
  if (byName) return { id: byName.id, reason: 'name' };

  const byUsername = accounts.find((a) => a.username && normalize(a.username) === nameNorm);
  if (byUsername) return { id: byUsername.id, reason: 'username' };

  return null;
};

/** Most między dokumentami Firestore a czystą funkcją dopasowania. */
const findAccount = (
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  notionId: string,
  emails: string[],
  name: string
): { doc: FirebaseFirestore.QueryDocumentSnapshot; reason: MatchReason } | null => {
  const fingerprints: AccountFingerprint[] = docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  const hit = matchAccount(fingerprints, notionId, emails, name);
  if (!hit) return null;
  const doc = docs.find((d) => d.id === hit.id);
  return doc ? { doc, reason: hit.reason } : null;
};

export interface ImportSelection {
  notionId: string;
  /** Założyć konto, gdy kursant jeszcze go nie ma. */
  createAccount?: boolean;
  /** Opcjonalnie: lista wybranych ID stron lekcji z Notion do zaimportowania. */
  lessonIds?: string[];
}

export interface ImportReport {
  accountsCreated: Array<{ name: string; email: string; tempPassword: string }>;
  emailsUpdated: number;
  lessonsImported: number;
  lessonsSkipped: number;
  needsReview: number;
  warnings: string[];
}

/** Hasło startowe do przekazania kursantowi — zmieniane przy pierwszym logowaniu. */
const tempPassword = (): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
};

/** Rozbija „Imię Nazwisko” na dwa pola profilu. */
const splitName = (full: string): { firstName: string; lastName: string } => {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return { firstName: full.trim(), lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

const lessonDate = (
  page: NotionPage,
  parsed?: { extractedDate?: string }
): { date: string; isDateMissing: boolean } => {
  const raw = propText(page, 'Data lekcji');
  if (raw && !raw.toLowerCase().includes('brak')) {
    return { date: raw.slice(0, 10), isDateMissing: false };
  }
  if (parsed?.extractedDate) {
    return { date: parsed.extractedDate, isDateMissing: false };
  }
  const fallback = (page.last_edited_time || new Date().toISOString()).slice(0, 10);
  return { date: fallback, isDateMissing: true };
};

/**
 * Krok drugi: import tego, co lektor zaznaczył.
 *
 * Zakres jest ograniczony do wybranych kursantów, więc czas pracy zależy od
 * decyzji lektora, a nie od rozmiaru archiwum. Konta zakładamy tylko na wyraźne
 * życzenie — samo pojawienie się kogoś w Notion nie jest zgodą na utworzenie mu
 * konta w aplikacji.
 */
export const importSelection = async (
  token: string,
  selections: ImportSelection[]
): Promise<ImportReport> => {
  const db = getFirestore(DATABASE_ID);
  const auth = getAuth();
  const report: ImportReport = {
    accountsCreated: [],
    emailsUpdated: 0,
    lessonsImported: 0,
    lessonsSkipped: 0,
    needsReview: 0,
    warnings: [],
  };

  const wanted = new Map(selections.map((s) => [s.notionId, s]));
  if (wanted.size === 0) return report;

  const [pages, lessons, usersSnap] = await Promise.all([
    queryDatabase(token, NOTION_STUDENTS_DB),
    fetchLessons(token),
    db.collection('users').get(),
  ]);

  /** notionId → uid, budowane w trakcie: konta mogą powstać w tym przebiegu. */
  const uidByNotionId = new Map<string, string>();
  const uidByName = new Map<string, string>();
  const rejectedByUid = new Map<string, Set<string>>();

  for (const page of pages) {
    const selection = wanted.get(page.id);
    if (!selection) continue;

    const name = propText(page, 'Nazwa');
    if (!name) continue;

    const emails = propEmails(page, 'Adresy e-mail');
    const match = findAccount(usersSnap.docs, page.id, emails, name);

    if (match) {
      const ref = match.doc.ref;
      const data = match.doc.data() || {};
      const updates: Record<string, unknown> = {};

      if (data.notionPageId !== page.id) updates.notionPageId = page.id;

      // Prawdziwy adres zastępuje zaślepkę `@student.vocabboost.com`, pod którą
      // powiadomienia i tak nie dochodziły. Poprawnego adresu nie ruszamy —
      // kursant mógł zmienić go u siebie.
      const real = emails.find(isRealEmail);
      if (real && !isRealEmail(data.email || '')) {
        updates.email = real;
        report.emailsUpdated += 1;
      }

      // Poziom i opis: uzupełniamy tylko puste miejsca oraz naprawiamy plakietkę,
      // w którą wcześniejszy import wpisał całą notatkę z Notion. Tego, co lektor
      // wpisał sam, nie ruszamy — Notion jest źródłem prawdy dla historii lekcji,
      // nie dla profilu prowadzonego w aplikacji.
      const { level, profile } = splitLevel(propText(page, 'Poziom / profil'));
      const currentLevel = (data.level || '').toString();
      if (level && (!currentLevel || currentLevel === profile)) updates.level = level;
      if (profile && !(data.description || '').toString().trim()) {
        updates.description = profile;
      }

      if (Object.keys(updates).length > 0) await ref.update(updates);
      uidByNotionId.set(page.id, ref.id);
      uidByName.set(normalize(name), ref.id);
      continue;
    }

    if (!selection.createAccount) {
      report.warnings.push(`„${name}" pominięty — nie ma konta, a zakładanie nie było zaznaczone.`);
      continue;
    }

    const email = emails.find(isRealEmail);
    if (!email) {
      report.warnings.push(`„${name}" pominięty — brak prawdziwego adresu e-mail w Notion.`);
      continue;
    }

    const password = tempPassword();
    const { firstName, lastName } = splitName(name);
    const { level, profile } = splitLevel(propText(page, 'Poziom / profil'));

    try {
      let record;
      try {
        record = await auth.createUser({ email, password, displayName: name });
      } catch (error: any) {
        // Konto w Auth mogło powstać wcześniej, bez profilu w bazie.
        if (error?.code === 'auth/email-already-exists') {
          record = await auth.getUserByEmail(email);
          await auth.updateUser(record.uid, { password });
        } else {
          throw error;
        }
      }

      await db.collection('users').doc(record.uid).set(
        {
          username: name,
          email,
          role: 'user',
          firstName,
          lastName,
          level,
          description: profile,
          notionPageId: page.id,
          tempPassword: password,
          requirePasswordChange: true,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      report.accountsCreated.push({ name, email, tempPassword: password });
      uidByNotionId.set(page.id, record.uid);
      uidByName.set(normalize(name), record.uid);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.warnings.push(`Nie udało się założyć konta dla „${name}": ${message}`);
      logger.error('Notion: zakładanie konta', { name, error: message });
    }
  }

  // ——— lekcje wybranych kursantów ———
  /**
   * Najpierw tanie odsianie, dopiero potem pobieranie treści.
   *
   * Treść każdej lekcji to osobne zapytanie do Notion. Poprzednio szły jedno
   * po drugim wewnątrz pętli, więc import kursanta z trzydziestoma lekcjami
   * oznaczał trzydzieści zapytań sekwencyjnie — z perspektywy lektora
   * aplikacja po prostu wisiała, aż przeglądarka albo funkcja padały na
   * timeout.
   */
  const queue: Array<{ ref: LessonRef; uid: string; topic: string }> = [];

  for (const ref of lessonRefs(lessons)) {
    const uid =
      (ref.notionStudentId && uidByNotionId.get(ref.notionStudentId)) ||
      uidByName.get(normalize(ref.studentName));

    if (!uid) continue;

    // Sprawdzenie czy lektor ograniczył import do wybranych lekcji kursanta
    const studentNotionId =
      ref.notionStudentId ||
      Array.from(uidByNotionId.entries()).find(([, u]) => u === uid)?.[0];
    const selection = studentNotionId ? wanted.get(studentNotionId) : undefined;

    // Pusta lista to świadomy wybór „nic nowego do pobrania", a nie brak
    // filtra. Wcześniej rozróżnienia nie było i taki import zaciągał
    // ponownie CAŁE archiwum kursanta.
    if (selection?.lessonIds) {
      if (!selection.lessonIds.includes(ref.page.id)) {
        report.lessonsSkipped += 1;
        continue;
      }
    }

    const topic = propText(ref.page, 'Temat lekcji') || 'Lekcja';

    // Sprawdzenie listy odrzuconych wpisów Notion dla tego kursanta
    if (!rejectedByUid.has(uid)) {
      try {
        const rejSnap = await db.collection('users').doc(uid).collection('rejectedNotionLessons').get();
        const set = new Set<string>();
        rejSnap.docs.forEach((d) => {
          set.add(d.id);
          const t = d.data()?.topic;
          if (t) set.add(normalize(t));
        });
        rejectedByUid.set(uid, set);
      } catch {
        rejectedByUid.set(uid, new Set());
      }
    }

    const rejectedSet = rejectedByUid.get(uid);
    if (rejectedSet?.has(ref.page.id) || rejectedSet?.has(normalize(topic))) {
      logger.info(`Pominięto lekcję „${topic}” (znajduje się na liście odrzuconych przez lektora)`);
      report.lessonsSkipped += 1;
      continue;
    }

    queue.push({ ref, uid, topic });
  }

  logger.info('Notion: lekcje zakwalifikowane do pobrania', {
    doPobrania: queue.length,
    pominietych: report.lessonsSkipped,
  });

  /**
   * Lekcja trafia do kursanta przez relację „Kursant (relacja)" albo przez
   * zgodność nazwy. Gdy w Notion nie ma ani jednego, ani drugiego, lekcja
   * wypadała z pętli po cichu i lektor widział import, który „nic nie zrobił".
   * Teraz mówimy wprost, czego nie dało się powiązać.
   */
  const queuedPageIds = new Set(queue.map((job) => job.ref.page.id));
  for (const selection of selections) {
    const requested = selection.lessonIds;
    if (!requested || requested.length === 0) continue;

    const unmatched = requested.filter((id: string) => !queuedPageIds.has(id));
    if (unmatched.length === requested.length) {
      report.warnings.push(
        `Żadnej z ${requested.length} zaznaczonych lekcji nie udało się powiązać z kursantem. ` +
          'Sprawdź w Notion pole „Kursant (relacja)" na tych stronach.'
      );
    } else if (unmatched.length > 0) {
      report.warnings.push(
        `${unmatched.length} z ${requested.length} zaznaczonych lekcji pominięto — brak powiązania z kursantem w Notion.`
      );
    }
  }

  // Treść pobieramy paczkami — równolegle, ale bez zalewania API Notion.
  for (let offset = 0; offset < queue.length; offset += LESSON_FETCH_CONCURRENCY) {
    const batch = queue.slice(offset, offset + LESSON_FETCH_CONCURRENCY);

    const fetched = await Promise.all(
      batch.map(async (job) => {
        try {
          return { job, parsed: parseLessonSummary(await pageToText(token, job.ref.page.id)) };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.warn('Notion: nie udało się odczytać lekcji', { topic: job.topic, error: message });
          return { job, parsed: null };
        }
      })
    );

    for (const { job, parsed } of fetched) {
      if (!parsed) {
        report.warnings.push(`Nie udało się odczytać lekcji „${job.topic}".`);
        report.lessonsSkipped += 1;
        continue;
      }

      const { ref, uid, topic } = job;

    const now = new Date().toISOString();
    const doc = db.collection('users').doc(uid).collection('lessonRecords').doc(ref.page.id);
    const existing = await doc.get();

    const dateInfo = lessonDate(ref.page, parsed);
    const isPending = dateInfo.isDateMissing || parsed.needsReview;
    const pendingReasons: string[] = [];
    if (dateInfo.isDateMissing) pendingReasons.push('Brak daty spotkania w Notion');
    if (parsed.needsReview) pendingReasons.push('Wybrakowane podsumowanie lub format do weryfikacji');

    const structuredBlocks = {
      summary: parsed.lessonSummary,
      vocabulary: parsed.vocabularyText,
      corrections: parsed.corrections,
      homework: parsed.homeworkText,
      answerKey: parsed.homeworkAnswerKey || '',
      nextLesson: parsed.suggestedFollowUp,
      learningCurve: parsed.learningCurve || '',
    };

    await doc.set(
      {
        studentId: uid,
        date: dateInfo.date,
        isDateMissing: dateInfo.isDateMissing,
        status: isPending ? 'pending_confirmation' : 'confirmed',
        isPendingConfirmation: isPending,
        pendingReason: pendingReasons.length > 0 ? pendingReasons.join(' • ') : '',
        topic,
        vocabularyText: parsed.vocabularyText,
        lessonSummary: parsed.lessonSummary,
        thingsToImprove: parsed.thingsToImprove,
        corrections: parsed.corrections,
        homeworkText: parsed.homeworkText,
        homeworkAnswerKey: parsed.homeworkAnswerKey || '',
        suggestedFollowUp: parsed.suggestedFollowUp,
        nextLessonPlan: parsed.suggestedFollowUp,
        studentSpeaking: parsed.learningCurve,
        structuredBlocks,
        source: 'notion',
        notionPageId: ref.page.id,
        notionUrl: ref.page.url || '',
        needsReview: parsed.needsReview,
        createdAt: existing.exists ? existing.data()?.createdAt || now : now,
        updatedAt: now,
      },
      { merge: true }
    );

      report.lessonsImported += 1;
      if (isPending) report.needsReview += 1;
    }
  }

  return report;
};
