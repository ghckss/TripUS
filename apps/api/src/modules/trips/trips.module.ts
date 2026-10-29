import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IdentityModule } from '../identity/identity.module';
import { TripEntity } from './entities/trip.entity';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [TypeOrmModule.forFeature([TripEntity]), IdentityModule],
  controllers: [TripsController],
  providers: [TripsService],
})
export class TripsModule {}
