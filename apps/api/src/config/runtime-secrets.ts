import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

interface SecretReader {
  send(command: GetSecretValueCommand): Promise<{ SecretString?: string }>;
}

interface RdsSecret {
  readonly dbname?: string;
  readonly host: string;
  readonly password: string;
  readonly port?: number;
  readonly username: string;
}

export async function loadRuntimeSecrets(
  environment: NodeJS.ProcessEnv = process.env,
  reader: SecretReader = new SecretsManagerClient({}),
): Promise<void> {
  const runtimeSecretArn = environment.RUNTIME_SECRET_ARN;
  if (runtimeSecretArn) {
    const runtimeSecret = await readJsonSecret(reader, runtimeSecretArn);
    for (const [key, value] of Object.entries(runtimeSecret)) {
      if (environment[key] === undefined && typeof value === 'string' && value.length > 0) {
        environment[key] = value;
      }
    }
  }

  const databaseSecretArn = environment.DATABASE_SECRET_ARN;
  if (!environment.DATABASE_URL && databaseSecretArn) {
    const secret = await readJsonSecret(reader, databaseSecretArn) as unknown as RdsSecret;
    assertRdsSecret(secret);

    const host = environment.DATABASE_PROXY_HOST ?? secret.host;
    const port = secret.port ?? 5432;
    const database = environment.DATABASE_NAME ?? secret.dbname ?? 'tripus';
    environment.DATABASE_URL =
      `postgresql://${encodeURIComponent(secret.username)}:${encodeURIComponent(secret.password)}` +
      `@${host}:${port}/${encodeURIComponent(database)}?sslmode=require`;
  }
}

async function readJsonSecret(reader: SecretReader, secretId: string): Promise<Record<string, unknown>> {
  const response = await reader.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!response.SecretString) throw new Error(`Secret ${secretId} does not contain a SecretString`);

  const parsed: unknown = JSON.parse(response.SecretString);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Secret ${secretId} must contain a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function assertRdsSecret(secret: Partial<RdsSecret>): asserts secret is RdsSecret {
  for (const key of ['host', 'username', 'password'] as const) {
    if (typeof secret[key] !== 'string' || secret[key].length === 0) {
      throw new Error(`Database secret is missing ${key}`);
    }
  }
}
