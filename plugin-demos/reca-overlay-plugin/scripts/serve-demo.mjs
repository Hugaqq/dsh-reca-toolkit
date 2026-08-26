import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../demo')
const port = Number(process.env.PORT || 4172)
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' }

createServer(async (request, response) => {
  const rawPath = new URL(request.url || '/', 'http://localhost').pathname
  const relative = rawPath === '/' ? 'index.html' : rawPath.slice(1)
  const file = normalize(join(root, relative))
  if (!file.startsWith(root)) {
    response.writeHead(403).end()
    return
  }
  try {
    const info = await stat(file)
    if (!info.isFile()) throw new Error('not a file')
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' })
    createReadStream(file).pipe(response)
  } catch {
    response.writeHead(404).end('Not found')
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`ReCA overlay demo: http://127.0.0.1:${port}`)
})
