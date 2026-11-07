import { z } from 'zod';

import type { Hotel } from '@/features/hotels';
import type { RoomType } from '@/features/room-types';

const MAX_ROOMS = 9999;

const isoDateOrNothing = z.iso.date().optional().catch(undefined);

const prefillSchema = z.object({
  hotel: z.string().optional(),
  roomType: z.string().optional(),
  checkIn: isoDateOrNothing,
  checkOut: isoDateOrNothing,
  rooms: z.coerce.number().int().min(1).max(MAX_ROOMS).optional().catch(undefined),
});

export interface PurchasePrefill {
  hotelId?: string | undefined;
  roomType?: RoomType | undefined;
  checkIn?: string | undefined;
  checkOut?: string | undefined;
  rooms?: number | undefined;
}

/**
 * Reads a suggested purchase from the address, as the ledger's Purchase action sends it.
 * Null when there is none. Anything that makes no sense is dropped, never trusted.
 */
export function readPrefill(
  search: URLSearchParams,
  hotels: readonly Hotel[],
  roomTypes: readonly RoomType[],
): PurchasePrefill | null {
  if (search.size === 0) return null;
  const { hotel, roomType, checkIn, checkOut, rooms } = prefillSchema.parse(Object.fromEntries(search));
  return {
    hotelId: hotels.find((item) => item.id === hotel)?.id,
    roomType: roomTypes.find((item) => item.id === roomType),
    checkIn,
    checkOut,
    rooms,
  };
}
