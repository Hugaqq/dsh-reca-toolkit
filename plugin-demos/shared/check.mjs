import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  createRecaTracePoller,
  extractRunId,
  mergeTraceEvents,
  normalizeRecaTraceSnapshot,
  publicArtifactUrl,
} = require('./trace-adapter.cjs')

const fixture = JSON.parse(await readFile(new URL('./fixtures/real-run-snapshot.json', import.meta.url), 'utf8'))
const gatewayBaseUrl = 'http://gateway.local:8787'

assert.equal(extractRunId({ content: '{"run_id":"190160905a09"}' }), '190160905a09')
assert.equal(extractRunId('queued; run_id: 190160905a09'), '190160905a09')
assert.equal(
  publicArtifactUrl(
    '/mnt/cpfs02/akide/us/haoming/dsh-reca-toolkit/.dsh_runs/190160905a09/run/final.mp4',
    '190160905a09',
    gatewayBaseUrl,
  ),
  'http://gateway.local:8787/v1/runs/190160905a09/artifacts/run/final.mp4',
)

const snapshot = normalizeRecaTraceSnapshot({ ...fixture, gatewayBaseUrl })
assert.equal(snapshot.runId, '190160905a09')
assert.match(snapshot.title, /暴雨后的海边悬崖/)
assert.equal(snapshot.status, 'active')
assert.equal(snapshot.counts.shots, 2)
assert.equal(snapshot.counts.segments, 3)
assert.equal(snapshot.counts.completedSegments, 2)
assert.equal(snapshot.counts.assets, 4)
assert.equal(snapshot.counts.repairs, 1)
assert.equal(snapshot.film.src, null)
assert.equal(snapshot.nodes.find((node) => node.id === 'seg_shot02_turn_home_00').status, 'active')
assert.equal(snapshot.nodes.find((node) => node.kind === 'repair').status, 'done')
assert.match(snapshot.assets[0].imageUrl, /^http:\/\/gateway\.local:8787\/v1\/runs\//)
assert.equal(mergeTraceEvents(fixture.events, fixture.events).length, fixture.events.length)

function fakeResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return structuredClone(payload) },
  }
}

async function fakeFetch(input) {
  const path = new URL(String(input)).pathname
  if (path.endsWith('/events')) return fakeResponse({ run_id: fixture.status.run_id, events: fixture.events })
  if (path.endsWith('/artifacts/render_plan.json')) return fakeResponse(fixture.renderPlan)
  if (path.endsWith('/artifacts/run/audit.json')) return fakeResponse(fixture.audit)
  if (path.endsWith('/artifacts/request.json')) return fakeResponse(fixture.request)
  if (path.endsWith('/artifacts/run/run_report.json')) return fakeResponse({}, 404)
  if (path.endsWith('/artifacts')) return fakeResponse(fixture.artifacts)
  if (path.endsWith(`/v1/runs/${fixture.status.run_id}`)) return fakeResponse(fixture.status)
  return fakeResponse({}, 404)
}

let delivered
const poller = createRecaTracePoller({
  runId: fixture.status.run_id,
  gatewayBaseUrl,
  fetch: fakeFetch,
  onSnapshot(value) { delivered = value },
})
const polled = await poller.refresh()
assert.equal(polled.runId, fixture.status.run_id)
assert.equal(delivered.counts.completedSegments, 2)
assert.equal(poller.getSnapshot(), delivered)
poller.stop()

const terminalInput = structuredClone(fixture)
terminalInput.status.state = 'succeeded'
terminalInput.status.gateway_state = 'succeeded'
terminalInput.status.progress = 1
terminalInput.status.final_video = 'http://127.0.0.1:8787/v1/runs/190160905a09/artifacts/run/final.mp4'
terminalInput.status.reca_state.state = 'succeeded'
terminalInput.status.reca_state.stage = 'succeeded'
terminalInput.status.reca_state.progress = 1
terminalInput.status.reca_state.video_state = 'complete'
terminalInput.artifacts.artifacts[0].status = 'ready'
terminalInput.events.push({ ts: 1787194400, type: 'reca.concat.start' })
terminalInput.events.push({ ts: 1787194410, type: 'reca.final.ready', node_id: 'root' })
const terminal = normalizeRecaTraceSnapshot({ ...terminalInput, gatewayBaseUrl })
assert.equal(terminal.status, 'done')
assert.equal(terminal.progress, 100)
assert.equal(terminal.counts.completedSegments, 3)
assert.equal(terminal.film.src, 'http://gateway.local:8787/v1/runs/190160905a09/artifacts/run/final.mp4')

console.log('ok shared ReCA trace adapter: real fields, event accumulation, polling, terminal artifact')
