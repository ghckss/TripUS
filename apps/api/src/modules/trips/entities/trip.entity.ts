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

import { ItineraryItemEntity } from '../../itineraries/entities/itinerary-item.entity';
import { SavedPlaceEntity } from '../../places/entities/saved-place.entity';
import { UserEntity } from '../../users/entities/user.entity';

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

  @Column({ type: 'varchar', length: 64 })
  timezone!: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: string;

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
