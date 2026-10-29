import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { UserEntity } from '../../../users/domain/entities/user.entity';

export enum SocialAuthProvider {
  Google = 'google',
  Apple = 'apple',
}

@Entity({ name: 'auth_identities' })
@Index('uq_auth_identities_provider_subject', ['provider', 'subject'], { unique: true })
export class AuthIdentityEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, (user) => user.authIdentities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_auth_identities_user' })
  user!: UserEntity;

  @Column({ type: 'enum', enum: SocialAuthProvider, enumName: 'social_auth_provider' })
  provider!: SocialAuthProvider;

  @Column({ type: 'varchar', length: 255 })
  subject!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
