import { useReactFlow } from '@xyflow/react';
import { useRef, type ChangeEvent } from 'react';
import { DIAGRAM_FILE } from '@/features/diagram';
import { FIT_VIEW_OPTIONS } from '../constants';
import { toDiagram } from '@/features/diagram';
import { EXAMPLE_DIAGRAM } from '@/features/diagram';
import { downloadDiagram, readDiagramFile } from '@/features/diagram';
import { useEditor } from '@/features/diagram';

export function useDiagramFile() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceDiagram = useEditor((s) => s.replaceDiagram);
  const setNotice = useEditor((s) => s.setNotice);
  const { fitView } = useReactFlow();

  const fitAfterLoad = () =>
    requestAnimationFrame(() => void fitView(FIT_VIEW_OPTIONS));

  const importFile = async (file: File) => {
    const result = await readDiagramFile(file);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    replaceDiagram(result.diagram);
    setNotice(null);
    fitAfterLoad();
  };

  return {
    exportDiagram: () => {
      const { nodes, edges } = useEditor.getState();
      downloadDiagram(toDiagram(nodes, edges));
    },
    resetToExample: () => {
      replaceDiagram(EXAMPLE_DIAGRAM);
      fitAfterLoad();
    },
    openFilePicker: () => fileInputRef.current?.click(),
    fileInputProps: {
      ref: fileInputRef,
      type: 'file',
      accept: DIAGRAM_FILE.accept,
      hidden: true,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void importFile(file);
      },
    },
  };
}
