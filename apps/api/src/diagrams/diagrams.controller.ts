import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  createDiagramBodySchema,
  updateDiagramBodySchema,
  versionParamSchema,
  type CreateDiagramBody,
  type DiagramDetail,
  type DiagramSummary,
  type DiagramVersionSummary,
  type UpdateDiagramBody,
  type User,
} from '@sds/shared';
import { z } from 'zod';
import { CurrentUser, SessionGuard } from '../auth/session.guard.js';
import { DiagramsService } from './diagrams.service.js';

const idSchema = z.uuid();

@Controller('diagrams')
@UseGuards(SessionGuard)
export class DiagramsController {
  constructor(private readonly diagrams: DiagramsService) {}

  @Get()
  list(@CurrentUser() user: User): Promise<DiagramSummary[]> {
    return this.diagrams.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Body({ schema: createDiagramBodySchema }) body: CreateDiagramBody,
  ): Promise<DiagramDetail> {
    return this.diagrams.create(user.id, body);
  }

  @Get(':id')
  get(
    @CurrentUser() user: User,
    @Param('id', { schema: idSchema }) id: string,
  ): Promise<DiagramDetail> {
    return this.diagrams.get(user.id, id);
  }

  @Put(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: updateDiagramBodySchema }) body: UpdateDiagramBody,
  ): Promise<DiagramDetail> {
    return this.diagrams.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: User,
    @Param('id', { schema: idSchema }) id: string,
  ): Promise<void> {
    return this.diagrams.remove(user.id, id);
  }

  @Get(':id/versions')
  listVersions(
    @CurrentUser() user: User,
    @Param('id', { schema: idSchema }) id: string,
  ): Promise<DiagramVersionSummary[]> {
    return this.diagrams.listVersions(user.id, id);
  }

  @Post(':id/versions/:version/restore')
  restore(
    @CurrentUser() user: User,
    @Param('id', { schema: idSchema }) id: string,
    @Param('version', { schema: versionParamSchema }) version: number,
  ): Promise<DiagramDetail> {
    return this.diagrams.restore(user.id, id, version);
  }
}
