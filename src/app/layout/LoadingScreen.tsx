import { Spinner } from '@/components/ui/Spinner';

/** Shown while the first route's code and data load, so the page is never blank. */
export function LoadingScreen() {
  return <Spinner />;
}
