export const HISTORY_LIMIT = 100;

export const STORAGE_KEYS = {
  diagram: 'archsim:diagram',
  corruptBackup: 'archsim:diagram:corrupt',
} as const;

export const AUTOSAVE_DEBOUNCE_MS = 300;

export const DIAGRAM_FILE = {
  name: 'archsim-diagram.json',
  mimeType: 'application/json',
  accept: 'application/json,.json',
  jsonIndent: 2,
} as const;

export const SHORTCUTS = {
  undo: { key: 'z', shift: false },
  redo: [
    { key: 'z', shift: true },
    { key: 'y', shift: false },
  ],
} as const;

export const SHORTCUT_HINTS = {
  undo: 'Ctrl/⌘ Z',
  redo: 'Ctrl/⌘ Shift Z',
} as const;
