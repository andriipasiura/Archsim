import { Button } from '@/components/ui/button';
import { Panel } from '@xyflow/react';
import {
  Download,
  Maximize,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  RotateCcw,
  Undo2,
  Upload,
} from 'lucide-react';
import { SHORTCUT_HINTS } from '@/features/diagram';
import { useDiagramFile } from '../hooks/use-diagram-file';
import { useHistory } from '@/features/diagram';
import { useZoomControls } from '../hooks/use-zoom-controls';
import { FloatingBar, FloatingBarDivider } from '@/components/FloatingBar';
import { IconButton } from '@/components/IconButton';
import { Notice } from '@/features/diagram';

export interface PanelToggle {
  collapsed: boolean;
  toggle: () => void;
}

export interface CanvasOverlaysProps {
  blocks: PanelToggle;
  params: PanelToggle;
}

export function CanvasOverlays({ blocks, params }: CanvasOverlaysProps) {
  return (
    <>
      <Panel position="top-left">
        <HistoryBar blocks={blocks} />
      </Panel>
      <Panel position="top-center" className="w-full max-w-md">
        <Notice />
      </Panel>
      <Panel position="top-right">
        <FileBar params={params} />
      </Panel>
      <Panel position="bottom-left">
        <ZoomBar />
      </Panel>
    </>
  );
}

function HistoryBar({ blocks }: { blocks: PanelToggle }) {
  const { canUndo, canRedo, undo, redo } = useHistory();
  return (
    <FloatingBar aria-label="Panels and history">
      <IconButton
        label={blocks.collapsed ? 'Show blocks' : 'Hide blocks'}
        aria-expanded={!blocks.collapsed}
        onClick={blocks.toggle}
      >
        {blocks.collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
      </IconButton>
      <FloatingBarDivider />
      <IconButton
        label="Undo"
        hint={SHORTCUT_HINTS.undo}
        onClick={undo}
        disabled={!canUndo}
      >
        <Undo2 />
      </IconButton>
      <IconButton
        label="Redo"
        hint={SHORTCUT_HINTS.redo}
        onClick={redo}
        disabled={!canRedo}
      >
        <Redo2 />
      </IconButton>
    </FloatingBar>
  );
}

function FileBar({ params }: { params: PanelToggle }) {
  const { exportDiagram, openFilePicker, fileInputProps, resetToExample } =
    useDiagramFile();
  return (
    <FloatingBar aria-label="Diagram file">
      <IconButton
        label="Reset to example"
        hint="(undoable)"
        onClick={resetToExample}
      >
        <RotateCcw />
      </IconButton>
      <Button variant="ghost" size="sm" onClick={openFilePicker}>
        <Upload aria-hidden /> Import
      </Button>
      <input {...fileInputProps} />
      <Button variant="ghost" size="sm" onClick={exportDiagram}>
        <Download aria-hidden /> Export
      </Button>
      <FloatingBarDivider />
      <IconButton
        label={params.collapsed ? 'Show parameters' : 'Hide parameters'}
        aria-expanded={!params.collapsed}
        onClick={params.toggle}
      >
        {params.collapsed ? <PanelRightOpen /> : <PanelRightClose />}
      </IconButton>
    </FloatingBar>
  );
}

function ZoomBar() {
  const { zoomLabel, zoomIn, zoomOut, fit } = useZoomControls();
  return (
    <FloatingBar aria-label="Zoom">
      <IconButton label="Zoom out" onClick={zoomOut}>
        <Minus />
      </IconButton>
      <span
        className="min-w-12 text-center text-xs font-medium tabular-nums"
        aria-live="polite"
      >
        {zoomLabel}
      </span>
      <IconButton label="Zoom in" onClick={zoomIn}>
        <Plus />
      </IconButton>
      <IconButton label="Fit diagram to view" onClick={fit}>
        <Maximize />
      </IconButton>
    </FloatingBar>
  );
}
