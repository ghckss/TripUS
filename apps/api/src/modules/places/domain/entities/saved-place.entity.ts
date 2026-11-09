import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ItineraryItemEntity } from '../../../itineraries/domain/entities/itinerary-item.entity';
import { TripEntity } from '../../../trips/domain/entities/trip.entity';

export enum PlaceTag {
  Attraction = 'attraction',
  Food = 'food',
  Cafe = 'cafe',
  Shopping = 'shopping',
  Lodging = 'lodging',
  Transport = 'transport',
  Activity = 'activity',
  Other = 'other',
}

export enum PlacePreference {
  MustVisit = 'must_visit',
  WantToVisit = 'want_to_visit',
  IfTimeAllows = 'if_time_allows',
}

@Entity({ name: 'saved_places' })
@Index('idx_saved_places_trip', ['tripId'])
@Index('uq_saved_places_trip_google_place', ['tripId', 'googlePlaceId'], {
  unique: true,
})
export class SavedPlaceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId!: string;

  @ManyToOne(() => TripEntity, (trip) => trip.savedPlaces, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'trip_id',
    foreignKeyConstraintName: 'fk_saved_places_trip',
  })
  trip!: TripEntity;

  @Column({ name: 'google_place_id', type: 'varchar', length: 255, nullable: true })
  googlePlaceId!: string | null;

  @Column({ type: 'varchar', length: 180 })
  name!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  address!: string | null;

  @Column({ type: 'enum', enum: PlaceTag, enumName: 'place_tag' })
  tag!: PlaceTag;

  @Column({ type: 'enum', enum: PlacePreference, enumName: 'place_preference' })
  preference!: PlacePreference;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'is_primary_lodging', type: 'boolean', default: false })
  isPrimaryLodging!: boolean;

  @OneToMany(() => ItineraryItemEntity, (item) => item.savedPlace)
  itineraryItems!: ItineraryItemEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
