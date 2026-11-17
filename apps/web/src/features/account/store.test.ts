// @vitest-environment jsdom
import type { DiagramDetail, User } from '@sds/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXAMPLE_DIAGRAM, useEditor } from '@/features/diagram';
import { STORAGE_KEYS } from './constants';
import { loadLink, startLinkPersistence, useAccount } from './store';

const user: User = { id: 'u1', login: 'ada', name: null, avatarUrl: null };

function detail(version: number, name = 'Shop'): DiagramDetail {
  return {
    id: 'd1',
    name,
    version,
    updatedAt: new Date(0).toISOString(),
    content: EXAMPLE_DIAGRAM,
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn<typeof fetch>();
const initial = useAccount.getState();

function sentBody(call: number): Record<string, unknown> {
  const init = fetchMock.mock.calls[call]![1]!;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  useAccount.setState(initial, true);
  useEditor.getState().replaceDiagram(EXAMPLE_DIAGRAM);
  useEditor.setState({ notice: null });
});

afterEach(() => vi.unstubAllGlobals());

describe('save', () => {
  it('creates the diagram first, then saves new versions on top of it', async () => {
    useAccount.setState({ user, name: '  Shop  ' });
    fetchMock.mockResolvedValueOnce(json(201, detail(1)));
    await useAccount.getState().save();

    expect(fetchMock.mock.calls[0]![0]).toBe('/api/diagrams');
    expect(sentBody(0)).toMatchObject({ name: 'Shop' });
    expect(useAccount.getState().link).toEqual({ id: 'd1', version: 1 });

    fetchMock.mockResolvedValueOnce(json(200, detail(2)));
    await useAccount.getState().save();
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/diagrams/d1');
    expect(fetchMock.mock.calls[1]![1]!.method).toBe('PUT');
    expect(sentBody(1)).toMatchObject({ baseVersion: 1 });
    expect(useAccount.getState().link).toEqual({ id: 'd1', version: 2 });
  });

  it('keeps the link and explains a version conflict', async () => {
    useAccount.setState({ user, link: { id: 'd1', version: 1 } });
    fetchMock.mockResolvedValueOnce(
      json(409, { statusCode: 409, message: 'Diagram was saved elsewhere' }),
    );
    await useAccount.getState().save();

    expect(useAccount.getState().link).toEqual({ id: 'd1', version: 1 });
    expect(useEditor.getState().notice).toContain('Save as new copy');
  });

  it('signs out locally when the session has expired', async () => {
    useAccount.setState({ user, link: { id: 'd1', version: 1 } });
    fetchMock.mockResolvedValueOnce(json(401, { statusCode: 401 }));
    await useAccount.getState().save();

    expect(useAccount.getState()).toMatchObject({ user: null, link: null });
  });

  it('sends a guest to sign in and remembers to save afterwards', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    useAccount.setState({ providers: ['github'] });
    await useAccount.getState().save();

    expect(assign).toHaveBeenCalledWith('/api/auth/github');
    expect(sessionStorage.getItem(STORAGE_KEYS.saveAfterSignIn)).toBe('1');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('requestSignIn', () => {
  it('asks a guest to pick when several providers are configured', async () => {
    useAccount.setState({ providers: ['github', 'google'] });
    await useAccount.getState().save();
    expect(useAccount.getState().signInPrompt).toEqual({ saveAfter: true });
  });

  it('redirects to the chosen provider', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    useAccount.getState().signIn('google', false);
    expect(assign).toHaveBeenCalledWith('/api/auth/google');
    expect(sessionStorage.getItem(STORAGE_KEYS.saveAfterSignIn)).toBeNull();
  });

  it('explains when no provider is configured', () => {
    useAccount.getState().requestSignIn(false);
    expect(useEditor.getState().notice).toContain('not configured');
  });
});

describe('init', () => {
  it('moves the guest diagram into the account after sign-in', async () => {
    sessionStorage.setItem(STORAGE_KEYS.saveAfterSignIn, '1');
    useAccount.setState({ link: { id: 'stale', version: 4 } });
    fetchMock
      .mockResolvedValueOnce(json(200, { user, providers: ['github'] }))
      .mockResolvedValueOnce(json(201, detail(1)));
    await useAccount.getState().init();

    expect(fetchMock.mock.calls[1]![1]!.method).toBe('POST');
    expect(useAccount.getState().link).toEqual({ id: 'd1', version: 1 });
    expect(sessionStorage.getItem(STORAGE_KEYS.saveAfterSignIn)).toBeNull();
    expect(useAccount.getState().providers).toEqual(['github']);
  });

  it('stays a guest when the API is unreachable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await useAccount.getState().init();

    expect(useAccount.getState()).toMatchObject({
      status: 'ready',
      user: null,
    });
  });
});

describe('restore', () => {
  it('loads the restored content and moves to the new version', async () => {
    useAccount.setState({ user, link: { id: 'd1', version: 2 } });
    useEditor.getState().replaceDiagram({ version: 1, nodes: [], edges: [] });
    fetchMock.mockResolvedValueOnce(json(201, detail(3)));

    expect(await useAccount.getState().restore(1)).toBe(true);
    expect(fetchMock.mock.calls[0]![0]).toBe(
      '/api/diagrams/d1/versions/1/restore',
    );
    expect(useEditor.getState().nodes).toHaveLength(
      EXAMPLE_DIAGRAM.nodes.length,
    );
    expect(useAccount.getState().link).toEqual({ id: 'd1', version: 3 });
  });
});

describe('link persistence', () => {
  it('survives a reload and ignores malformed data', () => {
    const stop = startLinkPersistence();
    useAccount.setState({ name: 'Shop', link: { id: 'd1', version: 2 } });
    stop();
    expect(loadLink()).toEqual({
      name: 'Shop',
      link: { id: 'd1', version: 2 },
    });

    localStorage.setItem(STORAGE_KEYS.link, '{"name":1}');
    expect(loadLink().link).toBeNull();
  });
});
