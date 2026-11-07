import { Button } from '@/components/ui/Button';
import { getErrorMessage, isApiError } from '@/lib/api/api-error';

import { ErrorNotice } from './ErrorNotice';

interface QueryErrorStateProps {
  error: unknown;
  onRetry?: () => void;
}

export function QueryErrorState({ error, onRetry }: QueryErrorStateProps) {
  const canRetry =
    onRetry && !(isApiError(error) && (error.kind === 'forbidden' || error.kind === 'not_found'));
  return (
    <ErrorNotice
      title={getErrorMessage(error)}
      action={
        canRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  );
}
