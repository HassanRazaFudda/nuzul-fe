import type { ListParams, Paginated } from '@/lib/api/pagination';

interface ListQueryConfig<TItem, TSort extends string> {
  /** Text the search box looks through. */
  searchText: (item: TItem) => string;
  sortValue: Record<TSort, (item: TItem) => string | number>;
}

/** Does on the "server" what the real API will: search, sort, then one page. */
export function pageOf<TItem, TSort extends string>(
  items: readonly TItem[],
  { page, pageSize, search, sortBy, sortDir }: ListParams<TSort>,
  { searchText, sortValue }: ListQueryConfig<TItem, TSort>,
): Paginated<TItem> {
  const needle = search.trim().toLowerCase();
  const filtered = needle ? items.filter((item) => searchText(item).toLowerCase().includes(needle)) : items;

  const value = sortValue[sortBy];
  const sorted = [...filtered].sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return sortDir === 'asc' ? order : -order;
  });

  const totalItems = sorted.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const lastPage = Math.max(totalPages, 1);
  const current = Math.min(page, lastPage);
  return {
    items: sorted.slice((current - 1) * pageSize, current * pageSize),
    meta: { page: current, pageSize, totalItems, totalPages },
  };
}
