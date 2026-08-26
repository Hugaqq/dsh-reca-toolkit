import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const patch = await readFile(join(root, 'cordis.patch.yml'), 'utf8');
const client = await readFile(join(root, 'lib/client.js'), 'utf8');

const checks = [
  [pkg.exports?.['./client']?.default === './lib/client.js', 'package exports ./client'],
  [pkg.dsh?.client?.platform === 'web', 'dsh.client web manifest'],
  [pkg.dsh?.client?.inject?.includes('@deepseek-ai/dsh-client-connection'), 'connection client dependency'],
  [pkg.dsh?.client?.inject?.includes('@deepseek-ai/dsh-client-ui-conversation'), 'conversation plugin dependency'],
  [pkg.dsh?.bundle?.patch === './cordis.patch.yml', 'bundle patch manifest'],
  [patch.includes(`name: ${pkg.name}`), 'profile patch inserts this package'],
  [client.includes('window.__ModuleLoader__.load({'), 'lazy-CJS loader wrapper'],
  [client.includes("ctx.slots.inject('conversation.view'"), 'conversation.view registration'],
  [client.includes("id: 'reca'"), 'ReCA view id'],
  [client.includes('RecaTrace.useSessionRunId(useSession, sessionId)'), 'session-bound run id discovery'],
  [client.includes('RecaTrace.useTraceSnapshot({ connection, runId, fallback: RECA_DEMO })'), 'real trace polling hook'],
  [client.includes("ctx.get('connection')"), 'host RPC connection injection'],
  [client.includes('normalizeRecaTraceSnapshot'), 'shared adapter embedded in bundle'],
];

for (const [passed, label] of checks) {
  if (!passed) throw new Error(`contract check failed: ${label}`);
}

for (const path of ['lib/index.js', 'lib/client.js', 'demo/app.js', 'scripts/serve.mjs']) {
  execFileSync(process.execPath, ['--check', join(root, path)], { stdio: 'inherit' });
}

console.log(`checked ${checks.length} Harness package contracts and 4 JavaScript entrypoints`);
