import { rowSortingFeature, tableFeatures, type ColumnDef } from '@tanstack/react-table';

/**
 * Server-driven tables register only the features they use (tree-shaken in Table v9).
 * Sorting and pagination run on the server, so no client row models are registered.
 */
export const serverTableFeatures = tableFeatures({ rowSortingFeature });
export type ServerTableFeatures = typeof serverTableFeatures;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TValue varies per column; this is the library's documented pattern for heterogeneous column arrays.
export type ServerColumnDef<TData extends object> = ColumnDef<ServerTableFeatures, TData, any>;
