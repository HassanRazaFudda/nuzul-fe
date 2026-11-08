import { Link } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

const REPORTS = [
  {
    to: '/profit-loss',
    title: 'Profit & loss',
    text: 'Earnings on rooms used in a period, at the weighted average cost, with room and meal margins.',
  },
  {
    to: '/reports/contracts',
    title: 'Contract profitability',
    text: 'How the contracts signed in a period did.',
  },
  {
    to: '/reports/vendors',
    title: 'Vendor-wise margin',
    text: "Vendors compared at their actual rates, through each sale's vendor allocation.",
  },
  { to: '/reports/sales', title: 'Sales', text: 'What was sold, by date, agent, hotel or vendor.' },
  {
    to: '/reports/inventory',
    title: 'Sold and unsold inventory',
    text: 'Room-nights per hotel, room type and night.',
  },
  {
    to: '/reports/exposure',
    title: 'Unsold cost exposure',
    text: 'The cost of purchased nights nobody bought.',
  },
] as const;

export function ReportsIndexPage() {
  return (
    <>
      <PageHeader title="Reports" subtitle="Each one exports to Excel and prints or saves as PDF" />
      <ul className="grid gap-4 p-5 sm:grid-cols-2 lg:p-8 xl:grid-cols-3">
        {REPORTS.map((report) => (
          <li key={report.to}>
            <Card className="h-full">
              <Link to={report.to} className="hover:bg-background block h-full p-5">
                <h2 className="text-primary-strong text-sm font-semibold">{report.title}</h2>
                <p className="text-muted mt-1 text-sm">{report.text}</p>
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
