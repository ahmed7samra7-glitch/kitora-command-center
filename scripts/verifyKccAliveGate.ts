import assert from 'node:assert/strict';

process.env.KCC_ALIVE_ATTESTATION_SECRET = 'test-only-kcc-alive-secret';

const { createKccAliveAttestation, evaluateKccAlive } = await import('../server/kccAliveGate.js');

const referenceTime = '2026-08-18T06:00:00.000Z';
const realFulfillment = {
  source: 'live-provider' as const,
  provider: 'CJ_DROPSHIPPING' as const,
  providerOrderId: 'CJ-REAL-001',
  providerRequestId: 'REQ-CJ-REAL-001',
  trackingNumber: 'TRACK-REAL-001',
  status: 'SUBMITTED' as const,
  observedAt: '2026-08-18T05:55:00.000Z',
};

const realNotification = {
  source: 'live-provider' as const,
  channel: 'EMAIL' as const,
  providerMessageId: 'MSG-REAL-001',
  providerRequestId: 'REQ-MSG-REAL-001',
  status: 'DELIVERED' as const,
  recipientConfirmed: true,
  observedAt: '2026-08-18T05:56:00.000Z',
};

const missing = evaluateKccAlive({ referenceTime });
assert.equal(missing.kccAlive, false);
assert.match(missing.blockers.join('\n'), /real fulfillment evidence is missing/);
assert.match(missing.blockers.join('\n'), /real notification evidence is missing/);

const forged = evaluateKccAlive({
  referenceTime,
  fulfillment: { kind: 'fulfillment', evidence: realFulfillment, signature: '00'.repeat(32) },
  notification: { kind: 'notification', evidence: realNotification, signature: '00'.repeat(32) },
});
assert.equal(forged.kccAlive, false);
assert.match(forged.blockers.join('\n'), /attestation signature is invalid/);

const sandbox = evaluateKccAlive({
  referenceTime,
  fulfillment: createKccAliveAttestation('fulfillment', { ...realFulfillment, source: 'contract' as never }),
  notification: createKccAliveAttestation('notification', { ...realNotification, source: 'sandbox' as never }),
});
assert.equal(sandbox.kccAlive, false);
assert.equal(sandbox.evidence.fulfillment, false);
assert.equal(sandbox.evidence.notification, false);

const stale = evaluateKccAlive({
  referenceTime,
  fulfillment: createKccAliveAttestation('fulfillment', { ...realFulfillment, observedAt: '2026-08-18T05:00:00.000Z' }),
  notification: createKccAliveAttestation('notification', realNotification),
});
assert.equal(stale.kccAlive, false);
assert.match(stale.blockers.join('\n'), /stale/);

const future = evaluateKccAlive({
  referenceTime,
  fulfillment: createKccAliveAttestation('fulfillment', { ...realFulfillment, observedAt: '2026-08-18T06:02:00.000Z' }),
  notification: createKccAliveAttestation('notification', realNotification),
});
assert.equal(future.kccAlive, false);
assert.match(future.blockers.join('\n'), /future/);

const incomplete = evaluateKccAlive({
  referenceTime,
  fulfillment: createKccAliveAttestation('fulfillment', realFulfillment),
  notification: createKccAliveAttestation('notification', { ...realNotification, recipientConfirmed: false }),
});
assert.equal(incomplete.kccAlive, false);
assert.match(incomplete.blockers.join('\n'), /recipient confirmation is missing/);

const real = evaluateKccAlive({
  referenceTime,
  fulfillment: createKccAliveAttestation('fulfillment', realFulfillment),
  notification: createKccAliveAttestation('notification', realNotification),
});
assert.equal(real.kccAlive, true);
assert.deepEqual(real.blockers, []);
assert.deepEqual(real.evidence, { fulfillment: true, notification: true });

console.log('KCC ALIVE gate proof passed: only valid attested live-provider evidence within freshness bounds can set kccAlive=true.');
