import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderApp } from '@/test/render';

describe('DesignSystemPage', () => {
  it('sorts the table both ways, with the state read from the night grid', async () => {
    const { user } = renderApp('/design');
    const table = await screen.findByRole('table', { name: 'Sample ledger' });
    const sortButton = within(table).getByRole('button', { name: 'Available' });
    const firstRow = () => within(within(table).getAllByRole('row')[1] ?? table);

    // Numbers sort largest first on the first click.
    await user.click(sortButton);
    expect(firstRow().getByText('Available: 89')).toBeInTheDocument();

    await user.click(sortButton);
    expect(firstRow().getByText('Overbooked by 16')).toBeInTheDocument();
  });
});
