/**
 * Harness tras Express na emulatorach Firebase (Auth + Firestore).
 *
 * Wstaje PRAWDZIWY `createApp()` z server.ts na losowym porcie. Tokeny wystawia emulator Auth,
 * a Admin SDK w serwerze weryfikuje je tak jak produkcyjne (z emulatorem nie sprawdza podpisu).
 * Role bierze serwer z dokumentu `users/{uid}` w emulatorze Firestore — dokładnie jak
 * `requireFirebaseAdmin`. Żadnych kluczy produkcyjnych, żadnego prawdziwego Gemini/Resend.
 *
 * Uruchamianie: `npm run test:routes` (emulatory wstają i gasną same; projekt `demo-` bez logowania).
 */
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

export const PROJECT_ID = 'demo-cribro';
export const DATABASE_ID = 'ai-studio-520a4841-33d0-41ef-829a-838ebc44072d';
/** Adres z listy administratorów w `requireFirebaseAdmin` — przechodzi bez dokumentu w bazie. */
export const ADMIN_EMAIL = 'maciej.wyrozumski@gmail.com';

process.env.FIREBASE_PROJECT_ID = PROJECT_ID;
process.env.GOOGLE_CLOUD_PROJECT = PROJECT_ID;
delete process.env.FIREBASE_SERVICE_ACCOUNT;
// Klucze zewnętrznych usług celowo puste: test nie może nigdzie wyjść na prawdziwy świat.
for (const k of ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY', 'RESEND_API_KEY']) {
  delete process.env[k];
}

const authHost = (): string => {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!host) throw new Error('Brak FIREBASE_AUTH_EMULATOR_HOST — uruchom przez `npm run test:routes`.');
  return host;
};

export interface TestUser {
  uid: string;
  email: string;
  token: string;
}

let counter = 0;

/** Zakłada konto w emulatorze Auth i (opcjonalnie) dokument `users/{uid}` z rolą. */
export async function createUser(
  db: FirebaseFirestore.Firestore,
  opts: { role?: string; email?: string; profile?: Record<string, unknown> } = {},
): Promise<TestUser> {
  counter += 1;
  const email = opts.email ?? `user${counter}-${Date.now()}@example.test`;
  const res = await fetch(`http://${authHost()}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test1234!', returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(`signUp nieudany: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { localId: string; idToken: string };
  if (opts.role) {
    await db.collection('users').doc(body.localId).set({ email, role: opts.role, ...(opts.profile || {}) });
  }
  return { uid: body.localId, email, token: body.idToken };
}

export interface RouteHarness {
  baseUrl: string;
  db: FirebaseFirestore.Firestore;
  close: () => Promise<void>;
  call: (
    method: string,
    path: string,
    opts?: { token?: string | null; body?: unknown; rawBody?: string },
  ) => Promise<{ status: number; body: any }>;
}

export async function startHarness(): Promise<RouteHarness> {
  const { createApp } = await import('../../server');
  const { getApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = createApp();
  const db = getFirestore(getApp(), DATABASE_ID);
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    baseUrl,
    db,
    close: () => new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections?.(); }),
    call: async (method, path, opts = {}) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
      const res = await fetch(baseUrl + path, {
        method,
        headers,
        body: opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
      });
      const text = await res.text();
      let body: any = text;
      try { body = JSON.parse(text); } catch { /* odpowiedź nie-JSON zostaje tekstem */ }
      return { status: res.status, body };
    },
  };
}
