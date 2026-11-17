import { FolderOpen, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { IconButton } from '@/components/IconButton';
import { useFitAfterLoad } from '@/features/canvas';
import { api } from '../api';
import { formatDate } from '../format';
import { useRemoteList } from '../hooks/use-remote-list';
import { useAccount } from '../store';
import { RemoteListBody } from './RemoteListBody';

export function DiagramsDialog() {
  const [open, setOpen] = useState(false);
  const { state, reload } = useRemoteList(api.listDiagrams);
  const busy = useAccount((s) => s.busy);
  const currentId = useAccount((s) => s.link?.id);
  const openDiagram = useAccount((s) => s.open);
  const remove = useAccount((s) => s.remove);
  const saveAsNew = useAccount((s) => s.saveAsNew);
  const fitAfterLoad = useFitAfterLoad();

  const handleOpen = async (id: string) => {
    if (await openDiagram(id)) {
      setOpen(false);
      fitAfterLoad();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}" and all its versions?`)) return;
    await remove(id);
    reload();
  };

  const handleSaveAsNew = async () => {
    await saveAsNew();
    reload();
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) reload();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <FolderOpen aria-hidden /> My diagrams
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>My diagrams</DialogTitle>
          <DialogDescription>
            Opening a diagram replaces the canvas (undo brings it back).
          </DialogDescription>
        </DialogHeader>
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={busy}
          onClick={() => void handleSaveAsNew()}
        >
          Save as new copy
        </Button>
        <RemoteListBody state={state} empty="No saved diagrams yet.">
          {(items) =>
            items.map((d) => (
              <li key={d.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {d.name}
                    {d.id === currentId && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (open)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    v{d.version} · {formatDate(d.updatedAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void handleOpen(d.id)}
                >
                  Open
                </Button>
                <IconButton
                  label={`Delete ${d.name}`}
                  disabled={busy}
                  onClick={() => void handleDelete(d.id, d.name)}
                >
                  <Trash2 />
                </IconButton>
              </li>
            ))
          }
        </RemoteListBody>
      </DialogContent>
    </Dialog>
  );
}
