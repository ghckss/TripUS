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
        createDataSourceOptions(configService.getOrThrow<string>('DATABASE_URL')),
    }),
    HealthModule,
    AuthModule,
    AiPlanningModule,
    ItinerariesModule,
    PlacesModule,
    TripsModule,
    TripRecordsModule,
    RoutesModule,
  ],
})
export class AppModule {}
