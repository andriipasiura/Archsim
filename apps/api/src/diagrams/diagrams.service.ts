import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateDiagramBody,
  Diagram,
  DiagramDetail,
  DiagramSummary,
  DiagramVersionSummary,
  UpdateDiagramBody,
} from '@sds/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface DiagramRow {
  id: string;
  name: string;
  currentVersion: number;
  updatedAt: Date;
}

function toSummary(row: DiagramRow): DiagramSummary {
  return {
    id: row.id,
    name: row.name,
    version: row.currentVersion,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDetail(row: DiagramRow, content: Prisma.JsonValue): DiagramDetail {
  return { ...toSummary(row), content: content as Diagram };
}

function notFound(): NotFoundException {
  return new NotFoundException('Diagram not found');
}

@Injectable()
export class DiagramsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string): Promise<DiagramSummary[]> {
    const rows = await this.prisma.diagram.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toSummary);
  }

  async get(ownerId: string, id: string): Promise<DiagramDetail> {
    const row = await this.prisma.diagram.findFirst({
      where: { id, ownerId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    const latest = row?.versions[0];
    if (!row || !latest) throw notFound();
    return toDetail(row, latest.content);
  }

  async create(
    ownerId: string,
    body: CreateDiagramBody,
  ): Promise<DiagramDetail> {
    const row = await this.prisma.diagram.create({
      data: {
        ownerId,
        name: body.name,
        currentVersion: 1,
        versions: { create: { version: 1, content: body.content } },
      },
    });
    return toDetail(row, body.content);
  }

  async update(
    ownerId: string,
    id: string,
    body: UpdateDiagramBody,
  ): Promise<DiagramDetail> {
    const next = body.baseVersion + 1;
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.diagram.updateMany({
        where: { id, ownerId, currentVersion: body.baseVersion },
        data: { name: body.name, currentVersion: next },
      });
      if (count === 0) {
        const current = await tx.diagram.findFirst({
          where: { id, ownerId },
          select: { currentVersion: true },
        });
        if (!current) throw notFound();
        throw new ConflictException(
          `Diagram was saved elsewhere: it is at version ${current.currentVersion}, not ${body.baseVersion}`,
        );
      }
      await tx.diagramVersion.create({
        data: { diagramId: id, version: next, content: body.content },
      });
      const row = await tx.diagram.findUniqueOrThrow({ where: { id } });
      return toDetail(row, body.content);
    });
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const { count } = await this.prisma.diagram.deleteMany({
      where: { id, ownerId },
    });
    if (count === 0) throw notFound();
  }

  async listVersions(
    ownerId: string,
    id: string,
  ): Promise<DiagramVersionSummary[]> {
    const row = await this.prisma.diagram.findFirst({
      where: { id, ownerId },
      select: {
        versions: {
          orderBy: { version: 'desc' },
          select: { version: true, createdAt: true },
        },
      },
    });
    if (!row) throw notFound();
    return row.versions.map((v) => ({
      version: v.version,
      createdAt: v.createdAt.toISOString(),
    }));
  }

  async restore(
    ownerId: string,
    id: string,
    version: number,
  ): Promise<DiagramDetail> {
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.diagramVersion.findFirst({
        where: { version, diagram: { id, ownerId } },
        select: { content: true },
      });
      if (!source) throw new NotFoundException('Version not found');
      const row = await tx.diagram.update({
        where: { id },
        data: { currentVersion: { increment: 1 } },
      });
      await tx.diagramVersion.create({
        data: {
          diagramId: id,
          version: row.currentVersion,
          content: source.content ?? {},
        },
      });
      return toDetail(row, source.content);
    });
  }
}
