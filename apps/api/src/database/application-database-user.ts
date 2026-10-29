import type { DataSource } from 'typeorm';

export interface DatabaseCredentials {
  readonly password: string;
  readonly username: string;
}

const databaseIdentifierPattern = /^[a-z_][a-z0-9_]*$/;

export async function provisionApplicationDatabaseUser(
  dataSource: DataSource,
  databaseName: string,
  owner: DatabaseCredentials,
  application: DatabaseCredentials,
): Promise<void> {
  assertIdentifier(databaseName, 'database name');
  assertIdentifier(owner.username, 'database owner username');
  assertIdentifier(application.username, 'application database username');

  const roleExists = await dataSource.query<unknown[]>(
    'SELECT 1 FROM pg_roles WHERE rolname = $1',
    [application.username],
  );
  const action = roleExists.length === 0 ? 'CREATE ROLE' : 'ALTER ROLE';
  const roleStatement = await formatSql(
    dataSource,
    `${action} %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
    application.username,
    application.password,
  );
  await dataSource.query(roleStatement);

  const database = quoteIdentifier(databaseName);
  const applicationRole = quoteIdentifier(application.username);
  const ownerRole = quoteIdentifier(owner.username);
  await dataSource.query(`GRANT CONNECT ON DATABASE ${database} TO ${applicationRole}`);
  await dataSource.query(`GRANT USAGE ON SCHEMA public TO ${applicationRole}`);
  await dataSource.query(`REVOKE CREATE ON SCHEMA public FROM ${applicationRole}`);
  await dataSource.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${applicationRole}`);
  await dataSource.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${applicationRole}`);
  await dataSource.query(
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerRole} IN SCHEMA public ` +
    `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${applicationRole}`,
  );
  await dataSource.query(
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerRole} IN SCHEMA public ` +
    `GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${applicationRole}`,
  );
}

async function formatSql(dataSource: DataSource, format: string, ...values: string[]): Promise<string> {
  const placeholders = values.map((_, index) => `$${index + 2}`).join(', ');
  const rows = await dataSource.query<Array<{ statement?: unknown }>>(
    `SELECT format($1, ${placeholders}) AS statement`,
    [format, ...values],
  );
  const statement = rows[0]?.statement;
  if (typeof statement !== 'string') throw new Error('PostgreSQL did not return a formatted role statement');
  return statement;
}

function quoteIdentifier(value: string): string {
  return `"${value}"`;
}

function assertIdentifier(value: string, label: string): void {
  if (!databaseIdentifierPattern.test(value)) throw new Error(`${label} contains unsupported characters`);
}
