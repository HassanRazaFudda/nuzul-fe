import type { UseQueryResult } from '@tanstack/react-query';
import { Download, Printer } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';

import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { QueryErrorState } from '@/components/feedback/QueryErrorState';
import { TableSkeleton } from '@/components/feedback/TableSkeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/api/api-error';
import { useCan } from '@/lib/auth/session';
import { cn } from '@/lib/cn';
import { saveWorkbook, type WorkbookSheet } from '@/lib/export/workbook';

import { REPORTS } from './report-catalog';

interface ReportShellProps<TData> {
  title: string;
  /** What the report counts by, when the title alone leaves it open. */
  subtitle?: string | undefined;
  /** The currency every amount is in. Named once, under the title, so it prints too. */
  currency: string;
  /** One quiet line under the report. */
  footnote?: string;
  query: UseQueryResult<TData>;
  filters: ReactNode;
  /** The sheets to save, from the data on screen. */
  sheets: (data: TData) => WorkbookSheet[];
  fileName: string;
  children: (data: TData) => ReactNode;
}

/** The parts every report shares: filters, the four states, Excel, and print or PDF. */
export function ReportShell<TData>({
  title,
  subtitle,
  currency,
  footnote,
  query,
  filters,
  sheets,
  fileName,
  children,
}: ReportShellProps<TData>) {
  const { data, error, isPending, refetch } = query;
  const [isExporting, setIsExporting] = useState(false);
  const canExport = useCan()('report.export');
  const [exportError, setExportError] = useState<unknown>(null);

  async function handleExport() {
    if (!data) return;
    setExportError(null);
    setIsExporting(true);
    try {
      await saveWorkbook(sheets(data), fileName);
    } catch (failure) {
      setExportError(failure);
    }
    setIsExporting(false);
  }

  return (
    <>
      <PageHeader
        title={title}
        breadcrumbs={[{ label: 'Reports', to: '/reports' }]}
        subtitle={[subtitle, `Amounts in ${currency}`].filter(Boolean).join(' · ')}
        action={
          <div className="flex flex-wrap gap-2 print:hidden">
            {canExport && (
              <Button
                variant="secondary"
                icon={<Download aria-hidden />}
                disabled={!data}
                isLoading={isExporting}
                onClick={() => void handleExport()}
              >
                Export to Excel
              </Button>
            )}
            <Button
              variant="secondary"
              icon={<Printer aria-hidden />}
              disabled={!data}
              onClick={() => {
                window.print();
              }}
            >
              Print
            </Button>
          </div>
        }
      />
      <div className="space-y-4 px-(--page-gutter) pt-4 pb-10 print:p-0">
        <nav aria-label="Reports" className="-mx-1 flex gap-1 overflow-x-auto px-1 print:hidden">
          {REPORTS.map((report) => (
            <NavLink
              key={report.to}
              to={report.to}
              className={({ isActive }) =>
                cn(
                  'rounded-pill text-meta inline-flex h-7 shrink-0 items-center px-3 whitespace-nowrap transition-colors duration-150',
                  isActive
                    ? 'bg-surface text-foreground shadow-raised ring-border font-medium ring-1'
                    : 'text-secondary hover:bg-surface-muted hover:text-foreground',
                )
              }
            >
              {report.short}
            </NavLink>
          ))}
        </nav>
        {filters}
        {exportError !== null && (
          <ErrorNotice title="The file could not be saved">{getErrorMessage(exportError)}</ErrorNotice>
        )}
        {isPending ? (
          <TableSkeleton rows={6} columns={5} />
        ) : !data ? (
          <QueryErrorState error={error} onRetry={() => void refetch()} />
        ) : (
          children(data)
        )}
        {footnote && <p className="text-muted text-xs">{footnote}</p>}
      </div>
    </>
  );
}
