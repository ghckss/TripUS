import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SearchPlacesQueryDto {
  @ApiProperty({ type: String, minLength: 2 })
  @IsString()
  @MinLength(2)
  query!: string;
}

export class SearchPlacesByDestinationQueryDto extends SearchPlacesQueryDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 120, example: '일본' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  destination!: string;
}

export class SearchCitiesQueryDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 120, example: '도쿄' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  query!: string;

  @ApiProperty({ type: String, minLength: 1, maxLength: 120, example: '일본' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  country!: string;

  @ApiProperty({ type: String, pattern: '^[A-Z]{2}$', example: 'JP' })
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  countryCode!: string;
}

export class PlaceSearchCandidateDto {
  @ApiProperty({ type: String })
  googlePlaceId!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  address!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  primaryType!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  latitude!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  longitude!: number | null;
}
