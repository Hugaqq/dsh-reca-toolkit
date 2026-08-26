import { RecaClient } from '../src/client.js'

const originalFetch = globalThis.fetch
const calls = []
globalThis.fetch = async (url, options) => {
  calls.push({ url, options })
  return {
    ok: true,
    status: 200,
    async text() { return '{"state":"running"}' },
  }
}

try {
  const client = new RecaClient('https://reca.example.test/', 'host-secret')
  const status = await client.status('run_123')
  if (status.state !== 'running') throw new Error('Host client did not decode Gateway JSON')
  if (calls[0].url !== 'https://reca.example.test/v1/runs/run_123') {
    throw new Error(`unexpected Gateway URL: ${calls[0].url}`)
  }
  if (calls[0].options.headers.authorization !== 'Bearer host-secret') {
    throw new Error('Host client did not attach RECA_GATEWAY_TOKEN')
  }

  const started = await client.createVideo({ story: 'offline contract probe', options: { backend: 'wan' } })
  if (started.state !== 'running') throw new Error('Host client did not decode run submission JSON')
  if (calls[1].url !== 'https://reca.example.test/v1/runs') {
    throw new Error(`unexpected run submission URL: ${calls[1].url}`)
  }
  if (calls[1].options.method !== 'POST') throw new Error('Host run submission was not POST')
  if (calls[1].options.headers['content-type'] !== 'application/json') {
    throw new Error('Host run submission did not use JSON')
  }
  if (calls[1].options.headers.authorization !== 'Bearer host-secret') {
    throw new Error('Host run submission did not attach RECA_GATEWAY_TOKEN')
  }
  const submitted = JSON.parse(calls[1].options.body)
  if (submitted.story !== 'offline contract probe' || submitted.options?.backend !== 'wan') {
    throw new Error('Host run submission changed the ReCA request payload')
  }

  await client.rawFetch('/v1/runs/run_123/artifacts/run/final.mp4', {
    headers: { range: 'bytes=0-99' },
  })
  if (calls[2].options.headers.range !== 'bytes=0-99') {
    throw new Error('Host client did not preserve media Range')
  }
  if (calls[2].options.headers.authorization !== 'Bearer host-secret') {
    throw new Error('Host media fetch did not attach RECA_GATEWAY_TOKEN')
  }
  console.log('ok - Host Gateway client submits runs and keeps URL/token outside the browser bundle')
} finally {
  globalThis.fetch = originalFetch
}
