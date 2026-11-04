import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { validateEnvironment } from './config/environment';
import { createDataSourceOptions } from './database/data-source-options';
import { HealthModule } from './modules/health/health.module';
import { AiPlanningModule } from './modules/ai-planning/ai-planning.module';
import { ItinerariesModule } from './modules/itineraries/itineraries.module';
import { PlacesModule } from './modules/places/places.module';
import { TripsModule } from './modules/trips/trips.module';
import { TripRecordsModule } from './modules/trip-records/trip-records.module';
import { RoutesModule } from './modules/routes/routes.module';
import { AuthModule } from './modules/auth/auth.module';
import { PhotosModule } from './modules/photos/photos.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createDataSourceOptions(configService.getOrThrow<string>('DATABASE_URL'), {
          applicationName: 'tripus-api',
          connectionTimeoutMs: configService.getOrThrow<number>('DATABASE_CONNECTION_TIMEOUT_MS'),
          idleTimeoutMs: configService.getOrThrow<number>('DATABASE_IDLE_TIMEOUT_MS'),
          poolMax: configService.getOrThrow<number>('DATABASE_POOL_MAX'),
          statementTimeoutMs: configService.getOrThrow<number>('DATABASE_STATEMENT_TIMEOUT_MS'),
        }),
    }),
    HealthModule,
    AuthModule,
    AiPlanningModule,
    ItinerariesModule,
    PlacesModule,
    TripsModule,
    TripRecordsModule,
    RoutesModule,
    PhotosModule,
    TelemetryModule,
  ],
})
export class AppModule {}
