import { History } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useFitAfterLoad } from '@/features/canvas';
import { api } from '../api';
import { formatDate } from '../format';
import { useRemoteList } from '../hooks/use-remote-list';
import { useAccount, type CloudLink } from '../store';
import { RemoteListBody } from './RemoteListBody';

export function HistoryDialog({ link }: { link: CloudLink }) {
  const [open, setOpen] = useState(false);
  const load = useCallback(() => api.listVersions(link.id), [link.id]);
  const { state, reload } = useRemoteList(load);
  const busy = useAccount((s) => s.busy);
  const restore = useAccount((s) => s.restore);
  const fitAfterLoad = useFitAfterLoad();

  const handleRestore = async (version: number) => {
    if (await restore(version)) {
      setOpen(false);
      fitAfterLoad();
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) reload();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <History aria-hidden /> History
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Restoring saves a copy of that version as the newest one; no history
            is lost.
          </DialogDescription>
        </DialogHeader>
        <RemoteListBody state={state} empty="No versions.">
          {(items) =>
            items.map((v) => (
              <li key={v.version} className="flex items-center gap-2 py-2">
                <p className="flex-1 text-sm">
                  <span className="font-medium">v{v.version}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatDate(v.createdAt)}
                  </span>
                </p>
                {v.version === link.version ? (
                  <span className="text-xs text-muted-foreground">current</span>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void handleRestore(v.version)}
                  >
                    Restore
                  </Button>
                )}
              </li>
            ))
          }
        </RemoteListBody>
      </DialogContent>
    </Dialog>
  );
}
