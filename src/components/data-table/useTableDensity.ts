import { useState } from 'react';

const STORAGE_KEY = 'nuzul.table.compact';

function readCompact(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false; // storage blocked: fall back to the default density
  }
}

/** A device-only preference, so tables stay as the user left them. */
export function useTableDensity() {
  const [isCompact, setIsCompact] = useState(readCompact);

  function setCompact(next: boolean) {
    setIsCompact(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      // storage blocked: the preference simply lasts for this page view
    }
  }

  return { isCompact, setCompact };
}
