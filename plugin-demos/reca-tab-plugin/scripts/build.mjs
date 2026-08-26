import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { embeddedTraceRuntime } from '../../shared/embed.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const css = await readFile(join(root, 'src/reca.css'), 'utf8');
const data = JSON.parse(await readFile(join(root, 'src/demo-data.json'), 'utf8'));
const source = await readFile(join(root, 'src/client/entry.cjs'), 'utf8');
const host = await readFile(join(root, 'src/index.js'), 'utf8');
const traceRuntime = await embeddedTraceRuntime();

const clientBody = source
  .replace('// __RECA_TRACE_RUNTIME__', traceRuntime)
  .replace('__RECA_CSS__', JSON.stringify(css))
  .replace('__RECA_DATA__', JSON.stringify(data));

const indent = (value, spaces) => value.split('\n').map((line) => `${' '.repeat(spaces)}${line}`).join('\n');
const clientBundle = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkg.name)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
${indent(clientBody, 4)}
    return module.exports;
  }
});
`;

await mkdir(join(root, 'lib/types/client'), { recursive: true });
await writeFile(join(root, 'lib/index.js'), host);
await writeFile(join(root, 'lib/client.js'), clientBundle);
await writeFile(join(root, 'lib/types/index.d.ts'), 'export declare function apply(): void;\n');
await writeFile(join(root, 'lib/types/client/index.d.ts'), [
  "import type { Context } from '@deepseek-ai/cordis';",
  "import type { ComponentType } from 'react';",
  "export declare const inject: readonly ['slots', 'connection'];",
  'export declare const RecaTabView: ComponentType<Record<string, unknown>>;',
  'export declare function apply(ctx: Context): void;',
  '',
].join('\n'));
await writeFile(join(root, 'demo/reca.css'), css);
await writeFile(join(root, 'demo/data.js'), `window.RECA_DEMO_DATA = ${JSON.stringify(data, null, 2)};\n`);

console.log(`built ${pkg.name}: lib/client.js + static demo assets`);
