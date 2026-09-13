import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';
import { timingSafeEqual } from 'node:crypto';

import { DATABASE_ID, FUNCTION_REGION } from '../config';
import { BadRequest, storeTranscript, type Db } from './store';

/**
 * Punkt odbioru transkrypcji z Cribro Sift.
 *
 * ══ PO CO OSOBNA DROGA OBOK NOTION ══
 *
 * Notion jest źródłem prawdy dla notatek pisanych ręką i takim zostaje —
 * ta funkcja go nie dotyka. Tu wchodzi to, czego w Notion nie ma: zapis
 * rozmowy z lekcji, przepisany przez Sifta na bieżąco, w czasie nagrywania.
 *
 * ══ DLACZEGO HTTP, A NIE `onCall` ══
 *
 * Sift jest aplikacją desktopową (Electron) i nie ma w sobie Firebase SDK.
 * `onCall` wymaga tokena Firebase Auth po stronie klienta — czyli logowania
 * do Firebase w Sifcie, drugiego obok jego własnego konta Supabase. To dwa
 * systemy kont w jednej aplikacji, żeby przesłać jeden tekst. Zwykły POST
 * z tokenem to jeden nagłówek i zero nowej infrastruktury.
 *
 * ══ DLACZEGO TOKEN W `X-Sift-Token`, A NIE W `Authorization` ══
 *
 * Bo `Authorization: Bearer …` na funkcji drugiej generacji NIE DOCHODZI do
 * kodu. Cloud Run (na którym stoją funkcje v2) sam przechwytuje ten nagłówek
 * i próbuje zweryfikować go jako token Google — nasz token nim nie jest, więc
 * brama odpowiada stroną HTML „401 Unauthorized" zanim funkcja się obudzi.
 * Sprawdzone na wdrożonej funkcji 2026-09-13: to samo żądanie bez tego
 * nagłówka dochodzi i dostaje odpowiedź od naszego kodu, z nim — nie.
 *
 * Pułapka jest w tym, że funkcja JEST publiczna i wygląda na sprawną: żądania
 * bez nagłówka i z każdym innym nagłówkiem działają normalnie. Gdyby token
 * został w `Authorization`, wysyłka z Sifta odbijałaby się o bramę, a logi
 * funkcji byłyby puste, bo do niej nic nie dotarło.
 *
 * ══ DLACZEGO TOKEN Z SECRET MANAGERA, A NIE Z BAZY ══
 *
 * Token w bazie byłby czytelny dla każdego, kto ma rolę admina, i musiałby
 * mieć własny ekran do generowania. Tu jest jedno konto lektora, więc jeden
 * sekret w Secret Managerze jest i prostszy, i szczelniejszy: nie leży
 * w żadnym dokumencie, nie przechodzi przez przeglądarkę, a wymiana to
 * jedno polecenie (`npm run firebase:secrets:set SIFT_INGEST_TOKEN`).
 *
 * ══ CZEGO TA FUNKCJA CELOWO NIE ROBI ══
 *
 * Nie generuje bloków lekcji i nie publikuje niczego kursantowi. Zapisuje
 * surowy zapis rozmowy jako lekcję oczekującą na lektora. Transkrypcja
 * zawiera wszystko, co padło przy włączonym mikrofonie — pomyłki modelu,
 * uwagi lektora do siebie, fragmenty niezwiązane z lekcją. Decyzję, co z
 * tego jest lekcją, podejmuje człowiek w panelu.
 *
 * Kształt zapisu i cała logika przypisania: `transcript/store.ts`.
 */

const SIFT_INGEST_TOKEN = defineSecret('SIFT_INGEST_TOKEN');

/** Rozsądny limit ciała żądania: transkrypcja + metadane, z zapasem. */
const MAX_BODY_BYTES = 1_200_000;

/**
 * Porównanie tokenów w stałym czasie.
 *
 * Zwykłe `===` na łańcuchach kończy się na pierwszym różnym znaku, więc czas
 * odpowiedzi mówi, ile początkowych znaków zgadło się poprawnie. Przy tokenie
 * odgadywanym z zewnątrz to jest realna droga dojścia do niego znak po znaku.
 */
const tokenMatches = (given: string, expected: string): boolean => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // timingSafeEqual wymaga równych długości — różnicę długości i tak widać
  // z zewnątrz po odpowiedzi, więc nie ma tu czego chronić.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

/**
 * POST /ingestTranscript
 *
 * Nagłówek:  X-Sift-Token: <SIFT_INGEST_TOKEN>
 * Ciało:     { siftSessionId, transcript, studentUid | studentEmail, date?, topic? }
 * Odpowiedź: { ok: true, action: 'created' | 'updated', lessonId, studentUid }
 */
export const ingestTranscript = onRequest(
  {
    region: FUNCTION_REGION,
    secrets: [SIFT_INGEST_TOKEN],
    timeoutSeconds: 60,
    memory: '256MiB',
    // Żądanie przychodzi z aplikacji desktopowej, nie z przeglądarki —
    // nie ma powodu, żeby jakakolwiek strona mogła tu strzelać z JS-a.
    cors: false,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Tylko POST.' });
      return;
    }

    const expected = SIFT_INGEST_TOKEN.value();
    if (!expected) {
      logger.error('SIFT_INGEST_TOKEN nie jest ustawiony — odbiór transkrypcji zamknięty.');
      res.status(503).json({ ok: false, error: 'Odbiór transkrypcji nie jest skonfigurowany.' });
      return;
    }

    const given = (req.get('x-sift-token') ?? '').trim();
    if (!given || !tokenMatches(given, expected)) {
      // Bez szczegółów w odpowiedzi: „zły token" i „brak tokena" mają
      // wyglądać z zewnątrz identycznie.
      logger.warn('Odrzucone żądanie transkrypcji — token nie pasuje.');
      res.status(401).json({ ok: false, error: 'Brak dostępu.' });
      return;
    }

    const rawLength = Number(req.get('content-length') ?? 0);
    if (rawLength > MAX_BODY_BYTES) {
      res.status(413).json({ ok: false, error: 'Żądanie jest za duże.' });
      return;
    }

    const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<
      string,
      unknown
    >;

    try {
      const db = getFirestore(DATABASE_ID) as unknown as Db;
      const result = await storeTranscript(db, body, (message, meta) => logger.info(message, meta));
      res.status(result.action === 'created' ? 201 : 200).json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof BadRequest) {
        res.status(error.status).json({ ok: false, error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      // Treść transkrypcji nie trafia do logów — w logach zostaje po 30 dniach
      // i byłaby kopią rozmowy z kursantem w miejscu, którego nikt nie pilnuje.
      logger.error('Odbiór transkrypcji nie powiódł się', { error: message });
      res.status(500).json({ ok: false, error: 'Nie udało się zapisać transkrypcji.' });
    }
  }
);
