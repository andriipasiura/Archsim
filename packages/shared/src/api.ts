import { z } from 'zod';
import { diagramSchema, type Diagram } from './diagram.js';

export const DIAGRAM_NAME_MAX_LENGTH = 100;

const diagramNameSchema = z.string().trim().min(1).max(DIAGRAM_NAME_MAX_LENGTH);
const versionSchema = z.number().int().min(1);

export const createDiagramBodySchema = z.strictObject({
  name: diagramNameSchema,
  content: diagramSchema,
});

export const updateDiagramBodySchema = createDiagramBodySchema.extend({
  baseVersion: versionSchema,
});

export const versionParamSchema = z.coerce.number().int().min(1);

export type CreateDiagramBody = z.infer<typeof createDiagramBodySchema>;
export type UpdateDiagramBody = z.infer<typeof updateDiagramBodySchema>;

export interface User {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

export const OAUTH_PROVIDERS = ['github', 'google'] as const;
export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number];

export function isOAuthProvider(value: unknown): value is OAuthProviderId {
  return (OAUTH_PROVIDERS as readonly unknown[]).includes(value);
}

export interface MeResponse {
  user: User | null;
  providers: OAuthProviderId[];
}

export interface DiagramSummary {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
}

export interface DiagramDetail extends DiagramSummary {
  content: Diagram;
}

export interface DiagramVersionSummary {
  version: number;
  createdAt: string;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}
