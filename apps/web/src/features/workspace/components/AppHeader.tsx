import { Workflow } from 'lucide-react';

export function AppHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2.5 border-b bg-card px-4">
      <span
        aria-hidden
        className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
      >
        <Workflow className="size-4" />
      </span>
      <h1 className="text-sm font-semibold">System Design Sandbox</h1>
    </header>
  );
}
