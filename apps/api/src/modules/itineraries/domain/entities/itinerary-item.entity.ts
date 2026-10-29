import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SavedPlaceEntity } from '../../../places/domain/entities/saved-place.entity';
import { TripEntity } from '../../../trips/domain/entities/trip.entity';

export enum ItinerarySource {
  Manual = 'manual',
  Ai = 'ai',
}

export enum VisitStatus {
  Rated = 'rated',
  Unrated = 'unrated',
  NotVisited = 'not_visited',
}

@Entity({ name: 'itinerary_items' })
@Index('idx_itinerary_items_trip_date_position', ['tripId', 'date', 'position'])
@Check('chk_itinerary_item_position', '"position" >= 0')
@Check(
  'chk_itinerary_item_placement',
  '("date" IS NULL AND "position" IS NULL) OR ("date" IS NOT NULL AND "position" IS NOT NULL)',
)
@Check(
  'chk_itinerary_item_visit_result',
  '("visit_status" = \'rated\' AND "rating" BETWEEN 1 AND 5) OR ("visit_status" IN (\'unrated\', \'not_visited\') AND "rating" IS NULL) OR ("visit_status" IS NULL AND "rating" IS NULL)',
)
export class ItineraryItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId!: string;

  @ManyToOne(() => TripEntity, (trip) => trip.itineraryItems, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'trip_id',
    foreignKeyConstraintName: 'fk_itinerary_items_trip',
  })
  trip!: TripEntity;

  @Column({ name: 'saved_place_id', type: 'uuid' })
  savedPlaceId!: string;

  @ManyToOne(() => SavedPlaceEntity, (place) => place.itineraryItems, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'saved_place_id',
    foreignKeyConstraintName: 'fk_itinerary_items_saved_place',
  })
  savedPlace!: SavedPlaceEntity;

  @Column({ type: 'date', nullable: true })
  date!: string | null;

  @Column({ type: 'integer', nullable: true })
  position!: number | null;

  @Column({ type: 'boolean', default: false })
  locked!: boolean;

  @Column({ type: 'enum', enum: ItinerarySource, enumName: 'itinerary_source' })
  source!: ItinerarySource;

  @Column({ name: 'visit_status', type: 'enum', enum: VisitStatus, enumName: 'visit_status', nullable: true })
  visitStatus!: VisitStatus | null;

  @Column({ type: 'smallint', nullable: true })
  rating!: number | null;

  @Column({ type: 'text', nullable: true })
  review!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
