import postgresLogo from '@/assets/logos/postgresql.svg';
import redisLogo from '@/assets/logos/redis.svg';
import type { BlockType } from '@sds/shared';
import {
  Globe,
  ListOrdered,
  Server,
  Split,
  type LucideIcon,
} from 'lucide-react';

export type BlockIconSource =
  { kind: 'logo'; src: string } | { kind: 'glyph'; Icon: LucideIcon };

export interface BlockMeta {
  label: string;
  description: string;
  icon: BlockIconSource;
}

export const BLOCK_META: Record<BlockType, BlockMeta> = {
  'load-balancer': {
    label: 'Load balancer',
    description: 'Spreads incoming traffic across downstream replicas.',
    icon: { kind: 'glyph', Icon: Split },
  },
  service: {
    label: 'Service',
    description: 'Stateless application server that handles requests.',
    icon: { kind: 'glyph', Icon: Server },
  },
  postgres: {
    label: 'Postgres',
    description: 'Relational database; the source of truth for writes.',
    icon: { kind: 'logo', src: postgresLogo },
  },
  redis: {
    label: 'Redis',
    description: 'In-memory cache in front of slower storage.',
    icon: { kind: 'logo', src: redisLogo },
  },
  queue: {
    label: 'Queue',
    description: 'Buffers work for asynchronous processing.',
    icon: { kind: 'glyph', Icon: ListOrdered },
  },
  cdn: {
    label: 'CDN',
    description: 'Edge cache that serves content close to users.',
    icon: { kind: 'glyph', Icon: Globe },
  },
};

export interface BlockGroup {
  id: string;
  label: string;
  types: readonly BlockType[];
}

export const BLOCK_GROUPS: readonly BlockGroup[] = [
  { id: 'edge', label: 'Edge & networking', types: ['cdn', 'load-balancer'] },
  { id: 'compute', label: 'Compute', types: ['service'] },
  { id: 'data', label: 'Data & cache', types: ['postgres', 'redis'] },
  { id: 'messaging', label: 'Messaging', types: ['queue'] },
];
