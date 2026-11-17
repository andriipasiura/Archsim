import type {
  ApiError as ApiErrorBody,
  CreateDiagramBody,
  DiagramDetail,
  DiagramSummary,
  DiagramVersionSummary,
  MeResponse,
  UpdateDiagramBody,
} from '@sds/shared';
import { API_BASE } from './constants';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function errorMessage(res: Response): Promise<string> {
  const body = (await res
    .json()
    .catch(() => null)) as Partial<ApiErrorBody> | null;
  const message = body?.message;
  if (Array.isArray(message)) return message.join('\n');
  return message || res.statusText || `HTTP ${res.status}`;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'same-origin',
      ...(body !== undefined && {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    });
  } catch {
    throw new ApiError(0, 'The server is unreachable');
  }
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  me: () => request<MeResponse>('GET', '/auth/me'),
  logout: () => request<void>('POST', '/auth/logout'),
  listDiagrams: () => request<DiagramSummary[]>('GET', '/diagrams'),
  getDiagram: (id: string) => request<DiagramDetail>('GET', `/diagrams/${id}`),
  createDiagram: (body: CreateDiagramBody) =>
    request<DiagramDetail>('POST', '/diagrams', body),
  updateDiagram: (id: string, body: UpdateDiagramBody) =>
    request<DiagramDetail>('PUT', `/diagrams/${id}`, body),
  deleteDiagram: (id: string) => request<void>('DELETE', `/diagrams/${id}`),
  listVersions: (id: string) =>
    request<DiagramVersionSummary[]>('GET', `/diagrams/${id}/versions`),
  restoreVersion: (id: string, version: number) =>
    request<DiagramDetail>(
      'POST',
      `/diagrams/${id}/versions/${version}/restore`,
    ),
};
