import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

import { useAddCity } from '../api/hotel.queries';
import type { City } from '../api/hotel.schemas';

const focusOnMount = (element: HTMLInputElement | null) => {
  element?.focus();
};

interface AddCityProps {
  cities: readonly City[];
  onAdded: (name: string) => void;
}

/** Adds a city to the list from inside the hotel form, so staff need not leave it. */
export function AddCity({ cities, onAdded }: AddCityProps) {
  const addCity = useAddCity();
  const [draft, setDraft] = useState<string | null>(null);

  async function handleAdd() {
    const name = draft?.trim();
    if (!name) return;
    const existing = cities.find((city) => city.name.toLowerCase() === name.toLowerCase());
    if (!existing) await addCity.mutateAsync(name);
    onAdded(existing?.name ?? name);
    setDraft(null);
  }

  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft('');
        }}
        className="text-primary-strong mt-1 text-xs underline"
      >
        Add a city
      </button>
    );
  }

  return (
    <div className="mt-2 flex gap-2">
      <Input
        ref={focusOnMount}
        aria-label="New city name"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault(); // Enter here adds the city; it must not submit the hotel form.
            void handleAdd();
          }
        }}
      />
      <Button variant="secondary" onClick={() => void handleAdd()} isLoading={addCity.isPending}>
        Add
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          setDraft(null);
        }}
      >
        Cancel
      </Button>
    </div>
  );
}
