import { z } from 'zod';

export const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalItems: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export function paginatedSchema<TItem extends z.ZodType>(item: TItem) {
  return z.object({ items: z.array(item), meta: paginationMetaSchema });
}

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export interface Paginated<TItem> {
  items: TItem[];
  meta: PaginationMeta;
}

export type SortDirection = 'asc' | 'desc';

export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/** What every list endpoint accepts. A feature narrows `sortBy` and adds filters. */
export interface ListParams<TSort extends string = string> {
  page: number;
  pageSize: number;
  search: string;
  sortBy: TSort;
  sortDir: SortDirection;
}
