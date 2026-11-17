import { useCallback, useRef, useState } from 'react';

export type RemoteList<T> =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; items: T[] };

export function useRemoteList<T>(load: () => Promise<T[]>) {
  const [state, setState] = useState<RemoteList<T>>({ status: 'loading' });
  const latest = useRef(0);

  const reload = useCallback(() => {
    const call = ++latest.current;
    setState({ status: 'loading' });
    load().then(
      (items) => {
        if (call === latest.current) setState({ status: 'ready', items });
      },
      (error: unknown) => {
        if (call !== latest.current) return;
        const message = error instanceof Error ? error.message : String(error);
        setState({ status: 'error', error: message });
      },
    );
  }, [load]);

  return { state, reload };
}
