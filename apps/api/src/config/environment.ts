const DEFAULT_DATABASE_URL =
  'postgresql://tripus:tripus_local@localhost:5432/tripus';

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

  return {
    ...environment,
    DATABASE_URL: databaseUrl,
    PORT: port,
  };
}

export function getDatabaseUrl(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return environment.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}
