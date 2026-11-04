import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IdentityModule } from '../identity/identity.module';
import { TripEntity } from '../trips/domain/entities/trip.entity';
import { UserEntity } from '../users/domain/entities/user.entity';
import { EntitlementsService } from './application/entitlements.service';
import { EntitlementsController } from './presentation/entitlements.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, TripEntity]), IdentityModule],
  controllers: [EntitlementsController],
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
