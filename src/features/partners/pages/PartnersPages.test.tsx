import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockDb } from '@/mock-api/db';
import { renderApp } from '@/test/render';

import { partnerSchema } from '../api/partner.schemas';

describe('vendors and agents', () => {
  it('starts a form on its first field, so typing never hits the close button', async () => {
    const { user } = renderApp('/vendors');

    await user.click(await screen.findByRole('button', { name: 'Add vendor' }));

    expect(screen.getByLabelText(/^Name/)).toHaveFocus();
  });

  it('refuses an empty name, points to the field, then adds the vendor', async () => {
    const { user } = renderApp('/vendors');
    await user.click(await screen.findByRole('button', { name: 'Add vendor' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const summary = await screen.findByRole('alert');
    expect(within(summary).getByText('Please fix these first')).toBeInTheDocument();
    expect(screen.getByText('Enter the name')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toHaveFocus();
    expect(await mockDb.list('vendors', partnerSchema)).toHaveLength(2);

    await user.type(screen.getByLabelText(/^Name/), 'Al Noor Hotels');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Al Noor Hotels')).toBeInTheDocument();
    expect(await mockDb.list('vendors', partnerSchema)).toHaveLength(3);
  });

  it('rejects a bad email', async () => {
    const { user } = renderApp('/vendors');
    await user.click(await screen.findByRole('button', { name: 'Add vendor' }));
    await user.type(screen.getByLabelText(/^Name/), 'X');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(await mockDb.list('vendors', partnerSchema)).toHaveLength(2);
  });

  it('moves a deactivated vendor to the Inactive tab, without deleting it', async () => {
    const { user } = renderApp('/vendors');

    await user.click(await screen.findByRole('button', { name: 'Deactivate Sample Vendor A' }));
    await waitFor(async () => {
      expect((await mockDb.get('vendors', 'vendor-a', partnerSchema))?.active).toBe(false);
    });
    await user.click(screen.getByRole('tab', { name: /Inactive/ }));

    expect(await screen.findByRole('button', { name: 'Activate Sample Vendor A' })).toBeInTheDocument();
  });

  it('asks before discarding unsaved work', async () => {
    const { user } = renderApp('/agents');
    await user.click(await screen.findByRole('button', { name: 'Add agent' }));
    await user.type(screen.getByLabelText(/^Name/), 'Half typed');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Discard your changes?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument();
    });
    expect(await mockDb.list('agents', partnerSchema)).toHaveLength(2);
  });
});
