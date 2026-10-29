import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserEntity } from '../../users/domain/entities/user.entity';
import { AuthMode } from '../../../config/environment';

export const DEVELOPMENT_USER_ID = '00000000-0000-4000-8000-000000000001';

@Injectable()
export class DevelopmentIdentityService implements OnModuleInit {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('AUTH_MODE') !== AuthMode.Development) return;
    await this.users.upsert(
      {
        id: DEVELOPMENT_USER_ID,
        email: 'traveler@tripus.local',
        displayName: '여행자',
      },
      ['email'],
    );
  }

}
