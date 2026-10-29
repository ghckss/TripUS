import 'reflect-metadata';

import { DataSource } from 'typeorm';

import { getDatabaseUrl } from '../config/environment';
import { loadRuntimeSecrets, readJsonSecret, type RdsSecret } from '../config/runtime-secrets';
import { provisionApplicationDatabaseUser } from './application-database-user';
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
  const masterSecretArn = process.env.DATABASE_SECRET_ARN;
  const applicationSecretArn = process.env.APP_DATABASE_SECRET_ARN;
  if (!masterSecretArn || !applicationSecretArn) throw new Error('Database secret ARNs are required for migrations');
  const [master, application] = await Promise.all([
    readJsonSecret(masterSecretArn),
    readJsonSecret(applicationSecretArn),
  ]) as unknown as [RdsSecret, RdsSecret];
  assertCredentials(master, 'master database secret');
  assertCredentials(application, 'application database secret');
  const dataSource = new DataSource(createDataSourceOptions(getDatabaseUrl(), {
    applicationName: 'tripus-migration',
    connectionTimeoutMs: 10_000,
    idleTimeoutMs: 10_000,
    poolMax: 1,
    statementTimeoutMs: 300_000,
  }));

  try {
    await dataSource.initialize();
    const migrations = await dataSource.runMigrations({ transaction: 'all' });
    await provisionApplicationDatabaseUser(
      dataSource,
      process.env.DATABASE_NAME ?? 'tripus',
      master,
      application,
    );
    return {
      Data: { migrations: migrations.map((migration) => migration.name) },
      PhysicalResourceId: event.PhysicalResourceId ?? physicalResourceId,
    };
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

function assertCredentials(value: Partial<RdsSecret>, label: string): asserts value is RdsSecret {
  if (typeof value.username !== 'string' || typeof value.password !== 'string') {
    throw new Error(`${label} must contain username and password`);
  }
}
