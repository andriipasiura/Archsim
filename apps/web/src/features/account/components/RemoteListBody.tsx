import type { ReactNode } from 'react';
import type { RemoteList } from '../hooks/use-remote-list';

interface RemoteListBodyProps<T> {
  state: RemoteList<T>;
  empty: string;
  children: (items: T[]) => ReactNode;
}

export function RemoteListBody<T>({
  state,
  empty,
  children,
}: RemoteListBodyProps<T>) {
  if (state.status === 'loading') {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (state.status === 'error') {
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  if (state.items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="max-h-80 divide-y overflow-auto">{children(state.items)}</ul>
  );
}
