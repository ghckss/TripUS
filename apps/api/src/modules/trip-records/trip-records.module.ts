import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IdentityModule } from '../identity/identity.module';
import { ItinerariesModule } from '../itineraries/itineraries.module';
import { ItineraryItemEntity } from '../itineraries/domain/entities/itinerary-item.entity';
import { TripEntity } from '../trips/domain/entities/trip.entity';
import { TripRecordsService } from './application/trip-records.service';
import { TripRecordsController } from './presentation/trip-records.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TripEntity, ItineraryItemEntity]), IdentityModule, ItinerariesModule],
  controllers: [TripRecordsController],
  providers: [TripRecordsService],
})
export class TripRecordsModule {}
