import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

const REPORTS = [
  {
    to: '/profit-loss',
    title: 'Profit & loss',
    text: 'Rooms used in a period, at the weighted average cost, with room and meal margins',
  },
  { to: '/reports/contracts', title: 'Contract profitability', text: 'Contracts signed in a period' },
  { to: '/reports/vendors', title: 'Vendor-wise margin', text: 'Each vendor at their actual rates' },
  { to: '/reports/sales', title: 'Sales', text: 'By date, agent, hotel or vendor' },
  {
    to: '/reports/inventory',
    title: 'Sold and unsold inventory',
    text: 'Room-nights per hotel, room type and night',
  },
  { to: '/reports/exposure', title: 'Unsold cost exposure', text: 'The cost of purchased nights not sold' },
] as const;

export function ReportsIndexPage() {
  return (
    <>
      <PageHeader title="Reports" />
      <div className="space-y-3 p-5 lg:p-8">
        <Card className="overflow-hidden">
          <ul className="divide-border divide-y">
            {REPORTS.map((report) => (
              <li key={report.to}>
                <Link
                  to={report.to}
                  className="hover:bg-background flex items-center gap-4 px-5 py-3.5 transition-colors duration-150"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground block text-sm font-medium">{report.title}</span>
                    <span className="text-muted block text-[0.8125rem]">{report.text}</span>
                  </span>
                  <ChevronRight aria-hidden className="text-faint size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <p className="text-muted text-xs">
          Every report exports to Excel and prints. Accounting rules pending review by the client&apos;s
          accountant
        </p>
      </div>
    </>
  );
}
