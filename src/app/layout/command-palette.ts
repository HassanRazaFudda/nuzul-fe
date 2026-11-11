const OPEN_EVENT = 'nuzul:command-palette';

/** Opens the command palette from anywhere: the sidebar's search box, a shortcut, a test. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onCommandPaletteOpen(listener: () => void) {
  window.addEventListener(OPEN_EVENT, listener);
  return () => {
    window.removeEventListener(OPEN_EVENT, listener);
  };
}

/** "Ctrl K" on Windows and Linux, "⌘K" on a Mac. */
export function shortcutLabel() {
  const platform =
    typeof navigator === 'undefined'
      ? ''
      : ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
        navigator.platform);
  return /mac/i.test(platform) ? '⌘K' : 'Ctrl K';
}
