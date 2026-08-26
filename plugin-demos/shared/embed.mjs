import { readFile } from 'node:fs/promises'

function indent(value, spaces) {
  const prefix = ' '.repeat(spaces)
  return value.split('\n').map((line) => `${prefix}${line}`).join('\n')
}

export async function embeddedTraceRuntime(spaces = 0) {
  const [adapter, react] = await Promise.all([
    readFile(new URL('./trace-adapter.cjs', import.meta.url), 'utf8'),
    readFile(new URL('./trace-react.cjs', import.meta.url), 'utf8'),
  ])
  const source = `const RecaTraceAdapter = (() => {
  const module = { exports: {} };
  const exports = module.exports;
${indent(adapter, 2)}
  return module.exports;
})();
const RecaTrace = (() => {
  const module = { exports: {} };
  const exports = module.exports;
${indent(react, 2)}
  return module.exports;
})();`
  return indent(source, spaces)
}
