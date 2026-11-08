// Public API of the changes feature: what a change does to the ledger, and the history of
// every version. Shared by purchases and contracts.
export { revisionKeys } from './api/revision.queries';
export { revisionsApi } from './api/revisions.api';
export { assertSameStamp, saveSaleChanges } from './api/sale-changes.api';
export type { RevisionAction, RevisionEntity } from './api/revision.schemas';
export { HistoryCard } from './components/HistoryCard';
export { ImpactPreview, type ImpactNames } from './components/ImpactPreview';
export { ImpactReviewDialog } from './components/ImpactReviewDialog';
export { impactOf, lostCover, type Impact, type RecordSet } from './domain/impact';
