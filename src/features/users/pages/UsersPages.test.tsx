import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { contractSchema } from '@/features/contracts';
import { purchaseSchema } from '@/features/purchases';
import { mockDb } from '@/mock-api/db';
import { setSession, userRecordSchema } from '@/mock-api/session';
import { chooseFromMenu, renderApp } from '@/test/render';

import { usersApi } from '../api/users.api';

const signInAs = (userId: string | null) => setSession(userId);

describe('signing in', () => {
  it('sends you to sign in when nobody is, and in as the chosen user', async () => {
    await signInAs(null);
    const { user, router } = renderApp('/purchases');

    await user.click(await screen.findByRole('button', { name: /^Sample Sales/ }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(await screen.findByText('Sample Sales')).toBeInTheDocument();
  });

  it('switching user signs out to the sign-in screen', async () => {
    const { user, router } = renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Switch user' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sign-in');
    });
  });
});

describe('what each person sees', () => {
  it('hides menu areas and buttons without the permission', async () => {
    await signInAs('user-sales');
    renderApp('/contracts/contract-3');

    expect(await screen.findByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).queryByRole('link', { name: 'Purchases' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Profit & loss' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Sales contracts' })).toBeInTheDocument();
  });

  it('shows no Add hotel button to someone who cannot manage the directory', async () => {
    await signInAs('user-sales');
    renderApp('/hotels');

    expect(await screen.findByText('Artal International')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New hotel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Deactivate/ })).not.toBeInTheDocument();
  });

  it('is refused by the server even when a screen is bypassed', async () => {
    await signInAs('user-accounts');

    await expect(usersApi.create('Sneaky')).rejects.toMatchObject({ kind: 'forbidden' });
    await expect(mockDb.list('users', userRecordSchema)).resolves.toHaveLength(4);
  });

  it('keeps an overbooking confirm a Draft without the override', async () => {
    await signInAs('user-sales');
    const sales = await mockDb.get('users', 'user-sales', userRecordSchema);
    await mockDb.put('users', {
      ...sales,
      id: 'user-sales',
      permissions: sales?.permissions.filter((permission) => permission !== 'inventory.override_overbooking'),
    });
    // CON-0003 sells 2 Quad at Swissotel, where nothing is bought, so it would overbook.
    const { user } = renderApp('/contracts/contract-3');

    await user.click(await screen.findByRole('button', { name: 'Confirm' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/needs a permission you do not hold/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Confirm with overbooking' })).toBeDisabled();
    expect((await mockDb.get('contracts', 'contract-3', contractSchema))?.status).toBe('draft');
  });
});

describe('permissions', () => {
  it('applies a template, saves it, and records who did it', async () => {
    await mockDb.put('users', { id: 'user-new', name: 'New Person', active: true, permissions: [] });
    const { user, router } = renderApp('/users/user-new');

    await user.selectOptions(await screen.findByLabelText('Apply a template'), 'Viewer');
    expect(screen.getByRole('checkbox', { name: /See purchases/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save permissions' }));

    await waitFor(async () => {
      expect((await mockDb.get('users', 'user-new', userRecordSchema))?.permissions).toContain(
        'purchase.view',
      );
    });
    await router.navigate('/audit?entity=user');
    const log = await screen.findByRole('list', { name: 'Audit entries' });
    const entries = within(log)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(entries.some((text) => text.startsWith('Sample Admin · Permissions changed · User'))).toBe(true);
  });

  it('cannot tick what the signed-in user does not hold', async () => {
    await mockDb.put('users', {
      id: 'user-assigner',
      name: 'Assigner',
      active: true,
      permissions: ['permission.assign', 'purchase.view'],
    });
    await signInAs('user-assigner');

    renderApp('/users/user-sales');

    expect(await screen.findByRole('checkbox', { name: /See purchases/ })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: /See the audit log/ })).toBeDisabled();
  });
});

describe('lock and restore', () => {
  it('a locked purchase still counts, offers no edit, and unlocks', async () => {
    const { user } = renderApp('/purchases/purchase-1');
    await chooseFromMenu(user, /^More actions/, 'Lock');

    expect(await screen.findByRole('button', { name: 'Unlock' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect((await mockDb.get('purchases', 'purchase-1', purchaseSchema))?.status).toBe('locked');

    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByRole('link', { name: 'Edit' })).toBeInTheDocument();
  });

  it('restores a cancelled contract after the preview and a reason', async () => {
    const { user } = renderApp('/contracts/contract-4');
    await user.click(await screen.findByRole('button', { name: 'Restore' }));
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: /^Restore contract/ }));
    expect(await within(dialog).findByText('Enter the reason for this change')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/^Reason/), 'Cancelled by mistake');
    await user.click(within(dialog).getByRole('button', { name: /^Restore contract/ }));

    await waitFor(async () => {
      expect((await mockDb.get('contracts', 'contract-4', contractSchema))?.status).toBe('confirmed');
    });
    expect(await screen.findByText('Cancelled by mistake')).toBeInTheDocument();
  });
});

describe('the audit log', () => {
  it('needs its permission, and keeps filters in the URL', async () => {
    const { user, router } = renderApp('/audit');
    await screen.findByRole('heading', { name: 'Audit log' });

    await user.selectOptions(screen.getByLabelText('Action'), 'signed-in');

    expect(router.state.location.search).toBe('?action=signed-in');
  });

  it('is refused without the permission', async () => {
    await signInAs('user-sales');
    renderApp('/audit');

    expect(await screen.findByText('You do not have permission to perform this action.')).toBeInTheDocument();
  });
});
