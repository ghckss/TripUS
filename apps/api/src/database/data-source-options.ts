import { join } from 'node:path';

import type { DataSourceOptions } from 'typeorm';

import { AiPlanGenerationEntity } from '../modules/ai-planning/domain/entities/ai-plan-generation.entity';
import { AuthIdentityEntity } from '../modules/auth/domain/entities/auth-identity.entity';
import { RefreshTokenEntity } from '../modules/auth/domain/entities/refresh-token.entity';
import { ItineraryItemEntity } from '../modules/itineraries/domain/entities/itinerary-item.entity';
import { PhotoEntity } from '../modules/photos/domain/entities/photo.entity';
import { SavedPlaceEntity } from '../modules/places/domain/entities/saved-place.entity';
import { TripEntity } from '../modules/trips/domain/entities/trip.entity';
import { UserEntity } from '../modules/users/domain/entities/user.entity';

export interface DatabaseConnectionOptions {
  readonly applicationName?: string;
  readonly connectionTimeoutMs?: number;
  readonly idleTimeoutMs?: number;
  readonly poolMax?: number;
  readonly statementTimeoutMs?: number;
}

const applicationEntities = [
  AiPlanGenerationEntity,
  AuthIdentityEntity,
  RefreshTokenEntity,
  ItineraryItemEntity,
  PhotoEntity,
  SavedPlaceEntity,
  TripEntity,
  UserEntity,
];

export function createDataSourceOptions(
  databaseUrl: string,
  connection: DatabaseConnectionOptions = {},
): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    // Keep entity metadata available after the API is bundled into web-main.mjs.
    // A __dirname-based entity glob resolves relative to the bundle instead of this
    // source module and silently leaves TypeORM repositories without metadata.
    entities: applicationEntities,
    migrations: [join(__dirname, 'migrations/*.{ts,js}')],
    migrationsRun: false,
    synchronize: false,
    extra: {
      application_name: connection.applicationName ?? 'tripus-api',
      connectionTimeoutMillis: connection.connectionTimeoutMs ?? 5_000,
      idleTimeoutMillis: connection.idleTimeoutMs ?? 30_000,
      max: connection.poolMax ?? 4,
      query_timeout: connection.statementTimeoutMs ?? 15_000,
    },
  };
}
