import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TripEntity } from '../entities/trip.entity';

export class TripResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  destination!: string;

  @ApiProperty({ type: String, example: 'Asia/Seoul' })
  timezone!: string;

  @ApiProperty({ type: String, format: 'date' })
  startDate!: string;

  @ApiProperty({ type: String, format: 'date' })
  endDate!: string;

  @ApiProperty({ type: Boolean })
  active!: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  archivedAt!: Date | null;

  static fromEntity(entity: TripEntity): TripResponseDto {
    return {
      id: entity.id,
      title: entity.title,
      destination: entity.destination,
      timezone: entity.timezone,
      startDate: entity.startDate,
      endDate: entity.endDate,
      active: entity.active,
      archivedAt: entity.archivedAt,
    };
  }
}
