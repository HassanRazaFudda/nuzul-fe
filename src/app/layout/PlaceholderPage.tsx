import { Construction } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

interface PlaceholderPageProps {
  title: string;
  purpose: string;
}

/** Stands in for a module until it is built, and says what it will do. */
export function PlaceholderPage({ title, purpose }: PlaceholderPageProps) {
  return (
    <>
      <PageHeader title={title} />
      <div className="px-(--page-gutter) pt-4 pb-10">
        <Card>
          <EmptyState
            icon={<Construction aria-hidden className="size-8" />}
            title="Not built yet"
            hint={purpose}
          />
        </Card>
      </div>
    </>
  );
}
