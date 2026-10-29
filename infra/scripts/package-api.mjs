import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
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

  for (const relativePath of ['.data', 'src', 'tsconfig.json', 'tsconfig.build.json', 'tsconfig.tsbuildinfo', 'dist/.tsbuildinfo', 'dist/scripts']) {
    rmSync(resolve(artifactDirectory, relativePath), { force: true, recursive: true });
  }
  removeNonRuntimeFiles(artifactDirectory);
  removeUnsupportedSharpPackages(artifactDirectory);

  const armSharpPackage = resolve(artifactDirectory, 'node_modules/.pnpm/node_modules/@img/sharp-linux-arm64');
  const armSharpLibvipsPackage = resolve(artifactDirectory, 'node_modules/.pnpm/node_modules/@img/sharp-libvips-linux-arm64');
  if (!existsSync(armSharpPackage) || !existsSync(armSharpLibvipsPackage)) {
    throw new Error('The API artifact is missing the Linux Arm64 Sharp binary. Run pnpm install after enabling supportedArchitectures.');
  }
  for (const forbiddenPath of ['.data', 'src']) {
    if (existsSync(resolve(artifactDirectory, forbiddenPath))) {
      throw new Error(`The API artifact contains forbidden local path: ${forbiddenPath}`);
    }
  }

  const uncompressedBytes = directorySize(artifactDirectory);
  if (uncompressedBytes > 512 * 1024 * 1024) {
    throw new Error(`The API artifact exceeds the 512 MB Web Function limit: ${uncompressedBytes} bytes`);
  }

  run('zip', ['-qry', '-X', artifactFile, '.'], artifactDirectory);

  const digest = createHash('sha256').update(readFileSync(artifactFile)).digest('hex');
  console.log(`Created ${artifactFile}`);
  console.log(`SHA-256 ${digest}`);
  console.log(`Uncompressed bytes ${uncompressedBytes}`);
} finally {
  rmSync(stagingDirectory, { force: true, recursive: true });
}

function removeNonRuntimeFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      removeNonRuntimeFiles(path);
    } else if (entry.isFile() && (entry.name.endsWith('.map') || entry.name.endsWith('.d.ts') ||
      entry.name.endsWith('.d.mts') || entry.name.endsWith('.d.cts') || entry.name.endsWith('.tsbuildinfo'))) {
      rmSync(path, { force: true });
    }
  }
}

function removeUnsupportedSharpPackages(directory) {
  removeUnsupportedSharpEntries(directory);
}

function removeUnsupportedSharpEntries(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if ((entry.name.includes('sharp-darwin-arm64') || entry.name.includes('sharp-linuxmusl-arm64') ||
        entry.name.includes('sharp-libvips-darwin-arm64') || entry.name.includes('sharp-libvips-linuxmusl-arm64'))) {
      rmSync(path, { force: true, recursive: true });
    } else if (entry.isDirectory()) {
      removeUnsupportedSharpEntries(path);
    }
  }
  /* pnpm's virtual store also exposes platform packages through a shared @img directory. */
  const virtualStore = resolve(directory, 'node_modules/.pnpm');
  if (existsSync(virtualStore)) {
    for (const entry of readdirSync(virtualStore)) {
      if (/^@img\+sharp-(darwin|linuxmusl)-arm64@/.test(entry) ||
          /^@img\+sharp-libvips-(darwin|linuxmusl)-arm64@/.test(entry)) {
        rmSync(resolve(virtualStore, entry), { force: true, recursive: true });
      }
    }
  }
  const imageModules = resolve(virtualStore, 'node_modules/@img');
  if (existsSync(imageModules)) {
    for (const entry of readdirSync(imageModules)) {
      if (entry.includes('darwin-arm64') || entry.includes('linuxmusl-arm64')) {
        rmSync(resolve(imageModules, entry), { force: true, recursive: true });
      }
    }
  }
}

function directorySize(directory) {
  let bytes = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) bytes += directorySize(path);
    else bytes += lstatSync(path).size;
  }
  return bytes;
}

function run(command, args, cwd = workspaceDirectory) {
  execFileSync(command, args, {
    cwd,
    env: { ...process.env, CI: process.env.CI ?? 'true' },
    stdio: 'inherit',
  });
}
