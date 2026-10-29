import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum TripListStatus {
  Current = 'current',
  Completed = 'completed',
  All = 'all',
}

export class ListTripsQueryDto {
  @ApiPropertyOptional({ enum: TripListStatus, enumName: 'TripListStatus', default: TripListStatus.Current })
  @IsOptional()
  @IsEnum(TripListStatus)
  status?: TripListStatus;
}
