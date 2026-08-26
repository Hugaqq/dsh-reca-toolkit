import { access, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname)
const variants = [
  ['reca-tab-plugin', 'conversation.view'],
  ['reca-overlay-plugin', 'shell.overlay'],
  ['reca-details-plugin', 'details'],
]

function clientExportPath(pkg) {
  const value = pkg.exports?.['./client']
  if (typeof value === 'string') return value
  return value?.default
}

for (const [directory, slot] of variants) {
  const base = resolve(root, directory)
  const pkg = JSON.parse(await readFile(resolve(base, 'package.json'), 'utf8'))
  if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') {
    throw new Error(`${directory}: missing dsh.bundle.patch`)
  }
  if (pkg.dsh?.client?.platform !== 'web' || !Array.isArray(pkg.dsh?.client?.inject)) {
    throw new Error(`${directory}: invalid dsh.client manifest`)
  }

  const clientPath = clientExportPath(pkg)
  if (typeof clientPath !== 'string') throw new Error(`${directory}: missing ./client export`)
  const clientFile = resolve(base, clientPath)
  await access(clientFile)
  await access(resolve(base, 'demo/index.html'))

  const [bundle, patch] = await Promise.all([
    readFile(clientFile, 'utf8'),
    readFile(resolve(base, 'cordis.patch.yml'), 'utf8'),
  ])
  if (!bundle.includes('window.__ModuleLoader__.load')) {
    throw new Error(`${directory}: client export is not a Harness closure-factory bundle`)
  }
  if (!bundle.includes(JSON.stringify(pkg.name)) && !bundle.includes(`id: '${pkg.name}'`)) {
    throw new Error(`${directory}: client bundle id does not match package name`)
  }
  if (!bundle.includes(slot)) throw new Error(`${directory}: expected slot ${slot} not found`)
  if (!patch.includes(pkg.name)) throw new Error(`${directory}: bundle patch does not mount package`)

  const syntax = spawnSync(process.execPath, ['--check', clientFile], { encoding: 'utf8' })
  if (syntax.status !== 0) throw new Error(`${directory}: ${syntax.stderr.trim()}`)
  console.log(`ok ${directory.padEnd(24)} ${slot}`)
}

console.log('all three Harness plugin demos passed the lightweight package check')
