const DEFAULT_DATABASE_URL =
  'postgresql://tripus:tripus_local@localhost:5432/tripus';

export enum AiPlannerProvider {
  Mock = 'mock',
  OpenAi = 'openai',
}

export enum MapsProvider {
  Mock = 'mock',
  Google = 'google',
}

export enum AuthMode {
  Development = 'development',
  Jwt = 'jwt',
}

export enum PhotoStorageProvider {
  Local = 'local',
  S3 = 's3',
}

export function validateEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  const port = Number(environment.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const rawDatabaseUrl = environment.DATABASE_URL;
  if (rawDatabaseUrl !== undefined && typeof rawDatabaseUrl !== 'string') {
    throw new Error('DATABASE_URL must be a string');
  }

  const databaseUrl = rawDatabaseUrl ?? DEFAULT_DATABASE_URL;
  const parsedDatabaseUrl = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
    throw new Error('DATABASE_URL must use the postgres or postgresql protocol');
  }
  const databasePoolMax = positiveInteger(environment.DATABASE_POOL_MAX ?? 4, 'DATABASE_POOL_MAX');
  const databaseConnectionTimeoutMs = positiveInteger(
    environment.DATABASE_CONNECTION_TIMEOUT_MS ?? 5_000,
    'DATABASE_CONNECTION_TIMEOUT_MS',
  );
  const databaseIdleTimeoutMs = positiveInteger(
    environment.DATABASE_IDLE_TIMEOUT_MS ?? 30_000,
    'DATABASE_IDLE_TIMEOUT_MS',
  );
  const databaseStatementTimeoutMs = positiveInteger(
    environment.DATABASE_STATEMENT_TIMEOUT_MS ?? 15_000,
    'DATABASE_STATEMENT_TIMEOUT_MS',
  );

  const aiPlannerProvider = environment.AI_PLANNER_PROVIDER ?? AiPlannerProvider.Mock;
  if (!Object.values(AiPlannerProvider).includes(aiPlannerProvider as AiPlannerProvider)) {
    throw new Error('AI_PLANNER_PROVIDER must be mock or openai');
  }
  if (aiPlannerProvider === AiPlannerProvider.OpenAi) {
    if (typeof environment.OPENAI_API_KEY !== 'string' || environment.OPENAI_API_KEY.length === 0) {
      throw new Error('OPENAI_API_KEY is required when AI_PLANNER_PROVIDER=openai');
    }
    if (typeof environment.OPENAI_MODEL !== 'string' || environment.OPENAI_MODEL.length === 0) {
      throw new Error('OPENAI_MODEL is required when AI_PLANNER_PROVIDER=openai');
    }
  }
  const openAiTimeoutMs = positiveInteger(environment.OPENAI_TIMEOUT_MS ?? 120_000, 'OPENAI_TIMEOUT_MS');
  const openAiMaxRetries = nonNegativeInteger(environment.OPENAI_MAX_RETRIES ?? 2, 'OPENAI_MAX_RETRIES');
  const openAiMaxOutputTokens = positiveInteger(environment.OPENAI_MAX_OUTPUT_TOKENS ?? 1_200, 'OPENAI_MAX_OUTPUT_TOKENS');

  const mapsProvider = environment.MAPS_PROVIDER ?? MapsProvider.Mock;
  if (!Object.values(MapsProvider).includes(mapsProvider as MapsProvider)) {
    throw new Error('MAPS_PROVIDER must be mock or google');
  }
  if (mapsProvider === MapsProvider.Google &&
      (typeof environment.GOOGLE_MAPS_API_KEY !== 'string' || environment.GOOGLE_MAPS_API_KEY.length === 0)) {
    throw new Error('GOOGLE_MAPS_API_KEY is required when MAPS_PROVIDER=google');
  }
  const authMode = environment.AUTH_MODE ?? AuthMode.Development;
  if (!Object.values(AuthMode).includes(authMode as AuthMode)) {
    throw new Error('AUTH_MODE must be development or jwt');
  }
  const accessTokenSecret = environment.ACCESS_TOKEN_SECRET ?? 'tripus-development-secret-change-me';
  if (typeof accessTokenSecret !== 'string' || accessTokenSecret.length < 32) {
    throw new Error('ACCESS_TOKEN_SECRET must be at least 32 characters');
  }
  if (authMode === AuthMode.Jwt) {
    if (typeof environment.GOOGLE_OIDC_CLIENT_IDS !== 'string' || environment.GOOGLE_OIDC_CLIENT_IDS.length === 0) {
      throw new Error('GOOGLE_OIDC_CLIENT_IDS is required when AUTH_MODE=jwt');
    }
    if (typeof environment.APPLE_OIDC_CLIENT_IDS !== 'string' || environment.APPLE_OIDC_CLIENT_IDS.length === 0) {
      throw new Error('APPLE_OIDC_CLIENT_IDS is required when AUTH_MODE=jwt');
    }
  }
  const photoStorageProvider = environment.PHOTO_STORAGE_PROVIDER ?? PhotoStorageProvider.Local;
  if (!Object.values(PhotoStorageProvider).includes(photoStorageProvider as PhotoStorageProvider)) {
    throw new Error('PHOTO_STORAGE_PROVIDER must be local or s3');
  }
  if (photoStorageProvider === PhotoStorageProvider.S3) {
    if (typeof environment.PHOTO_S3_BUCKET !== 'string' || environment.PHOTO_S3_BUCKET.length === 0) {
      throw new Error('PHOTO_S3_BUCKET is required when PHOTO_STORAGE_PROVIDER=s3');
    }
    if (typeof environment.AWS_REGION !== 'string' || environment.AWS_REGION.length === 0) {
      throw new Error('AWS_REGION is required when PHOTO_STORAGE_PROVIDER=s3');
    }
  }

  return {
    ...environment,
    DATABASE_URL: databaseUrl,
    DATABASE_POOL_MAX: databasePoolMax,
    DATABASE_CONNECTION_TIMEOUT_MS: databaseConnectionTimeoutMs,
    DATABASE_IDLE_TIMEOUT_MS: databaseIdleTimeoutMs,
    DATABASE_STATEMENT_TIMEOUT_MS: databaseStatementTimeoutMs,
    AI_PLANNER_PROVIDER: aiPlannerProvider,
    MAPS_PROVIDER: mapsProvider,
    AUTH_MODE: authMode,
    ACCESS_TOKEN_SECRET: accessTokenSecret,
    ACCESS_TOKEN_ISSUER: environment.ACCESS_TOKEN_ISSUER ?? 'tripus-api',
    ACCESS_TOKEN_AUDIENCE: environment.ACCESS_TOKEN_AUDIENCE ?? 'tripus-mobile',
    OPENAI_TIMEOUT_MS: openAiTimeoutMs,
    OPENAI_MAX_RETRIES: openAiMaxRetries,
    OPENAI_MAX_OUTPUT_TOKENS: openAiMaxOutputTokens,
    PHOTO_STORAGE_PROVIDER: photoStorageProvider,
    PHOTO_LOCAL_DIRECTORY: environment.PHOTO_LOCAL_DIRECTORY ?? '.data/photos',
    API_PUBLIC_URL: environment.API_PUBLIC_URL ?? `http://localhost:${port}`,
    PORT: port,
  };
}

function positiveInteger(value: unknown, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function nonNegativeInteger(value: unknown, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer`);
  return parsed;
}

export function getDatabaseUrl(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return environment.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}
