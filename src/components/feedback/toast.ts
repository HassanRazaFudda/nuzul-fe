let message: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const notify = () => {
  listeners.forEach((listener) => {
    listener();
  });
};

const TOAST_MS = 3000;

/** Confirms that something worked. Failures stay on screen, in the form that failed. */
export function toast(text: string): void {
  message = text;
  notify();
  clearTimeout(timer);
  timer = setTimeout(() => {
    message = null;
    notify();
  }, TOAST_MS);
}

export const getToast = (): string | null => message;

export function subscribeToast(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
