import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MapsProvider } from '../../config/environment';
import { IdentityModule } from '../identity/identity.module';
import { SavedPlaceEntity } from '../places/domain/entities/saved-place.entity';
import { TripEntity } from '../trips/domain/entities/trip.entity';
import { RoutesService } from './application/routes.service';
import { ROUTES_PORT } from './domain/routes.port';
import { GoogleRoutesAdapter } from './infrastructure/google-routes.adapter';
import { MockRoutesAdapter } from './infrastructure/mock-routes.adapter';
import { RoutesController } from './presentation/routes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TripEntity, SavedPlaceEntity]), IdentityModule],
  controllers: [RoutesController],
  providers: [
    RoutesService,
    MockRoutesAdapter,
    {
      provide: ROUTES_PORT,
      inject: [ConfigService, MockRoutesAdapter],
      useFactory: (config: ConfigService, mock: MockRoutesAdapter) =>
        config.get<string>('MAPS_PROVIDER') === MapsProvider.Google
          ? new GoogleRoutesAdapter(config)
          : mock,
    },
  ],
  exports: [ROUTES_PORT],
})
export class RoutesModule {}
