import {
  Check,
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
import { SavedPlaceEntity } from '../../../places/domain/entities/saved-place.entity';
import { UserEntity } from '../../../users/domain/entities/user.entity';

export interface TripRegion {
  googlePlaceId: string | null;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface TripBoundaryPoint {
  googlePlaceId: string | null;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  time: string | null;
}

export interface TripAiPlanRequest {
  density?: string;
  themes?: string[];
  companions?: string;
  transportModes?: string[];
  budgetLevel?: string;
  additionalRequests?: string;
  /** Legacy fields retained so requests saved before the input redesign can be restored. */
  style?: string;
  transportMode?: string;
  preferences?: string;
  avoidances?: string;
}

@Entity({ name: 'trips' })
@Index('idx_trips_owner_active', ['ownerId', 'active'])
@Check('chk_trips_date_range', '"end_date" >= "start_date"')
export class TripEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @ManyToOne(() => UserEntity, (user) => user.trips, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'owner_id', foreignKeyConstraintName: 'fk_trips_owner' })
  owner!: UserEntity;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  @Column({ type: 'varchar', length: 120 })
  destination!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  regions!: TripRegion[];

  @Column({ type: 'varchar', length: 64 })
  timezone!: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: string;

  @Column({ name: 'start_point', type: 'jsonb', nullable: true })
  startPoint!: TripBoundaryPoint | null;

  @Column({ name: 'end_point', type: 'jsonb', nullable: true })
  endPoint!: TripBoundaryPoint | null;

  @Column({ name: 'latest_ai_plan_request', type: 'jsonb', nullable: true })
  latestAiPlanRequest!: TripAiPlanRequest | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @OneToMany(() => SavedPlaceEntity, (place) => place.trip)
  savedPlaces!: SavedPlaceEntity[];

  @OneToMany(() => ItineraryItemEntity, (item) => item.trip)
  itineraryItems!: ItineraryItemEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
