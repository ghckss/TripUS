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

  const mapsProvider = environment.MAPS_PROVIDER ?? MapsProvider.Mock;
  if (!Object.values(MapsProvider).includes(mapsProvider as MapsProvider)) {
    throw new Error('MAPS_PROVIDER must be mock or google');
  }
  if (mapsProvider === MapsProvider.Google &&
      (typeof environment.GOOGLE_MAPS_API_KEY !== 'string' || environment.GOOGLE_MAPS_API_KEY.length === 0)) {
    throw new Error('GOOGLE_MAPS_API_KEY is required when MAPS_PROVIDER=google');
  }

  return {
    ...environment,
    DATABASE_URL: databaseUrl,
    AI_PLANNER_PROVIDER: aiPlannerProvider,
    MAPS_PROVIDER: mapsProvider,
    PORT: port,
  };
}

export function getDatabaseUrl(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return environment.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}
