import type { RevisionAction, RevisionEntity } from './revision.schemas';

export const ACTION_LABELS: Record<RevisionAction, string> = {
  created: 'Created',
  edited: 'Edited',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  terminated: 'Terminated',
  'vendor-released': 'Vendor rooms released',
  'line-cancelled': 'Line cancelled',
  're-sourced': 'Re-sourced',
  'overbooking-accepted': 'Overbooking accepted',
  locked: 'Locked',
  unlocked: 'Unlocked',
  restored: 'Restored',
  deleted: 'Deleted',
  activated: 'Activated',
  deactivated: 'Deactivated',
  'rate-added': 'Rate added',
  'permissions-changed': 'Permissions changed',
  'signed-in': 'Signed in',
  'signed-out': 'Signed out',
};

export const ENTITY_LABELS: Record<RevisionEntity, string> = {
  purchase: 'Purchase',
  contract: 'Contract',
  hotel: 'Hotel',
  city: 'City',
  vendor: 'Vendor',
  agent: 'Agent',
  roomType: 'Room type',
  conversionRule: 'Conversion rule',
  calendarMonth: 'Calendar month',
  currency: 'Currency',
  user: 'User',
  session: 'Sign-in',
  settings: 'Settings',
};
