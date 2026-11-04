import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { PlaceTag, SavedPlaceEntity } from '../../places/domain/entities/saved-place.entity';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import { ReplaceTripDaySettingsDto, TripDaySettingInputDto, TripDaySettingResponseDto } from './dto/trip-day-settings.dto';
import { TripDaySettingEntity } from '../domain/entities/trip-day-setting.entity';

@Injectable()
export class TripDaySettingsService {
  constructor(
    @InjectRepository(TripDaySettingEntity) private readonly settings: Repository<TripDaySettingEntity>,
    @InjectRepository(TripEntity) private readonly trips: Repository<TripEntity>,
    @InjectRepository(SavedPlaceEntity) private readonly places: Repository<SavedPlaceEntity>,
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
  ) {}

  async get(tripId: string): Promise<TripDaySettingResponseDto[]> {
    const trip = await this.ownedTrip(tripId);
    const [stored, lodgings] = await Promise.all([
      this.settings.find({ where: { tripId }, order: { date: 'ASC' } }),
      this.places.find({ where: { tripId, tag: PlaceTag.Lodging } }),
    ]);
    const byDate = new Map(stored.map((setting) => [setting.date, setting]));
    const names = new Map(lodgings.map((place) => [place.id, place.name]));
    return enumerateDates(trip.startDate, trip.endDate).map((date) => {
      const setting = byDate.get(date);
      const startPlaceId = setting?.startPlaceId ?? null;
      const endPlaceId = setting?.endPlaceId ?? null;
      return {
        date,
        startTime: setting?.startTime.slice(0, 5) ?? '09:00',
        endTime: setting?.endTime.slice(0, 5) ?? '21:00',
        startPlaceId,
        endPlaceId,
        startPlaceName: startPlaceId ? names.get(startPlaceId) ?? null : null,
        endPlaceName: endPlaceId ? names.get(endPlaceId) ?? null : null,
      };
    });
  }

  async replace(tripId: string, input: ReplaceTripDaySettingsDto): Promise<TripDaySettingResponseDto[]> {
    const trip = await this.ownedTrip(tripId);
    this.validateDatesAndTimes(trip, input.settings);
    await this.validateLodgings(tripId, input.settings);
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(TripDaySettingEntity, { tripId });
      if (input.settings.length > 0) {
        await manager.save(TripDaySettingEntity, input.settings.map((setting) => manager.create(TripDaySettingEntity, {
          ...setting,
          tripId,
          startPlaceId: setting.startPlaceId ?? null,
          endPlaceId: setting.endPlaceId ?? null,
        })));
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

  private async validateLodgings(tripId: string, settings: TripDaySettingInputDto[]): Promise<void> {
    const ids = [...new Set(settings.flatMap((setting) => [setting.startPlaceId, setting.endPlaceId]).filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) return;
    const count = await this.places.countBy({ id: In(ids), tripId, tag: PlaceTag.Lodging });
    if (count !== ids.length) throw new BadRequestException('Start and end places must be lodging places saved in this trip');
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
