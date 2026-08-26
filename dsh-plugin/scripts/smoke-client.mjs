import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = await readFile(resolve(root, 'lib/client.js'), 'utf8')
let clientPlugin
const registrations = []
let disposed = 0

const React = {
  createElement() { return null },
  Fragment: Symbol('Fragment'),
}

const document = {
  head: { appendChild() {} },
  getElementById() { return null },
  querySelector() { return null },
  createElement() { return { dataset: {}, textContent: '' } },
}

const sandbox = {
  AbortController,
  URL,
  URLSearchParams,
  console,
  document,
  window: {
    __ModuleLoader__: {
      load(definition) {
        clientPlugin = definition.factory((name) => {
          if (name === 'react') return React
          throw new Error(`unexpected client module: ${name}`)
        })
      },
    },
  },
  setTimeout(callback) { callback(); return 1 },
  clearTimeout() {},
}
sandbox.globalThis = sandbox
vm.runInNewContext(source, sandbox, { filename: 'lib/client.js' })

if (!clientPlugin || typeof clientPlugin.apply !== 'function') {
  throw new Error('client bundle did not export apply()')
}
if (clientPlugin.inject.join(',') !== 'slots,connection,sessions') {
  throw new Error(`unexpected client inject contract: ${clientPlugin.inject}`)
}

const ctx = {
  connection: { rpc: {} },
  get(name) { return this[name] },
  sessions: {
    binding() { return { session: { subscribe() { return () => {} }, getSnapshot() { return null } } } },
  },
  slots: {
    inject(name, register) {
      const dispose = register()
      return () => {
        disposed += 1
        if (typeof dispose === 'function') dispose()
      }
    },
    register(spec, component) {
      registrations.push({ name: spec.name, id: spec.id, priority: spec.priority, component })
      return () => {}
    },
  },
}

const dispose = clientPlugin.apply(ctx)
const keys = registrations.map((item) => `${item.name}:${item.id || item.priority}`).sort()
for (const expected of ['conversation.view:reca', 'shell.overlay:reca-execution-drawer']) {
  if (!keys.includes(expected)) throw new Error(`missing registration ${expected}; got ${keys.join(', ')}`)
}
if (keys.some((key) => key.startsWith('details:'))) throw new Error(`redundant details surface remains: ${keys.join(', ')}`)
if (typeof dispose !== 'function') throw new Error('client apply() did not return a disposer')
dispose()
if (disposed !== 2) throw new Error(`expected two client disposers, got ${disposed}`)
console.log('ok - unified client bundle registers only tab and overlay surfaces')
