import type {
  SeriesDb,
  SeriesDocRef,
  SeriesDocSnapshot,
  SeriesQuerySnapshot,
  SeriesTransaction,
} from '../../utils/homeworkSeriesHandler';

/**
 * Firestore w pamięci dla testów serii prac (transakcje, create(), podkolekcje).
 *
 * Celowo tak surowy jak Admin SDK w server.ts, który NIE ma `ignoreUndefinedProperties`:
 * pole `undefined` w zapisie rzuca błąd (wcześniejsza wersja fałszywki robiła
 * JSON.stringify i po cichu je gubiła, więc testy przechodziły, a produkcja by padła),
 * a `update()` nieistniejącego dokumentu rzuca NOT_FOUND.
 */
export function assertNoUndefined(value: unknown, path = ''): void {
  if (value === undefined) {
    throw new Error(`Cannot use "undefined" as a Firestore value${path ? ` (found in field "${path}")` : ''}`);
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoUndefined(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      assertNoUndefined(v, path ? `${path}.${k}` : k);
    }
  }
}

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const notFound = (path: string) => {
  const err: any = new Error(`No document to update: ${path}`);
  err.code = 5; // NOT_FOUND
  return err;
};

type PathRef = SeriesDocRef & { __path: string };

export class InMemorySeriesDb implements SeriesDb {
  data = new Map<string, any>();
  private txLock: Promise<void> = Promise.resolve();

  collection(colName: string) {
    return this.collectionAt(colName);
  }

  private collectionAt(prefix: string) {
    return {
      doc: (id?: string) => this.docAt(`${prefix}/${id}`),
      where: (field: string, op: string, val: any) => this.queryAt(prefix, [[field, op, val]]),
      get: async () => this.queryDocs(prefix, []),
    };
  }

  private docAt(fullPath: string): PathRef {
    const id = fullPath.split('/').pop() as string;
    return {
      __path: fullPath,
      id,
      get: async () => this.snapshot(fullPath),
      set: async (val: any) => {
        assertNoUndefined(val);
        this.data.set(fullPath, copy(val));
      },
      update: async (val: any) => {
        assertNoUndefined(val);
        if (!this.data.has(fullPath)) throw notFound(fullPath);
        this.data.set(fullPath, { ...this.data.get(fullPath), ...copy(val) });
      },
      delete: async () => {
        this.data.delete(fullPath);
      },
      collection: (subName: string) => this.collectionAt(`${fullPath}/${subName}`),
    };
  }

  private snapshot(fullPath: string): SeriesDocSnapshot {
    const val = this.data.get(fullPath);
    return {
      id: fullPath.split('/').pop() as string,
      exists: val !== undefined,
      data: () => (val !== undefined ? copy(val) : undefined),
    };
  }

  private queryAt(prefix: string, filters: Array<[string, string, any]>) {
    return {
      where: (field: string, op: string, val: any) => this.queryAt(prefix, [...filters, [field, op, val]]),
      get: async () => this.queryDocs(prefix, filters),
    };
  }

  private queryDocs(prefix: string, filters: Array<[string, string, any]>): SeriesQuerySnapshot {
    const docs: SeriesDocSnapshot[] = [];
    for (const [key, val] of this.data.entries()) {
      if (!key.startsWith(`${prefix}/`)) continue;
      const rest = key.slice(prefix.length + 1);
      if (rest.includes('/')) continue;
      const matches = filters.every(([f, op, expected]) => op !== '==' || val?.[f] === expected);
      if (matches) docs.push(this.snapshot(key));
    }
    return { empty: docs.length === 0, size: docs.length, docs };
  }

  async runTransaction<T>(fn: (tx: SeriesTransaction) => Promise<T>): Promise<T> {
    const prevLock = this.txLock;
    let releaseLock!: () => void;
    this.txLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    await prevLock;

    try {
      const staged: Array<() => void> = [];
      const pathOf = (ref: SeriesDocRef) => (ref as PathRef).__path;
      const tx: SeriesTransaction = {
        get: async (ref: SeriesDocRef) => ref.get(),
        create: (ref: SeriesDocRef, val: any) => {
          assertNoUndefined(val);
          const path = pathOf(ref);
          if (this.data.has(path)) {
            const err: any = new Error(`Document already exists at ${path}`);
            err.code = 6; // ALREADY_EXISTS
            throw err;
          }
          staged.push(() => this.data.set(path, copy(val)));
        },
        set: (ref: SeriesDocRef, val: any) => {
          assertNoUndefined(val);
          const path = pathOf(ref);
          staged.push(() => this.data.set(path, copy(val)));
        },
        update: (ref: SeriesDocRef, val: any) => {
          assertNoUndefined(val);
          const path = pathOf(ref);
          if (!this.data.has(path)) throw notFound(path);
          staged.push(() => this.data.set(path, { ...this.data.get(path), ...copy(val) }));
        },
        delete: (ref: SeriesDocRef) => {
          const path = pathOf(ref);
          staged.push(() => this.data.delete(path));
        },
      };

      const res = await fn(tx);
      staged.forEach((op) => op());
      return res;
    } finally {
      releaseLock();
    }
  }
}
