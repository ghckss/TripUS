import { describe, expect, it } from 'vitest';

import { AiPlanGenerationEntity } from '../modules/ai-planning/domain/entities/ai-plan-generation.entity';
import { AuthIdentityEntity } from '../modules/auth/domain/entities/auth-identity.entity';
import { RefreshTokenEntity } from '../modules/auth/domain/entities/refresh-token.entity';
import { ItineraryItemEntity } from '../modules/itineraries/domain/entities/itinerary-item.entity';
import { PhotoEntity } from '../modules/photos/domain/entities/photo.entity';
import { SavedPlaceEntity } from '../modules/places/domain/entities/saved-place.entity';
import { TripEntity } from '../modules/trips/domain/entities/trip.entity';
import { UserEntity } from '../modules/users/domain/entities/user.entity';
import { createDataSourceOptions } from './data-source-options';

describe('createDataSourceOptions', () => {
  it('registers every application entity without relying on runtime file globs', () => {
    const options = createDataSourceOptions('postgres://tripus:secret@localhost:5432/tripus');

    expect(options.entities).toEqual([
      AiPlanGenerationEntity,
      AuthIdentityEntity,
      RefreshTokenEntity,
      ItineraryItemEntity,
      PhotoEntity,
      SavedPlaceEntity,
      TripEntity,
      UserEntity,
    ]);
  });
});
