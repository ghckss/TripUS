import { join } from 'node:path';

import type { DataSourceOptions } from 'typeorm';

export function createDataSourceOptions(
  databaseUrl: string,
): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [join(__dirname, '../modules/**/*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations/*.{ts,js}')],
    migrationsRun: false,
    synchronize: false,
  };
}
