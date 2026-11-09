/** Small, hand-checked data every test starts from. Tests assert its exact figures. */

import adjustments from './adjustments.json';
import agents from './agents.json';
import calendarMonths from './calendarMonths.json';
import cities from './cities.json';
import contracts from './contracts.json';
import conversionRules from './conversionRules.json';
import counters from './counters.json';
import currencies from './currencies.json';
import exchangeRates from './exchangeRates.json';
import hotels from './hotels.json';
import purchases from './purchases.json';
import revisions from './revisions.json';
import roomTypes from './roomTypes.json';
import session from './session.json';
import settings from './settings.json';
import users from './users.json';
import vendors from './vendors.json';

export const SEED = {
  hotels,
  cities,
  vendors,
  agents,
  roomTypes,
  conversionRules,
  calendarMonths,
  currencies,
  exchangeRates,
  purchases,
  counters,
  contracts,
  revisions,
  adjustments,
  users,
  session,
  settings,
};
