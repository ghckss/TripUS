import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SearchPlacesQueryDto {
  @ApiProperty({ type: String, minLength: 2 })
  @IsString()
  @MinLength(2)
  query!: string;
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
