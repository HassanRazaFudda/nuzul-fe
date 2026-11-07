import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { QueryErrorState } from '@/components/feedback/QueryErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { buttonClass } from '@/components/ui/buttonStyles';

export function RouteErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <>
        <PageHeader title="Page not found" />
        <div className="p-5 lg:p-8">
          <Link to="/" className={buttonClass('secondary')}>
            Back to overview
          </Link>
        </div>
      </>
    );
  }

  return (
    <div className="p-5 lg:p-8">
      <QueryErrorState
        error={error}
        onRetry={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
