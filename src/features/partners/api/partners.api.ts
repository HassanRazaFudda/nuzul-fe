import { mockDb } from '@/mock-api/db';
import { pageOf } from '@/mock-api/list-query';

import {
  partnerSchema,
  type Partner,
  type PartnerKind,
  type PartnerListParams,
  type PartnerUpsertPayload,
} from './partner.schemas';

export const partnersApi = {
  list: async (kind: PartnerKind, params: PartnerListParams) => {
    const partners = await mockDb.list(kind, partnerSchema);
    const inView = partners.filter((partner) => partner.active === (params.status === 'active'));
    return {
      ...pageOf(inView, params, {
        searchText: ({ name, company, contactPerson, phone, email }) =>
          [name, company, contactPerson, phone, email].join(' '),
        sortValue: { name: (partner) => partner.name, company: (partner) => partner.company ?? '' },
      }),
      counts: {
        active: partners.filter((partner) => partner.active).length,
        inactive: partners.filter((partner) => !partner.active).length,
      },
    };
  },

  options: async (kind: PartnerKind) => {
    const partners = await mockDb.list(kind, partnerSchema);
    return partners.filter((partner) => partner.active).sort((a, b) => a.name.localeCompare(b.name));
  },

  create: (kind: PartnerKind, payload: PartnerUpsertPayload) =>
    mockDb.put(kind, { ...payload, id: crypto.randomUUID(), active: true } satisfies Partner),

  update: (kind: PartnerKind, partner: Partner, payload: PartnerUpsertPayload) =>
    mockDb.put(kind, { ...partner, ...payload }),

  setActive: (kind: PartnerKind, partner: Partner, active: boolean) =>
    mockDb.put(kind, { ...partner, active }),
};
