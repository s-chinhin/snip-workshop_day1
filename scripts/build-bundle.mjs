#!/usr/bin/env node
// Assembles the generated `bundle` release branch from the backend, frontend and
// cli branches: one Bun process serving API + redirects + the built web UI, with
// the CLI alongside. Zero dependencies; runs on Windows, macOS, Linux and in CI.
//
//   node scripts/build-bundle.mjs          build + commit locally
//   node scripts/build-bundle.mjs --push   ...and push the bundle branch and main
//
// Safe to re-run: when nothing changed it commits nothing and pushes nothing.

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const push = process.argv.includes('--push');
const bundleDir = join(root, 'bundle');
const frontendDir = join(root, 'frontend');
const buildOutput = join(frontendDir, 'dist', 'snip-frontend', 'browser');

function run(cmd, args, cwd = root) {
  console.log(`$ ${[cmd, ...args].join(' ')}${cwd === root ? '' : `   (in ${cwd})`}`);
  // npm/npx are .cmd shims on Windows and need a shell to launch; nothing else gets
  // one, so arguments with spaces (commit messages) stay intact.
  const shell = process.platform === 'win32' && (cmd === 'npm' || cmd === 'npx');
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell });
  if (result.status !== 0) {
    console.error(`build-bundle: "${cmd} ${args.join(' ')}" failed (exit ${result.status})`);
    process.exit(1);
  }
}

// True when the index has staged changes (git diff --cached --quiet exits 1).
function hasStagedChanges(cwd) {
  const result = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd });
  if (result.status > 1 || result.error) {
    console.error('build-bundle: git diff --cached failed');
    process.exit(1);
  }
  return result.status === 1;
}

function write(file, contents) {
  writeFileSync(join(bundleDir, file), contents);
}

// 1. Move the source submodules to their branch tips. bundle stays at the commit
//    main pins: this script is the only writer and pushes both together, so that
//    pin is the latest release (and --remote would drop an unpushed local one).
run('git', ['submodule', 'update', '--init', '--remote', 'backend', 'frontend', 'cli']);
run('git', ['submodule', 'update', '--init', 'bundle']);

// 2. Build the web UI.
run('npm', ['install', '--no-audit', '--no-fund'], frontendDir);
run('npx', ['ng', 'build'], frontendDir);
if (!existsSync(join(buildOutput, 'index.html'))) {
  console.error(`build-bundle: ${buildOutput}/index.html is missing; did the Angular project name or output path change?`);
  process.exit(1);
}

// 3. Assemble bundle/ from scratch, keeping only .git and the README.
for (const entry of readdirSync(bundleDir)) {
  if (entry !== '.git' && entry !== 'README.md') rmSync(join(bundleDir, entry), { recursive: true, force: true });
}
cpSync(join(root, 'backend', 'server.js'), join(bundleDir, 'server.js'));
cpSync(join(root, 'cli', 'cli.js'), join(bundleDir, 'cli.js'));
mkdirSync(join(bundleDir, 'public'));
cpSync(buildOutput, join(bundleDir, 'public'), { recursive: true });

// Bun auto-loads .env, which switches server.js into also-serve-the-UI mode.
write('.env', 'PUBLIC_DIR=./public\n');
// No "type" field: cli.js is CommonJS and must still run under plain node.
write(
  'package.json',
  JSON.stringify(
    {
      name: 'snip-bundle',
      private: true,
      description: 'Generated Snip release: API + redirects + web UI in one Bun process, plus the CLI',
      scripts: { start: 'bun server.js' },
      bin: { snip: 'cli.js' },
    },
    null,
    2,
  ) + '\n',
);
write(
  'Dockerfile',
  `FROM oven/bun:1-alpine
WORKDIR /app
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "server.js"]
`,
);
write('.dockerignore', '.git\nDockerfile\n.dockerignore\nREADME.md\nrailway.json\n');
write(
  'railway.json',
  JSON.stringify(
    { $schema: 'https://railway.com/railway.schema.json', build: { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile' } },
    null,
    2,
  ) + '\n',
);

// 4. Commit the release inside bundle/, only if its contents changed.
run('git', ['add', '-A'], bundleDir);
if (hasStagedChanges(bundleDir)) {
  run('git', ['commit', '-q', '-m', 'Rebuild bundle'], bundleDir);
  console.log('bundle: committed a new release');
} else {
  console.log('bundle: unchanged, nothing to commit');
}
// Submodule checkouts are usually detached, so push HEAD to the branch by name.
// Pushing an up-to-date HEAD is a harmless no-op.
if (push) run('git', ['push', 'origin', 'HEAD:bundle'], bundleDir);

// 5. Bump the submodule pointers in the superproject, only if any moved.
run('git', ['add', 'backend', 'frontend', 'cli', 'bundle']);
if (hasStagedChanges(root)) {
  run('git', ['commit', '-q', '-m', 'Bump submodules and rebuild bundle']);
  console.log('main: committed submodule pointer bump');
} else {
  console.log('main: submodule pointers unchanged, nothing to commit');
}
if (push) run('git', ['push', 'origin', 'HEAD:main']);
