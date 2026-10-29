import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IdentityModule } from '../identity/identity.module';
import { TripEntity } from '../trips/domain/entities/trip.entity';
import { PlacesService } from './application/places.service';
import { SavedPlaceEntity } from './domain/entities/saved-place.entity';
import { PlacesController } from './presentation/places.controller';
import { ConfigService } from '@nestjs/config';
import { MapsProvider } from '../../config/environment';
import { PLACE_SEARCH_PORT } from './domain/place-search.port';
import { GooglePlaceSearchAdapter } from './infrastructure/google-place-search.adapter';
import { MockPlaceSearchAdapter } from './infrastructure/mock-place-search.adapter';

@Module({
  imports: [TypeOrmModule.forFeature([SavedPlaceEntity, TripEntity]), IdentityModule],
  controllers: [PlacesController],
  providers: [
    PlacesService,
    MockPlaceSearchAdapter,
    {
      provide: PLACE_SEARCH_PORT,
      inject: [ConfigService, MockPlaceSearchAdapter],
      useFactory: (config: ConfigService, mock: MockPlaceSearchAdapter) =>
        config.get<string>('MAPS_PROVIDER') === MapsProvider.Google
          ? new GooglePlaceSearchAdapter(config)
          : mock,
    },
  ],
})
export class PlacesModule {}
