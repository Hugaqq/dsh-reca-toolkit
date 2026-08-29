import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const client = await readFile(resolve(root, 'lib/client.js'), 'utf8')
const host = await readFile(resolve(root, 'src/trace-bridge.js'), 'utf8')
const skill = await readFile(resolve(root, 'src/skill.js'), 'utf8')
const index = await readFile(resolve(root, 'src/index.js'), 'utf8')
const checks = []

function check(condition, label) {
  checks.push([Boolean(condition), label])
}

check(pkg.exports?.['./client'] === './lib/client.js', 'exports ./client')
check(pkg.dsh?.client?.platform === 'web', 'dsh.client platform web')
check(pkg.files?.includes('scripts'), 'published build/check scripts')
for (const dependency of [
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-ui-conversation',
]) {
  check(pkg.dsh?.client?.inject?.includes(dependency), `client dependency ${dependency}`)
}
check(client.includes('window.__ModuleLoader__.load({'), 'lazy-CJS ModuleLoader bundle')
check(client.includes("ctx.slots.inject('conversation.view'"), 'conversation.view surface')
check(client.includes("ctx.slots.inject('shell.overlay'"), 'shell.overlay surface')
check(!client.includes("ctx.slots.inject('details'"), 'no redundant details surface')
check(client.includes("const TRACE_RPC_CHANNEL = '/reca-trace'"), 'shared Host RPC polling channel')
check(client.includes("intervalMs = 1600"), 'deterministic 1.6 second polling')
check(host.includes('gatewayBaseUrl: MEDIA_PREFIX'), 'Host-owned media proxy boundary')
check(host.includes('"reca_create_video_interactive"'), 'Host interactive run binding')
check(index.includes('registerGetCapabilities(ctx, client)'), 'Gateway capability tool registration')
check(index.includes('registerCreateVideoInteractive(ctx, client)'), 'interactive create tool registration')
check(skill.includes('call reca_get_capabilities before answering'), 'GPT Image 2 capability guidance')
check(skill.includes('reca_create_video_interactive'), 'interactive routing guidance')
check(!client.includes('plugin-demos/'), 'no plugin-demos runtime dependency')

for (const file of [
  'lib/client.js',
  'src/index.js',
  'src/client.js',
  'src/interactive/creative-brief.js',
  'src/trace-bridge.js',
  'src/tools/create-video-interactive.js',
  'src/tools/get-capabilities.js',
  'src/client-ui/runtime/trace-adapter.cjs',
  'src/client-ui/runtime/trace-react.cjs',
  'src/client-ui/surfaces/tab.cjs',
  'src/client-ui/surfaces/overlay.cjs',
]) {
  const result = spawnSync(process.execPath, ['--check', resolve(root, file)], { encoding: 'utf8' })
  check(result.status === 0, `syntax ${file}${result.stderr ? `: ${result.stderr.trim()}` : ''}`)
}

const failures = checks.filter(([ok]) => !ok)
for (const [ok, label] of checks) console.log(`${ok ? 'ok' : 'not ok'} - ${label}`)
if (failures.length) process.exitCode = 1
