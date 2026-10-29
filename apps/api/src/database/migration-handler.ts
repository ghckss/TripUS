import 'reflect-metadata';

import { DataSource } from 'typeorm';

import { getDatabaseUrl } from '../config/environment';
import { loadRuntimeSecrets } from '../config/runtime-secrets';
import { createDataSourceOptions } from './data-source-options';

interface MigrationEvent {
  readonly PhysicalResourceId?: string;
  readonly RequestType: 'Create' | 'Delete' | 'Update';
}

interface MigrationResult {
  readonly Data?: { readonly migrations: readonly string[] };
  readonly PhysicalResourceId: string;
}

const physicalResourceId = 'tripus-database-migrations';

export async function handler(event: MigrationEvent): Promise<MigrationResult> {
  if (event.RequestType === 'Delete') {
    return { PhysicalResourceId: event.PhysicalResourceId ?? physicalResourceId };
  }

  await loadRuntimeSecrets();
  const dataSource = new DataSource(createDataSourceOptions(getDatabaseUrl()));

  try {
    await dataSource.initialize();
    const migrations = await dataSource.runMigrations({ transaction: 'all' });
    return {
      Data: { migrations: migrations.map((migration) => migration.name) },
      PhysicalResourceId: event.PhysicalResourceId ?? physicalResourceId,
    };
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}
