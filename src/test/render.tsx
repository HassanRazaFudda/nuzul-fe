import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from '@/app/App';
import { createAppRouter } from '@/app/router';
import { createQueryClient } from '@/app/query-client';
import { createMemoryRouter } from 'react-router';

/** Renders the real app at a URL: real routes, real QueryClient, the mock backend behind them. */
export function renderApp(route: string) {
  const queryClient = createQueryClient({ retry: false });
  const router = createAppRouter(queryClient, (routes) =>
    createMemoryRouter(routes, { initialEntries: [route] }),
  );
  const user = userEvent.setup();
  render(<App queryClient={queryClient} router={router} />);
  return { user, router, queryClient };
}
