import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import { ItineraryItemEntity } from '../../../itineraries/domain/entities/itinerary-item.entity';
import { TripEntity } from '../../../trips/domain/entities/trip.entity';

export enum PhotoStatus {
  Pending = 'pending',
  Ready = 'ready',
  Failed = 'failed',
}

@Entity({ name: 'photos' })
@Index('idx_photos_trip_created', ['tripId', 'createdAt'])
@Index('idx_photos_itinerary_item', ['itineraryItemId'])
export class PhotoEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId!: string;

  @ManyToOne(() => TripEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id', foreignKeyConstraintName: 'fk_photos_trip' })
  trip!: TripEntity;

  @Column({ name: 'itinerary_item_id', type: 'uuid', nullable: true })
  itineraryItemId!: string | null;

  @Column({ name: 'replaces_photo_id', type: 'uuid', nullable: true })
  replacesPhotoId!: string | null;

  @ManyToOne(() => ItineraryItemEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'itinerary_item_id', foreignKeyConstraintName: 'fk_photos_itinerary_item' })
  itineraryItem!: ItineraryItemEntity | null;

  @Column({ name: 'original_key', type: 'varchar', length: 500 })
  originalKey!: string;

  @Column({ name: 'optimized_key', type: 'varchar', length: 500, nullable: true })
  optimizedKey!: string | null;

  @Column({ name: 'thumbnail_key', type: 'varchar', length: 500, nullable: true })
  thumbnailKey!: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ name: 'byte_size', type: 'bigint' })
  byteSize!: string;

  @Column({ name: 'original_filename', type: 'varchar', length: 255 })
  originalFilename!: string;

  @Column({ type: 'enum', enum: PhotoStatus, enumName: 'photo_status' })
  status!: PhotoStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
