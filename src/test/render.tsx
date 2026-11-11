import { render, screen } from '@testing-library/react';
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

/**
 * Opens a "…" menu and picks one of its actions. Rare actions such as Lock, Terminate and
 * Cancel live in a menu, never as buttons in the header.
 */
export async function chooseFromMenu(
  user: ReturnType<typeof userEvent.setup>,
  trigger: string | RegExp,
  item: string,
) {
  await user.click(await screen.findByRole('button', { name: trigger }));
  // A menu item's name is its label, then any hint under it.
  await user.click(
    await screen.findByRole('menuitem', { name: (name) => name === item || name.startsWith(item) }),
  );
}
