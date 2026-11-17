import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { APP_CONFIG, type AppConfig } from './config.js';
import { ConfigModule } from './config.module.js';
import { DiagramsModule } from './diagrams/diagrams.module.js';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SimulationsModule } from './simulations/simulations.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }] }),
    BullModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        connection: { url: config.redisUrl },
      }),
    }),
    AuthModule,
    DiagramsModule,
    SimulationsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
