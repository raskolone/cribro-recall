/**
 * Zapis transkrypcji jako lekcji — czysta logika, bez HTTP i bez Firebase.
 *
 * Wydzielone z `ingest.ts`, bo to jest ta część, która decyduje o kształcie
 * danych w bazie: komu przypisać lekcję, czy to nowa sesja czy poprawka
 * poprzedniej, co zostaje ukryte przed kursantem. Testy tego nie mogą
 * wymagać ani emulatora, ani działającej funkcji.
 *
 * Baza wchodzi przez wąski interfejs `Db` zamiast przez typ z
 * `firebase-admin`: dzięki temu test podstawia własną atrapę, a plik nie
 * ciągnie za sobą całego SDK.
 */

/** Tyle z Firestore, ile ta logika naprawdę używa. */
export interface DocSnap {
  exists: boolean;
  id: string;
}
export interface DocRef {
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<unknown>;
  update(data: Record<string, unknown>): Promise<unknown>;
  collection(path: string): CollectionRef;
}
export interface QuerySnap {
  empty: boolean;
  size: number;
  docs: Array<{ id: string }>;
}
export interface Query {
  limit(n: number): Query;
  get(): Promise<QuerySnap>;
}
export interface CollectionRef {
  doc(id: string): DocRef;
  where(field: string, op: string, value: unknown): Query;
}
export interface Db {
  collection(path: string): CollectionRef;
}

export type Ingested = {
  studentUid: string;
  lessonId: string;
  action: 'created' | 'updated';
};

/** Błąd z gotowym kodem HTTP — tłumaczy go warstwa żądania w `ingest.ts`. */
export class BadRequest extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

/** Ten sam sufit, który pilnują `firestore.rules` — patrz komentarz tam. */
export const MAX_TRANSCRIPT_CHARS = 500_000;

/**
 * Identyfikator dokumentu z identyfikatora sesji Sifta.
 *
 * Deterministyczny, żeby ponowna wysyłka tej samej lekcji nadpisała ten sam
 * dokument, a nie założyła drugi. Bez tego poprawiona transkrypcja (Sift
 * potrafi przepisać nagranie jeszcze raz) wjeżdżałaby jako osobna lekcja
 * i lektor musiałby ręcznie zgadywać, która jest aktualna.
 */
const lessonIdFor = (siftSessionId: string): string =>
  `sift-${siftSessionId.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 120)}`;

/** Dzisiejsza data w strefie lektora, nie w UTC. */
const todayInWarsaw = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

/**
 * Kursant wskazany przez UID albo przez adres e-mail.
 *
 * Sift zna adres (to on jest w Notion i w zaproszeniu), UID-a nie zna nikt
 * poza bazą — dlatego wolno podać jedno albo drugie.
 */
const resolveStudent = async (
  db: Db,
  body: Record<string, unknown>
): Promise<string> => {
  const uid = typeof body.studentUid === 'string' ? body.studentUid.trim() : '';
  const email = typeof body.studentEmail === 'string' ? body.studentEmail.trim().toLowerCase() : '';

  if (!uid && !email) {
    throw new BadRequest(400, 'Podaj `studentUid` albo `studentEmail`.');
  }

  if (uid) {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) throw new BadRequest(404, `Nie ma kursanta o UID ${uid}.`);
    return uid;
  }

  const found = await db.collection('users').where('email', '==', email).limit(2).get();
  if (found.empty) throw new BadRequest(404, `Nie ma kursanta o adresie ${email}.`);
  if (found.size > 1) {
    // Dwa konta na jeden adres nie powinny istnieć, ale gdyby istniały,
    // zgadywanie po kolejności trafiłoby transkrypcję do losowego z nich.
    throw new BadRequest(409, `Adres ${email} ma więcej niż jedno konto — podaj \`studentUid\`.`);
  }
  return found.docs[0].id;
};

const readTranscriptPayload = (body: Record<string, unknown>) => {
  const siftSessionId = typeof body.siftSessionId === 'string' ? body.siftSessionId.trim() : '';
  if (!siftSessionId) throw new BadRequest(400, 'Brak `siftSessionId`.');
  if (siftSessionId.length > 200) throw new BadRequest(400, '`siftSessionId` jest za długi.');

  const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
  if (!transcript) throw new BadRequest(400, 'Brak `transcript` albo jest pusty.');
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    throw new BadRequest(
      413,
      `Transkrypcja ma ${transcript.length} znaków, sufit to ${MAX_TRANSCRIPT_CHARS}.`
    );
  }

  const rawDate = typeof body.date === 'string' ? body.date.trim() : '';
  if (rawDate && !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    throw new BadRequest(400, '`date` musi być w formacie YYYY-MM-DD.');
  }
  const date = rawDate || todayInWarsaw();

  const rawTopic = typeof body.topic === 'string' ? body.topic.trim() : '';
  const topic = (rawTopic || `Lekcja z transkrypcji — ${date}`).slice(0, 200);

  return { siftSessionId, transcript, date, topic };
};

/**
 * Zapis transkrypcji jako lekcji oczekującej na lektora.
 *
 * Wyodrębnione z obsługi żądania, żeby dało się to przetestować bez HTTP.
 */
export const storeTranscript = async (
  db: Db,
  body: Record<string, unknown>,
  log?: (message: string, meta: Record<string, unknown>) => void
): Promise<Ingested> => {
  const studentUid = await resolveStudent(db, body);
  const { siftSessionId, transcript, date, topic } = readTranscriptPayload(body);

  const lessonId = lessonIdFor(siftSessionId);
  const ref = db.collection('users').doc(studentUid).collection('lessonRecords').doc(lessonId);
  const existing = await ref.get();
  const now = new Date().toISOString();

  if (existing.exists) {
    /*
     * Ponowna wysyłka tej samej sesji — podmieniamy transkrypcję i nic więcej.
     *
     * `topic`, bloki i wszystko, co lektor mógł już dopisać ręką, zostaje.
     * Jedyne, co wraca do stanu wyjściowego, to `sessionStatus`: skoro zapis
     * rozmowy się zmienił, poprzednie domknięcie lekcji dotyczyło innego
     * tekstu i lektor musi je potwierdzić jeszcze raz.
     */
    await ref.update({
      liveTranscript: transcript,
      sessionStatus: 'draft',
      transcriptReceivedAt: now,
      updatedAt: now,
    });
    log?.('Transkrypcja podmieniona', { studentUid, lessonId, znakow: transcript.length });
    return { studentUid, lessonId, action: 'updated' };
  }

  await ref.set({
    studentId: studentUid,
    date,
    topic,
    // Bloki lekcji powstaną z transkrypcji dopiero w panelu lektora.
    // Pole jest wymagane przez reguły, więc wchodzi puste, nie brakujące.
    vocabularyText: '',
    source: 'live_transcript',
    sessionStatus: 'draft',
    liveTranscript: transcript,
    siftSessionId,
    transcriptReceivedAt: now,
    /*
     * Trzy flagi zamiast jednej, bo `isLessonPendingConfirmation` czyta każdą
     * z nich osobno, a ekrany kursanta filtrują właśnie przez nią. Surowy
     * zapis rozmowy nie ma trafić do kursanta ani przez chwilę.
     */
    status: 'pending_confirmation',
    isPendingConfirmation: true,
    pendingReason: 'Transkrypcja z Cribro Sift — do wygenerowania bloków',
    createdAt: now,
    updatedAt: now,
  });

  log?.('Transkrypcja przyjęta', { studentUid, lessonId, date, znakow: transcript.length });
  return { studentUid, lessonId, action: 'created' };
};
