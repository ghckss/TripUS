import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IdentityModule } from '../identity/identity.module';
import { TripEntity } from '../trips/domain/entities/trip.entity';
import { PlacesService } from './application/places.service';
import { SavedPlaceEntity } from './domain/entities/saved-place.entity';
import { PlacesController } from './presentation/places.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SavedPlaceEntity, TripEntity]), IdentityModule],
  controllers: [PlacesController],
  providers: [PlacesService],
})
export class PlacesModule {}
