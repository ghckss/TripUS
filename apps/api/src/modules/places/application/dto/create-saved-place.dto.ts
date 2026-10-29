import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import { PlacePreference, PlaceTag } from '../../domain/entities/saved-place.entity';

export class CreateSavedPlaceDto {
  @ApiPropertyOptional({ type: String, maxLength: 255, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  googlePlaceId?: string;

  @ApiProperty({ type: String, example: '국립현대미술관 서울', maxLength: 180 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({ type: String, maxLength: 300, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiProperty({ enum: PlaceTag, enumName: 'PlaceTag' })
  @IsEnum(PlaceTag)
  tag!: PlaceTag;

  @ApiProperty({ enum: PlacePreference, enumName: 'PlacePreference' })
  @IsEnum(PlacePreference)
  preference!: PlacePreference;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  note?: string;
}
