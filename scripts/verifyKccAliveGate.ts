import assert from 'node:assert/strict';
import { evaluateKccAlive } from '../server/kccAliveGate.js';

const realFulfillment = {
  source: 'live-provider' as const,
  provider: 'CJ_DROPSHIPPING' as const,
  providerOrderId: 'CJ-REAL-001',
  providerRequestId: 'REQ-CJ-REAL-001',
  trackingNumber: 'TRACK-REAL-001',
  status: 'SUBMITTED' as const,
  observedAt: '2026-08-17T19:30:00.000Z',
};

const realNotification = {
  source: 'live-provider' as const,
  channel: 'EMAIL' as const,
  providerMessageId: 'MSG-REAL-001',
  providerRequestId: 'REQ-MSG-REAL-001',
  status: 'DELIVERED' as const,
  recipientConfirmed: true,
  observedAt: '2026-08-17T19:31:00.000Z',
};

const missing = evaluateKccAlive({});
assert.equal(missing.kccAlive, false);
assert.match(missing.blockers.join('\n'), /real fulfillment evidence is missing/);
assert.match(missing.blockers.join('\n'), /real notification evidence is missing/);

const sandbox = evaluateKccAlive({
  fulfillment: { ...realFulfillment, source: 'contract' as never },
  notification: { ...realNotification, source: 'sandbox' as never },
});
assert.equal(sandbox.kccAlive, false);
assert.equal(sandbox.evidence.fulfillment, false);
assert.equal(sandbox.evidence.notification, false);

const incomplete = evaluateKccAlive({
  fulfillment: realFulfillment,
  notification: { ...realNotification, recipientConfirmed: false },
});
assert.equal(incomplete.kccAlive, false);
assert.match(incomplete.blockers.join('\n'), /recipient confirmation is missing/);

const real = evaluateKccAlive({ fulfillment: realFulfillment, notification: realNotification });
assert.equal(real.kccAlive, true);
assert.deepEqual(real.blockers, []);
assert.deepEqual(real.evidence, { fulfillment: true, notification: true });

console.log('KCC ALIVE gate proof passed: only complete live-provider fulfillment and notification evidence can set kccAlive=true.');
