import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const infraDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceDirectory = resolve(infraDirectory, '..');
const stagingDirectory = mkdtempSync(join(tmpdir(), 'tripus-api-'));
const artifactDirectory = resolve(stagingDirectory, 'api');
const artifactFile = resolve(infraDirectory, '.artifacts/tripus-api.zip');

rmSync(artifactFile, { force: true });
mkdirSync(artifactDirectory, { recursive: true });
mkdirSync(dirname(artifactFile), { recursive: true });

try {
  run('pnpm', ['--filter', '@tripus/api', 'build']);
  run('pnpm', ['--filter', '@tripus/api', 'deploy', '--prod', artifactDirectory]);

  const armSharpPackage = resolve(artifactDirectory, 'node_modules/.pnpm/node_modules/@img/sharp-linux-arm64');
  const armSharpLibvipsPackage = resolve(artifactDirectory, 'node_modules/.pnpm/node_modules/@img/sharp-libvips-linux-arm64');
  if (!existsSync(armSharpPackage) || !existsSync(armSharpLibvipsPackage)) {
    throw new Error('The API artifact is missing the Linux Arm64 Sharp binary. Run pnpm install after enabling supportedArchitectures.');
  }

  run('zip', ['-qry', '-X', artifactFile, '.'], artifactDirectory);

  const digest = createHash('sha256').update(readFileSync(artifactFile)).digest('hex');
  console.log(`Created ${artifactFile}`);
  console.log(`SHA-256 ${digest}`);
} finally {
  rmSync(stagingDirectory, { force: true, recursive: true });
}

function run(command, args, cwd = workspaceDirectory) {
  execFileSync(command, args, {
    cwd,
    env: { ...process.env, CI: process.env.CI ?? 'true' },
    stdio: 'inherit',
  });
}
