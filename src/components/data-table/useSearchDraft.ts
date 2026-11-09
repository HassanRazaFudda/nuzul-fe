import { useRef, useState } from 'react';

/** How long typing pauses before the list follows. */
const SEARCH_PAUSE_MS = 300;

/**
 * What is typed in a list's search box, and when it is committed. The list follows as soon as
 * typing pauses, or at once on Enter. The committed search usually lives in the URL, which
 * updates in a transition, so the box keeps its own text instead of waiting for it.
 */
export function useSearchDraft(search: string, onSearch: (search: string) => void) {
  const [draft, setDraft] = useState(search);
  const [committed, setCommitted] = useState(search);
  const [seen, setSeen] = useState(search);
  const pause = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The search changed from outside, like the back button: show it. A change made here is
  // left alone, so letters typed since are kept.
  if (search !== seen) {
    setSeen(search);
    if (search !== committed) {
      setCommitted(search);
      setDraft(search);
    }
  }

  function commit(value: string) {
    clearTimeout(pause.current);
    setCommitted(value);
    onSearch(value);
  }

  return {
    draft,
    change: (value: string) => {
      setDraft(value);
      clearTimeout(pause.current);
      pause.current = setTimeout(() => {
        commit(value);
      }, SEARCH_PAUSE_MS);
    },
    submit: () => {
      commit(draft);
    },
    clear: () => {
      setDraft('');
      commit('');
    },
  };
}
