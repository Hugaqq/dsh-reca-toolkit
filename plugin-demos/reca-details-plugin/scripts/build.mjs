import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { embeddedTraceRuntime } from '../../shared/embed.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const [host, client, css] = await Promise.all([
  readFile(resolve(root, 'src/index.js'), 'utf8'),
  readFile(resolve(root, 'src/client.js'), 'utf8'),
  readFile(resolve(root, 'src/client.css'), 'utf8'),
])
const traceRuntime = await embeddedTraceRuntime(4)
const bundle = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkg.name)},
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    if (!document.querySelector('style[data-plugin="reca-details-demo"]')) {
      const style = document.createElement('style');
      style.dataset.plugin = 'reca-details-demo';
      style.textContent = ${JSON.stringify(css)};
      document.head.appendChild(style);
    }
${traceRuntime}
${client.split('\n').map(line => `    ${line}`).join('\n')}
    return module.exports;
  }
});\n`

await mkdir(resolve(root, 'lib'), { recursive: true })
await Promise.all([
  writeFile(resolve(root, 'lib/index.js'), host),
  writeFile(resolve(root, 'lib/client.js'), bundle),
])
console.log(`built ${pkg.name}`)
