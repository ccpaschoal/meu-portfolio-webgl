import { spawnSync } from 'node:child_process';

for (const script of ['tests/cinematic.mjs', 'tests/interaction-quality.mjs']) {
  const result = spawnSync(process.execPath, [script], { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
