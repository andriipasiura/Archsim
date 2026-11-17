import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DiagramsController } from './diagrams.controller.js';
import { DiagramsService } from './diagrams.service.js';

@Module({
  imports: [AuthModule],
  controllers: [DiagramsController],
  providers: [DiagramsService],
})
export class DiagramsModule {}
