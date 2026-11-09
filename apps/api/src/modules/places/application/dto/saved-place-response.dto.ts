import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PlacePreference, PlaceTag, SavedPlaceEntity } from '../../domain/entities/saved-place.entity';

export class SavedPlaceResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  tripId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  googlePlaceId!: string | null;

  @ApiProperty({ type: String })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  address!: string | null;

  @ApiProperty({ enum: PlaceTag, enumName: 'PlaceTag' })
  tag!: PlaceTag;

  @ApiProperty({ enum: PlacePreference, enumName: 'PlacePreference' })
  preference!: PlacePreference;

  @ApiPropertyOptional({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ type: Boolean })
  isPrimaryLodging!: boolean;

  static fromEntity(entity: SavedPlaceEntity): SavedPlaceResponseDto {
    return {
      id: entity.id,
      tripId: entity.tripId,
      googlePlaceId: entity.googlePlaceId,
      name: entity.name,
      address: entity.address,
      tag: entity.tag,
      preference: entity.preference,
      note: entity.note,
      isPrimaryLodging: entity.isPrimaryLodging,
    };
  }
}

export enum SavePlaceStatus {
  Created = 'created',
  AlreadyExists = 'already_exists',
}

export class SavePlaceResultDto {
  @ApiProperty({ enum: SavePlaceStatus, enumName: 'SavePlaceStatus' })
  status!: SavePlaceStatus;

  @ApiProperty({ type: SavedPlaceResponseDto })
  place!: SavedPlaceResponseDto;
}
