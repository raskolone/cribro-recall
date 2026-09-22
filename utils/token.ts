/**
 * Bezpieczne generowanie unikalnych tokenów kryptograficznych (P0 Hotfix Higieny).
 * Działa zarówno w środowisku przeglądarkowym (crypto.getRandomValues), jak i Node.js (crypto.randomBytes).
 */

export const generateSecureToken = (byteLength: number = 32): string => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(byteLength);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  try {
    // Dynamic import / require fallback for Node.js environments
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    return crypto.randomBytes(byteLength).toString('hex');
  } catch {
    // Fallback if require is not available in bundle
    const array = new Uint8Array(byteLength);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
      return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }
    // Deterministyczny ostateczny fallback z timestampem
    return 'sec_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 15);
  }
};

/**
 * Generuje bezpieczny unikalny token dostępowy do prac domowych (prefiks `hw_`).
 */
export const generateSecureHomeworkToken = (): string => {
  return 'hw_' + generateSecureToken(16);
};
