import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import { PlacePreference, PlaceTag } from '../../domain/entities/saved-place.entity';

export class UpdateSavedPlaceDto {
  @ApiPropertyOptional({ type: String, maxLength: 180 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  name?: string;

  @ApiPropertyOptional({ type: String, maxLength: 300, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ enum: PlaceTag, enumName: 'PlaceTag' })
  @IsOptional()
  @IsEnum(PlaceTag)
  tag?: PlaceTag;

  @ApiPropertyOptional({ enum: PlacePreference, enumName: 'PlacePreference' })
  @IsOptional()
  @IsEnum(PlacePreference)
  preference?: PlacePreference;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  note?: string;
}
