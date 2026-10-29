import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

import { PhotoEntity, PhotoStatus } from '../../domain/entities/photo.entity';
import { PhotoUploadTarget } from '../../domain/photo-storage.port';

export class CreatePhotoUploadDto {
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  itineraryItemId?: string;

  @ApiProperty({ type: String, example: 'image/jpeg' })
  @IsString()
  @Matches(/^image\/(jpeg|png|webp|heic|heif)$/)
  mimeType!: string;

  @ApiProperty({ type: Number, minimum: 1, maximum: 104857600 })
  @IsInt()
  @Min(1)
  @Max(100 * 1024 * 1024)
  byteSize!: number;

  @ApiProperty({ type: String, maxLength: 255 })
  @IsString()
  @MaxLength(255)
  filename!: string;
}

export class PhotoUploadTargetDto {
  @ApiProperty({ type: String, format: 'uuid' })
  photoId!: string;

  @ApiProperty({ type: String })
  uploadUrl!: string;

  @ApiProperty({ type: String, enum: ['PUT'] })
  method!: 'PUT';

  @ApiProperty({ type: Object, additionalProperties: { type: 'string' } })
  headers!: Record<string, string>;

  static from(photoId: string, target: PhotoUploadTarget): PhotoUploadTargetDto {
    return { photoId, uploadUrl: target.url, method: target.method, headers: target.headers };
  }
}

export class PhotoResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  itineraryItemId!: string | null;

  @ApiProperty({ type: String })
  mimeType!: string;

  @ApiProperty({ type: Number })
  byteSize!: number;

  @ApiProperty({ type: String })
  filename!: string;

  @ApiProperty({ enum: PhotoStatus, enumName: 'PhotoStatus' })
  status!: PhotoStatus;

  @ApiPropertyOptional({ type: String, nullable: true })
  originalUrl!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  optimizedUrl!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  thumbnailUrl!: string | null;

  static base(entity: PhotoEntity): Omit<PhotoResponseDto, 'originalUrl' | 'optimizedUrl' | 'thumbnailUrl'> {
    return {
      id: entity.id,
      itineraryItemId: entity.itineraryItemId,
      mimeType: entity.mimeType,
      byteSize: Number(entity.byteSize),
      filename: entity.originalFilename,
      status: entity.status,
    };
  }
}
