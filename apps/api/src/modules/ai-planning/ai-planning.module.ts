import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiPlannerProvider } from '../../config/environment';
import { IdentityModule } from '../identity/identity.module';
import { ItinerariesModule } from '../itineraries/itineraries.module';
import { SavedPlaceEntity } from '../places/domain/entities/saved-place.entity';
import { TripEntity } from '../trips/domain/entities/trip.entity';
import { AiPlanningService } from './application/ai-planning.service';
import { AI_PLANNER_PORT } from './domain/ai-planner.port';
import { MockAiPlannerAdapter } from './infrastructure/mock-ai-planner.adapter';
import { OpenAiPlannerAdapter } from './infrastructure/openai-ai-planner.adapter';
import { AiPlanningController } from './presentation/ai-planning.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TripEntity, SavedPlaceEntity]), IdentityModule, ItinerariesModule],
  controllers: [AiPlanningController],
  providers: [
    AiPlanningService,
    MockAiPlannerAdapter,
    {
      provide: AI_PLANNER_PORT,
      inject: [ConfigService, MockAiPlannerAdapter],
      useFactory: (config: ConfigService, mock: MockAiPlannerAdapter) =>
        config.get<string>('AI_PLANNER_PROVIDER') === AiPlannerProvider.OpenAi
          ? new OpenAiPlannerAdapter(config)
          : mock,
    },
  ],
})
export class AiPlanningModule {}
