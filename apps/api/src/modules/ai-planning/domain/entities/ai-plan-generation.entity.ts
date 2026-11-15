import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import type { GenerateAiPlanDto } from '../../application/dto/generate-ai-plan.dto';

export enum AiPlanGenerationJobStatus {
  Queued = 'queued',
  Running = 'running',
  Generated = 'generated',
  Conflict = 'conflict',
  Unavailable = 'unavailable',
}

@Entity({ name: 'ai_plan_generations' })
@Index('idx_ai_plan_generations_trip_created', ['tripId', 'createdAt'])
@Index('idx_ai_plan_generations_owner_created', ['ownerId', 'createdAt'])
export class AiPlanGenerationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId!: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Column({ type: 'jsonb' })
  request!: GenerateAiPlanDto;

  @Column({ name: 'target_date', type: 'date', nullable: true })
  targetDate!: string | null;

  @Column({ type: 'varchar', length: 24 })
  status!: AiPlanGenerationJobStatus;

  @Column({ name: 'failure_reason', type: 'varchar', length: 120, nullable: true })
  failureReason!: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
