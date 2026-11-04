import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IdentityModule } from '../identity/identity.module';
import { SavedPlaceEntity } from '../places/domain/entities/saved-place.entity';
import { TripEntity } from '../trips/domain/entities/trip.entity';
import { TripDaySettingsService } from './application/trip-day-settings.service';
import { TripDaySettingEntity } from './domain/entities/trip-day-setting.entity';
import { TripDaySettingsController } from './presentation/trip-day-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TripDaySettingEntity, TripEntity, SavedPlaceEntity]), IdentityModule],
  controllers: [TripDaySettingsController],
  providers: [TripDaySettingsService],
  exports: [TripDaySettingsService],
})
export class TripDaySettingsModule {}
