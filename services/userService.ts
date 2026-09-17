import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from '../types';

export type UserWithId = User & { id: string };

interface CacheConfig {
  ttlMs: number;
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttlMs: 5 * 60 * 1000, // 5 minut domyślnego cache
};

let cachedUsers: UserWithId[] | null = null;
let lastUsersFetchTimestamp = 0;
let inFlightUsersPromise: Promise<UserWithId[]> | null = null;

/**
 * Pobiera listę wszystkich użytkowników z bazy Firestore z inteligentnym cache'owaniem:
 * 1. Zwraca dane z pamięci podręcznej, jeśli nie minął czas TTL (5 minut).
 * 2. Deduplikuje jednoczesne zapytania (jeśli wiele komponentów zażąda listy w tym samym czasie,
 *    wykonane zostanie tylko jedno zapytanie sieciowe).
 * 3. Umożliwia wymuszenie odświeżenia za pomocą `forceRefresh = true`.
 */
export async function getAllUsers(forceRefresh = false, config: Partial<CacheConfig> = {}): Promise<UserWithId[]> {
  const ttl = config.ttlMs ?? DEFAULT_CACHE_CONFIG.ttlMs;
  const now = Date.now();

  // 1. Sprawdź czy mamy świeży cache
  if (!forceRefresh && cachedUsers && now - lastUsersFetchTimestamp < ttl) {
    return cachedUsers;
  }

  // 2. Jeśli trwa już pobieranie, współdziel tę samą obietnicę
  if (inFlightUsersPromise) {
    return inFlightUsersPromise;
  }

  // 3. Wykonaj zapytanie do Firestore
  inFlightUsersPromise = (async () => {
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const list: UserWithId[] = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as UserWithId))
        .filter((u) => u.username !== 'Demo User' && u.username !== 'Demo User (Offline)');

      list.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      cachedUsers = list;
      lastUsersFetchTimestamp = Date.now();
      return list;
    } finally {
      inFlightUsersPromise = null;
    }
  })();

  return inFlightUsersPromise;
}

/**
 * Zwraca aktualny stan cache użytkowników bez wykonywania zapytania sieciowego.
 */
export function getCachedUsersSync(): UserWithId[] | null {
  return cachedUsers;
}

/**
 * Unieważnia pamięć podręczną użytkowników, wymuszając kolejne pobranie z bazy.
 */
export function invalidateUsersCache(): void {
  cachedUsers = null;
  lastUsersFetchTimestamp = 0;
}

/**
 * Optymistycznie aktualizuje dane użytkownika w cache bez konieczności ponownego odpytywania bazy.
 */
export function updateCachedUser(userId: string, updates: Partial<User>): void {
  if (!cachedUsers) return;
  cachedUsers = cachedUsers.map((u) => (u.id === userId ? { ...u, ...updates } : u));
}

/**
 * Optymistycznie dodaje nowo utworzonego użytkownika do cache.
 */
export function addCachedUser(newUser: UserWithId): void {
  if (!cachedUsers) {
    cachedUsers = [newUser];
    lastUsersFetchTimestamp = Date.now();
    return;
  }
  // Dodaj na początek jeśli jeszcze go nie ma
  if (!cachedUsers.some((u) => u.id === newUser.id)) {
    cachedUsers = [newUser, ...cachedUsers];
  }
}

/**
 * Usuwa użytkownika z cache po skasowaniu w bazie.
 */
export function removeCachedUser(userId: string): void {
  if (!cachedUsers) return;
  cachedUsers = cachedUsers.filter((u) => u.id !== userId);
}
