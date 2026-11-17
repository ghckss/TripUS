import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IdentityModule } from '../identity/identity.module';
import { SavedPlaceEntity } from '../places/domain/entities/saved-place.entity';
import { TripEntity } from '../trips/domain/entities/trip.entity';
import { ItinerariesService } from './application/itineraries.service';
import { ItineraryItemEntity } from './domain/entities/itinerary-item.entity';
import { ItinerariesController } from './presentation/itineraries.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ItineraryItemEntity, SavedPlaceEntity, TripEntity]), IdentityModule],
  controllers: [ItinerariesController],
  providers: [ItinerariesService],
  exports: [ItinerariesService],
})
export class ItinerariesModule {}
