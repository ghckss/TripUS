import { Check, Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'trip_day_settings' })
@Index('idx_trip_day_settings_trip', ['tripId'])
@Unique('uq_trip_day_settings_trip_date', ['tripId', 'date'])
@Check('chk_trip_day_settings_time', '"end_time" > "start_time"')
export class TripDaySettingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime!: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime!: string;

  @Column({ name: 'plan_b_place_name', type: 'varchar', length: 180, nullable: true })
  planBPlaceName!: string | null;

  @Column({ name: 'plan_b_address', type: 'varchar', length: 300, nullable: true })
  planBAddress!: string | null;

  @Column({ name: 'plan_b_reason', type: 'varchar', length: 500, nullable: true })
  planBReason!: string | null;
}
