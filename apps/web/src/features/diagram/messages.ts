import { STORAGE_KEYS } from './constants';

export const MESSAGES = {
  storageUnavailable:
    'Browser storage is unavailable; changes will not survive a reload.',
  savedDiagramCorrupt: `The saved diagram could not be read, so the example was loaded. The old data was copied to localStorage key "${STORAGE_KEYS.corruptBackup}".`,
  saveFailed:
    'Could not save to browser storage. Export the diagram to keep your changes.',
  invalidJson: 'Not valid JSON',
  importUnreadable: 'Import failed: the file could not be read.',
  importInvalid: (error: string) =>
    `Import failed, the current diagram was kept.\n${error}`,
} as const;
