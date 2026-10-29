import type { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { provisionApplicationDatabaseUser } from './application-database-user';

describe('provisionApplicationDatabaseUser', () => {
  it('creates a restricted application role and grants only runtime data access', async () => {
    const query = vi.fn((sql: string, values?: unknown[]) => {
      if (sql.startsWith('SELECT 1 FROM pg_roles')) return Promise.resolve([]);
      if (sql.startsWith('SELECT format')) {
        expect(values).toEqual([
          'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
          'tripus_app',
          'secret',
        ]);
        return Promise.resolve([{ statement: 'CREATE ROLE "tripus_app" LOGIN PASSWORD \'secret\' NOSUPERUSER' }]);
      }
      return Promise.resolve([]);
    });

    await provisionApplicationDatabaseUser(
      { query } as unknown as DataSource,
      'tripus',
      { username: 'tripus_admin', password: 'admin-secret' },
      { username: 'tripus_app', password: 'secret' },
    );

    expect(query).toHaveBeenCalledWith('SELECT 1 FROM pg_roles WHERE rolname = $1', ['tripus_app']);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES'));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ALTER DEFAULT PRIVILEGES FOR ROLE "tripus_admin"'));
    expect(query).not.toHaveBeenCalledWith(expect.stringMatching(/GRANT ALL|\sSUPERUSER(?:\s|$)/));
  });

  it('rejects identifiers that cannot be safely quoted by the provisioning policy', async () => {
    await expect(provisionApplicationDatabaseUser(
      { query: vi.fn() } as unknown as DataSource,
      'tripus; DROP DATABASE tripus',
      { username: 'tripus_admin', password: 'admin-secret' },
      { username: 'tripus_app', password: 'secret' },
    )).rejects.toThrow('database name contains unsupported characters');
  });
});
