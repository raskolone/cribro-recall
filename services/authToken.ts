import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '../firebase';

/**
 * Ostatni znany token uwierzytelniający, trzymany synchronicznie.
 *
 * Zwykle token bierze się z `await getIdToken()`, ale adres strumienia TTS trafia
 * wprost do `audio.src`, a do elementu <audio> nie da się dołożyć nagłówka
 * Authorization. Token musi więc być dostępny bez czekania, w chwili budowania
 * URL-a. Firebase odświeża go sam co godzinę i przy każdej zmianie woła
 * onIdTokenChanged, więc kopia tutaj nie zdąży się zestarzeć.
 *
 * Do zwykłych wywołań fetch używaj `await auth.currentUser.getIdToken()` —
 * to jest wyjątek na potrzeby URL-i, nie domyślna droga.
 */
let cachedIdToken: string | null = null;

onIdTokenChanged(auth, async (user) => {
  if (!user) {
    cachedIdToken = null;
    return;
  }
  try {
    cachedIdToken = await user.getIdToken();
  } catch {
    cachedIdToken = null;
  }
});

export const getCachedIdToken = (): string | null => cachedIdToken;
