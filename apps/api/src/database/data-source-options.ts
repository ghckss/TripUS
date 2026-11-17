import { join } from 'node:path';

import type { DataSourceOptions } from 'typeorm';

export interface DatabaseConnectionOptions {
  readonly applicationName?: string;
  readonly connectionTimeoutMs?: number;
  readonly idleTimeoutMs?: number;
  readonly poolMax?: number;
  readonly statementTimeoutMs?: number;
}

export function createDataSourceOptions(
  databaseUrl: string,
  connection: DatabaseConnectionOptions = {},
): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [join(__dirname, '../modules/**/*.entity.{ts,js}')],
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
