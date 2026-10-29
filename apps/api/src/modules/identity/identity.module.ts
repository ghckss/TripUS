import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from '../users/domain/entities/user.entity';
import { IDENTITY_PORT } from './domain/identity.port';
import { DevelopmentIdentityService } from './infrastructure/development-identity.service';
import { RequestIdentityService } from './infrastructure/request-identity.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [
    DevelopmentIdentityService,
    RequestIdentityService,
    { provide: IDENTITY_PORT, useExisting: RequestIdentityService },
  ],
  exports: [IDENTITY_PORT],
})
export class IdentityModule {}
