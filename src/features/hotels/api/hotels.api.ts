import { mockDb } from '@/mock-api/db';
import { saveAudited } from '@/mock-api/session';
import { pageOf } from '@/mock-api/list-query';

import {
  citySchema,
  hotelSchema,
  type Hotel,
  type HotelListParams,
  type HotelUpsertPayload,
} from './hotel.schemas';

export const hotelsApi = {
  list: async (params: HotelListParams) => {
    const hotels = await mockDb.list('hotels', hotelSchema);
    const inView = hotels.filter((hotel) => hotel.active === (params.status === 'active'));
    return {
      ...pageOf(inView, params, {
        searchText: (hotel) => `${hotel.name} ${hotel.city}`,
        sortValue: { name: (hotel) => hotel.name, city: (hotel) => hotel.city },
      }),
      counts: {
        active: hotels.filter((hotel) => hotel.active).length,
        inactive: hotels.filter((hotel) => !hotel.active).length,
      },
    };
  },

  options: async () => {
    const hotels = await mockDb.list('hotels', hotelSchema);
    return hotels.filter((hotel) => hotel.active).sort((a, b) => a.name.localeCompare(b.name));
  },

  create: (payload: HotelUpsertPayload) =>
    saveAudited('directory.manage', 'hotels', 'hotel', 'created', {
      ...payload,
      id: crypto.randomUUID(),
      active: true,
    } satisfies Hotel),

  update: (hotel: Hotel, payload: HotelUpsertPayload) =>
    saveAudited('directory.manage', 'hotels', 'hotel', 'edited', { ...hotel, ...payload }),

  setActive: (hotel: Hotel, active: boolean) =>
    saveAudited('directory.manage', 'hotels', 'hotel', active ? 'activated' : 'deactivated', {
      ...hotel,
      active,
    }),

  cities: () => mockDb.list('cities', citySchema),

  addCity: (name: string) =>
    saveAudited('directory.manage', 'cities', 'city', 'created', { id: crypto.randomUUID(), name }),
};
