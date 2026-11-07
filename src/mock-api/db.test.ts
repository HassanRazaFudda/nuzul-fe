import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createMockDb } from './db';

const hotel = z.object({ id: z.string() });

let counter = 0;
const freshDb = () => createMockDb(`nuzul-test-${String(counter++)}`);

describe('the browser database', () => {
  it('starts with the sample data', async () => {
    expect((await freshDb().list('hotels', hotel)).length).toBeGreaterThan(0);
  });

  it('keeps an edit across a reopen, and does not reseed over it', async () => {
    const name = `nuzul-test-${String(counter++)}`;
    await createMockDb(name).put('hotels', { id: 'new' });

    expect(await createMockDb(name).get('hotels', 'new', hotel)).toEqual({ id: 'new' });
  });

  it('goes back to the sample data on reset', async () => {
    const db = freshDb();
    await db.remove('hotels', 'hotel-artal');
    expect(await db.get('hotels', 'hotel-artal', hotel)).toBeUndefined();

    await db.resetToSeed();

    expect(await db.get('hotels', 'hotel-artal', hotel)).toBeDefined();
  });

  it('rejects a stored record that breaks its schema, instead of rendering it', async () => {
    const db = freshDb();
    await db.put('hotels', { id: 'broken' });

    await expect(db.list('hotels', z.object({ id: z.string(), name: z.string() }))).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });
});
