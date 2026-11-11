import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockDb } from '@/mock-api/db';
import { renderApp } from '@/test/render';

import { conversionRuleSchema } from '../api/room-type.schemas';

const ruleById = (id: string) => mockDb.get('conversionRules', id, conversionRuleSchema);

describe('RoomTypesPage', () => {
  it('is off by default, and turning a pair on is saved', async () => {
    const { user } = renderApp('/room-types');
    const box = await screen.findByRole('switch', { name: 'Sell Quad as Double' });
    expect(box).not.toBeChecked();

    await user.click(box);

    await waitFor(async () => {
      expect((await ruleById('all:quad:double'))?.allowed).toBe(true);
    });
  });

  it('lets one hotel override the default, and go back to it', async () => {
    const { user } = renderApp('/room-types');
    await user.selectOptions(await screen.findByLabelText('Applies to'), 'hotel-artal');
    const select = screen.getByRole('combobox', { name: 'Sell Quad as Triple' });

    await user.selectOptions(select, 'yes');
    await waitFor(async () => {
      expect((await ruleById('hotel-artal:quad:triple'))?.allowed).toBe(true);
    });

    await user.selectOptions(select, 'default');
    await waitFor(async () => {
      expect(await ruleById('hotel-artal:quad:triple')).toBeUndefined();
    });
  });

  it('refuses a duplicate name, and offers new conversions for a new type', async () => {
    const { user } = renderApp('/room-types');
    await user.click(await screen.findByRole('button', { name: 'Add room type' }));
    await user.type(screen.getByLabelText(/^Name/), 'quad');
    await user.type(screen.getByLabelText(/^Guests per room/), '5');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('This room type already exists')).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^Name/));
    await user.type(screen.getByLabelText(/^Name/), 'Quint');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('switch', { name: 'Sell Quint as Double' })).toBeInTheDocument();
  });
});
