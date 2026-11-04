import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TripEntity } from '../../../trips/domain/entities/trip.entity';
import { AuthIdentityEntity } from '../../../auth/domain/entities/auth-identity.entity';
import { RefreshTokenEntity } from '../../../auth/domain/entities/refresh-token.entity';

export enum SubscriptionTier {
  Free = 'free',
  Plus = 'plus',
}

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 320, unique: true })
  email!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 80 })
  displayName!: string;

  @Column({ name: 'subscription_tier', type: 'enum', enum: SubscriptionTier, enumName: 'subscription_tier', default: SubscriptionTier.Free })
  subscriptionTier!: SubscriptionTier;

  @Column({ name: 'successful_ai_generations', type: 'integer', default: 0 })
  successfulAiGenerations!: number;

  @OneToMany(() => TripEntity, (trip) => trip.owner)
  trips!: TripEntity[];

  @OneToMany(() => AuthIdentityEntity, (identity) => identity.user)
  authIdentities!: AuthIdentityEntity[];

  @OneToMany(() => RefreshTokenEntity, (token) => token.user)
  refreshTokens!: RefreshTokenEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
