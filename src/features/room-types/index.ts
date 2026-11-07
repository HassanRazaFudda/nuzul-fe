// Public API of the room-types feature. Other features import ONLY from here.
export { roomTypeRoutes } from './routes';
export { conversionRulesQuery, roomTypesQuery } from './api/room-type.queries';
export { isConversionAllowed, type ConversionRule, type RoomType } from './domain/conversion';
