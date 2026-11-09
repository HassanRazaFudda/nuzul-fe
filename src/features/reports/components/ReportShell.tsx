import type { UseQueryResult } from '@tanstack/react-query';
import { Download, Printer } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { QueryErrorState } from '@/components/feedback/QueryErrorState';
import { TableSkeleton } from '@/components/feedback/TableSkeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/api/api-error';
import { useCan } from '@/lib/auth/session';
import { saveWorkbook, type WorkbookSheet } from '@/lib/export/workbook';

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
        subtitle={[subtitle, `Amounts in ${currency}`].filter(Boolean).join(' · ')}
        action={
          <div className="flex flex-wrap gap-2 print:hidden">
            {canExport && (
              <Button
                variant="secondary"
                icon={<Download aria-hidden className="size-4" />}
                disabled={!data}
                isLoading={isExporting}
                onClick={() => void handleExport()}
              >
                Export to Excel
              </Button>
            )}
            <Button
              variant="secondary"
              icon={<Printer aria-hidden className="size-4" />}
              disabled={!data}
              onClick={() => {
                window.print();
              }}
            >
              Print / PDF
            </Button>
          </div>
        }
      />
      <div className="space-y-5 p-5 lg:p-8 print:p-0">
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
