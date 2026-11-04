import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IdentityModule } from '../identity/identity.module';
import { TripsService } from './application/trips.service';
import { TripEntity } from './domain/entities/trip.entity';
import { TripsController } from './presentation/trips.controller';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [TypeOrmModule.forFeature([TripEntity]), IdentityModule, EntitlementsModule],
  controllers: [TripsController],
  providers: [TripsService],
})
export class TripsModule {}
