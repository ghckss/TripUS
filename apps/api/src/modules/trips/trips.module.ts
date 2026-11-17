import { TripCoverService } from './application/trip-cover.service';
import { PlacesModule } from '../places/places.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IdentityModule } from '../identity/identity.module';
import { TripsService } from './application/trips.service';
import { TripEntity } from './domain/entities/trip.entity';
import { TripsController } from './presentation/trips.controller';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [TypeOrmModule.forFeature([TripEntity]), IdentityModule, EntitlementsModule, PlacesModule],
  controllers: [TripsController],
  providers: [TripsService, TripCoverService],
})
export class TripsModule {}
