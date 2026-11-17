import type { DiagramDetail, OAuthProviderId, User } from '@sds/shared';
import { create } from 'zustand';
import { toDiagram, useEditor } from '@/features/diagram';
import { api, ApiError } from './api';
import {
  AUTH_ERROR_PARAM,
  DEFAULT_DIAGRAM_NAME,
  signInUrl,
  STORAGE_KEYS,
} from './constants';
import { MESSAGES } from './messages';

export interface CloudLink {
  id: string;
  version: number;
}

interface AccountState {
  status: 'loading' | 'ready';
  user: User | null;
  providers: OAuthProviderId[];
  signInPrompt: { saveAfter: boolean } | null;
  name: string;
  link: CloudLink | null;
  busy: boolean;
}

interface AccountActions {
  init(): Promise<void>;
  requestSignIn(saveAfter: boolean): void;
  closeSignInPrompt(): void;
  signIn(provider: OAuthProviderId, saveAfter: boolean): void;
  signOut(): Promise<void>;
  setName(name: string): void;
  save(): Promise<void>;
  saveAsNew(): Promise<void>;
  open(id: string): Promise<boolean>;
  remove(id: string): Promise<void>;
  restore(version: number): Promise<boolean>;
}

export type AccountStore = AccountState & AccountActions;

interface PersistedLink {
  name: string;
  link: CloudLink | null;
}

function readStorage(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(
  storage: () => Storage,
  key: string,
  value: string | null,
): boolean {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function loadLink(): PersistedLink {
  const fallback = { name: DEFAULT_DIAGRAM_NAME, link: null };
  const raw = readStorage(() => localStorage, STORAGE_KEYS.link);
  if (raw === null) return fallback;
  try {
    const data = JSON.parse(raw) as Partial<PersistedLink>;
    const link = data.link;
    const validLink =
      link === null ||
      (typeof link?.id === 'string' && Number.isInteger(link.version));
    return typeof data.name === 'string' && validLink && link !== undefined
      ? { name: data.name, link }
      : fallback;
  } catch {
    return fallback;
  }
}

function currentDiagram() {
  const { nodes, edges } = useEditor.getState();
  return toDiagram(nodes, edges);
}

const notify = (notice: string | null) =>
  useEditor.getState().setNotice(notice);

function consumeAuthError(): boolean {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(AUTH_ERROR_PARAM)) return false;
  url.searchParams.delete(AUTH_ERROR_PARAM);
  window.history.replaceState(null, '', url);
  return true;
}

export const useAccount = create<AccountStore>()((set, get) => {
  const linkTo = (detail: DiagramDetail) =>
    set({
      name: detail.name,
      link: { id: detail.id, version: detail.version },
    });

  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    set({ busy: true });
    try {
      return await action();
    } catch (error) {
      handleError(error);
      return undefined;
    } finally {
      set({ busy: false });
    }
  }

  function handleError(error: unknown): void {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 401) {
      set({ user: null, link: null });
      notify(MESSAGES.sessionExpired);
    } else if (error.status === 409) {
      notify(MESSAGES.conflict(error.message));
    } else {
      notify(MESSAGES.requestFailed(error.message));
    }
  }

  return {
    status: 'loading',
    user: null,
    providers: [],
    signInPrompt: null,
    ...loadLink(),
    busy: false,

    init: async () => {
      if (consumeAuthError()) notify(MESSAGES.signInFailed);
      let user: User | null = null;
      let providers: OAuthProviderId[] = [];
      try {
        ({ user, providers } = await api.me());
      } catch (error) {
        console.warn('Could not reach the API; staying in guest mode.', error);
      }
      set({ user, providers, status: 'ready' });

      const pending = readStorage(
        () => sessionStorage,
        STORAGE_KEYS.saveAfterSignIn,
      );
      writeStorage(() => sessionStorage, STORAGE_KEYS.saveAfterSignIn, null);
      if (user && pending !== null) {
        set({ link: null });
        await get().save();
        if (get().link) notify(MESSAGES.movedToAccount);
      }
    },

    requestSignIn: (saveAfter) => {
      const [only, ...rest] = get().providers;
      if (!only) notify(MESSAGES.signInUnavailable);
      else if (rest.length === 0) get().signIn(only, saveAfter);
      else set({ signInPrompt: { saveAfter } });
    },

    closeSignInPrompt: () => set({ signInPrompt: null }),

    signIn: (provider, saveAfter) => {
      if (saveAfter) {
        writeStorage(() => sessionStorage, STORAGE_KEYS.saveAfterSignIn, '1');
      }
      window.location.assign(signInUrl(provider));
    },

    signOut: async () => {
      await run(() => api.logout());
      set({ user: null, link: null });
    },

    setName: (name) => set({ name }),

    save: async () => {
      const { user, link, name } = get();
      if (!user) {
        get().requestSignIn(true);
        return;
      }
      const body = {
        name: name.trim() || DEFAULT_DIAGRAM_NAME,
        content: currentDiagram(),
      };
      const detail = await run(async () => {
        if (!link) return api.createDiagram(body);
        try {
          return await api.updateDiagram(link.id, {
            ...body,
            baseVersion: link.version,
          });
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            set({ link: null });
            notify(MESSAGES.deletedElsewhere);
            return undefined;
          }
          throw error;
        }
      });
      if (detail) linkTo(detail);
    },

    saveAsNew: async () => {
      set({ link: null });
      await get().save();
    },

    open: async (id) => {
      const detail = await run(() => api.getDiagram(id));
      if (!detail) return false;
      useEditor.getState().replaceDiagram(detail.content);
      linkTo(detail);
      notify(null);
      return true;
    },

    remove: async (id) => {
      const deleted = await run(async () => {
        await api.deleteDiagram(id);
        return true;
      });
      if (deleted && get().link?.id === id) set({ link: null });
    },

    restore: async (version) => {
      const link = get().link;
      if (!link) return false;
      const detail = await run(() => api.restoreVersion(link.id, version));
      if (!detail) return false;
      useEditor.getState().replaceDiagram(detail.content);
      linkTo(detail);
      notify(null);
      return true;
    },
  };
});

export function startLinkPersistence(): () => void {
  return useAccount.subscribe((state, prev) => {
    if (state.name === prev.name && state.link === prev.link) return;
    const persisted: PersistedLink = { name: state.name, link: state.link };
    writeStorage(
      () => localStorage,
      STORAGE_KEYS.link,
      JSON.stringify(persisted),
    );
  });
}

export function initAccount(): () => void {
  const stop = startLinkPersistence();
  void useAccount.getState().init();
  return stop;
}
