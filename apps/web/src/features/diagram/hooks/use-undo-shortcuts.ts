import { useEffect } from 'react';
import { SHORTCUTS } from '../constants';
import { useEditor } from '../store';

interface KeyCombo {
  key: string;
  shift: boolean;
}

const matches = (event: KeyboardEvent, combo: KeyCombo) =>
  event.key.toLowerCase() === combo.key && event.shiftKey === combo.shift;

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest('input, textarea, select') !== null)
  );
}

export function useUndoShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        isEditableTarget(event.target)
      )
        return;
      const { undo, redo } = useEditor.getState();
      if (matches(event, SHORTCUTS.undo)) {
        event.preventDefault();
        undo();
      } else if (SHORTCUTS.redo.some((combo) => matches(event, combo))) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
