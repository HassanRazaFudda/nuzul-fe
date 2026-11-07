import type { ChargeBasis, MealBasis } from '../domain/purchase-totals';

export const MEAL_BASIS_LABELS: Record<MealBasis, string> = {
  perPersonPerNight: 'Per person per night',
  perRoomPerNight: 'Per room per night',
  perPersonPerStay: 'Per person per stay',
};

export const CHARGE_BASIS_LABELS: Record<ChargeBasis, string> = {
  fullCapacity: 'Full capacity: the vendor charges for all rooms',
  guestsSold: 'Guests sold: the vendor charges for placed guests',
};
