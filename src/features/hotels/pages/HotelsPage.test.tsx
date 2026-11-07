import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockDb } from '@/mock-api/db';
import { renderApp } from '@/test/render';

import { hotelSchema } from '../api/hotel.schemas';

describe('HotelsPage', () => {
  it('adds a hotel in a new city, and rejects a bad rate', async () => {
    const { user } = renderApp('/hotels');
    await user.click(await screen.findByRole('button', { name: 'Add hotel' }));
    await user.type(screen.getByLabelText(/^Hotel name/), 'Taif Inn');
    await user.click(screen.getByRole('button', { name: 'Add a city' }));
    await user.type(screen.getByLabelText('New city name'), 'Taif');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      expect(screen.getByLabelText(/^City/)).toHaveValue('Taif');
    });

    await user.type(screen.getByLabelText('Double room rate'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a number, with up to 4 decimals')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Double room rate'));
    await user.type(screen.getByLabelText('Double room rate'), '420.50');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Taif Inn')).toBeInTheDocument();
    expect(await screen.findByText('SAR 420.50')).toBeInTheDocument();
    const hotels = await mockDb.list('hotels', hotelSchema);
    expect(hotels.find((hotel) => hotel.name === 'Taif Inn')?.doubleRate).toBe('420.50');
  });

  it('reads the view from the URL and writes tab changes back to it', async () => {
    const { user, router } = renderApp('/hotels?status=inactive');
    expect(await screen.findByText('No inactive hotels')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^Active/ }));

    expect(router.state.location.search).toBe('');
    expect(await screen.findByText('Artal International')).toBeInTheDocument();
  });

  it('searches on Enter, keeps it in the URL, and says when nothing matches', async () => {
    const { user, router } = renderApp('/hotels');
    await screen.findByText('Artal International');

    await user.type(screen.getByRole('searchbox', { name: 'Search Hotels' }), 'zzz{Enter}');

    expect(await screen.findByText('Nothing matches “zzz”')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?search=zzz');
  });

  it('sorts through the URL', async () => {
    const { user, router } = renderApp('/hotels');
    await screen.findByText('Artal International');

    await user.click(screen.getByRole('button', { name: 'City' }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('?sortBy=city');
    });
  });
});
