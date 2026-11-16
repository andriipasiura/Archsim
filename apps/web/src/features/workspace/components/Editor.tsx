import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CANVAS_LAYOUT, PANEL_LAYOUT } from '../constants';
import { useEditorLayout } from '../hooks/use-editor-layout';
import { useUndoShortcuts } from '@/features/diagram';
import { AppHeader } from './AppHeader';
import { Canvas } from '@/features/canvas';
import { Palette } from '@/features/palette';
import { ParamsPanel } from '@/features/inspector';
import { SimulationPanel } from '@/features/simulation';

export function Editor() {
  useUndoShortcuts();
  const { groupProps, canvasGroupProps, blocks, params, simulation } =
    useEditorLayout();

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <AppHeader />
        <ResizablePanelGroup className="min-h-0 flex-1" {...groupProps}>
          <ResizablePanel {...PANEL_LAYOUT.blocks} {...blocks.panelProps}>
            <Palette />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel {...PANEL_LAYOUT.canvas}>
            <ResizablePanelGroup {...canvasGroupProps}>
              <ResizablePanel {...CANVAS_LAYOUT.diagram}>
                <main className="h-full" aria-label="Diagram canvas">
                  <Canvas
                    blocks={blocks}
                    params={params}
                    simulation={simulation}
                  />
                </main>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                {...CANVAS_LAYOUT.simulation}
                {...simulation.panelProps}
              >
                <SimulationPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel {...PANEL_LAYOUT.params} {...params.panelProps}>
            <ParamsPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
}
