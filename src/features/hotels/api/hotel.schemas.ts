import { z } from 'zod';

export const hotelSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  active: z.boolean(),
  /** Reference rates only pre-fill forms; they are never a cost or a sale price. */
  rateCurrency: z.string().optional(),
  flatRate: z.string().optional(),
  doubleRate: z.string().optional(),
  extraBedRate: z.string().optional(),
});
export type Hotel = z.infer<typeof hotelSchema>;

export const citySchema = z.object({ id: z.string(), name: z.string() });
export type City = z.infer<typeof citySchema>;

export const HOTEL_SORT_FIELDS = ['name', 'city'] as const;
export type HotelSortField = (typeof HOTEL_SORT_FIELDS)[number];

export const ACTIVE_VIEWS = ['active', 'inactive'] as const;
export type ActiveView = (typeof ACTIVE_VIEWS)[number];

export interface HotelListParams {
  page: number;
  pageSize: number;
  search: string;
  sortBy: HotelSortField;
  sortDir: 'asc' | 'desc';
  status: ActiveView;
}

export type HotelUpsertPayload = Omit<Hotel, 'id' | 'active'>;
