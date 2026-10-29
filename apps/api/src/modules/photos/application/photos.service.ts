import { randomUUID } from 'node:crypto';

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { ItineraryItemEntity } from '../../itineraries/domain/entities/itinerary-item.entity';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import { PhotoEntity, PhotoStatus } from '../domain/entities/photo.entity';
import { PHOTO_STORAGE_PORT, type PhotoStoragePort } from '../domain/photo-storage.port';
import { CreatePhotoUploadDto, PhotoResponseDto, PhotoUploadTargetDto } from './dto/photo.dto';
import { PhotoProcessor } from './photo-processor';

export type PhotoVariant = 'original' | 'optimized' | 'thumbnail';

@Injectable()
export class PhotosService {
  constructor(
    @InjectRepository(PhotoEntity) private readonly photos: Repository<PhotoEntity>,
    @InjectRepository(TripEntity) private readonly trips: Repository<TripEntity>,
    @InjectRepository(ItineraryItemEntity) private readonly itineraryItems: Repository<ItineraryItemEntity>,
    @Inject(PHOTO_STORAGE_PORT) private readonly storage: PhotoStoragePort,
    @Inject(PhotoProcessor) private readonly processor: PhotoProcessor,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
  ) {}

  async createUpload(tripId: string, input: CreatePhotoUploadDto): Promise<PhotoUploadTargetDto> {
    const userId = this.identity.getCurrentUserId();
    await this.assertOwnedTrip(tripId);
    if (input.itineraryItemId) {
      const item = await this.itineraryItems.findOneBy({ id: input.itineraryItemId, tripId });
      if (!item) throw new NotFoundException('Itinerary item not found');
    }
    const id = randomUUID();
    const originalKey = `${userId}/${tripId}/${id}/original.${extensionFor(input.mimeType)}`;
    await this.photos.save(this.photos.create({
      id,
      tripId,
      itineraryItemId: input.itineraryItemId ?? null,
      originalKey,
      optimizedKey: null,
      thumbnailKey: null,
      mimeType: input.mimeType,
      byteSize: String(input.byteSize),
      originalFilename: input.filename,
      status: PhotoStatus.Pending,
    }));
    const target = await this.storage.createUploadTarget({
      key: originalKey,
      mimeType: input.mimeType,
      fallbackPath: `/v1/trips/${tripId}/photos/${id}/content`,
    });
    return PhotoUploadTargetDto.from(id, target);
  }

  async uploadContent(tripId: string, photoId: string, body: Uint8Array, contentType?: string): Promise<void> {
    const photo = await this.getOwnedPhoto(tripId, photoId);
    if (photo.status !== PhotoStatus.Pending) throw new BadRequestException('Photo upload is already finalized');
    if (body.byteLength > 100 * 1024 * 1024) throw new BadRequestException('Photo exceeds the 100 MB per-file limit');
    if (contentType && !contentType.startsWith(photo.mimeType)) throw new BadRequestException('Photo content type does not match');
    await this.storage.write(photo.originalKey, body, photo.mimeType);
    photo.byteSize = String(body.byteLength);
    await this.photos.save(photo);
  }

  async confirm(tripId: string, photoId: string): Promise<PhotoResponseDto> {
    const photo = await this.getOwnedPhoto(tripId, photoId);
    if (photo.status === PhotoStatus.Ready) return this.toResponse(photo);
    try {
      const original = await this.storage.read(photo.originalKey);
      const derivatives = await this.processor.createDerivatives(original);
      photo.optimizedKey = `${this.identity.getCurrentUserId()}/${tripId}/${photo.id}/optimized.jpg`;
      photo.thumbnailKey = `${this.identity.getCurrentUserId()}/${tripId}/${photo.id}/thumbnail.jpg`;
      await Promise.all([
        this.storage.write(photo.optimizedKey, derivatives.optimized, 'image/jpeg'),
        this.storage.write(photo.thumbnailKey, derivatives.thumbnail, 'image/jpeg'),
      ]);
      photo.status = PhotoStatus.Ready;
      await this.photos.save(photo);
      return this.toResponse(photo);
    } catch (error) {
      photo.status = PhotoStatus.Failed;
      await this.photos.save(photo);
      throw new BadRequestException('Photo could not be processed', { cause: error });
    }
  }

  async list(tripId: string): Promise<PhotoResponseDto[]> {
    await this.assertOwnedTrip(tripId);
    const photos = await this.photos.find({ where: { tripId }, order: { createdAt: 'ASC' } });
    return Promise.all(photos.map((photo) => this.toResponse(photo)));
  }

  async readFile(tripId: string, photoId: string, variant: PhotoVariant): Promise<{ body: Uint8Array; mimeType: string }> {
    const photo = await this.getOwnedPhoto(tripId, photoId);
    const key = variant === 'original' ? photo.originalKey : variant === 'optimized' ? photo.optimizedKey : photo.thumbnailKey;
    if (!key) throw new NotFoundException('Photo variant not found');
    return { body: await this.storage.read(key), mimeType: variant === 'original' ? photo.mimeType : 'image/jpeg' };
  }

  private async toResponse(photo: PhotoEntity): Promise<PhotoResponseDto> {
    const path = (variant: PhotoVariant) => `/v1/trips/${photo.tripId}/photos/${photo.id}/files/${variant}`;
    const [originalUrl, optimizedUrl, thumbnailUrl] = await Promise.all([
      this.storage.createDownloadUrl({ key: photo.originalKey, fallbackPath: path('original') }),
      photo.optimizedKey ? this.storage.createDownloadUrl({ key: photo.optimizedKey, fallbackPath: path('optimized') }) : null,
      photo.thumbnailKey ? this.storage.createDownloadUrl({ key: photo.thumbnailKey, fallbackPath: path('thumbnail') }) : null,
    ]);
    return { ...PhotoResponseDto.base(photo), originalUrl, optimizedUrl, thumbnailUrl };
  }

  private async getOwnedPhoto(tripId: string, photoId: string): Promise<PhotoEntity> {
    await this.assertOwnedTrip(tripId);
    const photo = await this.photos.findOneBy({ id: photoId, tripId });
    if (!photo) throw new NotFoundException('Photo not found');
    return photo;
  }

  private async assertOwnedTrip(tripId: string): Promise<void> {
    const trip = await this.trips.findOneBy({ id: tripId, ownerId: this.identity.getCurrentUserId(), active: true });
    if (!trip) throw new NotFoundException('Trip not found');
  }
}

function extensionFor(mimeType: string): string {
  return mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1] ?? 'image';
}
