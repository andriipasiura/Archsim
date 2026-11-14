// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from './constants';
import { EXAMPLE_DIAGRAM } from './example-diagram';
import { MESSAGES } from './messages';
import { loadSavedDiagram, readDiagramFile, saveDiagram } from './persistence';

const emptyDiagram = { version: 1 as const, nodes: [], edges: [] };

beforeEach(() => localStorage.clear());

describe('loadSavedDiagram', () => {
  it('falls back to the example when nothing is saved', () => {
    expect(loadSavedDiagram()).toEqual({
      diagram: EXAMPLE_DIAGRAM,
      warning: null,
    });
  });

  it('loads what saveDiagram stored', () => {
    expect(saveDiagram(emptyDiagram)).toBe(true);
    expect(loadSavedDiagram()).toEqual({
      diagram: emptyDiagram,
      warning: null,
    });
  });

  it('backs up unreadable data before falling back to the example', () => {
    const corrupt = '{"version":1,"nodes":[{"broken":true}],"edges":[]}';
    localStorage.setItem(STORAGE_KEYS.diagram, corrupt);

    const { diagram, warning } = loadSavedDiagram();
    expect(diagram).toEqual(EXAMPLE_DIAGRAM);
    expect(warning).toBe(MESSAGES.savedDiagramCorrupt);
    expect(localStorage.getItem(STORAGE_KEYS.corruptBackup)).toBe(corrupt);
  });
});

describe('readDiagramFile', () => {
  it('accepts a valid exported file', async () => {
    const file = new Blob([JSON.stringify(EXAMPLE_DIAGRAM)]);
    expect(await readDiagramFile(file)).toEqual({
      ok: true,
      diagram: EXAMPLE_DIAGRAM,
    });
  });

  it('rejects malformed JSON and invalid diagrams', async () => {
    const notJson = await readDiagramFile(new Blob(['{nope']));
    expect(notJson).toEqual({
      ok: false,
      error: MESSAGES.importInvalid(MESSAGES.invalidJson),
    });

    const invalid = await readDiagramFile(
      new Blob([JSON.stringify({ version: 2 })]),
    );
    expect(invalid.ok).toBe(false);
  });
});
