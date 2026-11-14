import { useCallback, useState } from 'react';
import {
  useDefaultLayout,
  usePanelRef,
  type PanelSize,
} from 'react-resizable-panels';
import {
  LAYOUT_STORAGE_KEY,
  PANEL_COLLAPSED_SIZE,
  PANEL_LAYOUT,
} from '../constants';

function useCollapsiblePanel() {
  const panelRef = usePanelRef();
  const [collapsed, setCollapsed] = useState(false);

  const onResize = useCallback(
    (size: PanelSize) => setCollapsed(size.inPixels <= PANEL_COLLAPSED_SIZE),
    [],
  );

  const toggle = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  }, [panelRef]);

  return {
    collapsed,
    toggle,
    panelProps: {
      panelRef,
      onResize,
      collapsible: true,
      collapsedSize: PANEL_COLLAPSED_SIZE,
    },
  };
}

export type CollapsiblePanel = ReturnType<typeof useCollapsiblePanel>;

export function useEditorLayout() {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: LAYOUT_STORAGE_KEY,
    panelIds: Object.values(PANEL_LAYOUT).map((p) => p.id),
  });
  const blocks = useCollapsiblePanel();
  const params = useCollapsiblePanel();

  return {
    groupProps: { defaultLayout, onLayoutChanged },
    blocks,
    params,
  };
}
