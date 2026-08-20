import assert from 'node:assert/strict';

process.env.KCC_ALIVE_ATTESTATION_SECRET = 'test-only-kcc-alive-secret';

const { createKccAliveAttestation, evaluateKccAlive } = await import('../server/kccAliveGate.js');

const now = Date.now();
const observedNow = new Date(now - 5 * 60 * 1000).toISOString();
const observedRecent = new Date(now - 4 * 60 * 1000).toISOString();
const observedStale = new Date(now - 16 * 60 * 1000).toISOString();
const observedFuture = new Date(now + 2 * 60 * 1000).toISOString();
const historicalReferenceTime = new Date(now - 24 * 60 * 60 * 1000).toISOString();

const realFulfillment = {
  source: 'live-provider' as const,
  provider: 'CJ_DROPSHIPPING' as const,
  providerOrderId: 'CJ-REAL-001',
  providerRequestId: 'REQ-CJ-REAL-001',
  trackingNumber: 'TRACK-REAL-001',
  status: 'SUBMITTED' as const,
  observedAt: observedNow,
};

const realNotification = {
  source: 'live-provider' as const,
  channel: 'WHATSAPP' as const,
  providerMessageId: 'MSG-REAL-001',
  providerRequestId: 'REQ-MSG-REAL-001',
  status: 'DELIVERED' as const,
  recipientConfirmed: true,
  observedAt: observedRecent,
};

const missing = evaluateKccAlive({});
assert.equal(missing.kccAlive, false);
assert.match(missing.blockers.join('\n'), /real fulfillment evidence is missing/);
assert.match(missing.blockers.join('\n'), /real notification evidence is missing/);

const forged = evaluateKccAlive({
  fulfillment: { kind: 'fulfillment', evidence: realFulfillment, signature: '00'.repeat(32) },
  notification: { kind: 'notification', evidence: realNotification, signature: '00'.repeat(32) },
});
assert.equal(forged.kccAlive, false);
assert.match(forged.blockers.join('\n'), /attestation signature is invalid/);

const malformed = evaluateKccAlive({
  fulfillment: { kind: 'fulfillment', evidence: null as never, signature: '00'.repeat(32) },
  notification: createKccAliveAttestation('notification', realNotification),
});
assert.equal(malformed.kccAlive, false);
assert.match(malformed.blockers.join('\n'), /fulfillment: fulfillment evidence attestation payload is invalid/);

const sandbox = evaluateKccAlive({
  fulfillment: createKccAliveAttestation('fulfillment', { ...realFulfillment, source: 'contract' as never }),
  notification: createKccAliveAttestation('notification', { ...realNotification, source: 'sandbox' as never }),
});
assert.equal(sandbox.kccAlive, false);
assert.equal(sandbox.evidence.fulfillment, false);
assert.equal(sandbox.evidence.notification, false);

const stale = evaluateKccAlive({
  fulfillment: createKccAliveAttestation('fulfillment', { ...realFulfillment, observedAt: observedStale }),
  notification: createKccAliveAttestation('notification', realNotification),
});
assert.equal(stale.kccAlive, false);
assert.match(stale.blockers.join('\n'), /stale/);

const future = evaluateKccAlive({
  fulfillment: createKccAliveAttestation('fulfillment', { ...realFulfillment, observedAt: observedFuture }),
  notification: createKccAliveAttestation('notification', realNotification),
});
assert.equal(future.kccAlive, false);
assert.match(future.blockers.join('\n'), /future/);

const incomplete = evaluateKccAlive({
  fulfillment: createKccAliveAttestation('fulfillment', realFulfillment),
  notification: createKccAliveAttestation('notification', { ...realNotification, recipientConfirmed: false }),
});
assert.equal(incomplete.kccAlive, false);
assert.match(incomplete.blockers.join('\n'), /recipient confirmation is missing/);

const replayAttempt = evaluateKccAlive({
  fulfillment: createKccAliveAttestation('fulfillment', { ...realFulfillment, observedAt: new Date(now - 20 * 60 * 1000).toISOString() }),
  notification: createKccAliveAttestation('notification', { ...realNotification, observedAt: new Date(now - 20 * 60 * 1000).toISOString() }),
});
assert.equal(replayAttempt.kccAlive, false);
assert.ok(replayAttempt.blockers.some((blocker) => blocker.includes('stale')));
void historicalReferenceTime;

const email = evaluateKccAlive({
  fulfillment: createKccAliveAttestation('fulfillment', realFulfillment),
  notification: createKccAliveAttestation('notification', { ...realNotification, channel: 'EMAIL' as never }),
});
assert.equal(email.kccAlive, false);
assert.match(email.blockers.join('\n'), /channel must be WHATSAPP/);

const real = evaluateKccAlive({
  fulfillment: createKccAliveAttestation('fulfillment', realFulfillment),
  notification: createKccAliveAttestation('notification', realNotification),
});
assert.equal(real.kccAlive, true);
assert.deepEqual(real.blockers, []);
assert.deepEqual(real.evidence, { fulfillment: true, notification: true });

console.log('KCC ALIVE gate proof passed: only valid attested live-provider evidence within trusted server-time freshness bounds can set kccAlive=true.');
