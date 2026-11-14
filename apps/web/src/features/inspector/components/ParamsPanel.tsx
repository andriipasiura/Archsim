import { Separator } from '@/components/ui/separator';
import type { BlockNode } from '@/features/diagram';
import { useBlockForm, useSelectedBlock } from '../hooks/use-block-form';
import { BlockIcon } from '@/features/blocks';
import { NumberField } from './NumberField';
import { PanelHeading } from '@/components/PanelHeading';
import { TextField } from './TextField';

export function ParamsPanel() {
  const node = useSelectedBlock();
  return (
    <aside
      className="flex h-full flex-col gap-3 overflow-y-auto bg-sidebar p-4 text-sidebar-foreground"
      aria-labelledby="params-title"
    >
      <PanelHeading
        id="params-title"
        title="Parameters"
        hint={node ? undefined : 'Select a single block to edit it.'}
      />
      {node && <BlockForm key={node.id} node={node} />}
    </aside>
  );
}

function BlockForm({ node }: { node: BlockNode }) {
  const { typeLabel, description, name, fields } = useBlockForm(node);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <BlockIcon type={node.data.type} />
        <div className="min-w-0">
          <p className="font-semibold">{typeLabel}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <TextField label="Name" {...name} />
      <Separator />
      {fields.map(({ key, ...field }) => (
        <NumberField key={key} {...field} />
      ))}
    </div>
  );
}
