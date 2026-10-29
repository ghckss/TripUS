import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IdentityModule } from '../identity/identity.module';
import { TripsService } from './application/trips.service';
import { TripEntity } from './domain/entities/trip.entity';
import { TripsController } from './presentation/trips.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TripEntity]), IdentityModule],
  controllers: [TripsController],
  providers: [TripsService],
})
export class TripsModule {}
