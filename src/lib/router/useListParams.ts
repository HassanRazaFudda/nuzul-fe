import { useSearchParams } from 'react-router';
import { z } from 'zod';

import { PAGE_SIZES, type ListParams } from '@/lib/api/pagination';

interface ListParamsConfig<TSort extends string, TStatus extends string> {
  sortFields: readonly [TSort, ...TSort[]];
  defaultSortBy: TSort;
  defaultSortDir?: 'asc' | 'desc';
  statuses: readonly [TStatus, ...TStatus[]];
  defaultStatus: TStatus;
}

export type StatusListParams<TSort extends string, TStatus extends string> = ListParams<TSort> & {
  status: TStatus;
};

/**
 * Builds a hook keeping a list's filters, sort and page in the URL: shareable, survives a
 * reload, works with the back button. `.catch()` makes a hand-edited URL fall back to the
 * defaults instead of crashing. Call it at module scope, once per list.
 */
export function createListParams<TSort extends string, TStatus extends string>({
  sortFields,
  defaultSortBy,
  defaultSortDir = 'asc',
  statuses,
  defaultStatus,
}: ListParamsConfig<TSort, TStatus>) {
  const schema = z.object({
    page: z.coerce.number().int().min(1).catch(1),
    pageSize: z.coerce
      .number()
      .refine((value) => PAGE_SIZES.some((size) => size === value))
      .catch(25),
    search: z.string().trim().max(100).catch(''),
    sortBy: z.enum(sortFields).catch(defaultSortBy as never),
    sortDir: z.enum(['asc', 'desc']).catch(defaultSortDir),
    status: z.enum(statuses).catch(defaultStatus as never),
  });

  const parse = (raw: Record<string, string>) => schema.parse(raw) as StatusListParams<TSort, TStatus>;
  const defaults = parse({});

  return function useListParams() {
    const [searchParams, setSearchParams] = useSearchParams();
    const params = parse(Object.fromEntries(searchParams));

    function updateParams(patch: Partial<StatusListParams<TSort, TStatus>>) {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          const merged: StatusListParams<TSort, TStatus> = { ...params, ...patch };
          // Any filter or sort change goes back to page 1, unless the patch sets the page.
          if (!('page' in patch)) merged.page = 1;
          for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
            const value = merged[key];
            if (value === defaults[key]) next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: true },
      );
    }

    return { params, updateParams };
  };
}
