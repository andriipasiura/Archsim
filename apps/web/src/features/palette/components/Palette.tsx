import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { BLOCK_GROUPS } from '@/features/blocks';
import { usePalette } from '../hooks/use-palette';
import { BlockIcon } from '@/features/blocks';
import { PanelHeading } from '@/components/PanelHeading';

const ALL_GROUP_IDS = BLOCK_GROUPS.map((g) => g.id);

export function Palette() {
  const groups = usePalette();
  return (
    <aside
      className="flex h-full flex-col gap-2 overflow-y-auto bg-sidebar p-4 text-sidebar-foreground"
      aria-labelledby="palette-title"
    >
      <PanelHeading
        id="palette-title"
        title="Blocks"
        hint="Drag onto the canvas or click to add."
      />
      <Accordion type="multiple" defaultValue={ALL_GROUP_IDS}>
        {groups.map((group) => (
          <AccordionItem key={group.id} value={group.id}>
            <AccordionTrigger>{group.label}</AccordionTrigger>
            <AccordionContent>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
                {group.items.map((item) => (
                  <li key={item.type} className="flex">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          className="h-full w-full cursor-grab flex-col gap-1.5 py-3 whitespace-normal"
                          draggable
                          onDragStart={item.onDragStart}
                          onClick={item.add}
                        >
                          <BlockIcon type={item.type} />
                          <span className="text-xs leading-tight">
                            {item.label}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-56">
                        {item.description}
                      </TooltipContent>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </aside>
  );
}
