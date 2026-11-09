/**
 * The prototype's stand-in for the backend: IndexedDB in this browser, filled from JSON
 * the first time. Features reach it only through their `api/` transport functions, so
 * this folder is deleted, and only those files change, when the real API arrives.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { z } from 'zod';

import { ApiError } from '@/lib/api/api-error';

import { SEED } from '@/mock-api/seed';

/** Records are validated by each feature's schema, so here they are only known to have an id. */
export interface StoredRecord {
  id: string;
}

const SEEDED: Record<keyof typeof SEED, StoredRecord[]> = SEED;

export type CollectionName = keyof typeof SEED;

const NAMES = Object.keys(SEED) as CollectionName[];

/** Bump whenever a collection changes. Existing data stays; new collections get their seed. */
const DB_VERSION = 10;
/**
 * Version 10 replaced the demo data, so a browser on an older version starts again from it.
 * (Some browsers reached version 9 while it still held the old data.)
 */
const RESEED_BELOW = 10;

async function writeSeed(db: IDBPDatabase, names: CollectionName[]) {
  if (names.length === 0) return;
  const tx = db.transaction(names, 'readwrite');
  await Promise.all(
    names.flatMap((name) => {
      const store = tx.objectStore(name);
      const seed = SEEDED[name];
      return [store.clear(), ...seed.map((record) => store.put(record))];
    }),
  );
  await tx.done;
}

export interface MockDb {
  /** Every record, checked against `schema`, as the real API's response would be. */
  list<TSchema extends z.ZodType>(name: CollectionName, schema: TSchema): Promise<z.output<TSchema>[]>;
  get<TSchema extends z.ZodType>(
    name: CollectionName,
    id: string,
    schema: TSchema,
  ): Promise<z.output<TSchema> | undefined>;
  /** Saves a record and returns it, as the real API's response would. */
  put<TRecord extends StoredRecord>(name: CollectionName, record: TRecord): Promise<TRecord>;
  remove(name: CollectionName, id: string): Promise<void>;
  resetToSeed(): Promise<void>;
}

function parsed<TSchema extends z.ZodType>(
  schema: TSchema,
  record: unknown,
  name: string,
): z.output<TSchema> {
  const result = schema.safeParse(record);
  if (!result.success) {
    throw new ApiError({
      kind: 'invalid_response',
      message: `Stored ${name} record does not match its schema`,
      cause: result.error,
    });
  }
  return result.data;
}

export function createMockDb(databaseName: string): MockDb {
  let opened: Promise<IDBPDatabase> | null = null;

  const open = () => {
    opened ??= (async () => {
      const created: CollectionName[] = [];
      const db = await openDB(databaseName, DB_VERSION, {
        upgrade(database, oldVersion) {
          const reseed = oldVersion > 0 && oldVersion < RESEED_BELOW;
          for (const name of [...database.objectStoreNames]) {
            if (reseed || !NAMES.some((known) => known === name)) database.deleteObjectStore(name);
          }
          for (const name of NAMES) {
            if (database.objectStoreNames.contains(name)) continue;
            database.createObjectStore(name, { keyPath: 'id' });
            created.push(name);
          }
        },
        // An old tab must let go, or a newer version in another tab waits on it forever.
        blocking(_current, _blocked, event) {
          (event.target as IDBDatabase).close();
          opened = null;
        },
      });
      await writeSeed(db, created);
      return db;
    })();
    return opened;
  };

  return {
    async list(name, schema) {
      const db = await open();
      const records: unknown[] = await db.getAll(name);
      return records.map((record) => parsed(schema, record, name));
    },
    async get(name, id, schema) {
      const db = await open();
      const record: unknown = await db.get(name, id);
      return record === undefined ? undefined : parsed(schema, record, name);
    },
    async put(name, record) {
      const db = await open();
      await db.put(name, record);
      return record;
    },
    async remove(name, id) {
      const db = await open();
      await db.delete(name, id);
    },
    async resetToSeed() {
      await writeSeed(await open(), NAMES);
    },
  };
}

export const mockDb = createMockDb('nuzul');
