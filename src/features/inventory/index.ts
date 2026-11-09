// Public API of the inventory feature. Other features import ONLY from here.
export { ledgerRoutes } from './routes';
export { ledgerKeys, ledgerSourcesQuery, overbookedPoolsQuery, seasonPoolsQuery } from './api/ledger.queries';
export type { PoolSummary, SeasonOverview } from './api/ledger.schemas';
export type { SeasonNight } from './domain/pools';
export { contractRecordSchema, loadLedgerSources } from './api/ledger-sources.api';
export {
  allocationProblems,
  fewestFree,
  freeOnNight,
  suggestAllocation,
  trimToFree,
  unallocatedBlocks,
  type Allocation,
  type AllocationProblem,
  type Stay,
  type Supply,
  type TakenRooms,
} from './domain/allocation';
export {
  countingPurchases,
  saleKey,
  type LedgerPurchase,
  type LedgerSale,
  type LedgerSources,
} from './domain/ledger-sources';
export { InventoryStateTag } from './components/InventoryStateTag';
export { UnknownCost } from './components/UnknownCost';
export {
  computeLedger,
  nightState,
  worstShortage,
  type LedgerEntry,
  type LedgerNightRow,
  type NightState,
  type LedgerOutput,
} from './domain/ledger-engine';
export {
  buildPools,
  poolLedger,
  type Pool,
  type PoolPurchaseInput,
  type PoolSaleInput,
} from './domain/pools';
