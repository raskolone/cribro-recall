import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';

/**
 * Elementy niestabilne kursanta — te same dane, które karmią prompty AI
 * (`getUserWeaknesses` w services/geminiService.ts), ale w postaci nadającej się
 * do wyświetlenia. Tamta funkcja skleja wszystko w jeden string dla modelu,
 * więc nie da się jej użyć w interfejsie bez parsowania własnego formatu.
 */

export interface WeaknessItem {
  id: string;
  name: string;
  frequency: number;
  description?: string;
  /** `profile` to wpis z tablicy `users.frequentErrors`, bez licznika częstości. */
  source: 'collection' | 'profile';
}

export async function getStudentWeaknessItems(
  studentId: string,
  max: number = 12
): Promise<WeaknessItem[]> {
  if (!studentId || studentId === 'demo-id') return [];

  const items: WeaknessItem[] = [];

  try {
    const snapshot = await getDocs(
      query(collection(db, `users/${studentId}/weaknesses`), orderBy('frequency', 'desc'), limit(max))
    );
    snapshot.forEach((d) => {
      const data = d.data() || {};
      items.push({
        id: d.id,
        name: data.name || d.id,
        frequency: typeof data.frequency === 'number' ? data.frequency : 1,
        description: typeof data.description === 'string' ? data.description : undefined,
        source: 'collection',
      });
    });
  } catch (error: any) {
    // Reguły dopuszczają odczyt dla właściciela i nauczyciela (firestore.rules),
    // ale brak podkolekcji nie może wywrócić całego ekranu kontekstu.
    if (error?.code !== 'permission-denied') {
      console.error('Nie udało się pobrać elementów niestabilnych:', error);
    }
  }

  try {
    const userSnap = await getDoc(doc(db, `users/${studentId}`));
    const frequentErrors = userSnap.exists() ? userSnap.data()?.frequentErrors : null;
    if (Array.isArray(frequentErrors)) {
      frequentErrors
        .filter((err: unknown): err is string => typeof err === 'string' && err.trim().length > 0)
        // Starszy zapis w profilu bywa duplikatem wpisu z podkolekcji.
        .filter((err) => !items.some((i) => i.name.toLowerCase() === err.toLowerCase()))
        .forEach((err) =>
          items.push({ id: `profile-${err}`, name: err, frequency: 0, source: 'profile' })
        );
    }
  } catch {
    /* Profil bez `frequentErrors` to norma, nie błąd. */
  }

  return items.slice(0, max);
}

/**
 * Pozycje zatwierdzone po danej lekcji.
 *
 * `null` oznacza „nie wiadomo" — zestaw jest sprzed wprowadzenia zatwierdzania
 * albo lekcja w ogóle nie ma zestawu. Wtedy widok pokazuje cały wklej i mówi
 * o tym wprost, zamiast udawać, że wszystko było świadomie zatwierdzone.
 */
export async function getApprovedItemsForLesson(
  studentId: string,
  vocabularySetId?: string
): Promise<string[] | null> {
  if (!studentId || !vocabularySetId) return null;
  try {
    const snap = await getDoc(doc(db, `users/${studentId}/vocabularySets/${vocabularySetId}`));
    if (!snap.exists()) return null;
    const approved = snap.data()?.approvedItems;
    return Array.isArray(approved) ? approved.filter((i: unknown) => typeof i === 'string') : null;
  } catch {
    return null;
  }
}
