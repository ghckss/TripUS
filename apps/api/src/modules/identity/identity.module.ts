import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from '../users/entities/user.entity';
import { DevelopmentIdentityService } from './development-identity.service';
import { IDENTITY_PORT } from './identity.port';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [
    DevelopmentIdentityService,
    { provide: IDENTITY_PORT, useExisting: DevelopmentIdentityService },
  ],
  exports: [IDENTITY_PORT],
})
export class IdentityModule {}
