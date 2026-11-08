import type { UseQueryResult } from '@tanstack/react-query';
import { Download, Printer } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { QueryErrorState } from '@/components/feedback/QueryErrorState';
import { TableSkeleton } from '@/components/feedback/TableSkeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/api/api-error';
import { saveWorkbook, type WorkbookSheet } from '@/lib/export/workbook';

interface ReportShellProps<TData> {
  title: string;
  subtitle: string;
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
  query,
  filters,
  sheets,
  fileName,
  children,
}: ReportShellProps<TData>) {
  const { data, error, isPending, refetch } = query;
  const [isExporting, setIsExporting] = useState(false);
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
        subtitle={subtitle}
        action={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              variant="secondary"
              icon={<Download aria-hidden className="size-4" />}
              disabled={!data}
              isLoading={isExporting}
              onClick={() => void handleExport()}
            >
              Export to Excel
            </Button>
            <Button
              variant="secondary"
              icon={<Printer aria-hidden className="size-4" />}
              disabled={!data}
              onClick={() => {
                window.print();
              }}
            >
              Print or save as PDF
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
        <p className="text-muted text-xs">
          Worked out from current records on every view. These accounting rules still need the client&apos;s
          accountant to confirm them before the figures are relied on.
        </p>
      </div>
    </>
  );
}
