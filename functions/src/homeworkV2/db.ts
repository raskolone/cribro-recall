/**
 * Leniwy dostęp do Firestore dla modułów silnika v2.
 *
 * Powód istnienia tego pliku jest konkretny, a pułapka cicha: `index.ts`
 * re-eksportuje endpointy v2 instrukcją `export ... from`, a te są
 * hoistowane — moduł `endpoints.ts` wykonuje się w całości ZANIM ciało
 * `index.ts` dojdzie do `initializeApp()`. Gdyby `getFirestore()` stało
 * w module na poziomie stałej, wdrożenie wywaliłoby się na
 * „The default Firebase app does not exist", mimo że `tsc` nie zgłasza nic.
 *
 * Leniwy getter przesuwa moment sięgnięcia po bazę na pierwsze realne
 * wywołanie, czyli po starcie aplikacji Admin SDK — niezależnie od tego,
 * w jakiej kolejności bundler ułoży moduły.
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

import { DATABASE_ID } from '../config';

let cached: Firestore | null = null;

export const getDb = (): Firestore => {
  if (!cached) {
    // `index.ts` woła `initializeApp()` u siebie; ten warunek chroni przed
    // podwójną inicjalizacją i przed brakiem inicjalizacji naraz.
    if (getApps().length === 0) initializeApp();
    cached = getFirestore(DATABASE_ID);
  }
  return cached;
};
