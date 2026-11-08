import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderApp } from '@/test/render';

describe('the app shell', () => {
  it('opens on the overview, with figures from the sample data', async () => {
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(await screen.findByText('Calendar months')).toBeInTheDocument();
    expect(screen.getByText('This is a prototype')).toBeInTheDocument();
  });

  it('collapses the sidebar and keeps every link reachable by name', async () => {
    const { user } = renderApp('/');
    await screen.findByRole('heading', { name: 'Overview' });

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Rooms ledger' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }));
  });

  it('shows a way back from an unknown address', async () => {
    renderApp('/nope');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('moves focus to the page after a route change', async () => {
    const { user } = renderApp('/');
    await screen.findByRole('heading', { name: 'Overview' });

    await user.click(screen.getByRole('link', { name: 'Reports' }));

    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveFocus();
  });
});
