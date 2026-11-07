import { z } from 'zod';

/** A vendor or an agent: the same record on the buying and the selling side. */
export const partnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  company: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
});
export type Partner = z.infer<typeof partnerSchema>;

export type PartnerKind = 'vendors' | 'agents';

export const PARTNER_SORT_FIELDS = ['name', 'company'] as const;
export type PartnerSortField = (typeof PARTNER_SORT_FIELDS)[number];

export const ACTIVE_VIEWS = ['active', 'inactive'] as const;
export type ActiveView = (typeof ACTIVE_VIEWS)[number];

export interface PartnerListParams {
  page: number;
  pageSize: number;
  search: string;
  sortBy: PartnerSortField;
  sortDir: 'asc' | 'desc';
  status: ActiveView;
}

export type PartnerUpsertPayload = Omit<Partner, 'id' | 'active'>;
