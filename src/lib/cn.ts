import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Teach the merger our custom radius and shadow tokens, so overrides resolve correctly.
const twMerge = extendTailwindMerge({
  extend: { theme: { radius: ['control', 'card'], shadow: ['raised', 'overlay'] } },
});

/** Merge conditional class names and resolve Tailwind conflicts (last one wins). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
