import { ApiProperty } from '@nestjs/swagger';

import { SubscriptionTier } from '../../../users/domain/entities/user.entity';

export class EntitlementsResponseDto {
  @ApiProperty({ enum: SubscriptionTier, enumName: 'SubscriptionTier' })
  tier!: SubscriptionTier;

  @ApiProperty({ nullable: true, example: 1, type: Number })
  tripLimit!: number | null;

  @ApiProperty({ example: 0 })
  tripCount!: number;

  @ApiProperty({ nullable: true, example: 1, type: Number })
  aiGenerationLimit!: number | null;

  @ApiProperty({ example: 0 })
  aiGenerationsUsed!: number;
}
