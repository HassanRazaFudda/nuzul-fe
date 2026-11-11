import { describe, expect, it } from 'vitest';

import { pageOf } from './list-query';

const rows = [
  { hotel: 'A', type: 'Double', free: 4 },
  { hotel: 'B', type: 'Quad', free: -6 },
  { hotel: 'A', type: 'Quad', free: 0 },
  { hotel: 'B', type: 'Triple', free: 9 },
];

describe('pageOf with a group key', () => {
  it('keeps each group together, in the order of its first sorted item', () => {
    const page = pageOf(
      rows,
      { page: 1, pageSize: 10, search: '', sortBy: 'free', sortDir: 'asc' },
      { searchText: (row) => row.type, sortValue: { free: (row) => row.free }, groupKey: (row) => row.hotel },
    );

    expect(page.items.map((row) => `${row.hotel} ${row.type}`)).toEqual([
      'B Quad',
      'B Triple',
      'A Quad',
      'A Double',
    ]);
  });
});
