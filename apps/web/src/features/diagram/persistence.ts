import {
  parseDiagram,
  type Diagram,
  type ParseDiagramResult,
} from '@sds/shared';
import { AUTOSAVE_DEBOUNCE_MS, DIAGRAM_FILE, STORAGE_KEYS } from './constants';
import { fromDiagram, toDiagram } from './diagram-mapping';
import { EXAMPLE_DIAGRAM } from './example-diagram';
import { MESSAGES } from './messages';
import { useEditor } from './store';

export function parseDiagramJson(text: string): ParseDiagramResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: MESSAGES.invalidJson };
  }
  return parseDiagram(data);
}

export function loadSavedDiagram(): {
  diagram: Diagram;
  warning: string | null;
} {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEYS.diagram);
  } catch {
    return { diagram: EXAMPLE_DIAGRAM, warning: MESSAGES.storageUnavailable };
  }
  if (raw === null) return { diagram: EXAMPLE_DIAGRAM, warning: null };

  const result = parseDiagramJson(raw);
  if (result.ok) return { diagram: result.diagram, warning: null };

  console.warn('Saved diagram is invalid:', result.error);
  storeItem(STORAGE_KEYS.corruptBackup, raw);
  return { diagram: EXAMPLE_DIAGRAM, warning: MESSAGES.savedDiagramCorrupt };
}

function storeItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function saveDiagram(diagram: Diagram): boolean {
  return storeItem(STORAGE_KEYS.diagram, JSON.stringify(diagram));
}

export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failureReported = false;

  const flush = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    const { nodes, edges, setNotice } = useEditor.getState();
    const saved = saveDiagram(toDiagram(nodes, edges));
    if (!saved && !failureReported) setNotice(MESSAGES.saveFailed);
    failureReported = !saved;
  };

  const unsubscribe = useEditor.subscribe((state, prev) => {
    if (state.nodes === prev.nodes && state.edges === prev.edges) return;
    clearTimeout(timer);
    timer = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
  });
  window.addEventListener('pagehide', flush);

  return () => {
    flush();
    unsubscribe();
    window.removeEventListener('pagehide', flush);
  };
}

export function initEditor(): () => void {
  const { diagram, warning } = loadSavedDiagram();
  useEditor.setState({
    ...fromDiagram(diagram),
    past: [],
    future: [],
    notice: warning,
  });
  return startAutosave();
}

export async function readDiagramFile(file: Blob): Promise<ParseDiagramResult> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: MESSAGES.importUnreadable };
  }
  const result = parseDiagramJson(text);
  return result.ok
    ? result
    : { ok: false, error: MESSAGES.importInvalid(result.error) };
}

export function downloadDiagram(diagram: Diagram): void {
  const json = JSON.stringify(diagram, null, DIAGRAM_FILE.jsonIndent);
  const url = URL.createObjectURL(
    new Blob([json], { type: DIAGRAM_FILE.mimeType }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = DIAGRAM_FILE.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
