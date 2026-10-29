import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from '../users/domain/entities/user.entity';
import { IDENTITY_PORT } from './domain/identity.port';
import { DevelopmentIdentityService } from './infrastructure/development-identity.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [
    DevelopmentIdentityService,
    { provide: IDENTITY_PORT, useExisting: DevelopmentIdentityService },
  ],
  exports: [IDENTITY_PORT],
})
export class IdentityModule {}
