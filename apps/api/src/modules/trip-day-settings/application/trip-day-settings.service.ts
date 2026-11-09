import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import { ReplaceTripDaySettingsDto, TripDaySettingInputDto, TripDaySettingResponseDto } from './dto/trip-day-settings.dto';
import { TripDaySettingEntity } from '../domain/entities/trip-day-setting.entity';

@Injectable()
export class TripDaySettingsService {
  constructor(
    @InjectRepository(TripDaySettingEntity) private readonly settings: Repository<TripDaySettingEntity>,
    @InjectRepository(TripEntity) private readonly trips: Repository<TripEntity>,
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
  ) {}

  async get(tripId: string): Promise<TripDaySettingResponseDto[]> {
    const trip = await this.ownedTrip(tripId);
    const stored = await this.settings.find({ where: { tripId }, order: { date: 'ASC' } });
    const byDate = new Map(stored.map((setting) => [setting.date, setting]));
    return enumerateDates(trip.startDate, trip.endDate).map((date) => {
      const setting = byDate.get(date);
      return {
        date,
        startTime: setting?.startTime.slice(0, 5) ?? '09:00',
        endTime: setting?.endTime.slice(0, 5) ?? '21:00',
      };
    });
  }

  async replace(tripId: string, input: ReplaceTripDaySettingsDto): Promise<TripDaySettingResponseDto[]> {
    const trip = await this.ownedTrip(tripId);
    this.validateDatesAndTimes(trip, input.settings);
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(TripDaySettingEntity, { tripId });
      if (input.settings.length > 0) {
        await manager.save(TripDaySettingEntity, input.settings.map((setting) => manager.create(TripDaySettingEntity, { ...setting, tripId })));
      }
    });
    return this.get(tripId);
  }

  private validateDatesAndTimes(trip: TripEntity, settings: TripDaySettingInputDto[]): void {
    const expected = enumerateDates(trip.startDate, trip.endDate);
    const dates = settings.map((setting) => setting.date);
    if (new Set(dates).size !== dates.length || dates.length !== expected.length || expected.some((date) => !dates.includes(date))) {
      throw new BadRequestException('Provide exactly one setting for every trip date');
    }
    if (settings.some((setting) => setting.endTime <= setting.startTime)) {
      throw new BadRequestException('endTime must be after startTime');
    }
  }

  private async ownedTrip(tripId: string): Promise<TripEntity> {
    const trip = await this.trips.findOneBy({ id: tripId, ownerId: this.identity.getCurrentUserId(), active: true });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}
