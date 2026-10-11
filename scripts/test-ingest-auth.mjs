import assert from 'node:assert/strict'
import { isTelemetryIngestAuthorized } from '../server/api/lib/telemetry-auth.js'

const secret = 'test-ingest-token-32-bytes-minimum'

assert.equal(isTelemetryIngestAuthorized({ remoteAddress: '127.0.0.1' }), true)
assert.equal(isTelemetryIngestAuthorized({ remoteAddress: '::ffff:127.0.0.1' }), true)
assert.equal(isTelemetryIngestAuthorized({ remoteAddress: '192.168.1.20' }), false)
assert.equal(isTelemetryIngestAuthorized({
  remoteAddress: '192.168.1.20',
  providedToken: 'wrong-token',
  expectedToken: secret,
}), false)
assert.equal(isTelemetryIngestAuthorized({
  remoteAddress: '192.168.1.20',
  providedToken: secret,
  expectedToken: secret,
}), true)
assert.equal(isTelemetryIngestAuthorized({
  remoteAddress: '192.168.1.20',
  providedToken: 'railway-sign-ingest',
}), false)

console.log('Telemetry ingest authorization tests passed (6 cases)')
