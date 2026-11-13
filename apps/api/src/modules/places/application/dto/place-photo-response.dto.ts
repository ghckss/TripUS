import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlacePhotoResponseDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  imageUrl!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  googleMapsUri!: string | null;

  @ApiProperty({ type: String, isArray: true })
  authorNames!: string[];
}
