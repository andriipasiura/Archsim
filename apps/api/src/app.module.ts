import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from './config.module.js';
import { DiagramsModule } from './diagrams/diagrams.module.js';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }] }),
    AuthModule,
    DiagramsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
