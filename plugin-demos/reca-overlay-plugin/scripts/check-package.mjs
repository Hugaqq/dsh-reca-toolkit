import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const client = await readFile(resolve(root, 'lib/client.js'), 'utf8')
const host = await import(resolve(root, 'lib/index.js'))

const failures = []
if (pkg.exports?.['./client']?.default !== './lib/client.js') failures.push('missing ./client export')
if (pkg.dsh?.client?.platform !== 'web') failures.push('missing dsh.client web declaration')
if (!pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-connection')) failures.push('missing connection graph dependency')
if (!pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-runtime')) failures.push('missing runtime graph dependency')
if (!pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-layout')) failures.push('missing ui-layout graph dependency')
if (!client.includes('window.__ModuleLoader__.load')) failures.push('client bundle is not a ModuleLoader handoff')
if (!client.includes("ctx.slots.inject('shell.overlay'")) failures.push('client does not inject shell.overlay')
if (!client.includes("RecaTrace.useOverlayRunId")) failures.push('client does not bind run_id to current session')
if (!client.includes("RecaTrace.useTraceSnapshot")) failures.push('client does not use the shared RPC poller')
if (!client.includes("'/reca-trace'")) failures.push('shared trace runtime was not embedded')
if (typeof host.apply !== 'function') failures.push('host apply is not exported')

if (failures.length) {
  console.error(failures.map(item => `FAIL: ${item}`).join('\n'))
  process.exitCode = 1
} else {
  console.log('package contract check passed')
}
