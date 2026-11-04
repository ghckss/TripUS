import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import { SubscriptionTier, UserEntity } from '../../users/domain/entities/user.entity';
import { EntitlementsResponseDto } from './dto/entitlements-response.dto';

const FREE_TRIP_LIMIT = 1;
const FREE_AI_GENERATION_LIMIT = 1;

@Injectable()
export class EntitlementsService {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(TripEntity) private readonly trips: Repository<TripEntity>,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
  ) {}

  async get(): Promise<EntitlementsResponseDto> {
    const userId = this.identity.getCurrentUserId();
    const [user, tripCount] = await Promise.all([
      this.users.findOneBy({ id: userId }),
      this.trips.countBy({ ownerId: userId, active: true }),
    ]);
    if (!user) throw new UnauthorizedException('Authenticated user is unavailable');
    const plus = user.subscriptionTier === SubscriptionTier.Plus;
    return {
      tier: user.subscriptionTier,
      tripLimit: plus ? null : FREE_TRIP_LIMIT,
      tripCount,
      aiGenerationLimit: plus ? null : FREE_AI_GENERATION_LIMIT,
      aiGenerationsUsed: user.successfulAiGenerations,
    };
  }

  async assertCanCreateTrip(): Promise<void> {
    const entitlement = await this.get();
    if (entitlement.tripLimit !== null && entitlement.tripCount >= entitlement.tripLimit) {
      throw new ConflictException('무료 플랜에서는 활성·보관 여행을 합쳐 1개까지 만들 수 있어요. 기존 여행을 삭제하거나 Plus를 이용해 주세요.');
    }
  }

  async assertCanGenerateAiPlan(): Promise<void> {
    const entitlement = await this.get();
    if (entitlement.aiGenerationLimit !== null && entitlement.aiGenerationsUsed >= entitlement.aiGenerationLimit) {
      throw new ConflictException('무료 AI 일정 생성 1회를 모두 사용했어요. Plus에서 AI 일정을 더 만들 수 있어요.');
    }
  }

  async recordSuccessfulAiGeneration(): Promise<void> {
    await this.users.increment({ id: this.identity.getCurrentUserId() }, 'successfulAiGenerations', 1);
  }
}
