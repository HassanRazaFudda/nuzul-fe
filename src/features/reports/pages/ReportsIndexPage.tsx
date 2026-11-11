import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

import { REPORTS } from '../components/report-catalog';

export function ReportsIndexPage() {
  return (
    <>
      <PageHeader title="Reports" subtitle="Every report exports to Excel and prints" />
      <div className="space-y-5 px-(--page-gutter) pt-4 pb-10">
        <Card className="overflow-hidden">
          <ul className="divide-border-subtle divide-y">
            {REPORTS.map((report) => (
              <li key={report.to}>
                <Link
                  to={report.to}
                  className="hover:bg-surface-raised flex items-center gap-4 px-4 py-3 transition-colors duration-150"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground block text-sm font-medium">{report.title}</span>
                    <span className="text-muted text-meta block">{report.text}</span>
                  </span>
                  <ChevronRight aria-hidden className="text-faint size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <p className="text-muted text-xs">Accounting rules pending review by the client&apos;s accountant</p>
      </div>
    </>
  );
}
