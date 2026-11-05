import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsDateString, IsOptional, IsUUID, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TripDaySettingInputDto {
  @ApiProperty({ format: 'date', type: String })
  @IsDateString({ strict: true })
  date!: string;

  @ApiProperty({ example: '09:00', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', type: String })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime!: string;

  @ApiProperty({ example: '21:00', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', type: String })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime!: string;

  @ApiProperty({ format: 'uuid', nullable: true, required: false, type: String })
  @IsOptional()
  @IsUUID()
  startPlaceId?: string | null;

  @ApiProperty({ format: 'uuid', nullable: true, required: false, type: String })
  @IsOptional()
  @IsUUID()
  endPlaceId?: string | null;
}

export class ReplaceTripDaySettingsDto {
  @ApiProperty({ type: TripDaySettingInputDto, isArray: true, maxItems: 31 })
  @IsArray()
  @ArrayMaxSize(31)
  @ValidateNested({ each: true })
  @Type(() => TripDaySettingInputDto)
  settings!: TripDaySettingInputDto[];
}

export class TripDaySettingResponseDto extends TripDaySettingInputDto {
  @ApiProperty({ nullable: true, type: String })
  startPlaceName!: string | null;

  @ApiProperty({ nullable: true, type: String })
  endPlaceName!: string | null;
}
