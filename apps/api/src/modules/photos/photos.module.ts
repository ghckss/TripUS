import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PhotoStorageProvider } from '../../config/environment';
import { IdentityModule } from '../identity/identity.module';
import { ItineraryItemEntity } from '../itineraries/domain/entities/itinerary-item.entity';
import { TripEntity } from '../trips/domain/entities/trip.entity';
import { PhotoProcessor } from './application/photo-processor';
import { PhotosService } from './application/photos.service';
import { PhotoEntity } from './domain/entities/photo.entity';
import { PHOTO_STORAGE_PORT } from './domain/photo-storage.port';
import { LocalPhotoStorageAdapter } from './infrastructure/local-photo-storage.adapter';
import { S3PhotoStorageAdapter } from './infrastructure/s3-photo-storage.adapter';
import { PhotosController } from './presentation/photos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PhotoEntity, TripEntity, ItineraryItemEntity]), IdentityModule],
  controllers: [PhotosController],
  providers: [
    PhotosService,
    PhotoProcessor,
    LocalPhotoStorageAdapter,
    {
      provide: PHOTO_STORAGE_PORT,
      inject: [ConfigService, LocalPhotoStorageAdapter],
      useFactory: (config: ConfigService, local: LocalPhotoStorageAdapter) =>
        config.get<string>('PHOTO_STORAGE_PROVIDER') === PhotoStorageProvider.S3
          ? new S3PhotoStorageAdapter(config)
          : local,
    },
  ],
  exports: [PhotosService],
})
export class PhotosModule {}
