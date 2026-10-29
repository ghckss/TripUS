import { Injectable, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserEntity } from '../users/entities/user.entity';
import type { IdentityPort } from './identity.port';

export const DEVELOPMENT_USER_ID = '00000000-0000-4000-8000-000000000001';

@Injectable()
export class DevelopmentIdentityService implements IdentityPort, OnModuleInit {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.users.upsert(
      {
        id: DEVELOPMENT_USER_ID,
        email: 'traveler@tripus.local',
        displayName: '여행자',
      },
      ['email'],
    );
  }

  getCurrentUserId(): string {
    return DEVELOPMENT_USER_ID;
  }
}
