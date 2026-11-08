import { keepPreviousData, queryOptions } from '@tanstack/react-query';

import type { ReportParams, SalesParams } from './report.schemas';
import { reportsApi } from './reports.api';

// Reports are worked out from current records, which change in other features, so a cached
// answer is never treated as fresh.
const ALWAYS_STALE = 0;

export const reportKeys = {
  all: ['reports'] as const,
  of: (report: string, params: ReportParams | SalesParams) => [...reportKeys.all, report, params] as const,
};

const report = <T>(name: string, params: ReportParams | SalesParams, fetch: () => Promise<T>) =>
  queryOptions({
    queryKey: reportKeys.of(name, params),
    queryFn: fetch,
    placeholderData: keepPreviousData,
    staleTime: ALWAYS_STALE,
  });

export const profitAndLossQuery = (params: ReportParams) =>
  report('pnl', params, () => reportsApi.profitAndLoss(params));
export const contractProfitQuery = (params: ReportParams) =>
  report('contracts', params, () => reportsApi.contractProfit(params));
export const vendorMarginQuery = (params: ReportParams) =>
  report('vendors', params, () => reportsApi.vendorMargin(params));
export const inventoryReportQuery = (params: ReportParams) =>
  report('inventory', params, () => reportsApi.inventory(params));
export const salesReportQuery = (params: SalesParams) =>
  report('sales', params, () => reportsApi.sales(params));
